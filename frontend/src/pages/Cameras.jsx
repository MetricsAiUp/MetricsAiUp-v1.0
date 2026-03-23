import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Camera, DoorOpen, Wrench, Search, ParkingCircle, X, Maximize2 } from 'lucide-react';
import HelpButton from '../components/HelpButton';

// Камеры хранятся по номерам, prefix (КАМ/CAM) добавляется по языку
const camName = (num, isRu) => (isRu ? 'КАМ' : 'CAM') + num;

const ZONE_CAMERA_MAP = [
  { zone: { ru: 'Въезд', en: 'Entry' }, type: 'entry', desc: { ru: 'Ворота въезда на территорию СТО', en: 'Entry gate' }, cameras: ['09'], priority: { '09': 10 } },
  { zone: { ru: 'Выезд', en: 'Exit' }, type: 'exit', desc: { ru: 'Ворота выезда с территории СТО', en: 'Exit gate' }, cameras: ['09'], priority: { '09': 10 } },
  { zone: { ru: 'Пост 1', en: 'Post 1' }, type: 'lift', desc: { ru: '2-х стоечный подъёмник <2.5т', en: '2-post lift <2.5t' }, cameras: ['01', '03'], priority: { '01': 10, '03': 5 } },
  { zone: { ru: 'Пост 2', en: 'Post 2' }, type: 'lift', desc: { ru: '2-х стоечный подъёмник <2.5т', en: '2-post lift <2.5t' }, cameras: ['01', '03'], priority: { '01': 8, '03': 10 } },
  { zone: { ru: 'Пост 3', en: 'Post 3' }, type: 'lift', desc: { ru: '2-х стоечный подъёмник <2.5т', en: '2-post lift <2.5t' }, cameras: ['03', '04'], priority: { '03': 5, '04': 10 } },
  { zone: { ru: 'Пост 4', en: 'Post 4' }, type: 'lift', desc: { ru: '2-х стоечный подъёмник >2.5т (грузовой)', en: '2-post lift >2.5t (heavy)' }, cameras: ['04', '06'], priority: { '04': 8, '06': 5 } },
  { zone: { ru: 'Пост 5', en: 'Post 5' }, type: 'lift', desc: { ru: '2-х стоечный подъёмник <2.5т', en: '2-post lift <2.5t' }, cameras: ['02', '05'], priority: { '02': 10, '05': 5 } },
  { zone: { ru: 'Пост 6', en: 'Post 6' }, type: 'lift', desc: { ru: '2-х стоечный подъёмник <2.5т', en: '2-post lift <2.5t' }, cameras: ['02', '05'], priority: { '02': 8, '05': 10 } },
  { zone: { ru: 'Пост 7', en: 'Post 7' }, type: 'lift', desc: { ru: '2-х стоечный подъёмник <2.5т', en: '2-post lift <2.5t' }, cameras: ['05', '06'], priority: { '05': 5, '06': 10 } },
  { zone: { ru: 'Пост 8', en: 'Post 8' }, type: 'lift', desc: { ru: '2-х стоечный подъёмник <2.5т', en: '2-post lift <2.5t' }, cameras: ['06', '07'], priority: { '06': 8, '07': 5 } },
  { zone: { ru: 'Пост 9', en: 'Post 9' }, type: 'diag', desc: { ru: 'Диагностика', en: 'Diagnostics' }, cameras: ['07', '08'], priority: { '07': 10, '08': 5 } },
  { zone: { ru: 'Пост 10', en: 'Post 10' }, type: 'diag', desc: { ru: 'Диагностика', en: 'Diagnostics' }, cameras: ['08', '10'], priority: { '08': 10, '10': 5 } },
  { zone: { ru: 'Парковка / Ожидание', en: 'Parking / Waiting' }, type: 'parking', desc: { ru: 'Зона ожидания и парковка готовых авто', en: 'Waiting area and ready cars parking' }, cameras: ['09', '01'], priority: { '09': 5, '01': 3 } },
];

