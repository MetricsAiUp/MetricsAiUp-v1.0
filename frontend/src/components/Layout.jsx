import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Globe, LogOut, Wifi, WifiOff, Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useSocketStatus } from '../hooks/useSocket';
import Sidebar from './Sidebar';
import NotificationCenter from './NotificationCenter';

function SocketIndicator() {
  const connected = useSocketStatus();
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
      style={{ color: connected ? 'var(--success)' : 'var(--text-muted)' }}
      title={connected ? 'Real-time connected' : 'Real-time disconnected'}>
      {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? 'var(--success)' : 'var(--text-muted)' }} />
    </div>
  );
}

function Header({ onToggleSidebar, onToggleCollapse, collapsed }) {
  const { i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isRu = i18n.language === 'ru';

  const toggleLang = () => {
    const newLang = isRu ? 'en' : 'ru';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <header
      className="h-14 flex items-center justify-between gap-2 px-3 md:px-6 md:justify-end"
      style={{
        background: 'var(--bg-glass)',
        borderBottom: '1px solid var(--border-glass)',
        backdropFilter: 'blur(var(--blur))',
        WebkitBackdropFilter: 'blur(var(--blur))',
      }}
    >
      <div className="flex items-center gap-1">
        {/* Hamburger (mobile only) */}
        <button onClick={onToggleSidebar} className="md:hidden p-2 rounded-lg hover:opacity-80"
          style={{ color: 'var(--text-primary)' }}>
          <Menu size={20} />
        </button>
        {/* Sidebar toggle (desktop) */}
        <button onClick={onToggleCollapse} className="hidden md:flex p-2 rounded-lg hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }} title={collapsed ? 'Show sidebar' : 'Hide sidebar'}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          <span className="hidden md:inline">{theme === 'dark' ? (isRu ? 'Светлая' : 'Light') : (isRu ? 'Тёмная' : 'Dark')}</span>
        </button>

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Globe size={14} />
          <span className="hidden md:inline">{isRu ? 'English' : 'Русский'}</span>
        </button>

        {/* Socket status */}
        <SocketIndicator />

        {/* Notifications */}
        <NotificationCenter />

        {/* Divider */}
        <div className="hidden md:block w-px h-6" style={{ background: 'var(--border-glass)' }} />

        {/* User */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              {user?.firstName} {user?.lastName}
            </p>
            <button
              onClick={logout}
              className="text-xs hover:opacity-80 transition-opacity"
              style={{ color: 'var(--danger)' }}
            >
              {isRu ? 'Выйти' : 'Logout'}
            </button>
          </div>
          <button onClick={logout} className="md:hidden p-1.5 rounded-lg hover:opacity-80"
            style={{ color: 'var(--danger)' }} title={isRu ? 'Выйти' : 'Logout'}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      {!sidebarCollapsed && (
        <div className="hidden md:block">
          <Sidebar />
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full shadow-2xl" style={{ width: 200 }}>
            <div className="flex items-center justify-end p-2">
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          collapsed={sidebarCollapsed} />
        <main className="flex-1 p-3 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
