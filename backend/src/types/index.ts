import { Request } from 'express';

// ============================================
// ENUMS
// ============================================

export type UserRole = 'admin' | 'editor' | 'viewer';
export type GenderType = 'male' | 'female';
export type FamilyMemberType = 'self' | 'spouse' | 'child' | 'planned_child';
export type AssetType = 'savings' | 'investment' | 'pension' | 'study_fund' | 'child_savings' | 'provident' | 'real_estate' | 'other';
export type TransactionType = 'deposit' | 'withdrawal' | 'interest' | 'fee' | 'adjustment';
export type FrequencyType = 'once' | 'monthly' | 'quarterly' | 'yearly';
export type GoalType = 'retirement' | 'child_event' | 'purchase' | 'education' | 'travel' | 'emergency' | 'custom';
export type ExpenseTriggerType = 'age_months' | 'age_years' | 'event';
export type NotificationTargetType = 'phone' | 'group';

// ============================================
// USER
// ============================================

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

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: User;
}

// ============================================
// FAMILY
// ============================================

export interface FamilySettings {
  id: string;
  user_id: string;
  family_name?: string;
  default_currency: string;
  inflation_rate: number;
  created_at: Date;
  updated_at: Date;
}

export interface FamilyMember {
  id: string;
  user_id: string;
  member_type: FamilyMemberType;
  name: string;
  gender?: GenderType;
  birth_date?: Date;
  expected_birth_date?: Date;
  notes?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  
  // Computed
  age_years?: number;
  age_months?: number;
  monthly_income?: number; // From income_history
}

export interface IncomeRecord {
  id: string;
  member_id: string;
  amount: number;
  effective_date: Date;
  description?: string;
  created_at: Date;
}

// ============================================
// CHILD EXPENSE TEMPLATES
// ============================================

export interface ChildExpenseTemplate {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
  
  // Relations
  items?: ChildExpenseItem[];
}

export interface ChildExpenseItem {
  id: string;
  template_id: string;
  name: string;
  trigger_type: ExpenseTriggerType;
  trigger_value: number;
  trigger_value_end?: number;
  amount: number;
  frequency: FrequencyType;
  notes?: string;
  sort_order: number;
  created_at: Date;
}

export interface ChildExpenseAssignment {
  id: string;
  child_id: string;
  template_id: string;
  custom_adjustments: Record<string, any>;
  created_at: Date;
}

// ============================================
// ASSETS
// ============================================

export interface Asset {
  id: string;
  user_id: string;
  owner_id?: string;
  linked_child_id?: string;
  name: string;
  asset_type: AssetType;
  institution?: string;
  account_number?: string;
  current_balance: number;
  currency: string;
  expected_annual_return: number;
  management_fee_percent: number;
  management_fee_deposit_percent: number;
  monthly_deposit: number;
  employer_deposit: number;
  icon: string;
  color: string;
  notes?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  
  // Relations
  owner_name?: string;
  linked_child_name?: string;
}

export interface AssetTransaction {
  id: string;
  asset_id: string;
  amount: number;
  type: TransactionType;
  description?: string;
  transaction_date: Date;
  balance_after?: number;
  created_by?: string;
  created_at: Date;
  
  // Relations
  asset_name?: string;
  asset_icon?: string;
  asset_color?: string;
}

