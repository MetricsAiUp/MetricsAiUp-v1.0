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
  ZoomIn, ZoomOut, Maximize, Minimize,
} from 'lucide-react';
import jsPDF from 'jspdf';
import PostTimer from '../components/PostTimer';
import { ZONE_FILL_OPACITY, CAMERA_FOV_OPACITY, DRIVEWAY_FILL } from '../constants/mapTheme';
import { useCameraStatus } from '../hooks/useCameraStatus';

const ALL_CAMERAS = [
  { num: '01', loc: { ru: 'Нижний ряд, левый угол', en: 'Lower row, left corner' }, covers: { ru: 'Пост 1, Пост 2, Парковка', en: 'Post 1, Post 2, Parking' } },
  { num: '02', loc: { ru: 'Верхний ряд, левый угол', en: 'Upper row, left corner' }, covers: { ru: 'Пост 5, Пост 6', en: 'Post 5, Post 6' } },
  { num: '03', loc: { ru: 'Проезд, левая часть', en: 'Driveway, left' }, covers: { ru: 'Пост 1, Пост 2, Пост 3', en: 'Post 1, Post 2, Post 3' } },
  { num: '04', loc: { ru: 'Проезд, центр-лево', en: 'Driveway, center-left' }, covers: { ru: 'Пост 3, Пост 4', en: 'Post 3, Post 4' } },
  { num: '05', loc: { ru: 'Проезд, центр', en: 'Driveway, center' }, covers: { ru: 'Пост 6, Пост 7', en: 'Post 6, Post 7' } },
  { num: '06', loc: { ru: 'Проезд, центр-право', en: 'Driveway, center-right' }, covers: { ru: 'Пост 7, Пост 8', en: 'Post 7, Post 8' } },
  { num: '07', loc: { ru: 'Проезд, правая часть', en: 'Driveway, right' }, covers: { ru: 'Пост 8, Пост 9', en: 'Post 8, Post 9' } },
  { num: '08', loc: { ru: 'Правая стена, верх', en: 'Right wall, upper' }, covers: { ru: 'Пост 9, Пост 10', en: 'Post 9, Post 10' } },
  { num: '09', loc: { ru: 'Въезд/Выезд', en: 'Entry/Exit' }, covers: { ru: 'Въезд, Выезд, Парковка', en: 'Entry, Exit, Parking' } },
  { num: '10', loc: { ru: 'Правая стена, низ', en: 'Right wall, lower' }, covers: { ru: 'Пост 10', en: 'Post 10' } },
];

