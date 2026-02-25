import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('נשלח מייל עם הוראות לאיפוס הסיסמה');
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
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
          <h2 className="text-xl font-semibold text-center mb-6 text-gray-900 dark:text-white">
            איפוס סיסמה
          </h2>
          
          {sent ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📧</div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                אם המייל קיים במערכת, נשלח אליו קישור לאיפוס הסיסמה.
              </p>
              <Link to="/login" className="text-primary-600 dark:text-primary-400 hover:underline">
                חזרה להתחברות
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                הזן את כתובת המייל שלך ונשלח לך קישור לאיפוס הסיסמה.
              </p>
              
              <div>
                <label htmlFor="email" className="label">
                  אימייל
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {loading ? 'שולח...' : 'שלח קישור'}
              </button>
              
              <p className="text-center text-sm">
                <Link
                  to="/login"
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  חזרה להתחברות
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
