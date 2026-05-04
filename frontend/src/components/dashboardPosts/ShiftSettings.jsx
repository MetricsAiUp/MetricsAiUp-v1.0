import { useState } from 'react';
import { Settings, X, Copy } from 'lucide-react';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// Часто используемые таймзоны для постсоветского пространства + UTC.
// Если нужно расширение — список достраивается без изменений API.
const TIMEZONE_OPTIONS = [
  'Europe/Moscow',
  'Europe/Kaliningrad',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Yakutsk',
  'Asia/Vladivostok',
  'Asia/Magadan',
  'Asia/Kamchatka',
  'Europe/Minsk',
  'Europe/Kyiv',
  'Asia/Almaty',
  'Asia/Bishkek',
  'Asia/Tashkent',
  'Asia/Tbilisi',
  'Asia/Yerevan',
  'Asia/Baku',
  'UTC',
];

// Возвращает строку вида "+3", "+5:30", "+0" по идентификатору таймзоны.
function getTimezoneOffsetLabel(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    const v = parts.find(p => p.type === 'timeZoneName')?.value || '';
    const m = v.match(/([+-])(\d+)(?::(\d+))?/);
    if (!m) return '+0';
    const sign = m[1];
    const hours = parseInt(m[2], 10);
    const mins = m[3] ? parseInt(m[3], 10) : 0;
    return mins === 0 ? `${sign}${hours}` : `${sign}${hours}:${m[3]}`;
  } catch {
    return '';
  }
}

const defaultDaySchedule = (start = '08:00', end = '20:00') => ({
  start,
  end,
  dayOff: false,
});

export function buildWeekSchedule(settings) {
  if (settings.weekSchedule) return settings.weekSchedule;
  const schedule = {};
  DAYS.forEach((d) => {
    schedule[d] = defaultDaySchedule(settings.shiftStart, settings.shiftEnd);
  });
  // Сб и вс — выходные по умолчанию
  schedule.sat.dayOff = true;
  schedule.sun.dayOff = true;
  return schedule;
}

export function getTodayShift(settings) {
  const jsDay = new Date().getDay(); // 0=Sun
  const dayMap = [6, 0, 1, 2, 3, 4, 5]; // JS day → DAYS index
  const dayKey = DAYS[dayMap[jsDay]];
  const ws = settings.weekSchedule || buildWeekSchedule(settings);
  const day = ws[dayKey];
  if (day.dayOff) return { shiftStart: settings.shiftStart || '08:00', shiftEnd: settings.shiftEnd || '20:00', dayOff: true };
  return { shiftStart: day.start, shiftEnd: day.end, dayOff: false };
}

export default function ShiftSettings({ settings, onSettingsChange, onClose, t }) {
  const [local, setLocal] = useState(() => ({
    ...settings,
    weekSchedule: buildWeekSchedule(settings),
  }));

  const handleSave = () => {
    const toSave = {
      ...local,
      shiftStart: local.weekSchedule.mon.start,
      shiftEnd: local.weekSchedule.mon.end,
      timezone: local.timezone || 'Europe/Moscow',
    };
    onSettingsChange(toSave);
    onClose();
  };

  const updateDay = (day, field, value) => {
    setLocal((prev) => ({
      ...prev,
      weekSchedule: {
        ...prev.weekSchedule,
        [day]: { ...prev.weekSchedule[day], [field]: value },
      },
    }));
  };

  const copyToAll = (sourceDay) => {
    const src = local.weekSchedule[sourceDay];
    setLocal((prev) => {
      const ws = { ...prev.weekSchedule };
      DAYS.forEach((d) => {
        if (d !== sourceDay) {
          ws[d] = { ...src };
        }
      });
      return { ...prev, weekSchedule: ws };
    });
  };

  const dayLabel = (day) => t(`dashboardPosts.days.${day}`);

  const inputStyle = {
    background: 'var(--bg-glass)',
    border: '1px solid var(--border-glass)',
    color: 'var(--text-primary)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ border: '1px solid var(--border-glass)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings size={20} style={{ color: 'var(--accent)' }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('dashboardPosts.settings')}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Week schedule */}
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
              {t('dashboardPosts.weekSchedule')}
            </label>
            <div className="space-y-2">
              {DAYS.map((day) => {
                const d = local.weekSchedule[day];
                return (
                  <div
                    key={day}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{
                      background: d.dayOff ? 'var(--bg-glass)' : 'transparent',
                      border: '1px solid var(--border-glass)',
                      opacity: d.dayOff ? 0.5 : 1,
                    }}
                  >
                    <span
                      className="text-xs font-medium w-8 shrink-0"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {dayLabel(day)}
                    </span>
                    <input
                      type="time"
                      value={d.start}
                      disabled={d.dayOff}
                      onChange={(e) => updateDay(day, 'start', e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs"
                      style={inputStyle}
                    />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>
                    <input
                      type="time"
                      value={d.end}
                      disabled={d.dayOff}
                      onChange={(e) => updateDay(day, 'end', e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs"
                      style={inputStyle}
                    />
                    <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.dayOff}
                        onChange={(e) => updateDay(day, 'dayOff', e.target.checked)}
                        className="rounded"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('dashboardPosts.dayOff')}
                      </span>
                    </label>
                    <button
                      onClick={() => copyToAll(day)}
                      title={t('dashboardPosts.copyToAll')}
                      className="p-1 rounded-lg hover:opacity-70 shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              {t('dashboardPosts.timezone')}
            </label>
            <select
              value={local.timezone || 'Europe/Moscow'}
              onChange={(e) => setLocal({ ...local, timezone: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={inputStyle}
            >
              {TIMEZONE_OPTIONS.map((tz) => {
                const off = getTimezoneOffsetLabel(tz);
                return (
                  <option key={tz} value={tz}>{off ? `${off} ${tz}` : tz}</option>
                );
              })}
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {t('dashboardPosts.timezoneHint')}
            </p>
          </div>

          {/* Posts count */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              {t('dashboardPosts.postsCount')}
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={local.postsCount}
              onChange={(e) => setLocal({ ...local, postsCount: parseInt(e.target.value, 10) || 10 })}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={inputStyle}
            />
          </div>

        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl text-sm"
            style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-secondary)',
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
