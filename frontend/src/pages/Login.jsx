import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function Login() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      const msg = err.message;
      if (msg === 'User not found') setError(i18n.language === 'ru' ? 'Пользователь не найден' : msg);
      else if (msg === 'Wrong password') setError(i18n.language === 'ru' ? 'Неверный пароль' : msg);
      else if (msg === 'User is disabled') setError(i18n.language === 'ru' ? 'Пользователь отключён' : msg);
      else setError(t('auth.loginError'));
    } finally {
      setLoading(false);
    }
  };

  const toggleLang = () => {
    const newLang = i18n.language === 'ru' ? 'en' : 'ru';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--gradient-bg)' }}
    >
      <div className="glass-static p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('app.title')}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>{t('app.subtitle')}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('auth.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl outline-none transition-all"
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
              }}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl outline-none transition-all"
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
              }}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {loading ? '...' : t('auth.login')}
          </button>
        </form>

        {/* Controls */}
        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={toggleTheme}
            className="text-sm px-3 py-1 rounded-lg transition-all hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={toggleLang}
            className="text-sm px-3 py-1 rounded-lg transition-all hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            {i18n.language === 'ru' ? 'EN' : 'RU'}
          </button>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="text-sm px-3 py-1 rounded-lg transition-all hover:opacity-80"
            style={{ color: 'var(--text-muted)', fontSize: '10px' }}
          >
            {i18n.language === 'ru' ? 'Сброс' : 'Reset'}
          </button>
        </div>
      </div>
    </div>
  );
}
