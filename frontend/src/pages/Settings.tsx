import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import Loading from '../components/common/Loading';

export default function Settings() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
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
  
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">הגדרות</h1>
        <p className="text-gray-500 mt-1">נהל את הפרופיל והאבטחה שלך</p>
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
    </div>
  );
}
