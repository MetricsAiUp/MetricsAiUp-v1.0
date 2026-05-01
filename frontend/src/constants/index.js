// ============================
// Shared constants — single source of truth
// ============================

// --- Polling ---
export const POLLING_INTERVAL = 5000; // ms

// --- Post status colors (for STOMap, MapView, DashboardPosts) ---
export const POST_STATUS_COLORS = {
  free: '#10b981',
  occupied: '#f59e0b',
  occupied_no_work: '#ef4444',
  active_work: '#6366f1',
  no_data: '#64748b', // slate-500 — пост в БД/на карте, но не репортится CV
};

// --- Work order status colors ---
export const WO_STATUS_COLORS = {
  scheduled: 'var(--info)',
  in_progress: 'var(--warning)',
  completed: 'var(--success)',
  cancelled: 'var(--text-muted)',
  no_show: 'var(--danger)',
  overdue: 'var(--danger)',
};

// --- Event types (CV system) ---
export const EVENT_TYPES = {
  vehicle_entered_zone: { ru: 'Авто въехало в зону', en: 'Vehicle entered zone', color: '#6366f1' },
  vehicle_left_zone: { ru: 'Авто покинуло зону', en: 'Vehicle left zone', color: '#94a3b8' },
  vehicle_moving: { ru: 'Авто в движении', en: 'Vehicle moving', color: '#3b82f6' },
  post_occupied: { ru: 'Пост занят', en: 'Post occupied', color: '#f59e0b' },
  post_vacated: { ru: 'Пост освобождён', en: 'Post vacated', color: '#10b981' },
  worker_present: { ru: 'Работник на посту', en: 'Worker present', color: '#22c55e' },
  worker_absent: { ru: 'Работник ушёл', en: 'Worker absent', color: '#ef4444' },
  work_activity: { ru: 'Активная работа', en: 'Work activity', color: '#8b5cf6' },
  work_idle: { ru: 'Простой', en: 'Idle', color: '#eab308' },
  plate_recognized: { ru: 'Номер распознан', en: 'Plate recognized', color: '#06b6d4' },
};

// --- All cameras (15 cameras at STO, cam01 & cam06 outside building) ---
export const ALL_CAMERAS = [
  { id: 'cam01', name: 'cam 01', location: 'За пределами СТО', coverage: 'Внешняя территория' },
  { id: 'cam02', name: 'cam 02', location: 'Верхний ряд, лево', coverage: 'ПОСТ 06, ПОСТ 05' },
  { id: 'cam03', name: 'cam 03', location: 'Нижний ряд, лево', coverage: 'ПОСТ 07, Свободная зона 07' },
  { id: 'cam04', name: 'cam 04', location: 'Нижний ряд, центр', coverage: 'ПОСТ 08, ПОСТ 09' },
  { id: 'cam05', name: 'cam 05', location: 'Нижний ряд, лево', coverage: 'Свободная зона 04' },
  { id: 'cam06', name: 'cam 06', location: 'За пределами СТО', coverage: 'Внешняя территория' },
  { id: 'cam07', name: 'cam 07', location: 'Нижний ряд, право', coverage: 'ПОСТ 10' },
  { id: 'cam08', name: 'cam 08', location: 'Проезд, лево', coverage: 'Свободная зона 05, ПОСТ 07' },
  { id: 'cam09', name: 'cam 09', location: 'Верхний ряд, центр', coverage: 'ПОСТ 04, ПОСТ 05' },
  { id: 'cam10', name: 'cam 10', location: 'Проезд, центр', coverage: 'Свободная зона 05, 06' },
  { id: 'cam11', name: 'cam 11', location: 'Верхний ряд, центр-право', coverage: 'ПОСТ 03, Свободная зона 06' },
  { id: 'cam12', name: 'cam 12', location: 'Верхний ряд, право', coverage: 'ПОСТ 02, ПОСТ 03' },
  { id: 'cam13', name: 'cam 13', location: 'Верхний ряд, центр-право', coverage: 'Свободная зона 06' },
  { id: 'cam14', name: 'cam 14', location: 'Правая стена', coverage: 'ПОСТ 01, Свободная зона 01' },
  { id: 'cam15', name: 'cam 15', location: 'Верхний ряд, дальний', coverage: 'Свободная зона 02, ПОСТ 02' },
];

// --- Zone type colors (for Cameras, CameraMapping) ---
export const ZONE_TYPE_COLORS = {
  repair: '#6366f1',
  entry: '#10b981',
  parking: '#f59e0b',
  waiting: '#3b82f6',
  diagnostics: '#a855f7',
};

// ============================
// Map typography — единый источник правды
// для всех Konva-текстов на карте СТО
// (MapViewer, MapEditor, STOMap)
// ============================

// Единый стек шрифтов — Inter (Google Fonts) + локальные fallback'и.
// Inter подгружается в frontend/index.html через <link>.
export const MAP_FONT_FAMILY =
  "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// Моно-стек для номерных знаков
export const MAP_FONT_MONO =
  "'JetBrains Mono', 'SF Mono', 'Fira Code', Menlo, Consolas, 'Roboto Mono', monospace";

// Адаптивные размеры шрифта для карточек постов/зон.
// Сохраняем масштабирование от ширины окна, но через одну формулу,
// чтобы пропорции между header/body/plate были одинаковыми.
// width — реальная ширина элемента в пикселях.
export function mapFontSizes(width) {
  // Базовый размер — растёт от 8px (узкий пост ~80px) до 11px (большой ~140px+)
  const base = Math.max(8, Math.min(11, Math.round(width / 13)));
  return {
    header: base + 1,                  // «Пост 8», «Зона 07»
    status: base,                      // «Свободен», «Активная работа»
    plate:  base + 2,                  // номер машины
    body:   base,                      // марка/модель
    detail: base - 1,                  // цвет · кузов · уверенность
    badge:  Math.max(7, base - 2),     // счётчик в углу зоны
  };
}

// Унифицированная палитра текста для карты.
// Каждое поле — { dark, light } для текущей темы.
export const MAP_TEXT_COLORS = {
  primary:       { dark: '#f1f5f9', light: '#1e293b' }, // основной — номер, бренд
  secondary:     { dark: '#cbd5e1', light: '#334155' }, // второстепенный
  muted:         { dark: '#94a3b8', light: '#64748b' }, // приглушённый — детали
  accent:        { dark: '#a5b4fc', light: '#6366f1' }, // акцент — «Работы ведутся»
  empty:         { dark: '#334155', light: '#cbd5e1' }, // плейсхолдер «—»
  onColor:       '#ffffff',                              // текст поверх цветного хедера
  onColorMuted:  'rgba(255,255,255,0.92)',               // приглушённый поверх хедера
  conf: { high: '#22c55e', medium: '#f59e0b', low: '#ef4444' }, // уровни уверенности
};

// Лёгкий letter-spacing для заголовков — выравнивает кириллицу/латиницу
export const MAP_LETTER_SPACING = {
  header: 0.3,
  plate:  1.0,
  body:   0,
};

// Привести строку к Title Case ("kia kia" → "Kia Kia", "VOLVO" → "Volvo")
// Для нормализации брендов/моделей, приходящих с CV в разном регистре.
export function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str || '';
  return str
    .toLowerCase()
    .split(/(\s+)/) // сохраняем пробелы как есть
    .map((part) => (/^\s+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}
