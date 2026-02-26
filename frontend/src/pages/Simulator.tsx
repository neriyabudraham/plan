import { useState, useEffect, useMemo, useCallback } from 'react';
import { PlayIcon, BookmarkIcon, AdjustmentsHorizontalIcon, PlusIcon, TrashIcon, ChevronRightIcon, ChevronLeftIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ReferenceLine
} from 'recharts';
import api, { handleApiError } from '../services/api';
import { SimulationParams, SimulationResults, SimulationScenario, FamilyMember, Asset, YearlyExpense, TimelinePoint } from '../types';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';
import NumberInput from '../components/common/NumberInput';

const PIE_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16'];

type ViewTab = 'chart' | 'yearly' | 'breakdown';

export default function Simulator() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [showReal, setShowReal] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('chart');
  const [selectedYearIndex, setSelectedYearIndex] = useState(0);

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
      const [scenariosRes, membersRes, assetsRes] = await Promise.all([
        api.get<SimulationScenario[]>('/simulation/scenarios'),
        api.get<FamilyMember[]>('/family/members'),
        api.get<Asset[]>('/assets'),
      ]);
      setScenarios(scenariosRes.data);
      setMembers(membersRes.data);
      setAssets(assetsRes.data);
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
      setSelectedYearIndex(0);
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
      setSelectedYearIndex(0);
    } else {
      setRunning(true);
      try {
        const res = await api.post<SimulationResults>(`/simulation/scenarios/${scenario.id}/run`);
        setResults(res.data);
        setSelectedYearIndex(0);
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
      await api.post('/simulation/scenarios', { name: saveName, params });
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
    const updated = [...(params.yearly_expenses || [])];
    updated.splice(index, 1);
    setParams({ ...params, yearly_expenses: updated });
  };

  const updateYearlyExpense = (index: number, field: keyof YearlyExpense, value: any) => {
    const updated = [...(params.yearly_expenses || [])];
    updated[index] = { ...updated[index], [field]: value };
    setParams({ ...params, yearly_expenses: updated });
  };

  // Derived data
  const selfMember = members.find(m => m.member_type === 'self');
  const selfAge = selfMember?.age_years || 30;

  // Build yearly data from timeline
  const yearlyData = useMemo(() => {
    if (!results?.timeline.length) return [];
    const data: {
      index: number;
      year: number;
      age: number;
      date: string;
      point: TimelinePoint;
      prevPoint?: TimelinePoint;
      yearDeposits: number;
      yearReturns: number;
      yearFees: number;
      yearChildExpenses: number;
      yearEvents: string[];
    }[] = [];

    const tl = results.timeline;
    let yearIdx = 0;
    for (let i = 0; i < tl.length; i += 12) {
      const point = tl[Math.min(i + 11, tl.length - 1)];
      const yearStart = tl[i];
      const prevYearEnd = i >= 12 ? tl[i - 1] : null;

      const yearDeposits = point.total_deposits - (prevYearEnd?.total_deposits || 0);
      const yearReturns = point.total_returns - (prevYearEnd?.total_returns || 0);
      const yearFees = point.total_fees - (prevYearEnd?.total_fees || 0);
      const yearChildExpenses = point.total_child_expenses - (prevYearEnd?.total_child_expenses || 0);

      const yearEvents: string[] = [];
      for (let j = i; j <= Math.min(i + 11, tl.length - 1); j++) {
        yearEvents.push(...tl[j].events);
      }

      data.push({
        index: yearIdx,
        year: new Date(yearStart.date).getFullYear(),
        age: selfAge + yearIdx,
        date: yearStart.date,
        point,
        prevPoint: prevYearEnd || undefined,
        yearDeposits,
        yearReturns,
        yearFees,
        yearChildExpenses,
        yearEvents,
      });
      yearIdx++;
    }
    return data;
  }, [results, selfAge]);

  const selectedYear = yearlyData[selectedYearIndex];

  const chartData = useMemo(() =>
    yearlyData.map(y => ({
      age: y.age,
      year: y.year,
      assets: showReal ? (y.point.total_assets_real || y.point.total_assets) : y.point.total_assets,
      deposits: y.point.total_deposits,
      returns: y.point.total_returns,
      income: y.point.monthly_income * 12,
    })), [yearlyData, showReal]);

  const barData = useMemo(() =>
    yearlyData.map(y => ({
      age: y.age,
      deposits: Math.round(y.yearDeposits),
      returns: Math.round(y.yearReturns),
      fees: -Math.round(y.yearFees),
      childExpenses: -Math.round(y.yearChildExpenses),
    })), [yearlyData]);

  const pieData = useMemo(() => {
    if (!selectedYear) return [];
    const breakdown = selectedYear.point.assets_breakdown;
    return Object.entries(breakdown)
      .filter(([_, v]) => v > 0)
      .map(([id, value]) => {
        const asset = assets.find(a => a.id === id);
        return { name: asset?.name || id.slice(0, 6), value: Math.round(value), icon: asset?.icon || '💰' };
      })
      .sort((a, b) => b.value - a.value);
  }, [selectedYear, assets]);

  const navigateYear = useCallback((dir: number) => {
    setSelectedYearIndex(prev => Math.max(0, Math.min(yearlyData.length - 1, prev + dir)));
  }, [yearlyData.length]);

  if (loading) return <Loading />;

  const fmt = (n: number) => `₪${n.toLocaleString()}`;
  const fmtM = (n: number) => n >= 1000000 ? `₪${(n / 1000000).toFixed(1)}M` : `₪${Math.round(n / 1000).toLocaleString()}K`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">סימולטור משפחתי</h1>
          <p className="text-gray-500 text-sm mt-0.5">תחזית פיננסית עד גיל {params.end_age || 67}</p>
        </div>
        <div className="flex gap-2">
          {results && (
            <button onClick={() => setIsSaveOpen(true)} className="btn-secondary text-sm">
              <BookmarkIcon className="w-4 h-4 ml-1" />
              שמור
            </button>
          )}
          <button onClick={() => setIsParamsOpen(true)} className="btn-secondary text-sm">
            <AdjustmentsHorizontalIcon className="w-4 h-4 ml-1" />
            הגדרות
          </button>
          <button onClick={runSimulation} disabled={running} className="btn-primary">
            <PlayIcon className="w-5 h-5 ml-1" />
            {running ? 'מחשב...' : 'הרץ'}
          </button>
        </div>
      </div>

      {results && yearlyData.length > 0 ? (
        <>
          {/* Top Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="הון נוכחי" value={fmt(yearlyData[0]?.point.total_assets || 0)} color="emerald" />
            <StatCard
              label={`הון בגיל ${params.end_age || 67}`}
              value={fmt(showReal ? results.summary.final_balance_real : results.summary.final_balance)}
              color="primary"
              sub={showReal ? undefined : `ריאלי: ${fmt(results.summary.final_balance_real)}`}
            />
            <StatCard label="סה״כ הפקדות" value={fmt(results.summary.total_deposited)} color="blue" />
            <StatCard label="סה״כ תשואות" value={fmt(showReal ? results.summary.total_returns_real : results.summary.total_returns)} color="purple" />
            <StatCard
              label="תשואה אפקטיבית"
              value={`${showReal ? results.summary.effective_return_rate_real : results.summary.effective_return_rate}%`}
              color="amber"
              sub={`אינפלציה: ${((results.summary.total_inflation_factor - 1) * 100).toFixed(0)}%`}
            />
          </div>

          {/* Year Navigator */}
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <button onClick={() => navigateYear(-1)} disabled={selectedYearIndex === 0} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30">
                <ChevronRightIcon className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedYear?.year}
                  </span>
                  <span className="text-sm text-gray-500 mr-2">
                    (גיל {selectedYear?.age})
                  </span>
                </div>
                <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-gray-500">הון: </span>
                    <span className="font-bold text-emerald-600">{fmt(selectedYear?.point.total_assets || 0)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">הפקדות השנה: </span>
                    <span className="font-bold text-blue-600">{fmt(selectedYear?.yearDeposits || 0)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">תשואות השנה: </span>
                    <span className="font-bold text-purple-600">{fmt(selectedYear?.yearReturns || 0)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">הוצאות ילדים: </span>
                    <span className="font-bold text-amber-600">{fmt(selectedYear?.yearChildExpenses || 0)}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => navigateYear(1)} disabled={selectedYearIndex === yearlyData.length - 1} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30">
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Year slider */}
            <div className="mt-3 px-2">
              <input
                type="range"
                min={0}
                max={yearlyData.length - 1}
                value={selectedYearIndex}
                onChange={e => setSelectedYearIndex(Number(e.target.value))}
                className="w-full accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>גיל {yearlyData[0]?.age}</span>
                <span>גיל {yearlyData[yearlyData.length - 1]?.age}</span>
              </div>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
            {[
              { id: 'chart' as ViewTab, label: 'גרף צמיחה' },
              { id: 'yearly' as ViewTab, label: 'השוואה שנתית' },
              { id: 'breakdown' as ViewTab, label: 'פילוח נכסים' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="mr-auto flex items-center">
              <button
                onClick={() => setShowReal(!showReal)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  showReal ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {showReal ? '🎯 ריאלי' : '💵 נומינלי'}
              </button>
            </div>
          </div>

          {/* Charts */}
          <div className="card p-5">
            {activeTab === 'chart' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  צפי הון משפחתי לאורך זמן
                  {showReal && <span className="text-sm font-normal text-purple-500 mr-2">(ערכים ריאליים)</span>}
                </h2>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} onClick={(e: any) => {
                      if (e?.activeTooltipIndex !== undefined) setSelectedYearIndex(e.activeTooltipIndex);
                    }}>
                      <defs>
                        <linearGradient id="gradAssets" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gradDeposits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="age" stroke="#9CA3AF" fontSize={11} tickFormatter={v => `${v}`} />
                      <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={v => fmtM(v)} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-lg text-sm" style={{ direction: 'rtl' }}>
                              <p className="font-bold mb-1">גיל {label} ({yearlyData[chartData.findIndex(d => d.age === label)]?.year})</p>
                              {payload.map((p: any) => (
                                <div key={p.dataKey} className="flex justify-between gap-4" style={{ color: p.color }}>
                                  <span>{p.dataKey === 'assets' ? 'הון' : p.dataKey === 'deposits' ? 'הפקדות מצטברות' : p.dataKey === 'returns' ? 'תשואות מצטברות' : 'הכנסה שנתית'}</span>
                                  <span className="font-bold">{fmt(p.value)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Legend formatter={v => v === 'assets' ? 'הון משפחתי' : v === 'deposits' ? 'הפקדות מצטברות' : v === 'returns' ? 'תשואות מצטברות' : 'הכנסה שנתית'} />
                      {selectedYear && <ReferenceLine x={selectedYear.age} stroke="#6366F1" strokeDasharray="4 4" strokeWidth={2} />}
                      <Area type="monotone" dataKey="assets" stroke="#10B981" fill="url(#gradAssets)" strokeWidth={3} name="assets" />
                      <Area type="monotone" dataKey="deposits" stroke="#3B82F6" fill="url(#gradDeposits)" strokeWidth={2} name="deposits" />
                      <Area type="monotone" dataKey="returns" stroke="#8B5CF6" fill="none" strokeWidth={2} strokeDasharray="5 3" name="returns" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'yearly' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">הפקדות ותשואות לפי שנה</h2>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} onClick={(e: any) => {
                      if (e?.activeTooltipIndex !== undefined) setSelectedYearIndex(e.activeTooltipIndex);
                    }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="age" stroke="#9CA3AF" fontSize={11} />
                      <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={v => fmtM(Math.abs(v))} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-lg text-sm" style={{ direction: 'rtl' }}>
                              <p className="font-bold mb-1">גיל {label}</p>
                              {payload.map((p: any) => (
                                <div key={p.dataKey} className="flex justify-between gap-4" style={{ color: p.color }}>
                                  <span>{p.dataKey === 'deposits' ? 'הפקדות' : p.dataKey === 'returns' ? 'תשואות' : p.dataKey === 'fees' ? 'עמלות' : 'הוצאות ילדים'}</span>
                                  <span className="font-bold">{fmt(Math.abs(p.value))}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Legend formatter={v => v === 'deposits' ? 'הפקדות' : v === 'returns' ? 'תשואות' : v === 'fees' ? 'עמלות' : 'הוצאות ילדים'} />
                      <ReferenceLine y={0} stroke="#9CA3AF" />
                      <Bar dataKey="deposits" fill="#3B82F6" radius={[4, 4, 0, 0]} name="deposits" />
                      <Bar dataKey="returns" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="returns" />
                      <Bar dataKey="fees" fill="#EF4444" radius={[0, 0, 4, 4]} name="fees" />
                      <Bar dataKey="childExpenses" fill="#F59E0B" radius={[0, 0, 4, 4]} name="childExpenses" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'breakdown' && selectedYear && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  פילוח נכסים - גיל {selectedYear.age} ({selectedYear.year})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={3} dataKey="value">
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-lg text-sm" style={{ direction: 'rtl' }}>
                                <p className="font-bold">{d.icon} {d.name}</p>
                                <p className="text-emerald-600 font-bold">{fmt(d.value)}</p>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {pieData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-sm">{item.icon} {item.name}</span>
                        </div>
                        <span className="font-bold text-sm">{fmt(item.value)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <span className="font-bold text-emerald-700">סה״כ</span>
                      <span className="font-bold text-emerald-700 text-lg">{fmt(selectedYear.point.total_assets)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Year Detail + Events */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Year Detail Card */}
            <div className="card p-5">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <CalendarDaysIcon className="w-5 h-5" />
                פירוט שנת {selectedYear?.year}
              </h3>
              {selectedYear && (
                <div className="space-y-2 text-sm">
                  <Row label="הון בתחילת השנה" value={fmt(selectedYear.prevPoint?.total_assets || yearlyData[0]?.point.total_assets || 0)} />
                  <Row label="הפקדות" value={`+${fmt(Math.round(selectedYear.yearDeposits))}`} color="text-blue-600" />
                  <Row label="תשואות" value={`+${fmt(Math.round(selectedYear.yearReturns))}`} color="text-purple-600" />
                  <Row label="עמלות" value={`-${fmt(Math.round(selectedYear.yearFees))}`} color="text-red-500" />
                  <Row label="הוצאות ילדים" value={`-${fmt(Math.round(selectedYear.yearChildExpenses))}`} color="text-amber-600" />
                  <div className="border-t pt-2 mt-2">
                    <Row label="הון בסוף השנה" value={fmt(selectedYear.point.total_assets)} bold />
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <Row label="הכנסה חודשית" value={fmt(selectedYear.point.monthly_income)} />
                    <Row label="אינפלציה מצטברת" value={`${((selectedYear.point.inflation_factor - 1) * 100).toFixed(1)}%`} />
                    {showReal && <Row label="הון ריאלי" value={fmt(selectedYear.point.total_assets_real || selectedYear.point.total_assets)} color="text-purple-600" />}
                  </div>
                </div>
              )}
            </div>

            {/* Events */}
            <div className="card p-5">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">אירועים בשנת {selectedYear?.year}</h3>
              {selectedYear?.yearEvents.length ? (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {selectedYear.yearEvents.map((ev, i) => (
                    <div key={i} className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">{ev}</div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">אין אירועים מיוחדים</p>
              )}
            </div>
          </div>

          {/* Goals */}
          {results.goals_analysis.length > 0 && (
            <div className="card p-5">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">ניתוח יעדים</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.goals_analysis.map(g => (
                  <div key={g.goal_id} className={`p-4 rounded-xl ${g.is_achievable ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{g.goal_name}</h4>
                        <p className="text-xs text-gray-500">יעד: {fmt(g.target_amount)} | צפי: {fmt(g.projected_amount)}</p>
                      </div>
                      {g.is_achievable ? (
                        <span className="text-emerald-600 font-bold text-sm">✓ ניתן להשגה</span>
                      ) : (
                        <div className="text-left">
                          <span className="text-rose-600 font-bold text-sm">חסר {fmt(g.shortfall || 0)}</span>
                          {g.required_extra_monthly ? (
                            <p className="text-xs text-gray-500">+{fmt(g.required_extra_monthly)}/חודש</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scenarios */}
          {scenarios.length > 0 && (
            <div className="card p-5">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">תרחישים שמורים</h3>
              <div className="flex flex-wrap gap-2">
                {scenarios.map(s => (
                  <button
                    key={s.id}
                    onClick={() => loadScenario(s)}
                    className="px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-400 transition-all text-sm flex items-center gap-2"
                  >
                    {s.is_favorite && <BookmarkSolidIcon className="w-3 h-3 text-amber-500" />}
                    {s.name}
                    <button onClick={e => { e.stopPropagation(); deleteScenario(s.id); }} className="text-gray-400 hover:text-red-500 mr-1">×</button>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card p-16 text-center">
          <div className="text-7xl mb-6">📊</div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">סימולטור פיננסי משפחתי</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            חשבו על העתיד - ראו את צמיחת ההון, דפדפו בין שנים, בדקו תרחישים שונים
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={runSimulation} disabled={running} className="btn-primary text-lg px-8 py-3">
              <PlayIcon className="w-6 h-6 ml-2" />
              {running ? 'מחשב...' : 'הרץ סימולציה'}
            </button>
            <button onClick={() => setIsParamsOpen(true)} className="btn-secondary text-lg px-6 py-3">
              <AdjustmentsHorizontalIcon className="w-6 h-6 ml-2" />
              הגדרות
            </button>
          </div>
          {scenarios.length > 0 && (
            <div className="mt-8">
              <p className="text-sm text-gray-500 mb-3">או טען תרחיש שמור:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {scenarios.map(s => (
                  <button key={s.id} onClick={() => loadScenario(s)} className="px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border hover:border-primary-400 transition-all text-sm">
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Parameters Modal */}
      <Modal isOpen={isParamsOpen} onClose={() => setIsParamsOpen(false)} title="הגדרות סימולציה" size="lg">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">תאריך התחלה</label>
              <input type="date" value={params.start_date} onChange={e => setParams({ ...params, start_date: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">גיל פרישה</label>
              <NumberInput value={params.end_age || 67} onChange={v => setParams({ ...params, end_age: v })} min={30} max={120} className="input" />
            </div>
            <div>
              <label className="label">אינפלציה (%)</label>
              <NumberInput value={params.inflation_rate || 2.5} onChange={v => setParams({ ...params, inflation_rate: v })} min={0} max={20} allowDecimal className="input" />
            </div>
            <div>
              <label className="label">הפקדה נוספת חודשית (₪)</label>
              <NumberInput value={params.extra_monthly_deposit || 0} onChange={v => setParams({ ...params, extra_monthly_deposit: v })} min={0} className="input" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" checked={params.include_planned_children} onChange={e => setParams({ ...params, include_planned_children: e.target.checked })} className="w-4 h-4" />
            <label className="text-sm text-gray-700 dark:text-gray-300">כלול ילדים מתוכננים</label>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 dark:text-white">הוצאות שנתיות</h3>
              <button onClick={addYearlyExpense} className="text-primary-600 text-sm flex items-center gap-1">
                <PlusIcon className="w-4 h-4" />
                הוסף
              </button>
            </div>
            {!(params.yearly_expenses?.length) ? (
              <p className="text-sm text-gray-500 text-center py-3">טיולים, ביטוחים, הוצאות קבועות...</p>
            ) : (
              <div className="space-y-2">
                {params.yearly_expenses.map((exp, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <input type="text" value={exp.name} onChange={e => updateYearlyExpense(i, 'name', e.target.value)} className="input flex-1 text-sm" />
                    <div className="w-28">
                      <NumberInput value={exp.amount} onChange={v => updateYearlyExpense(i, 'amount', v)} min={0} className="input text-sm" />
                    </div>
                    <select value={exp.month || 7} onChange={e => updateYearlyExpense(i, 'month', Number(e.target.value))} className="input w-20 text-sm">
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                        <option key={m} value={m}>{['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'][m-1]}</option>
                      ))}
                    </select>
                    <button onClick={() => removeYearlyExpense(i)} className="p-1 text-gray-400 hover:text-red-500">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={() => { setIsParamsOpen(false); runSimulation(); }} className="btn-primary flex-1">הרץ סימולציה</button>
            <button onClick={() => setIsParamsOpen(false)} className="btn-secondary flex-1">סגור</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isSaveOpen} onClose={() => setIsSaveOpen(false)} title="שמור תרחיש">
        <div className="space-y-4">
          <div>
            <label className="label">שם התרחיש</label>
            <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} className="input" placeholder="תרחיש אופטימי" />
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

function StatCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-600',
    primary: 'text-primary-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    amber: 'text-amber-600',
  };
  return (
    <div className="card p-3 text-center">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${colorMap[color] || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? 'font-bold text-gray-900 dark:text-white' : 'font-medium'} ${color || ''}`}>{value}</span>
    </div>
  );
}