export interface RecurringTransaction {
  id: string;
  asset_id: string;
  amount: number;
  type: TransactionType;
  frequency: FrequencyType;
  day_of_month?: number;
  description?: string;
  is_active: boolean;
  next_run: Date;
  last_run?: Date;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// GOALS
// ============================================

export interface FinancialGoal {
  id: string;
  user_id: string;
  linked_member_id?: string;
  linked_asset_id?: string;
  name: string;
  goal_type: GoalType;
  target_amount: number;
  current_amount: number;
  currency: string;
  target_date?: Date;
  target_age?: number;
  monthly_contribution: number;
  priority: number;
  icon: string;
  color: string;
  notes?: string;
  is_achieved: boolean;
  achieved_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  
  // Computed
  progress_percent?: number;
  months_remaining?: number;
  required_monthly?: number;
  linked_member_name?: string;
  linked_asset_name?: string;
}

export interface Milestone {
  id: string;
  user_id: string;
  goal_id: string;
  name: string;
  target_amount: number;
  target_date?: Date;
  is_reached: boolean;
  reached_at?: Date;
  notified: boolean;
  created_at: Date;
}

// ============================================
// SIMULATION
// ============================================

export interface SimulationScenario {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  params: SimulationParams;
  results?: SimulationResults;
  calculated_at?: Date;
  is_favorite: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SimulationParams {
  start_date?: string;
  end_date?: string;
  end_age?: number;
  target_member_id?: string;
  inflation_rate?: number;
  include_planned_children?: boolean;
  extra_monthly_deposit?: number;
  planned_children?: PlannedChild[];
  extra_deposits?: ExtraDeposit[];
  withdrawal_events?: WithdrawalEvent[];
}

export interface PlannedChild {
  expected_date: string;
  gender: GenderType;
  template_id?: string;
}

export interface ExtraDeposit {
  date?: string;
  amount?: number;
  asset_id?: string;
  description?: string;
}

export interface WithdrawalEvent {
  date?: string;
  amount?: number;
  asset_id?: string;
  description?: string;
}

export interface SimulationResults {
  timeline: TimelinePoint[];
  summary: SimulationSummary;
  goals_analysis: GoalAnalysis[];
}

export interface TimelinePoint {
  date: string;
  total_assets: number;
  total_assets_real: number; // שווי ריאלי (מתואם לאינפלציה)
  total_deposits: number;
  total_withdrawals: number;
  total_returns: number;
  total_fees: number;
  total_child_expenses: number;
  monthly_income: number;
  monthly_income_real: number; // הכנסה ריאלית
  inflation_factor: number; // מקדם האינפלציה מתחילת הסימולציה
  assets_breakdown: Record<string, number>;
  events: string[];
}

export interface SimulationSummary {
  final_balance: number;
  final_balance_real: number; // יתרה סופית בערכים ריאליים (של היום)
  total_deposited: number;
  total_returns: number;
  total_returns_real: number; // תשואה ריאלית
  total_fees: number;
  total_child_expenses: number;
  effective_return_rate: number;
  effective_return_rate_real: number; // תשואה אפקטיבית ריאלית
  total_inflation_factor: number; // סה"כ אינפלציה על פני התקופה
}

export interface GoalAnalysis {
  goal_id: string;
  goal_name: string;
  target_amount: number;
  projected_amount: number;
  is_achievable: boolean;
  achievement_date?: string;
  shortfall?: number;
  required_extra_monthly?: number;
}

// ============================================
// WHATSAPP
// ============================================

export interface WhatsAppSettings {
  id: string;
  user_id?: string;
  api_key?: string;
  session?: string;
  notification_target?: string;
  notification_type?: NotificationTargetType;
  is_active: boolean;
  notify_on_milestone: boolean;
  notify_on_goal_reached?: boolean;
  notify_on_target_reached: boolean;
  notify_on_deposit: boolean;
  notify_on_withdrawal: boolean;
  notify_monthly_summary: boolean;
  notify_weekly_summary: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// DASHBOARD
// ============================================

export interface DashboardStats {
  totalBalance: number;
  totalFunds: number;
  monthlyDeposits: number;
  monthlyWithdrawals: number;
  fundsProgress: FundProgress[];
}

// ============================================
// API RESPONSES
// ============================================

export interface AuthResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
  mustChangePassword?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// LEGACY TYPES (backward compatibility)
// ============================================

export interface Fund {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  target_amount: number;
  current_balance: number;
  currency: string;
  target_date?: Date;
  icon: string;
  color: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  id: string;
  fund_id: string;
  amount: number;
  type: TransactionType;
  description?: string;
  transaction_date: Date;
  balance_after?: number;
  created_by?: string;
  created_at: Date;
  fund_name?: string;
  fund_icon?: string;
  fund_color?: string;
  fund_currency?: string;
}

export interface RecurringDeposit {
  id: string;
  fund_id: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  day_of_month?: number;
  day_of_week?: number;
  description?: string;
  is_active: boolean;
  next_run: Date;
  last_run?: Date;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  fund_name?: string;
  fund_icon?: string;
  fund_color?: string;
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

export interface WhatsAppGroup {
  JID: string;
  Name: string;
  ParticipantCount: number;
}
