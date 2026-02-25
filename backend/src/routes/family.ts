import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AuthRequest, FamilySettings, FamilyMember } from '../types/index';

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const familySettingsSchema = z.object({
  family_name: z.string().min(1).optional(),
  default_currency: z.string().length(3).default('ILS'),
  inflation_rate: z.number().min(0).max(20).default(2.5),
});

const familyMemberSchema = z.object({
  member_type: z.enum(['self', 'spouse', 'child', 'planned_child']),
  name: z.string().min(1, 'שם נדרש'),
  gender: z.enum(['male', 'female']).optional(),
  birth_date: z.string().optional(),
  expected_birth_date: z.string().optional(),
  notes: z.string().optional(),
});

const incomeSchema = z.object({
  amount: z.number().min(0, 'סכום חייב להיות חיובי'),
  effective_date: z.string(),
  description: z.string().optional(),
});

// ============================================
// FAMILY SETTINGS
// ============================================

// Get family settings
router.get('/settings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<FamilySettings>(
      'SELECT * FROM family_settings WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (result.rows.length === 0) {
      // Create default settings
      const newSettings = await query<FamilySettings>(
        `INSERT INTO family_settings (id, user_id, family_name, default_currency, inflation_rate)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [uuidv4(), req.user!.id, req.user!.name, 'ILS', 2.5]
      );
      return res.json(newSettings.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get family settings error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update family settings
router.put('/settings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = familySettingsSchema.parse(req.body);
    
    const result = await query<FamilySettings>(
      `INSERT INTO family_settings (id, user_id, family_name, default_currency, inflation_rate)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         family_name = EXCLUDED.family_name,
         default_currency = EXCLUDED.default_currency,
         inflation_rate = EXCLUDED.inflation_rate,
         updated_at = NOW()
       RETURNING *`,
      [uuidv4(), req.user!.id, data.family_name, data.default_currency, data.inflation_rate]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update family settings error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ============================================
// FAMILY MEMBERS
// ============================================

// Get all family members
router.get('/members', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<FamilyMember>(
      `SELECT fm.*,
        CASE 
          WHEN fm.birth_date IS NOT NULL THEN 
            EXTRACT(YEAR FROM AGE(NOW(), fm.birth_date))::INTEGER
          ELSE NULL
        END as age_years,
        CASE 
          WHEN fm.birth_date IS NOT NULL THEN 
            (EXTRACT(YEAR FROM AGE(NOW(), fm.birth_date)) * 12 + EXTRACT(MONTH FROM AGE(NOW(), fm.birth_date)))::INTEGER
          ELSE NULL
        END as age_months,
        COALESCE((
          SELECT ih.amount FROM income_history ih 
          WHERE ih.member_id = fm.id AND ih.effective_date <= CURRENT_DATE 
          ORDER BY ih.effective_date DESC LIMIT 1
        ), 0) as monthly_income
       FROM family_members fm
       WHERE fm.user_id = $1 AND fm.is_active = true
       ORDER BY 
         CASE fm.member_type 
           WHEN 'self' THEN 1 
           WHEN 'spouse' THEN 2 
           WHEN 'child' THEN 3 
           WHEN 'planned_child' THEN 4 
         END,
         fm.birth_date ASC NULLS LAST`,
      [req.user!.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get family members error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get single family member
router.get('/members/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<FamilyMember>(
      `SELECT *,
        CASE 
          WHEN birth_date IS NOT NULL THEN 
            EXTRACT(YEAR FROM AGE(NOW(), birth_date))::INTEGER
          ELSE NULL
        END as age_years,
        CASE 
          WHEN birth_date IS NOT NULL THEN 
            (EXTRACT(YEAR FROM AGE(NOW(), birth_date)) * 12 + EXTRACT(MONTH FROM AGE(NOW(), birth_date)))::INTEGER
          ELSE NULL
        END as age_months
       FROM family_members 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get family member error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Create family member
router.post('/members', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = familyMemberSchema.parse(req.body);
    
    // Validate: only one 'self' and one 'spouse'
    if (data.member_type === 'self' || data.member_type === 'spouse') {
      const existing = await query(
        'SELECT id FROM family_members WHERE user_id = $1 AND member_type = $2 AND is_active = true',
        [req.user!.id, data.member_type]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ 
          error: data.member_type === 'self' ? 'כבר קיים פרופיל אישי' : 'כבר קיים בן/בת זוג' 
        });
      }
    }
    
    const result = await query<FamilyMember>(
      `INSERT INTO family_members 
       (id, user_id, member_type, name, gender, birth_date, expected_birth_date, monthly_income, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        uuidv4(),
        req.user!.id,
        data.member_type,
        data.name,
        data.gender,
        data.birth_date || null,
        data.expected_birth_date || null,
        data.monthly_income,
        data.notes,
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create family member error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update family member
router.put('/members/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = familyMemberSchema.partial().parse(req.body);
    
    // Check ownership
    const existing = await query(
      'SELECT id, member_type FROM family_members WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    const result = await query<FamilyMember>(
      `UPDATE family_members SET
        name = COALESCE($1, name),
        gender = COALESCE($2, gender),
        birth_date = COALESCE($3, birth_date),
        expected_birth_date = COALESCE($4, expected_birth_date),
        monthly_income = COALESCE($5, monthly_income),
        notes = COALESCE($6, notes),
        updated_at = NOW()
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [
        data.name,
        data.gender,
        data.birth_date,
        data.expected_birth_date,
        data.monthly_income,
        data.notes,
        req.params.id,
        req.user!.id,
      ]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update family member error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete family member (soft delete)
router.delete('/members/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `UPDATE family_members SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete family member error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Convert planned child to actual child
router.post('/members/:id/born', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { birth_date, name } = req.body;
    
    const result = await query<FamilyMember>(
      `UPDATE family_members SET
        member_type = 'child',
        birth_date = $1,
        name = COALESCE($2, name),
        expected_birth_date = NULL,
        updated_at = NOW()
       WHERE id = $3 AND user_id = $4 AND member_type = 'planned_child'
       RETURNING *`,
      [birth_date, name, req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא ילד מתוכנן' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Convert to born error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ============================================
// INCOME HISTORY
// ============================================

// Get income history for a member
router.get('/members/:id/income', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Verify member belongs to user
    const member = await query(
      'SELECT id FROM family_members WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    
    if (member.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    const result = await query(
      `SELECT * FROM income_history 
       WHERE member_id = $1 
       ORDER BY effective_date DESC`,
      [req.params.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get income history error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Add income record
router.post('/members/:id/income', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = incomeSchema.parse(req.body);
    
    // Verify member belongs to user
    const member = await query(
      'SELECT id FROM family_members WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    
    if (member.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    const result = await query(
      `INSERT INTO income_history (id, member_id, amount, effective_date, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [uuidv4(), req.params.id, data.amount, data.effective_date, data.description]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Add income error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update income record
router.put('/income/:incomeId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = incomeSchema.partial().parse(req.body);
    
    // Verify ownership through member
    const existing = await query(
      `SELECT ih.id FROM income_history ih
       JOIN family_members fm ON ih.member_id = fm.id
       WHERE ih.id = $1 AND fm.user_id = $2`,
      [req.params.incomeId, req.user!.id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    const result = await query(
      `UPDATE income_history SET
        amount = COALESCE($1, amount),
        effective_date = COALESCE($2, effective_date),
        description = COALESCE($3, description)
       WHERE id = $4
       RETURNING *`,
      [data.amount, data.effective_date, data.description, req.params.incomeId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update income error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete income record
router.delete('/income/:incomeId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Verify ownership
    const result = await query(
      `DELETE FROM income_history ih
       USING family_members fm
       WHERE ih.id = $1 AND ih.member_id = fm.id AND fm.user_id = $2
       RETURNING ih.id`,
      [req.params.incomeId, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete income error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get family summary (for dashboard)
router.get('/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const members = await query<FamilyMember>(
      `SELECT fm.*,
        CASE 
          WHEN fm.birth_date IS NOT NULL THEN 
            EXTRACT(YEAR FROM AGE(NOW(), fm.birth_date))::INTEGER
          ELSE NULL
        END as age_years,
        COALESCE((
          SELECT ih.amount FROM income_history ih 
          WHERE ih.member_id = fm.id AND ih.effective_date <= CURRENT_DATE 
          ORDER BY ih.effective_date DESC LIMIT 1
        ), 0) as monthly_income
       FROM family_members fm
       WHERE fm.user_id = $1 AND fm.is_active = true`,
      [req.user!.id]
    );
    
    const self = members.rows.find(m => m.member_type === 'self');
    const spouse = members.rows.find(m => m.member_type === 'spouse');
    const children = members.rows.filter(m => m.member_type === 'child');
    const plannedChildren = members.rows.filter(m => m.member_type === 'planned_child');
    
    const totalIncome = members.rows.reduce((sum, m) => sum + Number(m.monthly_income || 0), 0);
    
    res.json({
      self,
      spouse,
      children,
      plannedChildren,
      totalMembers: members.rows.length,
      childrenCount: children.length,
      plannedChildrenCount: plannedChildren.length,
      totalMonthlyIncome: totalIncome,
    });
  } catch (error) {
    console.error('Get family summary error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
