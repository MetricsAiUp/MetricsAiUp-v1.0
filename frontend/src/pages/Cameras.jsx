import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

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

function ZoneCameraCard({ zone, isDark, isRu }) {
  const color = TYPE_COLORS[zone.type] || '#94a3b8';
  const icon = TYPE_ICONS[zone.type] || '📍';

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
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
              className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{
                background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(240,244,248,0.8)',
                border: isMain ? `1px solid ${color}40` : '1px solid var(--border-glass)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs">📹</span>
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

function AllCamerasCard({ cam, isDark, isRu }) {
  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📹</span>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {camName(cam.num, isRu)}
          </span>
        </div>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#10b981' }} title="Online" />
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Расположение' : 'Location'}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{cam.loc[isRu ? 'ru' : 'en']}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Покрывает зоны:' : 'Covers zones:'}</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {cam.covers[isRu ? 'ru' : 'en'].split(', ').map(z => (
              <span key={z} className="px-1.5 py-0.5 rounded"
                style={{ background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.08)', color: 'var(--accent)' }}>
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
  const isRu = i18n.language === 'ru';

  const filteredZones = filter === 'all'
    ? ZONE_CAMERA_MAP
    : ZONE_CAMERA_MAP.filter(z => z.type === filter || (filter === 'entry' && z.type === 'exit'));

  const tabs = [
    { key: 'zones', label: isRu ? '🗺️ Камеры по зонам' : '🗺️ Cameras by Zone' },
    { key: 'all', label: isRu ? '📹 Все камеры' : '📹 All Cameras' },
  ];

  const filters = [
    { key: 'all', label: isRu ? 'Все' : 'All' },
    { key: 'entry', label: isRu ? '🚪 Въезд/Выезд' : '🚪 Entry/Exit' },
    { key: 'lift', label: isRu ? '🔧 Подъёмники' : '🔧 Lifts' },
    { key: 'diag', label: isRu ? '🔍 Диагностика' : '🔍 Diagnostics' },
    { key: 'parking', label: isRu ? '🅿️ Парковка' : '🅿️ Parking' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {isRu ? 'Камеры' : 'Cameras'}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            📹 {ALL_CAMERAS.length} {isRu ? 'камер' : 'cameras'}
          </span>
          <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
            📍 {ZONE_CAMERA_MAP.length} {isRu ? 'зон' : 'zones'}
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
              <ZoneCameraCard key={i} zone={zone} isDark={isDark} isRu={isRu} />
            ))}
          </div>
        </div>
      )}

      {/* Tab: All Cameras */}
      {tab === 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ALL_CAMERAS.map((cam, i) => (
            <AllCamerasCard key={i} cam={cam} isDark={isDark} isRu={isRu} />
          ))}
        </div>
      )}
    </div>
  );
}
