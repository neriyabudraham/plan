import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, DocumentDuplicateIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { ChildExpenseTemplate, ChildExpenseItem, ExpenseTriggerType, FrequencyType, TRIGGER_TYPE_LABELS, FREQUENCY_LABELS } from '../types';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';

export default function ChildTemplates() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ChildExpenseTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ChildExpenseTemplate | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChildExpenseItem | null>(null);
  
  const [templateForm, setTemplateForm] = useState({ name: '', description: '' });
  const [itemForm, setItemForm] = useState<{
    name: string;
    trigger_type: ExpenseTriggerType;
    trigger_value: number;
    trigger_value_end: number | undefined;
    amount: number;
    frequency: FrequencyType;
    notes: string;
  }>({
    name: '',
    trigger_type: 'age_years',
    trigger_value: 0,
    trigger_value_end: undefined,
    amount: 0,
    frequency: 'once',
    notes: '',
  });
  
  useEffect(() => {
    fetchTemplates();
  }, []);
  
  const fetchTemplates = async () => {
    try {
      const res = await api.get<ChildExpenseTemplate[]>('/child-templates');
      setTemplates(res.data);
      if (res.data.length > 0 && !selectedTemplate) {
        fetchTemplate(res.data[0].id);
      }
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const fetchTemplate = async (id: string) => {
    try {
      const res = await api.get<ChildExpenseTemplate>(`/child-templates/${id}`);
      setSelectedTemplate(res.data);
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleCreateDefault = async () => {
    try {
      const res = await api.post<ChildExpenseTemplate>('/child-templates/create-default');
      toast.success('תבנית ברירת מחדל נוצרה');
      fetchTemplates();
      setSelectedTemplate(res.data);
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/child-templates', templateForm);
      toast.success('תבנית נוצרה');
      setIsTemplateModalOpen(false);
      fetchTemplates();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('למחוק תבנית?')) return;
    try {
      await api.delete(`/child-templates/${id}`);
      toast.success('נמחק');
      if (selectedTemplate?.id === id) setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleDuplicate = async (id: string) => {
    try {
      const res = await api.post<ChildExpenseTemplate>(`/child-templates/${id}/duplicate`);
      toast.success('שוכפל');
      fetchTemplates();
      setSelectedTemplate(res.data);
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleSetDefault = async (id: string) => {
    try {
      await api.put(`/child-templates/${id}`, { is_default: true });
      toast.success('הוגדר כברירת מחדל');
      fetchTemplates();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({
      name: '',
      trigger_type: 'age_years',
      trigger_value: 0,
      trigger_value_end: undefined,
      amount: 0,
      frequency: 'once',
      notes: '',
    });
    setIsItemModalOpen(true);
  };
  
  const openEditItem = (item: ChildExpenseItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      trigger_type: item.trigger_type,
      trigger_value: Number(item.trigger_value) || 0,
      trigger_value_end: item.trigger_value_end != null ? Number(item.trigger_value_end) : undefined,
      amount: Number(item.amount) || 0,
      frequency: item.frequency,
      notes: item.notes || '',
    });
    setIsItemModalOpen(true);
  };
  
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    
    try {
      const data = {
        ...itemForm,
        trigger_value: Number(itemForm.trigger_value),
        trigger_value_end: itemForm.trigger_value_end != null ? Number(itemForm.trigger_value_end) : undefined,
        amount: Number(itemForm.amount),
        sort_order: 0,
      };
      if (editingItem) {
        await api.put(`/child-templates/${selectedTemplate.id}/items/${editingItem.id}`, data);
      } else {
        await api.post(`/child-templates/${selectedTemplate.id}/items`, data);
      }
      toast.success('נשמר');
      setIsItemModalOpen(false);
      fetchTemplate(selectedTemplate.id);
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleDeleteItem = async (itemId: string) => {
    if (!selectedTemplate || !confirm('למחוק?')) return;
    try {
      await api.delete(`/child-templates/${selectedTemplate.id}/items/${itemId}`);
      toast.success('נמחק');
      fetchTemplate(selectedTemplate.id);
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  if (loading) return <Loading />;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">תבניות עלויות ילד</h1>
          <p className="text-gray-500 mt-1">הגדר את העלויות הצפויות לכל שלב בחיי הילד</p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <button onClick={handleCreateDefault} className="btn-secondary">
              צור תבנית ברירת מחדל
            </button>
          )}
          <button onClick={() => { setTemplateForm({ name: '', description: '' }); setIsTemplateModalOpen(true); }} className="btn-primary">
            <PlusIcon className="w-5 h-5 ml-1" />
            תבנית חדשה
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Templates List */}
        <div className="space-y-2">
          {templates.map(t => (
            <div
              key={t.id}
              onClick={() => fetchTemplate(t.id)}
              className={`p-4 rounded-xl cursor-pointer transition-all ${
                selectedTemplate?.id === t.id
                  ? 'bg-primary-50 border-2 border-primary-500 dark:bg-primary-900/20'
                  : 'bg-white border border-gray-200 hover:border-primary-300 dark:bg-gray-800 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {t.is_default && <StarSolidIcon className="w-4 h-4 text-amber-500" />}
                  <span className="font-medium text-gray-900 dark:text-white">{t.name}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={e => { e.stopPropagation(); handleDuplicate(t.id); }} className="p-1 hover:bg-gray-100 rounded">
                    <DocumentDuplicateIcon className="w-4 h-4 text-gray-400" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDeleteTemplate(t.id); }} className="p-1 hover:bg-red-50 rounded">
                    <TrashIcon className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">{t.items_count || 0} פריטים</p>
              {t.estimated_total && (
                <p className="text-sm text-primary-600 font-medium">₪{Number(t.estimated_total).toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
        
        {/* Template Details */}
        <div className="lg:col-span-3">
          {selectedTemplate ? (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedTemplate.name}</h2>
                  {selectedTemplate.description && (
                    <p className="text-gray-500">{selectedTemplate.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!selectedTemplate.is_default && (
                    <button onClick={() => handleSetDefault(selectedTemplate.id)} className="btn-secondary text-sm">
                      <StarIcon className="w-4 h-4 ml-1" />
                      הגדר כברירת מחדל
                    </button>
                  )}
                  <button onClick={openAddItem} className="btn-primary text-sm">
                    <PlusIcon className="w-4 h-4 ml-1" />
                    הוסף פריט
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                {selectedTemplate.items?.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{item.name}</h3>
                      <p className="text-sm text-gray-500">
                        {TRIGGER_TYPE_LABELS[item.trigger_type]}: {item.trigger_value}
                        {item.trigger_value_end && ` - ${item.trigger_value_end}`}
                        {' • '}
                        {FREQUENCY_LABELS[item.frequency]}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-primary-600">₪{item.amount.toLocaleString()}</span>
                      <div className="flex gap-1">
                        <button onClick={() => openEditItem(item)} className="p-2 hover:bg-white rounded-lg">
                          <PencilIcon className="w-4 h-4 text-gray-400" />
                        </button>
                        <button onClick={() => handleDeleteItem(item.id)} className="p-2 hover:bg-red-50 rounded-lg">
                          <TrashIcon className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center">
              <p className="text-gray-500">בחר תבנית או צור חדשה</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Template Modal */}
      <Modal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} title="תבנית חדשה">
        <form onSubmit={handleCreateTemplate} className="space-y-4">
          <div>
            <label className="label">שם</label>
            <input type="text" value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} className="input" required />
          </div>
          <div>
            <label className="label">תיאור</label>
            <textarea value={templateForm.description} onChange={e => setTemplateForm({...templateForm, description: e.target.value})} className="input" rows={3} />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1">צור</button>
            <button type="button" onClick={() => setIsTemplateModalOpen(false)} className="btn-secondary flex-1">ביטול</button>
          </div>
        </form>
      </Modal>
      
      {/* Item Modal */}
      <Modal isOpen={isItemModalOpen} onClose={() => setIsItemModalOpen(false)} title={editingItem ? 'עריכת פריט' : 'פריט חדש'}>
        <form onSubmit={handleSaveItem} className="space-y-4">
          <div>
            <label className="label">שם</label>
            <input type="text" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="input" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">סוג טריגר</label>
              <select value={itemForm.trigger_type} onChange={e => setItemForm({...itemForm, trigger_type: e.target.value as any})} className="input">
                {Object.entries(TRIGGER_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">תדירות</label>
              <select value={itemForm.frequency} onChange={e => setItemForm({...itemForm, frequency: e.target.value as any})} className="input">
                {Object.entries(FREQUENCY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">מגיל</label>
              <input type="number" value={itemForm.trigger_value} onChange={e => setItemForm({...itemForm, trigger_value: Number(e.target.value)})} className="input" min="0" />
            </div>
            <div>
              <label className="label">עד גיל (אופציונלי)</label>
              <input type="number" value={itemForm.trigger_value_end || ''} onChange={e => setItemForm({...itemForm, trigger_value_end: e.target.value ? Number(e.target.value) : undefined})} className="input" min="0" />
            </div>
          </div>
          <div>
            <label className="label">סכום (₪)</label>
            <input type="number" value={itemForm.amount} onChange={e => setItemForm({...itemForm, amount: Number(e.target.value)})} className="input" min="0" required />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1">שמור</button>
            <button type="button" onClick={() => setIsItemModalOpen(false)} className="btn-secondary flex-1">ביטול</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
