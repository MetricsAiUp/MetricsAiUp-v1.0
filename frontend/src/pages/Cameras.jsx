import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Camera, DoorOpen, Wrench, Search, ParkingCircle, Warehouse } from 'lucide-react';
import HelpButton from '../components/HelpButton';
import CameraStreamModal from '../components/CameraStreamModal';
import { useCameraStatus } from '../hooks/useCameraStatus';

// Камеры хранятся по номерам, prefix (КАМ/CAM) добавляется по языку
const camName = (num, isRu) => (isRu ? 'КАМ' : 'CAM') + num;

const ZONE_CAMERA_MAP = [
  { zone: { ru: 'Шлагбаум', en: 'Barrier' }, type: 'entry', desc: { ru: 'Шлагбаум на въезде', en: 'Entry barrier' }, cameras: ['00'], priority: { '00': 10 } },
  { zone: { ru: 'Стоянка', en: 'Parking' }, type: 'parking', desc: { ru: 'Стоянка автомобилей', en: 'Vehicle parking' }, cameras: ['01'], priority: { '01': 10 } },
  { zone: { ru: 'Ворота + Пост 7, 8', en: 'Gates + Post 7, 8' }, type: 'entry', desc: { ru: 'Ворота и обзор постов 7, 8', en: 'Gates and posts 7, 8 overview' }, cameras: ['02'], priority: { '02': 10 } },
  { zone: { ru: 'Пост 1', en: 'Post 1' }, type: 'lift', desc: { ru: 'Подъёмник', en: 'Lift' }, cameras: ['12', '11'], priority: { '12': 10, '11': 5 } },
  { zone: { ru: 'Пост 2', en: 'Post 2' }, type: 'lift', desc: { ru: 'Подъёмник', en: 'Lift' }, cameras: ['12', '11'], priority: { '12': 8, '11': 10 } },
  { zone: { ru: 'Пост 3', en: 'Post 3' }, type: 'lift', desc: { ru: 'Подъёмник', en: 'Lift' }, cameras: ['14'], priority: { '14': 10 } },
  { zone: { ru: 'Пост 4', en: 'Post 4' }, type: 'lift', desc: { ru: 'Подъёмник', en: 'Lift' }, cameras: ['14', '13'], priority: { '14': 8, '13': 10 } },
  { zone: { ru: 'Пост 5', en: 'Post 5' }, type: 'lift', desc: { ru: 'Подъёмник', en: 'Lift' }, cameras: ['13', '08', '09'], priority: { '13': 10, '08': 8, '09': 5 } },
  { zone: { ru: 'Пост 6', en: 'Post 6' }, type: 'lift', desc: { ru: 'Подъёмник', en: 'Lift' }, cameras: ['08'], priority: { '08': 10 } },
  { zone: { ru: 'Пост 7', en: 'Post 7' }, type: 'lift', desc: { ru: 'Подъёмник', en: 'Lift' }, cameras: ['02', '03', '04'], priority: { '02': 5, '03': 10, '04': 8 } },
  { zone: { ru: 'Пост 8', en: 'Post 8' }, type: 'lift', desc: { ru: 'Подъёмник', en: 'Lift' }, cameras: ['02', '03', '04'], priority: { '02': 5, '03': 8, '04': 10 } },
  { zone: { ru: 'Пост 9', en: 'Post 9' }, type: 'lift', desc: { ru: 'Подъёмник', en: 'Lift' }, cameras: ['04', '05'], priority: { '04': 10, '05': 8 } },
  { zone: { ru: 'Пост 10', en: 'Post 10' }, type: 'lift', desc: { ru: 'Подъёмник', en: 'Lift' }, cameras: ['05'], priority: { '05': 10 } },
  { zone: { ru: 'Зона 01', en: 'Zone 01' }, type: 'parking', desc: { ru: 'Свободная зона 01', en: 'Free zone 01' }, cameras: ['15'], priority: { '15': 10 } },
  { zone: { ru: 'Зона 02', en: 'Zone 02' }, type: 'parking', desc: { ru: 'Свободная зона 02', en: 'Free zone 02' }, cameras: ['12'], priority: { '12': 10 } },
  { zone: { ru: 'Зона 03', en: 'Zone 03' }, type: 'parking', desc: { ru: 'Свободная зона 03', en: 'Free zone 03' }, cameras: ['14'], priority: { '14': 5 } },
  { zone: { ru: 'Зона 04', en: 'Zone 04' }, type: 'parking', desc: { ru: 'Свободная зона 04', en: 'Free zone 04' }, cameras: ['11', '10'], priority: { '11': 8, '10': 10 } },
  { zone: { ru: 'Зона 05', en: 'Zone 05' }, type: 'parking', desc: { ru: 'Свободная зона 05', en: 'Free zone 05' }, cameras: ['10', '08'], priority: { '10': 10, '08': 5 } },
  { zone: { ru: 'Зона 06', en: 'Zone 06' }, type: 'parking', desc: { ru: 'Свободная зона 06', en: 'Free zone 06' }, cameras: ['09', '08', '10'], priority: { '09': 10, '08': 8, '10': 5 } },
  { zone: { ru: 'Зона 07', en: 'Zone 07' }, type: 'parking', desc: { ru: 'Свободная зона 07', en: 'Free zone 07' }, cameras: ['05'], priority: { '05': 5 } },
  { zone: { ru: 'Склад приёмки', en: 'Intake warehouse' }, type: 'warehouse', desc: { ru: 'Склад приёмки автомобилей', en: 'Vehicle intake warehouse' }, cameras: ['06'], priority: { '06': 10 } },
  { zone: { ru: 'Склад деталей', en: 'Parts warehouse' }, type: 'warehouse', desc: { ru: 'Склад запасных частей', en: 'Spare parts warehouse' }, cameras: ['07'], priority: { '07': 10 } },
];

