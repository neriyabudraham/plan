import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AuthRequest, ChildExpenseTemplate, ChildExpenseItem } from '../types/index';

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const templateSchema = z.object({
  name: z.string().min(1, 'שם נדרש'),
  description: z.string().optional(),
  is_default: z.boolean().default(false),
});

const expenseItemSchema = z.object({
  name: z.string().min(1, 'שם נדרש'),
  trigger_type: z.enum(['age_months', 'age_years', 'event']),
  trigger_value: z.number().int().min(0),
  trigger_value_end: z.number().int().min(0).optional(),
  amount: z.number().min(0),
  frequency: z.enum(['once', 'monthly', 'quarterly', 'yearly']).default('once'),
  notes: z.string().optional(),
  sort_order: z.number().int().default(0),
});

// ============================================
// TEMPLATES
// ============================================

// Get all templates
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<ChildExpenseTemplate>(
      `SELECT t.*, 
        (SELECT COUNT(*) FROM child_expense_items WHERE template_id = t.id) as items_count,
        (SELECT SUM(
          CASE 
            WHEN frequency = 'once' THEN amount
            WHEN frequency = 'monthly' THEN amount * COALESCE(trigger_value_end - trigger_value + 1, 1)
            WHEN frequency = 'yearly' THEN amount * COALESCE(trigger_value_end - trigger_value + 1, 1)
            ELSE amount
          END
        ) FROM child_expense_items WHERE template_id = t.id) as estimated_total
       FROM child_expense_templates t
       WHERE t.user_id = $1
       ORDER BY t.is_default DESC, t.created_at ASC`,
      [req.user!.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get single template with items
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const templateResult = await query<ChildExpenseTemplate>(
      'SELECT * FROM child_expense_templates WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    const itemsResult = await query<ChildExpenseItem>(
      'SELECT * FROM child_expense_items WHERE template_id = $1 ORDER BY sort_order ASC, trigger_value ASC',
      [req.params.id]
    );
    
    res.json({
      ...templateResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Create template
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = templateSchema.parse(req.body);
    
    // If setting as default, unset other defaults
    if (data.is_default) {
      await query(
        'UPDATE child_expense_templates SET is_default = false WHERE user_id = $1',
        [req.user!.id]
      );
    }
    
    const result = await query<ChildExpenseTemplate>(
      `INSERT INTO child_expense_templates (id, user_id, name, description, is_default)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [uuidv4(), req.user!.id, data.name, data.description, data.is_default]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create template error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update template
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = templateSchema.partial().parse(req.body);
    
    // If setting as default, unset other defaults
    if (data.is_default) {
      await query(
        'UPDATE child_expense_templates SET is_default = false WHERE user_id = $1 AND id != $2',
        [req.user!.id, req.params.id]
      );
    }
    
    const result = await query<ChildExpenseTemplate>(
      `UPDATE child_expense_templates SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        is_default = COALESCE($3, is_default),
        updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [data.name, data.description, data.is_default, req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update template error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete template
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM child_expense_templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Duplicate template
router.post('/:id/duplicate', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Get original template
    const templateResult = await client.query(
      'SELECT * FROM child_expense_templates WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    
    if (templateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    const original = templateResult.rows[0];
    const newId = uuidv4();
    
    // Create new template
    await client.query(
      `INSERT INTO child_expense_templates (id, user_id, name, description, is_default)
       VALUES ($1, $2, $3, $4, false)`,
      [newId, req.user!.id, `${original.name} (העתק)`, original.description]
    );
    
    // Copy items
    await client.query(
      `INSERT INTO child_expense_items (id, template_id, name, trigger_type, trigger_value, trigger_value_end, amount, frequency, notes, sort_order)
       SELECT uuid_generate_v4(), $1, name, trigger_type, trigger_value, trigger_value_end, amount, frequency, notes, sort_order
       FROM child_expense_items WHERE template_id = $2`,
      [newId, req.params.id]
    );
    
    await client.query('COMMIT');
    
    // Return new template with items
    const newTemplate = await query(
      'SELECT * FROM child_expense_templates WHERE id = $1',
      [newId]
    );
    
    const items = await query(
      'SELECT * FROM child_expense_items WHERE template_id = $1 ORDER BY sort_order ASC',
      [newId]
    );
    
    res.status(201).json({
      ...newTemplate.rows[0],
      items: items.rows,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Duplicate template error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  } finally {
    client.release();
  }
});

// ============================================
// EXPENSE ITEMS
// ============================================

// Add item to template
router.post('/:id/items', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = expenseItemSchema.parse(req.body);
    
    // Verify template ownership
    const template = await query(
      'SELECT id FROM child_expense_templates WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    
    if (template.rows.length === 0) {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }
    
    const result = await query<ChildExpenseItem>(
      `INSERT INTO child_expense_items 
       (id, template_id, name, trigger_type, trigger_value, trigger_value_end, amount, frequency, notes, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        uuidv4(),
        req.params.id,
        data.name,
        data.trigger_type,
        data.trigger_value,
        data.trigger_value_end,
        data.amount,
        data.frequency,
        data.notes,
        data.sort_order,
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create expense item error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update item
router.put('/:templateId/items/:itemId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = expenseItemSchema.partial().parse(req.body);
    
    // Verify template ownership
    const template = await query(
      'SELECT id FROM child_expense_templates WHERE id = $1 AND user_id = $2',
      [req.params.templateId, req.user!.id]
    );
    
    if (template.rows.length === 0) {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }
    
    const result = await query<ChildExpenseItem>(
      `UPDATE child_expense_items SET
        name = COALESCE($1, name),
        trigger_type = COALESCE($2, trigger_type),
        trigger_value = COALESCE($3, trigger_value),
        trigger_value_end = COALESCE($4, trigger_value_end),
        amount = COALESCE($5, amount),
        frequency = COALESCE($6, frequency),
        notes = COALESCE($7, notes),
        sort_order = COALESCE($8, sort_order)
       WHERE id = $9 AND template_id = $10
       RETURNING *`,
      [
        data.name,
        data.trigger_type,
        data.trigger_value,
        data.trigger_value_end,
        data.amount,
        data.frequency,
        data.notes,
        data.sort_order,
        req.params.itemId,
        req.params.templateId,
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'פריט לא נמצא' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update expense item error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete item
router.delete('/:templateId/items/:itemId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Verify template ownership
    const template = await query(
      'SELECT id FROM child_expense_templates WHERE id = $1 AND user_id = $2',
      [req.params.templateId, req.user!.id]
    );
    
    if (template.rows.length === 0) {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }
    
    const result = await query(
      'DELETE FROM child_expense_items WHERE id = $1 AND template_id = $2 RETURNING id',
      [req.params.itemId, req.params.templateId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'פריט לא נמצא' });
    }
    
    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete expense item error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Reorder items
router.post('/:id/items/reorder', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  
  try {
    const { items } = req.body; // Array of { id, sort_order }
    
    // Verify template ownership
    const template = await client.query(
      'SELECT id FROM child_expense_templates WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    
    if (template.rows.length === 0) {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }
    
    await client.query('BEGIN');
    
    for (const item of items) {
      await client.query(
        'UPDATE child_expense_items SET sort_order = $1 WHERE id = $2 AND template_id = $3',
        [item.sort_order, item.id, req.params.id]
      );
    }
    
    await client.query('COMMIT');
    
    res.json({ message: 'סדר עודכן בהצלחה' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reorder items error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  } finally {
    client.release();
  }
});

// ============================================
// CREATE DEFAULT TEMPLATE
// ============================================

router.post('/create-default', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  
  try {
    // Check if user already has a default template
    const existing = await client.query(
      'SELECT id FROM child_expense_templates WHERE user_id = $1 AND is_default = true',
      [req.user!.id]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'כבר קיימת תבנית ברירת מחדל' });
    }
    
    await client.query('BEGIN');
    
    const templateId = uuidv4();
    
    // Create default template
    await client.query(
      `INSERT INTO child_expense_templates (id, user_id, name, description, is_default)
       VALUES ($1, $2, 'תבנית סטנדרטית', 'תבנית ברירת מחדל לעלויות ילד', true)`,
      [templateId, req.user!.id]
    );
    
    // Insert default items
    const defaultItems = [
      { name: 'לידה וציוד ראשוני', trigger_type: 'age_months', trigger_value: 0, amount: 10000, frequency: 'once', sort_order: 1 },
      { name: 'הוצאות חודשיות (שנה ראשונה)', trigger_type: 'age_months', trigger_value: 1, trigger_value_end: 12, amount: 3000, frequency: 'monthly', sort_order: 2 },
      { name: 'מעון יום', trigger_type: 'age_years', trigger_value: 1, trigger_value_end: 3, amount: 3500, frequency: 'monthly', sort_order: 3 },
      { name: 'גן ילדים', trigger_type: 'age_years', trigger_value: 3, trigger_value_end: 6, amount: 1500, frequency: 'monthly', sort_order: 4 },
      { name: 'בית ספר יסודי', trigger_type: 'age_years', trigger_value: 6, trigger_value_end: 12, amount: 1000, frequency: 'monthly', sort_order: 5 },
      { name: 'בר/בת מצווה', trigger_type: 'event', trigger_value: 13, amount: 15000, frequency: 'once', sort_order: 6 },
      { name: 'תיכון', trigger_type: 'age_years', trigger_value: 13, trigger_value_end: 18, amount: 1200, frequency: 'monthly', sort_order: 7 },
      { name: 'טיול בגרות', trigger_type: 'event', trigger_value: 18, amount: 10000, frequency: 'once', sort_order: 8 },
      { name: 'צבא/שירות לאומי', trigger_type: 'age_years', trigger_value: 18, trigger_value_end: 21, amount: 500, frequency: 'monthly', sort_order: 9 },
      { name: 'תואר ראשון', trigger_type: 'age_years', trigger_value: 21, trigger_value_end: 24, amount: 3000, frequency: 'monthly', sort_order: 10 },
      { name: 'חתונה', trigger_type: 'event', trigger_value: 25, amount: 250000, frequency: 'once', sort_order: 11 },
    ];
    
    for (const item of defaultItems) {
      await client.query(
        `INSERT INTO child_expense_items 
         (id, template_id, name, trigger_type, trigger_value, trigger_value_end, amount, frequency, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          uuidv4(),
          templateId,
          item.name,
          item.trigger_type,
          item.trigger_value,
          item.trigger_value_end || null,
          item.amount,
          item.frequency,
          item.sort_order,
        ]
      );
    }
    
    await client.query('COMMIT');
    
    // Return created template with items
    const template = await query(
      'SELECT * FROM child_expense_templates WHERE id = $1',
      [templateId]
    );
    
    const items = await query(
      'SELECT * FROM child_expense_items WHERE template_id = $1 ORDER BY sort_order ASC',
      [templateId]
    );
    
    res.status(201).json({
      ...template.rows[0],
      items: items.rows,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create default template error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  } finally {
    client.release();
  }
});

export default router;
