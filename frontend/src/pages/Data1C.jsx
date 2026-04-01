import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Upload, FileSpreadsheet, FileText, X, Check, Database, Users, BarChart3, Car, Clock, Wrench } from 'lucide-react';
import HelpButton from '../components/HelpButton';

const STATUS_LABELS = {
  in_progress: { ru: 'В работе', en: 'In Progress', color: '#f59e0b' },
  waiting: { ru: 'Ожидание', en: 'Waiting', color: '#3b82f6' },
  completed: { ru: 'Проведён', en: 'Completed', color: '#10b981' },
  closed: { ru: 'Закрыт', en: 'Closed', color: '#94a3b8' },
  scheduled: { ru: 'Записан', en: 'Scheduled', color: '#6366f1' },
  unknown: { ru: 'Неизвестно', en: 'Unknown', color: '#94a3b8' },
};

function MiniBar({ items, labelKey, valueKey, maxItems = 8, color = 'var(--accent)', labelWidth = 140 }) {
  const data = items.slice(0, maxItems);
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div className="space-y-1.5">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-2 relative group">
          <span className="text-sm truncate" style={{ color: 'var(--text-secondary)', width: labelWidth, minWidth: labelWidth, fontSize: '13px' }} title={item[labelKey]}>
            {item[labelKey]}
          </span>
          <div className="flex-1 h-3.5 rounded-full" style={{ background: 'var(--border-glass)' }}>
            <div className="h-full rounded-full" style={{ width: `${(item[valueKey] / max) * 100}%`, background: color, opacity: 0.85 }} />
          </div>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)', minWidth: 40, textAlign: 'right' }}>
            {typeof item[valueKey] === 'number' ? (Number.isInteger(item[valueKey]) ? item[valueKey] : item[valueKey].toFixed(1)) : item[valueKey]}
          </span>
          {/* Tooltip with full name */}
          <div className="absolute bottom-full left-0 mb-1 px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
            style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', fontSize: '11px', whiteSpace: 'nowrap' }}>
            {item[labelKey]}: <strong>{typeof item[valueKey] === 'number' ? (Number.isInteger(item[valueKey]) ? item[valueKey] : item[valueKey].toFixed(1)) : item[valueKey]}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsTab({ stats, lang }) {
  if (!stats) return null;
  const { planning, workers } = stats;
  const isRu = lang === 'ru';

  return (
    <div className="space-y-4">
      {/* Summary — compact inline */}
      <div className="flex flex-wrap gap-2">
        {[
          { icon: Database, label: isRu ? 'Записей' : 'Records', value: planning.total, color: 'var(--accent)' },
          { icon: Clock, label: isRu ? 'Часы' : 'Hours', value: planning.totalHours, color: 'var(--warning)' },
          { icon: Users, label: isRu ? 'Записей выработки' : 'Worker records', value: workers.total, color: 'var(--text-primary)' },
          { icon: Users, label: isRu ? 'Исполнителей' : 'Workers', value: workers.uniqueWorkers, color: 'var(--success)' },
          { icon: Wrench, label: isRu ? 'Нормочасы' : 'Norm hours', value: workers.totalNormHours, color: 'var(--info)' },
          { icon: Car, label: isRu ? 'Марок авто' : 'Brands', value: workers.topBrands?.length || 0, color: 'var(--text-secondary)' },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <s.icon size={12} style={{ color: s.color }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
            <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        {planning.byStatus?.map(s => {
          const info = STATUS_LABELS[s.status] || STATUS_LABELS.unknown;
          return (
            <div key={s.status} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: info.color + '12' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: info.color }} />
              <span className="text-xs" style={{ color: info.color }}>{info[lang] || s.status}</span>
              <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{s.count}</span>
            </div>
          );
        })}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Загрузка по постам' : 'Load by Post'}</div>
          <MiniBar items={planning.byPost || []} labelKey="name" valueKey="count" color="var(--accent)" labelWidth={160} />
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Топ исполнителей' : 'Top Workers'}</div>
          <MiniBar items={workers.topWorkers || []} labelKey="name" valueKey="hours" color="var(--success)" labelWidth={150} />
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Марки автомобилей' : 'Car Brands'}</div>
          <MiniBar items={workers.topBrands || []} labelKey="name" valueKey="count" color="var(--info)" />
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Виды ремонта' : 'Repair Types'}</div>
          <MiniBar items={workers.byRepairType || []} labelKey="type" valueKey="count" color="var(--warning)" labelWidth={150} />
        </div>
      </div>
    </div>
  );
}

function PlanningTab({ data, lang }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('startTime');
  const [sortDir, setSortDir] = useState('desc');
  const isRu = lang === 'ru';

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };
  const si = (col) => sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const filtered = data.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.document || '').toLowerCase().includes(q) || (r.plateNumber || '').toLowerCase().includes(q) ||
        (r.number || '').toLowerCase().includes(q) || (r.workStation || '').toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => {
    let va = a[sortBy] || '', vb = b[sortBy] || '';
    if (sortBy === 'durationHours') { va = a.durationHours || 0; vb = b.durationHours || 0; }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={isRu ? 'Поиск...' : 'Search...'}
          className="px-3 py-1.5 rounded-lg text-xs outline-none flex-1 min-w-[180px]"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
        <div className="flex gap-1">
          {['all', 'in_progress', 'waiting', 'completed', 'scheduled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-2 py-1 rounded-lg text-xs transition-all"
              style={{ background: statusFilter === s ? 'var(--accent)' : 'var(--bg-glass)', color: statusFilter === s ? 'white' : 'var(--text-muted)' }}>
              {s === 'all' ? (isRu ? 'Все' : 'All') : (STATUS_LABELS[s]?.[lang] || s)}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{filtered.length}/{data.length}</span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--bg-glass)' }}>
                {[
                  { key: 'number', label: isRu ? 'Номер' : 'Number' },
                  { key: 'plateNumber', label: isRu ? 'Госномер' : 'Plate' },
                  { key: 'workStation', label: isRu ? 'Пост' : 'Post' },
                  { key: 'startTime', label: isRu ? 'Начало' : 'Start' },
                  { key: 'endTime', label: isRu ? 'Конец' : 'End' },
                  { key: 'durationHours', label: isRu ? 'Часы' : 'Hours' },
                  { key: 'status', label: isRu ? 'Статус' : 'Status' },
                ].map(col => (
                  <th key={col.key} className="text-left px-3 py-2 text-xs font-medium cursor-pointer hover:opacity-80"
                    style={{ color: sortBy === col.key ? 'var(--accent)' : 'var(--text-muted)' }}
                    onClick={() => toggleSort(col.key)}>
                    {col.label}{si(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map(r => {
                const info = STATUS_LABELS[r.status] || STATUS_LABELS.unknown;
                return (
                  <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border-glass)' }}>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--accent)' }}>{r.number}</td>
                    <td className="px-3 py-2 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.plateNumber || '—'}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>{r.workStation}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{r.startTime || '—'}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{r.endTime || '—'}</td>
                    <td className="px-3 py-2 text-sm font-medium text-right" style={{ color: 'var(--accent)' }}>{r.durationHours}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: info.color + '18', color: info.color }}>{info[lang]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function WorkersTab({ data, lang }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('number');
  const [sortDir, setSortDir] = useState('asc');
  const isRu = lang === 'ru';

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };
  const si = (col) => sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.worker || '').toLowerCase().includes(q) || (r.brand || '').toLowerCase().includes(q) ||
      (r.number || '').toLowerCase().includes(q) || (r.repairType || '').toLowerCase().includes(q);
  }).sort((a, b) => {
    let va = a[sortBy] || '', vb = b[sortBy] || '';
    if (sortBy === 'normHours') { va = a.normHours || 0; vb = b.normHours || 0; }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={isRu ? 'Поиск...' : 'Search...'}
          className="px-3 py-1.5 rounded-lg text-xs outline-none flex-1"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{filtered.length}/{data.length}</span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--bg-glass)' }}>
                {[
                  { key: 'number', label: isRu ? 'Номер ЗН' : 'WO#' },
                  { key: 'repairType', label: isRu ? 'Вид ремонта' : 'Type' },
                  { key: 'brand', label: isRu ? 'Марка' : 'Brand' },
                  { key: 'model', label: isRu ? 'Модель' : 'Model' },
                  { key: 'worker', label: isRu ? 'Исполнитель' : 'Worker' },
                  { key: 'orderStatus', label: isRu ? 'Статус' : 'Status' },
                  { key: 'normHours', label: isRu ? 'Н/ч' : 'N/h' },
                ].map(col => (
                  <th key={col.key} className="text-left px-3 py-2 text-xs font-medium cursor-pointer hover:opacity-80"
                    style={{ color: sortBy === col.key ? 'var(--accent)' : 'var(--text-muted)' }}
                    onClick={() => toggleSort(col.key)}>
                    {col.label}{si(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map(r => {
                const sc = r.orderStatus?.includes('Закрыт') ? '#10b981' : r.orderStatus?.includes('В работе') ? '#f59e0b' : '#94a3b8';
                return (
                  <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border-glass)' }}>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--accent)' }}>{r.number}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{r.repairType}</td>
                    <td className="px-3 py-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.brand}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{r.model}</td>
                    <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-primary)' }}>{r.worker}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: sc + '18', color: sc }}>{r.orderStatus}</span>
                    </td>
                    <td className="px-3 py-2 text-sm font-bold text-right" style={{ color: 'var(--accent)' }}>{r.normHours}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FileUploadZone({ lang, onFiles }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const inputRef = useRef(null);
  const isRu = lang === 'ru';
  const ACCEPTED = '.xlsx,.xls,.csv,.pdf';

  const handleFiles = (files) => {
    const valid = Array.from(files).filter(f => f.name.match(/\.(xlsx|xls|csv|pdf)$/i));
    if (!valid.length) return;
    setUploadedFiles(prev => [...prev, ...valid.map(f => ({ name: f.name, size: (f.size / 1024).toFixed(1) + ' KB', type: f.name.split('.').pop().toUpperCase() }))]);
    onFiles?.(valid);
  };

  return (
    <div className="space-y-2">
      <div className="rounded-xl p-4 text-center cursor-pointer transition-all"
        style={{ border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border-glass)'}`, background: dragActive ? 'var(--accent-light)' : 'transparent' }}
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={e => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}>
        <Upload size={24} style={{ color: 'var(--accent)', margin: '0 auto 6px' }} />
        <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{isRu ? 'Перетащите файлы или нажмите' : 'Drag files or click'}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Excel, CSV, PDF</p>
        <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={e => handleFiles(e.target.files)} />
      </div>
      {uploadedFiles.map((f, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center gap-2">
            {f.type === 'PDF' ? <FileText size={14} style={{ color: '#ef4444' }} /> : <FileSpreadsheet size={14} style={{ color: '#10b981' }} />}
            <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{f.name}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{f.size}</span>
          </div>
          <Check size={12} style={{ color: '#10b981' }} />
        </div>
      ))}
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
  const [showUpload, setShowUpload] = useState(false);

  const lang = i18n.language;
  const isRu = lang === 'ru';

  useEffect(() => {
    api.get('/api/1c-stats').then(r => setStats(r.data)).catch(console.error);
    api.get('/api/1c-planning').then(r => setPlanning(r.data)).catch(console.error);
    api.get('/api/1c-workers').then(r => setWorkers(r.data)).catch(console.error);
  }, []);

  const tabs = [
    { key: 'stats', label: isRu ? 'Статистика' : 'Statistics' },
    { key: 'planning', label: isRu ? 'Планирование' : 'Planning' },
    { key: 'workers', label: isRu ? 'Выработка' : 'Output' },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {isRu ? 'Данные 1С Альфа-Авто' : '1C Alfa-Auto Data'}
          </h2>
          <HelpButton pageKey="data1c" />
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            {planning.length + workers.length}
          </span>
        </div>
        <button onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90"
          style={{ background: 'var(--accent)' }}>
          <Upload size={12} />
          {isRu ? 'Загрузить' : 'Upload'}
        </button>
      </div>

      {showUpload && (
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{isRu ? 'Загрузка из 1С' : 'Upload from 1C'}</span>
            <button onClick={() => setShowUpload(false)} className="hover:opacity-60"><X size={14} style={{ color: 'var(--text-muted)' }} /></button>
          </div>
          <FileUploadZone lang={lang} onFiles={(f) => console.log('Files:', f.map(f => f.name))} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-3 py-1 rounded-lg text-xs transition-all"
            style={{ background: tab === t.key ? 'var(--accent)' : 'var(--bg-glass)', color: tab === t.key ? 'white' : 'var(--text-secondary)', border: `1px solid ${tab === t.key ? 'var(--accent)' : 'var(--border-glass)'}` }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stats' && <StatsTab stats={stats} lang={lang} />}
      {tab === 'planning' && <PlanningTab data={planning} lang={lang} />}
      {tab === 'workers' && <WorkersTab data={workers} lang={lang} />}
    </div>
  );
}
