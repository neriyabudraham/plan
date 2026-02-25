export const formatCurrency = (amount: number, currency: string = 'ILS'): string => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('he-IL').format(num);
};

export const formatDate = (date: string | Date): string => {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
};

export const formatDateTime = (date: string | Date): string => {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

export const formatRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  
  return formatDate(date);
};

export const getTransactionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    deposit: 'הפקדה',
    withdrawal: 'משיכה',
    interest: 'ריבית',
    adjustment: 'התאמה',
  };
  return labels[type] || type;
};

export const getFrequencyLabel = (frequency: string): string => {
  const labels: Record<string, string> = {
    daily: 'יומי',
    weekly: 'שבועי',
    monthly: 'חודשי',
    yearly: 'שנתי',
  };
  return labels[frequency] || frequency;
};

export const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    admin: 'מנהל',
    editor: 'עורך',
    viewer: 'צופה',
  };
  return labels[role] || role;
};
