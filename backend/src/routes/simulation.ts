import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AuthRequest, SimulationScenario, SimulationParams, SimulationResults, TimelinePoint, Asset, FamilyMember, ChildExpenseItem, FinancialGoal, IncomeRecord } from '../types/index';

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const simulationParamsSchema = z.object({
  start_date: z.string().default(() => new Date().toISOString().split('T')[0]),
  end_date: z.string().optional(),
  end_age: z.number().int().min(20).max(120).optional(),
  target_member_id: z.string().uuid().optional(),
  inflation_rate: z.number().min(0).max(20).optional(),
  include_planned_children: z.boolean().default(true),
  extra_monthly_deposit: z.number().min(0).default(0),
  yearly_expenses: z.array(z.object({
    name: z.string(),
    amount: z.number(),
    month: z.number().min(1).max(12).optional(),
    adjust_for_inflation: z.boolean().optional(),
  })).optional(),
  extra_deposits: z.array(z.object({
    date: z.string(),
    amount: z.number(),
    asset_id: z.string().uuid().optional(),
    description: z.string().optional(),
  })).default([]),
  withdrawal_events: z.array(z.object({
    date: z.string(),
    amount: z.number(),
    asset_id: z.string().uuid().optional(),
    description: z.string().optional(),
  })).default([]),
});

const scenarioSchema = z.object({
  name: z.string().min(1, 'שם נדרש'),
  description: z.string().optional(),
  params: simulationParamsSchema,
  is_favorite: z.boolean().default(false),
});

// ============================================
// SIMULATION ENGINE
// ============================================

interface SimulationContext {
  userId: string;
  params: SimulationParams;
  assets: Asset[];
  familyMembers: FamilyMember[];
  childExpenseItems: { child_id: string; items: ChildExpenseItem[] }[];
  goals: FinancialGoal[];
  inflationRate: number;
  incomeHistory: { member_id: string; records: IncomeRecord[] }[];
}

// Get income for a specific date
function getIncomeAtDate(incomeHistory: { member_id: string; records: IncomeRecord[] }[], targetDate: Date): number {
  let totalIncome = 0;
  
  for (const memberIncome of incomeHistory) {
    // Find the most recent income record before or on targetDate
    const relevantRecord = memberIncome.records
      .filter(r => new Date(r.effective_date) <= targetDate)
      .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())[0];
    
    if (relevantRecord) {
      totalIncome += Number(relevantRecord.amount);
    }
  }
  
  return totalIncome;
}

