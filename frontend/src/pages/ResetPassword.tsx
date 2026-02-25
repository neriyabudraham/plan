import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
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
      await api.post('/auth/reset-password', { token, password });
      toast.success('הסיסמה אופסה בהצלחה');
      navigate('/login');
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
            קישור לא תקין
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            הקישור לאיפוס הסיסמה אינו תקין או שפג תוקפו.
          </p>
          <Link to="/forgot-password" className="text-primary-600 dark:text-primary-400 hover:underline">
            בקש קישור חדש
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
          <h2 className="text-xl font-semibold text-center mb-6 text-gray-900 dark:text-white">
            הגדר סיסמה חדשה
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="label">
                סיסמה חדשה
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
              {loading ? 'שומר...' : 'שמור סיסמה'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
