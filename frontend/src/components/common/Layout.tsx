import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  BanknotesIcon,
  ArrowsRightLeftIcon,
  CalendarDaysIcon,
  UsersIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import api from '../../services/api';

const navigation = [
  { name: 'דשבורד', href: '/', icon: HomeIcon },
  { name: 'קופות', href: '/funds', icon: BanknotesIcon },
  { name: 'תנועות', href: '/transactions', icon: ArrowsRightLeftIcon },
  { name: 'הפקדות חוזרות', href: '/recurring', icon: CalendarDaysIcon },
  { name: 'משתמשים', href: '/users', icon: UsersIcon, adminOnly: true },
  { name: 'הגדרות', href: '/settings', icon: Cog6ToothIcon, adminOnly: true },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, refreshToken } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore error
    }
    logout();
    navigate('/login');
  };
  
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  
  const filteredNavigation = navigation.filter(
    (item) => !item.adminOnly || user?.role === 'admin'
  );
  
  return (
    <div className="min-h-screen flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 inset-y-0 right-0 z-50 w-72 h-screen bg-white/95 backdrop-blur-xl dark:bg-gray-900/95 border-l border-gray-200/50 dark:border-gray-700/50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        } shadow-2xl lg:shadow-none flex-shrink-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-20 px-6 border-b border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-xl">💰</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                PlanIt
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </NavLink>
            ))}
          </nav>
          
          {/* User section */}
          <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-12 h-12 rounded-xl object-cover shadow"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow">
                  <span className="text-white font-bold text-lg">
                    {user?.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">
                  {user?.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={toggleTheme}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm"
              >
                {theme === 'dark' ? (
                  <SunIcon className="w-5 h-5 text-amber-500" />
                ) : (
                  <MoonIcon className="w-5 h-5 text-indigo-500" />
                )}
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                <span className="font-medium">יציאה</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
      
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar for mobile */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-xl dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-700/50 lg:hidden shadow-sm">
          <div className="flex items-center justify-between h-full px-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-sm">💰</span>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                PlanIt
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Bars3Icon className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </header>
        
        {/* Page content */}
        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
