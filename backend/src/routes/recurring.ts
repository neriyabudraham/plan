import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authenticate, requireEditorOrAdmin } from '../middleware/auth.js';
import { AuthRequest, RecurringDeposit } from '../types/index.js';
import { getNextRunDate } from '../utils/helpers.js';

const router = Router();

const createRecurringSchema = z.object({
  fund_id: z.string().uuid('מזהה קופה לא תקין'),
  amount: z.number().positive('סכום חייב להיות חיובי'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  day_of_month: z.number().min(1).max(31).optional(),
  day_of_week: z.number().min(0).max(6).optional(),
});

const updateRecurringSchema = z.object({
  amount: z.number().positive().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  day_of_month: z.number().min(1).max(31).optional(),
  day_of_week: z.number().min(0).max(6).optional(),
  is_active: z.boolean().optional(),
});

// Get all recurring deposits
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query<RecurringDeposit & { fund_name: string; fund_icon: string }>(`
      SELECT 
        r.*,
        f.name as fund_name,
        f.icon as fund_icon,
        f.color as fund_color
      FROM recurring_deposits r
      JOIN funds f ON r.fund_id = f.id
      WHERE f.is_active = true
      ORDER BY r.next_run ASC
    `);
    
    res.json(result.rows.map(r => ({
      ...r,
      amount: Number(r.amount),
    })));
  } catch (error) {
    console.error('Get recurring deposits error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Create recurring deposit
router.post('/', authenticate, requireEditorOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const data = createRecurringSchema.parse(req.body);
    
    // Verify fund exists
    const fundResult = await query(
      'SELECT id FROM funds WHERE id = $1 AND is_active = true',
      [data.fund_id]
    );
    
    if (fundResult.rows.length === 0) {
      return res.status(404).json({ error: 'קופה לא נמצאה' });
    }
    
    const nextRun = getNextRunDate(data.frequency, data.day_of_month, data.day_of_week);
    
    const result = await query<RecurringDeposit>(`
      INSERT INTO recurring_deposits (id, fund_id, amount, frequency, day_of_month, day_of_week, next_run, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      uuidv4(),
      data.fund_id,
      data.amount,
      data.frequency,
      data.day_of_month || null,
      data.day_of_week || null,
      nextRun,
      req.user!.id,
    ]);
    
    res.status(201).json({
      ...result.rows[0],
      amount: Number(result.rows[0].amount),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create recurring deposit error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update recurring deposit
router.patch('/:id', authenticate, requireEditorOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const updates = updateRecurringSchema.parse(req.body);
    
    // Get current recurring deposit
    const currentResult = await query<RecurringDeposit>(
      'SELECT * FROM recurring_deposits WHERE id = $1',
      [req.params.id]
    );
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'הפקדה חוזרת לא נמצאה' });
    }
    
    const current = currentResult.rows[0];
    
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (updates.amount !== undefined) {
      setClauses.push(`amount = $${paramIndex++}`);
      values.push(updates.amount);
    }
    if (updates.frequency !== undefined) {
      setClauses.push(`frequency = $${paramIndex++}`);
      values.push(updates.frequency);
    }
    if (updates.day_of_month !== undefined) {
      setClauses.push(`day_of_month = $${paramIndex++}`);
      values.push(updates.day_of_month);
    }
    if (updates.day_of_week !== undefined) {
      setClauses.push(`day_of_week = $${paramIndex++}`);
      values.push(updates.day_of_week);
    }
    if (updates.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }
    
    // Recalculate next_run if frequency or day changed
    if (updates.frequency || updates.day_of_month !== undefined || updates.day_of_week !== undefined) {
      const frequency = updates.frequency || current.frequency;
      const dayOfMonth = updates.day_of_month ?? current.day_of_month;
      const dayOfWeek = updates.day_of_week ?? current.day_of_week;
      
      const nextRun = getNextRunDate(frequency, dayOfMonth ?? undefined, dayOfWeek ?? undefined);
      setClauses.push(`next_run = $${paramIndex++}`);
      values.push(nextRun);
    }
    
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'אין שדות לעדכון' });
    }
    
    setClauses.push(`updated_at = NOW()`);
    values.push(req.params.id);
    
    const result = await query<RecurringDeposit>(`
      UPDATE recurring_deposits SET ${setClauses.join(', ')} WHERE id = $${paramIndex}
      RETURNING *
    `, values);
    
    res.json({
      ...result.rows[0],
      amount: Number(result.rows[0].amount),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update recurring deposit error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete recurring deposit
router.delete('/:id', authenticate, requireEditorOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM recurring_deposits WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'הפקדה חוזרת לא נמצאה' });
    }
    
    res.json({ message: 'הפקדה חוזרת נמחקה' });
  } catch (error) {
    console.error('Delete recurring deposit error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
