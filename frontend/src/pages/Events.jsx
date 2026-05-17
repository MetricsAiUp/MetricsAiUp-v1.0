import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/useSocket';
import { translateZone, translatePost } from '../utils/translate';
import HelpButton from '../components/HelpButton';
import Pagination from '../components/Pagination';
import { getAppTimezone } from '../utils/appTimezone';
import {
  Car, LogOut, Move, Clock, Square, SquareCheck, UserCheck, UserX,
  Wrench, Pause, ArrowUpDown, Search, RefreshCw, Activity, FileText,
} from 'lucide-react';

// ── Event metadata (10 CV-event types) ─────────────────────────────────────────
const EVENT_META = {
  vehicle_entered_zone: { ru: 'Въезд в зону',  en: 'Entered zone', icon: Car, group: 'vehicle' },
  vehicle_left_zone:    { ru: 'Выезд из зоны', en: 'Left zone',    icon: LogOut, group: 'vehicle' },
  vehicle_moving:       { ru: 'Движение',      en: 'Moving',       icon: Move, group: 'vehicle' },
  vehicle_waiting:      { ru: 'Ожидание',      en: 'Waiting',      icon: Clock, group: 'vehicle' },
  post_occupied:        { ru: 'Пост занят',    en: 'Post occupied',icon: Square, group: 'post' },
  post_vacated:         { ru: 'Пост свободен', en: 'Post free',    icon: SquareCheck, group: 'post' },
  worker_present:       { ru: 'Работник пришёл', en: 'Worker present', icon: UserCheck, group: 'worker' },
  worker_absent:        { ru: 'Работник ушёл',   en: 'Worker absent',  icon: UserX,     group: 'worker' },
  work_activity:        { ru: 'Активная работа', en: 'Active work',    icon: Wrench,    group: 'work' },
  work_idle:            { ru: 'Простой',         en: 'Idle',           icon: Pause,     group: 'work' },
  // Derived items (from stays / work orders)
  post_stay_start:      { ru: 'Заезд на пост',   en: 'Post stay started', icon: Square,      group: 'post' },
  post_stay_end:        { ru: 'Съезд с поста',   en: 'Post stay ended',   icon: SquareCheck, group: 'post' },
  workorder:            { ru: 'Заказ-наряд',     en: 'Work order',        icon: FileText,    group: 'work' },
};

const GROUPS = [
  { key: 'all',     ru: 'Все',      en: 'All' },
  { key: 'vehicle', ru: 'Авто',     en: 'Vehicle' },
  { key: 'post',    ru: 'Пост',     en: 'Post' },
  { key: 'worker',  ru: 'Работник', en: 'Worker' },
  { key: 'work',    ru: 'Работа',   en: 'Work' },
];

const PERIODS = [
  { key: 'today',     ru: 'Сегодня',  en: 'Today' },
  { key: 'yesterday', ru: 'Вчера',    en: 'Yesterday' },
  { key: '3d',        ru: '3 дня',    en: '3 days' },
  { key: '7d',        ru: '7 дней',   en: '7 days' },
  { key: '30d',       ru: '30 дней',  en: '30 days' },
  { key: 'all',       ru: 'Все',      en: 'All' },
];

const PER_PAGE_OPTIONS = [25, 50, 100];

function getPeriodRange(period) {
  if (period === 'all') return null;
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  switch (period) {
    case 'today':     start.setHours(0, 0, 0, 0); break;
    case 'yesterday':
      start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);     end.setHours(23, 59, 59, 999);
      break;
    case '3d':  start.setDate(start.getDate() - 3);  start.setHours(0, 0, 0, 0); break;
    case '7d':  start.setDate(start.getDate() - 7);  start.setHours(0, 0, 0, 0); break;
    case '30d': start.setDate(start.getDate() - 30); start.setHours(0, 0, 0, 0); break;
    default: return null;
  }
  return { start, end };
}

function confidenceTier(c) {
  const pct = Math.round((c ?? 0) * 100);
  if (pct >= 90) return { label: 'HIGH', pct };
  if (pct >= 70) return { label: 'MED',  pct };
  return { label: 'LOW', pct };
}

