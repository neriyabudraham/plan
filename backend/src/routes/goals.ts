import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AuthRequest, FinancialGoal } from '../types/index';

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const goalSchema = z.object({
  linked_member_id: z.string().uuid().optional(),
  linked_asset_id: z.string().uuid().optional(),
  name: z.string().min(1, 'שם נדרש'),
  goal_type: z.enum(['retirement', 'child_event', 'purchase', 'education', 'travel', 'emergency', 'custom']),
  target_amount: z.number().positive('סכום יעד חייב להיות חיובי'),
  current_amount: z.number().min(0).default(0),
  currency: z.string().length(3).default('ILS'),
  target_date: z.string().optional(),
  target_age: z.number().int().min(0).optional(),
  monthly_contribution: z.number().min(0).default(0),
  priority: z.number().int().min(1).max(10).default(5),
  icon: z.string().default('🎯'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#10B981'),
  notes: z.string().optional(),
});

// ============================================
// HELPERS
// ============================================

const calculateGoalMetrics = (goal: FinancialGoal): FinancialGoal => {
  const progressPercent = goal.target_amount > 0 
    ? Math.round((goal.current_amount / goal.target_amount) * 100) 
    : 0;
  
  let monthsRemaining: number | undefined;
  let requiredMonthly: number | undefined;
  
  if (goal.target_date) {
    const targetDate = new Date(goal.target_date);
    const now = new Date();
    monthsRemaining = Math.max(0, 
      (targetDate.getFullYear() - now.getFullYear()) * 12 + 
      (targetDate.getMonth() - now.getMonth())
    );
    
    if (monthsRemaining > 0) {
      const remaining = goal.target_amount - goal.current_amount;
      requiredMonthly = Math.max(0, Math.ceil(remaining / monthsRemaining));
    }
  }
  
  return {
    ...goal,
    progress_percent: progressPercent,
    months_remaining: monthsRemaining,
    required_monthly: requiredMonthly,
  };
};

// ============================================
// GOALS
// ============================================

// Get all goals
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { type, active_only, achieved } = req.query;
    
    let whereClause = 'WHERE g.user_id = $1';
    const params: any[] = [req.user!.id];
    let paramIndex = 2;
    
    if (type) {
      whereClause += ` AND g.goal_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    if (active_only !== 'false') {
      whereClause += ' AND g.is_active = true';
    }
    
    if (achieved === 'true') {
      whereClause += ' AND g.is_achieved = true';
    } else if (achieved === 'false') {
      whereClause += ' AND g.is_achieved = false';
    }
    
    const result = await query<FinancialGoal>(
      `SELECT g.*,
        m.name as linked_member_name,
        a.name as linked_asset_name
       FROM financial_goals g
       LEFT JOIN family_members m ON g.linked_member_id = m.id
       LEFT JOIN assets a ON g.linked_asset_id = a.id
       ${whereClause}
       ORDER BY g.priority ASC, g.target_date ASC NULLS LAST`,
      params
    );
    
    const goalsWithMetrics = result.rows.map(calculateGoalMetrics);
    
    res.json(goalsWithMetrics);
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get single goal
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<FinancialGoal>(
      `SELECT g.*,
        m.name as linked_member_name,
        a.name as linked_asset_name
       FROM financial_goals g
       LEFT JOIN family_members m ON g.linked_member_id = m.id
       LEFT JOIN assets a ON g.linked_asset_id = a.id
       WHERE g.id = $1 AND g.user_id = $2`,
      [req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    const goalWithMetrics = calculateGoalMetrics(result.rows[0]);
    
    // Get milestones
    const milestones = await query(
      `SELECT * FROM milestones 
       WHERE goal_id = $1 
       ORDER BY target_amount ASC`,
      [req.params.id]
    );
    
    res.json({
      ...goalWithMetrics,
      milestones: milestones.rows,
    });
  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Create goal
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = goalSchema.parse(req.body);
    
    const result = await query<FinancialGoal>(
      `INSERT INTO financial_goals 
       (id, user_id, linked_member_id, linked_asset_id, name, goal_type, target_amount, 
        current_amount, currency, target_date, target_age, monthly_contribution, priority, icon, color, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        uuidv4(),
        req.user!.id,
        data.linked_member_id || null,
        data.linked_asset_id || null,
        data.name,
        data.goal_type,
        data.target_amount,
        data.current_amount,
        data.currency,
        data.target_date || null,
        data.target_age || null,
        data.monthly_contribution,
        data.priority,
        data.icon,
        data.color,
        data.notes || null,
      ]
    );
    
    const goalWithMetrics = calculateGoalMetrics(result.rows[0]);
    
    res.status(201).json(goalWithMetrics);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create goal error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update goal
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = goalSchema.partial().parse(req.body);
    
    const result = await query<FinancialGoal>(
      `UPDATE financial_goals SET
        linked_member_id = COALESCE($1, linked_member_id),
        linked_asset_id = COALESCE($2, linked_asset_id),
        name = COALESCE($3, name),
        goal_type = COALESCE($4, goal_type),
        target_amount = COALESCE($5, target_amount),
        current_amount = COALESCE($6, current_amount),
        currency = COALESCE($7, currency),
        target_date = COALESCE($8, target_date),
        target_age = COALESCE($9, target_age),
        monthly_contribution = COALESCE($10, monthly_contribution),
        priority = COALESCE($11, priority),
        icon = COALESCE($12, icon),
        color = COALESCE($13, color),
        notes = COALESCE($14, notes),
        updated_at = NOW()
       WHERE id = $15 AND user_id = $16
       RETURNING *`,
      [
        data.linked_member_id,
        data.linked_asset_id,
        data.name,
        data.goal_type,
        data.target_amount,
        data.current_amount,
        data.currency,
        data.target_date,
        data.target_age,
        data.monthly_contribution,
        data.priority,
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
    
    const goalWithMetrics = calculateGoalMetrics(result.rows[0]);
    
    res.json(goalWithMetrics);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update goal error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update goal current amount (quick update)
router.patch('/:id/amount', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { current_amount } = req.body;
    
    if (typeof current_amount !== 'number' || current_amount < 0) {
      return res.status(400).json({ error: 'סכום לא תקין' });
    }
    
    const result = await query<FinancialGoal>(
      `UPDATE financial_goals SET
        current_amount = $1,
        updated_at = NOW(),
        is_achieved = CASE WHEN $1 >= target_amount THEN true ELSE is_achieved END,
        achieved_at = CASE WHEN $1 >= target_amount AND is_achieved = false THEN NOW() ELSE achieved_at END
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [current_amount, req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json(calculateGoalMetrics(result.rows[0]));
  } catch (error) {
    console.error('Update goal amount error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Mark goal as achieved
router.post('/:id/achieve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<FinancialGoal>(
      `UPDATE financial_goals SET
        is_achieved = true,
        achieved_at = NOW(),
        current_amount = target_amount,
        updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json(calculateGoalMetrics(result.rows[0]));
  } catch (error) {
    console.error('Achieve goal error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete goal (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `UPDATE financial_goals SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ============================================
// MILESTONES
// ============================================

// Add milestone to goal
router.post('/:id/milestones', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, target_amount, target_date } = req.body;
    
    // Verify goal ownership
    const goal = await query(
      'SELECT id FROM financial_goals WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    
    if (goal.rows.length === 0) {
      return res.status(404).json({ error: 'יעד לא נמצא' });
    }
    
    const result = await query(
      `INSERT INTO milestones (id, user_id, goal_id, name, target_amount, target_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [uuidv4(), req.user!.id, req.params.id, name, target_amount, target_date || null]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create milestone error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete milestone
router.delete('/:goalId/milestones/:milestoneId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `DELETE FROM milestones 
       WHERE id = $1 AND goal_id = $2 AND user_id = $3
       RETURNING id`,
      [req.params.milestoneId, req.params.goalId, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete milestone error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ============================================
// SUMMARY
// ============================================

// Get goals summary
router.get('/summary/all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const goals = await query<FinancialGoal>(
      `SELECT * FROM financial_goals 
       WHERE user_id = $1 AND is_active = true`,
      [req.user!.id]
    );
    
    const goalsWithMetrics = goals.rows.map(calculateGoalMetrics);
    
    const totalTarget = goalsWithMetrics.reduce((sum, g) => sum + Number(g.target_amount), 0);
    const totalCurrent = goalsWithMetrics.reduce((sum, g) => sum + Number(g.current_amount), 0);
    const totalMonthly = goalsWithMetrics.reduce((sum, g) => sum + Number(g.monthly_contribution), 0);
    const achievedCount = goalsWithMetrics.filter(g => g.is_achieved).length;
    
    const byType = goalsWithMetrics.reduce((acc, g) => {
      if (!acc[g.goal_type]) {
        acc[g.goal_type] = { count: 0, target: 0, current: 0 };
      }
      acc[g.goal_type].count++;
      acc[g.goal_type].target += Number(g.target_amount);
      acc[g.goal_type].current += Number(g.current_amount);
      return acc;
    }, {} as Record<string, { count: number; target: number; current: number }>);
    
    res.json({
      total_goals: goalsWithMetrics.length,
      achieved_count: achievedCount,
      total_target: totalTarget,
      total_current: totalCurrent,
      overall_progress: totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0,
      total_monthly_contribution: totalMonthly,
      by_type: byType,
      goals: goalsWithMetrics,
    });
  } catch (error) {
    console.error('Get goals summary error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
