import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Circle, Text, Group, Line } from 'react-konva';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePolling } from '../hooks/useSocket';
import { POST_STATUS_COLORS } from '../constants';
import CameraStreamModal from '../components/CameraStreamModal';
import HelpButton from '../components/HelpButton';
import {
  X, Car, Clock, Timer, User, FileText, AlertTriangle,
  ArrowRight, MapPin, Layers, Download, ChevronDown, ChevronUp, Image, FileDown,
} from 'lucide-react';
import jsPDF from 'jspdf';

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

function findPostInZones(postNum, zonesData) {
  for (const z of (zonesData || []))
    for (const p of (z.posts || []))
      if (parseInt(p.name?.match(/\d+/)?.[0], 10) === postNum) return p;
  return null;
}
function postStatusFromData(n, dd, zd) {
  const dp = dd?.posts?.find(p => p.number === n);
  if (dp) {
    if (dp.status === 'free') return 'free';
    return dp.timeline?.some(i => i.status === 'in_progress') ? 'active_work' : 'occupied';
  }
  return findPostInZones(n, zd)?.status || 'free';
}
function vehiclePlateFromData(n, dd, zd) {
  const dp = dd?.posts?.find(p => p.number === n);
  if (dp?.currentVehicle) return dp.currentVehicle.plateNumber;
  return findPostInZones(n, zd)?.stays?.[0]?.vehicleSession?.plateNumber || null;
}

