import { Request } from 'express';

export type UserRole = 'admin' | 'editor' | 'viewer';
export type TransactionType = 'deposit' | 'withdrawal' | 'interest' | 'adjustment';
export type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type NotificationTargetType = 'phone' | 'group';
export type AlertType = 'target_reached' | 'milestone' | 'reminder' | 'weekly_summary' | 'monthly_summary';

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  google_id?: string;
  avatar?: string;
  must_change_password: boolean;
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Fund {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  target_amount: number;
  target_date?: Date;
  currency: string;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  current_balance?: number;
  progress_percent?: number;
}

export interface Transaction {
  id: string;
  fund_id: string;
  amount: number;
  type: TransactionType;
  description?: string;
  transaction_date: Date;
  created_by: string;
  created_at: Date;
  fund_name?: string;
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
  next_run: Date;
  last_run?: Date;
  created_by: string;
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
  updated_at: Date;
}

export interface Alert {
  id: string;
  fund_id?: string;
  type: AlertType;
  threshold_percent?: number;
  message?: string;
  is_triggered: boolean;
  triggered_at?: Date;
  created_at: Date;
}

export interface WhatsAppGroup {
  JID: string;
  Name: string;
  ParticipantCount: number;
}

export interface AuthRequest extends Request {
  user?: User;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
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
  currentBalance: number;
  targetAmount: number;
  progressPercent: number;
  currency: string;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }[];
}
