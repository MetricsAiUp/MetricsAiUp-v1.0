import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

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
  const { t } = useTranslation();
  const { hasPermission } = useAuth();

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
    </aside>
  );
}
