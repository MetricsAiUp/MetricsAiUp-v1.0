import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Map, Car, ClipboardList, ScrollText,
  BarChart3, Camera, Focus, Database,
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', permission: 'view_dashboard' },
  { path: '/map', icon: Map, labelKey: 'nav.map', permission: 'view_zones' },
  { path: '/sessions', icon: Car, labelKey: 'nav.sessions', permission: 'view_sessions' },
  { path: '/work-orders', icon: ClipboardList, labelKey: 'nav.workOrders', permission: 'view_work_orders' },
  { path: '/events', icon: ScrollText, labelKey: 'nav.events', permission: 'view_events' },
  { path: '/analytics', icon: BarChart3, labelKey: 'nav.analytics', permission: 'view_analytics' },
  { path: '/cameras', icon: Camera, labelKey: 'nav.cameras', permission: 'view_cameras' },
  { path: '/camera-mapping', icon: Focus, labelKey: 'nav.cameraMapping', permission: 'manage_cameras' },
  { path: '/data-1c', icon: Database, labelKey: 'nav.data1c', permission: 'view_work_orders' },
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
        {navItems.map(item => {
          const Icon = item.icon;
          return hasPermission(item.permission) && (
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
              <Icon size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span className="truncate">{t(item.labelKey)}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
