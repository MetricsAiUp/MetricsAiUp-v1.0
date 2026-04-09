import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  FileSpreadsheet, Plus, Trash2, Play, ToggleLeft, ToggleRight, X, Clock,
} from 'lucide-react';
import HelpButton from '../components/HelpButton';

const DAYS_OF_WEEK_RU = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const DAYS_OF_WEEK_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ReportSchedule() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api } = useAuth();

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', frequency: 'daily', dayOfWeek: 1, hour: 20, minute: 0, format: 'xlsx', chatId: '' });

  const fetchSchedules = useCallback(async () => {
    try {
      const { data } = await api.get('/api/report-schedules');
      setSchedules(Array.isArray(data) ? data : []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const openNew = () => {
    setEditItem(null);
    setForm({ name: '', frequency: 'daily', dayOfWeek: 1, hour: 20, minute: 0, format: 'xlsx', chatId: '' });
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditItem(s);
    setForm({ name: s.name, frequency: s.frequency, dayOfWeek: s.dayOfWeek ?? 1, hour: s.hour, minute: s.minute, format: s.format, chatId: s.chatId || '' });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const payload = { ...form, dayOfWeek: form.frequency === 'weekly' ? form.dayOfWeek : null, chatId: form.chatId || null };
    try {
      if (editItem) {
        await api.put(`/api/report-schedules/${editItem.id}`, payload);
      } else {
        await api.post('/api/report-schedules', payload);
      }
      setShowForm(false);
      fetchSchedules();
    } catch {}
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/report-schedules/${id}`);
      fetchSchedules();
    } catch {}
  };

  const handleToggle = async (s) => {
    try {
      await api.put(`/api/report-schedules/${s.id}`, { isActive: !s.isActive });
      fetchSchedules();
    } catch {}
  };

  const handleRunNow = async (s) => {
    try {
      const response = await api.get(`/api/report-schedules/${s.id}/run`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const days = isRu ? DAYS_OF_WEEK_RU : DAYS_OF_WEEK_EN;

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <FileSpreadsheet size={20} style={{ color: 'var(--accent)' }} />
            {t('reportSchedule.title')}
          </h2>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={14} />
          {t('reportSchedule.addNew')}
        </button>
      </div>

      {/* Table */}
      {schedules.length === 0 ? (
        <div className="glass-static p-8 rounded-2xl text-center" style={{ color: 'var(--text-muted)' }}>
          {t('reportSchedule.noSchedules')}
        </div>
      ) : (
        <div className="glass-static rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                {[t('reportSchedule.name'), t('reportSchedule.frequency'), t('reportSchedule.hour'), t('reportSchedule.format'), t('reportSchedule.active'), t('reportSchedule.lastRun'), ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id} className="hover:opacity-90 transition-opacity cursor-pointer"
                  style={{ borderBottom: '1px solid var(--border-glass)' }}
                  onClick={() => openEdit(s)}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {s.frequency === 'daily' ? t('reportSchedule.daily') : t('reportSchedule.weekly')}
                    {s.frequency === 'weekly' && s.dayOfWeek !== null && ` (${days[s.dayOfWeek]})`}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {String(s.hour).padStart(2, '0')}:{String(s.minute).padStart(2, '0')}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{s.format}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleToggle(s)} style={{ color: s.isActive ? 'var(--success)' : 'var(--text-muted)' }}>
                      {s.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString(isRu ? 'ru-RU' : 'en-US') : '-'}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleRunNow(s)} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--accent)' }} title={t('reportSchedule.runNow')}>
                        <Play size={14} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--danger)' }} title={t('reportSchedule.delete')}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="glass-static p-6 rounded-2xl max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {editItem ? t('reportSchedule.name') : t('reportSchedule.addNew')}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>{t('reportSchedule.name')}</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>{t('reportSchedule.frequency')}</label>
                <select
                  value={form.frequency}
                  onChange={e => setForm({ ...form, frequency: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
                >
                  <option value="daily">{t('reportSchedule.daily')}</option>
                  <option value="weekly">{t('reportSchedule.weekly')}</option>
                </select>
              </div>

              {form.frequency === 'weekly' && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                    {isRu ? 'День недели' : 'Day of week'}
                  </label>
                  <select
                    value={form.dayOfWeek}
                    onChange={e => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
                  >
                    {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>{t('reportSchedule.hour')}</label>
                  <input
                    type="number" min={0} max={23}
                    value={form.hour}
                    onChange={e => setForm({ ...form, hour: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>{t('reportSchedule.minute')}</label>
                  <input
                    type="number" min={0} max={59}
                    value={form.minute}
                    onChange={e => setForm({ ...form, minute: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>{t('reportSchedule.format')}</label>
                <select
                  value={form.format}
                  onChange={e => setForm({ ...form, format: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
                >
                  <option value="xlsx">XLSX</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Telegram Chat ID</label>
                <input
                  value={form.chatId}
                  onChange={e => setForm({ ...form, chatId: e.target.value })}
                  placeholder={isRu ? 'Опционально' : 'Optional'}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!form.name || !form.frequency}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: 'var(--accent)', opacity: (!form.name || !form.frequency) ? 0.5 : 1 }}
              >
                {t('reportSchedule.save')}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border-glass)' }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
