import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// Реальная разметка: зона = каждая отдельная точка СТО
// Камера может видеть несколько зон
const ZONE_CAMERA_MAP = [
  {
    zone: 'Въезд',
    type: 'entry',
    description: 'Ворота въезда на территорию СТО',
    cameras: ['CAM 09'],
    priority: { 'CAM 09': 10 },
  },
  {
    zone: 'Выезд',
    type: 'exit',
    description: 'Ворота выезда с территории СТО',
    cameras: ['CAM 09'],
    priority: { 'CAM 09': 10 },
  },
  {
    zone: 'Пост 1',
    type: 'lift',
    description: '2-х стоечный подъёмник <2.5т',
    cameras: ['CAM 01', 'CAM 03'],
    priority: { 'CAM 01': 10, 'CAM 03': 5 },
  },
  {
    zone: 'Пост 2',
    type: 'lift',
    description: '2-х стоечный подъёмник <2.5т',
    cameras: ['CAM 01', 'CAM 03'],
    priority: { 'CAM 01': 8, 'CAM 03': 10 },
  },
  {
    zone: 'Пост 3',
    type: 'lift',
    description: '2-х стоечный подъёмник <2.5т',
    cameras: ['CAM 03', 'CAM 04'],
    priority: { 'CAM 03': 5, 'CAM 04': 10 },
  },
  {
    zone: 'Пост 4',
    type: 'lift',
    description: '2-х стоечный подъёмник >2.5т (грузовой)',
    cameras: ['CAM 04', 'CAM 06'],
    priority: { 'CAM 04': 8, 'CAM 06': 5 },
  },
  {
    zone: 'Пост 5',
    type: 'lift',
    description: '2-х стоечный подъёмник <2.5т',
    cameras: ['CAM 02', 'CAM 05'],
    priority: { 'CAM 02': 10, 'CAM 05': 5 },
  },
  {
    zone: 'Пост 6',
    type: 'lift',
    description: '2-х стоечный подъёмник <2.5т',
    cameras: ['CAM 02', 'CAM 05'],
    priority: { 'CAM 02': 8, 'CAM 05': 10 },
  },
  {
    zone: 'Пост 7',
    type: 'lift',
    description: '2-х стоечный подъёмник <2.5т',
    cameras: ['CAM 05', 'CAM 06'],
    priority: { 'CAM 05': 5, 'CAM 06': 10 },
  },
  {
    zone: 'Пост 8',
    type: 'lift',
    description: '2-х стоечный подъёмник <2.5т',
    cameras: ['CAM 06', 'CAM 07'],
    priority: { 'CAM 06': 8, 'CAM 07': 5 },
  },
  {
    zone: 'Пост 9',
    type: 'diag',
    description: 'Диагностика',
    cameras: ['CAM 07', 'CAM 08'],
    priority: { 'CAM 07': 10, 'CAM 08': 5 },
  },
  {
    zone: 'Пост 10',
    type: 'diag',
    description: 'Диагностика',
    cameras: ['CAM 08', 'CAM 10'],
    priority: { 'CAM 08': 10, 'CAM 10': 5 },
  },
  {
    zone: 'Парковка / Ожидание',
    type: 'parking',
    description: 'Зона ожидания и парковка готовых авто',
    cameras: ['CAM 09', 'CAM 01'],
    priority: { 'CAM 09': 5, 'CAM 01': 3 },
  },
];

// Все камеры СТО
const ALL_CAMERAS = [
  { name: 'CAM 01', location: 'Нижний ряд, левый угол', covers: 'Пост 1, Пост 2, Парковка' },
  { name: 'CAM 02', location: 'Верхний ряд, левый угол', covers: 'Пост 5, Пост 6' },
  { name: 'CAM 03', location: 'Между рядами, левая часть', covers: 'Пост 1, Пост 2, Пост 3' },
  { name: 'CAM 04', location: 'Между рядами, правая часть', covers: 'Пост 3, Пост 4' },
  { name: 'CAM 05', location: 'Верхний ряд, центр', covers: 'Пост 5, Пост 6, Пост 7' },
  { name: 'CAM 06', location: 'Верхний ряд, правая часть', covers: 'Пост 4, Пост 7, Пост 8' },
  { name: 'CAM 07', location: 'Граница ремзоны и диагностики', covers: 'Пост 8, Пост 9' },
  { name: 'CAM 08', location: 'Диагностика, центр', covers: 'Пост 9, Пост 10' },
  { name: 'CAM 09', location: 'Въезд/Выезд', covers: 'Въезд, Выезд, Парковка' },
  { name: 'CAM 10', location: 'Диагностика, правая стена', covers: 'Пост 10' },
];

