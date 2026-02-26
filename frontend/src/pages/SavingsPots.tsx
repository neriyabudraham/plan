import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { SavingsPot, SavingsPotsSummary } from '../types';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';
import NumberInput from '../components/common/NumberInput';

const POT_ICONS = ['🎯', '✈️', '🎁', '🚗', '🏠', '📱', '💻', '🎓', '💍', '🏖️', '🎉', '💰'];
const POT_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];

export default function SavingsPots() {
  const [loading, setLoading] = useState(true);
  const [pots, setPots] = useState<SavingsPot[]>([]);
  const [summary, setSummary] = useState<SavingsPotsSummary | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [editingPot, setEditingPot] = useState<SavingsPot | null>(null);
  const [selectedPot, setSelectedPot] = useState<SavingsPot | null>(null);
  const [depositAmount, setDepositAmount] = useState(0);
  const [isWithdraw, setIsWithdraw] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    target_amount: 0,
    current_amount: 0,
    monthly_contribution: 0,
    target_date: '',
    icon: '🎯',
    color: '#8B5CF6',
  });
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const [potsRes, summaryRes] = await Promise.all([
        api.get<SavingsPot[]>('/savings-pots'),
        api.get<SavingsPotsSummary>('/savings-pots/stats/summary'),
      ]);
      setPots(potsRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const openAddModal = () => {
    setEditingPot(null);
    setForm({
      name: '',
      target_amount: 0,
      current_amount: 0,
      monthly_contribution: 0,
      target_date: '',
      icon: '🎯',
      color: '#8B5CF6',
    });
    setIsModalOpen(true);
  };
  
  const openEditModal = (pot: SavingsPot) => {
    setEditingPot(pot);
    setForm({
      name: pot.name,
      target_amount: pot.target_amount,
      current_amount: pot.current_amount,
      monthly_contribution: pot.monthly_contribution,
      target_date: pot.target_date?.split('T')[0] || '',
      icon: pot.icon,
      color: pot.color,
    });
    setIsModalOpen(true);
  };
  
  const openDepositModal = (pot: SavingsPot, withdraw = false) => {
    setSelectedPot(pot);
    setDepositAmount(0);
    setIsWithdraw(withdraw);
    setIsDepositModalOpen(true);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const data = {
        ...form,
        target_date: form.target_date || undefined,
      };
      
      if (editingPot) {
        await api.put(`/savings-pots/${editingPot.id}`, data);
        toast.success('הקופה עודכנה');
      } else {
        await api.post('/savings-pots', data);
        toast.success('הקופה נוצרה');
      }
      
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleDeposit = async () => {
    if (!selectedPot || depositAmount <= 0) return;
    
    try {
      if (isWithdraw) {
        await api.post(`/savings-pots/${selectedPot.id}/withdraw`, { amount: depositAmount });
        toast.success(`משכת ₪${depositAmount.toLocaleString()} מהקופה`);
      } else {
        await api.post(`/savings-pots/${selectedPot.id}/deposit`, { amount: depositAmount });
        toast.success(`הפקדת ₪${depositAmount.toLocaleString()} לקופה`);
      }
      
      setIsDepositModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק את הקופה?')) return;
    
    try {
      await api.delete(`/savings-pots/${id}`);
      toast.success('הקופה נמחקה');
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  if (loading) return <Loading />;
  
  const activePots = pots.filter(p => !p.is_completed);
  const completedPots = pots.filter(p => p.is_completed);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">קופות חיסכון</h1>
          <p className="text-gray-500 mt-1">חסכו ביחד למטרות קצרות טווח</p>
        </div>
        <button onClick={openAddModal} className="btn-primary">
          <PlusIcon className="w-5 h-5 ml-1" />
          קופה חדשה
        </button>
      </div>
      
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">קופות פעילות</p>
            <p className="text-2xl font-bold text-primary-600">{Number(summary.total_pots) - Number(summary.completed_pots)}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">סה"כ נחסך</p>
            <p className="text-2xl font-bold text-emerald-600">₪{Number(summary.total_saved).toLocaleString()}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">יעד כולל</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">₪{Number(summary.total_target).toLocaleString()}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">הפקדה חודשית</p>
            <p className="text-2xl font-bold text-blue-600">₪{Number(summary.total_monthly).toLocaleString()}</p>
          </div>
        </div>
      )}
      
      {/* Active Pots */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">קופות פעילות</h2>
        
        {activePots.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">אין קופות פעילות</h3>
            <p className="text-gray-500 mb-4">צרו קופה חדשה לחיסכון למטרה ספציפית</p>
            <button onClick={openAddModal} className="btn-primary">
              <PlusIcon className="w-5 h-5 ml-1" />
              צור קופה
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePots.map(pot => (
              <PotCard 
                key={pot.id} 
                pot={pot} 
                onEdit={openEditModal}
                onDelete={handleDelete}
                onDeposit={() => openDepositModal(pot)}
                onWithdraw={() => openDepositModal(pot, true)}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Completed Pots */}
      {completedPots.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
            קופות שהושלמו
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedPots.map(pot => (
              <PotCard 
                key={pot.id} 
                pot={pot} 
                onEdit={openEditModal}
                onDelete={handleDelete}
                onDeposit={() => openDepositModal(pot)}
                onWithdraw={() => openDepositModal(pot, true)}
                isCompleted
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPot ? 'עריכת קופה' : 'קופה חדשה'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">שם הקופה</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              className="input"
              placeholder="טיסה לחו״ל, מתנה, רכב חדש..."
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">סכום יעד (₪)</label>
              <NumberInput
                value={form.target_amount}
                onChange={v => setForm({...form, target_amount: v})}
                min={1}
                className="input"
              />
            </div>
            <div>
              <label className="label">סכום נוכחי (₪)</label>
              <NumberInput
                value={form.current_amount}
                onChange={v => setForm({...form, current_amount: v})}
                min={0}
                className="input"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">הפקדה חודשית (₪)</label>
              <NumberInput
                value={form.monthly_contribution}
                onChange={v => setForm({...form, monthly_contribution: v})}
                min={0}
                className="input"
              />
            </div>
            <div>
              <label className="label">תאריך יעד</label>
              <input
                type="date"
                value={form.target_date}
                onChange={e => setForm({...form, target_date: e.target.value})}
                className="input"
              />
            </div>
          </div>
          
          <div>
            <label className="label">אייקון</label>
            <div className="flex flex-wrap gap-2">
              {POT_ICONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm({...form, icon})}
                  className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                    form.icon === icon 
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' 
                      : 'border-gray-200 dark:border-gray-700'
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
              {POT_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({...form, color})}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${
                    form.color === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn-primary flex-1">
              {editingPot ? 'שמור' : 'צור קופה'}
            </button>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">
              ביטול
            </button>
          </div>
        </form>
      </Modal>
      
      {/* Deposit/Withdraw Modal */}
      <Modal 
        isOpen={isDepositModalOpen} 
        onClose={() => setIsDepositModalOpen(false)} 
        title={isWithdraw ? `משיכה מ${selectedPot?.name}` : `הפקדה ל${selectedPot?.name}`}
      >
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="text-4xl mb-2">{selectedPot?.icon}</div>
            <p className="text-gray-500">
              יתרה נוכחית: <span className="font-bold text-emerald-600">₪{selectedPot?.current_amount.toLocaleString()}</span>
            </p>
          </div>
          
          <div>
            <label className="label">סכום</label>
            <NumberInput
              value={depositAmount}
              onChange={setDepositAmount}
              min={1}
              max={isWithdraw ? selectedPot?.current_amount : undefined}
              className="input text-center text-2xl"
            />
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={handleDeposit} 
              disabled={depositAmount <= 0}
              className={`flex-1 ${isWithdraw ? 'btn-danger' : 'btn-primary'}`}
            >
              {isWithdraw ? (
                <>
                  <ArrowDownIcon className="w-5 h-5 ml-1" />
                  משוך
                </>
              ) : (
                <>
                  <ArrowUpIcon className="w-5 h-5 ml-1" />
                  הפקד
                </>
              )}
            </button>
            <button onClick={() => setIsDepositModalOpen(false)} className="btn-secondary flex-1">
              ביטול
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PotCard({ 
  pot, 
  onEdit, 
  onDelete, 
  onDeposit, 
  onWithdraw,
  isCompleted = false 
}: { 
  pot: SavingsPot; 
  onEdit: (pot: SavingsPot) => void;
  onDelete: (id: string) => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  isCompleted?: boolean;
}) {
  const progress = Number(pot.progress_percent) || 0;
  
  return (
    <div 
      className={`card p-4 ${isCompleted ? 'opacity-75' : ''}`}
      style={{ borderTopColor: pot.color, borderTopWidth: '4px' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{pot.icon}</span>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">{pot.name}</h3>
            {pot.target_date && (
              <p className="text-xs text-gray-500">
                יעד: {new Date(pot.target_date).toLocaleDateString('he-IL')}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(pot)}
            className="p-1 text-gray-400 hover:text-primary-600 rounded"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(pot.id)}
            className="p-1 text-gray-400 hover:text-red-600 rounded"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-500">₪{pot.current_amount.toLocaleString()}</span>
          <span className="text-gray-500">₪{pot.target_amount.toLocaleString()}</span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all"
            style={{ 
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: pot.color,
            }}
          />
        </div>
        <p className="text-center text-sm font-medium mt-1" style={{ color: pot.color }}>
          {progress.toFixed(0)}%
        </p>
      </div>
      
      {/* Info */}
      <div className="text-sm space-y-1 mb-3">
        {pot.monthly_contribution > 0 && (
          <p className="text-gray-500">
            הפקדה חודשית: <span className="font-medium">₪{pot.monthly_contribution.toLocaleString()}</span>
          </p>
        )}
        {pot.months_remaining && pot.months_remaining > 0 && (
          <p className="text-gray-500">
            נותרו: <span className="font-medium">{pot.months_remaining} חודשים</span>
          </p>
        )}
        {pot.required_monthly && pot.required_monthly > 0 && !isCompleted && (
          <p className="text-amber-600">
            נדרש: ₪{pot.required_monthly.toLocaleString()}/חודש
          </p>
        )}
      </div>
      
      {/* Actions */}
      {!isCompleted && (
        <div className="flex gap-2">
          <button onClick={onDeposit} className="btn-primary flex-1 text-sm py-2">
            <ArrowUpIcon className="w-4 h-4 ml-1" />
            הפקד
          </button>
          {pot.current_amount > 0 && (
            <button onClick={onWithdraw} className="btn-secondary flex-1 text-sm py-2">
              <ArrowDownIcon className="w-4 h-4 ml-1" />
              משוך
            </button>
          )}
        </div>
      )}
      
      {isCompleted && (
        <div className="flex items-center justify-center gap-2 text-emerald-600 py-2">
          <CheckCircleIcon className="w-5 h-5" />
          <span className="font-medium">הושלם!</span>
        </div>
      )}
    </div>
  );
}
