import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const navItems = [
  { path: '/', icon: '📊', labelKey: 'nav.dashboard', permission: 'view_dashboard' },
  { path: '/map', icon: '🗺️', labelKey: 'nav.map', permission: 'view_zones' },
  { path: '/sessions', icon: '🚗', labelKey: 'nav.sessions', permission: 'view_sessions' },
  { path: '/work-orders', icon: '📋', labelKey: 'nav.workOrders', permission: 'view_work_orders' },
  { path: '/events', icon: '📝', labelKey: 'nav.events', permission: 'view_events' },
  { path: '/analytics', icon: '📈', labelKey: 'nav.analytics', permission: 'view_analytics' },
  { path: '/cameras', icon: '📹', labelKey: 'nav.cameras', permission: 'view_cameras' },
  { path: '/camera-mapping', icon: '🎯', labelKey: 'nav.cameraMapping', permission: 'manage_cameras' },
  { path: '/data-1c', icon: '🏢', labelKey: 'nav.data1c', permission: 'view_work_orders' },
];

export default function Sidebar() {
  const { t, i18n } = useTranslation();
  const { user, logout, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const toggleLang = () => {
    const newLang = i18n.language === 'ru' ? 'en' : 'ru';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <aside className="glass-static w-64 min-h-screen p-4 flex flex-col" style={{ borderRadius: 0, borderRight: '1px solid var(--border-glass)' }}>
      {/* Logo */}
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--accent)' }}>
          {t('app.title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('app.subtitle')}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map(item => (
          hasPermission(item.permission) && (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${
                  isActive
                    ? 'glass font-medium'
                    : 'hover:opacity-80'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-light)' : 'transparent',
              })}
            >
              <span>{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </NavLink>
          )
        ))}
      </nav>

      {/* Controls */}
      <div className="space-y-2 pt-4 border-t" style={{ borderColor: 'var(--border-glass)' }}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? t('theme.light') : t('theme.dark')}</span>
        </button>

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span>🌐</span>
          <span>{i18n.language === 'ru' ? 'English' : 'Русский'}</span>
        </button>

        {/* User & Logout */}
        <div className="px-3 py-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {user?.firstName} {user?.lastName}
          </p>
          <button
            onClick={logout}
            className="text-xs mt-1 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--danger)' }}
          >
            {t('nav.logout')}
          </button>
        </div>
      </div>
    </aside>
  );
}