const TYPE_COLORS = {
  entry: '#10b981',
  exit: '#ef4444',
  lift: '#6366f1',
  diag: '#a855f7',
  parking: '#f59e0b',
};

const TYPE_ICONS = {
  entry: '🚪',
  exit: '🚪',
  lift: '🔧',
  diag: '🔍',
  parking: '🅿️',
};

const TYPE_LABELS_RU = {
  entry: 'Въезд',
  exit: 'Выезд',
  lift: 'Подъёмник',
  diag: 'Диагностика',
  parking: 'Парковка',
};

function ZoneCameraCard({ zone, isDark }) {
  const color = TYPE_COLORS[zone.type] || '#94a3b8';
  const icon = TYPE_ICONS[zone.type] || '📍';

  return (
    <div className="glass p-4">
      {/* Zone header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {zone.zone}
          </span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: color + '15', color }}
        >
          {TYPE_LABELS_RU[zone.type]}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        {zone.description}
      </p>

      {/* Cameras */}
      <div className="space-y-1.5">
        {zone.cameras.map(cam => {
          const prio = zone.priority[cam] || 0;
          const isMain = prio >= 8;
          return (
            <div
              key={cam}
              className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{
                background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(240,244,248,0.8)',
                border: isMain ? `1px solid ${color}40` : '1px solid var(--border-glass)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs">📹</span>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{cam}</span>
              </div>
              <div className="flex items-center gap-2">
                {isMain && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: color + '20', color }}>
                    основная
                  </span>
                )}
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  P{prio}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AllCamerasCard({ cam, isDark }) {
  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📹</span>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {cam.name}
          </span>
        </div>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#10b981' }} title="Online" />
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>Расположение</span>
          <span style={{ color: 'var(--text-secondary)' }}>{cam.location}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Покрывает зоны:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {cam.covers.split(', ').map(z => (
              <span
                key={z}
                className="px-1.5 py-0.5 rounded"
                style={{
                  background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.08)',
                  color: 'var(--accent)',
                }}
              >
                {z}
              </span>
            ))}
          </div>
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

  const isDark = theme === 'dark';
  const lang = i18n.language;

  const filteredZones = filter === 'all'
    ? ZONE_CAMERA_MAP
    : ZONE_CAMERA_MAP.filter(z => z.type === filter);

  const tabs = [
    { key: 'zones', label: lang === 'ru' ? '🗺️ Камеры по зонам' : '🗺️ Cameras by Zone' },
    { key: 'all', label: lang === 'ru' ? '📹 Все камеры' : '📹 All Cameras' },
  ];

  const filters = [
    { key: 'all', label: 'Все' },
    { key: 'entry', label: '🚪 Въезд/Выезд' },
    { key: 'lift', label: '🔧 Подъёмники' },
    { key: 'diag', label: '🔍 Диагностика' },
    { key: 'parking', label: '🅿️ Парковка' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {lang === 'ru' ? 'Камеры' : 'Cameras'}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            📹 {ALL_CAMERAS.length} камер
          </span>
          <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
            📍 {ZONE_CAMERA_MAP.length} зон
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
              <ZoneCameraCard key={i} zone={zone} isDark={isDark} />
            ))}
          </div>
        </div>
      )}

      {/* Tab: All Cameras */}
      {tab === 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ALL_CAMERAS.map((cam, i) => (
            <AllCamerasCard key={i} cam={cam} isDark={isDark} />
          ))}
        </div>
      )}
    </div>
  );
}
