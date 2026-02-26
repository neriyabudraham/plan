import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { FinancialGoal, GoalsSummary, GoalType, Asset, FamilyMember, GOAL_TYPE_LABELS, GOAL_TYPE_ICONS } from '../types';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';
import NumberInput from '../components/common/NumberInput';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Goals() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<GoalsSummary | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    goal_type: 'custom' as GoalType,
    target_amount: 0,
    current_amount: 0,
    target_date: '',
    monthly_contribution: 0,
    priority: 5,
    linked_member_id: '',
    linked_asset_id: '',
    icon: '🎯',
    color: '#10B981',
    notes: '',
  });
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const [goalsRes, assetsRes, membersRes] = await Promise.all([
        api.get<GoalsSummary>('/goals/summary/all'),
        api.get<Asset[]>('/assets'),
        api.get<FamilyMember[]>('/family/members'),
      ]);
      setSummary(goalsRes.data);
      setAssets(assetsRes.data);
      setMembers(membersRes.data);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const openAddModal = (type?: GoalType) => {
    setEditingGoal(null);
    setForm({
      name: '',
      goal_type: type || 'custom',
      target_amount: 0,
      current_amount: 0,
      target_date: '',
      monthly_contribution: 0,
      priority: 5,
      linked_member_id: '',
      linked_asset_id: '',
      icon: type ? GOAL_TYPE_ICONS[type] : '🎯',
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      notes: '',
    });
    setIsModalOpen(true);
  };
  
  const openEditModal = (goal: FinancialGoal) => {
    setEditingGoal(goal);
    setForm({
      name: goal.name,
      goal_type: goal.goal_type,
      target_amount: goal.target_amount,
      current_amount: goal.current_amount,
      target_date: goal.target_date?.split('T')[0] || '',
      monthly_contribution: goal.monthly_contribution,
      priority: goal.priority,
      linked_member_id: goal.linked_member_id || '',
      linked_asset_id: goal.linked_asset_id || '',
      icon: goal.icon,
      color: goal.color,
      notes: goal.notes || '',
    });
    setIsModalOpen(true);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        target_date: form.target_date || undefined,
        linked_member_id: form.linked_member_id || undefined,
        linked_asset_id: form.linked_asset_id || undefined,
      };
      
      if (editingGoal) {
        await api.put(`/goals/${editingGoal.id}`, data);
        toast.success('עודכן');
      } else {
        await api.post('/goals', data);
        toast.success('נוסף');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm('למחוק?')) return;
    try {
      await api.delete(`/goals/${id}`);
      toast.success('נמחק');
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleAchieve = async (id: string) => {
    try {
      await api.post(`/goals/${id}/achieve`);
      toast.success('🎉 מזל טוב! היעד הושג!');
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  if (loading) return <Loading />;
  
  const activeGoals = summary?.goals.filter(g => !g.is_achieved) || [];
  const achievedGoals = summary?.goals.filter(g => g.is_achieved) || [];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">יעדים פיננסיים</h1>
          <p className="text-gray-500 mt-1">הגדר יעדים ועקוב אחר ההתקדמות</p>
        </div>
        <button onClick={() => openAddModal()} className="btn-primary">
          <PlusIcon className="w-5 h-5 ml-1" />
          יעד חדש
        </button>
      </div>
      
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
          <p className="text-sm text-gray-600">התקדמות כוללת</p>
          <p className="text-3xl font-bold text-emerald-600">{summary?.overall_progress || 0}%</p>
          <div className="mt-2 h-2 bg-emerald-200 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${summary?.overall_progress || 0}%` }} />
          </div>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-600">יעדים פעילים</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{activeGoals.length}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-600">יעדים שהושגו</p>
          <p className="text-3xl font-bold text-primary-600">{achievedGoals.length}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-600">סכום יעד כולל</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            ₪{(summary?.total_target || 0).toLocaleString()}
          </p>
        </div>
      </div>
      
      {/* Active Goals */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">יעדים פעילים</h2>
        
        {activeGoals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onAchieve={handleAchieve}
              />
            ))}
          </div>
        ) : (
          <div className="card p-8 md:p-12 text-center flex flex-col items-center">
            <div className="text-6xl mb-4 opacity-50">🎯</div>
            <p className="text-gray-500 mb-4">אין יעדים עדיין</p>
            <button onClick={() => openAddModal()} className="btn-primary">
              <PlusIcon className="w-5 h-5 ml-1" />
              הוסף יעד
            </button>
          </div>
        )}
      </div>
      
      {/* Achieved Goals */}
      {achievedGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CheckCircleSolidIcon className="w-6 h-6 text-emerald-500" />
            יעדים שהושגו
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievedGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={openEditModal}
                onDelete={handleDelete}
                isAchieved
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingGoal ? 'עריכת יעד' : 'יעד חדש'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">שם היעד</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input" required />
            </div>
            
            <div>
              <label className="label">סוג</label>
              <select value={form.goal_type} onChange={e => setForm({...form, goal_type: e.target.value as GoalType, icon: GOAL_TYPE_ICONS[e.target.value as GoalType]})} className="input">
                {Object.entries(GOAL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            
            <div>
              <label className="label">עדיפות (1-10)</label>
              <NumberInput value={form.priority} onChange={v => setForm({...form, priority: v})} min={1} max={10} className="input" />
            </div>
            
            <div>
              <label className="label">סכום יעד (₪)</label>
              <NumberInput value={form.target_amount} onChange={v => setForm({...form, target_amount: v})} min={0} className="input" />
            </div>
            
            <div>
              <label className="label">סכום נוכחי (₪)</label>
              <NumberInput value={form.current_amount} onChange={v => setForm({...form, current_amount: v})} min={0} className="input" />
            </div>
            
            <div>
              <label className="label">תאריך יעד</label>
              <input type="date" value={form.target_date} onChange={e => setForm({...form, target_date: e.target.value})} className="input" />
            </div>
            
            <div>
              <label className="label">הפקדה חודשית (₪)</label>
              <NumberInput value={form.monthly_contribution} onChange={v => setForm({...form, monthly_contribution: v})} min={0} className="input" />
            </div>
            
            <div>
              <label className="label">משויך לבן משפחה</label>
              <select value={form.linked_member_id} onChange={e => setForm({...form, linked_member_id: e.target.value})} className="input">
                <option value="">לא משויך</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="label">משויך לנכס</label>
              <select value={form.linked_asset_id} onChange={e => setForm({...form, linked_asset_id: e.target.value})} className="input">
                <option value="">לא משויך</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="label">צבע</label>
              <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="input h-10" />
            </div>
          </div>
          
          <div>
            <label className="label">הערות</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input" rows={2} />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn-primary flex-1">{editingGoal ? 'שמור' : 'צור'}</button>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">ביטול</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onAchieve,
  isAchieved = false,
}: {
  goal: FinancialGoal;
  onEdit: (g: FinancialGoal) => void;
  onDelete: (id: string) => void;
  onAchieve?: (id: string) => void;
  isAchieved?: boolean;
}) {
  const progress = goal.progress_percent || 0;
  
  return (
    <div className={`card p-5 ${isAchieved ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${goal.color}20` }}
          >
            {goal.icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
            <p className="text-sm text-gray-500">{GOAL_TYPE_LABELS[goal.goal_type]}</p>
          </div>
        </div>
        <div className="flex gap-1">
          {!isAchieved && onAchieve && progress >= 100 && (
            <button onClick={() => onAchieve(goal.id)} className="p-2 hover:bg-emerald-50 rounded-lg" title="סמן כהושג">
              <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
            </button>
          )}
          <button onClick={() => onEdit(goal)} className="p-2 hover:bg-gray-100 rounded-lg">
            <PencilIcon className="w-4 h-4 text-gray-400" />
          </button>
          <button onClick={() => onDelete(goal.id)} className="p-2 hover:bg-red-50 rounded-lg">
            <TrashIcon className="w-4 h-4 text-gray-400 hover:text-red-500" />
          </button>
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">התקדמות</span>
            <span className="font-medium" style={{ color: goal.color }}>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: goal.color }}
            />
          </div>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">₪{Number(goal.current_amount).toLocaleString()}</span>
          <span className="font-medium">₪{Number(goal.target_amount).toLocaleString()}</span>
        </div>
        
        {goal.target_date && (
          <div className="text-sm text-gray-500">
            יעד: {new Date(goal.target_date).toLocaleDateString('he-IL')}
            {goal.months_remaining !== undefined && goal.months_remaining > 0 && (
              <span> ({goal.months_remaining} חודשים)</span>
            )}
          </div>
        )}
        
        {goal.required_monthly !== undefined && goal.required_monthly > 0 && !isAchieved && (
          <div className="text-sm text-primary-600 font-medium">
            נדרש: ₪{goal.required_monthly.toLocaleString()}/חודש
          </div>
        )}
      </div>
    </div>
  );
}
