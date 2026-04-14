import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { RefreshCw, History, Radio, ChevronDown, ChevronRight, Clock, Car, Eye, Wrench, Users, Shield, AlertTriangle, MapPin } from 'lucide-react';

const AUTO_REFRESH_INTERVAL = 10000;

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return iso; }
}

function ConfidenceBadge({ level }) {
  const colors = { HIGH: 'var(--success)', MEDIUM: '#f59e0b', LOW: '#ef4444' };
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: `${colors[level] || colors.LOW}20`, color: colors[level] || colors.LOW }}>
      <Shield size={10} /> {level || 'N/A'}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    free: { color: 'var(--success)', label: 'free' },
    occupied: { color: '#f59e0b', label: 'occupied' },
    active_work: { color: 'var(--accent)', label: 'active_work' },
  };
  const s = map[status] || { color: 'var(--text-muted)', label: status || '?' };
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: `${s.color}20`, color: s.color }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

function OpenPartsBadge({ parts }) {
  if (!parts || parts.length === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p, i) => (
        <span key={i} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>{p}</span>
      ))}
    </div>
  );
}

function HistoryTable({ history, t }) {
  if (!history || history.length === 0) {
    return <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.noHistory')}</p>;
  }
  return (
    <div className="max-h-80 overflow-auto mt-1">
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-glass)', position: 'sticky', top: 0, zIndex: 1 }}>
            <th className="px-2 py-1 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.time')}</th>
            <th className="px-2 py-1 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.status')}</th>
            <th className="px-2 py-1 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.plate')}</th>
            <th className="px-2 py-1 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.car')}</th>
            <th className="px-2 py-1 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.works')}</th>
            <th className="px-2 py-1 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.people')}</th>
            <th className="px-2 py-1 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.openParts')}</th>
            <th className="px-2 py-1 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.confidence')}</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <td className="px-2 py-1 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{formatDate(h.lastUpdate)}</td>
              <td className="px-2 py-1"><StatusBadge status={h.status} /></td>
              <td className="px-2 py-1 font-mono" style={{ color: h.car?.plate ? 'var(--text-primary)' : 'var(--text-muted)' }}>{h.car?.plate || '—'}</td>
              <td className="px-2 py-1" style={{ color: 'var(--text-secondary)' }}>
                {h.car?.make && h.car?.model ? `${h.car.make} ${h.car.model}` : '—'}
                {h.car?.color ? ` (${h.car.color})` : ''}
              </td>
              <td className="px-2 py-1">
                {h.worksInProgress ? (
                  <span className="text-xs" style={{ color: 'var(--accent)' }}>{h.worksDescription || 'yes'}</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </td>
              <td className="px-2 py-1 text-center" style={{ color: 'var(--text-secondary)' }}>{h.peopleCount ?? 0}</td>
              <td className="px-2 py-1"><OpenPartsBadge parts={h.openParts} /></td>
              <td className="px-2 py-1"><ConfidenceBadge level={h.confidence} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RawDataRow({ item, t, viewMode }) {
  const [expanded, setExpanded] = useState(false);
  const car = item.car || {};
  const history = item.history || [];
  const hasHistory = history.length > 0;

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border-glass)' }} className="hover:opacity-90 transition-opacity">
        <td className="px-3 py-2">
          <button onClick={() => hasHistory && setExpanded(!expanded)} className="flex items-center gap-1" disabled={!hasHistory}>
            {hasHistory ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span className="w-3" />}
            <span className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>{item.zone}</span>
          </button>
        </td>
        <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
        <td className="px-3 py-2 font-mono text-xs" style={{ color: car.plate ? 'var(--text-primary)' : 'var(--text-muted)' }}>{car.plate || '—'}</td>
        <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {car.make && car.model ? `${car.make} ${car.model}` : '—'}
        </td>
        <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{car.color || '—'}</td>
        <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{car.body || '—'}</td>
        <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{formatDate(car.firstSeen)}</td>
        <td className="px-3 py-2 text-center">
          {item.worksInProgress ? (
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--accent)' }}><Wrench size={10} /> {t('liveDebug.yes')}</span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>—</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {item.worksDescription || '—'}
        </td>
        <td className="px-3 py-2 text-center text-xs">
          <span className="inline-flex items-center gap-1" style={{ color: item.peopleCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            <Users size={10} /> {item.peopleCount ?? 0}
          </span>
        </td>
        <td className="px-3 py-2"><OpenPartsBadge parts={item.openParts} /></td>
        <td className="px-3 py-2"><ConfidenceBadge level={item.confidence} /></td>
        <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{formatDate(item.lastUpdate)}</td>
        <td className="px-3 py-2 text-center text-xs" style={{ color: hasHistory ? 'var(--accent)' : 'var(--text-muted)' }}>
          {history.length}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={14} style={{ background: 'var(--bg-glass)', padding: '4px 12px 8px' }}>
            <HistoryTable history={history} t={t} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function LiveDebug() {
  const { t } = useTranslation();
  const { api, appMode } = useAuth();
  const isLive = appMode === 'live';

  const [rawData, setRawData] = useState([]);
  const [fullHistory, setFullHistory] = useState(null);
  const [viewMode, setViewMode] = useState('current'); // current | history
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [summary, setSummary] = useState(null);

  const fetchCurrent = useCallback(async () => {
    try {
      const [rawRes, stateRes] = await Promise.all([
        api.get('/api/monitoring/raw'),
        api.get('/api/monitoring/state'),
      ]);
      if (rawRes.data) setRawData(Array.isArray(rawRes.data) ? rawRes.data : []);
      if (stateRes.data) {
        setSummary(stateRes.data.summary || null);
        setLastUpdate(stateRes.data.lastUpdate || null);
      }
    } catch {}
    setLoading(false);
  }, [api]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/monitoring/full-history');
      if (res.data) setFullHistory(Array.isArray(res.data) ? res.data : []);
    } catch {}
    setLoading(false);
  }, [api]);

  useEffect(() => {
    if (viewMode === 'current') {
      fetchCurrent();
    } else {
      fetchHistory();
    }
  }, [viewMode]);

  // Auto-refresh for current mode
  useEffect(() => {
    if (viewMode !== 'current' || !autoRefresh) return;
    const id = setInterval(fetchCurrent, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [viewMode, autoRefresh, fetchCurrent]);

  if (!isLive) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="glass p-8 rounded-xl text-center" style={{ maxWidth: 400 }}>
          <AlertTriangle size={40} style={{ color: '#f59e0b', margin: '0 auto 12px' }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{t('liveDebug.liveOnly')}</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.switchToLive')}</p>
        </div>
      </div>
    );
  }

  const displayData = viewMode === 'current' ? rawData : (fullHistory || []);

  // Separate posts and zones
  const posts = displayData.filter(d => /^Пост\s+\d/.test(d.zone));
  const zones = displayData.filter(d => /^Свободная зона\s+\d/.test(d.zone));
  const other = displayData.filter(d => !/^Пост\s+\d/.test(d.zone) && !/^Свободная зона\s+\d/.test(d.zone));

  const totalHistory = displayData.reduce((sum, d) => sum + (d.history?.length || 0), 0);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('liveDebug.title')}</h1>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <Radio size={10} className="animate-pulse" /> LIVE
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
            <button
              onClick={() => setViewMode('current')}
              className="px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors"
              style={{
                background: viewMode === 'current' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'current' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <Eye size={12} /> {t('liveDebug.currentState')}
            </button>
            <button
              onClick={() => setViewMode('history')}
              className="px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors"
              style={{
                background: viewMode === 'history' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'history' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <History size={12} /> {t('liveDebug.fullHistory')}
            </button>
          </div>
          {/* Auto-refresh toggle */}
          {viewMode === 'current' && (
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="px-2 py-1.5 rounded-lg text-xs flex items-center gap-1"
              style={{
                border: '1px solid var(--border-glass)',
                color: autoRefresh ? 'var(--success)' : 'var(--text-muted)',
              }}
            >
              <RefreshCw size={12} className={autoRefresh ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
              {autoRefresh ? t('liveDebug.autoOn') : t('liveDebug.autoOff')}
            </button>
          )}
          {/* Manual refresh */}
          <button
            onClick={() => viewMode === 'current' ? fetchCurrent() : fetchHistory()}
            className="px-2 py-1.5 rounded-lg text-xs flex items-center gap-1"
            style={{ border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw size={12} /> {t('liveDebug.refresh')}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="flex flex-wrap gap-3">
        {summary && viewMode === 'current' && (
          <>
            <div className="glass p-3 rounded-lg flex-1" style={{ minWidth: 140 }}>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.postsTotal')}</div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{summary.posts?.total || 0}</div>
              <div className="text-xs mt-1 space-x-2">
                <span style={{ color: 'var(--success)' }}>{t('liveDebug.free')}: {summary.posts?.free || 0}</span>
                <span style={{ color: 'var(--accent)' }}>{t('liveDebug.working')}: {summary.posts?.working || 0}</span>
                <span style={{ color: '#f59e0b' }}>{t('liveDebug.idle')}: {summary.posts?.idle || 0}</span>
              </div>
            </div>
            <div className="glass p-3 rounded-lg flex-1" style={{ minWidth: 140 }}>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.zonesTotal')}</div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{summary.zones?.total || 0}</div>
              <div className="text-xs mt-1 space-x-2">
                <span style={{ color: 'var(--success)' }}>{t('liveDebug.free')}: {summary.zones?.free || 0}</span>
                <span style={{ color: '#f59e0b' }}>{t('liveDebug.occupied')}: {summary.zones?.occupied || 0}</span>
              </div>
            </div>
            <div className="glass p-3 rounded-lg flex-1" style={{ minWidth: 140 }}>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.vehiclesOnSite')}</div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{summary.vehiclesOnSite || 0}</div>
            </div>
          </>
        )}
        <div className="glass p-3 rounded-lg flex-1" style={{ minWidth: 140 }}>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.rawEntries')}</div>
          <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{displayData.length}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('liveDebug.historyRecords')}: {totalHistory}
          </div>
        </div>
        {lastUpdate && viewMode === 'current' && (
          <div className="glass p-3 rounded-lg flex-1" style={{ minWidth: 180 }}>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.lastUpdate')}</div>
            <div className="text-sm font-medium flex items-center gap-1 mt-1" style={{ color: 'var(--text-primary)' }}>
              <Clock size={12} /> {formatDate(lastUpdate)}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      )}

      {!loading && (
        <>
          {/* Posts table */}
          {posts.length > 0 && (
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <Car size={14} style={{ color: 'var(--accent)' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('liveDebug.posts')} ({posts.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-glass)' }}>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.zoneName')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.status')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.plate')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.carModel')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.color')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.body')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.firstSeen')}</th>
                      <th className="px-3 py-2 text-center" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.works')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.worksDesc')}</th>
                      <th className="px-3 py-2 text-center" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.people')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.openParts')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.confidence')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.lastUpdate')}</th>
                      <th className="px-3 py-2 text-center" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.historyCount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((item, i) => <RawDataRow key={i} item={item} t={t} viewMode={viewMode} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Zones table */}
          {zones.length > 0 && (
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <MapPin size={14} style={{ color: '#a855f7' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('liveDebug.zones')} ({zones.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-glass)' }}>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.zoneName')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.status')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.plate')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.carModel')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.color')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.body')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.firstSeen')}</th>
                      <th className="px-3 py-2 text-center" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.works')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.worksDesc')}</th>
                      <th className="px-3 py-2 text-center" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.people')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.openParts')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.confidence')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.lastUpdate')}</th>
                      <th className="px-3 py-2 text-center" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.historyCount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zones.map((item, i) => <RawDataRow key={i} item={item} t={t} viewMode={viewMode} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Other entries (if any) */}
          {other.length > 0 && (
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('liveDebug.other')} ({other.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-glass)' }}>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.zoneName')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.status')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.plate')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.carModel')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.color')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.body')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.firstSeen')}</th>
                      <th className="px-3 py-2 text-center" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.works')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.worksDesc')}</th>
                      <th className="px-3 py-2 text-center" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.people')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.openParts')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.confidence')}</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.lastUpdate')}</th>
                      <th className="px-3 py-2 text-center" style={{ color: 'var(--text-muted)' }}>{t('liveDebug.historyCount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {other.map((item, i) => <RawDataRow key={i} item={item} t={t} viewMode={viewMode} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {displayData.length === 0 && !loading && (
            <div className="glass rounded-xl p-8 text-center">
              <p style={{ color: 'var(--text-muted)' }}>{t('liveDebug.noData')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
