import { Car, Truck, Wrench } from 'lucide-react';

export const POST_TYPE_ICONS = {
  light: Car,
  heavy: Truck,
  diagnostics: Wrench,
  wash: Wrench,
  tire: Wrench,
  alignment: Wrench,
};

export const STATUS_COLORS = {
  completed: { bg: 'var(--success)', text: '#fff' },
  in_progress: { bg: 'var(--accent)', text: '#fff' },
  scheduled: { bg: 'var(--text-muted)', text: '#fff' },
  overdue: { bg: 'var(--danger)', text: '#fff' },
};

export const POST_STATUS_COLORS = {
  occupied: 'var(--danger)',
  free: 'var(--success)',
  unknown: 'var(--text-muted)',
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
  const itemEnd = parseTime(item.endTime || item.estimatedEnd || item.startTime);
  const left = Math.max(0, ((itemStart - start) / duration) * 100);
  const width = Math.max(2, ((itemEnd - itemStart) / duration) * 100);
  return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
}

export function getItemStatus(item) {
  if (item.status === 'completed') return 'completed';
  if (item.status === 'scheduled') return 'scheduled';
  if (item.status === 'in_progress') {
    const est = item.estimatedEnd ? parseTime(item.estimatedEnd) : null;
    if (est && Date.now() > est) return 'overdue';
    return 'in_progress';
  }
  return item.status;
}
