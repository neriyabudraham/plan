import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { Asset, AssetsSummary, FamilyMember, AssetType, ASSET_TYPE_LABELS, ASSET_TYPE_ICONS } from '../types';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';
import NumberInput from '../components/common/NumberInput';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export default function Assets() {
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<AssetsSummary | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<AssetType | ''>('');
  
  const [form, setForm] = useState({
    name: '',
    asset_type: 'savings' as AssetType,
    owner_id: '',
    linked_child_id: '',
    institution: '',
    current_balance: 0,
    expected_annual_return: 5,
    management_fee_percent: 0,
    management_fee_deposit_percent: 0,
    monthly_deposit: 0,
    employer_deposit: 0,
    icon: '💰',
    color: '#3B82F6',
    notes: '',
  });
  
  useEffect(() => {
    fetchData();
  }, [filterType]);
  
  const fetchData = async () => {
    try {
      const [assetsRes, summaryRes, membersRes] = await Promise.all([
        api.get<Asset[]>('/assets', { params: { type: filterType || undefined } }),
        api.get<AssetsSummary>('/assets/summary/all'),
        api.get<FamilyMember[]>('/family/members'),
      ]);
      setAssets(assetsRes.data);
      setSummary(summaryRes.data);
      setMembers(membersRes.data);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/assets', {
        ...form,
        owner_id: form.owner_id || undefined,
        linked_child_id: form.linked_child_id || undefined,
      });
      toast.success('נכס נוסף');
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const openAddModal = (type?: AssetType) => {
    setForm({
      name: '',
      asset_type: type || 'savings',
      owner_id: '',
      linked_child_id: '',
      institution: '',
      current_balance: 0,
      expected_annual_return: 5,
      management_fee_percent: 0,
      management_fee_deposit_percent: 0,
      monthly_deposit: 0,
      employer_deposit: 0,
      icon: type ? ASSET_TYPE_ICONS[type] : '💰',
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      notes: '',
    });
    setIsModalOpen(true);
  };
  
  if (loading) return <Loading />;
  
  const groupedAssets = assets.reduce((acc, asset) => {
    if (!acc[asset.asset_type]) acc[asset.asset_type] = [];
    acc[asset.asset_type].push(asset);
    return acc;
  }, {} as Record<AssetType, Asset[]>);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">נכסים והשקעות</h1>
          <p className="text-gray-500 mt-1">נהל את כל הנכסים הפיננסיים שלך במקום אחד</p>
        </div>
        <button onClick={() => openAddModal()} className="btn-primary">
          <PlusIcon className="w-5 h-5 ml-1" />
          נכס חדש
        </button>
      </div>
      
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
          <p className="text-sm text-gray-600 dark:text-gray-400">סה"כ נכסים</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            ₪{(summary?.totals?.total || 0).toLocaleString()}
          </p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
          <p className="text-sm text-gray-600 dark:text-gray-400">הפקדות חודשיות</p>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            +₪{(summary?.totals?.monthly_deposits || 0).toLocaleString()}
          </p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20">
          <p className="text-sm text-gray-600 dark:text-gray-400">מספר נכסים</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{assets.length}</p>
        </div>
      </div>
      
      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterType('')}
          className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
            !filterType ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
          }`}
        >
          הכל
        </button>
        {Object.entries(ASSET_TYPE_LABELS).map(([type, label]) => (
          <button
            key={type}
            onClick={() => setFilterType(type as AssetType)}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-2 ${
              filterType === type ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <span>{ASSET_TYPE_ICONS[type as AssetType]}</span>
            {label}
          </button>
        ))}
      </div>
      
      {/* Assets Grid */}
      {Object.entries(groupedAssets).map(([type, typeAssets]) => (
        <div key={type} className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">{ASSET_TYPE_ICONS[type as AssetType]}</span>
            {ASSET_TYPE_LABELS[type as AssetType]}
            <span className="text-sm font-normal text-gray-500">({typeAssets.length})</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {typeAssets.map(asset => (
              <Link
                key={asset.id}
                to={`/assets/${asset.id}`}
                className="card p-5 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${asset.color}20` }}
                    >
                      {asset.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{asset.name}</h3>
                      {asset.institution && (
                        <p className="text-sm text-gray-500">{asset.institution}</p>
                      )}
                    </div>
                  </div>
                  <ChevronLeftIcon className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">יתרה</span>
                    <span className="font-bold text-lg" style={{ color: asset.color }}>
                      ₪{Number(asset.current_balance).toLocaleString()}
                    </span>
                  </div>
                  {asset.monthly_deposit > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">הפקדה חודשית</span>
                      <span className="text-emerald-600">+₪{Number(asset.monthly_deposit).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">תשואה צפויה</span>
                    <span className="text-primary-600">{asset.expected_annual_return}%</span>
                  </div>
                  {asset.owner_name && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-xs text-gray-500">בעלות: {asset.owner_name}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
            
            {/* Add New Card */}
            <button
              onClick={() => openAddModal(type as AssetType)}
              className="card p-5 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-primary-400 transition-colors flex items-center justify-center min-h-[200px]"
            >
              <div className="text-center">
                <PlusIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-gray-500">הוסף {ASSET_TYPE_LABELS[type as AssetType]}</span>
              </div>
            </button>
          </div>
        </div>
      ))}
      
      {assets.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-6xl mb-4">💰</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">אין נכסים עדיין</h3>
          <p className="text-gray-500 mb-4">התחל להוסיף את הנכסים וההשקעות שלך</p>
          <button onClick={() => openAddModal()} className="btn-primary">
            <PlusIcon className="w-5 h-5 ml-1" />
            הוסף נכס ראשון
          </button>
        </div>
      )}
      
      {/* Add Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="נכס חדש" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">שם הנכס</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input" required />
            </div>
            
            <div>
              <label className="label">סוג</label>
              <select value={form.asset_type} onChange={e => setForm({...form, asset_type: e.target.value as AssetType, icon: ASSET_TYPE_ICONS[e.target.value as AssetType]})} className="input">
                {Object.entries(ASSET_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            
            <div>
              <label className="label">מוסד</label>
              <input type="text" value={form.institution} onChange={e => setForm({...form, institution: e.target.value})} className="input" placeholder="שם הבנק/חברה" />
            </div>
            
            <div>
              <label className="label">בעלות</label>
              <select value={form.owner_id} onChange={e => setForm({...form, owner_id: e.target.value})} className="input">
                <option value="">לא משויך</option>
                {members.filter(m => m.member_type === 'self' || m.member_type === 'spouse').map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            
            {(form.asset_type === 'child_savings') && (
              <div>
                <label className="label">משויך לילד</label>
                <select value={form.linked_child_id} onChange={e => setForm({...form, linked_child_id: e.target.value})} className="input">
                  <option value="">בחר ילד</option>
                  {members.filter(m => m.member_type === 'child' || m.member_type === 'planned_child').map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div>
              <label className="label">יתרה נוכחית (₪)</label>
              <NumberInput value={form.current_balance} onChange={v => setForm({...form, current_balance: v})} min={0} className="input" />
            </div>
            
            <div>
              <label className="label">הפקדה חודשית (₪)</label>
              <NumberInput value={form.monthly_deposit} onChange={v => setForm({...form, monthly_deposit: v})} min={0} className="input" />
            </div>
            
            {(form.asset_type === 'pension' || form.asset_type === 'study_fund') && (
              <div>
                <label className="label">הפקדת מעסיק (₪)</label>
                <NumberInput value={form.employer_deposit} onChange={v => setForm({...form, employer_deposit: v})} min={0} className="input" />
              </div>
            )}
            
            <div>
              <label className="label">תשואה שנתית צפויה (%)</label>
              <NumberInput value={form.expected_annual_return} onChange={v => setForm({...form, expected_annual_return: v})} allowDecimal className="input" />
            </div>
            
            <div>
              <label className="label">דמי ניהול מצבירה (%)</label>
              <NumberInput value={form.management_fee_percent} onChange={v => setForm({...form, management_fee_percent: v})} min={0} allowDecimal className="input" />
            </div>
            
            <div>
              <label className="label">דמי ניהול מהפקדה (%)</label>
              <NumberInput value={form.management_fee_deposit_percent} onChange={v => setForm({...form, management_fee_deposit_percent: v})} min={0} allowDecimal className="input" />
            </div>
            
            <div>
              <label className="label">צבע</label>
              <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="input h-10" />
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn-primary flex-1">הוסף</button>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">ביטול</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
