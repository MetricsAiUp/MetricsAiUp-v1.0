import { Car, Truck, Wrench } from 'lucide-react';
import { POST_STATUS_COLORS as MAP_POST_STATUS_COLORS } from '../../constants';

export const POST_TYPE_ICONS = {
  light: Car,
  heavy: Truck,
  diagnostics: Wrench,
  wash: Wrench,
  tire: Wrench,
  alignment: Wrench,
};

// Цвета блоков таймлайна — единая палитра карты СТО.
// completed (закрытый визит с работами) → зелёный
// active_work (идут работы) → индиго
// occupied (визит идёт, работ нет) → оранжевый
// occupied_no_work (простой) → красный
// scheduled (закрытый визит без работ / запланированный ЗН) → серый
// overdue (просроченный ЗН) → красный
// in_progress — алиас active_work (для запланированных ЗН со статусом in_progress)
export const STATUS_COLORS = {
  completed: { bg: MAP_POST_STATUS_COLORS.free, text: '#fff' },
  active_work: { bg: MAP_POST_STATUS_COLORS.active_work, text: '#fff' },
  in_progress: { bg: MAP_POST_STATUS_COLORS.active_work, text: '#fff' },
  occupied: { bg: MAP_POST_STATUS_COLORS.occupied, text: '#fff' },
  occupied_no_work: { bg: MAP_POST_STATUS_COLORS.occupied_no_work, text: '#fff' },
  scheduled: { bg: 'var(--text-muted)', text: '#fff' },
  overdue: { bg: MAP_POST_STATUS_COLORS.occupied_no_work, text: '#fff' },
};

// Единая палитра статусов поста — соответствует карте СТО (см. constants/index.js).
// `unknown` — алиас `no_data` для обратной совместимости с TimelineRow.
export const POST_STATUS_COLORS = {
  ...MAP_POST_STATUS_COLORS,
  unknown: MAP_POST_STATUS_COLORS.no_data,
};

export function parseTime(timeStr) {
  const d = new Date(timeStr);
  return d.getTime();
}

export function formatTime(timeStr) {
  if (!timeStr) return '\u2014';
  const d = new Date(timeStr);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function getShiftBounds(shiftStart, shiftEnd) {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(`${today}T${shiftStart}:00`).getTime();
  const end = new Date(`${today}T${shiftEnd}:00`).getTime();
  return { start, end, duration: end - start };
}

export function getNowPosition(shiftStart, shiftEnd) {
  const { start, duration } = getShiftBounds(shiftStart, shiftEnd);
  const now = Date.now();
  return Math.max(0, Math.min(100, ((now - start) / duration) * 100));
}

export function getBlockStyle(item, shiftStart, shiftEnd) {
  const { start, duration } = getShiftBounds(shiftStart, shiftEnd);
  const itemStart = parseTime(item.startTime);
  // Открытый визит/ЗН (нет endTime и нет estimatedEnd) — тянем до текущего момента.
  // Для CV-визитов это «авто всё ещё на посту» → блок продолжается до сейчас.
  const now = Date.now();
  const itemEnd = item.endTime
    ? parseTime(item.endTime)
    : item.estimatedEnd
      ? parseTime(item.estimatedEnd)
      : (item.visitClosed === false ? now : parseTime(item.startTime));
  const left = Math.max(0, Math.min(100, ((itemStart - start) / duration) * 100));
  const rawWidth = ((itemEnd - itemStart) / duration) * 100;
  const width = Math.max(0.5, Math.min(rawWidth, 100 - left));
  return { left: `${left}%`, width: `${width}%` };
}

export function getItemStatus(item) {
  // Статусы из мониторинга (визиты CV) — отдаём как есть, без overdue-логики.
  if (item.status === 'completed') return 'completed';
  if (item.status === 'active_work') return 'active_work';
  if (item.status === 'occupied') return 'occupied';
  if (item.status === 'occupied_no_work') return 'occupied_no_work';
  // Запланированные ЗН: scheduled / in_progress (+ overdue по estimatedEnd).
  if (item.status === 'scheduled') return 'scheduled';
  if (item.status === 'in_progress') {
    const est = item.estimatedEnd ? parseTime(item.estimatedEnd) : null;
    if (est && Date.now() > est) return 'overdue';
    return 'in_progress';
  }
  return item.status;
}

// Snap a timestamp to the nearest 15-minute interval
export function snapTo15Min(ms) {
  const d = new Date(ms);
  const minutes = d.getMinutes();
  const snapped = Math.round(minutes / 15) * 15;
  d.setMinutes(snapped, 0, 0);
  return d.getTime();
}

// Calculate time from a percentage position within the shift
export function percentToTime(percent, shiftStart, shiftEnd) {
  const { start, duration } = getShiftBounds(shiftStart, shiftEnd);
  const ms = start + (percent / 100) * duration;
  return snapTo15Min(ms);
}

// Detect time conflicts (overlapping blocks) in all posts
export function detectConflicts(posts) {
  const conflicts = [];
  posts.forEach(post => {
    const items = [...post.timeline].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    for (let i = 0; i < items.length - 1; i++) {
      const endA = new Date(items[i].endTime || items[i].estimatedEnd || items[i].startTime).getTime();
      const startB = new Date(items[i + 1].startTime).getTime();
      if (endA > startB) {
        conflicts.push({ postId: post.id, items: [items[i].id, items[i + 1].id] });
      }
    }
  });
  return conflicts;
}