const ALL_CAMERAS = [
  { num: '00', loc: { ru: 'Шлагбаум', en: 'Barrier' }, covers: { ru: 'Шлагбаум', en: 'Barrier' } },
  { num: '01', loc: { ru: 'Стоянка', en: 'Parking' }, covers: { ru: 'Стоянка', en: 'Parking' } },
  { num: '02', loc: { ru: 'Ворота', en: 'Gates' }, covers: { ru: 'Ворота, Пост 7, Пост 8', en: 'Gates, Post 7, Post 8' } },
  { num: '03', loc: { ru: 'Посты 7, 8', en: 'Posts 7, 8' }, covers: { ru: 'Пост 7, Пост 8', en: 'Post 7, Post 8' } },
  { num: '04', loc: { ru: 'Посты 9, 8, 7', en: 'Posts 9, 8, 7' }, covers: { ru: 'Пост 9, Пост 8, Пост 7', en: 'Post 9, Post 8, Post 7' } },
  { num: '05', loc: { ru: 'Пост 10, Зона 07', en: 'Post 10, Zone 07' }, covers: { ru: 'Пост 10, Зона 07', en: 'Post 10, Zone 07' } },
  { num: '06', loc: { ru: 'Склад приёмки', en: 'Intake warehouse' }, covers: { ru: 'Склад приёмки', en: 'Intake warehouse' } },
  { num: '07', loc: { ru: 'Склад деталей', en: 'Parts warehouse' }, covers: { ru: 'Склад деталей', en: 'Parts warehouse' } },
  { num: '08', loc: { ru: 'Посты 6, 5, Зоны 6, 5', en: 'Posts 6, 5, Zones 6, 5' }, covers: { ru: 'Пост 6, Пост 5, Зона 6, Зона 5', en: 'Post 6, Post 5, Zone 6, Zone 5' } },
  { num: '09', loc: { ru: 'Зона 06, Пост 5', en: 'Zone 06, Post 5' }, covers: { ru: 'Зона 06, Пост 5', en: 'Zone 06, Post 5' } },
  { num: '10', loc: { ru: 'Зоны 5, 4, 6', en: 'Zones 5, 4, 6' }, covers: { ru: 'Зона 05, Зона 04, Зона 06', en: 'Zone 05, Zone 04, Zone 06' } },
  { num: '11', loc: { ru: 'Пост 2, Зоны 4, 5', en: 'Post 2, Zones 4, 5' }, covers: { ru: 'Пост 2, Зона 04, Зона 05', en: 'Post 2, Zone 04, Zone 05' } },
  { num: '12', loc: { ru: 'Посты 1, 2', en: 'Posts 1, 2' }, covers: { ru: 'Пост 1, Пост 2', en: 'Post 1, Post 2' } },
  { num: '13', loc: { ru: 'Посты 5, 4', en: 'Posts 5, 4' }, covers: { ru: 'Пост 5, Пост 4', en: 'Post 5, Post 4' } },
  { num: '14', loc: { ru: 'Посты 3, 4, Зона 03', en: 'Posts 3, 4, Zone 03' }, covers: { ru: 'Пост 3, Пост 4, Зона 03', en: 'Post 3, Post 4, Zone 03' } },
  { num: '15', loc: { ru: 'Зона 01', en: 'Zone 01' }, covers: { ru: 'Зона 01', en: 'Zone 01' } },
];

