import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { AuthResponse } from '../types';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('הסיסמאות אינן תואמות');
      return;
    }
    
    if (password.length < 8) {
      toast.error('הסיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await api.post<AuthResponse>('/auth/accept-invite', {
        token,
        name,
        password,
      });
      
      const { user, accessToken, refreshToken } = response.data;
      setAuth(user, accessToken, refreshToken);
      toast.success('החשבון נוצר בהצלחה!');
      navigate('/');
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="card p-8 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
            הזמנה לא תקינה
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            קישור ההזמנה אינו תקין או שפג תוקפו.
          </p>
          <Link to="/login" className="text-primary-600 dark:text-primary-400 hover:underline">
            חזרה להתחברות
          </Link>
        </div>
      </div>
    );
  }
  
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
            ברוך הבא! 🎉
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
            הוזמנת להצטרף למערכת ניהול החסכונות
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="label">
                שם מלא
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                required
                minLength={2}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="label">
                סיסמה
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? 'יוצר חשבון...' : 'צור חשבון והתחבר'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
