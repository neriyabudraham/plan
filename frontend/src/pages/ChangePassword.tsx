import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function ChangePassword() {
  const { user, mustChangePassword, setMustChangePassword, logout } = useAuthStore();
  const navigate = useNavigate();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('הסיסמאות אינן תואמות');
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error('הסיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }
    
    setLoading(true);
    
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      
      setMustChangePassword(false);
      toast.success('הסיסמה שונתה בהצלחה');
      navigate('/');
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-2">
            💰 PlanIt
          </h1>
        </div>
        
        <div className="card p-8">
          <h2 className="text-xl font-semibold text-center mb-2 text-gray-900 dark:text-white">
            שינוי סיסמה
          </h2>
          
          {mustChangePassword && (
            <p className="text-center text-amber-600 dark:text-amber-400 text-sm mb-6">
              ⚠️ עליך לשנות את הסיסמה לפני שתוכל להמשיך
            </p>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="label">
                סיסמה נוכחית
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input"
                required
                dir="ltr"
              />
            </div>
            
            <div>
              <label htmlFor="newPassword" className="label">
                סיסמה חדשה
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                required
                minLength={8}
                dir="ltr"
              />
              <p className="text-xs text-gray-500 mt-1">
                לפחות 8 תווים
              </p>
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="label">
                אישור סיסמה חדשה
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                required
                dir="ltr"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'שומר...' : 'שנה סיסמה'}
            </button>
            
            {mustChangePassword && (
              <button
                type="button"
                onClick={handleLogout}
                className="btn-secondary w-full"
              >
                התנתק
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
