import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { AuthResponse } from '../types';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth, setMustChangePassword } = useAuthStore();
  const navigate = useNavigate();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await api.post<AuthResponse>('/auth/login', {
        email,
        password,
      });
      
      const { user, accessToken, refreshToken, mustChangePassword } = response.data;
      setAuth(user, accessToken, refreshToken, mustChangePassword);
      
      if (mustChangePassword) {
        setMustChangePassword(true);
        navigate('/change-password');
      } else {
        toast.success(`ברוך הבא, ${user.name}!`);
        navigate('/');
      }
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogleLogin = async (credential: string) => {
    setLoading(true);
    
    try {
      const response = await api.post<AuthResponse>('/auth/google', {
        credential,
      });
      
      const { user, accessToken, refreshToken } = response.data;
      setAuth(user, accessToken, refreshToken);
      toast.success(`ברוך הבא, ${user.name}!`);
      navigate('/');
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  // Initialize Google Sign-In
  useState(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        callback: (response: any) => handleGoogleLogin(response.credential),
      });
      
      const buttonDiv = document.getElementById('google-signin-button');
      if (buttonDiv) {
        window.google?.accounts.id.renderButton(buttonDiv, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'signin_with',
          locale: 'he',
        });
      }
    };
    document.body.appendChild(script);
  });
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-2">
            💰 PlanIt
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            ניהול חסכונות והשקעות משפחתיות
          </p>
        </div>
        
        <div className="card p-8">
          <h2 className="text-xl font-semibold text-center mb-6 text-gray-900 dark:text-white">
            התחברות
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
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
                dir="ltr"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'מתחבר...' : 'התחבר'}
            </button>
          </form>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                או
              </span>
            </div>
          </div>
          
          <div id="google-signin-button" className="flex justify-center" />
          
          <p className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
            <Link
              to="/forgot-password"
              className="text-primary-600 dark:text-primary-400 hover:underline"
            >
              שכחת סיסמה?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
