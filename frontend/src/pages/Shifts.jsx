import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Clock, ChevronLeft, ChevronRight, Plus, Users, Wrench,
  Star, Stethoscope, X, Trash2, Edit3, CheckCircle, AlertTriangle,
  FileText, MapPin,
} from 'lucide-react';
import HelpButton from '../components/HelpButton';

const BASE = import.meta.env.BASE_URL || './';
const fetchApi = async (path) => {
  const res = await fetch(`${BASE}data/${path}.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

const ROLE_ICONS = { mechanic: Wrench, master: Star, diagnostician: Stethoscope };

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function StatusBadge({ status, t }) {
  const styles = {
    planned: { bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent)', border: '1px solid rgba(59, 130, 246, 0.3)' },
    active: { bg: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)', border: '1px solid rgba(34, 197, 94, 0.3)' },
    completed: { bg: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-muted)', border: '1px solid rgba(148, 163, 184, 0.3)' },
  };
  const s = styles[status] || styles.planned;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.color, border: s.border }}
    >
      {t(`shifts.${status}`)}
    </span>
  );
}

// ---- Shift Form Modal ----
function ShiftFormModal({ shift, onSave, onClose, t, isRu }) {
  const [form, setForm] = useState({
    name: shift?.name || (isRu ? 'Утренняя смена' : 'Morning Shift'),
    date: shift?.date || formatDateKey(new Date()),
    startTime: shift?.startTime || '08:00',
    endTime: shift?.endTime || '20:00',
    status: shift?.status || 'planned',
    notes: shift?.notes || '',
    workers: shift?.workers || [],
  });
  const [newWorker, setNewWorker] = useState({ name: '', role: 'mechanic', postId: '' });

  const addWorker = () => {
    if (!newWorker.name.trim()) return;
    setForm(f => ({
      ...f,
      workers: [...f.workers, { id: `sw-new-${Date.now()}`, ...newWorker, postId: newWorker.postId || null }],
    }));
    setNewWorker({ name: '', role: 'mechanic', postId: '' });
  };

  const removeWorker = (id) => {
    setForm(f => ({ ...f, workers: f.workers.filter(w => w.id !== id) }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full max-w-lg rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-glass)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {shift ? t('shifts.editShift') : t('shifts.newShift')}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              {isRu ? 'Название' : 'Name'}
            </label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              {isRu ? 'Дата' : 'Date'}
            </label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
                {isRu ? 'Начало' : 'Start'}
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-lg text-sm"
                style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
                {isRu ? 'Конец' : 'End'}
              </label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-lg text-sm"
                style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
          <div className="col-span-2">
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              {t('shifts.shiftNotes')}
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-1.5 rounded-lg text-sm resize-none"
              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {/* Workers */}
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('shifts.workers')} ({form.workers.length})
          </h4>
          <div className="space-y-1.5 mb-3">
            {form.workers.map(w => {
              const RoleIcon = ROLE_ICONS[w.role] || Wrench;
              return (
                <div
                  key={w.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}
                >
                  <RoleIcon size={13} style={{ color: 'var(--accent)' }} />
                  <span className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t(`shifts.${w.role}`)}</span>
                  {w.postId && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                      {w.postId.replace('post-', isRu ? 'Пост ' : 'Post ')}
                    </span>
                  )}
                  <button onClick={() => removeWorker(w.id)} className="p-0.5 hover:opacity-70" style={{ color: 'var(--danger)' }}>
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
          {/* Add worker row */}
          <div className="flex items-center gap-2">
            <input
              placeholder={isRu ? 'ФИО работника' : 'Worker name'}
              value={newWorker.name}
              onChange={e => setNewWorker(w => ({ ...w, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addWorker()}
              className="flex-1 px-2.5 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
            />
            <select
              value={newWorker.role}
              onChange={e => setNewWorker(w => ({ ...w, role: e.target.value }))}
              className="px-2 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
            >
              <option value="mechanic">{t('shifts.mechanic')}</option>
              <option value="master">{t('shifts.master')}</option>
              <option value="diagnostician">{t('shifts.diagnostician')}</option>
            </select>
            <input
              placeholder={isRu ? 'Пост' : 'Post'}
              value={newWorker.postId}
              onChange={e => setNewWorker(w => ({ ...w, postId: e.target.value }))}
              className="w-20 px-2 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={addWorker}
              className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-sm"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}
          >
            {t('shifts.cancel')}
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-4 py-1.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {t('shifts.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Handover Act Modal ----
function HandoverModal({ shift, onConfirm, onClose, t, isRu }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full max-w-lg rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-glass)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('shifts.handoverAct')}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Смена' : 'Shift'}</span>
            <span style={{ color: 'var(--text-primary)' }}>{shift.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Дата' : 'Date'}</span>
            <span style={{ color: 'var(--text-primary)' }}>{shift.date}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Время' : 'Time'}</span>
            <span style={{ color: 'var(--text-primary)' }}>{shift.startTime} - {shift.endTime}</span>
          </div>
        </div>

        {/* Post status summary */}
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('shifts.postStatus')}
          </h4>
          <div className="space-y-1.5">
            {shift.workers.filter(w => w.postId).map(w => (
              <div
                key={w.id}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}
              >
                <MapPin size={13} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                  {w.postId.replace('post-', isRu ? 'Пост ' : 'Post ')}
                </span>
                <span className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t(`shifts.${w.role}`)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Worker summary */}
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('shifts.workers')} ({shift.workers.length})
          </h4>
          <div className="grid grid-cols-2 gap-1.5">
            {shift.workers.map(w => {
              const hours = (() => {
                const [sh, sm] = shift.startTime.split(':').map(Number);
                const [eh, em] = shift.endTime.split(':').map(Number);
                return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
              })();
              return (
                <div
                  key={w.id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{hours}{isRu ? 'ч' : 'h'}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-sm"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}
          >
            {t('shifts.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--success)', color: '#fff' }}
          >
            <CheckCircle size={14} />
            {t('shifts.confirmComplete')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Shift Detail Modal ----
function ShiftDetailModal({ shift, onEdit, onComplete, onDelete, onClose, t, isRu }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full max-w-lg rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-glass)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{shift.name}</h3>
            <StatusBadge status={shift.status} t={t} />
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Дата' : 'Date'}</span>
            <span style={{ color: 'var(--text-primary)' }}>
              {new Date(shift.date + 'T00:00:00').toLocaleDateString(isRu ? 'ru-RU' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Время' : 'Time'}</span>
            <span style={{ color: 'var(--text-primary)' }}>{shift.startTime} - {shift.endTime}</span>
          </div>
          {shift.notes && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>{t('shifts.shiftNotes')}</span>
              <span style={{ color: 'var(--text-primary)' }}>{shift.notes}</span>
            </div>
          )}
          {shift.workOrdersCount != null && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Заказ-наряды' : 'Work Orders'}</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {shift.completedCount || 0} / {shift.workOrdersCount}
              </span>
            </div>
          )}
        </div>

        {/* Workers table */}
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('shifts.workers')} ({shift.workers?.length || 0})
          </h4>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--bg-glass)' }}>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>{t('shifts.worker')}</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>{t('shifts.role')}</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>{t('shifts.assignedPost')}</th>
                </tr>
              </thead>
              <tbody>
                {(shift.workers || []).map(w => {
                  const RoleIcon = ROLE_ICONS[w.role] || Wrench;
                  return (
                    <tr key={w.id} style={{ borderTop: '1px solid var(--border-glass)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                        <div className="flex items-center gap-1.5">
                          <RoleIcon size={12} style={{ color: 'var(--accent)' }} />
                          <Link
                            to={`/worker-stats/${encodeURIComponent(w.name)}`}
                            className="hover:underline"
                            style={{ color: 'var(--accent)' }}
                            onClick={e => e.stopPropagation()}
                          >
                            {w.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                        {t(`shifts.${w.role}`)}
                      </td>
                      <td className="px-3 py-2" style={{ color: w.postId ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {w.postId ? w.postId.replace('post-', isRu ? 'Пост ' : 'Post ') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs hover:opacity-80"
            style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
          >
            <Trash2 size={13} /> {t('shifts.delete')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}
            >
              <Edit3 size={13} /> {t('shifts.editShift')}
            </button>
            {shift.status === 'active' && (
              <button
                onClick={onComplete}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: 'var(--success)', color: '#fff' }}
              >
                <CheckCircle size={13} /> {t('shifts.completeShift')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==== Main Shifts Component ====
export default function Shifts() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api } = useAuth();

  const [allShifts, setAllShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedShift, setSelectedShift] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [showHandover, setShowHandover] = useState(null);
  const [conflictModal, setConflictModal] = useState(null);

  // Load shifts data
  useEffect(() => {
    setLoading(true);
    fetchApi('shifts')
      .then(data => setAllShifts(data.shifts || []))
      .catch(() => setAllShifts([]))
      .finally(() => setLoading(false));
  }, []);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const shiftsByDate = useMemo(() => {
    const map = {};
    allShifts.forEach(s => {
      const key = s.date;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [allShifts]);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const todayKey = formatDateKey(new Date());

  // Conflict detection (client-side)
  function detectClientConflicts(form) {
    const conflicts = [];
    // Duplicate workers on different posts in same shift
    const nameMap = {};
    for (const w of (form.workers || [])) {
      if (nameMap[w.name] && w.postId && nameMap[w.name] !== w.postId) {
        conflicts.push({ type: 'same_shift_duplicate', workerName: w.name, post1: nameMap[w.name], post2: w.postId });
      }
      if (w.postId) nameMap[w.name] = w.postId;
    }
    // Cross-shift conflicts on same day
    const sameDayShifts = allShifts.filter(s => {
      if (editingShift && s.id === editingShift.id) return false;
      return s.date === form.date;
    });
    for (const w of (form.workers || [])) {
      for (const es of sameDayShifts) {
        const overlap = form.startTime < es.endTime && form.endTime > es.startTime;
        if (overlap && es.workers?.some(ew => ew.name === w.name)) {
          conflicts.push({
            type: 'cross_shift_overlap',
            workerName: w.name,
            conflictingShiftName: es.name,
            conflictingTime: `${es.startTime}-${es.endTime}`,
          });
        }
      }
    }
    return conflicts;
  }

  // CRUD
  const doSave = (form) => {
    if (editingShift) {
      setAllShifts(prev => prev.map(s => s.id === editingShift.id ? { ...s, ...form } : s));
    } else {
      const newShift = {
        ...form,
        id: `shift-${Date.now()}`,
        workOrdersCount: 0,
        completedCount: 0,
      };
      setAllShifts(prev => [...prev, newShift]);
    }
    const updated = editingShift
      ? allShifts.map(s => s.id === editingShift.id ? { ...s, ...form } : s)
      : [...allShifts, { ...form, id: `shift-${Date.now()}`, workOrdersCount: 0, completedCount: 0 }];
    localStorage.setItem('shiftsData', JSON.stringify({ shifts: updated }));
    setShowForm(false);
    setEditingShift(null);
    setConflictModal(null);
  };

  const handleSave = (form) => {
    const conflicts = detectClientConflicts(form);
    if (conflicts.length > 0) {
      setConflictModal({ conflicts, form });
      return;
    }
    doSave(form);
  };

  const handleDelete = (shiftId) => {
    if (!confirm(t('shifts.deleteConfirm'))) return;
    const updated = allShifts.filter(s => s.id !== shiftId);
    setAllShifts(updated);
    localStorage.setItem('shiftsData', JSON.stringify({ shifts: updated }));
    setSelectedShift(null);
  };

  const handleComplete = (shift) => {
    setSelectedShift(null);
    setShowHandover(shift);
  };

  const confirmComplete = () => {
    const shift = showHandover;
    const updated = allShifts.map(s => s.id === shift.id ? { ...s, status: 'completed' } : s);
    setAllShifts(updated);
    localStorage.setItem('shiftsData', JSON.stringify({ shifts: updated }));

    // Save handover act
    const handoverData = JSON.parse(localStorage.getItem('shiftHandovers') || '[]');
    handoverData.push({
      shiftId: shift.id,
      completedAt: new Date().toISOString(),
      workers: shift.workers,
    });
    localStorage.setItem('shiftHandovers', JSON.stringify(handoverData));
    setShowHandover(null);
  };

  const weekLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const opts = { day: 'numeric', month: 'short' };
    const locale = isRu ? 'ru-RU' : 'en-US';
    return `${weekStart.toLocaleDateString(locale, opts)} - ${end.toLocaleDateString(locale, opts)} ${end.getFullYear()}`;
  }, [weekStart, isRu]);

  const dayNames = useMemo(() => {
    return weekDays.map(d =>
      d.toLocaleDateString(isRu ? 'ru-RU' : 'en-US', { weekday: 'short' })
    );
  }, [weekDays, isRu]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            {t('shifts.title')}
            <HelpButton pageKey="shifts" />
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('shifts.weekOf')} {weekLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Week navigation */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <button onClick={prevWeek} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium px-2" style={{ color: 'var(--text-primary)', minWidth: 180, textAlign: 'center' }}>
              {weekLabel}
            </span>
            <button onClick={nextWeek} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={() => { setEditingShift(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={15} />
            {t('shifts.newShift')}
          </button>
        </div>
      </div>

      {/* Weekly Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, i) => {
          const dateKey = formatDateKey(day);
          const shifts = shiftsByDate[dateKey] || [];
          const isToday = dateKey === todayKey;
          const isPast = dateKey < todayKey;

          return (
            <div
              key={dateKey}
              className="rounded-xl p-2 flex flex-col min-h-[180px]"
              style={{
                background: isToday ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-glass)',
                border: isToday ? '2px solid var(--accent)' : '1px solid var(--border-glass)',
                backdropFilter: 'blur(12px)',
                opacity: isPast ? 0.7 : 1,
              }}
            >
              {/* Day header */}
              <div className="text-center mb-2 pb-1.5" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <div className="text-xs font-medium uppercase" style={{ color: isToday ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {dayNames[i]}
                </div>
                <div
                  className={`text-lg font-bold ${isToday ? 'inline-flex items-center justify-center w-8 h-8 rounded-full' : ''}`}
                  style={{
                    color: isToday ? '#fff' : 'var(--text-primary)',
                    background: isToday ? 'var(--accent)' : 'transparent',
                  }}
                >
                  {day.getDate()}
                </div>
              </div>

              {/* Shift cards */}
              <div className="flex-1 space-y-1.5">
                {shifts.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('shifts.noShifts')}</p>
                  </div>
                )}
                {shifts.map(shift => (
                  <button
                    key={shift.id}
                    onClick={() => setSelectedShift(shift)}
                    className="w-full text-left rounded-lg p-2.5 hover:opacity-90 transition-all cursor-pointer"
                    style={{
                      background: shift.status === 'active'
                        ? 'rgba(34, 197, 94, 0.12)'
                        : shift.status === 'completed'
                          ? 'rgba(148, 163, 184, 0.12)'
                          : 'rgba(59, 130, 246, 0.12)',
                      border: `1px solid ${
                        shift.status === 'active' ? 'rgba(34, 197, 94, 0.3)'
                          : shift.status === 'completed' ? 'rgba(148, 163, 184, 0.3)'
                            : 'rgba(59, 130, 246, 0.3)'
                      }`,
                    }}
                  >
                    <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                      {shift.name}
                    </div>
                    <div className="mb-1.5"><StatusBadge status={shift.status} t={t} /></div>
                    <div className="grid grid-cols-[12px_1fr] gap-x-1.5 gap-y-0.5 items-center">
                      <Clock size={10} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {shift.startTime}–{shift.endTime}
                      </span>
                      <Users size={10} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {shift.workers?.length || 0} {isRu ? 'чел.' : 'ppl'}
                      </span>
                      {shift.workOrdersCount > 0 && (<>
                        <FileText size={10} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {shift.completedCount || 0}/{shift.workOrdersCount} {isRu ? 'ЗН' : 'WO'}
                        </span>
                      </>)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {selectedShift && (
        <ShiftDetailModal
          shift={selectedShift}
          onEdit={() => { setEditingShift(selectedShift); setSelectedShift(null); setShowForm(true); }}
          onComplete={() => handleComplete(selectedShift)}
          onDelete={() => handleDelete(selectedShift.id)}
          onClose={() => setSelectedShift(null)}
          t={t}
          isRu={isRu}
        />
      )}

      {showForm && (
        <ShiftFormModal
          shift={editingShift}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingShift(null); }}
          t={t}
          isRu={isRu}
        />
      )}

      {showHandover && (
        <HandoverModal
          shift={showHandover}
          onConfirm={confirmComplete}
          onClose={() => setShowHandover(null)}
          t={t}
          isRu={isRu}
        />
      )}

      {/* Conflict detection modal */}
      {conflictModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            className="w-full max-w-md rounded-2xl p-5 space-y-4"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-glass)' }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('shifts.conflictDetected')}
              </h3>
            </div>
            <div className="space-y-2">
              {conflictModal.conflicts.map((c, i) => (
                <div key={i} className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid var(--warning)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.workerName}</span>
                  {' '}
                  <span style={{ color: 'var(--text-muted)' }}>
                    {c.type === 'same_shift_duplicate'
                      ? `${t('shifts.duplicateWorker')}: ${c.post1} / ${c.post2}`
                      : `${t('shifts.crossShiftConflict')} "${c.conflictingShiftName}" (${c.conflictingTime})`
                    }
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConflictModal(null)}
                className="px-4 py-1.5 rounded-xl text-sm"
                style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}
              >
                {t('shifts.fixConflicts')}
              </button>
              <button
                onClick={() => doSave(conflictModal.form)}
                className="px-4 py-1.5 rounded-xl text-sm font-medium"
                style={{ background: 'var(--warning)', color: '#fff' }}
              >
                {t('shifts.saveAnyway')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
