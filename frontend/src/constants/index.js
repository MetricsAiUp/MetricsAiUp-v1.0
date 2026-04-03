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

// --- All cameras (10 cameras at STO) ---
export const ALL_CAMERAS = [
  { id: 'cam01', name: 'Камера 1 — Въезд', location: 'Въезд', coverage: 'Въезд/выезд' },
  { id: 'cam02', name: 'Камера 2 — Выезд', location: 'Выезд', coverage: 'Въезд/выезд' },
  { id: 'cam03', name: 'Камера 3 — Проезд L', location: 'Проезд (лево)', coverage: 'Посты 1-3' },
  { id: 'cam04', name: 'Камера 4 — Проезд R', location: 'Проезд (право)', coverage: 'Посты 4-5' },
  { id: 'cam05', name: 'Камера 5 — Проезд C', location: 'Проезд (центр)', coverage: 'Посты 5-7' },
  { id: 'cam06', name: 'Камера 6 — Верх L', location: 'Стена (верх лево)', coverage: 'Посты 5-6' },
  { id: 'cam07', name: 'Камера 7 — Верх R', location: 'Стена (верх право)', coverage: 'Посты 8-9' },
  { id: 'cam08', name: 'Камера 8 — Низ L', location: 'Стена (низ лево)', coverage: 'Посты 1-2' },
  { id: 'cam09', name: 'Камера 9 — Низ R', location: 'Стена (низ право)', coverage: 'Посты 3-4, 10' },
  { id: 'cam10', name: 'Камера 10 — Парковка', location: 'Парковка', coverage: 'Зона ожидания' },
];

// --- Zone type colors (for Cameras, CameraMapping) ---
export const ZONE_TYPE_COLORS = {
  repair: '#6366f1',
  entry: '#10b981',
  parking: '#f59e0b',
  waiting: '#3b82f6',
  diagnostics: '#a855f7',
};
