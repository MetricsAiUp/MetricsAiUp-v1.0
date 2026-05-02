import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/useSocket';
import { Activity, Car, MapPin, Wrench, Pause, CheckCircle2, Square } from 'lucide-react';
import { POST_STATUS_COLORS } from '../constants';

// Единая палитра карты СТО: free=зелёный, occupied=оранжевый,
// occupied_no_work=красный, active_work=индиго, no_data=серый
const STATUS_DOT_COLORS = {
  free: POST_STATUS_COLORS.free,
  occupied: POST_STATUS_COLORS.occupied,
  occupied_no_work: POST_STATUS_COLORS.occupied_no_work,
  active_work: POST_STATUS_COLORS.active_work,
  no_data: POST_STATUS_COLORS.no_data,
};

// Дот цвета для зон — учитываем worksInProgress (см. карту СТО):
// если работа ведётся → индиго; если просто занята → оранжевый; иначе зелёный.
function zoneDotColor(zone) {
  if (zone.status !== 'occupied') return POST_STATUS_COLORS.free;
  if (zone.worksInProgress) return POST_STATUS_COLORS.active_work;
  return POST_STATUS_COLORS.occupied;
}

// Хекс → rgba (для прозрачных фонов в едином стиле)
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function SummaryPill({ icon: Icon, color, value, label }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-xs font-medium transition-all"
      style={{
        background: hexA(color, 0.12),
        border: `1px solid ${hexA(color, 0.28)}`,
        color,
      }}
    >
      <Icon size={11} strokeWidth={2.5} />
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span style={{ opacity: 0.85 }}>{label}</span>
    </span>
  );
}

function StatusDot({ color, dashed }) {
  if (dashed) {
    return (
      <span
        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ background: 'transparent', border: '1px dashed var(--text-muted)' }}
      />
    );
  }
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{
        background: color,
        boxShadow: `0 0 0 3px ${hexA(color, 0.18)}`,
      }}
    />
  );
}

function timeSince(startTime) {
  if (!startTime) return '';
  const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 60000);
  if (diff < 1) return '<1m';
  if (diff < 60) return `${diff}m`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ''}`;
}

export default function LiveSTOWidget() {
  const { t, i18n } = useTranslation();
  const { api } = useAuth();
  const isRu = i18n.language === 'ru';
  const [data, setData] = useState(null);

  const fetchLive = async () => {
    try {
      const res = await api.get('/api/dashboard/live');
      setData(res.data);
    } catch {
      // fallback: ignore
    }
  };

  useEffect(() => { fetchLive(); }, []);
  usePolling(fetchLive, 10000);

  if (!data) return null;

  const { summary, posts, freeZones, vehiclesOnSite, mode } = data;
  const isLive = mode === 'live';

  return (
    <div className="glass-static p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={16} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('liveWidget.title')}
          </h3>
          {isLive && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
              style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Car size={13} style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
              {vehiclesOnSite} {t('liveWidget.vehiclesOnSite').toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Summary badges — единая палитра карты СТО:
          working=индиго (active_work), idle=КРАСНЫЙ (occupied_no_work),
          free=зелёный, zonesOccupied=ОРАНЖЕВЫЙ (occupied). */}
      <div className="flex flex-wrap gap-2 mb-4">
        <SummaryPill
          icon={Wrench}
          color={POST_STATUS_COLORS.active_work}
          value={summary.working}
          label={t('liveWidget.working').toLowerCase()}
        />
        <SummaryPill
          icon={Pause}
          color={POST_STATUS_COLORS.occupied_no_work}
          value={summary.idle}
          label={t('liveWidget.idle').toLowerCase()}
        />
        <SummaryPill
          icon={CheckCircle2}
          color={POST_STATUS_COLORS.free}
          value={summary.free}
          label={t('liveWidget.free').toLowerCase()}
        />
        {isLive && summary.zonesOccupied != null && (
          <SummaryPill
            icon={Square}
            color={POST_STATUS_COLORS.occupied}
            value={summary.zonesOccupied}
            label={isRu ? 'зон занято' : 'zones occupied'}
          />
        )}
      </div>

      {/* Posts grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {posts.map(post => {
          const num = post.number ?? parseInt(post.name?.match(/\d+/)?.[0] || '0', 10);
          const isNoData = post.status === 'no_data';
          const dotColor = STATUS_DOT_COLORS[post.status] || POST_STATUS_COLORS.no_data;
          const noDataTitle = isRu
            ? 'Нет данных от CV-системы. Пост существует в БД и на карте, но не репортится.'
            : 'No data from CV system. Post exists in DB and map but is not reported.';
          return (
            <div
              key={post.id}
              title={isNoData ? noDataTitle : undefined}
              className="relative flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-lg overflow-hidden transition-all hover:translate-y-[-1px]"
              style={{
                background: isNoData
                  ? 'var(--bg-glass)'
                  : `linear-gradient(90deg, ${hexA(dotColor, 0.10)} 0%, var(--bg-glass) 60%)`,
                border: `1px solid ${isNoData ? 'var(--border-glass)' : hexA(dotColor, 0.28)}`,
                opacity: isNoData ? 0.55 : 1,
                fontStyle: isNoData ? 'italic' : 'normal',
              }}
            >
              {/* Левая цветная полоска-акцент по статусу */}
              {!isNoData && (
                <span
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ background: dotColor }}
                />
              )}
              <StatusDot color={dotColor} dashed={isNoData} />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold block leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {num > 0 ? (isRu ? `П${num}` : `P${num}`) : post.name}
                </span>
                <span className="text-[10px] block truncate leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {isNoData
                    ? (isRu ? 'Нет данных' : 'No data')
                    : (post.plateNumber || (isLive && post.carModel ? post.carModel : t('liveWidget.noVehicle')))}
                </span>
              </div>
              {!isNoData && (post.startTime || post.carFirstSeen) && (
                <span
                  className="text-[10px] flex-shrink-0 px-1.5 py-0.5 rounded font-medium"
                  style={{
                    background: hexA(dotColor, 0.14),
                    color: dotColor,
                  }}
                >
                  {timeSince(post.startTime || post.carFirstSeen)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Free zones grid (live mode only) */}
      {isLive && freeZones && freeZones.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-4 mb-2">
            <MapPin size={14} style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              {isRu ? 'Зоны' : 'Zones'}
            </span>
            <span className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {freeZones.map(zone => {
              const dotColor = zoneDotColor(zone);
              return (
                <div
                  key={zone.id}
                  className="relative flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-lg overflow-hidden transition-all hover:translate-y-[-1px]"
                  style={{
                    background: `linear-gradient(90deg, ${hexA(dotColor, 0.10)} 0%, var(--bg-glass) 60%)`,
                    border: `1px solid ${hexA(dotColor, 0.28)}`,
                  }}
                >
                  <span
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{ background: dotColor }}
                  />
                  <StatusDot color={dotColor} />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold block leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {zone.name}
                    </span>
                    <span className="text-[10px] block truncate leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {zone.plateNumber || zone.carModel || (
                        zone.status === 'free'
                          ? (isRu ? 'Свободна' : 'Free')
                          : zone.worksInProgress
                            ? (isRu ? 'Работы' : 'Work')
                            : (isRu ? 'Занята' : 'Occupied')
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
