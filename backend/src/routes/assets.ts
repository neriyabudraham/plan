import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AuthRequest, Asset, AssetTransaction } from '../types/index';

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const assetSchema = z.object({
  owner_id: z.string().uuid().optional(),
  linked_child_id: z.string().uuid().optional(),
  name: z.string().min(1, 'שם נדרש'),
  asset_type: z.enum(['savings', 'investment', 'pension', 'study_fund', 'child_savings', 'provident', 'real_estate', 'other']),
  institution: z.string().optional(),
  account_number: z.string().optional(),
  current_balance: z.number().min(0).default(0),
  currency: z.string().length(3).default('ILS'),
  expected_annual_return: z.number().min(-100).max(100).default(5),
  management_fee_percent: z.number().min(0).max(10).default(0),
  management_fee_deposit_percent: z.number().min(0).max(10).default(0),
  monthly_deposit: z.number().min(0).default(0),
  employer_deposit: z.number().min(0).default(0),
  icon: z.string().default('💰'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
  notes: z.string().optional(),
});

const transactionSchema = z.object({
  amount: z.number().positive('סכום חייב להיות חיובי'),
  type: z.enum(['deposit', 'withdrawal', 'interest', 'fee', 'adjustment']),
  description: z.string().optional(),
  transaction_date: z.string().optional(),
});

// ============================================
// ASSETS
// ============================================

// Get all assets
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { type, owner_id, active_only } = req.query;
    
    let whereClause = 'WHERE a.user_id = $1';
    const params: any[] = [req.user!.id];
    let paramIndex = 2;
    
    if (type) {
      whereClause += ` AND a.asset_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    if (owner_id) {
      whereClause += ` AND a.owner_id = $${paramIndex}`;
      params.push(owner_id);
      paramIndex++;
    }
    
    if (active_only !== 'false') {
      whereClause += ' AND a.is_active = true';
    }
    
    const result = await query<Asset>(
      `SELECT a.*,
        owner.name as owner_name,
        child.name as linked_child_name
       FROM assets a
       LEFT JOIN family_members owner ON a.owner_id = owner.id
       LEFT JOIN family_members child ON a.linked_child_id = child.id
       ${whereClause}
       ORDER BY a.asset_type, a.name`,
      params
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get assets error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get single asset with recent transactions
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const assetResult = await query<Asset>(
      `SELECT a.*,
        owner.name as owner_name,
        child.name as linked_child_name
       FROM assets a
       LEFT JOIN family_members owner ON a.owner_id = owner.id
       LEFT JOIN family_members child ON a.linked_child_id = child.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [req.params.id, req.user!.id]
    );
    
    if (assetResult.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    const transactionsResult = await query<AssetTransaction>(
      `SELECT * FROM asset_transactions 
       WHERE asset_id = $1 
       ORDER BY transaction_date DESC, created_at DESC 
       LIMIT 20`,
      [req.params.id]
    );
    
    res.json({
      ...assetResult.rows[0],
      recent_transactions: transactionsResult.rows,
    });
  } catch (error) {
    console.error('Get asset error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Create asset
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  
  try {
    const data = assetSchema.parse(req.body);
    
    await client.query('BEGIN');
    
    const assetId = uuidv4();
    
    const result = await client.query(
      `INSERT INTO assets 
       (id, user_id, owner_id, linked_child_id, name, asset_type, institution, account_number,
        current_balance, currency, expected_annual_return, management_fee_percent, 
        management_fee_deposit_percent, monthly_deposit, employer_deposit, icon, color, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        assetId,
        req.user!.id,
        data.owner_id || null,
        data.linked_child_id || null,
        data.name,
        data.asset_type,
        data.institution || null,
        data.account_number || null,
        data.current_balance,
        data.currency,
        data.expected_annual_return,
        data.management_fee_percent,
        data.management_fee_deposit_percent,
        data.monthly_deposit,
        data.employer_deposit,
        data.icon,
        data.color,
        data.notes || null,
      ]
    );
    
    // If initial balance > 0, create initial transaction
    if (data.current_balance > 0) {
      await client.query(
        `INSERT INTO asset_transactions 
         (id, asset_id, amount, type, description, transaction_date, balance_after, created_by)
         VALUES ($1, $2, $3, 'deposit', 'יתרה התחלתית', CURRENT_DATE, $4, $5)`,
        [uuidv4(), assetId, data.current_balance, data.current_balance, req.user!.id]
      );
    }
    
    await client.query('COMMIT');
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create asset error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  } finally {
    client.release();
  }
});

// Update asset
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = assetSchema.partial().parse(req.body);
    
    const result = await query<Asset>(
      `UPDATE assets SET
        owner_id = COALESCE($1, owner_id),
        linked_child_id = COALESCE($2, linked_child_id),
        name = COALESCE($3, name),
        asset_type = COALESCE($4, asset_type),
        institution = COALESCE($5, institution),
        account_number = COALESCE($6, account_number),
        currency = COALESCE($7, currency),
        expected_annual_return = COALESCE($8, expected_annual_return),
        management_fee_percent = COALESCE($9, management_fee_percent),
        management_fee_deposit_percent = COALESCE($10, management_fee_deposit_percent),
        monthly_deposit = COALESCE($11, monthly_deposit),
        employer_deposit = COALESCE($12, employer_deposit),
        icon = COALESCE($13, icon),
        color = COALESCE($14, color),
        notes = COALESCE($15, notes),
        updated_at = NOW()
       WHERE id = $16 AND user_id = $17
       RETURNING *`,
      [
        data.owner_id,
        data.linked_child_id,
        data.name,
        data.asset_type,
        data.institution,
        data.account_number,
        data.currency,
        data.expected_annual_return,
        data.management_fee_percent,
        data.management_fee_deposit_percent,
        data.monthly_deposit,
        data.employer_deposit,
        data.icon,
        data.color,
        data.notes,
        req.params.id,
        req.user!.id,
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update asset error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete asset (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `UPDATE assets SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get assets summary
router.get('/summary/all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT 
        asset_type,
        COUNT(*) as count,
        SUM(current_balance) as total_balance,
        SUM(monthly_deposit) as total_monthly_deposits,
        AVG(expected_annual_return) as avg_return
       FROM assets 
       WHERE user_id = $1 AND is_active = true
       GROUP BY asset_type
       ORDER BY total_balance DESC`,
      [req.user!.id]
    );
    
    const totals = await query(
      `SELECT 
        SUM(current_balance) as total,
        SUM(monthly_deposit) as monthly_deposits
       FROM assets 
       WHERE user_id = $1 AND is_active = true`,
      [req.user!.id]
    );
    
    res.json({
      by_type: result.rows,
      totals: totals.rows[0],
    });
  } catch (error) {
    console.error('Get assets summary error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ============================================
// TRANSACTIONS
// ============================================

// Get transactions for asset
router.get('/:id/transactions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    // Verify ownership
    const asset = await query(
      'SELECT id FROM assets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    
    if (asset.rows.length === 0) {
      return res.status(404).json({ error: 'נכס לא נמצא' });
    }
    
    const result = await query<AssetTransaction>(
      `SELECT * FROM asset_transactions 
       WHERE asset_id = $1 
       ORDER BY transaction_date DESC, created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );
    
    const countResult = await query(
      'SELECT COUNT(*) FROM asset_transactions WHERE asset_id = $1',
      [req.params.id]
    );
    
    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Add transaction
router.post('/:id/transactions', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  
  try {
    const data = transactionSchema.parse(req.body);
    
    await client.query('BEGIN');
    
    // Get current balance
    const assetResult = await client.query(
      'SELECT current_balance FROM assets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    
    if (assetResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'נכס לא נמצא' });
    }
    
    const currentBalance = Number(assetResult.rows[0].current_balance);
    let newBalance: number;
    
    // Calculate new balance
    switch (data.type) {
      case 'deposit':
      case 'interest':
        newBalance = currentBalance + data.amount;
        break;
      case 'withdrawal':
      case 'fee':
        if (currentBalance < data.amount) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'אין מספיק יתרה' });
        }
        newBalance = currentBalance - data.amount;
        break;
      case 'adjustment':
        newBalance = data.amount; // Adjustment sets absolute value
        break;
      default:
        newBalance = currentBalance;
    }
    
    // Create transaction
    const transactionResult = await client.query(
      `INSERT INTO asset_transactions 
       (id, asset_id, amount, type, description, transaction_date, balance_after, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        uuidv4(),
        req.params.id,
        data.type === 'adjustment' ? Math.abs(data.amount - currentBalance) : data.amount,
        data.type,
        data.description || null,
        data.transaction_date || new Date().toISOString().split('T')[0],
        newBalance,
        req.user!.id,
      ]
    );
    
    // Update asset balance
    await client.query(
      'UPDATE assets SET current_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, req.params.id]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json(transactionResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  } finally {
    client.release();
  }
});

// Delete transaction (and recalculate balance)
router.delete('/:assetId/transactions/:transactionId', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Get transaction details
    const transactionResult = await client.query(
      `SELECT t.*, a.current_balance 
       FROM asset_transactions t
       JOIN assets a ON t.asset_id = a.id
       WHERE t.id = $1 AND t.asset_id = $2 AND a.user_id = $3`,
      [req.params.transactionId, req.params.assetId, req.user!.id]
    );
    
    if (transactionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'תנועה לא נמצאה' });
    }
    
    const transaction = transactionResult.rows[0];
    let newBalance = Number(transaction.current_balance);
    
    // Reverse the transaction
    switch (transaction.type) {
      case 'deposit':
      case 'interest':
        newBalance -= Number(transaction.amount);
        break;
      case 'withdrawal':
      case 'fee':
        newBalance += Number(transaction.amount);
        break;
    }
    
    // Delete transaction
    await client.query(
      'DELETE FROM asset_transactions WHERE id = $1',
      [req.params.transactionId]
    );
    
    // Update asset balance
    await client.query(
      'UPDATE assets SET current_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, req.params.assetId]
    );
    
    await client.query('COMMIT');
    
    res.json({ message: 'נמחק בהצלחה', new_balance: newBalance });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  } finally {
    client.release();
  }
});

export default router;
