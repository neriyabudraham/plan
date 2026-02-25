export type UserRole = 'admin' | 'editor' | 'viewer';
export type TransactionType = 'deposit' | 'withdrawal' | 'interest' | 'adjustment';
export type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type NotificationTargetType = 'phone' | 'group';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  mustChangePassword?: boolean;
}

export interface Fund {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  target_amount: number;
  target_date?: string;
  currency: string;
  is_active: boolean;
  current_balance: number;
  progress_percent: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  fund_id: string;
  amount: number;
  type: TransactionType;
  description?: string;
  transaction_date: string;
  created_at: string;
  fund_name?: string;
  fund_icon?: string;
  fund_color?: string;
  fund_currency?: string;
  user_name?: string;
}

export interface RecurringDeposit {
  id: string;
  fund_id: string;
  amount: number;
  frequency: FrequencyType;
  day_of_month?: number;
  day_of_week?: number;
  is_active: boolean;
  next_run: string;
  fund_name?: string;
  fund_icon?: string;
  fund_color?: string;
}

export interface WhatsAppSettings {
  id: string;
  api_key: string;
  session: string;
  notification_target: string;
  notification_type: NotificationTargetType;
  is_active: boolean;
  notify_on_deposit: boolean;
  notify_on_withdrawal: boolean;
  notify_on_target_reached: boolean;
  notify_on_milestone: boolean;
  notify_weekly_summary: boolean;
  notify_monthly_summary: boolean;
}

export interface WhatsAppGroup {
  JID: string;
  Name: string;
  ParticipantCount: number;
}

export interface DashboardStats {
  totalBalance: number;
  totalFunds: number;
  monthlyDeposits: number;
  monthlyWithdrawals: number;
  fundsProgress: FundProgress[];
}

export interface FundProgress {
  id: string;
  name: string;
  icon: string;
  color: string;
  currency: string;
  currentBalance: number;
  targetAmount: number;
  progressPercent: number;
}

export interface HistoryPoint {
  date: string;
  balance: number;
}

export interface DistributionItem {
  name: string;
  icon: string;
  color: string;
  currency: string;
  balance: number;
}
