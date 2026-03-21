import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { DoorOpen, Wrench, Search, ParkingCircle, Camera, ArrowLeft } from 'lucide-react';

// Все зоны СТО (каждый подъёмник, въезд, выезд, парковка — отдельная зона)
const DEFAULT_ZONES = [
  { id: 'entry', name: 'Въезд', type: 'entry' },
  { id: 'exit', name: 'Выезд', type: 'exit' },
  { id: 'post-1', name: 'Пост 1', type: 'lift', description: '2-х ст. <2.5т' },
  { id: 'post-2', name: 'Пост 2', type: 'lift', description: '2-х ст. <2.5т' },
  { id: 'post-3', name: 'Пост 3', type: 'lift', description: '2-х ст. <2.5т' },
  { id: 'post-4', name: 'Пост 4', type: 'lift', description: '2-х ст. >2.5т (грузовой)' },
  { id: 'post-5', name: 'Пост 5', type: 'lift', description: '2-х ст. <2.5т' },
  { id: 'post-6', name: 'Пост 6', type: 'lift', description: '2-х ст. <2.5т' },
  { id: 'post-7', name: 'Пост 7', type: 'lift', description: '2-х ст. <2.5т' },
  { id: 'post-8', name: 'Пост 8', type: 'lift', description: '2-х ст. <2.5т' },
  { id: 'post-9', name: 'Пост 9', type: 'diag', description: 'Диагностика' },
  { id: 'post-10', name: 'Пост 10', type: 'diag', description: 'Диагностика' },
  { id: 'parking', name: 'Парковка / Ожидание', type: 'parking' },
];

const DEFAULT_CAMERAS = [
  { id: 'cam-01', num: '01' },
  { id: 'cam-02', num: '02' },
  { id: 'cam-03', num: '03' },
  { id: 'cam-04', num: '04' },
  { id: 'cam-05', num: '05' },
  { id: 'cam-06', num: '06' },
  { id: 'cam-07', num: '07' },
  { id: 'cam-08', num: '08' },
  { id: 'cam-09', num: '09' },
  { id: 'cam-10', num: '10' },
];

const camLabel = (num, isRu) => (isRu ? 'КАМ' : 'CAM') + num;

// Начальная привязка камер к зонам { zoneId: { camId: priority } }
const DEFAULT_MAPPING = {
  'entry':   { 'cam-09': 10 },
  'exit':    { 'cam-09': 10 },
  'post-1':  { 'cam-01': 10, 'cam-03': 5 },
  'post-2':  { 'cam-01': 8, 'cam-03': 10 },
  'post-3':  { 'cam-03': 5, 'cam-04': 10 },
  'post-4':  { 'cam-04': 8, 'cam-06': 5 },
  'post-5':  { 'cam-02': 10, 'cam-05': 5 },
  'post-6':  { 'cam-02': 8, 'cam-05': 10 },
  'post-7':  { 'cam-05': 5, 'cam-06': 10 },
  'post-8':  { 'cam-06': 8, 'cam-07': 5 },
  'post-9':  { 'cam-07': 10, 'cam-08': 5 },
  'post-10': { 'cam-08': 10, 'cam-10': 5 },
  'parking': { 'cam-09': 5, 'cam-01': 3 },
};

const TYPE_COLORS = {
  entry: '#10b981', exit: '#ef4444', lift: '#6366f1',
  diag: '#a855f7', parking: '#f59e0b',
};

const TYPE_ICONS_MAP = {
  entry: DoorOpen, exit: DoorOpen, lift: Wrench,
  diag: Search, parking: ParkingCircle,
};

function ZoneIcon({ type, size = 14 }) {
  const Icon = TYPE_ICONS_MAP[type] || Wrench;
  const color = TYPE_COLORS[type] || '#94a3b8';
  return <Icon size={size} style={{ color, flexShrink: 0 }} />;
}

const PRIORITY_OPTIONS = [
  { value: 10, label: 'Основная (P10)' },
  { value: 8, label: 'Высокий (P8)' },
  { value: 5, label: 'Средний (P5)' },
  { value: 3, label: 'Низкий (P3)' },
  { value: 1, label: 'Минимальный (P1)' },
];

