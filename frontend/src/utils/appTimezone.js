/**
 * Источник IANA-таймзоны на фронте.
 *
 * Backend хранит TZ Location в /api/settings → timezone (fallback Europe/Moscow).
 * AuthContext подтягивает её при логине и при событии settings:changed → setAppTimezone.
 * Любой UI-форматтер дат должен брать TZ через getAppTimezone(), а не из браузера,
 * чтобы пользователи в разных регионах видели одинаковые числа («сегодня», «эта неделя»).
 */

const STORAGE_KEY = 'appTimezone';
const FALLBACK_TZ = 'Europe/Moscow';

let current = null;

function readFromStorage() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

export function getAppTimezone() {
  if (current) return current;
  current = readFromStorage() || FALLBACK_TZ;
  return current;
}

export function setAppTimezone(tz) {
  if (!tz || typeof tz !== 'string') return;
  // Валидация: невалидную TZ Intl уронит
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    return;
  }
  current = tz;
  try { localStorage.setItem(STORAGE_KEY, tz); } catch {}
}

/**
 * YYYY-MM-DD по календарю TZ Location (а не TZ браузера).
 */
export function dateStrInAppTz(d = new Date(), tz = getAppTimezone()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/**
 * День недели 0..6 (Sun..Sat) в TZ Location.
 */
export function dayOfWeekInAppTz(d = new Date(), tz = getAppTimezone()) {
  const wk = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
    .format(d).toLowerCase();
  return { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }[wk];
}

/**
 * Сдвиг YYYY-MM-DD на N календарных дней в TZ Location.
 */
export function addDaysInAppTz(dateStr, deltaDays, tz = getAppTimezone()) {
  // Парсим YYYY-MM-DD как полночь TZ → UTC ms → +дни → обратно YYYY-MM-DD.
  const naive = new Date(`${dateStr}T00:00:00Z`).getTime();
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(naive))
      .filter(p => p.type !== 'literal').map(p => [p.type, p.value])
  );
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const wallInTz = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    hour, Number(parts.minute), Number(parts.second)
  );
  const offsetMs = wallInTz - naive;
  const startUtc = naive - offsetMs;
  return dateStrInAppTz(new Date(startUtc + deltaDays * 86400000), tz);
}

/**
 * Форматирует ISO-строку даты-времени для UI с явной TZ Location.
 */
export function formatDateTimeInAppTz(s, locale = 'ru-RU', tz = getAppTimezone()) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString(locale, {
      timeZone: tz,
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(s);
  }
}

/**
 * Универсальный форматтер: всегда применяет TZ Location.
 * Принимает любые Intl.DateTimeFormatOptions (override дефолтов).
 *   formatInAppTz(iso, { hour: '2-digit', minute: '2-digit' }) — только время
 *   formatInAppTz(iso) — дата + время по умолчанию (как formatDateTimeInAppTz)
 */
export function formatInAppTz(s, options = null, locale = 'ru-RU', tz = getAppTimezone()) {
  if (s == null || s === '') return '—';
  try {
    const d = s instanceof Date ? s : new Date(s);
    if (isNaN(d.getTime())) return String(s);
    const opts = options || {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    };
    return d.toLocaleString(locale, { timeZone: tz, ...opts });
  } catch {
    return String(s);
  }
}

/** Только дата (DD.MM.YYYY) в TZ Location. */
export function formatDateInAppTz(s, locale = 'ru-RU', tz = getAppTimezone()) {
  return formatInAppTz(s, { day: '2-digit', month: '2-digit', year: 'numeric' }, locale, tz);
}

/** Только время (HH:MM) в TZ Location. */
export function formatTimeInAppTz(s, locale = 'ru-RU', tz = getAppTimezone()) {
  return formatInAppTz(s, { hour: '2-digit', minute: '2-digit' }, locale, tz);
}

/** Время с секундами (HH:MM:SS) в TZ Location. */
export function formatTimeSecInAppTz(s, locale = 'ru-RU', tz = getAppTimezone()) {
  return formatInAppTz(s, { hour: '2-digit', minute: '2-digit', second: '2-digit' }, locale, tz);
}
