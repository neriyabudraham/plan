import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool';
import { authenticate, requireAdmin } from '../middleware/auth';
import { AuthRequest, WhatsAppSettings } from '../types/index';
import { fetchWhatsAppGroups, sendWhatsAppMessage } from '../services/whatsapp';
import { formatPhoneNumber, isValidPhoneNumber } from '../utils/phoneFormatter';

const router = Router();

const settingsSchema = z.object({
  api_key: z.string().min(1, 'API Key נדרש'),
  session: z.string().min(1, 'Session נדרש'),
  notification_target: z.string().min(1, 'יעד התראות נדרש'),
  notification_type: z.enum(['phone', 'group']),
  is_active: z.boolean().default(true),
  notify_on_deposit: z.boolean().default(true),
  notify_on_withdrawal: z.boolean().default(true),
  notify_on_target_reached: z.boolean().default(true),
  notify_on_milestone: z.boolean().default(true),
  notify_weekly_summary: z.boolean().default(false),
  notify_monthly_summary: z.boolean().default(true),
});

// Get WhatsApp settings
router.get('/settings', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query<WhatsAppSettings>(
      'SELECT * FROM whatsapp_settings ORDER BY created_at DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      return res.json(null);
    }
    
    // Mask API key for security
    const settings = result.rows[0];
    res.json({
      ...settings,
      api_key: settings.api_key.substring(0, 4) + '****' + settings.api_key.substring(settings.api_key.length - 4),
    });
  } catch (error) {
    console.error('Get WhatsApp settings error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Save WhatsApp settings
router.post('/settings', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const data = settingsSchema.parse(req.body);
    
    // Format phone number if type is phone
    let notificationTarget = data.notification_target;
    if (data.notification_type === 'phone') {
      if (!isValidPhoneNumber(data.notification_target)) {
        return res.status(400).json({ error: 'מספר טלפון לא תקין' });
      }
      notificationTarget = formatPhoneNumber(data.notification_target);
    }
    
    // Delete old settings
    await query('DELETE FROM whatsapp_settings');
    
    // Insert new settings
    const result = await query<WhatsAppSettings>(`
      INSERT INTO whatsapp_settings (
        id, api_key, session, notification_target, notification_type,
        is_active, notify_on_deposit, notify_on_withdrawal,
        notify_on_target_reached, notify_on_milestone,
        notify_weekly_summary, notify_monthly_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      uuidv4(),
      data.api_key,
      data.session,
      notificationTarget,
      data.notification_type,
      data.is_active,
      data.notify_on_deposit,
      data.notify_on_withdrawal,
      data.notify_on_target_reached,
      data.notify_on_milestone,
      data.notify_weekly_summary,
      data.notify_monthly_summary,
    ]);
    
    res.json({
      ...result.rows[0],
      api_key: data.api_key.substring(0, 4) + '****' + data.api_key.substring(data.api_key.length - 4),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Save WhatsApp settings error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get WhatsApp groups
router.get('/groups', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { api_key, session } = req.query;
    
    if (!api_key || !session) {
      return res.status(400).json({ error: 'API Key ו-Session נדרשים' });
    }
    
    const groups = await fetchWhatsAppGroups(api_key as string, session as string);
    res.json(groups);
  } catch (error) {
    console.error('Get WhatsApp groups error:', error);
    res.status(500).json({ error: 'שגיאה בקבלת רשימת קבוצות' });
  }
});

// Test WhatsApp notification
router.post('/test', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { api_key, session, notification_target, notification_type } = req.body;
    
    if (!api_key || !session || !notification_target) {
      return res.status(400).json({ error: 'כל השדות נדרשים' });
    }
    
    let target = notification_target;
    if (notification_type === 'phone') {
      if (!isValidPhoneNumber(notification_target)) {
        return res.status(400).json({ error: 'מספר טלפון לא תקין' });
      }
      target = formatPhoneNumber(notification_target);
    }
    
    const testSettings: WhatsAppSettings = {
      id: '',
      api_key,
      session,
      notification_target: target,
      notification_type,
      is_active: true,
      notify_on_deposit: true,
      notify_on_withdrawal: true,
      notify_on_target_reached: true,
      notify_on_milestone: true,
      notify_weekly_summary: false,
      notify_monthly_summary: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    const success = await sendWhatsAppMessage(
      '🔔 *בדיקת התראות PlanIt*\n\nהתראות WhatsApp מוגדרות ועובדות! ✅',
      testSettings
    );
    
    if (success) {
      res.json({ message: 'הודעת בדיקה נשלחה בהצלחה' });
    } else {
      res.status(500).json({ error: 'שליחת ההודעה נכשלה' });
    }
  } catch (error) {
    console.error('Test WhatsApp error:', error);
    res.status(500).json({ error: 'שגיאה בשליחת הודעת בדיקה' });
  }
});

export default router;
