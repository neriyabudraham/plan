import { useEffect, useState } from 'react';
import { ChatBubbleLeftRightIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { WhatsAppSettings, WhatsAppGroup } from '../types';
import Loading from '../components/common/Loading';

export default function Settings() {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  
  const [form, setForm] = useState({
    api_key: '',
    session: '',
    notification_target: '',
    notification_type: 'phone' as 'phone' | 'group',
    is_active: true,
    notify_on_deposit: true,
    notify_on_withdrawal: true,
    notify_on_target_reached: true,
    notify_on_milestone: true,
    notify_weekly_summary: false,
    notify_monthly_summary: true,
  });
  
  useEffect(() => {
    fetchSettings();
  }, []);
  
  const fetchSettings = async () => {
    try {
      const response = await api.get<WhatsAppSettings | null>('/whatsapp/settings');
      if (response.data) {
        setSettings(response.data);
        setForm({
          api_key: '', // Don't show masked key
          session: response.data.session,
          notification_target: response.data.notification_target,
          notification_type: response.data.notification_type,
          is_active: response.data.is_active,
          notify_on_deposit: response.data.notify_on_deposit,
          notify_on_withdrawal: response.data.notify_on_withdrawal,
          notify_on_target_reached: response.data.notify_on_target_reached,
          notify_on_milestone: response.data.notify_on_milestone,
          notify_weekly_summary: response.data.notify_weekly_summary,
          notify_monthly_summary: response.data.notify_monthly_summary,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchGroups = async () => {
    if (!form.api_key || !form.session) {
      toast.error('יש להזין API Key ו-Session לפני טעינת קבוצות');
      return;
    }
    
    setLoadingGroups(true);
    try {
      const response = await api.get<WhatsAppGroup[]>(
        `/whatsapp/groups?api_key=${form.api_key}&session=${form.session}`
      );
      setGroups(response.data);
      toast.success(`נמצאו ${response.data.length} קבוצות`);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoadingGroups(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.api_key && !settings) {
      toast.error('יש להזין API Key');
      return;
    }
    
    setSaving(true);
    try {
      const data = {
        ...form,
        api_key: form.api_key || undefined, // Use existing if not changed
      };
      
      await api.post('/whatsapp/settings', data);
      toast.success('ההגדרות נשמרו');
      fetchSettings();
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setSaving(false);
    }
  };
  
  const handleTest = async () => {
    if (!form.api_key || !form.session || !form.notification_target) {
      toast.error('יש למלא את כל השדות לפני בדיקה');
      return;
    }
    
    setTesting(true);
    try {
      await api.post('/whatsapp/test', {
        api_key: form.api_key,
        session: form.session,
        notification_target: form.notification_target,
        notification_type: form.notification_type,
      });
      toast.success('הודעת בדיקה נשלחה בהצלחה!');
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setTesting(false);
    }
  };
  
  if (loading) {
    return <Loading />;
  }
  
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        הגדרות
      </h1>
      
      {/* WhatsApp Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              התראות WhatsApp
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              קבל התראות על פעילות בקופות
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Connection settings */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 dark:text-white">הגדרות חיבור</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">API Key</label>
                <input
                  type="password"
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  className="input"
                  placeholder={settings ? '••••••••' : 'הזן API Key'}
                  dir="ltr"
                />
              </div>
              
              <div>
                <label className="label">Session</label>
                <input
                  type="text"
                  value={form.session}
                  onChange={(e) => setForm({ ...form, session: e.target.value })}
                  className="input"
                  placeholder="session"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
          
          {/* Notification target */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 dark:text-white">יעד התראות</h3>
            
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="notification_type"
                  value="phone"
                  checked={form.notification_type === 'phone'}
                  onChange={() => setForm({ ...form, notification_type: 'phone', notification_target: '' })}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-gray-700 dark:text-gray-300">מספר טלפון</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="notification_type"
                  value="group"
                  checked={form.notification_type === 'group'}
                  onChange={() => setForm({ ...form, notification_type: 'group', notification_target: '' })}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-gray-700 dark:text-gray-300">קבוצת WhatsApp</span>
              </label>
            </div>
            
            {form.notification_type === 'phone' ? (
              <div>
                <label className="label">מספר טלפון</label>
                <input
                  type="tel"
                  value={form.notification_target}
                  onChange={(e) => setForm({ ...form, notification_target: e.target.value })}
                  className="input"
                  placeholder="050-1234567"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ניתן להזין בכל פורמט - יומר אוטומטית ל-972
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="label">קבוצת WhatsApp</label>
                    <select
                      value={form.notification_target}
                      onChange={(e) => setForm({ ...form, notification_target: e.target.value })}
                      className="input"
                    >
                      <option value="">בחר קבוצה</option>
                      {groups.map((group) => (
                        <option key={group.JID} value={group.JID}>
                          {group.Name} ({group.ParticipantCount} משתתפים)
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={fetchGroups}
                    disabled={loadingGroups}
                    className="btn-secondary"
                  >
                    {loadingGroups ? 'טוען...' : 'טען קבוצות'}
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Notification types */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 dark:text-white">סוגי התראות</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'notify_on_deposit', label: 'הפקדה חדשה', icon: '💰' },
                { key: 'notify_on_withdrawal', label: 'משיכה', icon: '📤' },
                { key: 'notify_on_target_reached', label: 'הגעה ליעד', icon: '🎉' },
                { key: 'notify_on_milestone', label: 'אבני דרך (25%, 50%...)', icon: '🚀' },
                { key: 'notify_weekly_summary', label: 'סיכום שבועי', icon: '📊' },
                { key: 'notify_monthly_summary', label: 'סיכום חודשי', icon: '📈' },
              ].map(({ key, label, icon }) => (
                <label key={key} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={form[key as keyof typeof form] as boolean}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-xl">{icon}</span>
                  <span className="text-gray-700 dark:text-gray-300">{label}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Active toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/30">
            <div className="flex items-center gap-3">
              {form.is_active ? (
                <CheckCircleIcon className="w-6 h-6 text-green-500" />
              ) : (
                <XCircleIcon className="w-6 h-6 text-gray-400" />
              )}
              <span className="font-medium text-gray-900 dark:text-white">
                התראות {form.is_active ? 'פעילות' : 'מושהות'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.is_active ? 'translate-x-1' : 'translate-x-6'
                }`}
              />
            </button>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'שומר...' : 'שמור הגדרות'}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="btn-secondary"
            >
              {testing ? 'שולח...' : 'שלח הודעת בדיקה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
