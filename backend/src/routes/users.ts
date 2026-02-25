import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate, requireAdmin } from '../middleware/auth';
import { AuthRequest, User, UserRole } from '../types/index';
import { generateToken } from '../utils/helpers';
import { sendInvitationEmail, sendWelcomeEmail } from '../services/email';

const router = Router();

const inviteSchema = z.object({
  email: z.string().email('מייל לא תקין'),
  role: z.enum(['admin', 'editor', 'viewer']),
  sendEmail: z.boolean().default(true),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  is_active: z.boolean().optional(),
});

const createUserSchema = z.object({
  email: z.string().email('מייל לא תקין'),
  name: z.string().min(2, 'שם חייב להכיל לפחות 2 תווים'),
  role: z.enum(['admin', 'editor', 'viewer']),
  sendWelcomeEmail: z.boolean().default(true),
});

// Get all users (admin only)
router.get('/', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query<User>(
      `SELECT id, email, name, role, avatar, is_active, last_login, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Create user directly (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { email, name, role, sendWelcomeEmail: shouldSendEmail } = createUserSchema.parse(req.body);
    
    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'משתמש עם מייל זה כבר קיים' });
    }
    
    // Generate temp password
    const tempPassword = generateToken(8);
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    
    const result = await query<User>(
      `INSERT INTO users (id, email, password, name, role, must_change_password)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, name, role, avatar, is_active, created_at`,
      [uuidv4(), email.toLowerCase(), hashedPassword, name, role]
    );
    
    if (shouldSendEmail) {
      await sendWelcomeEmail(email, name, tempPassword);
    }
    
    res.status(201).json({
      user: result.rows[0],
      tempPassword: shouldSendEmail ? undefined : tempPassword,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create user error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Invite user by email (admin only)
router.post('/invite', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { email, role, sendEmail } = inviteSchema.parse(req.body);
    
    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'משתמש עם מייל זה כבר קיים' });
    }
    
    // Check if pending invitation exists
    const pendingInvite = await query(
      `SELECT id FROM invitation_tokens WHERE email = $1 AND expires_at > NOW() AND used = false`,
      [email.toLowerCase()]
    );
    if (pendingInvite.rows.length > 0) {
      return res.status(400).json({ error: 'הזמנה ממתינה כבר קיימת למייל זה' });
    }
    
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await query(
      `INSERT INTO invitation_tokens (email, role, token, expires_at, invited_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [email.toLowerCase(), role, token, expiresAt, req.user!.id]
    );
    
    if (sendEmail) {
      await sendInvitationEmail(email, token, req.user!.name);
    }
    
    res.status(201).json({
      message: sendEmail ? 'ההזמנה נשלחה' : 'ההזמנה נוצרה',
      inviteLink: sendEmail ? undefined : `/accept-invite?token=${token}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Invite user error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get user by ID (admin only)
router.get('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<User>(
      `SELECT id, email, name, role, avatar, is_active, last_login, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update user (admin only)
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const updates = updateUserSchema.parse(req.body);
    const userId = req.params.id;
    
    // Prevent admin from demoting themselves
    if (userId === req.user!.id && updates.role && updates.role !== 'admin') {
      return res.status(400).json({ error: 'לא ניתן להוריד הרשאות לעצמך' });
    }
    
    // Prevent admin from deactivating themselves
    if (userId === req.user!.id && updates.is_active === false) {
      return res.status(400).json({ error: 'לא ניתן לכבות את החשבון שלך' });
    }
    
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.role !== undefined) {
      setClauses.push(`role = $${paramIndex++}`);
      values.push(updates.role);
    }
    if (updates.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }
    
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'אין שדות לעדכון' });
    }
    
    setClauses.push(`updated_at = NOW()`);
    values.push(userId);
    
    const result = await query<User>(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, name, role, avatar, is_active, created_at`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    
    // Prevent admin from deleting themselves
    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'לא ניתן למחוק את עצמך' });
    }
    
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }
    
    res.json({ message: 'משתמש נמחק' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update own profile
router.patch('/me/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatar } = req.body;
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (avatar) {
      updates.push(`avatar = $${paramIndex++}`);
      values.push(avatar);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'אין שדות לעדכון' });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(req.user!.id);
    
    const result = await query<User>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, name, role, avatar, is_active, created_at`,
      values
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
