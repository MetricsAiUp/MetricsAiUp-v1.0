import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Circle, Text, Group, Line } from 'react-konva';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePolling, useSocket } from '../hooks/useSocket';
import { POST_STATUS_COLORS } from '../constants';
import CameraStreamModal from '../components/CameraStreamModal';
import HelpButton from '../components/HelpButton';
import {
  X, Car, Clock, Timer, User, FileText, AlertTriangle,
  ArrowRight, MapPin, Layers, Download, ChevronDown, ChevronUp, Image, FileDown,
  ZoomIn, ZoomOut, Maximize, Minimize, Wrench, Users, Shield, Eye, History, Bug,
} from 'lucide-react';
import jsPDF from 'jspdf';
import PostTimer from '../components/PostTimer';
import { ZONE_FILL_OPACITY, CAMERA_FOV_OPACITY, DRIVEWAY_FILL } from '../constants/mapTheme';
import { translateWorksDesc } from '../utils/translate';
import { useCameraStatus } from '../hooks/useCameraStatus';
import { PostHistoryModal } from './PostHistory';

const ALL_CAMERAS = [
  { num: '00', loc: { ru: 'Шлагбаум', en: 'Barrier' }, covers: { ru: 'Шлагбаум', en: 'Barrier' } },
  { num: '01', loc: { ru: 'Стоянка', en: 'Parking' }, covers: { ru: 'Стоянка', en: 'Parking' } },
  { num: '02', loc: { ru: 'Ворота', en: 'Gates' }, covers: { ru: 'Ворота, Пост 7, Пост 8', en: 'Gates, Post 7, Post 8' } },
  { num: '03', loc: { ru: 'Посты 7, 8', en: 'Posts 7, 8' }, covers: { ru: 'Пост 7, Пост 8', en: 'Post 7, Post 8' } },
  { num: '04', loc: { ru: 'Посты 9, 8, 7', en: 'Posts 9, 8, 7' }, covers: { ru: 'Пост 9, Пост 8, Пост 7', en: 'Post 9, Post 8, Post 7' } },
  { num: '05', loc: { ru: 'Пост 10, Зона 07', en: 'Post 10, Zone 07' }, covers: { ru: 'Пост 10, Зона 07', en: 'Post 10, Zone 07' } },
  { num: '06', loc: { ru: 'Склад приёмки', en: 'Intake warehouse' }, covers: { ru: 'Склад приёмки', en: 'Intake warehouse' } },
  { num: '07', loc: { ru: 'Склад деталей', en: 'Parts warehouse' }, covers: { ru: 'Склад деталей', en: 'Parts warehouse' } },
  { num: '08', loc: { ru: 'Посты 6, 5', en: 'Posts 6, 5' }, covers: { ru: 'Пост 6, Пост 5, Зона 6, Зона 5', en: 'Post 6, Post 5, Zone 6, Zone 5' } },
  { num: '09', loc: { ru: 'Зона 06, Пост 5', en: 'Zone 06, Post 5' }, covers: { ru: 'Зона 06, Пост 5', en: 'Zone 06, Post 5' } },
  { num: '10', loc: { ru: 'Зоны 5, 4, 6', en: 'Zones 5, 4, 6' }, covers: { ru: 'Зона 05, Зона 04, Зона 06', en: 'Zone 05, Zone 04, Zone 06' } },
  { num: '11', loc: { ru: 'Пост 2, Зоны 4, 5', en: 'Post 2, Zones 4, 5' }, covers: { ru: 'Пост 2, Зона 04, Зона 05', en: 'Post 2, Zone 04, Zone 05' } },
  { num: '12', loc: { ru: 'Посты 1, 2', en: 'Posts 1, 2' }, covers: { ru: 'Пост 1, Пост 2', en: 'Post 1, Post 2' } },
  { num: '13', loc: { ru: 'Посты 5, 4', en: 'Posts 5, 4' }, covers: { ru: 'Пост 5, Пост 4', en: 'Post 5, Post 4' } },
  { num: '14', loc: { ru: 'Посты 3, 4, Зона 03', en: 'Posts 3, 4, Zone 03' }, covers: { ru: 'Пост 3, Пост 4, Зона 03', en: 'Post 3, Post 4, Zone 03' } },
  { num: '15', loc: { ru: 'Зона 01', en: 'Zone 01' }, covers: { ru: 'Зона 01', en: 'Zone 01' } },
];

// Translation dictionaries for live data
const COLOR_RU = {
  black: 'чёрный', white: 'белый', red: 'красный', blue: 'синий', green: 'зелёный',
  silver: 'серебристый', gray: 'серый', grey: 'серый', yellow: 'жёлтый', orange: 'оранжевый',
  brown: 'коричневый', beige: 'бежевый', gold: 'золотистый', purple: 'фиолетовый',
};
const BODY_RU = {
  sedan: 'седан', suv: 'внедорожник', hatchback: 'хэтчбек', wagon: 'универсал',
  van: 'фургон', truck: 'грузовик', pickup: 'пикап', coupe: 'купе', minivan: 'минивэн',
  crossover: 'кроссовер',
};
const CONFIDENCE_RU = { HIGH: 'высокая', MEDIUM: 'средняя', LOW: 'низкая' };
const PARTS_RU = {
  hood: 'капот', trunk: 'багажник', doors: 'двери', door: 'дверь',
  tailgate: 'задняя дверь', bonnet: 'капот',
};
function trMap(dict, val) { return val ? (dict[val.toLowerCase()] || val) : val; }

function fmtTime(t) {
  if (!t) return '—';
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function ConfidenceBadge({ level, isRu }) {
  const colors = { HIGH: 'var(--success)', MEDIUM: '#f59e0b', LOW: '#ef4444' };
  const label = isRu ? (CONFIDENCE_RU[level] || level || 'Н/Д') : (level || 'N/A');
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
      style={{ background: `${colors[level] || colors.LOW}20`, color: colors[level] || colors.LOW }}>
      <Shield size={10} /> {label}
    </span>
  );
}

function OpenPartsBadges({ parts, isRu }) {
  if (!parts || parts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p, i) => (
        <span key={i} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
          {isRu ? (PARTS_RU[p.toLowerCase()] || p) : p}
        </span>
      ))}
    </div>
  );
}

