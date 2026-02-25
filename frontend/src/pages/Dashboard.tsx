import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          דשבורד
        </h1>
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
              <BanknotesIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">סה"כ חסכונות</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(stats.totalBalance)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <ArrowTrendingUpIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">הפקדות החודש</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                +{formatCurrency(stats.monthlyDeposits)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
              <ArrowTrendingDownIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">משיכות החודש</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                -{formatCurrency(stats.monthlyWithdrawals)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${netChange >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              <ChartBarIcon className={`w-6 h-6 ${netChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">שינוי נטו</p>
              <p className={`text-2xl font-bold ${netChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {netChange >= 0 ? '+' : ''}{formatCurrency(netChange)}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance history */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              היסטוריית יתרה
            </h2>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input py-1 px-3 w-auto"
            >
              <option value="7d">7 ימים</option>
              <option value="30d">30 ימים</option>
              <option value="6m">6 חודשים</option>
              <option value="12m">12 חודשים</option>
            </select>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => formatDate(date).slice(0, 5)}
                  stroke="#9CA3AF"
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}K`}
                  stroke="#9CA3AF"
                  fontSize={12}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'יתרה']}
                  labelFormatter={(date) => formatDate(date)}
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                    direction: 'rtl',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#6366F1"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Distribution */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
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
                      innerRadius={40}
                      outerRadius={70}
                    >
                      {distribution.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: 'none',
                        borderRadius: '8px',
                        direction: 'rtl',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="space-y-2 mt-4">
                {distribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-gray-600 dark:text-gray-400">
                        {item.icon} {item.name}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(item.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              אין נתונים להצגה
            </p>
          )}
        </div>
      </div>
      
      {/* Funds progress & Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funds progress */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              התקדמות קופות
            </h2>
            <Link
              to="/funds"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              כל הקופות
            </Link>
          </div>
          
          {stats.fundsProgress.length > 0 ? (
            <div className="space-y-4">
              {stats.fundsProgress.slice(0, 5).map((fund) => (
                <Link
                  key={fund.id}
                  to={`/funds/${fund.id}`}
                  className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{fund.icon}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {fund.name}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {fund.progressPercent}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${fund.progressPercent}%`,
                        backgroundColor: fund.color,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatCurrency(fund.currentBalance, fund.currency)}</span>
                    <span>{formatCurrency(fund.targetAmount, fund.currency)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              אין קופות עדיין
            </p>
          )}
        </div>
        
        {/* Recent activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              פעילות אחרונה
            </h2>
            <Link
              to="/transactions"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              כל התנועות
            </Link>
          </div>
          
          {activity.length > 0 ? (
            <div className="space-y-3">
              {activity.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                      style={{ backgroundColor: transaction.fund_color + '20' }}
                    >
                      {transaction.fund_icon}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {transaction.fund_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {getTransactionTypeLabel(transaction.type)} • {formatDate(transaction.transaction_date)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-semibold ${
                      transaction.type === 'deposit' || transaction.type === 'interest'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {transaction.type === 'deposit' || transaction.type === 'interest' ? '+' : '-'}
                    {formatCurrency(transaction.amount, transaction.fund_currency)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              אין פעילות עדיין
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