const ALL_CAMERAS = [
  { num: '01', loc: { ru: 'Нижний ряд, левый угол', en: 'Lower row, left corner' }, covers: { ru: 'Пост 1, Пост 2, Парковка', en: 'Post 1, Post 2, Parking' } },
  { num: '02', loc: { ru: 'Верхний ряд, левый угол', en: 'Upper row, left corner' }, covers: { ru: 'Пост 5, Пост 6', en: 'Post 5, Post 6' } },
  { num: '03', loc: { ru: 'Между рядами, левая часть', en: 'Between rows, left' }, covers: { ru: 'Пост 1, Пост 2, Пост 3', en: 'Post 1, Post 2, Post 3' } },
  { num: '04', loc: { ru: 'Между рядами, правая часть', en: 'Between rows, right' }, covers: { ru: 'Пост 3, Пост 4', en: 'Post 3, Post 4' } },
  { num: '05', loc: { ru: 'Верхний ряд, центр', en: 'Upper row, center' }, covers: { ru: 'Пост 5, Пост 6, Пост 7', en: 'Post 5, Post 6, Post 7' } },
  { num: '06', loc: { ru: 'Верхний ряд, правая часть', en: 'Upper row, right' }, covers: { ru: 'Пост 4, Пост 7, Пост 8', en: 'Post 4, Post 7, Post 8' } },
  { num: '07', loc: { ru: 'Граница ремзоны и диагностики', en: 'Repair/diagnostics border' }, covers: { ru: 'Пост 8, Пост 9', en: 'Post 8, Post 9' } },
  { num: '08', loc: { ru: 'Диагностика, центр', en: 'Diagnostics, center' }, covers: { ru: 'Пост 9, Пост 10', en: 'Post 9, Post 10' } },
  { num: '09', loc: { ru: 'Въезд/Выезд', en: 'Entry/Exit' }, covers: { ru: 'Въезд, Выезд, Парковка', en: 'Entry, Exit, Parking' } },
  { num: '10', loc: { ru: 'Диагностика, правая стена', en: 'Diagnostics, right wall' }, covers: { ru: 'Пост 10', en: 'Post 10' } },
];

const TYPE_COLORS = {
  entry: '#10b981',
  exit: '#ef4444',
  lift: '#6366f1',
  diag: '#a855f7',
  parking: '#f59e0b',
};

const TYPE_ICONS = {
  entry: DoorOpen,
  exit: DoorOpen,
  lift: Wrench,
  diag: Search,
  parking: ParkingCircle,
};

const TYPE_LABELS_RU = {
  entry: 'Въезд',
  exit: 'Выезд',
  lift: 'Подъёмник',
  diag: 'Диагностика',
  parking: 'Парковка',
};

// Modal for camera stream
function CameraStreamModal({ camNum, isRu, isDark, onClose }) {
  const name = camName(camNum, isRu);
  const camData = ALL_CAMERAS.find(c => c.num === camNum);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div className="w-full max-w-4xl" onClick={e => e.stopPropagation()}>
        {/* Video area */}
        <div className="relative rounded-t-xl overflow-hidden"
          style={{ aspectRatio: '16/9', background: '#000' }}>

          {/* Placeholder — ready for HLS <video> */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Camera size={56} style={{ color: 'rgba(148,163,184,0.25)' }} />
            <span className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>
              {isRu ? 'Подключение к камере...' : 'Connecting to camera...'}
            </span>
            <span className="text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>
              {isRu ? 'Стрим будет доступен после подключения CV-системы' : 'Stream available after CV system connection'}
            </span>
          </div>

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white font-bold text-sm">{name}</span>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                LIVE
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-1 rounded hover:bg-white/10"><Maximize2 size={16} color="white" /></button>
              <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X size={16} color="white" /></button>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2"
            style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
            <span className="text-xs text-white/60 font-mono">
              {new Date().toLocaleTimeString()}
            </span>
            <span className="text-xs text-white/40">
              {camData?.loc?.[isRu ? 'ru' : 'en'] || ''}
            </span>
          </div>
        </div>

        {/* Info bar below video */}
        <div className="rounded-b-xl p-4 flex items-center justify-between"
          style={{ background: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)', border: '1px solid var(--border-glass)', borderTop: 'none' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {camData?.loc?.[isRu ? 'ru' : 'en'] || ''}
            </p>
          </div>
          {camData && (
            <div className="flex flex-wrap gap-1">
              {camData.covers[isRu ? 'ru' : 'en'].split(', ').map(z => (
                <span key={z} className="px-2 py-0.5 rounded text-xs"
                  style={{ background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.08)', color: 'var(--accent)' }}>
                  {z}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ZoneCameraCard({ zone, isDark, isRu, onCameraClick }) {
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
          {TYPE_LABELS_RU[zone.type]}
        </span>
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        {zone.desc[isRu ? 'ru' : 'en']}
      </p>

      <div className="space-y-1.5">
        {zone.cameras.map(num => {
          const prio = zone.priority[num] || 0;
          const isMain = prio >= 8;
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
  const isOnline = cam.online !== false; // default true for mock

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
    { key: 'diag', label: isRu ? 'Диагностика' : 'Diagnostics' },
    { key: 'parking', label: isRu ? 'Парковка' : 'Parking' },
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
              <ZoneCameraCard key={i} zone={zone} isDark={isDark} isRu={isRu} onCameraClick={setStreamCam} />
            ))}
          </div>
        </div>
      )}

      {/* Tab: All Cameras */}
      {tab === 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ALL_CAMERAS.map((cam, i) => (
            <AllCamerasCard key={i} cam={cam} isDark={isDark} isRu={isRu} onCameraClick={setStreamCam} />
          ))}
        </div>
      )}

      {/* Stream modal */}
      {streamCam && (
        <CameraStreamModal
          camNum={streamCam}
          isRu={isRu}
          isDark={isDark}
          onClose={() => setStreamCam(null)}
        />
      )}
    </div>
  );
}
