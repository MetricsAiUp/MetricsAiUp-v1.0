import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  Users as UsersIcon, Plus, X, Check, Shield, Eye, EyeOff, Wrench, UserCog,
  ToggleLeft, ToggleRight, Pencil, Trash2,
} from 'lucide-react';

const BASE = import.meta.env.BASE_URL || './';
function getBackendUrl() {
  if (typeof window === 'undefined') return 'http://localhost:3002';
  const loc = window.location;
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') return `http://${loc.hostname}:3002`;
  const base = loc.href.split('/preview/')[0];
  return base ? `${base}/preview/3002` : `http://${loc.hostname}:3002`;
}
const BACKEND_URL = getBackendUrl();
const fetchApi = async (path) => {
  const res = await fetch(`${BASE}api/${path}.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

const ROLE_ICONS = { admin: Shield, manager: UserCog, viewer: Eye, mechanic: Wrench };

export default function Users() {
  const { i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null); // null = list, object = editing
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    // Try backend server first, then localStorage, then static JSON
    const loadData = async () => {
      // Always try fresh JSON first, localStorage as fallback
      try {
        const d = await fetchApi('users');
        setData(d);
        setLoading(false);
        return;
      } catch { /* fallback */ }
      const saved = localStorage.getItem('usersData');
      if (saved) {
        try { setData(JSON.parse(saved)); setLoading(false); return; } catch { /* ignore */ }
      }
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading || !data) return <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Загрузка...' : 'Loading...'}</div>;

  const { users, roles, availablePages } = data;
  const lang = isRu ? 'ru' : 'en';

  const persistUsers = (newData) => {
    localStorage.setItem('usersData', JSON.stringify(newData));
  };

  const handleSave = (userForm) => {
    const prev = data;
    const exists = prev.users.find(u => u.id === userForm.id);
    let newData;
    if (exists) {
      const updatedUser = { ...exists, ...userForm };
      if (!userForm.password || userForm.password.trim() === '') {
        updatedUser.password = exists.password || 'demo123';
      }
      newData = { ...prev, users: prev.users.map(u => u.id === exists.id ? updatedUser : u) };
    } else {
      const newUser = {
        ...userForm,
        id: `user-${Date.now()}`,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      if (!newUser.password || newUser.password.trim() === '') {
        newUser.password = 'demo123';
      }
      newData = { ...prev, users: [...prev.users, newUser] };
    }
    persistUsers(newData);
    setData(newData);
    setEditUser(null);
    setShowNew(false);
  };

  const handleDelete = (id) => {
    const newData = { ...data, users: data.users.filter(u => u.id !== id) };
    persistUsers(newData);
    setData(newData);
  };

  // Edit/Create form
  if (editUser || showNew) {
    const user = editUser || { email: '', firstName: '', lastName: '', password: '', role: 'viewer', isActive: true, pages: ['dashboard'] };
    return <UserForm user={user} roles={roles} pages={availablePages} lang={lang} isRu={isRu}
      onSave={handleSave} onCancel={() => { setEditUser(null); setShowNew(false); }} />;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <UsersIcon size={20} style={{ color: 'var(--accent)' }} />
          {isRu ? 'Пользователи' : 'Users'}
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{users.length}</span>
        </h2>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90"
          style={{ background: 'var(--accent)' }}>
          <Plus size={14} />
          {isRu ? 'Создать' : 'Create'}
        </button>
      </div>

      {/* Users list */}
      <div className="grid gap-3">
        {users.map(user => {
          const role = roles.find(r => r.id === user.role);
          const RoleIcon = ROLE_ICONS[user.role] || Eye;
          return (
            <div key={user.id} className="glass rounded-xl p-4 flex items-center gap-4"
              style={{ border: '1px solid var(--border-glass)', opacity: user.isActive ? 1 : 0.5 }}>
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: role?.color || 'var(--accent)' }}>
                {(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: (role?.color || '#94a3b8') + '18', color: role?.color || '#94a3b8' }}>
                    <RoleIcon size={10} />
                    {role?.name?.[lang] || user.role}
                  </span>
                  {!user.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--danger)', color: '#fff' }}>
                      {isRu ? 'Отключён' : 'Disabled'}
                    </span>
                  )}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
              </div>

              {/* Pages count */}
              <div className="text-center flex-shrink-0" style={{ minWidth: 60 }}>
                <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{user.pages.length}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{isRu ? 'разделов' : 'pages'}</div>
              </div>

              {/* Pages preview */}
              <div className="flex flex-wrap gap-1 flex-1" style={{ maxWidth: 300 }}>
                {user.pages.slice(0, 5).map(p => {
                  const pg = availablePages.find(ap => ap.id === p);
                  return (
                    <span key={p} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                      {pg?.label?.[lang] || p}
                    </span>
                  );
                })}
                {user.pages.length > 5 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>+{user.pages.length - 5}</span>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setEditUser(user)} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--accent)' }}>
                  <Pencil size={14} />
                </button>
                {user.role !== 'admin' && (
                  <button onClick={() => handleDelete(user.id)} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--danger)' }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UserForm({ user, roles, pages, lang, isRu, onSave, onCancel }) {
  const isNew = !user.id || user.id.startsWith('user-new');
  const [form, setForm] = useState({ ...user });
  const [showPass, setShowPass] = useState(false);

  const togglePage = (pageId) => {
    setForm(prev => ({
      ...prev,
      pages: prev.pages.includes(pageId) ? prev.pages.filter(p => p !== pageId) : [...prev.pages, pageId],
    }));
  };

  const selectAll = () => setForm(prev => ({ ...prev, pages: pages.map(p => p.id) }));
  const deselectAll = () => setForm(prev => ({ ...prev, pages: ['dashboard'] }));

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {isNew ? (isRu ? 'Новый пользователь' : 'New User') : (isRu ? 'Редактирование' : 'Edit User')}
        </h2>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <X size={18} />
        </button>
      </div>

      {/* Basic info */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Имя' : 'First Name'}</label>
          <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Фамилия' : 'Last Name'}</label>
          <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Email</label>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Пароль' : 'Password'}</label>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder={isRu ? 'Введите пароль' : 'Enter password'}
              className="w-full px-3 py-2 pr-9 rounded-lg text-sm"
              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-muted)' }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Роль' : 'Role'}</label>
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name[lang]}</option>)}
          </select>
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <button onClick={() => setForm({ ...form, isActive: !form.isActive })}
          className="flex items-center gap-2 text-sm"
          style={{ color: form.isActive ? 'var(--success)' : 'var(--text-muted)' }}>
          {form.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
          {form.isActive ? (isRu ? 'Активен' : 'Active') : (isRu ? 'Отключён' : 'Disabled')}
        </button>
      </div>

      {/* Pages access */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {isRu ? 'Доступные разделы' : 'Available Pages'} ({form.pages.length}/{pages.length})
          </label>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs hover:opacity-80" style={{ color: 'var(--accent)' }}>
              {isRu ? 'Все' : 'All'}
            </button>
            <button onClick={deselectAll} className="text-xs hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
              {isRu ? 'Сбросить' : 'Reset'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {pages.map(page => {
            const active = form.pages.includes(page.id);
            return (
              <button key={page.id} onClick={() => togglePage(page.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all text-left"
                style={{
                  background: active ? 'var(--accent-light)' : 'var(--bg-glass)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-glass)'}`,
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 400,
                }}>
                {active ? <Check size={12} /> : <div style={{ width: 12 }} />}
                {page.label[lang]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel}
          className="flex-1 px-4 py-2 rounded-lg text-sm"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
          {isRu ? 'Отмена' : 'Cancel'}
        </button>
        <button onClick={() => onSave(form)}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}>
          {isRu ? 'Сохранить' : 'Save'}
        </button>
      </div>
    </div>
  );
}
