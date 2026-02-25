import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChartBarIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import api from '../services/api';
import { DashboardStats, HistoryPoint, DistributionItem, Transaction } from '../types';
import { formatCurrency, formatDate, getTransactionTypeLabel } from '../utils/format';
import Loading from '../components/common/Loading';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [distribution, setDistribution] = useState<DistributionItem[]>([]);
  const [activity, setActivity] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('12m');
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, historyRes, distRes, activityRes] = await Promise.all([
          api.get<DashboardStats>('/dashboard/stats'),
          api.get<HistoryPoint[]>(`/dashboard/history?period=${period}`),
          api.get<DistributionItem[]>('/dashboard/distribution'),
          api.get<Transaction[]>('/dashboard/activity'),
        ]);
        
        setStats(statsRes.data);
        setHistory(historyRes.data);
        setDistribution(distRes.data);
        setActivity(activityRes.data);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [period]);
  
  if (loading) {
    return <Loading />;
  }
  
  if (!stats) {
    return null;
  }
  
  const netChange = stats.monthlyDeposits - stats.monthlyWithdrawals;
  
  const statCards = [
    {
      title: 'סה"כ חסכונות',
      value: formatCurrency(stats.totalBalance),
      icon: BanknotesIcon,
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
      iconBg: 'bg-blue-500',
    },
    {
      title: 'הפקדות החודש',
      value: `+${formatCurrency(stats.monthlyDeposits)}`,
      icon: ArrowTrendingUpIcon,
      gradient: 'from-emerald-500 to-green-500',
      bgGradient: 'from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20',
      iconBg: 'bg-emerald-500',
      valueClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'משיכות החודש',
      value: `-${formatCurrency(stats.monthlyWithdrawals)}`,
      icon: ArrowTrendingDownIcon,
      gradient: 'from-rose-500 to-red-500',
      bgGradient: 'from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20',
      iconBg: 'bg-rose-500',
      valueClass: 'text-rose-600 dark:text-rose-400',
    },
    {
      title: 'שינוי נטו',
      value: `${netChange >= 0 ? '+' : ''}${formatCurrency(netChange)}`,
      icon: ChartBarIcon,
      gradient: netChange >= 0 ? 'from-emerald-500 to-green-500' : 'from-rose-500 to-red-500',
      bgGradient: netChange >= 0 
        ? 'from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20'
        : 'from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20',
      iconBg: netChange >= 0 ? 'bg-emerald-500' : 'bg-rose-500',
      valueClass: netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
    },
  ];
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            דשבורד
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            סקירה כללית של החסכונות שלך
          </p>
        </div>
        <Link to="/funds" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          קופה חדשה
        </Link>
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div
            key={index}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.bgGradient} p-6 border border-white/50 dark:border-gray-700/50 shadow-lg`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {card.title}
                </p>
                <p className={`text-2xl font-bold mt-2 ${card.valueClass || 'text-gray-900 dark:text-white'}`}>
                  {card.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${card.iconBg} shadow-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className={`absolute -bottom-4 -left-4 w-24 h-24 bg-gradient-to-br ${card.gradient} rounded-full opacity-10 blur-2xl`} />
          </div>
        ))}
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance history */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              היסטוריית יתרה
            </h2>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input py-2 px-4 w-auto text-sm"
            >
              <option value="7d">7 ימים</option>
              <option value="30d">30 ימים</option>
              <option value="6m">6 חודשים</option>
              <option value="12m">12 חודשים</option>
            </select>
          </div>
          
          <div className="h-72">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => formatDate(date).slice(0, 5)}
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}K`}
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'יתרה']}
                    labelFormatter={(date) => formatDate(date)}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      direction: 'rtl',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#0EA5E9"
                    strokeWidth={3}
                    fill="url(#colorBalance)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                אין נתונים להצגה
              </div>
            )}
          </div>
        </div>
        
        {/* Distribution */}
        <div className="card p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            חלוקה לפי קופה
          </h2>
          
          {distribution.length > 0 ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="balance"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {distribution.map((entry, index) => (
                        <Cell key={index} fill={entry.color} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        direction: 'rtl',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="space-y-3 mt-4">
                {distribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full shadow-sm"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {item.icon} {item.name}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(item.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">
              אין נתונים להצגה
            </div>
          )}
        </div>
      </div>
      
      {/* Funds progress & Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funds progress */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              התקדמות קופות
            </h2>
            <Link
              to="/funds"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              כל הקופות ←
            </Link>
          </div>
          
          {stats.fundsProgress.length > 0 ? (
            <div className="space-y-4">
              {stats.fundsProgress.slice(0, 5).map((fund) => (
                <Link
                  key={fund.id}
                  to={`/funds/${fund.id}`}
                  className="block p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{fund.icon}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {fund.name}
                      </span>
                    </div>
                    <span className="text-sm font-bold px-3 py-1 rounded-full bg-white dark:bg-gray-800 shadow-sm" style={{ color: fund.color }}>
                      {fund.progressPercent}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(fund.progressPercent, 100)}%`,
                        backgroundColor: fund.color,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {formatCurrency(fund.currentBalance, fund.currency)}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500">
                      מתוך {formatCurrency(fund.targetAmount, fund.currency)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BanknotesIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                אין קופות עדיין
              </p>
              <Link to="/funds" className="btn-primary">
                צור קופה ראשונה
              </Link>
            </div>
          )}
        </div>
        
        {/* Recent activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              פעילות אחרונה
            </h2>
            <Link
              to="/transactions"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              כל התנועות ←
            </Link>
          </div>
          
          {activity.length > 0 ? (
            <div className="space-y-3">
              {activity.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-sm"
                      style={{ backgroundColor: transaction.fund_color + '20' }}
                    >
                      {transaction.fund_icon}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {transaction.fund_name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {getTransactionTypeLabel(transaction.type)} • {formatDate(transaction.transaction_date)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-bold text-lg ${
                      transaction.type === 'deposit' || transaction.type === 'interest'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {transaction.type === 'deposit' || transaction.type === 'interest' ? '+' : '-'}
                    {formatCurrency(transaction.amount, transaction.fund_currency)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ArrowsRightLeftIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                אין פעילות עדיין
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ArrowsRightLeftIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);