const TYPE_COLORS = {
  entry: '#10b981',
  exit: '#ef4444',
  lift: '#6366f1',
  diag: '#a855f7',
  parking: '#f59e0b',
  warehouse: '#64748b',
};

const TYPE_ICONS = {
  entry: DoorOpen,
  exit: DoorOpen,
  lift: Wrench,
  diag: Search,
  parking: ParkingCircle,
  warehouse: Warehouse,
};

const TYPE_LABELS = {
  entry: { ru: 'Въезд', en: 'Entry' },
  exit: { ru: 'Выезд', en: 'Exit' },
  lift: { ru: 'Подъёмник', en: 'Lift' },
  diag: { ru: 'Диагностика', en: 'Diagnostics' },
  parking: { ru: 'Парковка/Зона', en: 'Parking/Zone' },
  warehouse: { ru: 'Склад', en: 'Warehouse' },
};

function ZoneCameraCard({ zone, isDark, isRu, onCameraClick, cameraStatuses }) {
  const color = TYPE_COLORS[zone.type] || '#94a3b8';
  const Icon = TYPE_ICONS[zone.type] || Wrench;

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {zone.zone[isRu ? 'ru' : 'en']}
          </span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: color + '15', color }}>
          {TYPE_LABELS[zone.type]?.[isRu ? 'ru' : 'en'] || zone.type}
        </span>
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        {zone.desc[isRu ? 'ru' : 'en']}
      </p>

      <div className="space-y-1.5">
        {zone.cameras.map(num => {
          const prio = zone.priority[num] || 0;
          const isMain = prio >= 8;
          const camId = `cam${num}`;
          const isOnline = cameraStatuses?.[camId]?.online === true;
          return (
            <div
              key={num}
              className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all hover:opacity-80"
              style={{
                background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(240,244,248,0.8)',
                border: isMain ? `1px solid ${color}40` : '1px solid var(--border-glass)',
              }}
              onClick={() => onCameraClick?.(num)}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isOnline ? '#10b981' : '#94a3b8' }} />
                <Camera size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{camName(num, isRu)}</span>
              </div>
              <div className="flex items-center gap-2">
                {isMain && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: color + '20', color }}>
                    {isRu ? 'основная' : 'main'}
                  </span>
                )}
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>P{prio}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AllCamerasCard({ cam, isDark, isRu, onCameraClick }) {
  const name = camName(cam.num, isRu);
  const isOnline = cam.online === true;

  return (
    <div className="glass overflow-hidden cursor-pointer" onClick={() => onCameraClick?.(cam.num)}>
      {/* Video stream area — 16:9 ratio, ready for HLS/RTSP */}
      <div
        className="relative w-full flex items-center justify-center"
        style={{ aspectRatio: '16/9', background: isDark ? '#0a0f1a' : '#1a1a2e' }}
      >
        {/* Placeholder — will be replaced with <video> element for HLS stream */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Camera size={32} style={{ color: 'rgba(148,163,184,0.3)' }} />
          <span className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
            {isRu ? 'Нет сигнала' : 'No signal'}
          </span>
        </div>

        {/* Top-left: camera name badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: isOnline ? '#10b981' : '#ef4444' }} />
          <span className="text-xs font-bold text-white">{name}</span>
        </div>

        {/* Top-right: status */}
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-xs"
          style={{ background: isOnline ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: isOnline ? '#10b981' : '#ef4444' }}>
          {isOnline ? (isRu ? 'Онлайн' : 'Online') : (isRu ? 'Офлайн' : 'Offline')}
        </div>

        {/* Bottom: timestamp placeholder */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-xs font-mono"
          style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.6)' }}>
          --:--:--
        </div>
      </div>

      {/* Info section below video */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {cam.loc[isRu ? 'ru' : 'en']}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {cam.covers[isRu ? 'ru' : 'en'].split(', ').map(z => (
            <span key={z} className="px-1.5 py-0.5 rounded text-xs"
              style={{ background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.08)', color: 'var(--accent)' }}>
              {z}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Cameras() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const cameraStatuses = useCameraStatus();
  const [tab, setTab] = useState('zones');
  const [filter, setFilter] = useState('all');
  const [streamCam, setStreamCam] = useState(null);

  const isDark = theme === 'dark';
  const isRu = i18n.language === 'ru';

  const filteredZones = filter === 'all'
    ? ZONE_CAMERA_MAP
    : ZONE_CAMERA_MAP.filter(z => z.type === filter || (filter === 'entry' && z.type === 'exit'));

  const tabs = [
    { key: 'zones', label: isRu ? 'Камеры по зонам' : 'Cameras by Zone' },
    { key: 'all', label: isRu ? 'Все камеры' : 'All Cameras' },
  ];

  const filters = [
    { key: 'all', label: isRu ? 'Все' : 'All' },
    { key: 'entry', label: isRu ? 'Въезд/Выезд' : 'Entry/Exit' },
    { key: 'lift', label: isRu ? 'Подъёмники' : 'Lifts' },
    { key: 'parking', label: isRu ? 'Парковка/Зоны' : 'Parking/Zones' },
    { key: 'warehouse', label: isRu ? 'Склады' : 'Warehouses' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {isRu ? 'Камеры' : 'Cameras'}
          </h2>
          <HelpButton pageKey="cameras" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            {ALL_CAMERAS.length} {isRu ? 'камер' : 'cameras'}
          </span>
          <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
            {ZONE_CAMERA_MAP.length} {isRu ? 'зон' : 'zones'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-xl text-sm transition-all"
            style={{
              background: tab === t.key ? 'var(--accent)' : 'var(--bg-glass)',
              color: tab === t.key ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${tab === t.key ? 'var(--accent)' : 'var(--border-glass)'}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Cameras by Zone */}
      {tab === 'zones' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  background: filter === f.key ? 'var(--accent)' : 'var(--bg-glass)',
                  color: filter === f.key ? 'white' : 'var(--text-muted)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Zones grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredZones.map((zone, i) => (
              <ZoneCameraCard key={i} zone={zone} isDark={isDark} isRu={isRu} onCameraClick={setStreamCam} cameraStatuses={cameraStatuses} />
            ))}
          </div>
        </div>
      )}

      {/* Tab: All Cameras */}
      {tab === 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ALL_CAMERAS.map((cam, i) => {
            const camId = `cam${cam.num}`;
            const isOnline = cameraStatuses[camId]?.online;
            return <AllCamerasCard key={i} cam={{ ...cam, online: isOnline }} isDark={isDark} isRu={isRu} onCameraClick={setStreamCam} />;
          })}
        </div>
      )}

      {/* Stream modal */}
      {streamCam && (() => {
        const camData = ALL_CAMERAS.find(c => c.num === streamCam);
        const lang = isRu ? 'ru' : 'en';
        return (
          <CameraStreamModal
            camId={`cam${streamCam}`}
            camName={camName(streamCam, isRu)}
            camLocation={camData?.loc?.[lang] || ''}
            camCovers={camData?.covers?.[lang] || ''}
            isRu={isRu}
            isDark={isDark}
            onClose={() => setStreamCam(null)}
          />
        );
      })()}
    </div>
  );
}
