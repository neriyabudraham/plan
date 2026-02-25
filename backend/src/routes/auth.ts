import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { config } from '../config/index';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AuthRequest, User, TokenPayload } from '../types/index';
import { generateToken } from '../utils/helpers';
import { sendPasswordResetEmail } from '../services/email';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('מייל לא תקין'),
  password: z.string().min(1, 'סיסמה נדרשת'),
});

const registerSchema = z.object({
  token: z.string(),
  name: z.string().min(2, 'שם חייב להכיל לפחות 2 תווים'),
  password: z.string().min(8, 'סיסמה חייבת להכיל לפחות 8 תווים'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'סיסמה חייבת להכיל לפחות 8 תווים'),
});

const generateTokens = (user: User) => {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: '15m',
  } as jwt.SignOptions);
  
  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: '7d',
  } as jwt.SignOptions);
  
  return { accessToken, refreshToken };
};

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    const result = await query<User>(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'מייל או סיסמה שגויים' });
    }
    
    const user = result.rows[0];
    
    if (!user.password) {
      return res.status(401).json({ error: 'נא להתחבר דרך Google' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'מייל או סיסמה שגויים' });
    }
    
    const tokens = generateTokens(user);
    
    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokens.refreshToken, expiresAt]
    );
    
    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      user: userWithoutPassword,
      ...tokens,
      mustChangePassword: user.must_change_password,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Google OAuth callback
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    
    // Verify Google token
    const googleResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
    );
    
    if (!googleResponse.ok) {
      return res.status(401).json({ error: 'טוקן Google לא תקין' });
    }
    
    const googleUser: any = await googleResponse.json();
    
    if (googleUser.aud !== config.google.clientId) {
      return res.status(401).json({ error: 'Client ID לא תואם' });
    }
    
    let user: User;
    
    // Check if user exists
    const existingUser = await query<User>(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [googleUser.sub, googleUser.email.toLowerCase()]
    );
    
    if (existingUser.rows.length > 0) {
      user = existingUser.rows[0];
      
      // Update google_id if needed
      if (!user.google_id) {
        await query(
          'UPDATE users SET google_id = $1, avatar = $2 WHERE id = $3',
          [googleUser.sub, googleUser.picture, user.id]
        );
      }
      
      if (!user.is_active) {
        return res.status(403).json({ error: 'החשבון אינו פעיל' });
      }
    } else {
      // Create new user (as viewer by default)
      const newUser = await query<User>(
        `INSERT INTO users (id, email, name, google_id, avatar, role)
         VALUES ($1, $2, $3, $4, $5, 'viewer')
         RETURNING *`,
        [
          uuidv4(),
          googleUser.email.toLowerCase(),
          googleUser.name,
          googleUser.sub,
          googleUser.picture,
        ]
      );
      user = newUser.rows[0];
    }
    
    const tokens = generateTokens(user);
    
    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokens.refreshToken, expiresAt]
    );
    
    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      user: userWithoutPassword,
      ...tokens,
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token נדרש' });
    }
    
    // Verify token
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as TokenPayload;
    
    // Check if token exists in DB
    const tokenResult = await query(
      `SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > NOW()`,
      [refreshToken, decoded.userId]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Refresh token לא תקין' });
    }
    
    // Get user
    const userResult = await query<User>(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'משתמש לא נמצא' });
    }
    
    const user = userResult.rows[0];
    const tokens = generateTokens(user);
    
    // Delete old refresh token
    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    
    // Save new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokens.refreshToken, expiresAt]
    );
    
    res.json(tokens);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Refresh token לא תקין' });
    }
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    
    res.json({ message: 'התנתקת בהצלחה' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const { password: _, ...userWithoutPassword } = req.user!;
  res.json(userWithoutPassword);
});

// Change password
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = req.user!;
    
    if (!user.password) {
      return res.status(400).json({ error: 'לא ניתן לשנות סיסמה למשתמש Google' });
    }
    
    // For first login with temp password
    if (!user.must_change_password) {
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ error: 'סיסמה נוכחית שגויה' });
      }
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await query(
      'UPDATE users SET password = $1, must_change_password = false, updated_at = NOW() WHERE id = $2',
      [hashedPassword, user.id]
    );
    
    res.json({ message: 'הסיסמה שונתה בהצלחה' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Change password error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'מייל נדרש' });
    }
    
    const userResult = await query<User>(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );
    
    // Always return success to prevent email enumeration
    if (userResult.rows.length === 0) {
      return res.json({ message: 'אם המייל קיים במערכת, נשלח אליו קישור לאיפוס' });
    }
    
    const user = userResult.rows[0];
    
    if (!user.password) {
      return res.json({ message: 'אם המייל קיים במערכת, נשלח אליו קישור לאיפוס' });
    }
    
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );
    
    await sendPasswordResetEmail(email, token);
    
    res.json({ message: 'אם המייל קיים במערכת, נשלח אליו קישור לאיפוס' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ error: 'טוקן וסיסמה נדרשים' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'סיסמה חייבת להכיל לפחות 8 תווים' });
    }
    
    const tokenResult = await query(
      `SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW() AND used = false`,
      [token]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'קישור לא תקין או פג תוקף' });
    }
    
    const resetToken = tokenResult.rows[0];
    const hashedPassword = await bcrypt.hash(password, 12);
    
    await query(
      'UPDATE users SET password = $1, must_change_password = false, updated_at = NOW() WHERE id = $2',
      [hashedPassword, resetToken.user_id]
    );
    
    await query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);
    
    res.json({ message: 'הסיסמה אופסה בהצלחה' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Accept invitation
router.post('/accept-invite', async (req, res) => {
  try {
    const { token, name, password } = registerSchema.parse(req.body);
    
    const inviteResult = await query(
      `SELECT * FROM invitation_tokens WHERE token = $1 AND expires_at > NOW() AND used = false`,
      [token]
    );
    
    if (inviteResult.rows.length === 0) {
      return res.status(400).json({ error: 'הזמנה לא תקפה או פגה תוקף' });
    }
    
    const invite = inviteResult.rows[0];
    
    // Check if email already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [invite.email.toLowerCase()]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'משתמש עם מייל זה כבר קיים' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const newUser = await query<User>(
      `INSERT INTO users (id, email, password, name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [uuidv4(), invite.email.toLowerCase(), hashedPassword, name, invite.role]
    );
    
    await query('UPDATE invitation_tokens SET used = true WHERE id = $1', [invite.id]);
    
    const user = newUser.rows[0];
    const tokens = generateTokens(user);
    
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      user: userWithoutPassword,
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