async function runSimulation(ctx: SimulationContext): Promise<SimulationResults> {
  const { params, assets, familyMembers, childExpenseItems, goals, inflationRate, incomeHistory } = ctx;
  
  const startDate = new Date(params.start_date || new Date());
  let endDate: Date;
  
  // For family simulation - find the "self" member to calculate retirement age
  const selfMember = familyMembers.find(m => m.member_type === 'self');
  const spouseMember = familyMembers.find(m => m.member_type === 'spouse');
  
  // Determine end date - family based (use the older member's retirement)
  if (params.end_date) {
    endDate = new Date(params.end_date);
  } else if (params.end_age) {
    // Use target member if specified, otherwise use self
    const targetMember = params.target_member_id 
      ? familyMembers.find(m => m.id === params.target_member_id)
      : selfMember;
    
    if (targetMember?.birth_date) {
      endDate = new Date(targetMember.birth_date);
      endDate.setFullYear(endDate.getFullYear() + params.end_age);
    } else {
      // Default: calculate from current date + years until retirement age
      endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + params.end_age - 30); // Assume starting at ~30
    }
  } else {
    endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 30);
  }
  
  // Make sure we have at least some simulation time
  if (endDate <= startDate) {
    endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 30);
  }
  
  const timeline: TimelinePoint[] = [];
  
  // Initialize tracking variables
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalReturns = 0;
  let totalFees = 0;
  let totalChildExpenses = 0;
  
  // Asset balances
  const assetBalances: Record<string, number> = {};
  for (const asset of assets) {
    assetBalances[asset.id] = Number(asset.current_balance);
  }
  
  // Monthly simulation
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const dateStr = currentDate.toISOString().split('T')[0];
    const events: string[] = [];
    
    // Calculate inflation factor
    const yearsFromStart = (currentDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const inflationFactor = Math.pow(1 + inflationRate / 100, yearsFromStart);
    
    // Process each asset
    for (const asset of assets) {
      const balance = assetBalances[asset.id];
      
      // Monthly deposit (adjusted for inflation)
      const monthlyDeposit = (Number(asset.monthly_deposit) + Number(asset.employer_deposit)) * inflationFactor;
      if (monthlyDeposit > 0) {
        assetBalances[asset.id] += monthlyDeposit;
        totalDeposits += monthlyDeposit;
      }
      
      // Extra monthly deposit (from params)
      if (params.extra_monthly_deposit && params.extra_monthly_deposit > 0) {
        const extraPerAsset = params.extra_monthly_deposit / assets.length;
        assetBalances[asset.id] += extraPerAsset;
        totalDeposits += extraPerAsset;
      }
      
      // Monthly returns (compound interest)
      const monthlyReturn = Number(asset.expected_annual_return) / 100 / 12;
      const returns = assetBalances[asset.id] * monthlyReturn;
      assetBalances[asset.id] += returns;
      totalReturns += returns;
      
      // Monthly management fees
      const monthlyFeePercent = Number(asset.management_fee_percent) / 100 / 12;
      const fees = assetBalances[asset.id] * monthlyFeePercent;
      assetBalances[asset.id] -= fees;
      totalFees += fees;
    }
    
    // Process child expenses
    for (const childData of childExpenseItems) {
      const child = familyMembers.find(m => m.id === childData.child_id);
      if (!child) continue;
      
      const birthDate = child.birth_date 
        ? new Date(child.birth_date) 
        : child.expected_birth_date 
          ? new Date(child.expected_birth_date) 
          : null;
      
      if (!birthDate || birthDate > currentDate) continue;
      
      const ageMonths = Math.floor((currentDate.getTime() - birthDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
      const ageYears = Math.floor(ageMonths / 12);
      
      for (const item of childData.items) {
        let shouldApply = false;
        
        switch (item.trigger_type) {
          case 'age_months':
            if (item.trigger_value_end) {
              shouldApply = ageMonths >= item.trigger_value && ageMonths <= item.trigger_value_end;
            } else {
              shouldApply = ageMonths === item.trigger_value;
            }
            break;
          case 'age_years':
            if (item.trigger_value_end) {
              shouldApply = ageYears >= item.trigger_value && ageYears <= item.trigger_value_end;
            } else {
              shouldApply = ageYears === item.trigger_value;
            }
            break;
          case 'event':
            // Events trigger once at specific age (in years)
            shouldApply = ageYears === item.trigger_value && currentDate.getMonth() === birthDate.getMonth();
            break;
        }
        
        if (shouldApply) {
          let expenseAmount = Number(item.amount) * inflationFactor;
          
          // For monthly expenses, apply monthly
          if (item.frequency === 'monthly') {
            // Already monthly
          } else if (item.frequency === 'yearly') {
            // Only apply in birth month
            if (currentDate.getMonth() !== birthDate.getMonth()) continue;
          } else if (item.frequency === 'once') {
            // Only apply once
            if (item.trigger_type !== 'event') continue;
          }
          
          totalChildExpenses += expenseAmount;
          events.push(`${item.name} - ${child.name} (₪${expenseAmount.toLocaleString()})`);
          
          // Withdraw from first asset with sufficient balance
          for (const asset of assets) {
            if (assetBalances[asset.id] >= expenseAmount) {
              assetBalances[asset.id] -= expenseAmount;
              totalWithdrawals += expenseAmount;
              break;
            }
          }
        }
      }
    }
    
    // Process extra deposits from params
    for (const extra of params.extra_deposits || []) {
      if (extra.date === dateStr) {
        const targetAsset = extra.asset_id 
          ? assets.find(a => a.id === extra.asset_id)
          : assets[0];
        
        if (targetAsset) {
          assetBalances[targetAsset.id] += extra.amount;
          totalDeposits += extra.amount;
          events.push(`הפקדה נוספת: ${extra.description || ''} (₪${extra.amount.toLocaleString()})`);
        }
      }
    }
    
    // Process withdrawals from params
    for (const withdrawal of params.withdrawal_events || []) {
      if (withdrawal.date === dateStr) {
        const targetAsset = withdrawal.asset_id 
          ? assets.find(a => a.id === withdrawal.asset_id)
          : assets[0];
        
        if (targetAsset && assetBalances[targetAsset.id] >= withdrawal.amount) {
          assetBalances[targetAsset.id] -= withdrawal.amount;
          totalWithdrawals += withdrawal.amount;
          events.push(`משיכה: ${withdrawal.description || ''} (₪${withdrawal.amount.toLocaleString()})`);
        }
      }
    }
    
    // Process yearly expenses (e.g., annual vacation)
    for (const yearlyExpense of params.yearly_expenses || []) {
      // Check if this is the month for this yearly expense (default to July = 7)
      const expenseMonth = yearlyExpense.month ?? 7;
      if ((month + 1) === expenseMonth) {
        let expenseAmount = yearlyExpense.amount;
        
        // Adjust for inflation if needed (default true)
        if (yearlyExpense.adjust_for_inflation !== false) {
          expenseAmount = yearlyExpense.amount * inflationFactor;
        }
        
        // Withdraw from assets
        let remaining = expenseAmount;
        for (const asset of assets) {
          if (remaining <= 0) break;
          const available = Math.min(assetBalances[asset.id], remaining);
          if (available > 0) {
            assetBalances[asset.id] -= available;
            remaining -= available;
          }
        }
        
        totalWithdrawals += expenseAmount - remaining;
        if (remaining < expenseAmount) {
          events.push(`${yearlyExpense.name} (₪${Math.round(expenseAmount - remaining).toLocaleString()})`);
        }
      }
    }
    
    // Record monthly state (only every month or at key dates)
    const totalAssets = Object.values(assetBalances).reduce((sum, bal) => sum + bal, 0);
    
    // Record at first day of each month
    if (currentDate.getDate() === 1 || currentDate.getTime() === startDate.getTime()) {
      // Calculate monthly income at this date
      const baseMonthlyIncome = getIncomeAtDate(incomeHistory, currentDate);
      // Nominal income = base income adjusted for future inflation (what you'll actually get paid)
      const nominalMonthlyIncome = baseMonthlyIncome * inflationFactor;
      // Real income = same purchasing power as today (base income stays same in real terms)
      const realMonthlyIncome = baseMonthlyIncome;
      
      // Real value = nominal value / inflation factor (what it's worth in today's money)
      const totalAssetsReal = totalAssets / inflationFactor;
      
      timeline.push({
        date: dateStr,
        total_assets: Math.round(totalAssets),
        total_assets_real: Math.round(totalAssetsReal),
        total_deposits: Math.round(totalDeposits),
        total_withdrawals: Math.round(totalWithdrawals),
        total_returns: Math.round(totalReturns),
        total_fees: Math.round(totalFees),
        total_child_expenses: Math.round(totalChildExpenses),
        monthly_income: Math.round(nominalMonthlyIncome),
        monthly_income_real: Math.round(realMonthlyIncome),
        inflation_factor: Math.round(inflationFactor * 1000) / 1000,
        assets_breakdown: Object.fromEntries(
          Object.entries(assetBalances).map(([id, bal]) => [id, Math.round(bal)])
        ),
        events,
      });
    }
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  // Calculate final inflation factor (for the entire simulation period)
  const yearsTotal = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const totalInflationFactor = Math.pow(1 + inflationRate / 100, yearsTotal);
  
  // Calculate final metrics
  const finalBalance = Object.values(assetBalances).reduce((sum, bal) => sum + bal, 0);
  const finalBalanceReal = finalBalance / totalInflationFactor; // In today's money
  const initialBalance = assets.reduce((sum, a) => sum + Number(a.current_balance), 0);
  
  // Nominal return (what you see on paper)
  const effectiveReturn = initialBalance > 0 
    ? ((finalBalance / initialBalance) - 1) * 100 
    : 0;
  
  // Real return (actual purchasing power gained)
  const effectiveReturnReal = initialBalance > 0 
    ? ((finalBalanceReal / initialBalance) - 1) * 100 
    : 0;
  
  // Real returns calculation
  const totalReturnsReal = totalReturns / totalInflationFactor;
  
  // Goals analysis
  const goalsAnalysis = goals.map(goal => {
    const targetDate = goal.target_date ? new Date(goal.target_date) : null;
    const timelineAtTarget = targetDate 
      ? timeline.find(t => new Date(t.date) >= targetDate)
      : timeline[timeline.length - 1];
    
    const projectedAmount = goal.linked_asset_id 
      ? (timelineAtTarget?.assets_breakdown[goal.linked_asset_id] || 0)
      : (timelineAtTarget?.total_assets || 0) * (Number(goal.target_amount) / finalBalance);
    
    const isAchievable = projectedAmount >= Number(goal.target_amount);
    const shortfall = isAchievable ? 0 : Number(goal.target_amount) - projectedAmount;
    
    // Calculate required extra monthly
    let requiredExtraMonthly = 0;
    if (!isAchievable && targetDate) {
      const monthsRemaining = Math.max(1, 
        (targetDate.getFullYear() - new Date().getFullYear()) * 12 + 
        (targetDate.getMonth() - new Date().getMonth())
      );
      requiredExtraMonthly = Math.ceil(shortfall / monthsRemaining);
    }
    
    return {
      goal_id: goal.id,
      goal_name: goal.name,
      target_amount: Number(goal.target_amount),
      projected_amount: Math.round(projectedAmount),
      is_achievable: isAchievable,
      achievement_date: isAchievable ? targetDate?.toISOString().split('T')[0] : undefined,
      shortfall: Math.round(shortfall),
      required_extra_monthly: requiredExtraMonthly,
    };
  });
  
  return {
    timeline,
    summary: {
      final_balance: Math.round(finalBalance),
      final_balance_real: Math.round(finalBalanceReal),
      total_deposited: Math.round(totalDeposits),
      total_returns: Math.round(totalReturns),
      total_returns_real: Math.round(totalReturnsReal),
      total_fees: Math.round(totalFees),
      total_child_expenses: Math.round(totalChildExpenses),
      effective_return_rate: Math.round(effectiveReturn * 100) / 100,
      effective_return_rate_real: Math.round(effectiveReturnReal * 100) / 100,
      total_inflation_factor: Math.round(totalInflationFactor * 1000) / 1000,
    },
    goals_analysis: goalsAnalysis,
  };
}

// ============================================
// RUN SIMULATION
// ============================================

router.post('/run', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const params = simulationParamsSchema.parse(req.body);
    
    // Fetch user data
    const [assetsResult, membersResult, goalsResult, settingsResult] = await Promise.all([
      query<Asset>('SELECT * FROM assets WHERE user_id = $1 AND is_active = true', [req.user!.id]),
      query<FamilyMember>('SELECT * FROM family_members WHERE user_id = $1 AND is_active = true', [req.user!.id]),
      query<FinancialGoal>('SELECT * FROM financial_goals WHERE user_id = $1 AND is_active = true', [req.user!.id]),
      query('SELECT * FROM family_settings WHERE user_id = $1', [req.user!.id]),
    ]);
    
    // Get income history for members with income (self, spouse)
    const incomeMembers = membersResult.rows.filter(m => 
      m.member_type === 'self' || m.member_type === 'spouse'
    );
    
    const incomeHistory: { member_id: string; records: IncomeRecord[] }[] = [];
    for (const member of incomeMembers) {
      const incomeRecords = await query<IncomeRecord>(
        'SELECT * FROM income_history WHERE member_id = $1 ORDER BY effective_date DESC',
        [member.id]
      );
      if (incomeRecords.rows.length > 0) {
        incomeHistory.push({ member_id: member.id, records: incomeRecords.rows });
      }
    }
    
    // Get child expense items
    const children = membersResult.rows.filter(m => 
      m.member_type === 'child' || (params.include_planned_children && m.member_type === 'planned_child')
    );
    
    const childExpenseItems: { child_id: string; items: ChildExpenseItem[] }[] = [];
    
    for (const child of children) {
      const assignment = await query(
        `SELECT t.id as template_id FROM child_expense_assignments a
         JOIN child_expense_templates t ON a.template_id = t.id
         WHERE a.child_id = $1`,
        [child.id]
      );
      
      let templateId: string | null = null;
      
      if (assignment.rows.length > 0) {
        templateId = assignment.rows[0].template_id;
      } else {
        // Use default template
        const defaultTemplate = await query(
          'SELECT id FROM child_expense_templates WHERE user_id = $1 AND is_default = true LIMIT 1',
          [req.user!.id]
        );
        if (defaultTemplate.rows.length > 0) {
          templateId = defaultTemplate.rows[0].id;
        }
      }
      
      if (templateId) {
        const items = await query<ChildExpenseItem>(
          'SELECT * FROM child_expense_items WHERE template_id = $1 ORDER BY sort_order',
          [templateId]
        );
        childExpenseItems.push({ child_id: child.id, items: items.rows });
      }
    }
    
    const inflationRate = params.inflation_rate ?? Number(settingsResult.rows[0]?.inflation_rate || 2.5);
    
    const results = await runSimulation({
      userId: req.user!.id,
      params: params as SimulationParams,
      assets: assetsResult.rows,
      familyMembers: membersResult.rows,
      childExpenseItems,
      goals: goalsResult.rows,
      inflationRate,
      incomeHistory,
    });
    
    res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Run simulation error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ============================================
// SAVED SCENARIOS
// ============================================

// Get all scenarios
router.get('/scenarios', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<SimulationScenario>(
      `SELECT * FROM simulation_scenarios 
       WHERE user_id = $1 
       ORDER BY is_favorite DESC, updated_at DESC`,
      [req.user!.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get scenarios error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get single scenario
router.get('/scenarios/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<SimulationScenario>(
      'SELECT * FROM simulation_scenarios WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get scenario error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Save scenario
router.post('/scenarios', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = scenarioSchema.parse(req.body);
    
    const result = await query<SimulationScenario>(
      `INSERT INTO simulation_scenarios (id, user_id, name, description, params, is_favorite)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [uuidv4(), req.user!.id, data.name, data.description, JSON.stringify(data.params), data.is_favorite]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Save scenario error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update scenario
router.put('/scenarios/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = scenarioSchema.partial().parse(req.body);
    
    const result = await query<SimulationScenario>(
      `UPDATE simulation_scenarios SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        params = COALESCE($3, params),
        is_favorite = COALESCE($4, is_favorite),
        updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [
        data.name,
        data.description,
        data.params ? JSON.stringify(data.params) : undefined,
        data.is_favorite,
        req.params.id,
        req.user!.id,
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update scenario error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete scenario
router.delete('/scenarios/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM simulation_scenarios WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete scenario error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Run saved scenario
router.post('/scenarios/:id/run', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const scenario = await query<SimulationScenario>(
      'SELECT * FROM simulation_scenarios WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    
    if (scenario.rows.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    
    const params = scenario.rows[0].params as SimulationParams;
    
    // Fetch user data and run simulation (same as /run)
    const [assetsResult, membersResult, goalsResult, settingsResult] = await Promise.all([
      query<Asset>('SELECT * FROM assets WHERE user_id = $1 AND is_active = true', [req.user!.id]),
      query<FamilyMember>('SELECT * FROM family_members WHERE user_id = $1 AND is_active = true', [req.user!.id]),
      query<FinancialGoal>('SELECT * FROM financial_goals WHERE user_id = $1 AND is_active = true', [req.user!.id]),
      query('SELECT * FROM family_settings WHERE user_id = $1', [req.user!.id]),
    ]);
    
    // Get income history for members with income (self, spouse)
    const incomeMembers = membersResult.rows.filter(m => 
      m.member_type === 'self' || m.member_type === 'spouse'
    );
    
    const incomeHistory: { member_id: string; records: IncomeRecord[] }[] = [];
    for (const member of incomeMembers) {
      const incomeRecords = await query<IncomeRecord>(
        'SELECT * FROM income_history WHERE member_id = $1 ORDER BY effective_date DESC',
        [member.id]
      );
      if (incomeRecords.rows.length > 0) {
        incomeHistory.push({ member_id: member.id, records: incomeRecords.rows });
      }
    }
    
    const children = membersResult.rows.filter(m => 
      m.member_type === 'child' || m.member_type === 'planned_child'
    );
    
    const childExpenseItems: { child_id: string; items: ChildExpenseItem[] }[] = [];
    
    for (const child of children) {
      const defaultTemplate = await query(
        'SELECT id FROM child_expense_templates WHERE user_id = $1 AND is_default = true LIMIT 1',
        [req.user!.id]
      );
      
      if (defaultTemplate.rows.length > 0) {
        const items = await query<ChildExpenseItem>(
          'SELECT * FROM child_expense_items WHERE template_id = $1 ORDER BY sort_order',
          [defaultTemplate.rows[0].id]
        );
        childExpenseItems.push({ child_id: child.id, items: items.rows });
      }
    }
    
    const inflationRate = params.inflation_rate ?? Number(settingsResult.rows[0]?.inflation_rate || 2.5);
    
    const results = await runSimulation({
      userId: req.user!.id,
      params: params as SimulationParams,
      assets: assetsResult.rows,
      familyMembers: membersResult.rows,
      childExpenseItems,
      goals: goalsResult.rows,
      inflationRate,
      incomeHistory,
    });
    
    // Cache results
    await query(
      `UPDATE simulation_scenarios SET results = $1, calculated_at = NOW() WHERE id = $2`,
      [JSON.stringify(results), req.params.id]
    );
    
    res.json(results);
  } catch (error) {
    console.error('Run scenario error:', error);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