// ── Build items from live monitoring segments ─────────────────────────────────
// Source: /api/monitoring/segments → [{ zone: 'Пост 01', segments: [{kind,startTs,endTs,bestPlate,bestConfidence}] }]
// Бэкенд уже схлопнул snapshot'ы в сегменты busy/free (см. monitoring.js).
function buildLiveItems({ liveSegments, posts, zones }) {
  const items = [];
  const postByName = new Map(posts.map(p => [p.name, p]));
  const zoneByName = new Map(zones.map(z => [z.name, z]));

  const confidenceValue = (c) =>
    c === 'HIGH' ? 0.95 : c === 'MEDIUM' ? 0.8 : c === 'LOW' ? 0.6 : 0;

  for (const z of liveSegments || []) {
    const zoneNameRaw = z.zone || '';
    const postMatch = zoneNameRaw.match(/Пост\s+(\d{2})/);
    let post = null;
    let zone = null;
    if (postMatch) {
      const postName = `Пост ${parseInt(postMatch[1], 10)}`;
      post = postByName.get(postName) || postByName.get(zoneNameRaw) || null;
      zone = post?.zoneId ? zones.find(zz => zz.id === post.zoneId) : null;
    } else {
      zone = zoneByName.get(zoneNameRaw) || null;
    }

    for (const seg of z.segments || []) {
      if (seg.kind === 'busy') {
        items.push({
          key: `live_${zoneNameRaw}_in_${seg.startTs}`,
          timestamp: seg.startTs,
          type: 'post_occupied',
          post, zone,
          plate: seg.bestPlate || null,
          confidence: confidenceValue(seg.bestConfidence) || null,
          cameraLabel: null,
          source: 'event',
        });
      } else {
        items.push({
          key: `live_${zoneNameRaw}_out_${seg.startTs}`,
          timestamp: seg.startTs,
          type: 'post_vacated',
          post, zone,
          plate: null,
          confidence: null,
          cameraLabel: null,
          source: 'event',
        });
      }
    }
  }

  return items;
}

// ── Build unified items: events + postStays + workOrders ───────────────────────
function buildItems({ events, postsHistory, posts, zones }) {
  const items = [];
  const postById = new Map(posts.map(p => [p.id, p]));
  const zoneById = new Map(zones.map(z => [z.id, z]));

  // 1. Raw events from /api/events
  for (const e of events) {
    const post = e.post || (e.postId ? postById.get(e.postId) : null);
    const zone = e.zone || (e.zoneId ? zoneById.get(e.zoneId) : null) || (post?.zoneId ? zoneById.get(post.zoneId) : null);
    let camLabel = null;
    try { const src = JSON.parse(e.cameraSources || '[]'); camLabel = src[0] || null; } catch { /* ignore */ }
    items.push({
      key: `ev_${e.id}`,
      timestamp: e.startTime || e.createdAt,
      type: e.type,
      post,
      zone,
      plate: e.vehicleSession?.plateNumber || null,
      confidence: e.confidence,
      cameraLabel: camLabel,
      source: 'event',
    });
  }

  // 2. PostStay (per post) → start + end
  // 3. WorkOrders (per post)
  for (const ph of postsHistory) {
    const post = ph.post;
    const zone = post?.zone || (post?.zoneId ? zoneById.get(post.zoneId) : null);

    for (const e of ph.events || []) {
      // events from posts-history endpoint usually already in /api/events, dedup by id later
      const ePost = e.post || post;
      const eZone = e.zone || zone;
      let camLabel = null;
      try { const src = JSON.parse(e.cameraSources || '[]'); camLabel = src[0] || null; } catch { /* ignore */ }
      items.push({
        key: `ev_${e.id}`,
        timestamp: e.startTime || e.createdAt,
        type: e.type,
        post: ePost,
        zone: eZone,
        plate: e.vehicleSession?.plateNumber || null,
        confidence: e.confidence,
        cameraLabel: camLabel,
        source: 'event',
      });
    }

    for (const s of ph.stays || []) {
      const plate = s.vehicleSession?.plateNumber || null;
      items.push({
        key: `stayS_${s.id}`,
        timestamp: s.startTime,
        type: 'post_stay_start',
        post, zone, plate,
        confidence: 1,
        cameraLabel: null,
        source: 'stay',
      });
      if (s.endTime) {
        items.push({
          key: `stayE_${s.id}`,
          timestamp: s.endTime,
          type: 'post_stay_end',
          post, zone, plate,
          confidence: 1,
          cameraLabel: null,
          source: 'stay',
        });
      }
    }

    for (const wo of ph.workOrders || []) {
      const ts = wo.startTime || wo.scheduledTime || wo.createdAt;
      if (!ts) continue;
      items.push({
        key: `wo_${wo.id}`,
        timestamp: ts,
        type: 'workorder',
        post, zone,
        plate: wo.plateNumber || null,
        confidence: 1,
        cameraLabel: null,
        source: 'workOrder',
        meta: { orderNumber: wo.orderNumber || wo.externalId, status: wo.status, worker: wo.worker },
      });
    }
  }

  // Dedup by key
  const seen = new Set();
  return items.filter(it => {
    if (seen.has(it.key)) return false;
    seen.add(it.key);
    return true;
  });
}

