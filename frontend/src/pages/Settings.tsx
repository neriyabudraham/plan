import { useState, useEffect } from 'react';
import { TrashIcon, UserPlusIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { FamilyShare, ShareInvite, ROLE_LABELS } from '../types';
import Modal from '../components/common/Modal';

export default function Settings() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [sharedUsers, setSharedUsers] = useState<FamilyShare[]>([]);
  const [pendingInvites, setPendingInvites] = useState<ShareInvite[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<FamilyShare[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'editor' as 'admin' | 'editor' | 'viewer',
  });
  
  useEffect(() => {
    fetchSharingData();
  }, []);
  
  const fetchSharingData = async () => {
    try {
      const [usersRes, invitesRes, sharedRes] = await Promise.all([
        api.get<FamilyShare[]>('/family-share/shared-users'),
        api.get<ShareInvite[]>('/family-share/pending-invites'),
        api.get<FamilyShare[]>('/family-share/shared-with-me'),
      ]);
      setSharedUsers(usersRes.data);
      setPendingInvites(invitesRes.data);
      setSharedWithMe(sharedRes.data);
    } catch (error) {
      console.error('Failed to fetch sharing data:', error);
    }
  };
  
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('הפרופיל עודכן (בקרוב)');
  };
  
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('הסיסמאות אינן תואמות');
      return;
    }
    
    if (passwordForm.newPassword.length < 8) {
      toast.error('הסיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }
    
    setLoading(true);
    
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('הסיסמה שונתה בהצלחה');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await api.post('/family-share/invite', inviteForm);
      toast.success('הזמנה נשלחה');
      setIsInviteModalOpen(false);
      setInviteForm({ email: '', role: 'editor' });
      fetchSharingData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleRemoveShare = async (shareId: string) => {
    if (!confirm('להסיר את השיתוף?')) return;
    
    try {
      await api.delete(`/family-share/share/${shareId}`);
      toast.success('השיתוף הוסר');
      fetchSharingData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleCancelInvite = async (inviteId: string) => {
    try {
      await api.delete(`/family-share/invite/${inviteId}`);
      toast.success('ההזמנה בוטלה');
      fetchSharingData();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">הגדרות</h1>
        <p className="text-gray-500 mt-1">נהל את הפרופיל, האבטחה והשיתוף שלך</p>
      </div>
      
      {/* Profile */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">פרופיל</h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div>
            <label className="label">שם</label>
            <input
              type="text"
              value={profileForm.name}
              onChange={e => setProfileForm({...profileForm, name: e.target.value})}
              className="input"
            />
          </div>
          <div>
            <label className="label">אימייל</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={e => setProfileForm({...profileForm, email: e.target.value})}
              className="input"
              dir="ltr"
              disabled
            />
          </div>
          <button type="submit" className="btn-primary">שמור שינויים</button>
        </form>
      </div>
      
      {/* Family Sharing */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">שיתוף משפחתי</h2>
            <p className="text-sm text-gray-500">הזמן אנשים אחרים לצפות או לערוך את הנתונים המשפחתיים</p>
          </div>
          <button onClick={() => setIsInviteModalOpen(true)} className="btn-primary">
            <UserPlusIcon className="w-5 h-5 ml-1" />
            הזמן
          </button>
        </div>
        
        {/* Shared Users */}
        {sharedUsers.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">משתמשים משותפים</h3>
            <div className="space-y-2">
              {sharedUsers.map(share => (
                <div key={share.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{share.shared_user_name}</p>
                    <p className="text-sm text-gray-500">{share.shared_user_email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                      {ROLE_LABELS[share.role]}
                    </span>
                    <button
                      onClick={() => handleRemoveShare(share.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">הזמנות ממתינות</h3>
            <div className="space-y-2">
              {pendingInvites.map(invite => (
                <div key={invite.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <EnvelopeIcon className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{invite.email}</p>
                      <p className="text-xs text-gray-500">
                        פג ב-{new Date(invite.expires_at).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                      {ROLE_LABELS[invite.role]}
                    </span>
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Shared With Me */}
        {sharedWithMe.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">משפחות משותפות איתי</h3>
            <div className="space-y-2">
              {sharedWithMe.map(share => (
                <div key={share.id} className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {share.family_name || share.owner_name}
                    </p>
                    <p className="text-sm text-gray-500">{share.owner_email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded">
                      {ROLE_LABELS[share.role]}
                    </span>
                    <button
                      onClick={() => handleRemoveShare(share.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="עזוב משפחה"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {sharedUsers.length === 0 && pendingInvites.length === 0 && sharedWithMe.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <UserPlusIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>אין שיתופים עדיין</p>
            <p className="text-sm">הזמן את בן/בת הזוג לנהל יחד את הכספים</p>
          </div>
        )}
      </div>
      
      {/* Password */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">שינוי סיסמה</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="label">סיסמה נוכחית</label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
              className="input"
              dir="ltr"
              required
            />
          </div>
          <div>
            <label className="label">סיסמה חדשה</label>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
              className="input"
              dir="ltr"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="label">אימות סיסמה חדשה</label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
              className="input"
              dir="ltr"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'משנה...' : 'שנה סיסמה'}
          </button>
        </form>
      </div>
      
      {/* Invite Modal */}
      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="הזמן למשפחה">
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="label">כתובת אימייל</label>
            <input
              type="email"
              value={inviteForm.email}
              onChange={e => setInviteForm({...inviteForm, email: e.target.value})}
              className="input"
              dir="ltr"
              placeholder="email@example.com"
              required
            />
          </div>
          <div>
            <label className="label">הרשאות</label>
            <select
              value={inviteForm.role}
              onChange={e => setInviteForm({...inviteForm, role: e.target.value as 'admin' | 'editor' | 'viewer'})}
              className="input"
            >
              <option value="admin">מנהל - גישה מלאה</option>
              <option value="editor">עורך - יכול לערוך הכל</option>
              <option value="viewer">צופה - צפייה בלבד</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1">שלח הזמנה</button>
            <button type="button" onClick={() => setIsInviteModalOpen(false)} className="btn-secondary flex-1">ביטול</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
