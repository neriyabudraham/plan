import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authenticate, requireEditorOrAdmin } from '../middleware/auth.js';
import { AuthRequest, Transaction, Fund } from '../types/index.js';
import { notifyDeposit, notifyWithdrawal, notifyTargetReached, notifyMilestone } from '../services/whatsapp.js';
import { getMilestones } from '../utils/helpers.js';

const router = Router();

const createTransactionSchema = z.object({
  fund_id: z.string().uuid('מזהה קופה לא תקין'),
  amount: z.number().positive('סכום חייב להיות חיובי'),
  type: z.enum(['deposit', 'withdrawal', 'interest', 'adjustment']),
  description: z.string().optional(),
  transaction_date: z.string().optional(),
});

// Get all transactions (with optional fund filter)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fund_id, limit = 50, offset = 0 } = req.query;
    
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (fund_id) {
      whereClause = `WHERE t.fund_id = $${paramIndex++}`;
      params.push(fund_id);
    }
    
    params.push(Number(limit), Number(offset));
    
    const result = await query<Transaction>(`
      SELECT 
        t.*,
        f.name as fund_name,
        f.icon as fund_icon,
        f.color as fund_color,
        f.currency as fund_currency,
        u.name as user_name
      FROM transactions t
      JOIN funds f ON t.fund_id = f.id
      LEFT JOIN users u ON t.created_by = u.id
      ${whereClause}
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params);
    
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM transactions t ${whereClause}`,
      fund_id ? [fund_id] : []
    );
    
    res.json({
      transactions: result.rows.map(t => ({
        ...t,
        amount: Number(t.amount),
      })),
      total: Number(countResult.rows[0].count),
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Create transaction
router.post('/', authenticate, requireEditorOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const data = createTransactionSchema.parse(req.body);
    
    // Get fund info
    const fundResult = await query<Fund>(`
      SELECT 
        f.*,
        COALESCE(SUM(CASE 
          WHEN t.type IN ('deposit', 'interest') THEN t.amount 
          WHEN t.type IN ('withdrawal', 'adjustment') THEN -t.amount 
          ELSE 0 
        END), 0) as current_balance
      FROM funds f
      LEFT JOIN transactions t ON f.id = t.fund_id
      WHERE f.id = $1 AND f.is_active = true
      GROUP BY f.id
    `, [data.fund_id]);
    
    if (fundResult.rows.length === 0) {
      return res.status(404).json({ error: 'קופה לא נמצאה' });
    }
    
    const fund = fundResult.rows[0];
    const currentBalance = Number(fund.current_balance);
    
    // Check if withdrawal exceeds balance
    if (data.type === 'withdrawal' && data.amount > currentBalance) {
      return res.status(400).json({ error: 'אין מספיק כסף בקופה' });
    }
    
    // Create transaction
    const result = await query<Transaction>(`
      INSERT INTO transactions (id, fund_id, amount, type, description, transaction_date, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      uuidv4(),
      data.fund_id,
      data.amount,
      data.type,
      data.description || null,
      data.transaction_date || new Date().toISOString().split('T')[0],
      req.user!.id,
    ]);
    
    // Calculate new balance
    const newBalance = data.type === 'deposit' || data.type === 'interest'
      ? currentBalance + data.amount
      : currentBalance - data.amount;
    
    // Send WhatsApp notifications
    if (data.type === 'deposit') {
      await notifyDeposit(fund.name, data.amount, req.user!.name, fund.currency);
      
      // Check milestones
      const milestones = getMilestones();
      const targetAmount = Number(fund.target_amount);
      
      if (targetAmount > 0) {
        const oldPercent = (currentBalance / targetAmount) * 100;
        const newPercent = (newBalance / targetAmount) * 100;
        
        for (const milestone of milestones) {
          if (oldPercent < milestone && newPercent >= milestone) {
            if (milestone === 100) {
              await notifyTargetReached(fund.name, targetAmount, fund.currency);
            } else {
              await notifyMilestone(fund.name, milestone, newBalance, targetAmount, fund.currency);
            }
            break;
          }
        }
      }
    } else if (data.type === 'withdrawal') {
      await notifyWithdrawal(fund.name, data.amount, req.user!.name, fund.currency);
    }
    
    res.status(201).json({
      ...result.rows[0],
      amount: Number(result.rows[0].amount),
      fund_name: fund.name,
      user_name: req.user!.name,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete transaction
router.delete('/:id', authenticate, requireEditorOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM transactions WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'תנועה לא נמצאה' });
    }
    
    res.json({ message: 'תנועה נמחקה' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get transaction summary by period
router.get('/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'month' } = req.query;
    
    let interval: string;
    switch (period) {
      case 'week':
        interval = '7 days';
        break;
      case 'year':
        interval = '1 year';
        break;
      case 'month':
      default:
        interval = '1 month';
        break;
    }
    
    const result = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposits,
        COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as total_withdrawals,
        COALESCE(SUM(CASE WHEN type = 'interest' THEN amount ELSE 0 END), 0) as total_interest,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE transaction_date >= NOW() - INTERVAL '${interval}'
    `);
    
    const summary = result.rows[0];
    
    res.json({
      total_deposits: Number(summary.total_deposits),
      total_withdrawals: Number(summary.total_withdrawals),
      total_interest: Number(summary.total_interest),
      net_change: Number(summary.total_deposits) + Number(summary.total_interest) - Number(summary.total_withdrawals),
      transaction_count: Number(summary.transaction_count),
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
