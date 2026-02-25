import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { AuthResponse } from '../types';

export default function Setup() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  
  useEffect(() => {
    checkSetup();
  }, []);
  
  const checkSetup = async () => {
    try {
      const response = await api.get<{ needsSetup: boolean }>('/auth/check-setup');
      if (!response.data.needsSetup) {
        navigate('/login');
      } else {
        setNeedsSetup(true);
      }
    } catch {
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (form.password !== form.confirmPassword) {
      toast.error('הסיסמאות אינן תואמות');
      return;
    }
    
    if (form.password.length < 8) {
      toast.error('הסיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }
    
    setSaving(true);
    
    try {
      const response = await api.post<AuthResponse>('/auth/setup', {
        name: form.name,
        email: form.email,
        password: form.password,
      });
      
      const { user, accessToken, refreshToken } = response.data;
      setAuth(user, accessToken, refreshToken);
      toast.success('החשבון נוצר בהצלחה!');
      navigate('/');
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!needsSetup) {
    return null;
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-2">
            💰 PlanIt
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            הגדרה ראשונית
          </p>
        </div>
        
        <div className="card p-8">
          <h2 className="text-xl font-semibold text-center mb-2 text-gray-900 dark:text-white">
            ברוך הבא! 🎉
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
            צור את חשבון המנהל הראשון
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="label">
                שם מלא
              </label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                required
                minLength={2}
                autoFocus
              />
            </div>
            
            <div>
              <label htmlFor="email" className="label">
                אימייל
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
                required
                dir="ltr"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="label">
                סיסמה
              </label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
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
                אישור סיסמה
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="input"
                required
                dir="ltr"
              />
            </div>
            
            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full"
            >
              {saving ? 'יוצר חשבון...' : 'צור חשבון והתחל'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
