import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export const sendEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<void> => {
  await transporter.sendMail({
    from: `"PlanIt" <${config.smtp.user}>`,
    to,
    subject,
    html,
  });
};

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string
): Promise<void> => {
  const resetUrl = `${config.app.url}/reset-password?token=${resetToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { 
          background: #3B82F6; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 8px; 
          display: inline-block;
          margin: 20px 0;
        }
        .footer { color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>איפוס סיסמה</h2>
        <p>קיבלנו בקשה לאיפוס הסיסמה שלך ב-PlanIt.</p>
        <p>לחץ על הכפתור למטה לאיפוס הסיסמה:</p>
        <a href="${resetUrl}" class="button">איפוס סיסמה</a>
        <p>הקישור תקף ל-24 שעות.</p>
        <p>אם לא ביקשת לאפס את הסיסמה, התעלם ממייל זה.</p>
        <div class="footer">
          <p>PlanIt - ניהול חסכונות והשקעות משפחתיות</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  await sendEmail(email, 'איפוס סיסמה - PlanIt', html);
};

export const sendInvitationEmail = async (
  email: string,
  inviteToken: string,
  inviterName: string
): Promise<void> => {
  const inviteUrl = `${config.app.url}/accept-invite?token=${inviteToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { 
          background: #3B82F6; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 8px; 
          display: inline-block;
          margin: 20px 0;
        }
        .footer { color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>הוזמנת להצטרף ל-PlanIt!</h2>
        <p>${inviterName} הזמין אותך להצטרף למערכת ניהול החסכונות המשפחתית.</p>
        <p>לחץ על הכפתור למטה להצטרפות:</p>
        <a href="${inviteUrl}" class="button">הצטרף עכשיו</a>
        <p>ההזמנה תקפה ל-7 ימים.</p>
        <div class="footer">
          <p>PlanIt - ניהול חסכונות והשקעות משפחתיות</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  await sendEmail(email, 'הזמנה להצטרף ל-PlanIt', html);
};

export const sendWelcomeEmail = async (
  email: string,
  name: string,
  tempPassword: string
): Promise<void> => {
  const loginUrl = `${config.app.url}/login`;
  
  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { 
          background: #3B82F6; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 8px; 
          display: inline-block;
          margin: 20px 0;
        }
        .password-box {
          background: #F3F4F6;
          padding: 15px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 18px;
          margin: 15px 0;
        }
        .footer { color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>ברוך הבא ל-PlanIt, ${name}!</h2>
        <p>החשבון שלך נוצר בהצלחה.</p>
        <p>הסיסמה הזמנית שלך:</p>
        <div class="password-box">${tempPassword}</div>
        <p><strong>חשוב:</strong> תתבקש להחליף את הסיסמה בכניסה הראשונה.</p>
        <a href="${loginUrl}" class="button">כניסה למערכת</a>
        <div class="footer">
          <p>PlanIt - ניהול חסכונות והשקעות משפחתיות</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  await sendEmail(email, 'ברוך הבא ל-PlanIt!', html);
};
