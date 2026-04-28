import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/useSocket';
import { translateZone, translatePost } from '../utils/translate';
import HelpButton from '../components/HelpButton';
import Pagination from '../components/Pagination';
import {
  Car, LogOut, Move, Clock, Square, SquareCheck, UserCheck, UserX,
  Wrench, Pause,
  ArrowUpDown, Search, RefreshCw,
} from 'lucide-react';

const EVENT_META = {
  vehicle_entered_zone: { ru: 'Въезд в зону', en: 'Entered zone', color: '#10b981', icon: Car, group: 'vehicle' },
  vehicle_left_zone: { ru: 'Выезд из зоны', en: 'Left zone', color: '#f59e0b', icon: LogOut, group: 'vehicle' },
  vehicle_moving: { ru: 'Движение', en: 'Moving', color: '#3b82f6', icon: Move, group: 'vehicle' },
  vehicle_waiting: { ru: 'Ожидание', en: 'Waiting', color: '#8b5cf6', icon: Clock, group: 'vehicle' },
  post_occupied: { ru: 'Пост занят', en: 'Post occupied', color: '#ef4444', icon: Square, group: 'post' },
  post_vacated: { ru: 'Пост свободен', en: 'Post free', color: '#10b981', icon: SquareCheck, group: 'post' },
  worker_present: { ru: 'Работник пришёл', en: 'Worker present', color: '#14b8a6', icon: UserCheck, group: 'worker' },
  worker_absent: { ru: 'Работник ушёл', en: 'Worker absent', color: '#f97316', icon: UserX, group: 'worker' },
  work_activity: { ru: 'Активная работа', en: 'Active work', color: '#6366f1', icon: Wrench, group: 'work' },
  work_idle: { ru: 'Простой', en: 'Idle', color: '#94a3b8', icon: Pause, group: 'work' },
};

const GROUPS = [
  { key: 'all', ru: 'Все', en: 'All' },
  { key: 'vehicle', ru: 'Авто', en: 'Vehicle' },
  { key: 'post', ru: 'Пост', en: 'Post' },
  { key: 'worker', ru: 'Работник', en: 'Worker' },
  { key: 'work', ru: 'Работа', en: 'Work' },
];

const PER_PAGE_OPTIONS = [25, 50, 100];

