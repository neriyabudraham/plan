import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = useAuthStore.getState().refreshToken;
      
      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh', { refreshToken });
          const { accessToken, refreshToken: newRefreshToken } = response.data;
          
          useAuthStore.getState().setTokens(accessToken, newRefreshToken);
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;

export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || 'שגיאה בתקשורת עם השרת';
  }
  return 'שגיאה לא צפויה';
};