export default function Events() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api, appMode } = useAuth();
  const isLive = appMode === 'live';

  // Lists for selectors
  const [posts, setPosts] = useState([]);
  const [zones, setZones] = useState([]);

  // Unified items
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [period, setPeriod] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [postFilter, setPostFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ── Fetch posts/zones once on mount ───────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [pRes, zRes] = await Promise.all([api.get('/api/posts'), api.get('/api/zones')]);
        setPosts(pRes.data || []);
        setZones(zRes.data || []);
      } catch (err) {
        console.error('posts/zones load:', err);
      }
    })();
  }, [api]);

  // ── Fetch unified history ─────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      // Need posts before per-post fetch; if not yet loaded, fetch them inline.
      let postsList = posts;
      let zonesList = zones;
      if (!postsList.length || !zonesList.length) {
        const [pRes, zRes] = await Promise.all([api.get('/api/posts'), api.get('/api/zones')]);
        postsList = pRes.data || [];
        zonesList = zRes.data || [];
        setPosts(postsList);
        setZones(zonesList);
      }

      if (isLive) {
        // Live: один запрос в monitoring proxy — сразу сегменты busy/free по всем зонам/постам.
        const res = await api.get('/api/monitoring/segments?days=30').catch(() => ({ data: [] }));
        const liveSegments = Array.isArray(res.data) ? res.data : [];
        const unified = buildLiveItems({ liveSegments, posts: postsList, zones: zonesList });
        setItems(unified);
      } else {
        // Demo: данные из БД (events + per-post stays/workOrders).
        const [eventsRes, ...historyRes] = await Promise.all([
          api.get('/api/events?limit=1000'),
          ...postsList.map(p =>
            api.get(`/api/posts/by-number/${p.number}/history?limit=300`).catch(() => ({ data: null }))
          ),
        ]);
        const events = eventsRes.data?.events || eventsRes.data || [];
        const postsHistory = historyRes.map(r => r.data).filter(Boolean);
        const unified = buildItems({ events, postsHistory, posts: postsList, zones: zonesList });
        setItems(unified);
      }
    } catch (err) {
      console.error('Events fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [api, isLive, posts, zones]);

  useEffect(() => { fetchData(); }, [fetchData]);
  usePolling(autoRefresh ? fetchData : null, 15000);

  // ── Filtering ─────────────────────────────────────────────────────
  const periodRange = useMemo(() => getPeriodRange(period), [period]);

  const inPeriod = useMemo(() => {
    if (!periodRange) return items;
    const sMs = periodRange.start.getTime();
    const eMs = periodRange.end.getTime();
    return items.filter(it => {
      const ts = new Date(it.timestamp).getTime();
      return ts >= sMs && ts <= eMs;
    });
  }, [items, periodRange]);

  const kpi = useMemo(() => {
    const acc = { all: 0, vehicle: 0, post: 0, worker: 0, work: 0 };
    inPeriod.forEach(it => {
      acc.all += 1;
      const g = EVENT_META[it.type]?.group;
      if (g && acc[g] != null) acc[g] += 1;
    });
    return acc;
  }, [inPeriod]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return inPeriod
      .filter(it => {
        if (groupFilter !== 'all' && EVENT_META[it.type]?.group !== groupFilter) return false;
        if (typeFilter !== 'all' && it.type !== typeFilter) return false;
        if (zoneFilter !== 'all' && it.zone?.name !== zoneFilter) return false;
        if (postFilter !== 'all' && it.post?.name !== postFilter) return false;
        if (s && !(
          (EVENT_META[it.type]?.[isRu ? 'ru' : 'en'] || it.type || '').toLowerCase().includes(s) ||
          (it.zone?.name || '').toLowerCase().includes(s) ||
          (it.post?.name || '').toLowerCase().includes(s) ||
          (it.plate || '').toLowerCase().includes(s)
        )) return false;
        return true;
      })
      .sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return sortDir === 'desc' ? tb - ta : ta - tb;
      });
  }, [inPeriod, groupFilter, typeFilter, zoneFilter, postFilter, search, sortDir, isRu]);

  useEffect(() => { setPage(0); }, [
    period, groupFilter, typeFilter, zoneFilter, postFilter, search, perPage,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice(page * perPage, (page + 1) * perPage);

  const availableTypes = useMemo(() => {
    if (groupFilter === 'all') return Object.keys(EVENT_META);
    return Object.entries(EVENT_META).filter(([, m]) => m.group === groupFilter).map(([k]) => k);
  }, [groupFilter]);

  // ── Format helpers ────────────────────────────────────────────────
  const formatTime = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString(isRu ? 'ru-RU' : 'en-US', {
      timeZone: getAppTimezone(), hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };
  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return isRu ? 'Сегодня' : 'Today';
    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return isRu ? 'Вчера' : 'Yesterday';
    return d.toLocaleDateString(isRu ? 'ru-RU' : 'en-US', {
      timeZone: getAppTimezone(), day: '2-digit', month: '2-digit',
    });
  };

  // ── 0.xyz design tokens ───────────────────────────────────────────
  const lineColor = 'var(--border-glass)';
  const muted = 'var(--text-muted)';
  const primary = 'var(--text-primary)';
  const secondary = 'var(--text-secondary)';

  return (
    <div className="space-y-8">
      {/* === Header === */}
      <div className="flex items-end justify-between flex-wrap gap-4 pb-6"
        style={{ borderBottom: `1px solid ${lineColor}` }}>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] mb-2" style={{ color: muted }}>
            {isRu ? 'СВОДНАЯ ИСТОРИЯ' : 'UNIFIED HISTORY'}
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: primary }}>
              {t('nav.events')}
            </h1>
            <HelpButton pageKey="events" />
          </div>
          <div className="text-xs mt-2" style={{ color: muted }}>
            {isRu
              ? `События • Заезды/съезды • Заказ-наряды — по ${posts.length} постам и ${zones.length} зонам`
              : `Events • Stays • Work orders — across ${posts.length} posts and ${zones.length} zones`}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 transition-colors"
            style={{
              border: `1px solid ${lineColor}`,
              color: autoRefresh ? primary : muted,
              background: 'transparent',
            }}
            title={isRu ? 'Авто-обновление' : 'Auto-refresh'}
          >
            <Activity size={12} className={autoRefresh ? 'animate-pulse' : ''} />
            <span className="uppercase tracking-wider">{autoRefresh ? 'LIVE' : (isRu ? 'ПАУЗА' : 'PAUSED')}</span>
          </button>
          <button
            onClick={() => fetchData()}
            className="inline-flex items-center gap-2 px-3 py-1.5 transition-colors"
            style={{ border: `1px solid ${lineColor}`, color: secondary, background: 'transparent' }}
            title={isRu ? 'Обновить' : 'Refresh'}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span className="uppercase tracking-wider">{isRu ? 'Обновить' : 'Refresh'}</span>
          </button>
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="inline-flex items-center gap-2 px-3 py-1.5 transition-colors"
            style={{ border: `1px solid ${lineColor}`, color: secondary, background: 'transparent' }}
          >
            <ArrowUpDown size={12} />
            <span className="uppercase tracking-wider">
              {sortDir === 'desc' ? (isRu ? 'Новые' : 'Newest') : (isRu ? 'Старые' : 'Oldest')}
            </span>
          </button>
        </div>
      </div>

      {/* === KPI strip === */}
      <div className="grid grid-cols-2 md:grid-cols-5"
        style={{ borderTop: `1px solid ${lineColor}`, borderBottom: `1px solid ${lineColor}` }}>
        {[
          { key: 'all',     label: isRu ? 'Всего'    : 'Total',   value: kpi.all },
          { key: 'vehicle', label: isRu ? 'Авто'     : 'Vehicle', value: kpi.vehicle },
          { key: 'post',    label: isRu ? 'Пост'     : 'Post',    value: kpi.post },
          { key: 'worker',  label: isRu ? 'Работник' : 'Worker',  value: kpi.worker },
          { key: 'work',    label: isRu ? 'Работа'   : 'Work',    value: kpi.work },
        ].map((k, idx, arr) => (
          <button
            key={k.key}
            onClick={() => setGroupFilter(k.key)}
            className="text-left px-5 py-5 transition-colors hover:opacity-80"
            style={{
              borderRight: idx < arr.length - 1 ? `1px solid ${lineColor}` : 'none',
              background: groupFilter === k.key ? 'var(--bg-glass)' : 'transparent',
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: muted }}>
              {k.label}
            </div>
            <div className="text-3xl font-semibold tabular-nums tracking-tight" style={{ color: primary }}>
              {k.value}
            </div>
          </button>
        ))}
      </div>

      {/* === Period chips === */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          {PERIODS.map(p => {
            const active = period === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className="px-3 py-1.5 text-xs uppercase tracking-wider transition-colors"
                style={{
                  border: `1px solid ${active ? primary : lineColor}`,
                  color: active ? primary : muted,
                  background: 'transparent',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {p[isRu ? 'ru' : 'en']}
              </button>
            );
          })}
        </div>
        <div className="text-[11px] uppercase tracking-wider" style={{ color: muted }}>
          {filtered.length} / {items.length}
        </div>
      </div>

      {/* === Search + Zone + Post selectors === */}
      <div className="flex flex-wrap items-end gap-6 pb-4" style={{ borderBottom: `1px solid ${lineColor}` }}>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: muted }}>
            {isRu ? 'Поиск' : 'Search'}
          </label>
          <div className="relative">
            <Search size={12} className="absolute left-0 top-1/2 -translate-y-1/2" style={{ color: muted }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isRu ? 'событие, зона, пост, номер...' : 'event, zone, post, plate...'}
              className="w-full pl-5 pr-2 py-1.5 bg-transparent outline-none text-sm"
              style={{ borderBottom: `1px solid ${lineColor}`, color: primary }}
            />
          </div>
        </div>

        <div className="min-w-[200px]">
          <label className="block text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: muted }}>
            {isRu ? 'Зона' : 'Zone'} <span style={{ color: muted }}>({zones.length})</span>
          </label>
          <select
            value={zoneFilter}
            onChange={e => setZoneFilter(e.target.value)}
            className="w-full py-1.5 bg-transparent outline-none text-sm cursor-pointer"
            style={{ borderBottom: `1px solid ${lineColor}`, color: primary }}
          >
            <option value="all">{isRu ? 'Все зоны' : 'All zones'}</option>
            {zones.map(z => (
              <option key={z.id} value={z.name}>{translateZone(z.name, isRu)}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[200px]">
          <label className="block text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: muted }}>
            {isRu ? 'Пост' : 'Post'} <span style={{ color: muted }}>({posts.length})</span>
          </label>
          <select
            value={postFilter}
            onChange={e => setPostFilter(e.target.value)}
            className="w-full py-1.5 bg-transparent outline-none text-sm cursor-pointer"
            style={{ borderBottom: `1px solid ${lineColor}`, color: primary }}
          >
            <option value="all">{isRu ? 'Все посты' : 'All posts'}</option>
            {posts
              .slice()
              .sort((a, b) => (a.number || 0) - (b.number || 0))
              .map(p => (
                <option key={p.id} value={p.name}>
                  {isRu ? (p.displayName || p.name) : (p.displayNameEn || p.displayName || p.name)}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* === Group + Type chips === */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1">
          {GROUPS.map(g => {
            const active = groupFilter === g.key;
            return (
              <button
                key={g.key}
                onClick={() => { setGroupFilter(g.key); setTypeFilter('all'); }}
                className="px-3 py-1.5 text-xs uppercase tracking-wider transition-colors"
                style={{
                  border: `1px solid ${active ? primary : lineColor}`,
                  color: active ? primary : muted,
                  background: 'transparent',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {g[isRu ? 'ru' : 'en']}
              </button>
            );
          })}
        </div>

        {groupFilter !== 'all' && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setTypeFilter('all')}
              className="px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors"
              style={{
                border: `1px solid ${typeFilter === 'all' ? primary : lineColor}`,
                color: typeFilter === 'all' ? primary : muted,
                background: 'transparent',
                fontWeight: typeFilter === 'all' ? 600 : 400,
              }}
            >
              {isRu ? 'Все типы' : 'All types'}
            </button>
            {availableTypes.map(type => {
              const meta = EVENT_META[type];
              const active = typeFilter === type;
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className="px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors"
                  style={{
                    border: `1px solid ${active ? primary : lineColor}`,
                    color: active ? primary : muted,
                    background: 'transparent',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {meta[isRu ? 'ru' : 'en']}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* === Table === */}
      <div>
        <div style={{ borderTop: `1px solid ${lineColor}`, borderBottom: `1px solid ${lineColor}` }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: `1px solid ${lineColor}` }}>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.18em] font-normal"
                  style={{ color: muted, width: '12%' }}>{isRu ? 'Время' : 'Time'}</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.18em] font-normal"
                  style={{ color: muted, width: '22%' }}>{isRu ? 'Событие' : 'Event'}</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.18em] font-normal"
                  style={{ color: muted, width: '18%' }}>{isRu ? 'Зона' : 'Zone'}</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.18em] font-normal"
                  style={{ color: muted, width: '12%' }}>{isRu ? 'Пост' : 'Post'}</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.18em] font-normal"
                  style={{ color: muted, width: '13%' }}>{isRu ? 'Авто' : 'Vehicle'}</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.18em] font-normal"
                  style={{ color: muted, width: '11%' }}>{isRu ? 'Точность' : 'Confidence'}</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.18em] font-normal"
                  style={{ color: muted, width: '12%' }}>{isRu ? 'Источник' : 'Source'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-xs uppercase tracking-wider"
                  style={{ color: muted }}>{isRu ? 'Загрузка...' : 'Loading...'}</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-xs uppercase tracking-wider"
                  style={{ color: muted }}>{t('common.noData')}</td></tr>
              ) : paginated.map(it => {
                const meta = EVENT_META[it.type] || { ru: it.type, en: it.type, icon: Clock, group: 'other' };
                const Icon = meta.icon;
                const conf = confidenceTier(it.confidence);
                return (
                  <tr key={it.key} className="transition-colors hover:bg-[var(--bg-glass)]"
                    style={{ borderBottom: `1px solid ${lineColor}` }}>
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm tabular-nums" style={{ color: primary }}>{formatTime(it.timestamp)}</div>
                      <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: muted }}>
                        {formatDate(it.timestamp)}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-3">
                        <Icon size={14} style={{ color: secondary }} />
                        <span className="text-sm" style={{ color: primary }}>{meta[isRu ? 'ru' : 'en']}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-sm" style={{ color: secondary }}>
                      {it.zone?.name && !it.zone?.deleted ? translateZone(it.zone.name, isRu) : '—'}
                    </td>
                    <td className="px-4 py-3 align-top text-sm" style={{ color: secondary }}>
                      {it.post ? (isRu
                        ? (it.post.displayName || translatePost(it.post.name, isRu))
                        : (it.post.displayNameEn || it.post.displayName || translatePost(it.post.name, isRu))
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {it.plate ? (
                        <span className="inline-block text-xs font-mono px-2 py-0.5"
                          style={{ border: `1px solid ${lineColor}`, color: primary }}>{it.plate}</span>
                      ) : <span className="text-xs" style={{ color: muted }}>—</span>}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5"
                        style={{ border: `1px solid ${lineColor}`, color: secondary }}>
                        {conf.label} · {conf.pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: muted }}>
                        {it.source === 'event' ? (isRu ? 'CV' : 'CV')
                          : it.source === 'stay' ? (isRu ? 'Заезд' : 'Stay')
                          : it.source === 'workOrder' ? (isRu ? 'ЗН' : 'WO')
                          : it.source}
                      </span>
                      {it.cameraLabel && (
                        <div className="text-[10px] font-mono mt-0.5" style={{ color: muted }}>
                          {it.cameraLabel}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3">
          <Pagination
            page={page + 1}
            totalPages={totalPages}
            totalItems={filtered.length}
            perPage={perPage}
            perPageOptions={PER_PAGE_OPTIONS}
            onPageChange={(p) => setPage(p - 1)}
            onPerPageChange={(pp) => { setPerPage(pp); setPage(0); }}
            compact
          />
        </div>
      </div>
    </div>
  );
}
