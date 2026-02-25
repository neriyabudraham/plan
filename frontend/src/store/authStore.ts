import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  mustChangePassword: boolean;
  isAuthenticated: boolean;
  
  setAuth: (user: User, accessToken: string, refreshToken: string, mustChangePassword?: boolean) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setMustChangePassword: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      mustChangePassword: false,
      isAuthenticated: false,
      
      setAuth: (user, accessToken, refreshToken, mustChangePassword = false) =>
        set({
          user,
          accessToken,
          refreshToken,
          mustChangePassword,
          isAuthenticated: true,
        }),
      
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      
      setUser: (user) => set({ user }),
      
      setMustChangePassword: (value) => set({ mustChangePassword: value }),
      
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          mustChangePassword: false,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'planit-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
