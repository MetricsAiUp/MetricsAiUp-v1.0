// Селектор IANA-таймзоны для шапки Layout.
//
// - Видно всем: показывает текущую TZ системы (settings.timezone).
// - Менять может только admin: PUT /api/settings { timezone }.
// - При сохранении вызывает onChanged() (например, чтобы перезагрузить страницу
//   и пересчитать локальные форматтеры).
//
// Источник истины — backend /api/settings. localStorage обновляется через
// setAppTimezone() в AuthContext по событию settings:changed.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { TIMEZONE_OPTIONS } from '../constants/timezones';
import { getAppTimezone, setAppTimezone } from '../utils/appTimezone';

export default function TimezoneSelector() {
  const { t } = useTranslation();
  const { user, api } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';
  const [value, setValue] = useState(() => getAppTimezone());
  const [saving, setSaving] = useState(false);

  // При маунте подтягиваем актуальное значение из /api/settings — оно может
  // отличаться от localStorage, если админ менял с другого устройства.
  useEffect(() => {
    let mounted = true;
    api.get('/api/settings')
      .then((r) => {
        if (!mounted) return;
        const tz = r?.data?.timezone;
        if (tz && tz !== value) {
          setValue(tz);
          setAppTimezone(tz);
        }
      })
      .catch(() => { /* read-only fallback на текущее значение */ });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = async (next) => {
    if (!isAdmin || saving || next === value) return;
    setSaving(true);
    try {
      await api.put('/api/settings', { timezone: next });
      setValue(next);
      setAppTimezone(next);
      toast.success(t('layout.tz.saved'));
      // Полная перезагрузка, чтобы все компоненты (включая мемоизованные таблицы)
      // подхватили новое значение TZ. Гарантирует консистентность.
      setTimeout(() => window.location.reload(), 300);
    } catch (e) {
      toast.error(e?.response?.data?.error || t('layout.tz.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const currentOpt = TIMEZONE_OPTIONS.find((o) => o.value === value);
  const currentLabel = currentOpt
    ? `${t(`timezones.${currentOpt.key}`)} (UTC${currentOpt.offset})`
    : value;

  if (!isAdmin) {
    return (
      <span
        className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-xs"
        style={{ color: 'var(--text-secondary)' }}
        title={`${t('layout.tz.title')}: ${value}`}
      >
        <Clock size={14} />
        <span className="hidden md:inline">{currentLabel}</span>
      </span>
    );
  }

  return (
    <label
      className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80 cursor-pointer"
      style={{ color: 'var(--text-secondary)' }}
      title={`${t('layout.tz.title')}: ${value}`}
    >
      <Clock size={14} />
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="bg-transparent border-0 outline-none text-xs cursor-pointer"
        style={{ color: 'var(--text-secondary)' }}
      >
        {TIMEZONE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
            {t(`timezones.${o.key}`)} (UTC{o.offset})
          </option>
        ))}
      </select>
    </label>
  );
}
