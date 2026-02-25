import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { Fund, Transaction, HistoryPoint } from '../types';
import { formatCurrency, formatDate, getTransactionTypeLabel } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';

export default function FundDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [fund, setFund] = useState<Fund | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    amount: 0,
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });
  
  const canEdit = user?.role === 'admin' || user?.role === 'editor';
  
  useEffect(() => {
    fetchData();
  }, [id]);
  
  const fetchData = async () => {
    try {
      const [fundRes, transRes, historyRes] = await Promise.all([
        api.get<Fund>(`/funds/${id}`),
        api.get<{ transactions: Transaction[] }>(`/transactions?fund_id=${id}&limit=20`),
        api.get<HistoryPoint[]>(`/funds/${id}/history?period=12m`),
      ]);
      
      setFund(fundRes.data);
      setTransactions(transRes.data.transactions);
      setHistory(historyRes.data);
    } catch (error) {
      toast.error(handleApiError(error));
      navigate('/funds');
    } finally {
      setLoading(false);
    }
  };
  
  const openTransactionModal = (type: 'deposit' | 'withdrawal') => {
    setTransactionType(type);
    setForm({
      amount: 0,
      description: '',
      transaction_date: new Date().toISOString().split('T')[0],
    });
    setShowTransactionModal(true);
  };
  
  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await api.post('/transactions', {
        fund_id: id,
        type: transactionType,
        amount: form.amount,
        description: form.description,
        transaction_date: form.transaction_date,
      });
      
      toast.success(transactionType === 'deposit' ? 'ההפקדה בוצעה' : 'המשיכה בוצעה');
      setShowTransactionModal(false);
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setSaving(false);
    }
  };
  
  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('למחוק את התנועה?')) return;
    
    try {
      await api.delete(`/transactions/${transactionId}`);
      toast.success('התנועה נמחקה');
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  if (loading) {
    return <Loading />;
  }
  
  if (!fund) {
    return null;
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/funds')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: fund.color + '20' }}
            >
              {fund.icon}
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {fund.name}
              </h1>
              {fund.description && (
                <p className="text-gray-500 dark:text-gray-400">{fund.description}</p>
              )}
            </div>
          </div>
        </div>
        
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => openTransactionModal('deposit')}
              className="btn-primary flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              הפקדה
            </button>
            <button
              onClick={() => openTransactionModal('withdrawal')}
              className="btn-secondary flex items-center gap-2"
            >
              <MinusIcon className="w-5 h-5" />
              משיכה
            </button>
          </div>
        )}
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">יתרה נוכחית</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(fund.current_balance, fund.currency)}
          </p>
        </div>
        
        <div className="card p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">יעד</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {fund.target_amount > 0
              ? formatCurrency(fund.target_amount, fund.currency)
              : 'לא הוגדר'}
          </p>
        </div>
        
        <div className="card p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">התקדמות</p>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {fund.progress_percent}%
            </p>
            {fund.target_date && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                עד {formatDate(fund.target_date)}
              </p>
            )}
          </div>
          {fund.target_amount > 0 && (
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${fund.progress_percent}%`,
                  backgroundColor: fund.color,
                }}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Chart */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          היסטוריית יתרה
        </h2>
        <div className="h-64">
          {history.length > 0 ? (
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
                  formatter={(value: number) => [formatCurrency(value, fund.currency), 'יתרה']}
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
                  stroke={fund.color}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              אין מספיק נתונים להצגת גרף
            </div>
          )}
        </div>
      </div>
      
      {/* Transactions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          תנועות אחרונות
        </h2>
        
        {transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/30"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.type === 'deposit' || transaction.type === 'interest'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {transaction.type === 'deposit' || transaction.type === 'interest' ? (
                      <PlusIcon className="w-5 h-5" />
                    ) : (
                      <MinusIcon className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {getTransactionTypeLabel(transaction.type)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(transaction.transaction_date)}
                      {transaction.description && ` • ${transaction.description}`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span
                    className={`text-lg font-semibold ${
                      transaction.type === 'deposit' || transaction.type === 'interest'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {transaction.type === 'deposit' || transaction.type === 'interest' ? '+' : '-'}
                    {formatCurrency(transaction.amount, fund.currency)}
                  </span>
                  
                  {canEdit && (
                    <button
                      onClick={() => handleDeleteTransaction(transaction.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            אין תנועות עדיין
          </p>
        )}
      </div>
      
      {/* Transaction Modal */}
      <Modal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        title={transactionType === 'deposit' ? 'הפקדה חדשה' : 'משיכה'}
      >
        <form onSubmit={handleSubmitTransaction} className="space-y-4">
          <div>
            <label className="label">סכום</label>
            <input
              type="number"
              value={form.amount || ''}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              className="input text-xl"
              required
              min={1}
              autoFocus
            />
          </div>
          
          <div>
            <label className="label">תיאור (אופציונלי)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
              placeholder="למשל: משכורת, מתנה..."
            />
          </div>
          
          <div>
            <label className="label">תאריך</label>
            <input
              type="date"
              value={form.transaction_date}
              onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
              className="input"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={saving || form.amount <= 0}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              transactionType === 'deposit'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            } disabled:opacity-50`}
          >
            {saving
              ? 'שומר...'
              : transactionType === 'deposit'
              ? `הפקד ${form.amount > 0 ? formatCurrency(form.amount, fund.currency) : ''}`
              : `משוך ${form.amount > 0 ? formatCurrency(form.amount, fund.currency) : ''}`}
          </button>
        </form>
      </Modal>
    </div>
  );
}
