import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Sidebar from './Sidebar';

function Header() {
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
      className="h-14 flex items-center justify-end gap-4 px-6"
      style={{
        background: 'var(--bg-glass)',
        borderBottom: '1px solid var(--border-glass)',
        backdropFilter: 'blur(var(--blur))',
        WebkitBackdropFilter: 'blur(var(--blur))',
      }}
    >
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
        <span>{theme === 'dark' ? (isRu ? 'Светлая' : 'Light') : (isRu ? 'Тёмная' : 'Dark')}</span>
      </button>

      {/* Language toggle */}
      <button
        onClick={toggleLang}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span>🌐</span>
        <span>{isRu ? 'English' : 'Русский'}</span>
      </button>

      {/* Divider */}
      <div className="w-px h-6" style={{ background: 'var(--border-glass)' }} />

      {/* User */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
        <div>
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
      </div>
    </header>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
