import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, UserIcon, HeartIcon, SparklesIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { FamilyMember, FamilySummary, FamilySettings, FamilyMemberType, GenderType, GENDER_LABELS, IncomeRecord } from '../types';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';

export default function Family() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FamilySummary | null>(null);
  const [settings, setSettings] = useState<FamilySettings | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Income history state
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [selectedMemberForIncome, setSelectedMemberForIncome] = useState<FamilyMember | null>(null);
  const [incomeHistory, setIncomeHistory] = useState<IncomeRecord[]>([]);
  const [loadingIncome, setLoadingIncome] = useState(false);
  const [incomeForm, setIncomeForm] = useState({
    amount: 0,
    effective_date: new Date().toISOString().split('T')[0],
    description: '',
  });
  
  const [form, setForm] = useState({
    member_type: 'child' as FamilyMemberType,
    name: '',
    gender: '' as GenderType | '',
    birth_date: '',
    expected_birth_date: '',
    notes: '',
  });
  
  const [settingsForm, setSettingsForm] = useState({
    family_name: '',
    default_currency: 'ILS',
    inflation_rate: 2.5,
  });
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const [summaryRes, settingsRes] = await Promise.all([
        api.get<FamilySummary>('/family/summary'),
        api.get<FamilySettings>('/family/settings'),
      ]);
      setSummary(summaryRes.data);
      setSettings(settingsRes.data);
      setSettingsForm({
        family_name: settingsRes.data.family_name || '',
        default_currency: settingsRes.data.default_currency,
        inflation_rate: settingsRes.data.inflation_rate,
      });
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const openAddModal = (type: FamilyMemberType) => {
    setEditingMember(null);
    setForm({
      member_type: type,
      name: '',
      gender: '',
      birth_date: '',
      expected_birth_date: '',
      notes: '',
    });
    setIsModalOpen(true);
  };
  
  const openEditModal = (member: FamilyMember) => {
    setEditingMember(member);
    setForm({
      member_type: member.member_type,
      name: member.name,
      gender: member.gender || '',
      birth_date: member.birth_date?.split('T')[0] || '',
      expected_birth_date: member.expected_birth_date?.split('T')[0] || '',
      notes: member.notes || '',
    });
    setIsModalOpen(true);
  };
  
  // Income management
  const openIncomeModal = async (member: FamilyMember) => {
    setSelectedMemberForIncome(member);
    setIsIncomeModalOpen(true);
    setLoadingIncome(true);
    setIncomeForm({
      amount: 0,
      effective_date: new Date().toISOString().split('T')[0],
      description: '',
    });
    
    try {
      const res = await api.get<IncomeRecord[]>(`/family/members/${member.id}/income`);
      setIncomeHistory(res.data);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoadingIncome(false);
    }
  };
  
  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForIncome) return;
    
    try {
      await api.post(`/family/members/${selectedMemberForIncome.id}/income`, incomeForm);
      toast.success('הכנסה נוספה בהצלחה');
      
      // Refresh income history
      const res = await api.get<IncomeRecord[]>(`/family/members/${selectedMemberForIncome.id}/income`);
      setIncomeHistory(res.data);
      
      // Reset form
      setIncomeForm({
        amount: 0,
        effective_date: new Date().toISOString().split('T')[0],
        description: '',
      });
      
      // Refresh main data to update summary
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleDeleteIncome = async (incomeId: string) => {
    if (!confirm('האם למחוק רשומה זו?')) return;
    
    try {
      await api.delete(`/family/income/${incomeId}`);
      toast.success('נמחק בהצלחה');
      
      // Refresh
      if (selectedMemberForIncome) {
        const res = await api.get<IncomeRecord[]>(`/family/members/${selectedMemberForIncome.id}/income`);
        setIncomeHistory(res.data);
      }
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const data = {
        ...form,
        gender: form.gender || undefined,
        birth_date: form.birth_date || undefined,
        expected_birth_date: form.expected_birth_date || undefined,
      };
      
      if (editingMember) {
        await api.put(`/family/members/${editingMember.id}`, data);
        toast.success('עודכן בהצלחה');
      } else {
        await api.post('/family/members', data);
        toast.success('נוסף בהצלחה');
      }
      
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק?')) return;
    
    try {
      await api.delete(`/family/members/${id}`);
      toast.success('נמחק בהצלחה');
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await api.put('/family/settings', settingsForm);
      toast.success('ההגדרות נשמרו');
      setIsSettingsOpen(false);
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  if (loading) return <Loading />;
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {settings?.family_name || 'המשפחה שלי'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            ניהול בני המשפחה והכנסות
          </p>
        </div>
        <button onClick={() => setIsSettingsOpen(true)} className="btn-secondary">
          הגדרות משפחה
        </button>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
          <div className="text-4xl mb-2">👥</div>
          <p className="text-sm text-gray-600 dark:text-gray-400">סה"כ בני משפחה</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.totalMembers || 0}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20">
          <div className="text-4xl mb-2">👶</div>
          <p className="text-sm text-gray-600 dark:text-gray-400">ילדים</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.childrenCount || 0}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20">
          <div className="text-4xl mb-2">✨</div>
          <p className="text-sm text-gray-600 dark:text-gray-400">ילדים מתוכננים</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.plannedChildrenCount || 0}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
          <div className="text-4xl mb-2">💵</div>
          <p className="text-sm text-gray-600 dark:text-gray-400">הכנסה חודשית</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ₪{(summary?.totalMonthlyIncome || 0).toLocaleString()}
          </p>
        </div>
      </div>
      
      {/* Adults */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Self */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UserIcon className="w-6 h-6 text-blue-500" />
              אני
            </h2>
            {!summary?.self && (
              <button onClick={() => openAddModal('self')} className="btn-primary text-sm">
                <PlusIcon className="w-4 h-4 ml-1" />
                הוסף
              </button>
            )}
          </div>
          
          {summary?.self ? (
            <MemberCard 
              member={summary.self} 
              onEdit={openEditModal} 
              onDelete={handleDelete}
              onManageIncome={openIncomeModal}
              showIncomeButton={true}
            />
          ) : (
            <p className="text-gray-500 text-center py-8">לא הוגדר עדיין</p>
          )}
        </div>
        
        {/* Spouse */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <HeartIcon className="w-6 h-6 text-pink-500" />
              בן/בת זוג
            </h2>
            {!summary?.spouse && (
              <button onClick={() => openAddModal('spouse')} className="btn-primary text-sm">
                <PlusIcon className="w-4 h-4 ml-1" />
                הוסף
              </button>
            )}
          </div>
          
          {summary?.spouse ? (
            <MemberCard 
              member={summary.spouse} 
              onEdit={openEditModal} 
              onDelete={handleDelete}
              onManageIncome={openIncomeModal}
              showIncomeButton={true}
            />
          ) : (
            <p className="text-gray-500 text-center py-8">לא הוגדר עדיין</p>
          )}
        </div>
      </div>
      
      {/* Children */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">👶 ילדים</h2>
          <button onClick={() => openAddModal('child')} className="btn-primary">
            <PlusIcon className="w-5 h-5 ml-1" />
            הוסף ילד/ה
          </button>
        </div>
        
        {summary?.children && summary.children.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.children.map(child => (
              <MemberCard key={child.id} member={child} onEdit={openEditModal} onDelete={handleDelete} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">אין ילדים עדיין</p>
        )}
      </div>
      
      {/* Planned Children */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-purple-500" />
            ילדים מתוכננים
          </h2>
          <button onClick={() => openAddModal('planned_child')} className="btn-primary">
            <PlusIcon className="w-5 h-5 ml-1" />
            הוסף ילד/ה מתוכנן/ת
          </button>
        </div>
        
        {summary?.plannedChildren && summary.plannedChildren.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.plannedChildren.map(child => (
              <MemberCard key={child.id} member={child} onEdit={openEditModal} onDelete={handleDelete} isPlanned />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">אין ילדים מתוכננים</p>
        )}
      </div>
      
      {/* Add/Edit Member Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingMember ? 'עריכה' : 'הוספת בן משפחה'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">שם</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              className="input"
              required
            />
          </div>
          
          <div>
            <label className="label">מגדר</label>
            <select
              value={form.gender}
              onChange={e => setForm({...form, gender: e.target.value as GenderType})}
              className="input"
            >
              <option value="">בחר</option>
              {Object.entries(GENDER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          
          {form.member_type !== 'planned_child' ? (
            <div>
              <label className="label">תאריך לידה</label>
              <input
                type="date"
                value={form.birth_date}
                onChange={e => setForm({...form, birth_date: e.target.value})}
                className="input"
              />
            </div>
          ) : (
            <div>
              <label className="label">תאריך לידה משוער</label>
              <input
                type="date"
                value={form.expected_birth_date}
                onChange={e => setForm({...form, expected_birth_date: e.target.value})}
                className="input"
              />
            </div>
          )}
          
          <div>
            <label className="label">הערות</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              className="input"
              rows={3}
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn-primary flex-1">
              {editingMember ? 'שמור' : 'הוסף'}
            </button>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">
              ביטול
            </button>
          </div>
        </form>
      </Modal>
      
      {/* Settings Modal */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="הגדרות משפחה">
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <label className="label">שם המשפחה</label>
            <input
              type="text"
              value={settingsForm.family_name}
              onChange={e => setSettingsForm({...settingsForm, family_name: e.target.value})}
              className="input"
              placeholder="משפחת כהן"
            />
          </div>
          
          <div>
            <label className="label">מטבע ברירת מחדל</label>
            <select
              value={settingsForm.default_currency}
              onChange={e => setSettingsForm({...settingsForm, default_currency: e.target.value})}
              className="input"
            >
              <option value="ILS">שקל (₪)</option>
              <option value="USD">דולר ($)</option>
              <option value="EUR">יורו (€)</option>
            </select>
          </div>
          
          <div>
            <label className="label">אינפלציה שנתית צפויה (%)</label>
            <input
              type="number"
              value={settingsForm.inflation_rate}
              onChange={e => setSettingsForm({...settingsForm, inflation_rate: Number(e.target.value)})}
              className="input"
              min="0"
              max="20"
              step="0.1"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn-primary flex-1">שמור</button>
            <button type="button" onClick={() => setIsSettingsOpen(false)} className="btn-secondary flex-1">
              ביטול
            </button>
          </div>
        </form>
      </Modal>
      
      {/* Income History Modal */}
      <Modal 
        isOpen={isIncomeModalOpen} 
        onClose={() => setIsIncomeModalOpen(false)} 
        title={`היסטוריית הכנסות - ${selectedMemberForIncome?.name || ''}`}
      >
        <div className="space-y-6">
          {/* Add new income form */}
          <form onSubmit={handleAddIncome} className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">הוספת הכנסה חדשה</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">סכום חודשי</label>
                <input
                  type="number"
                  value={incomeForm.amount}
                  onChange={e => setIncomeForm({...incomeForm, amount: Number(e.target.value)})}
                  className="input"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="label">תאריך תחילה</label>
                <input
                  type="date"
                  value={incomeForm.effective_date}
                  onChange={e => setIncomeForm({...incomeForm, effective_date: e.target.value})}
                  className="input"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="label">תיאור (אופציונלי)</label>
              <input
                type="text"
                value={incomeForm.description}
                onChange={e => setIncomeForm({...incomeForm, description: e.target.value})}
                className="input"
                placeholder="לדוגמה: העלאת שכר, מעבר למשרה חדשה..."
              />
            </div>
            
            <button type="submit" className="btn-primary w-full">
              <PlusIcon className="w-5 h-5 ml-1" />
              הוסף
            </button>
          </form>
          
          {/* Income history list */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">היסטוריה</h3>
            
            {loadingIncome ? (
              <div className="text-center py-4">
                <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : incomeHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-4">אין היסטוריית הכנסות</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {incomeHistory.map((income, index) => (
                  <div 
                    key={income.id} 
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index === 0 
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-300 dark:border-emerald-700' 
                        : 'bg-gray-100 dark:bg-gray-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                          ₪{Number(income.amount).toLocaleString()}
                        </span>
                        {index === 0 && (
                          <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                            נוכחי
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        מתאריך: {new Date(income.effective_date).toLocaleDateString('he-IL')}
                      </p>
                      {income.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300">{income.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteIncome(income.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MemberCard({ 
  member, 
  onEdit, 
  onDelete,
  onManageIncome,
  isPlanned = false,
  showIncomeButton = false,
}: { 
  member: FamilyMember; 
  onEdit: (m: FamilyMember) => void; 
  onDelete: (id: string) => void;
  onManageIncome?: (m: FamilyMember) => void;
  isPlanned?: boolean;
  showIncomeButton?: boolean;
}) {
  const getAge = () => {
    if (member.age_years !== undefined && member.age_years !== null) {
      if (member.age_years === 0 && member.age_months !== undefined) {
        return `${member.age_months} חודשים`;
      }
      return `${member.age_years} שנים`;
    }
    return null;
  };
  
  return (
    <div className={`p-4 rounded-xl border ${isPlanned ? 'border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-900/20' : 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">{member.name}</h3>
          {getAge() && (
            <p className="text-sm text-gray-500 dark:text-gray-400">גיל: {getAge()}</p>
          )}
          {isPlanned && member.expected_birth_date && (
            <p className="text-sm text-purple-600 dark:text-purple-400">
              צפוי/ה: {new Date(member.expected_birth_date).toLocaleDateString('he-IL')}
            </p>
          )}
          {member.gender && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{GENDER_LABELS[member.gender]}</p>
          )}
          {member.monthly_income !== undefined && member.monthly_income > 0 && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              הכנסה נוכחית: ₪{member.monthly_income.toLocaleString()}
            </p>
          )}
          
          {/* Income management button */}
          {showIncomeButton && onManageIncome && (
            <button
              onClick={() => onManageIncome(member)}
              className="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
            >
              <BanknotesIcon className="w-4 h-4" />
              ניהול הכנסות
            </button>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(member)}
            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(member.id)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
