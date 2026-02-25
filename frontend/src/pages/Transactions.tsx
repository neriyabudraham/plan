import { useEffect, useState } from 'react';
import { ArrowsRightLeftIcon, FunnelIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { Transaction, Fund } from '../types';
import { formatCurrency, formatDate, getTransactionTypeLabel } from '../utils/format';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedFund, setSelectedFund] = useState('');
  const limit = 20;
  
  useEffect(() => {
    fetchFunds();
  }, []);
  
  useEffect(() => {
    fetchTransactions();
  }, [page, selectedFund]);
  
  const fetchFunds = async () => {
    try {
      const response = await api.get<Fund[]>('/funds');
      setFunds(response.data);
    } catch (error) {
      console.error('Error fetching funds:', error);
    }
  };
  
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (selectedFund) {
        params.append('fund_id', selectedFund);
      }
      
      const response = await api.get<{ transactions: Transaction[]; total: number }>(
        `/transactions?${params}`
      );
      setTransactions(response.data.transactions);
      setTotal(response.data.total);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const totalPages = Math.ceil(total / limit);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          תנועות
        </h1>
        
        {/* Filter */}
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-5 h-5 text-gray-400" />
          <select
            value={selectedFund}
            onChange={(e) => {
              setSelectedFund(e.target.value);
              setPage(0);
            }}
            className="input py-2 w-auto"
          >
            <option value="">כל הקופות</option>
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.icon} {fund.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {loading ? (
        <Loading />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<ArrowsRightLeftIcon className="w-full h-full" />}
          title="אין תנועות"
          description={selectedFund ? 'אין תנועות בקופה זו' : 'אין תנועות עדיין'}
        />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      תאריך
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      קופה
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      סוג
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      תיאור
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      סכום
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatDate(transaction.transaction_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                            style={{ backgroundColor: (transaction.fund_color || '#6366F1') + '20' }}
                          >
                            {transaction.fund_icon}
                          </span>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {transaction.fund_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            transaction.type === 'deposit' || transaction.type === 'interest'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {getTransactionTypeLabel(transaction.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {transaction.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-left">
                        <span
                          className={`text-sm font-semibold ${
                            transaction.type === 'deposit' || transaction.type === 'interest'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {transaction.type === 'deposit' || transaction.type === 'interest' ? '+' : '-'}
                          {formatCurrency(transaction.amount, transaction.fund_currency)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                מציג {page * limit + 1}-{Math.min((page + 1) * limit, total)} מתוך {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="btn-secondary disabled:opacity-50"
                >
                  הקודם
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="btn-secondary disabled:opacity-50"
                >
                  הבא
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
