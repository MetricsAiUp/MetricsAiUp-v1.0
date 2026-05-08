/**
 * Утилиты работы с датой/временем относительно IANA-таймзоны Location (а не TZ хоста).
 *
 * Принцип:
 *   1) В БД и в логике всё хранится/считается в UTC (Date / ms-эпоха).
 *   2) Все «календарные» операции (день недели, начало суток, YYYY-MM-DD)
 *      берут TZ из настроек Location, а не из локали сервера.
 *   3) Возвращаемые границы — UTC-моменты (Date или ms), которые можно
 *      напрямую подставлять в Prisma { gte, lt }.
 *
 * Источник истины TZ: backend/src/routes/settings.js → readSettings().timezone
 * (fallback Europe/Moscow).
 */

const DEFAULT_TZ = 'Europe/Moscow';

/**
 * Возвращает IANA-таймзону из объекта settings.
 */
function tzOf(settings) {
  return settings && settings.timezone ? settings.timezone : DEFAULT_TZ;
}

/**
 * Парсит wall-clock «YYYY-MM-DD» + «HH:MM» в указанной IANA-таймзоне
 * и возвращает соответствующий UTC-timestamp (ms).
 * Не зависит от TZ хост-системы.
 */
function parseInTz(dateStr, timeStr, tz) {
  const naive = new Date(`${dateStr}T${timeStr}:00Z`).getTime();
  if (!Number.isFinite(naive)) return NaN;
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(naive))
      .filter(p => p.type !== 'literal')
      .map(p => [p.type, p.value])
  );
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const wallInTz = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    hour, Number(parts.minute), Number(parts.second)
  );
  const offsetMs = wallInTz - naive;
  return naive - offsetMs;
}

/**
 * Возвращает дату YYYY-MM-DD «по часам» указанной таймзоны (а не UTC).
 */
function dateStrInTz(d, tz) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return dtf.format(d); // en-CA → YYYY-MM-DD
}

/**
 * Возвращает короткий ключ дня недели (mon..sun) по часам TZ.
 */
function dayKeyInTz(d, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
  return dtf.format(d).toLowerCase();
}

/**
 * Возвращает день недели как число 0..6 (Sun..Sat) по часам TZ.
 * Совместим с поведением Date#getDay().
 */
function dayOfWeekInTz(d, tz) {
  const map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  return map[dayKeyInTz(d, tz)];
}

/**
 * Возвращает {hour, minute} текущего момента в указанной TZ.
 */
function hourMinuteInTz(d, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(d).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
  );
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  return { hour, minute: Number(parts.minute) };
}

/**
 * Возвращает UTC-границы календарного дня в указанной TZ:
 * { start: Date, end: Date } — start = 00:00 TZ, end = 24:00 TZ.
 * Аргумент d — либо Date (тогда берём дату по TZ), либо строка YYYY-MM-DD.
 */
function getDayBoundsInTz(d, tz) {
  const dateStr = typeof d === 'string' ? d : dateStrInTz(d, tz);
  const startMs = parseInTz(dateStr, '00:00', tz);
  const endMs = startMs + 86400000;
  return { start: new Date(startMs), end: new Date(endMs), dateStr };
}

/**
 * Сдвигает YYYY-MM-DD на N календарных суток в TZ
 * (через парсинг полночи TZ + UTC-арифметика).
 */
function addDaysInTz(dateStr, deltaDays, tz) {
  const startOfDayUtc = parseInTz(dateStr, '00:00', tz);
  const shifted = new Date(startOfDayUtc + deltaDays * 86400000);
  return dateStrInTz(shifted, tz);
}

module.exports = {
  DEFAULT_TZ,
  tzOf,
  parseInTz,
  dateStrInTz,
  dayKeyInTz,
  dayOfWeekInTz,
  hourMinuteInTz,
  getDayBoundsInTz,
  addDaysInTz,
};
