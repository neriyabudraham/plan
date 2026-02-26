import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AuthRequest, SavingsPot } from '../types/index';

const router = Router();

const savingsPotSchema = z.object({
  name: z.string().min(1, 'שם נדרש'),
  target_amount: z.number().min(1, 'סכום יעד נדרש'),
  current_amount: z.number().min(0).default(0),
  monthly_contribution: z.number().min(0).default(0),
  target_date: z.string().optional(),
  icon: z.string().default('🎯'),
  color: z.string().default('#8B5CF6'),
});

// Get all savings pots
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<SavingsPot>(
      `SELECT *,
        CASE WHEN target_amount > 0 THEN 
          ROUND((current_amount / target_amount * 100)::numeric, 1)
        ELSE 0 END as progress_percent,
        CASE WHEN target_date IS NOT NULL AND target_date > CURRENT_DATE THEN
          (EXTRACT(YEAR FROM target_date) - EXTRACT(YEAR FROM CURRENT_DATE)) * 12 +
          (EXTRACT(MONTH FROM target_date) - EXTRACT(MONTH FROM CURRENT_DATE))
        ELSE NULL END as months_remaining
       FROM savings_pots 
       WHERE user_id = $1 
       ORDER BY is_completed ASC, created_at DESC`,
      [req.user!.id]
    );
    
    // Calculate required monthly for each pot
    const pots = result.rows.map(pot => {
      const remaining = Number(pot.target_amount) - Number(pot.current_amount);
      const months = pot.months_remaining || 12;
      return {
        ...pot,
        required_monthly: remaining > 0 ? Math.ceil(remaining / months) : 0,
      };
    });
    
    res.json(pots);
  } catch (error) {
    console.error('Get savings pots error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get single savings pot
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<SavingsPot>(
      `SELECT *,
        CASE WHEN target_amount > 0 THEN 
          ROUND((current_amount / target_amount * 100)::numeric, 1)
        ELSE 0 END as progress_percent
       FROM savings_pots 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get savings pot error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Create savings pot
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = savingsPotSchema.parse(req.body);
    
    const result = await query<SavingsPot>(
      `INSERT INTO savings_pots 
       (id, user_id, name, target_amount, current_amount, monthly_contribution, target_date, icon, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        uuidv4(),
        req.user!.id,
        data.name,
        data.target_amount,
        data.current_amount,
        data.monthly_contribution,
        data.target_date || null,
        data.icon,
        data.color,
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create savings pot error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update savings pot
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = savingsPotSchema.partial().parse(req.body);
    
    const result = await query<SavingsPot>(
      `UPDATE savings_pots SET
        name = COALESCE($1, name),
        target_amount = COALESCE($2, target_amount),
        current_amount = COALESCE($3, current_amount),
        monthly_contribution = COALESCE($4, monthly_contribution),
        target_date = COALESCE($5, target_date),
        icon = COALESCE($6, icon),
        color = COALESCE($7, color),
        updated_at = NOW()
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [
        data.name,
        data.target_amount,
        data.current_amount,
        data.monthly_contribution,
        data.target_date,
        data.icon,
        data.color,
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
    console.error('Update savings pot error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Add to pot (deposit)
router.post('/:id/deposit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = z.object({ amount: z.number().min(1) }).parse(req.body);
    
    const result = await query<SavingsPot>(
      `UPDATE savings_pots SET
        current_amount = current_amount + $1,
        is_completed = CASE WHEN current_amount + $1 >= target_amount THEN true ELSE false END,
        completed_at = CASE WHEN current_amount + $1 >= target_amount AND NOT is_completed THEN NOW() ELSE completed_at END,
        updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [amount, req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Deposit to pot error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Withdraw from pot (use the money)
router.post('/:id/withdraw', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = z.object({ amount: z.number().min(1) }).parse(req.body);
    
    // Check if enough balance
    const pot = await query<SavingsPot>(
      'SELECT current_amount FROM savings_pots WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    
    if (pot.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    if (Number(pot.rows[0].current_amount) < amount) {
      return res.status(400).json({ error: 'אין מספיק כסף בקופה' });
    }
    
    const result = await query<SavingsPot>(
      `UPDATE savings_pots SET
        current_amount = current_amount - $1,
        is_completed = false,
        updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [amount, req.params.id, req.user!.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Withdraw from pot error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete savings pot
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM savings_pots WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete savings pot error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get summary (for dashboard)
router.get('/stats/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT 
        COUNT(*) as total_pots,
        COUNT(*) FILTER (WHERE is_completed) as completed_pots,
        COALESCE(SUM(current_amount), 0) as total_saved,
        COALESCE(SUM(target_amount), 0) as total_target,
        COALESCE(SUM(monthly_contribution), 0) as total_monthly
       FROM savings_pots 
       WHERE user_id = $1`,
      [req.user!.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get pots summary error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
