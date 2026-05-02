import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/useSocket';
import {
  ArrowLeft, Clock, Car, ChevronUp, ChevronDown, Calendar,
  Filter, RefreshCw, Wrench, Users as UsersIcon, Shield, Eye,
  ArrowUpDown, Circle,
} from 'lucide-react';
import HelpButton from '../components/HelpButton';
import { translateWorksDesc } from '../utils/translate';
import { POST_STATUS_COLORS } from '../constants';

// ── Status helpers ──────────────────────────────────────────────────
const CONFIDENCE_COLORS = { HIGH: '#10b981', MEDIUM: '#f59e0b', LOW: '#ef4444' };

function StatusDot({ status }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: POST_STATUS_COLORS[status] || POST_STATUS_COLORS.no_data }} />;
}

function ConfidenceBadge({ confidence }) {
  const c = confidence || 'LOW';
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{ background: (CONFIDENCE_COLORS[c] || '#94a3b8') + '22', color: CONFIDENCE_COLORS[c] || '#94a3b8' }}>
      {c}
    </span>
  );
}

// ── Period presets ───────────────────────────────────────────────────
function getPeriodDates(period) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'yesterday': {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case '3d':
      start.setDate(start.getDate() - 3);
      start.setHours(0, 0, 0, 0);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

// ── Build history items from DB data ────────────────────────────────
function buildDbItems(events = [], stays = [], workOrders = []) {
  const items = [];

  for (const e of events) {
    const plate = e.vehicleSession?.plateNumber || null;
    items.push({
      timestamp: e.createdAt || e.startTime,
      status: e.type?.includes('occupied') || e.type?.includes('entered') ? 'occupied'
        : e.type?.includes('vacated') || e.type?.includes('left') ? 'free'
        : e.type?.includes('worker_present') ? 'active_work'
        : e.type?.includes('worker_absent') ? 'occupied_no_work'
        : e.type || 'unknown',
      car: plate ? { plate, model: null, make: null } : null,
      worksInProgress: e.type === 'work_activity',
      worksDescription: null,
      peopleCount: e.type?.includes('worker_present') ? 1 : 0,
      confidence: e.confidence >= 0.9 ? 'HIGH' : e.confidence >= 0.7 ? 'MEDIUM' : 'LOW',
      eventType: e.type,
      source: 'event',
      cameraSource: e.cameraSources || (e.camera?.name ? `[${e.camera.name}]` : null),
    });
  }

  for (const s of stays) {
    const plate = s.vehicleSession?.plateNumber || null;
    items.push({
      timestamp: s.startTime,
      status: s.isActive ? 'active_work' : s.hasWorker ? 'occupied' : 'occupied_no_work',
      car: plate ? { plate, model: null, make: null } : null,
      worksInProgress: s.isActive,
      worksDescription: null,
      peopleCount: s.hasWorker ? 1 : 0,
      confidence: 'HIGH',
      source: 'stay',
      duration: s.endTime ? Math.round((new Date(s.endTime) - new Date(s.startTime)) / 60000) : null,
      activeTime: s.activeTime,
      idleTime: s.idleTime,
      endTime: s.endTime,
    });
    if (s.endTime) {
      items.push({
        timestamp: s.endTime, status: 'free',
        car: plate ? { plate, model: null, make: null } : null,
        worksInProgress: false, peopleCount: 0, confidence: 'HIGH', source: 'stay_end',
      });
    }
  }

  for (const wo of workOrders) {
    items.push({
      timestamp: wo.startTime || wo.scheduledTime,
      status: wo.status === 'completed' ? 'free' : wo.status === 'in_progress' ? 'active_work' : 'occupied',
      car: wo.plateNumber ? { plate: wo.plateNumber, model: wo.model, make: wo.brand } : null,
      worksInProgress: wo.status === 'in_progress',
      worksDescription: wo.workType || null,
      peopleCount: wo.worker ? 1 : 0,
      confidence: 'HIGH',
      source: 'workOrder',
      workOrderNumber: wo.orderNumber || wo.externalId,
      worker: wo.worker,
      normHours: wo.normHours,
      actualHours: wo.actualHours,
      woStatus: wo.status,
    });
  }

  const seen = new Set();
  return items.filter(item => {
    const key = `${item.timestamp}_${item.status}_${item.car?.plate || ''}_${item.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Main page ───────────────────────────────────────────────────────
export default function PostHistory() {
  const { postNumber } = useParams();
  const postNum = parseInt(postNumber, 10);
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api, appMode } = useAuth();
  const navigate = useNavigate();
  const isLive = appMode === 'live';

  // State
  const [history, setHistory] = useState([]);
  const [currentState, setCurrentState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortField, setSortField] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 50;

  // ── Fetch data ──────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      if (isLive) {
        // Live mode: load monitoring history + DB data in parallel
        const [monRes, dbRes] = await Promise.all([
          api.get(`/api/monitoring/post-history/${postNum}`),
          api.get(`/api/posts/by-number/${postNum}/history?limit=500`),
        ]);

        const monHistory = monRes.data?.history || [];
        const monState = monRes.data;

        let dbItems = [];
        let dbPost = null;
        if (dbRes.data) {
          const { events = [], stays = [], workOrders = [], post } = dbRes.data;
          dbPost = post;
          dbItems = buildDbItems(events, stays, workOrders);
        }

        setCurrentState(monState?.zone ? monState : dbPost || null);
        // Merge: monitoring history first (real-time), then DB items
        const all = [...monHistory, ...dbItems];
        // Deduplicate
        const seen = new Set();
        setHistory(all.filter(item => {
          const key = `${new Date(item.timestamp).getTime()}_${item.status}_${item.car?.plate || ''}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }));
      } else {
        // Demo mode: combined data from events + stays + work orders
        const res = await api.get(`/api/posts/by-number/${postNum}/history?limit=500`);
        if (res.data) {
          const { events = [], stays = [], workOrders = [], post } = res.data;
          setCurrentState(post || null);
          setHistory(buildDbItems(events, stays, workOrders));
        }
      }
    } catch (err) {
      console.error('PostHistory fetch error:', err);
    }
    setLoading(false);
  }, [api, postNum, isLive]);

  useEffect(() => { fetchData(); }, [fetchData]);
  usePolling(fetchData, isLive ? 10000 : 30000);

  // ── Filter & sort ─────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    let items = [...history];

    // Period filter
    if (period !== 'all') {
      let start, end;
      if (period === 'custom' && customFrom && customTo) {
        start = new Date(customFrom);
        end = new Date(customTo);
        end.setHours(23, 59, 59, 999);
      } else if (period !== 'custom') {
        const dates = getPeriodDates(period);
        start = dates.start;
        end = dates.end;
      }
      if (start && end) {
        items = items.filter(h => {
          const ts = new Date(h.timestamp);
          return ts >= start && ts <= end;
        });
      }
    }

    // Status filter
    if (statusFilter !== 'all') {
      items = items.filter(h => h.status === statusFilter || h.eventType === statusFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(h =>
        (h.car?.plate || '').toLowerCase().includes(q) ||
        (h.worksDescription || '').toLowerCase().includes(q) ||
        (h.status || '').toLowerCase().includes(q) ||
        (h.eventType || '').toLowerCase().includes(q) ||
        (h.car?.model || '').toLowerCase().includes(q) ||
        (h.car?.make || '').toLowerCase().includes(q) ||
        (h.worker || '').toLowerCase().includes(q) ||
        (h.workOrderNumber || '').toLowerCase().includes(q)
      );
    }

    // Sort
    items.sort((a, b) => {
      let va, vb;
      switch (sortField) {
        case 'timestamp':
          va = new Date(a.timestamp).getTime();
          vb = new Date(b.timestamp).getTime();
          break;
        case 'status':
          va = a.status || '';
          vb = b.status || '';
          break;
        case 'plate':
          va = a.car?.plate || '';
          vb = b.car?.plate || '';
          break;
        case 'confidence':
          va = a.confidence === 'HIGH' ? 3 : a.confidence === 'MEDIUM' ? 2 : 1;
          vb = b.confidence === 'HIGH' ? 3 : b.confidence === 'MEDIUM' ? 2 : 1;
          break;
        default:
          va = new Date(a.timestamp).getTime();
          vb = new Date(b.timestamp).getTime();
      }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });

    return items;
  }, [history, period, customFrom, customTo, statusFilter, search, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / perPage));
  const pagedHistory = filteredHistory.slice((page - 1) * perPage, page * perPage);

  useEffect(() => { setPage(1); }, [period, statusFilter, search, sortField, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredHistory.length;
    const free = filteredHistory.filter(h => h.status === 'free').length;
    const occupied = filteredHistory.filter(h => h.status === 'occupied').length;
    const activeWork = filteredHistory.filter(h => h.status === 'active_work' || h.worksInProgress).length;
    const plates = new Set(filteredHistory.filter(h => h.car?.plate).map(h => h.car.plate));
    return { total, free, occupied, activeWork, uniquePlates: plates.size };
  }, [filteredHistory]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown size={10} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={10} style={{ color: 'var(--accent)' }} />
      : <ChevronDown size={10} style={{ color: 'var(--accent)' }} />;
  };

  // ── Status label ──────────────────────────────────────────────
  const statusLabel = (status, eventType) => {
    if (eventType) {
      const key = `events.${eventType}`;
      const translated = t(key);
      if (translated !== key) return translated;
    }
    if (status === 'free') return isRu ? 'Свободен' : 'Free';
    if (status === 'occupied') return isRu ? 'Занят' : 'Occupied';
    if (status === 'active_work') return isRu ? 'В работе' : 'Active work';
    if (status === 'occupied_no_work') return isRu ? 'Простой' : 'Idle';
    return status;
  };

  const formatTime = (ts) => {
    if (!ts) return '---';
    const d = new Date(ts);
    return d.toLocaleString(isRu ? 'ru-RU' : 'en-US', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const PERIOD_OPTIONS = [
    { key: 'today', label: isRu ? 'Сегодня' : 'Today' },
    { key: 'yesterday', label: isRu ? 'Вчера' : 'Yesterday' },
    { key: '3d', label: isRu ? '3 дня' : '3 days' },
    { key: '7d', label: isRu ? '7 дней' : '7 days' },
    { key: '30d', label: isRu ? '30 дней' : '30 days' },
    { key: 'all', label: isRu ? 'Все' : 'All' },
    { key: 'custom', label: isRu ? 'Период' : 'Custom' },
  ];

  const STATUS_OPTIONS = [
    { key: 'all', label: isRu ? 'Все' : 'All' },
    { key: 'free', label: isRu ? 'Свободен' : 'Free', color: POST_STATUS_COLORS.free },
    { key: 'occupied', label: isRu ? 'Занят' : 'Occupied', color: POST_STATUS_COLORS.occupied },
    { key: 'active_work', label: isRu ? 'В работе' : 'Active', color: POST_STATUS_COLORS.active_work },
  ];

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:opacity-80 transition-opacity"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {(() => {
                  const ruName = currentState?.displayName || currentState?.name || `Пост ${postNum}`;
                  const enName = currentState?.displayNameEn || currentState?.displayName || currentState?.name || `Post ${postNum}`;
                  return isRu ? `${ruName} — История` : `${enName} — History`;
                })()}
              </h1>
              <HelpButton pageKey="postHistory" />
            </div>
            {currentState && (
              <div className="flex items-center gap-2 mt-0.5">
                <StatusDot status={currentState.status || 'free'} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {statusLabel(currentState.status || 'free')}
                  {currentState.plateNumber && ` | ${currentState.plateNumber}`}
                  {currentState.zone?.name && ` | ${currentState.zone.name}`}
                  {currentState.type && ` (${currentState.type})`}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData}
            className="p-2 rounded-xl hover:opacity-80 transition-opacity"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {stats.total} {isRu ? 'записей' : 'records'}
          </span>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: isRu ? 'Всего' : 'Total', value: stats.total, color: 'var(--accent)' },
          { label: isRu ? 'Свободен' : 'Free', value: stats.free, color: POST_STATUS_COLORS.free },
          { label: isRu ? 'Занят' : 'Occupied', value: stats.occupied, color: POST_STATUS_COLORS.occupied },
          { label: isRu ? 'В работе' : 'Active', value: stats.activeWork, color: POST_STATUS_COLORS.active_work },
          { label: isRu ? 'Авто' : 'Vehicles', value: stats.uniquePlates, color: 'var(--info)' },
        ].map((s, i) => (
          <div key={i} className="glass-static rounded-xl p-3 text-center">
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-static rounded-xl p-3 space-y-3">
        {/* Period */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {isRu ? 'Период:' : 'Period:'}
          </span>
          <div className="flex gap-1 flex-wrap">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: period === opt.key ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: period === opt.key ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${period === opt.key ? 'var(--accent)' : 'var(--border-glass)'}`,
                }}>
                {opt.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="px-2 py-1 rounded text-xs"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="px-2 py-1 rounded text-xs"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
            </div>
          )}
        </div>

        {/* Status filter + search */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <div className="flex gap-1">
            {STATUS_OPTIONS.map(opt => (
              <button key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                style={{
                  background: statusFilter === opt.key ? (opt.color || 'var(--accent)') + '22' : 'var(--bg-secondary)',
                  color: statusFilter === opt.key ? (opt.color || 'var(--accent)') : 'var(--text-secondary)',
                  border: `1px solid ${statusFilter === opt.key ? (opt.color || 'var(--accent)') + '44' : 'var(--border-glass)'}`,
                }}>
                {opt.color && <Circle size={8} fill={opt.color} stroke="none" />}
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isRu ? 'Поиск по номеру, авто...' : 'Search by plate, car...'}
            className="px-3 py-1.5 rounded-lg text-xs flex-1 min-w-[150px]"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-static rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {[
                  { key: 'timestamp', label: isRu ? 'Время' : 'Time', icon: Clock },
                  { key: 'status', label: isRu ? 'Статус' : 'Status', icon: Eye },
                  { key: 'plate', label: isRu ? 'Госномер' : 'Plate', icon: Car },
                  { key: 'details', label: isRu ? 'Детали' : 'Details', icon: Wrench, noSort: true },
                  { key: 'people', label: isRu ? 'Люди' : 'People', icon: UsersIcon, noSort: true },
                  { key: 'confidence', label: isRu ? 'Точность' : 'Confidence', icon: Shield },
                ].map(col => (
                  <th key={col.key}
                    onClick={col.noSort ? undefined : () => toggleSort(col.key)}
                    className={`px-3 py-2 text-left font-semibold ${col.noSort ? '' : 'cursor-pointer hover:opacity-80'}`}
                    style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-glass)' }}>
                    <div className="flex items-center gap-1">
                      <col.icon size={11} />
                      {col.label}
                      {!col.noSort && <SortIcon field={col.key} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !history.length ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  <RefreshCw size={16} className="animate-spin inline mr-2" />
                  {isRu ? 'Загрузка...' : 'Loading...'}
                </td></tr>
              ) : pagedHistory.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  {isRu ? 'Нет данных за выбранный период' : 'No data for selected period'}
                </td></tr>
              ) : pagedHistory.map((item, idx) => {
                const resolvedStatus = item.eventType
                  ? item.status
                  : item.status === 'free' ? 'free'
                  : item.worksInProgress ? 'active_work'
                  : 'occupied';

                return (
                  <tr key={idx}
                    className="transition-colors hover:opacity-90"
                    style={{ borderBottom: '1px solid var(--border-glass)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                    <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                      {formatTime(item.timestamp)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <StatusDot status={resolvedStatus} />
                        <span style={{ color: POST_STATUS_COLORS[resolvedStatus] || 'var(--text-secondary)' }}>
                          {statusLabel(resolvedStatus, item.eventType)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {item.car?.plate ? (
                        <span className="font-mono font-bold px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                          {item.car.plate}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                      {item.car?.model && (
                        <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {item.car.make || ''} {item.car.model}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[250px]" style={{ color: 'var(--text-secondary)' }}>
                      <div className="flex flex-col gap-0.5">
                        {item.worksDescription && (
                          <span className="truncate block" title={item.worksDescription}>
                            {isRu ? translateWorksDesc(item.worksDescription, true) : item.worksDescription}
                          </span>
                        )}
                        {item.workOrderNumber && (
                          <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>
                            {isRu ? 'ЗН' : 'WO'} {item.workOrderNumber}
                          </span>
                        )}
                        {item.worker && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {item.worker}
                          </span>
                        )}
                        {item.duration != null && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {item.duration} {isRu ? 'мин' : 'min'}
                          </span>
                        )}
                        {!item.worksDescription && !item.workOrderNumber && !item.worker && !item.duration && (
                          item.openParts?.length > 0
                            ? <span className="text-xs">{item.openParts.join(', ')}</span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.peopleCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium"
                          style={{ color: 'var(--text-primary)' }}>
                          <UsersIcon size={11} /> {item.peopleCount}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>0</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <ConfidenceBadge confidence={item.confidence} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: '1px solid var(--border-glass)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {isRu ? `Стр. ${page} из ${totalPages}` : `Page ${page} of ${totalPages}`}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="px-2 py-1 rounded text-xs disabled:opacity-30"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                {'<<'}
              </button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2 py-1 rounded text-xs disabled:opacity-30"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                {'<'}
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="px-2.5 py-1 rounded text-xs font-medium"
                    style={{
                      background: page === p ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: page === p ? '#fff' : 'var(--text-secondary)',
                    }}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-2 py-1 rounded text-xs disabled:opacity-30"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                {'>'}
              </button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                className="px-2 py-1 rounded text-xs disabled:opacity-30"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                {'>>'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Zone History Page (reuses the same layout as PostHistory)
// ═════════════════════════════════════════════════════════════════
export function ZoneHistory() {
  const { zoneName: rawZoneName } = useParams();
  const zoneName = decodeURIComponent(rawZoneName || '');
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api, appMode } = useAuth();
  const navigate = useNavigate();
  const isLive = appMode === 'live';

  const [history, setHistory] = useState([]);
  const [currentState, setCurrentState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortField, setSortField] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 50;

  const fetchData = useCallback(async () => {
    try {
      // Get zone history from monitoring API
      const res = await api.get(`/api/monitoring/zone-history/${encodeURIComponent(zoneName)}`);
      if (res.data) {
        setCurrentState(res.data);
        setHistory(res.data.history || []);
      }
    } catch (err) {
      console.error('ZoneHistory fetch error:', err);
    }
    setLoading(false);
  }, [api, zoneName]);

  useEffect(() => { fetchData(); }, [fetchData]);
  usePolling(fetchData, isLive ? 10000 : 30000);

  // Reuse the same filtering logic
  const filteredHistory = useMemo(() => {
    let items = [...history];
    if (period !== 'all') {
      let start, end;
      if (period === 'custom' && customFrom && customTo) {
        start = new Date(customFrom);
        end = new Date(customTo); end.setHours(23, 59, 59, 999);
      } else if (period !== 'custom') {
        const dates = getPeriodDates(period);
        start = dates.start; end = dates.end;
      }
      if (start && end) items = items.filter(h => { const ts = new Date(h.timestamp); return ts >= start && ts <= end; });
    }
    if (statusFilter !== 'all') items = items.filter(h => h.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(h =>
        (h.car?.plate || '').toLowerCase().includes(q) ||
        (h.worksDescription || '').toLowerCase().includes(q) ||
        (h.status || '').toLowerCase().includes(q) ||
        (h.car?.model || '').toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime(), tb = new Date(b.timestamp).getTime();
      if (sortField === 'status') {
        const sa = a.status || '', sb = b.status || '';
        return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
      }
      return sortDir === 'asc' ? ta - tb : tb - ta;
    });
    return items;
  }, [history, period, customFrom, customTo, statusFilter, search, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / perPage));
  const pagedHistory = filteredHistory.slice((page - 1) * perPage, page * perPage);
  useEffect(() => { setPage(1); }, [period, statusFilter, search, sortField, sortDir]);

  const stats = useMemo(() => {
    const total = filteredHistory.length;
    const free = filteredHistory.filter(h => h.status === 'free').length;
    const occupied = filteredHistory.filter(h => h.status === 'occupied').length;
    const activeWork = filteredHistory.filter(h => h.worksInProgress).length;
    const plates = new Set(filteredHistory.filter(h => h.car?.plate).map(h => h.car.plate));
    return { total, free, occupied, activeWork, uniquePlates: plates.size };
  }, [filteredHistory]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown size={10} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />;
    return sortDir === 'asc' ? <ChevronUp size={10} style={{ color: 'var(--accent)' }} /> : <ChevronDown size={10} style={{ color: 'var(--accent)' }} />;
  };

  const statusLabel = (status) => {
    if (status === 'free') return isRu ? 'Свободен' : 'Free';
    if (status === 'occupied') return isRu ? 'Занят' : 'Occupied';
    if (status === 'active_work') return isRu ? 'В работе' : 'Active work';
    return status;
  };

  const formatTime = (ts) => {
    if (!ts) return '---';
    return new Date(ts).toLocaleString(isRu ? 'ru-RU' : 'en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const PERIOD_OPTIONS = [
    { key: 'today', label: isRu ? 'Сегодня' : 'Today' },
    { key: 'yesterday', label: isRu ? 'Вчера' : 'Yesterday' },
    { key: '3d', label: isRu ? '3 дня' : '3 days' },
    { key: '7d', label: isRu ? '7 дней' : '7 days' },
    { key: '30d', label: isRu ? '30 дней' : '30 days' },
    { key: 'all', label: isRu ? 'Все' : 'All' },
    { key: 'custom', label: isRu ? 'Период' : 'Custom' },
  ];

  const STATUS_OPTIONS = [
    { key: 'all', label: isRu ? 'Все' : 'All' },
    { key: 'free', label: isRu ? 'Свободен' : 'Free', color: POST_STATUS_COLORS.free },
    { key: 'occupied', label: isRu ? 'Занят' : 'Occupied', color: POST_STATUS_COLORS.occupied },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:opacity-80 transition-opacity"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {zoneName} — {isRu ? 'История' : 'History'}
            </h1>
            {currentState && (
              <div className="flex items-center gap-2 mt-0.5">
                <StatusDot status={currentState.status || 'free'} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {statusLabel(currentState.status || 'free')}
                  {currentState.plateNumber && ` | ${currentState.plateNumber}`}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData}
            className="p-2 rounded-xl hover:opacity-80"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{stats.total} {isRu ? 'записей' : 'records'}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: isRu ? 'Всего' : 'Total', value: stats.total, color: 'var(--accent)' },
          { label: isRu ? 'Свободен' : 'Free', value: stats.free, color: POST_STATUS_COLORS.free },
          { label: isRu ? 'Занят' : 'Occupied', value: stats.occupied, color: POST_STATUS_COLORS.occupied },
          { label: isRu ? 'В работе' : 'Active', value: stats.activeWork, color: POST_STATUS_COLORS.active_work },
          { label: isRu ? 'Авто' : 'Vehicles', value: stats.uniquePlates, color: 'var(--info)' },
        ].map((s, i) => (
          <div key={i} className="glass-static rounded-xl p-3 text-center">
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-static rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{isRu ? 'Период:' : 'Period:'}</span>
          <div className="flex gap-1 flex-wrap">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => setPeriod(opt.key)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{ background: period === opt.key ? 'var(--accent)' : 'var(--bg-secondary)', color: period === opt.key ? '#fff' : 'var(--text-secondary)', border: `1px solid ${period === opt.key ? 'var(--accent)' : 'var(--border-glass)'}` }}>
                {opt.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="px-2 py-1 rounded text-xs" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="px-2 py-1 rounded text-xs" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <div className="flex gap-1">
            {STATUS_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => setStatusFilter(opt.key)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                style={{ background: statusFilter === opt.key ? (opt.color || 'var(--accent)') + '22' : 'var(--bg-secondary)', color: statusFilter === opt.key ? (opt.color || 'var(--accent)') : 'var(--text-secondary)', border: `1px solid ${statusFilter === opt.key ? (opt.color || 'var(--accent)') + '44' : 'var(--border-glass)'}` }}>
                {opt.color && <Circle size={8} fill={opt.color} stroke="none" />}
                {opt.label}
              </button>
            ))}
          </div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isRu ? 'Поиск по номеру, авто...' : 'Search by plate, car...'}
            className="px-3 py-1.5 rounded-lg text-xs flex-1 min-w-[150px]"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
        </div>
      </div>

      {/* Table */}
      <div className="glass-static rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {[
                  { key: 'timestamp', label: isRu ? 'Время' : 'Time', icon: Clock },
                  { key: 'status', label: isRu ? 'Статус' : 'Status', icon: Eye },
                  { key: 'plate', label: isRu ? 'Госномер' : 'Plate', icon: Car },
                  { key: 'details', label: isRu ? 'Детали' : 'Details', icon: Wrench, noSort: true },
                  { key: 'people', label: isRu ? 'Люди' : 'People', icon: UsersIcon, noSort: true },
                  { key: 'confidence', label: isRu ? 'Точность' : 'Confidence', icon: Shield },
                ].map(col => (
                  <th key={col.key} onClick={col.noSort ? undefined : () => toggleSort(col.key)}
                    className={`px-3 py-2 text-left font-semibold ${col.noSort ? '' : 'cursor-pointer hover:opacity-80'}`}
                    style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-glass)' }}>
                    <div className="flex items-center gap-1">
                      <col.icon size={11} /> {col.label}
                      {!col.noSort && <SortIcon field={col.key} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !history.length ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  <RefreshCw size={16} className="animate-spin inline mr-2" />{isRu ? 'Загрузка...' : 'Loading...'}
                </td></tr>
              ) : pagedHistory.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  {isRu ? 'Нет данных за выбранный период' : 'No data for selected period'}
                </td></tr>
              ) : pagedHistory.map((item, idx) => {
                const resolvedStatus = item.status === 'free' ? 'free' : item.worksInProgress ? 'active_work' : 'occupied';
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                    <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{formatTime(item.timestamp)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <StatusDot status={resolvedStatus} />
                        <span style={{ color: POST_STATUS_COLORS[resolvedStatus] || 'var(--text-secondary)' }}>{statusLabel(resolvedStatus)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {item.car?.plate ? (
                        <span className="font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{item.car.plate}</span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      {(item.car?.model || item.car?.make) && (
                        <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>{item.car.make} {item.car.model}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[250px]" style={{ color: 'var(--text-secondary)' }}>
                      {item.worksDescription ? (
                        <span className="truncate block" title={item.worksDescription}>
                          {isRu ? translateWorksDesc(item.worksDescription, true) : item.worksDescription}
                        </span>
                      ) : item.openParts?.length > 0 ? (
                        <span className="text-xs">{item.openParts.join(', ')}</span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.peopleCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                          <UsersIcon size={11} /> {item.peopleCount}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>0</span>}
                    </td>
                    <td className="px-3 py-2"><ConfidenceBadge confidence={item.confidence} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: '1px solid var(--border-glass)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{isRu ? `Стр. ${page} из ${totalPages}` : `Page ${page} of ${totalPages}`}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 rounded text-xs disabled:opacity-30" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{'<<'}</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 rounded text-xs disabled:opacity-30" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{'<'}</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                if (p > totalPages) return null;
                return <button key={p} onClick={() => setPage(p)} className="px-2.5 py-1 rounded text-xs font-medium" style={{ background: page === p ? 'var(--accent)' : 'var(--bg-secondary)', color: page === p ? '#fff' : 'var(--text-secondary)' }}>{p}</button>;
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 rounded text-xs disabled:opacity-30" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{'>'}</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 rounded text-xs disabled:opacity-30" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{'>>'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// PostHistory Modal (used inline from MapViewer / other pages)
// ═════════════════════════════════════════════════════════════════
export function PostHistoryModal({ postNumber, historyData, onClose, onOpenFullPage }) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const [sortDir, setSortDir] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');

  const items = useMemo(() => {
    let arr = [...(historyData || [])];
    if (statusFilter !== 'all') {
      arr = arr.filter(h => h.status === statusFilter || (statusFilter === 'active_work' && h.worksInProgress));
    }
    arr.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return sortDir === 'asc' ? ta - tb : tb - ta;
    });
    return arr;
  }, [historyData, sortDir, statusFilter]);

  const formatTime = (ts) => {
    if (!ts) return '---';
    const d = new Date(ts);
    return d.toLocaleString(isRu ? 'ru-RU' : 'en-US', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="glass rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] flex flex-col"
        style={{ border: '1px solid var(--border-glass)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock size={18} style={{ color: 'var(--accent)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {typeof postNumber === 'number' || /^\d+$/.test(postNumber)
                ? (isRu ? `Пост ${postNumber} — История` : `Post ${postNumber} — History`)
                : `${postNumber} — ${isRu ? 'История' : 'History'}`}
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              {items.length} {isRu ? 'записей' : 'records'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-60"
            style={{ color: 'var(--text-muted)' }}>
            <span className="text-lg">&times;</span>
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="px-2.5 py-1 rounded-lg text-xs flex items-center gap-1"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)' }}>
            {sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            {sortDir === 'desc' ? (isRu ? 'Новые' : 'Newest') : (isRu ? 'Старые' : 'Oldest')}
          </button>
          {[
            { key: 'all', label: isRu ? 'Все' : 'All' },
            { key: 'free', label: isRu ? 'Свободен' : 'Free', color: POST_STATUS_COLORS.free },
            { key: 'occupied', label: isRu ? 'Занят' : 'Occupied', color: POST_STATUS_COLORS.occupied },
            { key: 'active_work', label: isRu ? 'Работа' : 'Work', color: POST_STATUS_COLORS.active_work },
          ].map(opt => (
            <button key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className="px-2.5 py-1 rounded-lg text-xs flex items-center gap-1"
              style={{
                background: statusFilter === opt.key ? (opt.color || 'var(--accent)') + '22' : 'var(--bg-secondary)',
                color: statusFilter === opt.key ? (opt.color || 'var(--accent)') : 'var(--text-secondary)',
                border: `1px solid ${statusFilter === opt.key ? (opt.color || 'var(--accent)') + '44' : 'var(--border-glass)'}`,
              }}>
              {opt.color && <Circle size={8} fill={opt.color} stroke="none" />}
              {opt.label}
            </button>
          ))}
          <div className="flex-1" />
          {onOpenFullPage && (
            <button onClick={onOpenFullPage}
              className="px-3 py-1 rounded-lg text-xs font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {isRu ? 'Полная страница' : 'Full page'}
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {items.length === 0 ? (
            <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>
              {isRu ? 'Нет записей' : 'No records'}
            </div>
          ) : items.map((item, idx) => {
            const status = item.status === 'free' ? 'free' : item.worksInProgress ? 'active_work' : 'occupied';
            return (
              <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ background: idx % 2 === 0 ? 'var(--bg-glass)' : 'transparent' }}>
                <StatusDot status={status} />
                <span className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                  {formatTime(item.timestamp)}
                </span>
                <span className="text-xs font-medium" style={{ color: POST_STATUS_COLORS[status] || 'var(--text-secondary)' }}>
                  {status === 'free' ? (isRu ? 'Свободен' : 'Free')
                    : status === 'active_work' ? (isRu ? 'В работе' : 'Active')
                    : (isRu ? 'Занят' : 'Occupied')}
                </span>
                {item.car?.plate && (
                  <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                    {item.car.plate}
                  </span>
                )}
                {item.car?.model && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {item.car.model}
                  </span>
                )}
                {item.worksDescription && (
                  <span className="text-xs truncate max-w-[150px]" style={{ color: 'var(--text-muted)' }}
                    title={item.worksDescription}>
                    {isRu ? translateWorksDesc(item.worksDescription, true) : item.worksDescription}
                  </span>
                )}
                <div className="flex-1" />
                <ConfidenceBadge confidence={item.confidence} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
