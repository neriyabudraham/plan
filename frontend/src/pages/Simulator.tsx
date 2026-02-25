import { useState, useEffect } from 'react';
import { PlayIcon, BookmarkIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import {
  Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api, { handleApiError } from '../services/api';
import { SimulationParams, SimulationResults, SimulationScenario, FamilyMember } from '../types';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';

export default function Simulator() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  
  const [params, setParams] = useState<SimulationParams>({
    start_date: new Date().toISOString().split('T')[0],
    end_age: 67,
    target_member_id: '',
    inflation_rate: 2.5,
    include_planned_children: true,
    extra_monthly_deposit: 0,
    extra_deposits: [],
    withdrawal_events: [],
  });
  
  const [saveName, setSaveName] = useState('');
  const [showReal, setShowReal] = useState(false); // Toggle between nominal and real values
  
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
      
      // Set default target member to self
      const self = membersRes.data.find(m => m.member_type === 'self');
      if (self) {
        setParams(p => ({ ...p, target_member_id: self.id }));
      }
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
      // Run the scenario
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
  
  if (loading) return <Loading />;
  
  const chartData = results?.timeline.filter((_, i) => i % 12 === 0).map(point => ({
    date: new Date(point.date).toLocaleDateString('he-IL', { year: 'numeric', month: 'short' }),
    assets: showReal ? point.total_assets_real : point.total_assets,
    deposits: point.total_deposits,
    returns: point.total_returns,
    childExpenses: point.total_child_expenses,
    income: showReal ? point.monthly_income_real : point.monthly_income,
    inflationFactor: point.inflation_factor,
  })) || [];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">סימולטור פיננסי</h1>
          <p className="text-gray-500 mt-1">צפה בעתיד הפיננסי שלך</p>
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
                <h3 className="font-bold text-gray-900 dark:text-white">סיכום</h3>
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
                    <span className="text-purple-500">שווי ריאלי (היום)</span>
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
              {/* Chart */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    צפי נכסים לאורך זמן
                    {showReal && <span className="text-sm font-normal text-purple-500 mr-2">(ערכים ריאליים)</span>}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>💡 {showReal ? 'מציג כוח קנייה אמיתי' : 'מציג ערכים נומינליים'}</span>
                  </div>
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
                      <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} />
                      <YAxis tickFormatter={v => `₪${(v/1000000).toFixed(1)}M`} stroke="#9CA3AF" fontSize={11} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `₪${value.toLocaleString()}`,
                          name === 'assets' ? 'נכסים' : name === 'deposits' ? 'הפקדות' : name === 'returns' ? 'תשואות' : 'הוצאות ילדים'
                        ]}
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', direction: 'rtl' }}
                      />
                      <Legend formatter={v => v === 'assets' ? 'נכסים' : v === 'deposits' ? 'הפקדות מצטברות' : 'תשואות'} />
                      <Area type="monotone" dataKey="assets" stroke="#10B981" fill="url(#colorAssets)" strokeWidth={3} />
                      <Line type="monotone" dataKey="deposits" stroke="#3B82F6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="returns" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Goals Analysis */}
              {results.goals_analysis.length > 0 && (
                <div className="card p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">ניתוח יעדים</h2>
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
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">מוכן לסימולציה</h3>
              <p className="text-gray-500 mb-4">הגדר את הפרמטרים ולחץ על "הרץ סימולציה"</p>
              <button onClick={runSimulation} className="btn-primary">
                <PlayIcon className="w-5 h-5 ml-1" />
                הרץ סימולציה
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Parameters Modal */}
      <Modal isOpen={isParamsOpen} onClose={() => setIsParamsOpen(false)} title="פרמטרי סימולציה" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">תאריך התחלה</label>
              <input type="date" value={params.start_date} onChange={e => setParams({...params, start_date: e.target.value})} className="input" />
            </div>
            <div>
              <label className="label">גיל סיום (פרישה)</label>
              <input type="number" value={params.end_age || ''} onChange={e => setParams({...params, end_age: Number(e.target.value)})} className="input" min="30" max="120" />
            </div>
            <div>
              <label className="label">חישוב לפי</label>
              <select value={params.target_member_id || ''} onChange={e => setParams({...params, target_member_id: e.target.value})} className="input">
                <option value="">בחר בן משפחה</option>
                {members.filter(m => m.member_type === 'self' || m.member_type === 'spouse').map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">אינפלציה (%)</label>
              <input type="number" value={params.inflation_rate || ''} onChange={e => setParams({...params, inflation_rate: Number(e.target.value)})} className="input" min="0" max="20" step="0.1" />
            </div>
            <div>
              <label className="label">הפקדה נוספת חודשית (₪)</label>
              <input type="number" value={params.extra_monthly_deposit || ''} onChange={e => setParams({...params, extra_monthly_deposit: Number(e.target.value)})} className="input" min="0" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.include_planned_children}
                onChange={e => setParams({...params, include_planned_children: e.target.checked})}
                className="w-4 h-4"
              />
              <label className="text-sm text-gray-700 dark:text-gray-300">כלול ילדים מתוכננים</label>
            </div>
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
