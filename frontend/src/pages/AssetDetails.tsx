import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRightIcon, PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { Asset, AssetTransaction, TransactionType, ASSET_TYPE_LABELS } from '../types';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  deposit: 'הפקדה',
  withdrawal: 'משיכה',
  interest: 'ריבית',
  fee: 'עמלה',
  adjustment: 'התאמה',
};

export default function AssetDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [transactions, setTransactions] = useState<AssetTransaction[]>([]);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [transactionForm, setTransactionForm] = useState({
    type: 'deposit' as TransactionType,
    amount: 0,
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });
  
  const [editForm, setEditForm] = useState({
    name: '',
    institution: '',
    expected_annual_return: 0,
    management_fee_percent: 0,
    management_fee_deposit_percent: 0,
    monthly_deposit: 0,
    employer_deposit: 0,
    notes: '',
  });
  
  useEffect(() => {
    if (id) fetchAsset();
  }, [id]);
  
  const fetchAsset = async () => {
    try {
      const res = await api.get<Asset>(`/assets/${id}`);
      setAsset(res.data);
      setTransactions(res.data.recent_transactions || []);
      setEditForm({
        name: res.data.name,
        institution: res.data.institution || '',
        expected_annual_return: res.data.expected_annual_return,
        management_fee_percent: res.data.management_fee_percent,
        management_fee_deposit_percent: res.data.management_fee_deposit_percent,
        monthly_deposit: res.data.monthly_deposit,
        employer_deposit: res.data.employer_deposit,
        notes: res.data.notes || '',
      });
    } catch (error) {
      toast.error(handleApiError(error));
      navigate('/assets');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/assets/${id}/transactions`, transactionForm);
      toast.success('תנועה נוספה');
      setIsTransactionModalOpen(false);
      fetchAsset();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('למחוק תנועה?')) return;
    try {
      await api.delete(`/assets/${id}/transactions/${transactionId}`);
      toast.success('נמחק');
      fetchAsset();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/assets/${id}`, editForm);
      toast.success('עודכן');
      setIsEditModalOpen(false);
      fetchAsset();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleDeleteAsset = async () => {
    if (!confirm('למחוק נכס?')) return;
    try {
      await api.delete(`/assets/${id}`);
      toast.success('נמחק');
      navigate('/assets');
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  if (loading) return <Loading />;
  if (!asset) return null;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/assets')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
          <ArrowRightIcon className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
              style={{ backgroundColor: `${asset.color}20` }}
            >
              {asset.icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{asset.name}</h1>
              <p className="text-gray-500">
                {ASSET_TYPE_LABELS[asset.asset_type]}
                {asset.institution && ` • ${asset.institution}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsEditModalOpen(true)} className="btn-secondary">
            <PencilIcon className="w-4 h-4 ml-1" />
            עריכה
          </button>
          <button onClick={handleDeleteAsset} className="btn-danger">
            <TrashIcon className="w-4 h-4 ml-1" />
            מחק
          </button>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">יתרה נוכחית</p>
          <p className="text-2xl font-bold" style={{ color: asset.color }}>
            ₪{Number(asset.current_balance).toLocaleString()}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">הפקדה חודשית</p>
          <p className="text-2xl font-bold text-emerald-600">
            +₪{(Number(asset.monthly_deposit) + Number(asset.employer_deposit)).toLocaleString()}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">תשואה שנתית</p>
          <p className="text-2xl font-bold text-primary-600">{asset.expected_annual_return}%</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">דמי ניהול</p>
          <p className="text-2xl font-bold text-rose-600">{asset.management_fee_percent}%</p>
        </div>
      </div>
      
      {/* Transactions */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">תנועות אחרונות</h2>
          <button
            onClick={() => {
              setTransactionForm({ type: 'deposit', amount: 0, description: '', transaction_date: new Date().toISOString().split('T')[0] });
              setIsTransactionModalOpen(true);
            }}
            className="btn-primary text-sm"
          >
            <PlusIcon className="w-4 h-4 ml-1" />
            תנועה חדשה
          </button>
        </div>
        
        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    t.type === 'deposit' || t.type === 'interest' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                  }`}>
                    {t.type === 'deposit' || t.type === 'interest' ? '↑' : '↓'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {TRANSACTION_TYPE_LABELS[t.type]}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(t.transaction_date).toLocaleDateString('he-IL')}
                      {t.description && ` • ${t.description}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-bold text-lg ${
                    t.type === 'deposit' || t.type === 'interest' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {t.type === 'deposit' || t.type === 'interest' ? '+' : '-'}₪{Number(t.amount).toLocaleString()}
                  </span>
                  <button onClick={() => handleDeleteTransaction(t.id)} className="p-2 hover:bg-red-50 rounded-lg">
                    <TrashIcon className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">אין תנועות</p>
        )}
      </div>
      
      {/* Add Transaction Modal */}
      <Modal isOpen={isTransactionModalOpen} onClose={() => setIsTransactionModalOpen(false)} title="תנועה חדשה">
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div>
            <label className="label">סוג</label>
            <select value={transactionForm.type} onChange={e => setTransactionForm({...transactionForm, type: e.target.value as TransactionType})} className="input">
              {Object.entries(TRANSACTION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">סכום (₪)</label>
            <input type="number" value={transactionForm.amount} onChange={e => setTransactionForm({...transactionForm, amount: Number(e.target.value)})} className="input" min="0" required />
          </div>
          <div>
            <label className="label">תאריך</label>
            <input type="date" value={transactionForm.transaction_date} onChange={e => setTransactionForm({...transactionForm, transaction_date: e.target.value})} className="input" />
          </div>
          <div>
            <label className="label">תיאור</label>
            <input type="text" value={transactionForm.description} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} className="input" />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1">הוסף</button>
            <button type="button" onClick={() => setIsTransactionModalOpen(false)} className="btn-secondary flex-1">ביטול</button>
          </div>
        </form>
      </Modal>
      
      {/* Edit Asset Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="עריכת נכס">
        <form onSubmit={handleUpdateAsset} className="space-y-4">
          <div>
            <label className="label">שם</label>
            <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="input" required />
          </div>
          <div>
            <label className="label">מוסד</label>
            <input type="text" value={editForm.institution} onChange={e => setEditForm({...editForm, institution: e.target.value})} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">הפקדה חודשית (₪)</label>
              <input type="number" value={editForm.monthly_deposit} onChange={e => setEditForm({...editForm, monthly_deposit: Number(e.target.value)})} className="input" min="0" />
            </div>
            <div>
              <label className="label">הפקדת מעסיק (₪)</label>
              <input type="number" value={editForm.employer_deposit} onChange={e => setEditForm({...editForm, employer_deposit: Number(e.target.value)})} className="input" min="0" />
            </div>
            <div>
              <label className="label">תשואה שנתית (%)</label>
              <input type="number" value={editForm.expected_annual_return} onChange={e => setEditForm({...editForm, expected_annual_return: Number(e.target.value)})} className="input" step="0.1" />
            </div>
            <div>
              <label className="label">דמי ניהול (%)</label>
              <input type="number" value={editForm.management_fee_percent} onChange={e => setEditForm({...editForm, management_fee_percent: Number(e.target.value)})} className="input" min="0" step="0.01" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1">שמור</button>
            <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn-secondary flex-1">ביטול</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
