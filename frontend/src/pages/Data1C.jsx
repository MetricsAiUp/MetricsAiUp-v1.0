import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Upload, FileSpreadsheet, FileText, X, Check, Database, Users, BarChart3, Car, Clock, Wrench, Save } from 'lucide-react';
import HelpButton from '../components/HelpButton';
import * as XLSX from 'xlsx';

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

function SortableTable({ data, columns, lang, searchFields, defaultSort = 'id', defaultDir = 'asc', renderCell }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState(defaultSort);
  const [sortDir, setSortDir] = useState(defaultDir);
  const isRu = lang === 'ru';

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };
  const si = (col) => sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (searchFields || columns.map(c => c.key)).some(k => (r[k] ?? '').toString().toLowerCase().includes(q));
  }).sort((a, b) => {
    let va = a[sortBy] ?? '', vb = b[sortBy] ?? '';
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortDir === 'asc' ? va - vb : vb - va;
    }
    va = va.toString().toLowerCase();
    vb = vb.toString().toLowerCase();
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
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{filtered.length}/{data.length}</span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: columns.length * 120 }}>
            <thead>
              <tr style={{ background: 'var(--bg-glass)' }}>
                {columns.map(col => (
                  <th key={col.key} className="text-left px-3 py-2 text-xs font-medium cursor-pointer hover:opacity-80 whitespace-nowrap"
                    style={{ color: sortBy === col.key ? 'var(--accent)' : 'var(--text-muted)' }}
                    onClick={() => toggleSort(col.key)}>
                    {col.label}{si(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(r => (
                <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border-glass)' }}>
                  {columns.map(col => (
                    <td key={col.key} className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--text-primary)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title={(r[col.key] ?? '').toString()}>
                      {renderCell ? renderCell(col.key, r[col.key], r) : (r[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlanningTab({ data, lang }) {
  const isRu = lang === 'ru';
  const columns = [
    { key: 'document', label: isRu ? 'Документ' : 'Document' },
    { key: 'master', label: isRu ? 'Мастер' : 'Master' },
    { key: 'author', label: isRu ? 'Автор' : 'Author' },
    { key: 'organization', label: isRu ? 'Организация' : 'Organization' },
    { key: 'vehicle', label: isRu ? 'Автомобиль' : 'Vehicle' },
    { key: 'number', label: isRu ? 'Номер' : 'Number' },
    { key: 'plateNumber', label: isRu ? 'Гос. номер' : 'Plate' },
    { key: 'vin', label: 'VIN' },
    { key: 'startTime', label: isRu ? 'Начало' : 'Start' },
    { key: 'endTime', label: isRu ? 'Конец' : 'End' },
    { key: 'workStation', label: isRu ? 'Рабочее место' : 'Workstation' },
    { key: 'executor', label: isRu ? 'Исполнитель' : 'Executor' },
    { key: 'durationHours', label: isRu ? 'Часы' : 'Hours' },
    { key: 'notRelevant', label: isRu ? 'Не актуален' : 'Not relevant' },
    { key: 'planObject', label: isRu ? 'Объект планирования' : 'Plan object' },
    { key: 'objectView', label: isRu ? 'Представление объекта' : 'Object view' },
  ];

  const renderCell = (key, value, row) => {
    if (key === 'durationHours') return <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{value}</span>;
    if (key === 'number') return <span className="font-mono" style={{ color: 'var(--accent)' }}>{value || '—'}</span>;
    if (key === 'document') return <span style={{ maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || '—'}</span>;
    return value || '—';
  };

  return <SortableTable data={data} columns={columns} lang={lang} defaultSort="startTime" defaultDir="desc"
    searchFields={['document', 'number', 'plateNumber', 'workStation', 'master', 'executor', 'vehicle']}
    renderCell={renderCell} />;
}

function WorkersTab({ data, lang }) {
  const isRu = lang === 'ru';
  const columns = [
    { key: 'repairType', label: isRu ? 'Вид ремонта' : 'Repair type' },
    { key: 'number', label: isRu ? 'Номер' : 'Number' },
    { key: 'vin', label: 'VIN' },
    { key: 'brand', label: isRu ? 'Марка' : 'Brand' },
    { key: 'model', label: isRu ? 'Модель' : 'Model' },
    { key: 'year', label: isRu ? 'Год выпуска' : 'Year' },
    { key: 'workOrder', label: isRu ? 'Заказ-наряд' : 'Work order' },
    { key: 'worker', label: isRu ? 'Сотрудник' : 'Worker' },
    { key: 'startDate', label: isRu ? 'Дата начала' : 'Start date' },
    { key: 'endDate', label: isRu ? 'Дата окончания' : 'End date' },
    { key: 'closeDate', label: isRu ? 'Дата закрытия' : 'Close date' },
    { key: 'orderStatus', label: isRu ? 'Состояние' : 'Status' },
    { key: 'master', label: isRu ? 'Мастер' : 'Master' },
    { key: 'dispatcher', label: isRu ? 'Диспетчер' : 'Dispatcher' },
    { key: 'normHours', label: isRu ? 'Нормочасы' : 'Norm hours' },
  ];

  const renderCell = (key, value, row) => {
    if (key === 'normHours') return <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{value}</span>;
    if (key === 'number') return <span className="font-mono" style={{ color: 'var(--accent)' }}>{value || '—'}</span>;
    if (key === 'orderStatus') {
      const sc = value?.includes('Закрыт') ? '#10b981' : value?.includes('В работе') ? '#f59e0b' : '#94a3b8';
      return <span className="px-2 py-0.5 rounded-full" style={{ background: sc + '18', color: sc, fontSize: '11px' }}>{value || '—'}</span>;
    }
    if (key === 'workOrder') return <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || '—'}</span>;
    return value || '—';
  };

  return <SortableTable data={data} columns={columns} lang={lang} defaultSort="number" defaultDir="asc"
    searchFields={['number', 'worker', 'brand', 'model', 'repairType', 'master', 'vin']}
    renderCell={renderCell} />;
}

function FileUploadZone({ lang, onProcess }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]); // { name, size, type, file, processed }
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef(null);
  const isRu = lang === 'ru';
  const ACCEPTED = '.xlsx,.xls,.csv';

  const handleFiles = (files) => {
    const valid = Array.from(files).filter(f => f.name.match(/\.(xlsx|xls|csv)$/i));
    if (!valid.length) return;
    setUploadedFiles(prev => [...prev, ...valid.map(f => ({
      name: f.name, size: (f.size / 1024).toFixed(1) + ' KB',
      type: f.name.split('.').pop().toUpperCase(), file: f, processed: false,
    }))]);
  };

  const handleProcess = async () => {
    setProcessing(true);
    const allPlanning = [];
    const allWorkers = [];

    for (const uf of uploadedFiles) {
      if (uf.processed) continue;
      try {
        const ab = await uf.file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) continue;

        const header = rows[0].map(h => (h || '').toString().trim());
        const isPlan = header.some(h => h.includes('Рабочее место') || h.includes('Продолжительность'));

        if (isPlan) {
          // Планирование: Документ(0), Мастер(1), Автор(2), Организация(3), Автомобиль(4), Номер(5), Гос.номер(6), VIN(7), Начало(8), Конец(9), Раб.место(10), Исполнитель(11), Продолж(12), Не актуален(13), Объект планирования(14), Представление объекта(15)
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[0]) continue;
            const durSec = parseFloat(r[12]) || 0;
            allPlanning.push({
              id: `imp-p-${Date.now()}-${i}`,
              document: (r[0] || '').toString(),
              master: (r[1] || '').toString(),
              author: (r[2] || '').toString(),
              organization: (r[3] || '').toString(),
              vehicle: (r[4] || '').toString(),
              number: (r[5] || '').toString(),
              plateNumber: (r[6] || '').toString(),
              vin: (r[7] || '').toString(),
              startTime: (r[8] || '').toString(),
              endTime: (r[9] || '').toString(),
              workStation: (r[10] || '').toString(),
              executor: (r[11] || '').toString(),
              durationSec: durSec,
              durationHours: Math.round(durSec / 3600 * 10) / 10,
              notRelevant: (r[13] || '').toString(),
              planObject: (r[14] || '').toString(),
              objectView: (r[15] || '').toString().replace(/\r?\n/g, ' / '),
            });
          }
        } else {
          // Выработка: Вид ремонта(0), Номер(1), VIN(2), Марка(3), Модель(4), Год(5), Заказ-наряд(6), Сотрудник(7), Дата начала(8), Дата окончания(9), Дата закрытия(10), Состояние(11), Мастер(12), Диспетчер(13), Нормочасы(14)
          for (let i = 2; i < rows.length; i++) { // skip header + subheader
            const r = rows[i];
            if (!r) continue;
            const nh = parseFloat(r[14]) || 0;
            allWorkers.push({
              id: `imp-w-${Date.now()}-${i}`,
              repairType: (r[0] || '').toString(),
              number: (r[1] || '').toString(),
              vin: (r[2] || '').toString(),
              brand: (r[3] || '').toString(),
              model: (r[4] || '').toString(),
              year: (r[5] || '').toString(),
              workOrder: (r[6] || '').toString(),
              worker: (r[7] || '').toString(),
              startDate: (r[8] || '').toString(),
              endDate: (r[9] || '').toString(),
              closeDate: (r[10] || '').toString(),
              orderStatus: (r[11] || '').toString(),
              master: (r[12] || '').toString(),
              dispatcher: (r[13] || '').toString(),
              normHours: nh,
            });
          }
        }
      } catch (e) {
        console.error('Parse error:', uf.name, e);
      }
    }

    setUploadedFiles(prev => prev.map(f => ({ ...f, processed: true })));
    setProcessing(false);
    onProcess?.({ planning: allPlanning, workers: allWorkers });
  };

  const removeFile = (idx) => setUploadedFiles(prev => prev.filter((_, i) => i !== idx));

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
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Excel (.xlsx, .xls), CSV (.csv)</p>
        <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={e => handleFiles(e.target.files)} />
      </div>
      {uploadedFiles.map((f, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={14} style={{ color: '#10b981' }} />
            <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{f.name}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{f.size}</span>
          </div>
          <div className="flex items-center gap-2">
            {f.processed && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>{isRu ? 'Обработан' : 'Done'}</span>}
            {!f.processed && <Check size={12} style={{ color: '#10b981' }} />}
            <button onClick={() => removeFile(i)} className="hover:opacity-60"><X size={12} style={{ color: 'var(--text-muted)' }} /></button>
          </div>
        </div>
      ))}
      {uploadedFiles.length > 0 && !uploadedFiles.every(f => f.processed) && (
        <button onClick={handleProcess} disabled={processing}
          className="w-full py-2 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          {processing ? (isRu ? 'Обработка...' : 'Processing...') : (isRu ? 'Обработать и применить' : 'Process & Apply')}
        </button>
      )}
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
  const [importResult, setImportResult] = useState(null);
  const [unsavedPlanning, setUnsavedPlanning] = useState([]);
  const [unsavedWorkers, setUnsavedWorkers] = useState([]);
  const [saved, setSaved] = useState(false);

  const lang = i18n.language;
  const isRu = lang === 'ru';

  const hasUnsaved = unsavedPlanning.length > 0 || unsavedWorkers.length > 0;

  useEffect(() => {
    api.get('/api/1c-stats').then(r => setStats(r.data)).catch(console.error);
    api.get('/api/1c-planning').then(r => {
      const base = r.data || [];
      const saved = localStorage.getItem('1c-imported-planning');
      const imported = saved ? JSON.parse(saved) : [];
      setPlanning([...imported, ...base]);
    }).catch(console.error);
    api.get('/api/1c-workers').then(r => {
      const base = r.data || [];
      const saved = localStorage.getItem('1c-imported-workers');
      const imported = saved ? JSON.parse(saved) : [];
      setWorkers([...imported, ...base]);
    }).catch(console.error);
  }, []);

  const handleProcessFiles = ({ planning: newPlanning, workers: newWorkers }) => {
    // Show parsed data in tables but don't save yet
    if (newPlanning.length) {
      setPlanning(p => [...newPlanning, ...p]);
      setUnsavedPlanning(prev => [...prev, ...newPlanning]);
    }
    if (newWorkers.length) {
      setWorkers(w => [...newWorkers, ...w]);
      setUnsavedWorkers(prev => [...prev, ...newWorkers]);
    }

    const total = newPlanning.length + newWorkers.length;
    setImportResult({ count: total, planning: newPlanning.length, workers: newWorkers.length });
    setSaved(false);
    setShowUpload(false);
    if (newPlanning.length > 0) setTab('planning');
    else if (newWorkers.length > 0) setTab('workers');
  };

  const handleSave = () => {
    if (unsavedPlanning.length) {
      const prev = JSON.parse(localStorage.getItem('1c-imported-planning') || '[]');
      localStorage.setItem('1c-imported-planning', JSON.stringify([...unsavedPlanning, ...prev]));
    }
    if (unsavedWorkers.length) {
      const prev = JSON.parse(localStorage.getItem('1c-imported-workers') || '[]');
      localStorage.setItem('1c-imported-workers', JSON.stringify([...unsavedWorkers, ...prev]));
    }
    setUnsavedPlanning([]);
    setUnsavedWorkers([]);
    setSaved(true);
    setTimeout(() => { setSaved(false); setImportResult(null); }, 4000);
  };

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
          <FileUploadZone lang={lang} onProcess={handleProcessFiles} />
        </div>
      )}

      {/* Import result notification + Save button */}
      {importResult && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: hasUnsaved ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${hasUnsaved ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
          <div className="flex items-center gap-2">
            <Check size={14} style={{ color: hasUnsaved ? '#f59e0b' : '#10b981' }} />
            <span className="text-xs font-medium" style={{ color: hasUnsaved ? '#f59e0b' : '#10b981' }}>
              {saved
                ? (isRu ? 'Данные сохранены' : 'Data saved')
                : isRu
                  ? `Загружено ${importResult.count} записей (планирование: ${importResult.planning}, выработка: ${importResult.workers})`
                  : `Loaded ${importResult.count} records (planning: ${importResult.planning}, output: ${importResult.workers})`}
            </span>
          </div>
          {hasUnsaved && (
            <button onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-all"
              style={{ background: '#10b981' }}>
              <Save size={12} />
              {isRu ? 'Сохранить' : 'Save'}
            </button>
          )}
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
