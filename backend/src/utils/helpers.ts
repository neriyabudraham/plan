import crypto from 'crypto';

export const generateToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

export const formatCurrency = (amount: number, currency: string = 'ILS'): string => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const calculateProgress = (current: number, target: number): number => {
  if (target <= 0) return 0;
  const progress = (current / target) * 100;
  return Math.min(Math.round(progress * 100) / 100, 100);
};

export const getNextRunDate = (
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
  dayOfMonth?: number,
  dayOfWeek?: number
): Date => {
  const now = new Date();
  const next = new Date(now);
  
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
      
    case 'weekly':
      const currentDay = now.getDay();
      const targetDay = dayOfWeek ?? 0;
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      next.setDate(next.getDate() + daysUntil);
      break;
      
    case 'monthly':
      const targetDayOfMonth = dayOfMonth ?? 1;
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(targetDayOfMonth, getDaysInMonth(next)));
      break;
      
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  
  next.setHours(0, 0, 0, 0);
  return next;
};

const getDaysInMonth = (date: Date): number => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

export const getMilestones = (): number[] => {
  return [25, 50, 75, 90, 100];
};
