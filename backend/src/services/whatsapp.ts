import { query } from '../db/pool.js';
import { WhatsAppSettings, WhatsAppGroup } from '../types/index.js';
import { config } from '../config/index.js';

export const getWhatsAppSettings = async (): Promise<WhatsAppSettings | null> => {
  const result = await query<WhatsAppSettings>(
    'SELECT * FROM whatsapp_settings WHERE is_active = true LIMIT 1'
  );
  return result.rows[0] || null;
};

export const sendWhatsAppMessage = async (
  text: string,
  settings?: WhatsAppSettings | null
): Promise<boolean> => {
  if (!settings) {
    settings = await getWhatsAppSettings();
  }
  
  if (!settings || !settings.is_active) {
    console.log('WhatsApp notifications disabled');
    return false;
  }
  
  try {
    const response = await fetch(`${config.whatsapp.apiUrl}/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': settings.api_key,
        'accept': 'application/json',
      },
      body: JSON.stringify({
        chatId: settings.notification_target,
        text,
        linkPreview: false,
        session: settings.session,
      }),
    });
    
    if (!response.ok) {
      console.error('WhatsApp API error:', await response.text());
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return false;
  }
};

export const fetchWhatsAppGroups = async (
  apiKey: string,
  session: string
): Promise<WhatsAppGroup[]> => {
  try {
    const response = await fetch(
      `${config.whatsapp.apiUrl}/${session}/groups`,
      {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch groups: ${response.statusText}`);
    }
    
    const groups: any[] = await response.json();
    
    return groups.map((g: any) => ({
      JID: g.JID,
      Name: g.Name,
      ParticipantCount: g.Participants?.length || 0,
    }));
  } catch (error) {
    console.error('Error fetching WhatsApp groups:', error);
    throw error;
  }
};

export const notifyDeposit = async (
  fundName: string,
  amount: number,
  userName: string,
  currency: string = 'ILS'
): Promise<void> => {
  const settings = await getWhatsAppSettings();
  if (!settings?.notify_on_deposit) return;
  
  const formattedAmount = new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
  }).format(amount);
  
  const message = `💰 *הפקדה חדשה*\n\n` +
    `קופה: ${fundName}\n` +
    `סכום: ${formattedAmount}\n` +
    `על ידי: ${userName}\n` +
    `תאריך: ${new Date().toLocaleDateString('he-IL')}`;
  
  await sendWhatsAppMessage(message, settings);
};

export const notifyWithdrawal = async (
  fundName: string,
  amount: number,
  userName: string,
  currency: string = 'ILS'
): Promise<void> => {
  const settings = await getWhatsAppSettings();
  if (!settings?.notify_on_withdrawal) return;
  
  const formattedAmount = new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
  }).format(amount);
  
  const message = `📤 *משיכה*\n\n` +
    `קופה: ${fundName}\n` +
    `סכום: ${formattedAmount}\n` +
    `על ידי: ${userName}\n` +
    `תאריך: ${new Date().toLocaleDateString('he-IL')}`;
  
  await sendWhatsAppMessage(message, settings);
};

export const notifyTargetReached = async (
  fundName: string,
  targetAmount: number,
  currency: string = 'ILS'
): Promise<void> => {
  const settings = await getWhatsAppSettings();
  if (!settings?.notify_on_target_reached) return;
  
  const formattedAmount = new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
  }).format(targetAmount);
  
  const message = `🎉 *הגעתם ליעד!*\n\n` +
    `קופה: ${fundName}\n` +
    `יעד: ${formattedAmount}\n\n` +
    `כל הכבוד! 🏆`;
  
  await sendWhatsAppMessage(message, settings);
};

export const notifyMilestone = async (
  fundName: string,
  percent: number,
  currentAmount: number,
  targetAmount: number,
  currency: string = 'ILS'
): Promise<void> => {
  const settings = await getWhatsAppSettings();
  if (!settings?.notify_on_milestone) return;
  
  const formatAmount = (n: number) => new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
  }).format(n);
  
  const message = `🚀 *אבן דרך!*\n\n` +
    `קופה: ${fundName}\n` +
    `הגעתם ל-${percent}% מהיעד!\n\n` +
    `נוכחי: ${formatAmount(currentAmount)}\n` +
    `יעד: ${formatAmount(targetAmount)}\n\n` +
    `ממשיכים! 💪`;
  
  await sendWhatsAppMessage(message, settings);
};
