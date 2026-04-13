import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  Users as UsersIcon, Plus, X, Check, Shield, Eye, EyeOff, Wrench, UserCog,
  ToggleLeft, ToggleRight, Pencil, Trash2, ChevronDown, ChevronRight, LayoutGrid,
} from 'lucide-react';
import HelpButton from '../components/HelpButton';
import { PAGE_ELEMENTS } from '../contexts/AuthContext';

const ROLE_ICONS = { admin: Shield, manager: UserCog, viewer: Eye, mechanic: Wrench };
const ROLE_COLORS = { admin: '#8b5cf6', manager: '#3b82f6', viewer: '#64748b', mechanic: '#10b981' };

export default function Users() {
  const { i18n } = useTranslation();
  const { user: currentUser, updateCurrentUser, api } = useAuth();
  const isRu = i18n.language === 'ru';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    api.get('/api/users')
      .then(({ data: d }) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Загрузка...' : 'Loading...'}</div>;

  const { users, roles, availablePages } = data;
  const lang = isRu ? 'ru' : 'en';

  const handleSave = async (userForm) => {
    try {
      let savedUser;
      if (userForm.id && !userForm.id.startsWith('user-')) {
        // Update existing user via API
        const body = {
          firstName: userForm.firstName,
          lastName: userForm.lastName,
          email: userForm.email,
          isActive: userForm.isActive,
          hiddenElements: userForm.hiddenElements || [],
          roleName: userForm.role,
        };
        if (userForm.password && userForm.password.trim() !== '') body.password = userForm.password;
        const { data: updated } = await api.put(`/api/users/${userForm.id}`, body);
        savedUser = updated;
        setData(prev => ({ ...prev, users: prev.users.map(u => u.id === userForm.id ? savedUser : u) }));
      } else {
        // Create new user via API
        const body = {
          firstName: userForm.firstName,
          lastName: userForm.lastName,
          email: userForm.email,
          password: userForm.password || 'demo123',
          roleIds: userForm.roleId ? [userForm.roleId] : [],
        };
        const { data: created } = await api.post('/api/users', body);
        savedUser = created;
        setData(prev => ({ ...prev, users: [...prev.users, savedUser] }));
      }
      // Update current user session if editing self
      if (savedUser && savedUser.email?.toLowerCase() === currentUser?.email?.toLowerCase()) {
        updateCurrentUser(savedUser);
      }
    } catch (err) {
      console.error('Save user failed:', err);
    }
    setEditUser(null);
    setShowNew(false);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/users/${id}`);
      setData(prev => ({ ...prev, users: prev.users.filter(u => u.id !== id) }));
    } catch (err) {
      console.error('Delete user failed:', err);
    }
  };

  if (editUser || showNew) {
    const user = editUser || { email: '', firstName: '', lastName: '', password: '', role: 'viewer', isActive: true, pages: ['dashboard'], hiddenElements: [] };
    return <UserForm user={user} roles={roles} pages={availablePages} lang={lang} isRu={isRu}
      onSave={handleSave} onCancel={() => { setEditUser(null); setShowNew(false); }} />;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UsersIcon size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {isRu ? 'Пользователи' : 'Users'}
          </h2>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{users.length}</span>
          <HelpButton pageKey="users" />
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-white hover:opacity-90"
          style={{ background: 'var(--accent)' }}>
          <Plus size={13} />
          {isRu ? 'Создать' : 'Create'}
        </button>
      </div>

      {/* Users table */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <th className="text-left px-3 py-2 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Пользователь' : 'User'}</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Роль' : 'Role'}</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Доступ' : 'Access'}</th>
              <th className="text-right px-3 py-2 text-[11px] font-medium" style={{ color: 'var(--text-muted)', width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const role = roles.find(r => r.id === user.role);
              const RoleIcon = ROLE_ICONS[user.role] || Eye;
              const color = ROLE_COLORS[user.role] || '#64748b';
              const initials = (user.firstName?.[0] || '') + (user.lastName?.[0] || '');
              const pagesList = (user.pages || []);
              return (
                <tr key={user.id} className="group hover:opacity-90 transition-opacity"
                  style={{ borderBottom: '1px solid var(--border-glass)', opacity: user.isActive ? 1 : 0.45 }}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                        style={{ background: color }}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
                          {user.firstName} {user.lastName}
                          {!user.isActive && (
                            <span className="ml-1.5 text-[10px] px-1 py-px rounded font-normal" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                              {isRu ? 'откл.' : 'off'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: color + '15', color }}>
                      <RoleIcon size={10} />
                      {role?.name?.[lang] || user.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {pagesList.slice(0, 4).map(p => {
                        const pg = availablePages.find(ap => ap.id === p);
                        return (
                          <span key={p} className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--bg-glass)', color: 'var(--text-muted)' }}>
                            {pg?.label?.[lang] || p}
                          </span>
                        );
                      })}
                      {pagesList.length > 4 && (
                        <span className="text-[10px] px-1 py-0.5 rounded font-medium" style={{ color: 'var(--accent)' }}>
                          +{pagesList.length - 4}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => setEditUser(user)} className="p-1 rounded hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--text-muted)' }} title={isRu ? 'Редактировать' : 'Edit'}>
                        <Pencil size={13} />
                      </button>
                      {user.role !== 'admin' && (
                        <button onClick={() => handleDelete(user.id)} className="p-1 rounded hover:opacity-70 transition-opacity"
                          style={{ color: '#ef4444' }} title={isRu ? 'Удалить' : 'Delete'}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserForm({ user, roles, pages, lang, isRu, onSave, onCancel }) {
  const isNew = !user.id || user.id.startsWith('user-new');
  const [form, setForm] = useState({ ...user, hiddenElements: user.hiddenElements || [] });
  const [showPass, setShowPass] = useState(false);
  const [expandedPage, setExpandedPage] = useState(null);

  const togglePage = (pageId) => {
    setForm(prev => ({
      ...prev,
      pages: prev.pages.includes(pageId) ? prev.pages.filter(p => p !== pageId) : [...prev.pages, pageId],
    }));
  };

  const toggleElement = (pageId, elementId) => {
    const key = `${pageId}.${elementId}`;
    setForm(prev => ({
      ...prev,
      hiddenElements: prev.hiddenElements.includes(key)
        ? prev.hiddenElements.filter(e => e !== key)
        : [...prev.hiddenElements, key],
    }));
  };

  const selectAll = () => setForm(prev => ({ ...prev, pages: pages.map(p => p.id) }));
  const deselectAll = () => setForm(prev => ({ ...prev, pages: ['dashboard'] }));

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {isNew ? (isRu ? 'Новый пользователь' : 'New User') : (isRu ? 'Редактирование' : 'Edit User')}
        </h2>
        <button onClick={onCancel} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <X size={18} />
        </button>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label={isRu ? 'Имя' : 'First Name'} value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} />
          <Field label={isRu ? 'Фамилия' : 'Last Name'} value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} />
          <Field label="Email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
          <div>
            <label className="text-[11px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Пароль' : 'Password'}</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder={isRu ? 'Введите пароль' : 'Enter password'}
                className="w-full px-2.5 py-1.5 pr-8 rounded-lg text-xs"
                style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[11px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Роль' : 'Role'}</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name[lang]}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className="flex items-center gap-1.5 text-xs py-1.5"
              style={{ color: form.isActive ? '#10b981' : 'var(--text-muted)' }}>
              {form.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              {form.isActive ? (isRu ? 'Активен' : 'Active') : (isRu ? 'Отключён' : 'Disabled')}
            </button>
          </div>
        </div>
      </div>

      {/* Pages */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {isRu ? 'Доступные разделы' : 'Pages'} <span style={{ color: 'var(--text-muted)' }}>({form.pages.length}/{pages.length})</span>
          </label>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[11px] hover:opacity-80" style={{ color: 'var(--accent)' }}>{isRu ? 'Все' : 'All'}</button>
            <button onClick={deselectAll} className="text-[11px] hover:opacity-80" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Сбросить' : 'Reset'}</button>
          </div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
          {pages.map(page => {
            const active = form.pages.includes(page.id);
            return (
              <button key={page.id} onClick={() => togglePage(page.id)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition-all text-left"
                style={{
                  background: active ? 'var(--accent-light)' : 'transparent',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-glass)'}`,
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: active ? 600 : 400,
                }}>
                {active ? <Check size={10} /> : <span style={{ width: 10 }} />}
                {page.label[lang]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Elements visibility per page */}
      {form.pages.some(p => PAGE_ELEMENTS[p]) && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <LayoutGrid size={14} style={{ color: 'var(--accent)' }} />
            <label className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              {isRu ? 'Видимость элементов' : 'Element Visibility'}
            </label>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              {form.hiddenElements.length > 0
                ? (isRu ? `${form.hiddenElements.length} скрыто` : `${form.hiddenElements.length} hidden`)
                : (isRu ? 'Все видны' : 'All visible')}
            </span>
          </div>
          <div className="space-y-1">
            {form.pages.filter(p => PAGE_ELEMENTS[p]).map(pageId => {
              const pageInfo = pages.find(p => p.id === pageId);
              const elements = PAGE_ELEMENTS[pageId];
              const isExpanded = expandedPage === pageId;
              const hiddenCount = elements.filter(el => form.hiddenElements.includes(`${pageId}.${el.id}`)).length;
              return (
                <div key={pageId}>
                  <button
                    onClick={() => setExpandedPage(isExpanded ? null : pageId)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-all hover:opacity-80"
                    style={{ background: isExpanded ? 'var(--accent-light)' : 'transparent', border: `1px solid ${isExpanded ? 'var(--accent)' : 'var(--border-glass)'}`, color: isExpanded ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    <span className="font-medium">{pageInfo?.label?.[lang] || pageId}</span>
                    <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {elements.length - hiddenCount}/{elements.length}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mt-1 ml-4">
                      {elements.map(el => {
                        const key = `${pageId}.${el.id}`;
                        const visible = !form.hiddenElements.includes(key);
                        return (
                          <button key={el.id}
                            onClick={() => toggleElement(pageId, el.id)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-all text-left"
                            style={{
                              background: visible ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
                              border: `1px solid ${visible ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
                              color: visible ? 'var(--success)' : 'var(--text-muted)',
                            }}>
                            {visible ? <Eye size={10} /> : <EyeOff size={10} />}
                            {el.label[lang]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
          {isRu ? 'Отмена' : 'Cancel'}
        </button>
        <button onClick={() => onSave(form)}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
          style={{ background: 'var(--accent)' }}>
          {isRu ? 'Сохранить' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="text-[11px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-lg text-xs"
        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
    </div>
  );
}
