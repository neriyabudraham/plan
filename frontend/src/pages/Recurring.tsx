import { useEffect, useState } from 'react';
import { PlusIcon, CalendarDaysIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { RecurringDeposit, Fund } from '../types';
import { formatCurrency, formatDate, getFrequencyLabel } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';

const DAYS_OF_WEEK = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function Recurring() {
  const [recurring, setRecurring] = useState<RecurringDeposit[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringDeposit | null>(null);
  const { user } = useAuthStore();
  
  const [form, setForm] = useState({
    fund_id: '',
    amount: 0,
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    day_of_month: 1,
    day_of_week: 0,
  });
  
  const canEdit = user?.role === 'admin' || user?.role === 'editor';
  
  useEffect(() => {
    Promise.all([fetchRecurring(), fetchFunds()]);
  }, []);
  
  const fetchRecurring = async () => {
    try {
      const response = await api.get<RecurringDeposit[]>('/recurring');
      setRecurring(response.data);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const fetchFunds = async () => {
    try {
      const response = await api.get<Fund[]>('/funds');
      setFunds(response.data);
    } catch (error) {
      console.error('Error fetching funds:', error);
    }
  };
  
  const openModal = (item?: RecurringDeposit) => {
    if (item) {
      setEditingItem(item);
      setForm({
        fund_id: item.fund_id,
        amount: item.amount,
        frequency: item.frequency,
        day_of_month: item.day_of_month || 1,
        day_of_week: item.day_of_week || 0,
      });
    } else {
      setEditingItem(null);
      setForm({
        fund_id: funds[0]?.id || '',
        amount: 0,
        frequency: 'monthly',
        day_of_month: 1,
        day_of_week: 0,
      });
    }
    setShowModal(true);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const data = {
        ...form,
        day_of_month: form.frequency === 'monthly' ? form.day_of_month : undefined,
        day_of_week: form.frequency === 'weekly' ? form.day_of_week : undefined,
      };
      
      if (editingItem) {
        await api.patch(`/recurring/${editingItem.id}`, data);
        toast.success('ההפקדה החוזרת עודכנה');
      } else {
        await api.post('/recurring', data);
        toast.success('ההפקדה החוזרת נוצרה');
      }
      setShowModal(false);
      fetchRecurring();
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setSaving(false);
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm('למחוק את ההפקדה החוזרת?')) return;
    
    try {
      await api.delete(`/recurring/${id}`);
      toast.success('ההפקדה החוזרת נמחקה');
      fetchRecurring();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleToggle = async (item: RecurringDeposit) => {
    try {
      await api.patch(`/recurring/${item.id}`, { is_active: !item.is_active });
      toast.success(item.is_active ? 'ההפקדה הושהתה' : 'ההפקדה הופעלה');
      fetchRecurring();
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
          הפקדות חוזרות
        </h1>
        {canEdit && funds.length > 0 && (
          <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-5 h-5" />
            הפקדה חוזרת חדשה
          </button>
        )}
      </div>
      
      {recurring.length === 0 ? (
        <EmptyState
          icon={<CalendarDaysIcon className="w-full h-full" />}
          title="אין הפקדות חוזרות"
          description="הגדר הפקדות אוטומטיות שיתבצעו בזמנים קבועים"
          action={
            canEdit && funds.length > 0 && (
              <button onClick={() => openModal()} className="btn-primary">
                צור הפקדה חוזרת
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recurring.map((item) => (
            <div
              key={item.id}
              className={`card p-6 ${!item.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: (item.fund_color || '#6366F1') + '20' }}
                  >
                    {item.fund_icon}
                  </span>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {item.fund_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getFrequencyLabel(item.frequency)}
                    </p>
                  </div>
                </div>
                
                {canEdit && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openModal(item)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  +{formatCurrency(item.amount)}
                </div>
                
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {item.frequency === 'daily' && 'כל יום'}
                  {item.frequency === 'weekly' && `כל יום ${DAYS_OF_WEEK[item.day_of_week || 0]}`}
                  {item.frequency === 'monthly' && `בתאריך ${item.day_of_month} בכל חודש`}
                  {item.frequency === 'yearly' && 'פעם בשנה'}
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    הבא: {formatDate(item.next_run)}
                  </span>
                  
                  {canEdit && (
                    <button
                      onClick={() => handleToggle(item)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        item.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {item.is_active ? 'פעיל' : 'מושהה'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? 'עריכת הפקדה חוזרת' : 'הפקדה חוזרת חדשה'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">קופה</label>
            <select
              value={form.fund_id}
              onChange={(e) => setForm({ ...form, fund_id: e.target.value })}
              className="input"
              required
              disabled={!!editingItem}
            >
              <option value="">בחר קופה</option>
              {funds.map((fund) => (
                <option key={fund.id} value={fund.id}>
                  {fund.icon} {fund.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label">סכום</label>
            <input
              type="number"
              value={form.amount || ''}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              className="input"
              required
              min={1}
            />
          </div>
          
          <div>
            <label className="label">תדירות</label>
            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value as any })}
              className="input"
            >
              <option value="daily">יומי</option>
              <option value="weekly">שבועי</option>
              <option value="monthly">חודשי</option>
              <option value="yearly">שנתי</option>
            </select>
          </div>
          
          {form.frequency === 'weekly' && (
            <div>
              <label className="label">יום בשבוע</label>
              <select
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
                className="input"
              >
                {DAYS_OF_WEEK.map((day, index) => (
                  <option key={index} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {form.frequency === 'monthly' && (
            <div>
              <label className="label">יום בחודש</label>
              <input
                type="number"
                value={form.day_of_month}
                onChange={(e) => setForm({ ...form, day_of_month: Number(e.target.value) })}
                className="input"
                min={1}
                max={31}
              />
            </div>
          )}
          
          <button
            type="submit"
            disabled={saving || !form.fund_id || form.amount <= 0}
            className="btn-primary w-full"
          >
            {saving ? 'שומר...' : editingItem ? 'עדכן' : 'צור הפקדה חוזרת'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