export default function MapViewer() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const stageRef = useRef(null);

  const [layout, setLayout] = useState(null);
  const [zonesData, setZonesData] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedCam, setSelectedCam] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 900, height: 500 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [visibleLayers, setVisibleLayers] = useState(() => {
    try {
      const saved = localStorage.getItem('mapViewerLayers');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { building: true, driveway: true, post: true, zone: true, camera: true, door: true, wall: true, label: true };
  });

  const isDark = theme === 'dark';

  // Load layout
  useEffect(() => {
    api.get('/api/map-layout').then(({ data }) => {
      if (data) setLayout(data);
    }).catch(() => {});
  }, []);

  // Fetch real-time data
  const fetchRealtime = useCallback(async () => {
    try {
      const [zRes, dRes] = await Promise.all([
        api.get('/api/zones'),
        api.get('/api/dashboard-posts'),
      ]);
      if (zRes.data) setZonesData(zRes.data);
      if (dRes.data) setDashboardData(dRes.data);
    } catch { /* ignore */ }
  }, [api]);

  useEffect(() => { fetchRealtime(); }, [fetchRealtime]);
  usePolling(fetchRealtime, 5000);

  // Responsive sizing
  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cw = rect.width;
      const lw = layout?.width || 900;
      const lh = layout?.height || 500;
      const fitScale = Math.min(cw / lw, 1);
      setStageSize({ width: cw, height: lh * fitScale });
      setScale(fitScale);
      setPosition({ x: 0, y: 0 });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [layout]);

  // Zoom with wheel
  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    const dir = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.min(3, Math.max(0.2, oldScale + dir * 0.1));
    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };
    setScale(newScale);
    setPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

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

  // Compute stats
  const allPosts = (zonesData || []).flatMap(z => z.posts || []);
  const totalPosts = allPosts.length || 10;
  const freePosts = allPosts.filter(p => p.status === 'free').length;
  const occupiedPosts = totalPosts - freePosts;
  const activeWork = allPosts.filter(p => p.status === 'active_work').length;
  const idle = allPosts.filter(p => p.status === 'occupied_no_work').length;
  const totalVehicles = (zonesData || []).reduce((s, z) => s + (z._count?.stays || 0), 0);
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
  const bgFill = isDark ? '#1a1a2e' : '#f0f4f8';
  const textFill = isDark ? '#e2e8f0' : '#1e293b';
  const mutedFill = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <MapPin size={22} style={{ color: 'var(--accent)' }} />
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('nav.mapView2')}
          </h2>
          <HelpButton pageKey="map" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPng}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
            <Image size={14} /> {t('mapView.exportPng')}
          </button>
          <button onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
            <FileDown size={14} /> {t('mapView.exportPdf')}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-2">
        {stats.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
            <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="glass-static rounded-xl overflow-hidden relative" style={{ minHeight: 300 }}>
        {/* Layers Panel */}
        <div className="absolute top-2 right-2 z-10" style={{ minWidth: 140 }}>
          <button onClick={() => setShowLayersPanel(!showLayersPanel)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity shadow-md"
            style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(12px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}>
            <Layers size={14} /> {t('mapView.layers')}
            {showLayersPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showLayersPanel && (
            <div className="mt-1 p-2 rounded-lg shadow-lg space-y-1"
              style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)' }}>
              {[
                { key: 'building', label: t('mapView.layerBuildings') },
                { key: 'post', label: t('mapView.layerPosts') },
                { key: 'zone', label: t('mapView.layerZones') },
                { key: 'camera', label: t('mapView.layerCameras') },
                { key: 'driveway', label: t('mapView.layerDriveways') },
                { key: 'door', label: t('mapView.layerDoors') },
                { key: 'wall', label: t('mapView.layerWalls') },
                { key: 'label', label: t('mapView.layerLabels') },
              ].map(l => (
                <label key={l.key} className="flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer hover:opacity-80 text-xs"
                  style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={visibleLayers[l.key] !== false}
                    onChange={() => toggleLayer(l.key)} className="rounded" />
                  {l.label}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Legend Panel */}
        <div className="absolute bottom-2 right-2 z-10">
          <button onClick={() => setShowLegend(!showLegend)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity shadow-md"
            style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(12px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}>
            {t('mapView.legend')}
            {showLegend ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
          {showLegend && (
            <div className="mt-1 p-2.5 rounded-lg shadow-lg space-y-1.5"
              style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', minWidth: 130 }}>
              {[
                { color: POST_STATUS_COLORS.free, label: t('mapView.legendFree') },
                { color: POST_STATUS_COLORS.occupied || '#94a3b8', label: t('mapView.legendOccupied') },
                { color: POST_STATUS_COLORS.active_work, label: t('mapView.legendActiveWork') },
                { color: POST_STATUS_COLORS.occupied_no_work || '#eab308', label: t('mapView.legendIdle') },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </div>

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
            {/* Background */}
            <Rect x={0} y={0} width={layout?.width || 900} height={layout?.height || 500}
              fill={bgFill} cornerRadius={8} />

            {/* Render elements by type */}
            {elements.map(el => {
              if (el.type === 'building') return (
                <Rect key={el.id} x={el.x} y={el.y} width={el.width} height={el.height}
                  stroke="#22c55e" strokeWidth={2} fill="transparent" dash={[8, 4]} />
              );
              if (el.type === 'driveway') return (
                <Rect key={el.id} x={el.x} y={el.y} width={el.width} height={el.height}
                  rotation={el.rotation || 0} fill="rgba(148,163,184,0.12)"
                  stroke="#94a3b8" strokeWidth={1.5} dash={[6, 3]} cornerRadius={4} />
              );
              if (el.type === 'wall') return <WallEl key={el.id} el={el} />;
              if (el.type === 'zone') return <ZoneEl key={el.id} el={el} isDark={isDark} zonesData={zonesData} />;
              if (el.type === 'door') return <DoorEl key={el.id} el={el} isDark={isDark} />;
              if (el.type === 'label') return <LabelEl key={el.id} el={el} fill={mutedFill} />;
              if (el.type === 'post') return (
                <PostEl key={el.id} el={el} isDark={isDark} textFill={textFill} mutedFill={mutedFill}
                  status={postStatusFromData(el.postNumber, dashboardData, zonesData)}
                  plate={vehiclePlateFromData(el.postNumber, dashboardData, zonesData)}
                  statusLabel={t(`posts.${postStatusFromData(el.postNumber, dashboardData, zonesData)}`)}
                  postLabel={t(`posts.post${el.postNumber}`)}
                  onClick={() => setSelectedPost(el.postNumber)} />
              );
              if (el.type === 'camera') return (
                <CameraEl key={el.id} el={el} isDark={isDark}
                  onClick={() => setSelectedCam(el.camNum)} />
              );
              return null;
            })}
          </Layer>
        </Stage>
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

function PostEl({ el, isDark, textFill, mutedFill, status, plate, statusLabel, postLabel, onClick }) {
  const color = POST_STATUS_COLORS[status] || '#94a3b8';
  const fillBg = isDark ? 'rgba(30,30,60,0.85)' : 'rgba(255,255,255,0.9)';
  return (
    <Group x={el.x} y={el.y} onClick={onClick} onTap={onClick}>
      <Rect width={el.width} height={el.height} fill={fillBg}
        stroke={color} strokeWidth={3} cornerRadius={6} shadowBlur={6}
        shadowColor={color} shadowOpacity={0.3} />
      <Rect x={0} y={0} width={el.width} height={22} fill={color}
        cornerRadius={[6, 6, 0, 0]} opacity={0.9} />
      <Text x={6} y={4} text={postLabel} fontSize={12} fontStyle="bold" fill="#fff" />
      <Text x={el.width - 60} y={5} text={statusLabel} fontSize={9} fill="#fff" width={54} align="right" />
      {plate ? (
        <Text x={6} y={30} text={plate} fontSize={13} fontFamily="monospace"
          fontStyle="bold" fill={textFill} />
      ) : (
        <Text x={6} y={30} text="---" fontSize={13} fill={mutedFill} />
      )}
      <Circle x={el.width - 14} y={el.height - 14} radius={5} fill={color} />
    </Group>
  );
}

function ZoneEl({ el, isDark, zonesData }) {
  const opacity = 0.12;
  const strokeOpacity = 0.5;
  const fill = el.color || '#22c55e';
  // count vehicles in this zone
  let vehicleCount = 0;
  for (const z of (zonesData || [])) {
    if (z.name === el.name) vehicleCount = z._count?.stays || 0;
  }
  const textColor = isDark ? '#cbd5e1' : '#475569';
  return (
    <Group x={el.x} y={el.y}>
      <Rect width={el.width} height={el.height} fill={fill} opacity={opacity}
        stroke={fill} strokeWidth={1.5} cornerRadius={4}
        dash={[6, 3]} />
      <Text x={4} y={4} text={el.name} fontSize={10} fill={textColor} opacity={0.7} />
      {vehicleCount > 0 && (
        <>
          <Circle x={el.width - 14} y={14} radius={10} fill={fill} opacity={strokeOpacity} />
          <Text x={el.width - 20} y={8} text={String(vehicleCount)} fontSize={11}
            fontStyle="bold" fill="#fff" width={12} align="center" />
        </>
      )}
    </Group>
  );
}

function CameraEl({ el, isDark, onClick }) {
  const fill = '#ef4444';
  const cx = (el.width || 24) / 2, cy = (el.height || 24) / 2;
  const dir = (el.data?.direction || 0) * Math.PI / 180;
  const fov = (el.data?.fov || 90) * Math.PI / 180;
  const range = el.data?.range || 80;
  const lx = cx + Math.cos(dir - fov / 2) * range;
  const ly = cy + Math.sin(dir - fov / 2) * range;
  const rx = cx + Math.cos(dir + fov / 2) * range;
  const ry = cy + Math.sin(dir + fov / 2) * range;
  const mx = cx + Math.cos(dir) * range;
  const my = cy + Math.sin(dir) * range;
  return (
    <Group x={el.x} y={el.y} onClick={onClick} onTap={onClick}>
      <Line points={[cx, cy, lx, ly, mx, my, rx, ry]} closed
        fill={fill} opacity={0.1} stroke={fill} strokeWidth={0.5} dash={[4, 2]} />
      <Circle x={cx} y={cy} radius={10} fill={fill} opacity={0.9}
        shadowBlur={6} shadowColor={fill} shadowOpacity={0.5} />
      <Circle x={cx} y={cy} radius={3} fill="#fff" />
      <Text x={cx - 18} y={cy + 12} text={el.name || ''} fontSize={8}
        fill={fill} width={36} align="center" />
    </Group>
  );
}

function DoorEl({ el, isDark }) {
  const fill = el.color || '#f59e0b';
  const textColor = isDark ? '#fcd34d' : '#92400e';
  return (
    <Group x={el.x} y={el.y}>
      <Rect width={el.width} height={el.height} fill={fill} opacity={0.3}
        stroke={fill} strokeWidth={1.5} cornerRadius={3} />
      <Text x={4} y={el.height / 2 - 5} text={el.name} fontSize={9}
        fill={textColor} fontStyle="bold" />
    </Group>
  );
}

function WallEl({ el }) {
  return (
    <Rect x={el.x} y={el.y} width={el.width} height={el.height}
      fill={el.color || '#6b7280'} opacity={0.6} cornerRadius={1} />
  );
}

function LabelEl({ el, fill }) {
  return (
    <Text x={el.x} y={el.y} text={el.name} fontSize={11}
      fill={fill} fontStyle="italic" opacity={0.6} />
  );
}