export default function CameraMapping() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const lang = i18n.language;

  // State: mapping data (persisted in localStorage for now)
  const [mapping, setMapping] = useState(() => {
    const saved = localStorage.getItem('cameraMappingData');
    return saved ? JSON.parse(saved) : DEFAULT_MAPPING;
  });
  const [selectedZone, setSelectedZone] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const saveMapping = () => {
    localStorage.setItem('cameraMappingData', JSON.stringify(mapping));
    setHasChanges(false);
  };

  const resetMapping = () => {
    setMapping(DEFAULT_MAPPING);
    localStorage.setItem('cameraMappingData', JSON.stringify(DEFAULT_MAPPING));
    setHasChanges(false);
  };

  const toggleCamera = (zoneId, camId) => {
    setMapping(prev => {
      const zone = { ...(prev[zoneId] || {}) };
      if (zone[camId]) {
        delete zone[camId];
      } else {
        zone[camId] = 5; // default priority
      }
      setHasChanges(true);
      return { ...prev, [zoneId]: zone };
    });
  };

  const setPriority = (zoneId, camId, priority) => {
    setMapping(prev => {
      const zone = { ...(prev[zoneId] || {}) };
      zone[camId] = priority;
      setHasChanges(true);
      return { ...prev, [zoneId]: zone };
    });
  };

  const getZoneCameras = (zoneId) => mapping[zoneId] || {};
  const getCameraZones = (camId) => {
    const zones = [];
    for (const [zoneId, cams] of Object.entries(mapping)) {
      if (cams[camId]) {
        const zone = DEFAULT_ZONES.find(z => z.id === zoneId);
        zones.push({ zone, priority: cams[camId] });
      }
    }
    return zones;
  };

  // Stats
  const totalLinks = Object.values(mapping).reduce((s, z) => s + Object.keys(z).length, 0);
  const unmappedZones = DEFAULT_ZONES.filter(z => !mapping[z.id] || Object.keys(mapping[z.id]).length === 0);
  const unmappedCameras = DEFAULT_CAMERAS.filter(c => getCameraZones(c.id).length === 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {lang === 'ru' ? 'Разметка камер' : 'Camera Mapping'}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru'
              ? 'Привязка камер к зонам СТО с настройкой приоритетов'
              : 'Link cameras to STO zones with priority settings'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              {lang === 'ru' ? 'Есть изменения' : 'Unsaved changes'}
            </span>
          )}
          <button
            onClick={resetMapping}
            className="px-3 py-1.5 rounded-xl text-xs transition-all hover:opacity-80"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border-glass)' }}
          >
            {lang === 'ru' ? 'Сбросить' : 'Reset'}
          </button>
          <button
            onClick={saveMapping}
            className="px-4 py-1.5 rounded-xl text-xs font-medium text-white transition-all hover:opacity-90"
            style={{ background: hasChanges ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            {lang === 'ru' ? 'Сохранить' : 'Save'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-4">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lang === 'ru' ? 'Зон' : 'Zones'}</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{DEFAULT_ZONES.length}</p>
        </div>
        <div className="glass p-4">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lang === 'ru' ? 'Камер' : 'Cameras'}</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{DEFAULT_CAMERAS.length}</p>
        </div>
        <div className="glass p-4">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lang === 'ru' ? 'Привязок' : 'Links'}</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{totalLinks}</p>
        </div>
        <div className="glass p-4">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lang === 'ru' ? 'Без камер' : 'Unmapped'}</p>
          <p className="text-2xl font-bold" style={{ color: unmappedZones.length > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {unmappedZones.length}
          </p>
        </div>
      </div>

      {/* Warnings */}
      {(unmappedZones.length > 0 || unmappedCameras.length > 0) && (
        <div className="glass-static p-4 space-y-2" style={{ borderLeft: '3px solid var(--warning)' }}>
          {unmappedZones.length > 0 && (
            <p className="text-sm" style={{ color: 'var(--warning)' }}>
              ⚠️ {lang === 'ru' ? 'Зоны без камер:' : 'Zones without cameras:'} {unmappedZones.map(z => z.name).join(', ')}
            </p>
          )}
          {unmappedCameras.length > 0 && (
            <p className="text-sm" style={{ color: 'var(--warning)' }}>
              ⚠️ {lang === 'ru' ? 'Камеры без привязки:' : 'Unlinked cameras:'} {unmappedCameras.map(c => c.name).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Main grid: Zones on left, Editor on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Zones list */}
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {lang === 'ru' ? 'Зоны СТО' : 'STO Zones'}
          </h3>
          {DEFAULT_ZONES.map(zone => {
            const color = TYPE_COLORS[zone.type] || '#94a3b8';
            const cams = getZoneCameras(zone.id);
            const camCount = Object.keys(cams).length;
            const isSelected = selectedZone?.id === zone.id;

            return (
              <button
                key={zone.id}
                onClick={() => setSelectedZone(zone)}
                className="w-full text-left p-3 rounded-xl transition-all"
                style={{
                  background: isSelected ? color + '15' : 'var(--bg-glass)',
                  border: `1px solid ${isSelected ? color : 'var(--border-glass)'}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ZoneIcon type={zone.type} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {zone.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: camCount > 0 ? color : 'var(--danger)' }}>
                      {camCount}
                    </span>
                  </div>
                </div>
                {zone.description && (
                  <p className="text-xs mt-1 ml-6" style={{ color: 'var(--text-muted)' }}>{zone.description}</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {selectedZone ? (
            <div className="glass-static p-5 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">{selectedZone.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {selectedZone.name}
                  </h3>
                  {selectedZone.description && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedZone.description}</p>
                  )}
                </div>
              </div>

              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {lang === 'ru'
                  ? 'Выберите камеры, которые видят эту зону, и настройте приоритет:'
                  : 'Select cameras that cover this zone and set priority:'}
              </p>

              {/* Camera toggle grid */}
              <div className="space-y-2">
                {DEFAULT_CAMERAS.map(cam => {
                  const zoneCams = getZoneCameras(selectedZone.id);
                  const isLinked = !!zoneCams[cam.id];
                  const priority = zoneCams[cam.id] || 0;
                  const color = TYPE_COLORS[selectedZone.type] || '#6366f1';
                  const camZones = getCameraZones(cam.id).filter(z => z.zone.id !== selectedZone.id);

                  return (
                    <div
                      key={cam.id}
                      className="p-3 rounded-xl transition-all"
                      style={{
                        background: isLinked
                          ? (isDark ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.8)')
                          : (isDark ? 'rgba(15,23,42,0.4)' : 'rgba(240,244,248,0.5)'),
                        border: `1px solid ${isLinked ? color + '40' : 'var(--border-glass)'}`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Toggle */}
                          <button
                            onClick={() => toggleCamera(selectedZone.id, cam.id)}
                            className="w-10 h-6 rounded-full transition-all relative"
                            style={{
                              background: isLinked ? color : (isDark ? '#334155' : '#cbd5e1'),
                            }}
                          >
                            <span
                              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                              style={{ left: isLinked ? '18px' : '2px' }}
                            />
                          </button>

                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            <Camera size={12} style={{ flexShrink: 0 }} /> {camLabel(cam.num, lang === 'ru')}
                          </span>

                          {/* Other zones this camera covers */}
                          {camZones.length > 0 && (
                            <div className="flex gap-1 ml-2">
                              {camZones.map(({ zone: z }) => (
                                <span
                                  key={z.id}
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    background: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.05)',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  {z.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Priority selector */}
                        {isLinked && (
                          <select
                            value={priority}
                            onChange={e => setPriority(selectedZone.id, cam.id, parseInt(e.target.value))}
                            className="text-xs px-2 py-1 rounded-lg outline-none cursor-pointer"
                            style={{
                              background: isDark ? '#1e293b' : '#f1f5f9',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-glass)',
                            }}
                          >
                            {PRIORITY_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="glass-static p-12 text-center">
              <ArrowLeft size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru'
                  ? 'Выберите зону слева для настройки привязки камер'
                  : 'Select a zone on the left to configure camera mapping'}
              </p>
            </div>
          )}

          {/* Matrix view */}
          <div className="glass-static p-5 mt-6 overflow-x-auto">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              {lang === 'ru' ? 'Матрица покрытия' : 'Coverage Matrix'}
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1.5" style={{ color: 'var(--text-muted)' }}>
                    {lang === 'ru' ? 'Зона / Камера' : 'Zone / Camera'}
                  </th>
                  {DEFAULT_CAMERAS.map(c => (
                    <th key={c.id} className="px-2 py-1.5 text-center" style={{ color: 'var(--text-muted)' }}>
                      {camLabel(c.num, lang === 'ru')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEFAULT_ZONES.map(zone => {
                  const cams = getZoneCameras(zone.id);
                  const color = TYPE_COLORS[zone.type] || '#94a3b8';
                  return (
                    <tr
                      key={zone.id}
                      style={{ borderTop: '1px solid var(--border-glass)' }}
                      className="cursor-pointer hover:opacity-80"
                      onClick={() => setSelectedZone(zone)}
                    >
                      <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        <ZoneIcon type={zone.type} size={12} /> {zone.name}
                      </td>
                      {DEFAULT_CAMERAS.map(cam => {
                        const prio = cams[cam.id];
                        return (
                          <td key={cam.id} className="px-2 py-1.5 text-center">
                            {prio ? (
                              <span
                                className="inline-block w-7 h-7 leading-7 rounded-lg text-white font-bold"
                                style={{
                                  background: color,
                                  opacity: prio >= 8 ? 1 : prio >= 5 ? 0.6 : 0.3,
                                }}
                              >
                                {prio}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--border-glass)' }}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
