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
    <aside
      className="glass-static min-h-screen p-3 flex flex-col flex-shrink-0"
      style={{ width: 160, minWidth: 160, maxWidth: 160, borderRadius: 0, borderRight: '1px solid var(--border-glass)' }}
    >
      {/* Logo */}
      <div className="mb-5 px-1">
        <h1 className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
          {t('app.title')}
        </h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.2 }}>
          {t('app.subtitle')}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map(item => (
          hasPermission(item.permission) && (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  isActive ? 'font-medium' : 'hover:opacity-80'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-light)' : 'transparent',
                fontSize: '11px',
              })}
            >
              <span style={{ fontSize: '13px', flexShrink: 0 }}>{item.icon}</span>
              <span className="truncate">{t(item.labelKey)}</span>
            </NavLink>
          )
        ))}
      </nav>
    </aside>
  );
}
