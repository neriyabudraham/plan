import { useState, useEffect } from 'react';
import { PlayIcon, BookmarkIcon, AdjustmentsHorizontalIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import {
  Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api, { handleApiError } from '../services/api';
import { SimulationParams, SimulationResults, SimulationScenario, FamilyMember, YearlyExpense } from '../types';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';
import NumberInput from '../components/common/NumberInput';

export default function Simulator() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [showReal, setShowReal] = useState(false);
  
  const [params, setParams] = useState<SimulationParams>({
    start_date: new Date().toISOString().split('T')[0],
    end_age: 67,
    inflation_rate: 2.5,
    include_planned_children: true,
    extra_monthly_deposit: 0,
    yearly_expenses: [],
    extra_deposits: [],
    withdrawal_events: [],
  });
  
  const [saveName, setSaveName] = useState('');
  
  useEffect(() => {
    fetchInitialData();
  }, []);
  
  const fetchInitialData = async () => {
    try {
      const [scenariosRes, membersRes] = await Promise.all([
        api.get<SimulationScenario[]>('/simulation/scenarios'),
        api.get<FamilyMember[]>('/family/members'),
      ]);
      setScenarios(scenariosRes.data);
      setMembers(membersRes.data);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const runSimulation = async () => {
    setRunning(true);
    try {
      const res = await api.post<SimulationResults>('/simulation/run', params);
      setResults(res.data);
      toast.success('הסימולציה הסתיימה');
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setRunning(false);
    }
  };
  
  const loadScenario = async (scenario: SimulationScenario) => {
    setParams(scenario.params);
    if (scenario.results) {
      setResults(scenario.results);
    } else {
      setRunning(true);
      try {
        const res = await api.post<SimulationResults>(`/simulation/scenarios/${scenario.id}/run`);
        setResults(res.data);
      } catch (error) {
        toast.error(handleApiError(error));
      } finally {
        setRunning(false);
      }
    }
    toast.success(`נטען: ${scenario.name}`);
  };
  
  const saveScenario = async () => {
    if (!saveName) return;
    try {
      await api.post('/simulation/scenarios', {
        name: saveName,
        params,
      });
      toast.success('נשמר');
      setIsSaveOpen(false);
      setSaveName('');
      fetchInitialData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const deleteScenario = async (id: string) => {
    if (!confirm('למחוק?')) return;
    try {
      await api.delete(`/simulation/scenarios/${id}`);
      toast.success('נמחק');
      fetchInitialData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const addYearlyExpense = () => {
    setParams({
      ...params,
      yearly_expenses: [
        ...(params.yearly_expenses || []),
        { name: 'טיול שנתי', amount: 15000, month: 7, adjust_for_inflation: true }
      ]
    });
  };
  
  const removeYearlyExpense = (index: number) => {
    const newExpenses = [...(params.yearly_expenses || [])];
    newExpenses.splice(index, 1);
    setParams({ ...params, yearly_expenses: newExpenses });
  };
  
  const updateYearlyExpense = (index: number, field: keyof YearlyExpense, value: any) => {
    const newExpenses = [...(params.yearly_expenses || [])];
    newExpenses[index] = { ...newExpenses[index], [field]: value };
    setParams({ ...params, yearly_expenses: newExpenses });
  };
  
  if (loading) return <Loading />;
  
  // Get self member for age display
  const selfMember = members.find(m => m.member_type === 'self');
  const selfAge = selfMember?.age_years;
  
  // Chart data - show yearly data points (every 12 months)
  const chartData = results?.timeline
    .filter((_, i) => i % 12 === 0 || i === results.timeline.length - 1) // Show yearly + last point
    .map((point, index) => ({
      year: selfAge ? selfAge + index : new Date(point.date).getFullYear(),
      label: new Date(point.date).toLocaleDateString('he-IL', { year: 'numeric' }),
      assets: showReal ? (point.total_assets_real || point.total_assets) : point.total_assets,
      deposits: point.total_deposits,
      returns: point.total_returns,
    })) || [];
  
  // Debug: log timeline length
  console.log('Timeline length:', results?.timeline.length, 'Chart points:', chartData.length);
  
  // Current year summary
  const currentYearData = results?.timeline.slice(-12) || [];
  const yearlyDeposits = currentYearData.reduce((sum, p, i, arr) => {
    if (i === 0) return 0;
    return sum + (p.total_deposits - arr[i-1].total_deposits);
  }, 0);
  const yearlyReturns = currentYearData.reduce((sum, p, i, arr) => {
    if (i === 0) return 0;
    return sum + (p.total_returns - arr[i-1].total_returns);
  }, 0);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">סימולטור משפחתי</h1>
          <p className="text-gray-500 mt-1">תחזית פיננסית משפחתית משותפת</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsParamsOpen(true)} className="btn-secondary">
            <AdjustmentsHorizontalIcon className="w-5 h-5 ml-1" />
            פרמטרים
          </button>
          <button onClick={runSimulation} disabled={running} className="btn-primary">
            <PlayIcon className="w-5 h-5 ml-1" />
            {running ? 'מריץ...' : 'הרץ סימולציה'}
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Saved Scenarios */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 dark:text-white">תרחישים שמורים</h2>
            {results && (
              <button onClick={() => setIsSaveOpen(true)} className="text-primary-600 text-sm">
                <BookmarkIcon className="w-4 h-4 inline ml-1" />
                שמור
              </button>
            )}
          </div>
          
          <div className="space-y-2">
            {scenarios.map(s => (
              <div
                key={s.id}
                className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-400 cursor-pointer transition-all"
                onClick={() => loadScenario(s)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {s.is_favorite && <BookmarkSolidIcon className="w-4 h-4 text-amber-500" />}
                    <span className="font-medium text-gray-900 dark:text-white">{s.name}</span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteScenario(s.id); }}
                    className="text-gray-400 hover:text-red-500 text-xs"
                  >
                    מחק
                  </button>
                </div>
              </div>
            ))}
            
            {scenarios.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">אין תרחישים שמורים</p>
            )}
          </div>
          
          {/* Quick Stats */}
          {results && (
            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white">סיכום משפחתי</h3>
                <button
                  onClick={() => setShowReal(!showReal)}
                  className={`text-xs px-2 py-1 rounded-full transition-colors ${
                    showReal 
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {showReal ? '🎯 ריאלי' : '💵 נומינלי'}
                </button>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">יתרה סופית</span>
                  <span className="font-bold text-emerald-600">
                    ₪{(showReal ? results.summary.final_balance_real : results.summary.final_balance).toLocaleString()}
                  </span>
                </div>
                {!showReal && (
                  <div className="flex justify-between text-xs">
                    <span className="text-purple-500">שווי ריאלי</span>
                    <span className="text-purple-600">₪{results.summary.final_balance_real.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">סה"כ הופקד</span>
                  <span className="font-medium">₪{results.summary.total_deposited.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">תשואות</span>
                  <span className="font-medium text-primary-600">
                    ₪{(showReal ? results.summary.total_returns_real : results.summary.total_returns).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">עמלות</span>
                  <span className="font-medium text-rose-600">-₪{results.summary.total_fees.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">הוצאות ילדים</span>
                  <span className="font-medium text-amber-600">₪{results.summary.total_child_expenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-500">תשואה אפקטיבית</span>
                  <span className="font-bold">
                    {showReal ? results.summary.effective_return_rate_real : results.summary.effective_return_rate}%
                  </span>
                </div>
                {!showReal && (
                  <div className="flex justify-between text-xs">
                    <span className="text-purple-500">תשואה ריאלית</span>
                    <span className="text-purple-600">{results.summary.effective_return_rate_real}%</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t text-xs">
                  <span className="text-gray-400">אינפלציה מצטברת</span>
                  <span className="text-gray-500">{((results.summary.total_inflation_factor - 1) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Main Chart */}
        <div className="lg:col-span-3 space-y-6">
          {results ? (
            <>
              {/* Current Year Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">הון משפחתי נוכחי</p>
                  <p className="text-xl font-bold text-emerald-600">
                    ₪{(results.timeline[0]?.total_assets || 0).toLocaleString()}
                  </p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">הון בגיל {params.end_age || 67}</p>
                  <p className="text-xl font-bold text-primary-600">
                    ₪{(showReal ? results.summary.final_balance_real : results.summary.final_balance).toLocaleString()}
                  </p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">הפקדות שנתיות</p>
                  <p className="text-xl font-bold text-blue-600">
                    ₪{Math.round(yearlyDeposits).toLocaleString()}
                  </p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">תשואה שנתית</p>
                  <p className="text-xl font-bold text-purple-600">
                    ₪{Math.round(yearlyReturns).toLocaleString()}
                  </p>
                </div>
              </div>
              
              {/* Chart */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    צפי הון משפחתי
                    {showReal && <span className="text-sm font-normal text-purple-500 mr-2">(ערכים ריאליים)</span>}
                  </h2>
                  {selfAge && (
                    <span className="text-sm text-gray-500">
                      גיל {selfAge} → {params.end_age || 67}
                    </span>
                  )}
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="year" 
                        stroke="#9CA3AF" 
                        fontSize={11}
                        tickFormatter={(v) => selfAge ? `גיל ${v}` : v}
                      />
                      <YAxis tickFormatter={v => `₪${(v/1000000).toFixed(1)}M`} stroke="#9CA3AF" fontSize={11} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `₪${value.toLocaleString()}`,
                          name === 'assets' ? 'הון משפחתי' : name === 'deposits' ? 'הפקדות מצטברות' : 'תשואות'
                        ]}
                        labelFormatter={(label) => selfAge ? `גיל ${label}` : label}
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', direction: 'rtl' }}
                      />
                      <Legend formatter={v => v === 'assets' ? 'הון משפחתי' : v === 'deposits' ? 'הפקדות' : 'תשואות'} />
                      <Area type="monotone" dataKey="assets" stroke="#10B981" fill="url(#colorAssets)" strokeWidth={3} name="assets" />
                      <Line type="monotone" dataKey="deposits" stroke="#3B82F6" strokeWidth={2} dot={false} name="deposits" />
                      <Line type="monotone" dataKey="returns" stroke="#8B5CF6" strokeWidth={2} dot={false} name="returns" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Yearly Expenses in Results */}
              {(params.yearly_expenses?.length || 0) > 0 && (
                <div className="card p-4">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">הוצאות שנתיות קבועות</h3>
                  <div className="flex flex-wrap gap-2">
                    {params.yearly_expenses?.map((exp, i) => (
                      <span key={i} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">
                        {exp.name}: ₪{exp.amount.toLocaleString()}/שנה
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Goals Analysis */}
              {results.goals_analysis.length > 0 && (
                <div className="card p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">ניתוח יעדים משפחתיים</h2>
                  <div className="space-y-4">
                    {results.goals_analysis.map(goal => (
                      <div key={goal.goal_id} className={`p-4 rounded-xl ${goal.is_achievable ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{goal.goal_name}</h3>
                            <p className="text-sm text-gray-500">
                              יעד: ₪{goal.target_amount.toLocaleString()} • צפי: ₪{goal.projected_amount.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-left">
                            {goal.is_achievable ? (
                              <span className="text-emerald-600 font-bold">✓ ניתן להשגה</span>
                            ) : (
                              <div>
                                <span className="text-rose-600 font-bold">✗ חסר ₪{(goal.shortfall || 0).toLocaleString()}</span>
                                {goal.required_extra_monthly && goal.required_extra_monthly > 0 && (
                                  <p className="text-sm text-gray-500">נדרש להוסיף ₪{goal.required_extra_monthly.toLocaleString()}/חודש</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card p-12 text-center">
              <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">סימולטור משפחתי</h3>
              <p className="text-gray-500 mb-4">צפה בעתיד הפיננסי של המשפחה כולה</p>
              <button onClick={runSimulation} className="btn-primary">
                <PlayIcon className="w-5 h-5 ml-1" />
                הרץ סימולציה
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Parameters Modal */}
      <Modal isOpen={isParamsOpen} onClose={() => setIsParamsOpen(false)} title="פרמטרי סימולציה משפחתית" size="lg">
        <div className="space-y-6">
          {/* Basic Params */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">תאריך התחלה</label>
              <input 
                type="date" 
                value={params.start_date} 
                onChange={e => setParams({...params, start_date: e.target.value})} 
                className="input" 
              />
            </div>
            <div>
              <label className="label">גיל פרישה</label>
              <NumberInput
                value={params.end_age || 67}
                onChange={v => setParams({...params, end_age: v})}
                min={30}
                max={120}
                className="input"
              />
            </div>
            <div>
              <label className="label">אינפלציה (%)</label>
              <NumberInput
                value={params.inflation_rate || 2.5}
                onChange={v => setParams({...params, inflation_rate: v})}
                min={0}
                max={20}
                allowDecimal
                className="input"
              />
            </div>
            <div>
              <label className="label">הפקדה נוספת חודשית (₪)</label>
              <NumberInput
                value={params.extra_monthly_deposit || 0}
                onChange={v => setParams({...params, extra_monthly_deposit: v})}
                min={0}
                className="input"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={params.include_planned_children}
              onChange={e => setParams({...params, include_planned_children: e.target.checked})}
              className="w-4 h-4"
            />
            <label className="text-sm text-gray-700 dark:text-gray-300">כלול ילדים מתוכננים בחישוב</label>
          </div>
          
          {/* Yearly Expenses */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 dark:text-white">הוצאות שנתיות קבועות</h3>
              <button onClick={addYearlyExpense} className="text-primary-600 text-sm flex items-center gap-1">
                <PlusIcon className="w-4 h-4" />
                הוסף הוצאה
              </button>
            </div>
            
            {(params.yearly_expenses || []).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                אין הוצאות שנתיות. הוסף טיולים, ביטוחים, או הוצאות קבועות אחרות.
              </p>
            ) : (
              <div className="space-y-3">
                {params.yearly_expenses?.map((exp, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <input
                      type="text"
                      value={exp.name}
                      onChange={e => updateYearlyExpense(i, 'name', e.target.value)}
                      className="input flex-1"
                      placeholder="שם ההוצאה"
                    />
                    <div className="w-32">
                      <NumberInput
                        value={exp.amount}
                        onChange={v => updateYearlyExpense(i, 'amount', v)}
                        min={0}
                        className="input"
                      />
                    </div>
                    <select
                      value={exp.month || 7}
                      onChange={e => updateYearlyExpense(i, 'month', Number(e.target.value))}
                      className="input w-24"
                    >
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                        <option key={m} value={m}>{['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'][m-1]}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeYearlyExpense(i)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex gap-3 pt-4">
            <button onClick={() => { setIsParamsOpen(false); runSimulation(); }} className="btn-primary flex-1">
              הרץ סימולציה
            </button>
            <button onClick={() => setIsParamsOpen(false)} className="btn-secondary flex-1">סגור</button>
          </div>
        </div>
      </Modal>
      
      {/* Save Modal */}
      <Modal isOpen={isSaveOpen} onClose={() => setIsSaveOpen(false)} title="שמור תרחיש">
        <div className="space-y-4">
          <div>
            <label className="label">שם התרחיש</label>
            <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} className="input" placeholder="לדוגמא: תרחיש אופטימי" />
          </div>
          <div className="flex gap-3">
            <button onClick={saveScenario} className="btn-primary flex-1">שמור</button>
            <button onClick={() => setIsSaveOpen(false)} className="btn-secondary flex-1">ביטול</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