function fmtTime(t) {
  if (!t) return '—';
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function PostModal({ postNum, dashboardData, onClose, onGoToPost, t }) {
  const post = dashboardData?.posts?.find(p => p.number === postNum);
  if (!post) return null;
  const statusColor = post.status === 'free' ? POST_STATUS_COLORS.free
    : post.currentVehicle ? POST_STATUS_COLORS.occupied : '#94a3b8';
  const currentWO = post.timeline?.find(i => i.status === 'in_progress');
  const statusKey = post.status === 'free' ? 'posts.free'
    : currentWO ? 'posts.active_work' : 'posts.occupied';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="glass rounded-2xl p-5 max-w-md w-full mx-4 shadow-2xl"
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
          <div className="p-3 rounded-xl" style={{ background: 'var(--accent-light)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Car size={14} style={{ color: 'var(--accent)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('mapView.currentVehicle')}</span>
            </div>
            {post.currentVehicle ? (
              <div>
                <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {post.currentVehicle.plateNumber}
                </span>
                <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>
                  {post.currentVehicle.brand} {post.currentVehicle.model}
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
          {/* Live timer */}
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
        </div>
        <button onClick={() => onGoToPost(postNum)}
          className="w-full mt-4 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          {t('mapView.goToPost')} <ArrowRight size={16} />
        </button>
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
  const [selectedCam, setSelectedCam] = useState(null);
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
        const res = await api.get('/api/dashboard/live');
        if (res.data) setMonitoringData(res.data);
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

  // Fit to container — same logic as STOMap: scale by width, height follows
  const fitToContainer = useCallback(() => {
    if (!containerRef.current) return;
    const bounds = computeBounds();
    const mapW = bounds.maxX - bounds.minX;
    const mapH = bounds.maxY - bounds.minY;
    if (mapW <= 0 || mapH <= 0) return;

    // Use page width minus padding for available width
    const pageEl = containerRef.current.parentElement;
    const cw = pageEl ? pageEl.clientWidth : containerRef.current.clientWidth;
    if (cw < 10) return;

    const s = cw / mapW;
    setScale(s);
    setBaseScale(s);
    setBaseBounds(bounds);
    setStageSize({ width: mapW * s, height: mapH * s });
    setPosition({ x: 0, y: 0 });
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
    const newScale = Math.min(baseScale * 3, Math.max(baseScale * 0.5, scale + dir * baseScale * 0.2));
    const cx = stageSize.width / 2, cy = stageSize.height / 2;
    const mousePointTo = { x: (cx - position.x) / scale, y: (cy - position.y) / scale };
    setScale(newScale);
    setPosition({ x: cx - mousePointTo.x * newScale, y: cy - mousePointTo.y * newScale });
  }, [scale, baseScale, position, stageSize]);

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
      <div ref={containerRef} className="overflow-hidden relative w-full rounded-xl">
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
              if (el.type === 'zone') return <ZoneEl key={el.id} el={el} isDark={isDark} zonesData={zonesData} monitoringData={isLive ? monitoringData : null} />;
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
                  status = mp?.status || 'free';
                  plate = mp?.plateNumber || mp?.carModel || null;
                  dashPost = mp ? { status: mp.status, currentVehicle: mp.plateNumber || mp.carModel ? { plateNumber: mp.plateNumber, model: mp.carModel, color: mp.carColor } : null, worksDescription: mp.worksDescription, peopleCount: mp.peopleCount } : null;
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
          onClose={() => setSelectedPost(null)} onGoToPost={handleGoToPost} t={t} />
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

  // Build content items with estimated heights
  const items = [];
  if (plate) items.push({ type: 'plate', text: plate, size: fontSize });
  if (currentVehicle) items.push({ type: 'text', text: `${currentVehicle.brand} ${currentVehicle.model}`, size: smallFont, color: mutedFill });
  if (workType) items.push({ type: 'text', text: workType, size: smallFont, bold: true, color: isDark ? '#a5b4fc' : '#6366f1' });
  if (shortWorker) items.push({ type: 'text', text: shortWorker, size: smallFont, color: mutedFill });
  if (currentWO) items.push({ type: 'text', text: `${fmtTime(currentWO.startTime)} → ${fmtTime(currentWO.estimatedEnd)}`, size: smallFont, color: mutedFill });

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
            wrap="word" />
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

function ZoneEl({ el, isDark, zonesData, monitoringData }) {
  const stroke = el.color || '#22c55e';
  let vehicleCount = 0;
  let zoneInfo = null; // monitoring zone info (plate, model, etc.)

  if (monitoringData?.freeZones) {
    // Live mode — match by zone number from element name (e.g. "Зона 01" → zoneNumber 1)
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
    }
  } else {
    // Demo mode — use DB data
    for (const z of (zonesData || [])) {
      if (z.name === el.name) vehicleCount = z._count?.stays || 0;
    }
  }

  const isOccupied = vehicleCount > 0;
  const occupiedStroke = isOccupied ? '#ef4444' : stroke;
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const w = el.width || 160, h = el.height || 100;
  return (
    <Group x={el.x} y={el.y} rotation={el.rotation || 0}>
      <Rect width={w} height={h} fill={occupiedStroke}
        opacity={isDark ? 0.06 : 0.05}
        stroke={occupiedStroke} strokeWidth={isOccupied ? 1.5 : 1} cornerRadius={3}
        dash={[6, 3]} />
      <Text x={5} y={3} text={el.name} fontSize={9} fill={textColor}
        opacity={0.7} fontStyle="bold" fontFamily="system-ui, sans-serif" />
      {isOccupied && (
        <>
          <Circle x={w - 10} y={10} radius={7} fill={occupiedStroke} opacity={0.6} />
          <Text x={w - 17} y={4.5} text={String(vehicleCount)} fontSize={8}
            fontStyle="bold" fill="#fff" width={14} align="center"
            fontFamily="system-ui, sans-serif" />
        </>
      )}
      {zoneInfo && zoneInfo.status === 'occupied' && (
        <Text x={5} y={h - 14} text={zoneInfo.plateNumber || zoneInfo.carModel || ''}
          fontSize={7} fill={textColor} opacity={0.6}
          fontFamily="system-ui, sans-serif" width={w - 10} ellipsis={true} />
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
