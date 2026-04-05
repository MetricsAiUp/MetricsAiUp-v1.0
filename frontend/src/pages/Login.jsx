import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { Sun, Moon } from 'lucide-react';

export default function Login() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError(i18n.language === 'ru' ? 'Введите email и пароль' : 'Enter email and password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const userData = await login(email.trim(), password);
      toast.success(i18n.language === 'ru' ? `Добро пожаловать, ${userData.firstName}!` : `Welcome, ${userData.firstName}!`);
    } catch (err) {
      const msg = err.message;
      const isRu = i18n.language === 'ru';
      let errMsg;
      if (msg.includes('Неверный') || msg === 'Wrong password' || msg === 'User not found') {
        errMsg = isRu ? 'Неверный email или пароль' : 'Invalid email or password';
      } else if (msg === 'User is disabled' || msg.includes('деактивирован')) {
        errMsg = isRu ? 'Пользователь отключён' : 'User is disabled';
      } else if (msg.includes('429') || msg.includes('Слишком много')) {
        errMsg = isRu ? 'Слишком много попыток. Подождите минуту' : 'Too many attempts. Wait a minute';
      } else {
        errMsg = isRu ? 'Ошибка входа' : 'Login error';
      }
      setError(errMsg);
      toast.error(errMsg);
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
