import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { Fund } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';

const ICONS = ['💰', '🏠', '🚗', '✈️', '🎓', '👶', '💍', '🏥', '📱', '🎁', '🛡️', '📈'];
const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

export default function Funds() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const { user } = useAuthStore();
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: '💰',
    color: '#3B82F6',
    target_amount: 0,
    target_date: '',
    currency: 'ILS',
  });
  
  const canEdit = user?.role === 'admin' || user?.role === 'editor';
  
  useEffect(() => {
    fetchFunds();
  }, []);
  
  const fetchFunds = async () => {
    try {
      const response = await api.get<Fund[]>('/funds');
      setFunds(response.data);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const openModal = (fund?: Fund) => {
    if (fund) {
      setEditingFund(fund);
      setForm({
        name: fund.name,
        description: fund.description || '',
        icon: fund.icon,
        color: fund.color,
        target_amount: fund.target_amount,
        target_date: fund.target_date || '',
        currency: fund.currency,
      });
    } else {
      setEditingFund(null);
      setForm({
        name: '',
        description: '',
        icon: '💰',
        color: '#3B82F6',
        target_amount: 0,
        target_date: '',
        currency: 'ILS',
      });
    }
    setShowModal(true);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (editingFund) {
        await api.patch(`/funds/${editingFund.id}`, form);
        toast.success('הקופה עודכנה');
      } else {
        await api.post('/funds', form);
        toast.success('הקופה נוצרה');
      }
      setShowModal(false);
      fetchFunds();
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setSaving(false);
    }
  };
  
  const handleDelete = async (fund: Fund) => {
    if (!confirm(`למחוק את הקופה "${fund.name}"?`)) return;
    
    try {
      await api.delete(`/funds/${fund.id}`);
      toast.success('הקופה נמחקה');
      fetchFunds();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  if (loading) {
    return <Loading />;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          קופות
        </h1>
        {canEdit && (
          <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-5 h-5" />
            קופה חדשה
          </button>
        )}
      </div>
      
      {funds.length === 0 ? (
        <EmptyState
          icon={<BanknotesIcon className="w-full h-full" />}
          title="אין קופות עדיין"
          description="צור קופה חדשה כדי להתחיל לעקוב אחרי החסכונות שלך"
          action={
            canEdit && (
              <button onClick={() => openModal()} className="btn-primary">
                צור קופה ראשונה
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {funds.map((fund) => (
            <Link
              key={fund.id}
              to={`/funds/${fund.id}`}
              className="card p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: fund.color + '20' }}
                  >
                    {fund.icon}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {fund.name}
                    </h3>
                    {fund.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                        {fund.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(fund.current_balance, fund.currency)}
                  </span>
                  {fund.target_amount > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      מתוך {formatCurrency(fund.target_amount, fund.currency)}
                    </span>
                  )}
                </div>
                
                {fund.target_amount > 0 && (
                  <>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${fund.progress_percent}%`,
                          backgroundColor: fund.color,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {fund.progress_percent}%
                      </span>
                      {fund.target_date && (
                        <span className="text-gray-500 dark:text-gray-400">
                          יעד: {formatDate(fund.target_date)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
      
      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingFund ? 'עריכת קופה' : 'קופה חדשה'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">שם הקופה</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              required
            />
          </div>
          
          <div>
            <label className="label">תיאור (אופציונלי)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
              rows={2}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">אייקון</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm({ ...form, icon })}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-colors ${
                      form.icon === icon
                        ? 'bg-primary-100 dark:bg-primary-900 ring-2 ring-primary-500'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="label">צבע</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={`w-10 h-10 rounded-lg transition-transform ${
                      form.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">סכום יעד</label>
              <input
                type="number"
                value={form.target_amount}
                onChange={(e) => setForm({ ...form, target_amount: Number(e.target.value) })}
                className="input"
                min={0}
              />
            </div>
            
            <div>
              <label className="label">מטבע</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="input"
              >
                <option value="ILS">₪ שקל</option>
                <option value="USD">$ דולר</option>
                <option value="EUR">€ יורו</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="label">תאריך יעד (אופציונלי)</label>
            <input
              type="date"
              value={form.target_date}
              onChange={(e) => setForm({ ...form, target_date: e.target.value })}
              className="input"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'שומר...' : editingFund ? 'עדכן' : 'צור קופה'}
            </button>
            {editingFund && (
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  handleDelete(editingFund);
                }}
                className="btn-danger"
              >
                מחק
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
