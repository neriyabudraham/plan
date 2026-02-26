import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AuthRequest, UserRole } from '../types/index';
import { sendInviteEmail } from '../services/email';

const router = Router();

interface FamilyShare {
  id: string;
  owner_id: string;
  shared_with_id: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  shared_user_name?: string;
  shared_user_email?: string;
}

interface ShareInvite {
  id: string;
  email: string;
  role: UserRole;
  token: string;
  expires_at: Date;
  used: boolean;
  invited_by: string;
  created_at: Date;
}

// Get users who share family with me (I'm the owner)
router.get('/shared-users', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<FamilyShare & { shared_user_name: string; shared_user_email: string }>(
      `SELECT fs.*, u.name as shared_user_name, u.email as shared_user_email
       FROM family_shares fs
       JOIN users u ON fs.shared_with_id = u.id
       WHERE fs.owner_id = $1 AND fs.is_active = true
       ORDER BY fs.created_at DESC`,
      [req.user!.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get shared users error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get families I have access to (I'm the shared user)
router.get('/shared-with-me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT fs.*, u.name as owner_name, u.email as owner_email,
        fset.family_name
       FROM family_shares fs
       JOIN users u ON fs.owner_id = u.id
       LEFT JOIN family_settings fset ON fset.user_id = fs.owner_id
       WHERE fs.shared_with_id = $1 AND fs.is_active = true
       ORDER BY fs.created_at DESC`,
      [req.user!.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get shared with me error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Invite someone to share family
router.post('/invite', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { email, role } = z.object({
      email: z.string().email('אימייל לא תקין'),
      role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
    }).parse(req.body);
    
    // Check if user already exists
    const existingUser = await query(
      'SELECT id, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (existingUser.rows.length > 0) {
      // User exists - check if already shared
      const existingShare = await query(
        'SELECT id FROM family_shares WHERE owner_id = $1 AND shared_with_id = $2',
        [req.user!.id, existingUser.rows[0].id]
      );
      
      if (existingShare.rows.length > 0) {
        return res.status(400).json({ error: 'המשתמש כבר משותף' });
      }
      
      // Create share directly
      await query(
        `INSERT INTO family_shares (id, owner_id, shared_with_id, role)
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), req.user!.id, existingUser.rows[0].id, role]
      );
      
      return res.json({ message: 'המשתמש נוסף לשיתוף', immediate: true });
    }
    
    // User doesn't exist - create invitation
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Check if invitation already exists
    const existingInvite = await query<ShareInvite>(
      'SELECT id, used FROM invitation_tokens WHERE email = $1 AND invited_by = $2 AND used = false AND expires_at > NOW()',
      [email.toLowerCase(), req.user!.id]
    );
    
    if (existingInvite.rows.length > 0) {
      return res.status(400).json({ error: 'כבר נשלחה הזמנה למייל זה' });
    }
    
    await query(
      `INSERT INTO invitation_tokens (id, email, role, token, expires_at, invited_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), email.toLowerCase(), role, token, expiresAt, req.user!.id]
    );
    
    // Send email
    try {
      await sendInviteEmail(email, req.user!.name, token);
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError);
    }
    
    res.json({ message: 'הזמנה נשלחה', token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Invite error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Accept invitation (called after registration with invite token)
router.post('/accept-invite', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = z.object({
      token: z.string(),
    }).parse(req.body);
    
    const invite = await query<ShareInvite>(
      `SELECT * FROM invitation_tokens 
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );
    
    if (invite.rows.length === 0) {
      return res.status(400).json({ error: 'הזמנה לא תקינה או פגה תוקף' });
    }
    
    const inviteData = invite.rows[0];
    
    // Create family share
    await query(
      `INSERT INTO family_shares (id, owner_id, shared_with_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (owner_id, shared_with_id) DO NOTHING`,
      [uuidv4(), inviteData.invited_by, req.user!.id, inviteData.role]
    );
    
    // Mark invitation as used
    await query(
      'UPDATE invitation_tokens SET used = true WHERE id = $1',
      [inviteData.id]
    );
    
    res.json({ message: 'הצטרפת למשפחה בהצלחה' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update share role
router.put('/share/:shareId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = z.object({
      role: z.enum(['admin', 'editor', 'viewer']),
    }).parse(req.body);
    
    const result = await query<FamilyShare>(
      `UPDATE family_shares SET role = $1
       WHERE id = $2 AND owner_id = $3
       RETURNING *`,
      [role, req.params.shareId, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update share error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Remove share
router.delete('/share/:shareId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `DELETE FROM family_shares 
       WHERE id = $1 AND (owner_id = $2 OR shared_with_id = $2)
       RETURNING id`,
      [req.params.shareId, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json({ message: 'השיתוף הוסר' });
  } catch (error) {
    console.error('Remove share error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get pending invitations
router.get('/pending-invites', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<ShareInvite>(
      `SELECT * FROM invitation_tokens 
       WHERE invited_by = $1 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [req.user!.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get pending invites error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Cancel invitation
router.delete('/invite/:inviteId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `DELETE FROM invitation_tokens 
       WHERE id = $1 AND invited_by = $2
       RETURNING id`,
      [req.params.inviteId, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json({ message: 'ההזמנה בוטלה' });
  } catch (error) {
    console.error('Cancel invite error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