export default function Events() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api, appMode } = useAuth();
  const isLive = appMode === 'live';
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [groupFilter, setGroupFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [postFilter, setPostFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchEvents = async () => {
    try {
      const res = await api.get('/api/events?limit=200');
      setEvents(res.data?.events || res.data || []);
      setTotal(res.data?.total || res.data?.events?.length || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchEvents(); }, []);
  usePolling(autoRefresh ? fetchEvents : null, 5000);

  const uniqueZones = useMemo(() => [...new Set(events.map(e => e.zone?.name).filter(Boolean))].sort(), [events]);
  const uniquePosts = useMemo(() => [...new Set(events.map(e => e.post?.name).filter(Boolean))].sort(), [events]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return events
      .filter(e => {
        if (groupFilter !== 'all' && EVENT_META[e.type]?.group !== groupFilter) return false;
        if (typeFilter !== 'all' && e.type !== typeFilter) return false;
        if (zoneFilter !== 'all' && e.zone?.name !== zoneFilter) return false;
        if (postFilter !== 'all' && e.post?.name !== postFilter) return false;
        if (s && !(
          (EVENT_META[e.type]?.[isRu ? 'ru' : 'en'] || e.type).toLowerCase().includes(s) ||
          (e.zone?.name || '').toLowerCase().includes(s) ||
          (e.post?.name || '').toLowerCase().includes(s) ||
          (e.vehicleSession?.plateNumber || '').toLowerCase().includes(s)
        )) return false;
        return true;
      })
      .sort((a, b) => {
        const ta = new Date(a.startTime || a.createdAt).getTime();
        const tb = new Date(b.startTime || b.createdAt).getTime();
        return sortDir === 'desc' ? tb - ta : ta - tb;
      });
  }, [events, groupFilter, typeFilter, zoneFilter, postFilter, search, sortDir, isRu]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [groupFilter, typeFilter, zoneFilter, postFilter, search, perPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice(page * perPage, (page + 1) * perPage);

  // Types available for the selected group
  const availableTypes = useMemo(() => {
    if (groupFilter === 'all') return Object.keys(EVENT_META);
    return Object.entries(EVENT_META).filter(([, m]) => m.group === groupFilter).map(([k]) => k);
  }, [groupFilter]);

  const confBadge = (conf) => {
    const pct = Math.round(conf * 100);
    const color = pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';
    return (
      <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full"
        style={{ background: color + '18', color }}>{pct}%</span>
    );
  };

  const formatTime = (t) => {
    if (!t) return '—';
    const d = new Date(t);
    return d.toLocaleTimeString(isRu ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (t) => {
    if (!t) return '';
    const d = new Date(t);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return isRu ? 'Сегодня' : 'Today';
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return isRu ? 'Вчера' : 'Yesterday';
    return d.toLocaleDateString(isRu ? 'ru-RU' : 'en-US', { day: '2-digit', month: '2-digit' });
  };

  if (isLive) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('nav.events')}</h2>
        <div className="glass p-8 text-center" style={{ color: 'var(--text-muted)' }}>
          {isRu ? 'В режиме LIVE данные этой страницы не отображаются. Используйте Dashboard и Карту СТО.' : 'This page has no data in LIVE mode. Use Dashboard and STO Map.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('nav.events')}</h2>
          <HelpButton pageKey="events" />
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            {filtered.length} / {total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRefresh(v => !v)}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: autoRefresh ? 'var(--accent)' : 'var(--text-muted)', border: '1px solid var(--border-glass)' }}
            title={autoRefresh ? (isRu ? 'Авто-обновление вкл.' : 'Auto-refresh on') : (isRu ? 'Авто-обновление выкл.' : 'Auto-refresh off')}>
            <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
          </button>
          <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
            style={{ color: 'var(--accent)', border: '1px solid var(--border-glass)' }}>
            <ArrowUpDown size={12} />
            {sortDir === 'desc' ? (isRu ? 'Новые' : 'Newest') : (isRu ? 'Старые' : 'Oldest')}
          </button>
        </div>
      </div>

      {/* Search + Group filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative" style={{ minWidth: 200 }}>
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isRu ? 'Поиск по событиям...' : 'Search events...'}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border outline-none"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
        </div>
        <div className="flex gap-1">
          {GROUPS.map(g => (
            <button key={g.key} onClick={() => { setGroupFilter(g.key); setTypeFilter('all'); }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: groupFilter === g.key ? 'var(--accent)' : 'var(--bg-glass)',
                color: groupFilter === g.key ? 'white' : 'var(--text-muted)',
              }}>{g[isRu ? 'ru' : 'en']}</button>
          ))}
        </div>
      </div>

      {/* Type + Zone + Post filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Type chips */}
        {groupFilter !== 'all' && (
          <div className="flex flex-wrap gap-1 items-center">
            <button onClick={() => setTypeFilter('all')}
              className="px-2 py-1 rounded text-[10px] font-medium"
              style={{ background: typeFilter === 'all' ? 'var(--accent)' : 'var(--bg-glass)', color: typeFilter === 'all' ? 'white' : 'var(--text-muted)' }}>
              {isRu ? 'Все' : 'All'}
            </button>
            {availableTypes.map(type => {
              const meta = EVENT_META[type];
              return (
                <button key={type} onClick={() => setTypeFilter(type)}
                  className="px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1"
                  style={{ background: typeFilter === type ? meta.color + '25' : 'var(--bg-glass)', color: typeFilter === type ? meta.color : 'var(--text-muted)' }}>
                  {meta[isRu ? 'ru' : 'en']}
                </button>
              );
            })}
          </div>
        )}
        {/* Zone select */}
        <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)}
          className="px-2 py-1.5 rounded-lg text-xs border outline-none"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}>
          <option value="all">{isRu ? 'Все зоны' : 'All zones'}</option>
          {uniqueZones.map(z => <option key={z} value={z}>{translateZone(z, isRu)}</option>)}
        </select>
        {/* Post select */}
        <select value={postFilter} onChange={e => setPostFilter(e.target.value)}
          className="px-2 py-1.5 rounded-lg text-xs border outline-none"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}>
          <option value="all">{isRu ? 'Все посты' : 'All posts'}</option>
          {uniquePosts.map(p => <option key={p} value={p}>{translatePost(p, isRu)}</option>)}
        </select>
      </div>

      {/* Events table */}
      <div className="glass-static rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)', width: '13%' }}>{isRu ? 'Время' : 'Time'}</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)', width: '22%' }}>{isRu ? 'Событие' : 'Event'}</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)', width: '22%' }}>{isRu ? 'Зона' : 'Zone'}</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)', width: '13%' }}>{isRu ? 'Пост' : 'Post'}</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)', width: '15%' }}>{isRu ? 'Авто' : 'Vehicle'}</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)', width: '8%' }}>{isRu ? 'Увер.' : 'Conf.'}</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)', width: '7%' }}>{isRu ? 'Камера' : 'Cam'}</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>{t('common.noData')}</td></tr>
            ) : paginated.map(ev => {
              const meta = EVENT_META[ev.type] || { ru: ev.type, en: ev.type, color: '#94a3b8', icon: Clock, group: 'other' };
              const Icon = meta.icon;
              const time = ev.startTime || ev.createdAt;
              const plate = ev.vehicleSession?.plateNumber;
              let camLabel = '—';
              try {
                const src = JSON.parse(ev.cameraSources || '[]');
                camLabel = src[0] || '—';
              } catch { /* ignore */ }

              return (
                <tr key={ev.id} className="hover:opacity-80 transition-opacity" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                  <td className="px-3 py-2">
                    <div className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{formatTime(time)}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(time)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: meta.color + '20' }}>
                        <Icon size={13} style={{ color: meta.color }} />
                      </div>
                      <span className="text-xs font-medium" style={{ color: meta.color }}>{meta[isRu ? 'ru' : 'en']}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                    {translateZone(ev.zone?.name, isRu) || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {translatePost(ev.post, isRu) || '—'}
                  </td>
                  <td className="px-3 py-2">
                    {plate ? (
                      <span className="text-xs font-mono font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)' }}>
                        {plate}
                      </span>
                    ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">{confBadge(ev.confidence)}</td>
                  <td className="px-3 py-2 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{camLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <Pagination page={page + 1} totalPages={totalPages} totalItems={filtered.length}
          perPage={perPage} perPageOptions={PER_PAGE_OPTIONS}
          onPageChange={(p) => setPage(p - 1)} onPerPageChange={(pp) => { setPerPage(pp); setPage(0); }}
          compact />
      </div>
    </div>
  );
}
