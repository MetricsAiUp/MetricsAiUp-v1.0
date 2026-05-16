// Форматирование «марка + модель» от внешнего CV API.
// API склонен присылать дубли (make === model: "Bmw"/"Bmw") и плейсхолдер
// неизвестности ("Other"). Эта утилка нормализует оба случая.
//
// Возвращает строку либо null, если ничего осмысленного показать нельзя —
// тогда в точке вызова показывайте локализованный fallback (t('common.unknownVehicle')).

const PLACEHOLDER_VALUES = new Set(['', 'other', 'unknown', 'n/a', '-', '—']);

function normalize(value) {
  return (value ?? '').toString().trim();
}

function isPlaceholder(value) {
  return PLACEHOLDER_VALUES.has(normalize(value).toLowerCase());
}

function titleCase(value) {
  return normalize(value).replace(/\b\w/g, c => c.toUpperCase());
}

export function formatCarName({ make, model } = {}) {
  const m = isPlaceholder(make) ? '' : titleCase(make);
  const mo = isPlaceholder(model) ? '' : titleCase(model);

  if (!m && !mo) return null;
  if (!m) return mo;
  if (!mo) return m;

  // Дубль "Bmw Bmw" → "Bmw"
  if (m.toLowerCase() === mo.toLowerCase()) return m;

  // make — префикс model (например, "Mercedes" + "Mercedes-Benz") → только model
  if (mo.toLowerCase().startsWith(m.toLowerCase())) return mo;

  return `${m} ${mo}`;
}
