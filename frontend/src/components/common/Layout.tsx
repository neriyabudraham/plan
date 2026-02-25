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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        } lg:static lg:inset-auto`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
              💰 PlanIt
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>
          
          {/* User section */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  <span className="text-primary-600 dark:text-primary-400 font-medium">
                    {user?.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
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
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
              >
                {theme === 'dark' ? (
                  <SunIcon className="w-5 h-5" />
                ) : (
                  <MoonIcon className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                יציאה
              </button>
            </div>
          </div>
        </div>
      </aside>
      
      {/* Main content */}
      <div className="lg:mr-64">
        {/* Top bar for mobile */}
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 lg:hidden">
          <div className="flex items-center justify-between h-full px-4">
            <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
              💰 PlanIt
            </span>
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
          </div>
        </header>
        
        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
