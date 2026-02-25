import { useEffect, useState } from 'react';
import { PlusIcon, UsersIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { User, UserRole } from '../types';
import { formatDate, getRoleLabel } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'invite' | 'edit'>('create');
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { user: currentUser } = useAuthStore();
  
  const [form, setForm] = useState({
    email: '',
    name: '',
    role: 'viewer' as UserRole,
    sendEmail: true,
  });
  
  useEffect(() => {
    fetchUsers();
  }, []);
  
  const fetchUsers = async () => {
    try {
      const response = await api.get<User[]>('/users');
      setUsers(response.data);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const openCreateModal = () => {
    setModalType('create');
    setEditingUser(null);
    setForm({ email: '', name: '', role: 'viewer', sendEmail: true });
    setShowModal(true);
  };
  
  const openInviteModal = () => {
    setModalType('invite');
    setEditingUser(null);
    setForm({ email: '', name: '', role: 'viewer', sendEmail: true });
    setShowModal(true);
  };
  
  const openEditModal = (user: User) => {
    setModalType('edit');
    setEditingUser(user);
    setForm({ email: user.email, name: user.name, role: user.role, sendEmail: false });
    setShowModal(true);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (modalType === 'create') {
        const response = await api.post<{ user: User; tempPassword?: string }>('/users', {
          email: form.email,
          name: form.name,
          role: form.role,
          sendWelcomeEmail: form.sendEmail,
        });
        
        if (!form.sendEmail && response.data.tempPassword) {
          toast.success(`משתמש נוצר! סיסמה זמנית: ${response.data.tempPassword}`, {
            duration: 10000,
          });
        } else {
          toast.success('משתמש נוצר ונשלח אליו מייל');
        }
      } else if (modalType === 'invite') {
        await api.post('/users/invite', {
          email: form.email,
          role: form.role,
          sendEmail: form.sendEmail,
        });
        toast.success('הזמנה נשלחה');
      } else if (modalType === 'edit' && editingUser) {
        await api.patch(`/users/${editingUser.id}`, {
          name: form.name,
          role: form.role,
        });
        toast.success('המשתמש עודכן');
      }
      
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setSaving(false);
    }
  };
  
  const handleToggleActive = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error('לא ניתן לכבות את החשבון שלך');
      return;
    }
    
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active });
      toast.success(user.is_active ? 'המשתמש הושהה' : 'המשתמש הופעל');
      fetchUsers();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  const handleDelete = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error('לא ניתן למחוק את עצמך');
      return;
    }
    
    if (!confirm(`למחוק את המשתמש "${user.name}"?`)) return;
    
    try {
      await api.delete(`/users/${user.id}`);
      toast.success('המשתמש נמחק');
      fetchUsers();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };
  
  if (loading) {
    return <Loading />;
  }
  
  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'editor':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          משתמשים
        </h1>
        <div className="flex gap-2">
          <button onClick={openInviteModal} className="btn-secondary">
            שלח הזמנה
          </button>
          <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-5 h-5" />
            משתמש חדש
          </button>
        </div>
      </div>
      
      {users.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="w-full h-full" />}
          title="אין משתמשים"
          description="הוסף משתמשים למערכת"
          action={
            <button onClick={openCreateModal} className="btn-primary">
              הוסף משתמש
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    משתמש
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    תפקיד
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    סטטוס
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    התחברות אחרונה
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                            <span className="text-primary-600 dark:text-primary-400 font-medium">
                              {user.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {user.name}
                            {user.id === currentUser?.id && (
                              <span className="text-xs text-gray-400 mr-1">(אתה)</span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={user.id === currentUser?.id}
                        className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                          user.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        } ${user.id === currentUser?.id ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                      >
                        {user.is_active ? 'פעיל' : 'מושהה'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {user.last_login ? formatDate(user.last_login) : 'מעולם לא'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-1.5 text-gray-400 hover:text-red-500"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          modalType === 'create'
            ? 'משתמש חדש'
            : modalType === 'invite'
            ? 'שליחת הזמנה'
            : 'עריכת משתמש'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">אימייל</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              required
              disabled={modalType === 'edit'}
              dir="ltr"
            />
          </div>
          
          {modalType !== 'invite' && (
            <div>
              <label className="label">שם</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                required
              />
            </div>
          )}
          
          <div>
            <label className="label">תפקיד</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="input"
            >
              <option value="viewer">צופה - צפייה בלבד</option>
              <option value="editor">עורך - צפייה ועריכה</option>
              <option value="admin">מנהל - גישה מלאה</option>
            </select>
          </div>
          
          {modalType !== 'edit' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.sendEmail}
                onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {modalType === 'create' ? 'שלח מייל עם סיסמה זמנית' : 'שלח הזמנה במייל'}
              </span>
            </label>
          )}
          
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving
              ? 'שומר...'
              : modalType === 'create'
              ? 'צור משתמש'
              : modalType === 'invite'
              ? 'שלח הזמנה'
              : 'עדכן'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
