import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const STATUS_LABELS = {
  in_progress: { ru: 'В работе', en: 'In Progress', color: '#f59e0b' },
  waiting: { ru: 'Ожидание', en: 'Waiting', color: '#3b82f6' },
  completed: { ru: 'Проведён', en: 'Completed', color: '#10b981' },
  closed: { ru: 'Закрыт', en: 'Closed', color: '#94a3b8' },
  scheduled: { ru: 'Записан', en: 'Scheduled', color: '#6366f1' },
  unknown: { ru: 'Неизвестно', en: 'Unknown', color: '#94a3b8' },
};

function StatBlock({ label, value, sub, color }) {
  return (
    <div className="glass p-4">
      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: color || 'var(--accent)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function BarChart({ items, labelKey, valueKey, maxItems = 10, color = 'var(--accent)' }) {
  const data = items.slice(0, maxItems);
  const max = Math.max(...data.map(d => d[valueKey]), 1);

  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs w-40 truncate" style={{ color: 'var(--text-secondary)' }} title={item[labelKey]}>
            {item[labelKey]}
          </span>
          <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'var(--bg-glass)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(item[valueKey] / max) * 100}%`, background: color, opacity: 0.8 }}
            />
          </div>
          <span className="text-xs font-medium w-12 text-right" style={{ color: 'var(--text-primary)' }}>
            {typeof item[valueKey] === 'number' ? item[valueKey].toFixed?.(1) ?? item[valueKey] : item[valueKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatsTab({ stats, lang }) {
  if (!stats) return null;
  const { planning, workers } = stats;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatBlock label={lang === 'ru' ? 'Записей планирования' : 'Planning Records'} value={planning.total} />
        <StatBlock label={lang === 'ru' ? 'Общее время (ч)' : 'Total Hours'} value={planning.totalHours} color="var(--warning)" />
        <StatBlock label={lang === 'ru' ? 'Записей выработки' : 'Worker Records'} value={workers.total} />
        <StatBlock label={lang === 'ru' ? 'Исполнителей' : 'Workers'} value={workers.uniqueWorkers} color="var(--success)" />
        <StatBlock label={lang === 'ru' ? 'Нормочасы (итого)' : 'Norm Hours Total'} value={workers.totalNormHours} color="var(--info)" />
        <StatBlock label={lang === 'ru' ? 'Марок авто' : 'Car Brands'} value={workers.topBrands?.length || 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Planning by status */}
        <div className="glass-static p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {lang === 'ru' ? 'Планирование по статусам' : 'Planning by Status'}
          </h3>
          <div className="flex flex-wrap gap-3">
            {planning.byStatus?.map(s => {
              const info = STATUS_LABELS[s.status] || STATUS_LABELS.unknown;
              return (
                <div key={s.status} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: info.color + '15' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: info.color }} />
                  <span className="text-sm" style={{ color: info.color }}>{info[lang] || s.status}</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{s.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Planning by post */}
        <div className="glass-static p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {lang === 'ru' ? 'Загрузка по постам' : 'Load by Post'}
          </h3>
          <BarChart items={planning.byPost || []} labelKey="name" valueKey="count" color="var(--accent)" />
        </div>

        {/* Top workers */}
        <div className="glass-static p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {lang === 'ru' ? 'Топ исполнителей (нормочасы)' : 'Top Workers (norm hours)'}
          </h3>
          <BarChart items={workers.topWorkers || []} labelKey="name" valueKey="hours" color="var(--success)" />
        </div>

        {/* Brands */}
        <div className="glass-static p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {lang === 'ru' ? 'Марки автомобилей' : 'Car Brands'}
          </h3>
          <BarChart items={workers.topBrands || []} labelKey="name" valueKey="count" color="var(--info)" />
        </div>

        {/* Repair types */}
        <div className="glass-static p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {lang === 'ru' ? 'Виды ремонта' : 'Repair Types'}
          </h3>
          <BarChart items={workers.byRepairType || []} labelKey="type" valueKey="count" color="var(--warning)" />
        </div>
      </div>
    </div>
  );
}

function PlanningTab({ data, lang }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = data.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.document || '').toLowerCase().includes(q) ||
        (r.plateNumber || '').toLowerCase().includes(q) ||
        (r.number || '').toLowerCase().includes(q) ||
        (r.workStation || '').toLowerCase().includes(q) ||
        (r.vin || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'ru' ? 'Поиск по номеру, госномеру, VIN, посту...' : 'Search by number, plate, VIN, post...'}
          className="px-4 py-2 rounded-xl text-sm outline-none flex-1 min-w-[200px]"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
        />
        <div className="flex gap-1">
          {['all', 'in_progress', 'waiting', 'completed', 'scheduled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{
                background: statusFilter === s ? 'var(--accent)' : 'var(--bg-glass)',
                color: statusFilter === s ? 'white' : 'var(--text-muted)',
              }}
            >
              {s === 'all' ? (lang === 'ru' ? 'Все' : 'All') : (STATUS_LABELS[s]?.[lang] || s)}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{filtered.length} / {data.length}</span>
      </div>

      {/* Table */}
      <div className="glass-static overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
              {[
                lang === 'ru' ? 'Документ' : 'Document',
                lang === 'ru' ? 'Номер' : 'Number',
                lang === 'ru' ? 'Госномер' : 'Plate',
                'VIN',
                lang === 'ru' ? 'Начало' : 'Start',
                lang === 'ru' ? 'Конец' : 'End',
                lang === 'ru' ? 'Пост' : 'Post',
                lang === 'ru' ? 'Часы' : 'Hours',
                lang === 'ru' ? 'Статус' : 'Status',
              ].map(col => (
                <th key={col} className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map(r => {
              const info = STATUS_LABELS[r.status] || STATUS_LABELS.unknown;
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                  <td className="px-3 py-2 max-w-[250px] truncate" style={{ color: 'var(--text-primary)' }} title={r.document}>{r.document}</td>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{r.number}</td>
                  <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{r.plateNumber || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{r.vin ? r.vin.slice(0, 10) + '…' : '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{r.startTime || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{r.endTime || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{r.workStation}</td>
                  <td className="px-3 py-2 text-right" style={{ color: 'var(--accent)' }}>{r.durationHours}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: info.color + '22', color: info.color }}>
                      {info[lang] || r.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkersTab({ data, lang }) {
  const [search, setSearch] = useState('');

  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.worker || '').toLowerCase().includes(q) ||
      (r.brand || '').toLowerCase().includes(q) ||
      (r.number || '').toLowerCase().includes(q) ||
      (r.vin || '').toLowerCase().includes(q) ||
      (r.repairType || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'ru' ? 'Поиск по исполнителю, марке, VIN, номеру...' : 'Search by worker, brand, VIN, number...'}
          className="px-4 py-2 rounded-xl text-sm outline-none flex-1"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
        />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{filtered.length} / {data.length}</span>
      </div>

      <div className="glass-static overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
              {[
                lang === 'ru' ? 'Номер ЗН' : 'WO Number',
                lang === 'ru' ? 'Вид ремонта' : 'Repair Type',
                lang === 'ru' ? 'Марка' : 'Brand',
                lang === 'ru' ? 'Модель' : 'Model',
                lang === 'ru' ? 'Исполнитель' : 'Worker',
                lang === 'ru' ? 'Начало' : 'Start',
                lang === 'ru' ? 'Окончание' : 'End',
                lang === 'ru' ? 'Состояние' : 'Status',
                lang === 'ru' ? 'Мастер' : 'Master',
                lang === 'ru' ? 'Нормочасы' : 'Norm Hours',
              ].map(col => (
                <th key={col} className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map(r => {
              const statusColor = r.orderStatus.includes('Закрыт') ? '#10b981' : r.orderStatus.includes('В работе') ? '#f59e0b' : '#94a3b8';
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{r.number}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{r.repairType}</td>
                  <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{r.brand}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{r.model}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{r.worker}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>{r.startDate || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>{r.endDate || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: statusColor + '22', color: statusColor }}>
                      {r.orderStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{r.master?.split(' ').slice(0, 2).join(' ')}</td>
                  <td className="px-3 py-2 text-right font-medium" style={{ color: 'var(--accent)' }}>{r.normHours}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Data1C() {
  const { i18n } = useTranslation();
  const { api } = useAuth();
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [planning, setPlanning] = useState([]);
  const [workers, setWorkers] = useState([]);

  const lang = i18n.language;

  useEffect(() => {
    api.get('/api/1c-stats').then(r => setStats(r.data)).catch(console.error);
    api.get('/api/1c-planning').then(r => setPlanning(r.data)).catch(console.error);
    api.get('/api/1c-workers').then(r => setWorkers(r.data)).catch(console.error);
  }, []);

  const tabs = [
    { key: 'stats', label: lang === 'ru' ? '📊 Статистика' : '📊 Statistics' },
    { key: 'planning', label: lang === 'ru' ? '📅 Планирование ремонта' : '📅 Repair Planning' },
    { key: 'workers', label: lang === 'ru' ? '👷 Выработка исполнителей' : '👷 Worker Output' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {lang === 'ru' ? 'Данные 1С' : '1C Data'}
        </h2>
        <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
          {lang === 'ru' ? `${planning.length + workers.length} записей` : `${planning.length + workers.length} records`}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-xl text-sm transition-all"
            style={{
              background: tab === t.key ? 'var(--accent)' : 'var(--bg-glass)',
              color: tab === t.key ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${tab === t.key ? 'var(--accent)' : 'var(--border-glass)'}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'stats' && <StatsTab stats={stats} lang={lang} />}
      {tab === 'planning' && <PlanningTab data={planning} lang={lang} />}
      {tab === 'workers' && <WorkersTab data={workers} lang={lang} />}
    </div>
  );
}
