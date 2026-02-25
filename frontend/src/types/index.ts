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

// ============================================
// USER
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  must_change_password?: boolean;
  is_active?: boolean;
  last_login?: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  mustChangePassword?: boolean;
}

// Legacy types for backward compatibility
export interface Fund {
  id: string;
  name: string;
  description?: string;
  target_amount: number;
  current_balance: number;
  currency: string;
  icon: string;
  color: string;
  is_active: boolean;
  created_at: string;
  target_date?: string;
  progress_percent?: number;
}

export interface Transaction {
  id: string;
  fund_id: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'interest' | 'fee';
  description?: string;
  transaction_date: string;
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
  next_run: string;
  fund_name?: string;
  fund_icon?: string;
  fund_color?: string;
}

export interface HistoryPoint {
  date: string;
  balance: number;
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
}

export interface FamilyMember {
  id: string;
  user_id: string;
  member_type: FamilyMemberType;
  name: string;
  gender?: GenderType;
  birth_date?: string;
  expected_birth_date?: string;
  monthly_income?: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
  age_years?: number;
  age_months?: number;
}

export interface IncomeRecord {
  id: string;
  member_id: string;
  amount: number;
  effective_date: string;
  description?: string;
  created_at: string;
}

export interface FamilySummary {
  self?: FamilyMember;
  spouse?: FamilyMember;
  children: FamilyMember[];
  plannedChildren: FamilyMember[];
  totalMembers: number;
  childrenCount: number;
  plannedChildrenCount: number;
  totalMonthlyIncome: number;
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
  created_at: string;
  items?: ChildExpenseItem[];
  items_count?: number;
  estimated_total?: number;
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
  created_at: string;
  owner_name?: string;
  linked_child_name?: string;
  recent_transactions?: AssetTransaction[];
}

export interface AssetTransaction {
  id: string;
  asset_id: string;
  amount: number;
  type: TransactionType;
  description?: string;
  transaction_date: string;
  balance_after?: number;
  created_at: string;
  asset_name?: string;
  asset_icon?: string;
  asset_color?: string;
}

export interface AssetsSummary {
  by_type: {
    asset_type: AssetType;
    count: number;
    total_balance: number;
    total_monthly_deposits: number;
    avg_return: number;
  }[];
  totals: {
    total: number;
    monthly_deposits: number;
  };
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
  target_date?: string;
  target_age?: number;
  monthly_contribution: number;
  priority: number;
  icon: string;
  color: string;
  notes?: string;
  is_achieved: boolean;
  achieved_at?: string;
  is_active: boolean;
  created_at: string;
  progress_percent?: number;
  months_remaining?: number;
  required_monthly?: number;
  linked_member_name?: string;
  linked_asset_name?: string;
  milestones?: Milestone[];
}

export interface Milestone {
  id: string;
  goal_id: string;
  name: string;
  target_amount: number;
  target_date?: string;
  is_reached: boolean;
  reached_at?: string;
}

export interface GoalsSummary {
  total_goals: number;
  achieved_count: number;
  total_target: number;
  total_current: number;
  overall_progress: number;
  total_monthly_contribution: number;
  by_type: Record<string, { count: number; target: number; current: number }>;
  goals: FinancialGoal[];
}

// ============================================
// SIMULATION
// ============================================

export interface SimulationParams {
  start_date: string;
  end_date?: string;
  end_age?: number;
  target_member_id?: string;
  inflation_rate?: number;
  include_planned_children?: boolean;
  extra_monthly_deposit?: number;
  extra_deposits?: {
    date: string;
    amount: number;
    asset_id?: string;
    description?: string;
  }[];
  withdrawal_events?: {
    date: string;
    amount: number;
    asset_id?: string;
    description?: string;
  }[];
}

export interface SimulationResults {
  timeline: TimelinePoint[];
  summary: {
    final_balance: number;
    total_deposited: number;
    total_returns: number;
    total_fees: number;
    total_child_expenses: number;
    effective_return_rate: number;
  };
  goals_analysis: GoalAnalysis[];
}

export interface TimelinePoint {
  date: string;
  total_assets: number;
  total_deposits: number;
  total_withdrawals: number;
  total_returns: number;
  total_fees: number;
  total_child_expenses: number;
  monthly_income: number;
  assets_breakdown: Record<string, number>;
  events: string[];
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

export interface SimulationScenario {
  id: string;
  name: string;
  description?: string;
  params: SimulationParams;
  results?: SimulationResults;
  calculated_at?: string;
  is_favorite: boolean;
  created_at: string;
}

// ============================================
// HELPERS
// ============================================

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  savings: 'חיסכון',
  investment: 'תיק השקעות',
  pension: 'פנסיה',
  study_fund: 'קרן השתלמות',
  child_savings: 'חיסכון לילד',
  provident: 'קופת גמל',
  real_estate: 'נדל"ן',
  other: 'אחר',
};

export const ASSET_TYPE_ICONS: Record<AssetType, string> = {
  savings: '💰',
  investment: '📈',
  pension: '🏦',
  study_fund: '🎓',
  child_savings: '👶',
  provident: '📊',
  real_estate: '🏠',
  other: '💼',
};

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  retirement: 'פרישה',
  child_event: 'אירוע ילד',
  purchase: 'רכישה',
  education: 'לימודים',
  travel: 'טיול',
  emergency: 'קרן חירום',
  custom: 'מותאם אישית',
};

export const GOAL_TYPE_ICONS: Record<GoalType, string> = {
  retirement: '🏖️',
  child_event: '🎉',
  purchase: '🛒',
  education: '📚',
  travel: '✈️',
  emergency: '🚨',
  custom: '🎯',
};

export const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  once: 'חד פעמי',
  monthly: 'חודשי',
  quarterly: 'רבעוני',
  yearly: 'שנתי',
};

export const TRIGGER_TYPE_LABELS: Record<ExpenseTriggerType, string> = {
  age_months: 'גיל (חודשים)',
  age_years: 'גיל (שנים)',
  event: 'אירוע',
};

export const MEMBER_TYPE_LABELS: Record<FamilyMemberType, string> = {
  self: 'אני',
  spouse: 'בן/בת זוג',
  child: 'ילד/ה',
  planned_child: 'ילד/ה מתוכנן/ת',
};

export const GENDER_LABELS: Record<GenderType, string> = {
  male: 'זכר',
  female: 'נקבה',
};
