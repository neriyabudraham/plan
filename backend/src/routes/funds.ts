import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authenticate, requireEditorOrAdmin } from '../middleware/auth.js';
import { AuthRequest, Fund } from '../types/index.js';

const router = Router();

const createFundSchema = z.object({
  name: z.string().min(1, 'שם קופה נדרש'),
  description: z.string().optional(),
  icon: z.string().default('💰'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
  target_amount: z.number().min(0).default(0),
  target_date: z.string().optional(),
  currency: z.enum(['ILS', 'USD', 'EUR']).default('ILS'),
});

const updateFundSchema = createFundSchema.partial();

// Get all funds with balance
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query<Fund>(`
      SELECT 
        f.*,
        COALESCE(SUM(CASE 
          WHEN t.type IN ('deposit', 'interest') THEN t.amount 
          WHEN t.type IN ('withdrawal', 'adjustment') THEN -t.amount 
          ELSE 0 
        END), 0) as current_balance
      FROM funds f
      LEFT JOIN transactions t ON f.id = t.fund_id
      WHERE f.is_active = true
      GROUP BY f.id
      ORDER BY f.created_at DESC
    `);
    
    const funds = result.rows.map(fund => ({
      ...fund,
      current_balance: Number(fund.current_balance),
      target_amount: Number(fund.target_amount),
      progress_percent: fund.target_amount > 0 
        ? Math.min(Math.round((Number(fund.current_balance) / Number(fund.target_amount)) * 100), 100)
        : 0,
    }));
    
    res.json(funds);
  } catch (error) {
    console.error('Get funds error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get fund by ID with transactions
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
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
      WHERE f.id = $1
      GROUP BY f.id
    `, [req.params.id]);
    
    if (fundResult.rows.length === 0) {
      return res.status(404).json({ error: 'קופה לא נמצאה' });
    }
    
    const fund = fundResult.rows[0];
    
    res.json({
      ...fund,
      current_balance: Number(fund.current_balance),
      target_amount: Number(fund.target_amount),
      progress_percent: fund.target_amount > 0 
        ? Math.min(Math.round((Number(fund.current_balance) / Number(fund.target_amount)) * 100), 100)
        : 0,
    });
  } catch (error) {
    console.error('Get fund error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Create fund
router.post('/', authenticate, requireEditorOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const data = createFundSchema.parse(req.body);
    
    const result = await query<Fund>(`
      INSERT INTO funds (id, name, description, icon, color, target_amount, target_date, currency, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      uuidv4(),
      data.name,
      data.description || null,
      data.icon,
      data.color,
      data.target_amount,
      data.target_date || null,
      data.currency,
      req.user!.id,
    ]);
    
    res.status(201).json({
      ...result.rows[0],
      current_balance: 0,
      progress_percent: 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create fund error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update fund
router.patch('/:id', authenticate, requireEditorOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const updates = updateFundSchema.parse(req.body);
    
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        setClauses.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    });
    
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'אין שדות לעדכון' });
    }
    
    setClauses.push(`updated_at = NOW()`);
    values.push(req.params.id);
    
    const result = await query<Fund>(`
      UPDATE funds SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND is_active = true
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'קופה לא נמצאה' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update fund error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete fund (soft delete)
router.delete('/:id', authenticate, requireEditorOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'UPDATE funds SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'קופה לא נמצאה' });
    }
    
    res.json({ message: 'קופה נמחקה' });
  } catch (error) {
    console.error('Delete fund error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get fund history (balance over time)
router.get('/:id/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { period = '12m' } = req.query;
    
    let interval: string;
    let groupBy: string;
    
    switch (period) {
      case '7d':
        interval = '7 days';
        groupBy = 'day';
        break;
      case '30d':
        interval = '30 days';
        groupBy = 'day';
        break;
      case '6m':
        interval = '6 months';
        groupBy = 'week';
        break;
      case '12m':
      default:
        interval = '12 months';
        groupBy = 'month';
        break;
    }
    
    const result = await query(`
      SELECT 
        DATE_TRUNC($1, transaction_date) as date,
        SUM(CASE 
          WHEN type IN ('deposit', 'interest') THEN amount 
          WHEN type IN ('withdrawal', 'adjustment') THEN -amount 
          ELSE 0 
        END) as net_change
      FROM transactions
      WHERE fund_id = $2 AND transaction_date >= NOW() - INTERVAL '${interval}'
      GROUP BY DATE_TRUNC($1, transaction_date)
      ORDER BY date
    `, [groupBy, req.params.id]);
    
    // Calculate running balance
    let runningBalance = 0;
    const history = result.rows.map(row => {
      runningBalance += Number(row.net_change);
      return {
        date: row.date,
        balance: runningBalance,
      };
    });
    
    res.json(history);
  } catch (error) {
    console.error('Get fund history error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