function LiveInfoBlock({ liveItem, t, isRu }) {
  if (!liveItem) return null;
  const car = liveItem.car || {};
  return (
    <div className="space-y-2">
      {/* Vehicle */}
      <div className="p-3 rounded-xl" style={{ background: 'var(--accent-light)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Car size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('mapView.currentVehicle')}</span>
        </div>
        {car.plate ? (
          <div>
            <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{car.plate}</span>
            <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>
              {[car.make, car.model].filter(Boolean).join(' ')}
            </span>
            {car.color && <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>({isRu ? trMap(COLOR_RU, car.color) : car.color})</span>}
            {car.body && <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>{isRu ? trMap(BODY_RU, car.body) : car.body}</span>}
          </div>
        ) : (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('posts.free')}</span>
        )}
        {car.firstSeen && (
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('mapView.firstSeen')}: {new Date(car.firstSeen).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* Works */}
      {liveItem.worksInProgress && (
        <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Wrench size={14} style={{ color: 'var(--accent)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('mapView.worksInProgress')}</span>
          </div>
          {liveItem.worksDescription && (
            <div className="text-xs" style={{ color: 'var(--text-primary)' }}>{translateWorksDesc(liveItem.worksDescription, isRu)}</div>
          )}
        </div>
      )}

      {/* People + Open Parts + Confidence */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-xl text-center" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <Users size={12} style={{ color: 'var(--text-muted)', margin: '0 auto 2px' }} />
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('mapView.people')}</div>
          <div className="text-sm font-bold" style={{ color: liveItem.peopleCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{liveItem.peopleCount ?? 0}</div>
        </div>
        <div className="p-2 rounded-xl text-center" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <Eye size={12} style={{ color: 'var(--text-muted)', margin: '0 auto 2px' }} />
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('mapView.confidence')}</div>
          <div className="mt-0.5"><ConfidenceBadge level={liveItem.confidence} isRu={isRu} /></div>
        </div>
        <div className="p-2 rounded-xl text-center" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <Clock size={12} style={{ color: 'var(--text-muted)', margin: '0 auto 2px' }} />
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('mapView.lastUpdate')}</div>
          <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {liveItem.lastUpdate ? new Date(liveItem.lastUpdate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
          </div>
        </div>
      </div>

      {/* Open parts */}
      {liveItem.openParts?.length > 0 && (
        <div className="p-2 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{t('mapView.openParts')}</div>
          <OpenPartsBadges parts={liveItem.openParts} isRu={isRu} />
        </div>
      )}
    </div>
  );
}

function PostModal({ postNum, dashboardData, monitoringData, isLive, onClose, onGoToPost, onGoToHistory, t, isRu }) {
  // In live mode, find raw monitoring item for this post
  const rawItems = monitoringData?.rawState || [];
  const liveItem = rawItems.find(item => {
    const m = item.zone?.match(/^Пост\s+(\d{2})/);
    return m && parseInt(m[1], 10) === postNum;
  });

  // In demo mode, find from dashboardData
  const demoPost = dashboardData?.posts?.find(p => p.number === postNum);

  // Determine status
  let statusColor, statusKey;
  if (isLive && liveItem) {
    const s = liveItem.status === 'free' ? 'free' : liveItem.worksInProgress ? 'active_work' : 'occupied';
    statusColor = POST_STATUS_COLORS[s] || '#94a3b8';
    statusKey = `posts.${s}`;
  } else if (demoPost) {
    const currentWO = demoPost.timeline?.find(i => i.status === 'in_progress');
    statusColor = demoPost.status === 'free' ? POST_STATUS_COLORS.free
      : demoPost.currentVehicle ? POST_STATUS_COLORS.occupied : '#94a3b8';
    statusKey = demoPost.status === 'free' ? 'posts.free'
      : currentWO ? 'posts.active_work' : 'posts.occupied';
  } else {
    // Fallback — still show modal with minimal info
    statusColor = '#94a3b8';
    statusKey = 'posts.free';
  }

  const currentWO = demoPost?.timeline?.find(i => i.status === 'in_progress');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="glass rounded-2xl p-5 max-w-md w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ border: '1px solid var(--border-glass)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: statusColor }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {t(`posts.post${postNum}`)}
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: statusColor + '22', color: statusColor }}>
              {t(statusKey)}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <div className="space-y-3">
          {/* Live mode data */}
          {isLive && liveItem ? (
            <LiveInfoBlock liveItem={liveItem} t={t} isRu={isRu} />
          ) : (
            /* Demo mode data */
            <>
              <div className="p-3 rounded-xl" style={{ background: 'var(--accent-light)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Car size={14} style={{ color: 'var(--accent)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('mapView.currentVehicle')}</span>
                </div>
                {demoPost?.currentVehicle ? (
                  <div>
                    <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                      {demoPost.currentVehicle.plateNumber}
                    </span>
                    <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>
                      {demoPost.currentVehicle.brand} {demoPost.currentVehicle.model}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('posts.free')}</span>
                )}
              </div>
              {currentWO && (
                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText size={14} style={{ color: 'var(--accent)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('mapView.currentWO')}</span>
                  </div>
                  <div className="text-sm font-mono font-medium" style={{ color: 'var(--accent)' }}>
                    {currentWO.workOrderNumber}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{currentWO.workType}</div>
                </div>
              )}
              {currentWO?.worker && (
                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <User size={14} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('mapView.worker')}</span>
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{currentWO.worker}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                  <div className="flex items-center gap-1 mb-1">
                    <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('mapView.placedAt')}</span>
                  </div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {currentWO?.startTime
                      ? new Date(currentWO.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                      : '---'}
                  </div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                  <div className="flex items-center gap-1 mb-1">
                    <Timer size={12} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('mapView.estimatedEnd')}</span>
                  </div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {currentWO?.endTime
                      ? new Date(currentWO.endTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                      : '---'}
                  </div>
                </div>
              </div>
              {currentWO && (currentWO.endTime || currentWO.estimatedEnd) && (
                <div className="flex justify-center">
                  <PostTimer estimatedEnd={currentWO.endTime || currentWO.estimatedEnd} startTime={currentWO.startTime} size="lg" />
                </div>
              )}
              {currentWO?.note && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid var(--warning)' }}>
                  <div className="flex items-center gap-1 mb-1">
                    <AlertTriangle size={12} style={{ color: 'var(--warning)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--warning)' }}>{t('mapView.note')}</span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-primary)' }}>{currentWO.note}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <button onClick={() => onGoToPost(postNum)}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {t('mapView.goToPost')} <ArrowRight size={16} />
          </button>
          {isLive && liveItem?.history?.length > 0 && (
            <button onClick={() => onGoToHistory()}
              className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
              <History size={16} /> {liveItem.history.length}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ZoneModal({ zoneName, monitoringData, isLive, onClose, onGoToHistory, t, isRu }) {
  const rawItems = monitoringData?.rawState || [];
  const liveItem = rawItems.find(item => item.zone === zoneName);

  if (!liveItem && isLive) return null;

  const isOccupied = liveItem?.status === 'occupied';
  const statusColor = isOccupied ? '#ef4444' : 'var(--success)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="glass rounded-2xl p-5 max-w-md w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ border: '1px solid var(--border-glass)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: statusColor }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {zoneName}
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: statusColor + '22', color: statusColor }}>
              {isOccupied ? t('mapView.legendOccupied') : t('mapView.legendFree')}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        {liveItem ? (
          <div className="space-y-3">
            <LiveInfoBlock liveItem={liveItem} t={t} isRu={isRu} />
          </div>
        ) : (
          <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
            {t('mapView.noLiveData')}
          </div>
        )}

        {/* History button */}
        {isLive && liveItem?.history?.length > 0 && (
          <button onClick={() => onGoToHistory()}
            className="w-full mt-4 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
            <History size={16} /> {t('mapView.viewHistory')} ({liveItem.history.length})
          </button>
        )}
      </div>
    </div>
  );
}

// Extract post number from element (supports postNumber, data.number, or name like "Пост 06")
function getPostNum(el) {
  if (el.postNumber) return el.postNumber;
  if (el.data?.number) return el.data.number;
  const m = el.name?.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// Extract camera number from element (supports camNum or name like "cam 02")
function getCamNum(el) {
  if (el.camNum) return el.camNum;
  const m = el.name?.match(/\d+/);
  return m ? m[0].padStart(2, '0') : null;
}

function findPostInZones(postNum, zonesData) {
  for (const z of (zonesData || []))
    for (const p of (z.posts || []))
      if (parseInt(p.name?.match(/\d+/)?.[0], 10) === postNum) return p;
  return null;
}
function postStatusFromData(n, dd, zd) {
  const dp = dd?.posts?.find(p => p.number === n);
  if (dp) {
    if (dp.status && dp.status !== 'free') return dp.status;
    if (dp.status === 'free') return 'free';
    return dp.timeline?.some(i => i.status === 'in_progress') ? 'active_work' : 'occupied';
  }
  return findPostInZones(n, zd)?.status || 'free';
}
function dashPostFromData(n, dd) {
  return dd?.posts?.find(p => p.number === n) || null;
}
function vehiclePlateFromData(n, dd, zd) {
  const dp = dd?.posts?.find(p => p.number === n);
  if (dp?.currentVehicle) return dp.currentVehicle.plateNumber;
  return findPostInZones(n, zd)?.stays?.[0]?.vehicleSession?.plateNumber || null;
}

export default function MapViewer() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api, appMode } = useAuth();
  const isLive = appMode === 'live';
  const { theme } = useTheme();
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const containerRef = useRef(null);
  const stageRef = useRef(null);

  const [layout, setLayout] = useState(null);
  const [zonesData, setZonesData] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [monitoringData, setMonitoringData] = useState(null); // live mode data from external API
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null); // zone name string
  const [selectedCam, setSelectedCam] = useState(null);
  const [historyPost, setHistoryPost] = useState(null); // { postNum, history[] } for modal
  const [historyZone, setHistoryZone] = useState(null); // { zoneName, history[] } for modal
  const [rawState, setRawState] = useState([]); // raw external API data for modals
  const cameraStatuses = useCameraStatus();
  const [stageSize, setStageSize] = useState({ width: 900, height: 500 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [baseScale, setBaseScale] = useState(1);
  const [baseBounds, setBaseBounds] = useState(null);
  const [visibleLayers, setVisibleLayers] = useState(() => {
    try {
      const saved = localStorage.getItem('mapViewerLayers');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { building: true, driveway: true, post: true, zone: true, camera: true, door: true, wall: true, label: true, infozone: true };
  });

  const isDark = theme === 'dark';

  // Set page height to fill viewport
  useEffect(() => {
    const setHeight = () => {
      if (!pageRef.current) return;
      const top = pageRef.current.getBoundingClientRect().top;
      pageRef.current.style.height = `${window.innerHeight - top}px`;
    };
    setHeight();
    window.addEventListener('resize', setHeight);
    return () => window.removeEventListener('resize', setHeight);
  }, []);

  // Load layout from API
  useEffect(() => {
    api.get('/api/map-layout').then(({ data }) => {
      if (data) setLayout(data);
    }).catch(() => {});
  }, []);

  // Fetch real-time data
  const fetchRealtime = useCallback(async () => {
    try {
      if (isLive) {
        // Live mode — fetch from monitoring proxy (real CV data)
        const [liveRes, rawRes] = await Promise.all([
          api.get('/api/dashboard/live'),
          api.get('/api/monitoring/raw'),
        ]);
        if (liveRes.data) setMonitoringData(liveRes.data);
        if (rawRes.data && Array.isArray(rawRes.data)) setRawState(rawRes.data);
      } else {
        // Demo mode — fetch from DB
        const [zRes, dRes] = await Promise.all([
          api.get('/api/zones'),
          api.get('/api/dashboard-posts'),
        ]);
        if (zRes.data) setZonesData(zRes.data);
        if (dRes.data) setDashboardData(dRes.data);
        setMonitoringData(null);
      }
    } catch { /* ignore */ }
  }, [api, isLive]);

  useEffect(() => { fetchRealtime(); }, [fetchRealtime]);
  usePolling(fetchRealtime, isLive ? 10000 : 5000);

  // Real-time post status updates via Socket.IO
  useSocket('post:status_changed', (data) => {
    setZonesData(prev => {
      if (!prev) return prev;
      return prev.map(zone => ({ ...zone, posts: zone.posts?.map(p => {
        const num = parseInt(p.name?.match(/\d+/)?.[0], 10);
        if (num !== data.postNumber) return p;
        return { ...p, status: data.status };
      }) }));
    });
  });

  // Use mapFrame from layout (or compute bounding box as fallback)
  const computeBounds = useCallback(() => {
    // Use mapFrame or layout width/height as the fixed map area
    const frame = layout?.mapFrame || (layout?.width && layout?.height ? { width: layout.width, height: layout.height } : null);
    if (frame) {
      return { minX: 0, minY: 0, maxX: frame.width, maxY: frame.height };
    }
    const els = layout?.elements || [];
    if (els.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of els) {
      const elX = el.x || 0, elY = el.y || 0;
      minX = Math.min(minX, elX);
      minY = Math.min(minY, elY);
      maxX = Math.max(maxX, elX + (el.width || 0));
      maxY = Math.max(maxY, elY + (el.height || 0));
      if (el.points?.length >= 2) {
        for (let i = 0; i < el.points.length; i += 2) {
          minX = Math.min(minX, elX + el.points[i]);
          minY = Math.min(minY, elY + el.points[i + 1]);
          maxX = Math.max(maxX, elX + el.points[i]);
          maxY = Math.max(maxY, elY + el.points[i + 1]);
        }
      }
    }
    return { minX, minY, maxX, maxY };
  }, [layout]);

  // Fit to container — fit entire map into visible area and center it
  const fitToContainer = useCallback(() => {
    if (!containerRef.current) return;
    const bounds = computeBounds();
    const mapW = bounds.maxX - bounds.minX;
    const mapH = bounds.maxY - bounds.minY;
    if (mapW <= 0 || mapH <= 0) return;

    const el = containerRef.current;
    const rect = el.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height > 10 ? rect.height : window.innerHeight - rect.top;
    if (cw < 10 || ch < 10) return;

    // Scale to fit both width and height
    const s = Math.min(cw / mapW, ch / mapH);
    const stageW = cw;
    const stageH = ch;
    // Center the map within the stage
    const offsetX = (stageW - mapW * s) / 2 - bounds.minX * s;
    const offsetY = (stageH - mapH * s) / 2 - bounds.minY * s;

    setScale(s);
    setBaseScale(s);
    setBaseBounds(bounds);
    setStageSize({ width: stageW, height: stageH });
    setPosition({ x: offsetX, y: offsetY });
  }, [computeBounds]);

  // Responsive sizing — use ResizeObserver for reliable container tracking
  useEffect(() => {
    const raf = requestAnimationFrame(fitToContainer);
    window.addEventListener('resize', fitToContainer);
    let ro;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => fitToContainer());
      ro.observe(containerRef.current);
    }
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fitToContainer); ro?.disconnect(); };
  }, [fitToContainer]);

  // Zoom controls (button-based, centered)
  const handleZoom = useCallback((dir) => {
    const factor = dir > 0 ? 1.08 : 1 / 1.08;
    const newScale = Math.min(baseScale * 3, Math.max(baseScale * 0.5, scale * factor));
    const cx = stageSize.width / 2, cy = stageSize.height / 2;
    const mousePointTo = { x: (cx - position.x) / scale, y: (cy - position.y) / scale };
    setScale(newScale);
    setPosition({ x: cx - mousePointTo.x * newScale, y: cy - mousePointTo.y * newScale });
  }, [scale, baseScale, position, stageSize]);

  // Wheel zoom — smooth, fine-grained, centered on cursor
  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const scaleBy = 1.05;
    const oldScale = scale;
    const newScale = Math.min(baseScale * 3, Math.max(baseScale * 0.5,
      e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy));
    const mousePointTo = { x: (pointer.x - position.x) / oldScale, y: (pointer.y - position.y) / oldScale };
    setScale(newScale);
    setPosition({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
  }, [scale, baseScale, position]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Re-fit after fullscreen change
  useEffect(() => {
    setTimeout(fitToContainer, 100);
  }, [isFullscreen, fitToContainer]);

  // Save layers to localStorage
  useEffect(() => {
    localStorage.setItem('mapViewerLayers', JSON.stringify(visibleLayers));
  }, [visibleLayers]);

  const toggleLayer = (layer) => {
    setVisibleLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Export PNG
  const handleExportPng = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const uri = stage.toDataURL({ pixelRatio: 2 });
    const a = document.createElement('a');
    a.href = uri;
    a.download = `sto-map-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  // Export PDF
  const handleExportPdf = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const uri = stage.toDataURL({ pixelRatio: 2 });
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.setFontSize(14);
    pdf.text(isRu ? 'Карта СТО' : 'STO Map', pageW / 2, 10, { align: 'center' });
    pdf.setFontSize(8);
    pdf.text(new Date().toLocaleString(), pageW / 2, 16, { align: 'center' });
    const imgW = pageW - 20;
    const imgH = pageH - 30;
    pdf.addImage(uri, 'PNG', 10, 22, imgW, imgH);
    pdf.save(`sto-map-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleGoToPost = (postNum) => {
    setSelectedPost(null);
    navigate(`/posts-detail?post=post-${postNum}`);
  };

  // Compute stats — use monitoring data in live mode, DB data in demo mode
  let totalPosts, freePosts, occupiedPosts, activeWork, idle, totalVehicles;
  if (isLive && monitoringData) {
    const s = monitoringData.summary || {};
    totalPosts = s.working + s.occupied + s.free + s.idle || 10;
    freePosts = s.free || 0;
    occupiedPosts = (s.occupied || 0);
    activeWork = s.working || 0;
    idle = s.idle || 0;
    totalVehicles = monitoringData.vehiclesOnSite || 0;
  } else {
    const allPosts = (zonesData || []).flatMap(z => z.posts || []);
    totalPosts = allPosts.length || 10;
    freePosts = allPosts.filter(p => p.status === 'free').length;
    occupiedPosts = totalPosts - freePosts;
    activeWork = allPosts.filter(p => p.status === 'active_work').length;
    idle = allPosts.filter(p => p.status === 'occupied_no_work').length;
    totalVehicles = (zonesData || []).reduce((s, z) => s + (z._count?.stays || 0), 0);
  }
  const loadPct = totalPosts > 0 ? Math.round((occupiedPosts / totalPosts) * 100) : 0;

  const stats = [
    { label: isRu ? 'Всего' : 'Total', value: totalPosts, color: 'var(--text-primary)' },
    { label: isRu ? 'Занято' : 'Occupied', value: occupiedPosts, color: 'var(--danger)' },
    { label: isRu ? 'Свободно' : 'Free', value: freePosts, color: 'var(--success)' },
    { label: isRu ? 'В работе' : 'Active', value: activeWork, color: 'var(--accent)' },
    { label: isRu ? 'Простой' : 'Idle', value: idle, color: 'var(--warning)' },
    { label: isRu ? 'Авто' : 'Cars', value: totalVehicles, color: 'var(--info)' },
    { label: isRu ? 'Загрузка' : 'Load', value: `${loadPct}%`, color: loadPct >= 70 ? 'var(--success)' : loadPct >= 30 ? 'var(--warning)' : 'var(--danger)' },
  ];

  const allElements = layout?.elements || [];
  const elements = allElements.filter(el => visibleLayers[el.type] !== false);
  const bgFill = isDark ? '#0f172a' : '#f0f4f8';
  const textFill = isDark ? '#e2e8f0' : '#1e293b';
  const mutedFill = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="flex flex-col overflow-hidden" ref={pageRef}>
      {/* Toolbar — one compact row */}
      <div className="flex items-center gap-2 py-1 flex-shrink-0 flex-wrap">
        {/* Stats pills */}
        {stats.map((s, i) => (
          <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
            <span className="text-xs font-bold" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
        <div className="w-px h-4" style={{ background: 'var(--border-glass)' }} />
        {/* Legend */}
        {[
          { color: POST_STATUS_COLORS.free, label: isRu ? 'Свободен' : 'Free' },
          { color: POST_STATUS_COLORS.occupied || '#f59e0b', label: isRu ? 'Занят' : 'Occupied' },
          { color: POST_STATUS_COLORS.active_work, label: isRu ? 'В работе' : 'Active' },
          { color: POST_STATUS_COLORS.occupied_no_work || '#ef4444', label: isRu ? 'Простой' : 'Idle' },
        ].map((item, i) => (
          <span key={`leg-${i}`} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        {/* Spacer */}
        <div className="flex-1" />
        {/* Actions */}
        <div className="relative">
          <button onClick={() => setShowLayersPanel(!showLayersPanel)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium hover:opacity-80 transition-opacity"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
            <Layers size={12} /> {t('mapView.layers')}
            {showLayersPanel ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          {showLayersPanel && (
            <div className="absolute right-0 mt-1 p-2 rounded-lg shadow-lg space-y-1 z-20"
              style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', minWidth: 130 }}>
              {[
                { key: 'building', label: t('mapView.layerBuildings') },
                { key: 'post', label: t('mapView.layerPosts') },
                { key: 'zone', label: t('mapView.layerZones') },
                { key: 'camera', label: t('mapView.layerCameras') },
                { key: 'driveway', label: t('mapView.layerDriveways') },
                { key: 'door', label: t('mapView.layerDoors') },
                { key: 'wall', label: t('mapView.layerWalls') },
                { key: 'label', label: t('mapView.layerLabels') },
                { key: 'infozone', label: t('mapView.layerInfoZone') },
              ].map(l => (
                <label key={l.key} className="flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer hover:opacity-80 text-[11px]"
                  style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={visibleLayers[l.key] !== false}
                    onChange={() => toggleLayer(l.key)} className="rounded" />
                  {l.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <button onClick={handleExportPng}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium hover:opacity-80 transition-opacity"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
          <Image size={12} /> PNG
        </button>
        <button onClick={handleExportPdf}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium hover:opacity-80 transition-opacity"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
          <FileDown size={12} /> PDF
        </button>
        <HelpButton pageKey="map" />
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="overflow-hidden relative w-full rounded-xl flex-1 min-h-0">
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          draggable
          onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
          onWheel={handleWheel}
        >

          <Layer>
            {/* Background — fill map frame */}
            {(() => { const b = computeBounds(); return (
              <Rect x={b.minX} y={b.minY} width={b.maxX - b.minX} height={b.maxY - b.minY} fill={bgFill} />
            ); })()}


            {/* Render elements by type */}
            {elements.map(el => {
              const isPolygon = el.shapeMode === 'polygon' && el.points?.length >= 4;

              // ── Polygon mode for area types (building, zone) — NOT driveway/wall/door/infozone/post ──
              if (isPolygon && !['post', 'wall', 'door', 'infozone', 'driveway'].includes(el.type)) {
                const fillOpacity = el.type === 'building' ? 0 : 0.08;
                const dash = el.type === 'building' ? [8, 4] : undefined;
                const stroke = el.color || '#22c55e';
                return (
                  <Group key={el.id} x={el.x} y={el.y}>
                    <Line points={el.points} closed fill={stroke} opacity={fillOpacity}
                      stroke={stroke} strokeWidth={2} dash={dash} />
                  </Group>
                );
              }
              // ── Polygon driveway — same style as rect driveway, snap to 90° ──
              if (isPolygon && el.type === 'driveway') {
                const dStroke = isDark ? '#94a3b8' : '#9ca3af';
                const dFill = isDark ? DRIVEWAY_FILL.dark : DRIVEWAY_FILL.light;
                // Snap each segment to horizontal or vertical (90° angles)
                const pts = el.points;
                const snapped = [pts[0], pts[1]];
                for (let i = 2; i < pts.length; i += 2) {
                  const prevX = snapped[snapped.length - 2], prevY = snapped[snapped.length - 1];
                  const dx = Math.abs(pts[i] - prevX), dy = Math.abs(pts[i + 1] - prevY);
                  if (dx >= dy) { snapped.push(pts[i], prevY); } else { snapped.push(prevX, pts[i + 1]); }
                }
                return (
                  <Group key={el.id} x={el.x} y={el.y}>
                    <Line points={snapped} closed fill={dFill}
                      stroke={dStroke} strokeWidth={1.5} dash={[6, 3]} />
                  </Group>
                );
              }

              if (el.type === 'building') {
                // Legacy building: polygon without shapeMode OR rectangle
                if (el.points && el.points.length >= 4) {
                  return (
                    <Group key={el.id} x={el.x} y={el.y}>
                      <Line points={el.points} closed fill="transparent"
                        stroke="#22c55e" strokeWidth={2} dash={[8, 4]} />
                    </Group>
                  );
                }
                return (
                  <Rect key={el.id} x={el.x} y={el.y} width={el.width} height={el.height}
                    stroke="#22c55e" strokeWidth={2} fill="transparent" dash={[8, 4]} />
                );
              }
              if (el.type === 'driveway') return (
                <Rect key={el.id} x={el.x} y={el.y} width={el.width} height={el.height}
                  rotation={el.rotation || 0} fill={isDark ? DRIVEWAY_FILL.dark : DRIVEWAY_FILL.light}
                  stroke={isDark ? '#94a3b8' : '#9ca3af'} strokeWidth={1.5} dash={[6, 3]} cornerRadius={4} />
              );
              if (el.type === 'wall') return <WallEl key={el.id} el={el} />;
              if (el.type === 'zone') return <ZoneEl key={el.id} el={el} isDark={isDark} zonesData={zonesData} monitoringData={isLive ? monitoringData : null} rawState={isLive ? rawState : []} onClick={(zoneName) => isLive && setSelectedZone(zoneName)} />;
              if (el.type === 'door') return <DoorEl key={el.id} el={el} isDark={isDark} />;
              if (el.type === 'label') return <LabelEl key={el.id} el={el} fill={mutedFill} />;
              if (el.type === 'post') {
                const pn = getPostNum(el);
                if (!pn) return null;
                // In live mode, use monitoring data; in demo, use DB data
                let status, plate, dashPost;
                if (isLive && monitoringData) {
                  const mp = monitoringData.posts?.find(p => {
                    const num = parseInt(p.name?.match(/\d+/)?.[0], 10);
                    return num === pn;
                  });
                  // Also get raw data for full info
                  const rawItem = rawState.find(r => {
                    const m = r.zone?.match(/^Пост\s+(\d{2})/);
                    return m && parseInt(m[1], 10) === pn;
                  });
                  status = mp?.status || 'free';
                  plate = mp?.plateNumber || rawItem?.car?.plate || null;
                  const carMake = rawItem?.car?.make;
                  const carModel = rawItem?.car?.model;
                  dashPost = mp ? {
                    status: mp.status,
                    currentVehicle: plate ? { plateNumber: plate, brand: carMake, model: carModel, color: rawItem?.car?.color, body: rawItem?.car?.body } : null,
                    worksInProgress: rawItem?.worksInProgress ?? mp.worksInProgress,
                    worksDescription: rawItem?.worksDescription || mp.worksDescription,
                    peopleCount: rawItem?.peopleCount ?? mp.peopleCount,
                    confidence: rawItem?.confidence,
                    openParts: rawItem?.openParts,
                  } : null;
                } else {
                  status = postStatusFromData(pn, dashboardData, zonesData);
                  plate = vehiclePlateFromData(pn, dashboardData, zonesData);
                  dashPost = dashPostFromData(pn, dashboardData);
                }
                return (
                  <PostEl key={el.id} el={el} isDark={isDark} textFill={textFill} mutedFill={mutedFill}
                    status={status}
                    plate={plate}
                    statusLabel={t(`posts.${status}`)}
                    postLabel={t(`posts.post${pn}`)}
                    dashPost={dashPost}
                    isRu={isRu}
                    onClick={() => setSelectedPost(pn)} />
                );
              }
              if (el.type === 'camera') return null; // cameras rendered in second pass below
              if (el.type === 'infozone') return (
                <InfoZoneEl key={el.id} el={el} isDark={isDark} isRu={isRu}
                  layoutName={layout?.name || ''}
                  allElements={allElements} />
              );
              return null;
            })}
            {/* Cameras on top of everything */}
            {allElements.filter(el => el.type === 'camera').map(el => {
              const cn = getCamNum(el);
              const camId = cn ? `cam${String(cn).padStart(2, '0')}` : null;
              const camOnline = camId ? cameraStatuses[camId]?.online : undefined;
              return (
                <CameraEl key={el.id} el={el} isDark={isDark}
                  online={camOnline}
                  onClick={() => cn && setSelectedCam(cn)} />
              );
            })}
          </Layer>
        </Stage>

        {/* Zoom & Fullscreen controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 z-10">
          <button onClick={() => handleZoom(1)}
            className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
            style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
            <ZoomIn size={16} />
          </button>
          <button onClick={() => handleZoom(-1)}
            className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
            style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
            <ZoomOut size={16} />
          </button>
          <button onClick={fitToContainer}
            className="p-1.5 rounded-lg hover:opacity-80 transition-opacity text-xs font-medium"
            style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}
            title={isRu ? 'Вписать' : 'Fit'}>
            <Minimize size={16} />
          </button>
          <button onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
            style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}
            title={isRu ? 'На весь экран' : 'Fullscreen'}>
            <Maximize size={16} />
          </button>
        </div>
      </div>

      {/* Post Modal */}
      {selectedPost && (
        <PostModal postNum={selectedPost} dashboardData={dashboardData}
          monitoringData={{ ...monitoringData, rawState }} isLive={isLive}
          onClose={() => setSelectedPost(null)} onGoToPost={handleGoToPost}
          onGoToHistory={() => {
            const rawItems = rawState || [];
            const liveItem = rawItems.find(item => {
              const m = item.zone?.match(/^Пост\s+(\d{2})/);
              return m && parseInt(m[1], 10) === selectedPost;
            });
            setHistoryPost({ postNum: selectedPost, history: liveItem?.history || [] });
            setSelectedPost(null);
          }}
          t={t} isRu={isRu} />
      )}

      {/* Zone Modal */}
      {selectedZone && (
        <ZoneModal zoneName={selectedZone}
          monitoringData={{ ...monitoringData, rawState }} isLive={isLive}
          onClose={() => setSelectedZone(null)}
          onGoToHistory={() => {
            const rawItems = rawState || [];
            const liveItem = rawItems.find(item => item.zone === selectedZone);
            setHistoryZone({ zoneName: selectedZone, history: liveItem?.history || [] });
            setSelectedZone(null);
          }}
          t={t} isRu={isRu} />
      )}

      {/* Post History Modal */}
      {historyPost && (
        <PostHistoryModal
          postNumber={historyPost.postNum}
          historyData={historyPost.history}
          onClose={() => setHistoryPost(null)}
          onOpenFullPage={() => { setHistoryPost(null); navigate(`/post-history/${historyPost.postNum}`); }}
        />
      )}

      {/* Zone History Modal */}
      {historyZone && (
        <PostHistoryModal
          postNumber={historyZone.zoneName}
          historyData={historyZone.history}
          onClose={() => setHistoryZone(null)}
          onOpenFullPage={() => { setHistoryZone(null); navigate(`/zone-history/${encodeURIComponent(historyZone.zoneName)}`); }}
        />
      )}

      {/* Camera Modal */}
      {selectedCam && (() => {
        const camData = ALL_CAMERAS.find(c => c.num === selectedCam);
        const lang = isRu ? 'ru' : 'en';
        return (
          <CameraStreamModal
            camId={`cam${selectedCam}`}
            camName={(isRu ? 'КАМ' : 'CAM') + selectedCam}
            camLocation={camData?.loc?.[lang] || ''}
            camCovers={camData?.covers?.[lang] || ''}
            isRu={isRu} isDark={isDark}
            onClose={() => setSelectedCam(null)} />
        );
      })()}
    </div>
  );
}

function estimateTextH(text, fontSize, availW) {
  // Estimate how many lines text will take when wrapped
  const avgCharW = /[а-яА-ЯёЁ]/.test(text) ? fontSize * 0.65 : fontSize * 0.55;
  const textW = text.length * avgCharW;
  const lines = Math.max(1, Math.ceil(textW / Math.max(availW, 1)));
  return lines * (fontSize + 2);
}

function PostEl({ el, isDark, textFill, mutedFill, status, plate, statusLabel, postLabel, dashPost, isRu, onClick }) {
  const color = POST_STATUS_COLORS[status] || '#94a3b8';
  const fillBg = isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255,255,255,0.92)';
  const w = el.width || 120, h = el.height || 80;
  const pad = 5;
  const isFree = status === 'free';
  const isIdle = status === 'occupied_no_work';

  const currentWO = dashPost?.timeline?.find(i => i.status === 'in_progress');
  const currentVehicle = dashPost?.currentVehicle;
  const workType = currentWO?.workType;
  const workerName = currentWO?.worker;
  const shortWorker = workerName ? (() => {
    const parts = workerName.split(' ');
    return parts.length >= 2 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
  })() : null;

  const narrow = w < 90;
  const headerH = narrow ? 28 : 22;
  const innerW = w - pad * 2;
  const fontSize = Math.max(7, Math.min(10, Math.round(w / 13)));
  const smallFont = Math.max(7, fontSize - 1);

  // Live monitoring extra fields
  const peopleCount = dashPost?.peopleCount;
  const confidence = dashPost?.confidence;
  const openParts = dashPost?.openParts;
  const worksInProgress = dashPost?.worksInProgress ?? (currentWO != null);

  const infoFont = Math.max(7, fontSize - 1);
  const accentColor = isDark ? '#a5b4fc' : '#6366f1';

  // Build content items with estimated heights
  const items = [];
  // Plate number
  if (plate) items.push({ type: 'plate', text: plate, size: fontSize });
  // Make + Model
  if (currentVehicle) {
    const carLabel = `${currentVehicle.brand || ''} ${currentVehicle.model || ''}`.trim();
    if (carLabel) items.push({ type: 'text', text: carLabel, size: infoFont, color: textFill, align: 'center' });
  }
  // Color + Body (compact line)
  if (currentVehicle?.color || currentVehicle?.body) {
    const detail = [
      isRu ? trMap(COLOR_RU, currentVehicle.color) : currentVehicle.color,
      isRu ? trMap(BODY_RU, currentVehicle.body) : currentVehicle.body,
    ].filter(Boolean).join(' · ');
    items.push({ type: 'text', text: detail, size: infoFont, color: mutedFill, align: 'center' });
  }
  // Work type (demo) or work indicator (live)
  if (workType) {
    items.push({ type: 'text', text: workType, size: infoFont, bold: true, color: accentColor, align: 'center' });
  } else if (worksInProgress && status !== 'free') {
    items.push({ type: 'text', text: isRu ? 'Работы ведутся' : 'Work in progress', size: infoFont, bold: true, color: accentColor, align: 'center' });
  }
  // Worker (demo mode)
  if (shortWorker) items.push({ type: 'text', text: shortWorker, size: infoFont, color: mutedFill, align: 'center' });
  // Time range (demo mode)
  if (currentWO) items.push({ type: 'text', text: `${fmtTime(currentWO.startTime)} → ${fmtTime(currentWO.estimatedEnd)}`, size: infoFont, color: mutedFill, align: 'center' });
  // People · Confidence (compact bottom line)
  {
    const parts = [];
    if (peopleCount != null) parts.push(`${peopleCount} ${isRu ? 'чел' : 'ppl'}`);
    if (confidence) parts.push(isRu ? (CONFIDENCE_RU[confidence] || confidence) : confidence);
    if (parts.length > 0) {
      const confColor = confidence === 'HIGH' ? '#22c55e' : confidence === 'MEDIUM' ? '#f59e0b' : '#ef4444';
      items.push({ type: 'text', text: parts.join(' · '), size: infoFont, color: confColor, align: 'center' });
    }
  }

  // Calculate y positions so each item starts after the previous one (including wraps)
  let curY = headerH + 4;
  const positioned = items.map(item => {
    const y = curY;
    if (item.type === 'plate') {
      const plateH = Math.max(14, fontSize + 6);
      curY += plateH + 3;
      return { ...item, y, h: plateH };
    }
    const textH = estimateTextH(item.text, item.size, innerW);
    curY += textH + 1;
    return { ...item, y, h: textH };
  });

  return (
    <Group x={el.x} y={el.y} rotation={el.rotation || 0} onClick={onClick} onTap={onClick}>
      <Rect width={w} height={h} fill={fillBg}
        stroke={color}
        strokeWidth={status === 'active_work' ? 2 : 1.5}
        cornerRadius={6}
        shadowBlur={status === 'active_work' ? 10 : 3}
        shadowColor={color}
        shadowOpacity={status === 'active_work' ? 0.4 : 0.15} />

      {/* Color header bar */}
      <Rect x={0} y={0} width={w} height={headerH} fill={color}
        cornerRadius={[6, 6, 0, 0]} opacity={0.9} />
      {narrow ? (<>
        <Text x={pad} y={2} text={postLabel}
          width={innerW} height={13}
          fontSize={8} fontStyle="bold" fill="#fff"
          fontFamily="system-ui, sans-serif" wrap="none" ellipsis={true} />
        <Text x={pad} y={14} text={statusLabel}
          width={innerW} height={11}
          fontSize={7} fill="rgba(255,255,255,0.85)"
          fontFamily="system-ui, sans-serif" fontStyle="bold" wrap="none" ellipsis={true} />
      </>) : (<>
        <Text x={pad} y={2} text={postLabel}
          width={w * 0.44} height={headerH - 2}
          fontSize={9} fontStyle="bold" fill="#fff"
          verticalAlign="middle" fontFamily="system-ui, sans-serif" wrap="none" ellipsis={true} />
        <Text x={w * 0.44} y={2} text={statusLabel}
          width={w * 0.56 - pad} height={headerH - 2}
          fontSize={7} fill="rgba(255,255,255,0.85)"
          align="right" verticalAlign="middle"
          fontFamily="system-ui, sans-serif" fontStyle="bold" wrap="none" ellipsis={true} />
      </>)}

      {isFree ? (
        <Text x={pad} y={headerH} width={innerW} height={h - headerH}
          text="—" fontSize={16}
          fill={isDark ? '#334155' : '#cbd5e1'}
          align="center" verticalAlign="middle" />
      ) : (<>
        {positioned.map((item, i) => item.type === 'plate' ? (
          <Group key={i}>
            <Rect x={pad} y={item.y} width={innerW} height={item.h}
              fill={isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)'}
              cornerRadius={3} />
            <Text x={pad} y={item.y} width={innerW} height={item.h}
              text={item.text}
              fontSize={item.size} fontStyle="bold" fontFamily="monospace"
              fill={textFill} align="center" verticalAlign="middle"
              wrap="none" ellipsis={true} />
          </Group>
        ) : (
          <Text key={i} x={pad} y={item.y} width={innerW} height={item.h}
            text={item.text}
            fontSize={item.size}
            fontStyle={item.bold ? 'bold' : 'normal'}
            fill={item.color || textFill}
            fontFamily="system-ui, sans-serif"
            align={item.align || 'left'}
            wrap="word" ellipsis={true} />
        ))}

        {isIdle && (
          <Group>
            <Rect x={pad} y={h - 16} width={innerW} height={13}
              fill={isDark ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.1)'}
              cornerRadius={3} stroke="rgba(234,179,8,0.3)" strokeWidth={1} />
            <Text x={pad} y={h - 15} width={innerW} height={11}
              text={isRu ? 'Простой' : 'Idle'}
              fontSize={8} fontStyle="bold" fill="#eab308"
              align="center" verticalAlign="middle" />
          </Group>
        )}
      </>)}
    </Group>
  );
}

function ZoneEl({ el, isDark, zonesData, monitoringData, rawState, onClick }) {
  const stroke = el.color || '#22c55e';
  let vehicleCount = 0;
  let zoneInfo = null;

  // Find raw zone name for onClick
  let rawZoneName = null;

  if (monitoringData?.freeZones) {
    const numMatch = el.name?.match(/(\d+)/);
    if (numMatch) {
      const zn = parseInt(numMatch[1], 10);
      const mz = monitoringData.freeZones.find(z => {
        const n = parseInt(z.name?.match(/\d+/)?.[0], 10);
        return n === zn;
      });
      if (mz) {
        vehicleCount = mz.status === 'occupied' ? 1 : 0;
        zoneInfo = mz;
      }
      // Find raw name from rawState
      if (rawState) {
        const rawItem = rawState.find(r => {
          const m = r.zone?.match(/^Свободная зона\s+(\d{2})/);
          return m && parseInt(m[1], 10) === zn;
        });
        if (rawItem) rawZoneName = rawItem.zone;
      }
    }
  } else {
    for (const z of (zonesData || [])) {
      if (z.name === el.name) vehicleCount = z._count?.stays || 0;
    }
  }

  const isOccupied = vehicleCount > 0;
  const occupiedStroke = isOccupied ? '#ef4444' : stroke;
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const w = el.width || 160, h = el.height || 100;
  const pad = 5;
  const headerH = 16;
  const innerW = w - pad * 2;

  const accentColor = isDark ? '#a5b4fc' : '#6366f1';
  const isRuLang = /[а-яА-ЯёЁ]/.test(el.name || '');

  // Build info items when occupied (worksDescription only in modal)
  const items = [];
  if (zoneInfo && isOccupied) {
    if (zoneInfo.plateNumber) items.push({ text: zoneInfo.plateNumber, bold: true, mono: true, size: 8, color: textPrimary, align: 'center' });
    const carText = [zoneInfo.carMake, zoneInfo.carModel].filter(Boolean).join(' ');
    if (carText) items.push({ text: carText, size: 7, color: textPrimary, align: 'center' });
    const detail = [
      isRuLang ? trMap(COLOR_RU, zoneInfo.carColor) : zoneInfo.carColor,
      isRuLang ? trMap(BODY_RU, zoneInfo.carBody) : zoneInfo.carBody,
    ].filter(Boolean).join(' · ');
    if (detail) items.push({ text: detail, size: 7, color: textColor, align: 'center' });
    if (zoneInfo.worksInProgress) {
      items.push({ text: isRuLang ? 'Работы' : 'Works', size: 7, bold: true, color: accentColor, align: 'center' });
    }
    // People · Confidence
    const parts = [];
    if (zoneInfo.peopleCount != null) parts.push(`${zoneInfo.peopleCount} ${isRuLang ? 'чел' : 'ppl'}`);
    if (zoneInfo.confidence) parts.push(isRuLang ? (CONFIDENCE_RU[zoneInfo.confidence] || zoneInfo.confidence) : zoneInfo.confidence);
    if (parts.length > 0) {
      const confColor = zoneInfo.confidence === 'HIGH' ? '#22c55e' : zoneInfo.confidence === 'MEDIUM' ? '#f59e0b' : '#ef4444';
      items.push({ text: parts.join(' · '), size: 7, color: confColor, align: 'center' });
    }
  }

  let curY = headerH + 3;
  const positioned = items.map(item => {
    const y = curY;
    const ih = estimateTextH(item.text, item.size, innerW);
    curY += ih + 1;
    return { ...item, y, h: ih };
  });

  return (
    <Group x={el.x} y={el.y} rotation={el.rotation || 0}
      onClick={() => rawZoneName && onClick?.(rawZoneName)}
      onTap={() => rawZoneName && onClick?.(rawZoneName)}>
      <Rect width={w} height={h} fill={occupiedStroke}
        opacity={isDark ? 0.08 : 0.06}
        stroke={occupiedStroke} strokeWidth={isOccupied ? 1.5 : 1} cornerRadius={3}
        dash={isOccupied ? undefined : [6, 3]}
        shadowBlur={isOccupied ? 6 : 0} shadowColor={occupiedStroke} shadowOpacity={0.3} />

      {/* Header */}
      <Rect x={0} y={0} width={w} height={headerH} fill={occupiedStroke}
        cornerRadius={[3, 3, 0, 0]} opacity={isOccupied ? 0.7 : 0.4} />
      <Text x={pad} y={1} text={el.name} fontSize={8} fill="#fff"
        fontStyle="bold" fontFamily="system-ui, sans-serif"
        width={isOccupied ? innerW - 18 : innerW} height={headerH - 1}
        verticalAlign="middle" wrap="none" ellipsis={true} />
      {isOccupied && (
        <>
          <Circle x={w - 10} y={headerH / 2} radius={6} fill="#fff" opacity={0.25} />
          <Text x={w - 16} y={headerH / 2 - 5} text={String(vehicleCount)} fontSize={7}
            fontStyle="bold" fill="#fff" width={12} align="center"
            fontFamily="system-ui, sans-serif" />
        </>
      )}

      {/* Content */}
      {!isOccupied ? (
        <Text x={pad} y={headerH} width={innerW} height={h - headerH}
          text="—" fontSize={14}
          fill={isDark ? '#334155' : '#cbd5e1'}
          align="center" verticalAlign="middle" />
      ) : (
        positioned.map((item, i) => (
          <Text key={i} x={pad} y={item.y} width={innerW} height={item.h}
            text={item.text}
            fontSize={item.size}
            fontStyle={item.bold ? 'bold' : 'normal'}
            fontFamily={item.mono ? 'monospace' : 'system-ui, sans-serif'}
            fill={item.color || textColor}
            align={item.align || 'left'}
            wrap="word" ellipsis={true} />
        ))
      )}
    </Group>
  );
}

function CameraEl({ el, isDark, onClick, online }) {
  const dotColor = online === true ? '#10b981' : online === false ? '#94a3b8' : '#ef4444';
  const labelColor = isDark ? '#e2e8f0' : '#1e293b';
  const groupOpacity = online === false ? 0.5 : 1;
  const w = el.width || 24, h = el.height || 24;
  const cx = w / 2, cy = h / 2;
  const dir = (el.data?.direction || 0) * Math.PI / 180;
  const fov = (el.data?.fov || 90) * Math.PI / 180;
  const range = el.data?.range || 80;
  const lx = cx + Math.cos(dir - fov / 2) * range;
  const ly = cy + Math.sin(dir - fov / 2) * range;
  const rx = cx + Math.cos(dir + fov / 2) * range;
  const ry = cy + Math.sin(dir + fov / 2) * range;
  const mx = cx + Math.cos(dir) * range;
  const my = cy + Math.sin(dir) * range;
  const rot = el.rotation || 0;
  return (
    <Group x={el.x} y={el.y} rotation={rot}
      onClick={onClick} onTap={onClick} opacity={groupOpacity}>
      {/* Light FOV cone */}
      <Line points={[cx, cy, lx, ly, mx, my, rx, ry]} closed
        fill={dotColor} opacity={isDark ? 0.08 : 0.06}
        stroke={dotColor} strokeWidth={0.5} dash={[4, 3]} />
      {/* Invisible hit area for easier clicking */}
      <Circle x={cx} y={cy} radius={18} fill="transparent" />
      {/* Camera dot */}
      <Circle x={cx} y={cy} radius={5} fill={dotColor} opacity={0.85} />
      <Circle x={cx} y={cy} radius={1.5} fill="#fff" />
      {/* Label — counter-rotated so text is always horizontal */}
      <Group x={cx} y={cy} rotation={-rot}>
        <Text x={8} y={-5} text={el.name || ''} fontSize={8}
          fill={labelColor} fontStyle="bold" fontFamily="system-ui, sans-serif" />
      </Group>
    </Group>
  );
}

function DoorEl({ el, isDark }) {
  if (el.shapeMode === 'polygon' && el.points?.length >= 4) {
    const thickness = el.data?.thickness || 5;
    return (
      <Line x={el.x} y={el.y} points={el.points} closed={false}
        stroke={el.color || '#f59e0b'} strokeWidth={thickness}
        opacity={0.5} lineCap="round" lineJoin="round" />
    );
  }
  const fill = el.color || '#f59e0b';
  const w = el.width || 60, h = el.height || 8;
  const isVertical = h > w;
  return (
    <Group x={el.x} y={el.y} rotation={el.rotation || 0}>
      <Rect width={w || 4} height={h || 4} fill={fill} opacity={0.6} cornerRadius={1.5} />
      {/* Door arc indicator */}
      <Line points={isVertical ? [0, 0, 8, h / 2, 0, h] : [0, 0, w / 2, -8, w, 0]}
        stroke={fill} strokeWidth={0.8} opacity={0.3} />
    </Group>
  );
}

function WallEl({ el }) {
  if (el.shapeMode === 'polygon' && el.points?.length >= 4) {
    const thickness = el.data?.thickness || 4;
    return (
      <Line x={el.x} y={el.y} points={el.points} closed={false}
        stroke={el.color || '#475569'} strokeWidth={thickness}
        opacity={0.6} lineCap="round" lineJoin="round" />
    );
  }
  const w = el.width || 200, h = el.height || 6;
  return (
    <Rect x={el.x} y={el.y} width={w} height={h} rotation={el.rotation || 0}
      fill={el.color || '#475569'} opacity={0.5} />
  );
}

function LabelEl({ el, fill }) {
  return (
    <Text x={el.x} y={el.y} text={el.name} fontSize={9} rotation={el.rotation || 0}
      fill={fill} fontStyle="bold" opacity={0.6} fontFamily="system-ui, sans-serif" />
  );
}

function InfoZoneEl({ el, isDark, isRu, layoutName, allElements }) {
  const bgFill = isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.92)';
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const accentColor = isDark ? '#818cf8' : '#6366f1';
  const borderColor = isDark ? '#334155' : '#cbd5e1';

  const w = el.width || 200, h = el.height || 150;

  // Count elements by type
  const counts = {};
  for (const e of (allElements || [])) {
    counts[e.type] = (counts[e.type] || 0) + 1;
  }

  const title = layoutName || (isRu ? 'Карта СТО' : 'STO Map');
  const rows = [
    { label: isRu ? 'Постов' : 'Posts', value: counts.post || 0, color: '#3b82f6' },
    { label: isRu ? 'Камер' : 'Cameras', value: counts.camera || 0, color: '#ef4444' },
    { label: isRu ? 'Зон' : 'Zones', value: counts.zone || 0, color: '#22c55e' },
    { label: isRu ? 'Дверей' : 'Doors', value: counts.door || 0, color: '#f59e0b' },
  ];

  // Fixed font sizes — don't scale with element size
  const fs = 10;
  const pad = 10;
  const lineH = 16;
  const titleFs = 12;
  const contentW = w - pad * 2;
  const dotR = 3.5;

  const sepY = pad + titleFs + 5;
  const rowsStartY = sepY + 7;

  return (
    <Group x={el.x} y={el.y} rotation={el.rotation || 0} clipX={0} clipY={0} clipWidth={w} clipHeight={h}>
      <Rect width={w} height={h} fill={bgFill} cornerRadius={5}
        stroke={borderColor} strokeWidth={1}
        shadowBlur={6} shadowColor="rgba(0,0,0,0.15)" shadowOpacity={0.3} />

      {/* Title */}
      <Text x={pad} y={pad} text={title} fontSize={titleFs}
        fontStyle="bold" fill={accentColor} width={contentW} fontFamily="system-ui, sans-serif" />

      {/* Separator */}
      <Rect x={pad} y={sepY} width={contentW} height={0.5} fill={accentColor} opacity={0.3} />

      {/* Rows */}
      {rows.map((row, i) => {
        const ry = rowsStartY + i * lineH;
        if (ry + fs > h - 4) return null;
        return (
          <Group key={i}>
            <Circle x={pad + dotR} y={ry + fs * 0.45} radius={dotR} fill={row.color} />
            <Text x={pad + dotR * 3} y={ry} text={row.label} fontSize={fs}
              fill={mutedColor} fontFamily="system-ui, sans-serif" />
            <Text x={pad} y={ry} text={String(row.value)} fontSize={fs}
              fontStyle="bold" fill={textColor} width={contentW} align="right"
              fontFamily="system-ui, sans-serif" />
          </Group>
        );
      })}
    </Group>
  );
}
