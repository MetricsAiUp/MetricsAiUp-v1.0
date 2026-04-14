import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { DoorOpen, Wrench, Search, ParkingCircle, Camera, ArrowLeft, Warehouse } from 'lucide-react';
import HelpButton from '../components/HelpButton';

const DEFAULT_ZONES = [
  { id: 'barrier', name: { ru: 'Шлагбаум', en: 'Barrier' }, type: 'entry' },
  { id: 'parking', name: { ru: 'Стоянка', en: 'Parking' }, type: 'parking' },
  { id: 'gates', name: { ru: 'Ворота', en: 'Gates' }, type: 'entry' },
  { id: 'post-1', name: { ru: 'Пост 1', en: 'Post 1' }, type: 'lift' },
  { id: 'post-2', name: { ru: 'Пост 2', en: 'Post 2' }, type: 'lift' },
  { id: 'post-3', name: { ru: 'Пост 3', en: 'Post 3' }, type: 'lift' },
  { id: 'post-4', name: { ru: 'Пост 4', en: 'Post 4' }, type: 'lift' },
  { id: 'post-5', name: { ru: 'Пост 5', en: 'Post 5' }, type: 'lift' },
  { id: 'post-6', name: { ru: 'Пост 6', en: 'Post 6' }, type: 'lift' },
  { id: 'post-7', name: { ru: 'Пост 7', en: 'Post 7' }, type: 'lift' },
  { id: 'post-8', name: { ru: 'Пост 8', en: 'Post 8' }, type: 'lift' },
  { id: 'post-9', name: { ru: 'Пост 9', en: 'Post 9' }, type: 'lift' },
  { id: 'post-10', name: { ru: 'Пост 10', en: 'Post 10' }, type: 'lift' },
  { id: 'zone-01', name: { ru: 'Зона 01', en: 'Zone 01' }, type: 'parking' },
  { id: 'zone-03', name: { ru: 'Зона 03', en: 'Zone 03' }, type: 'parking' },
  { id: 'zone-04', name: { ru: 'Зона 04', en: 'Zone 04' }, type: 'parking' },
  { id: 'zone-05', name: { ru: 'Зона 05', en: 'Zone 05' }, type: 'parking' },
  { id: 'zone-06', name: { ru: 'Зона 06', en: 'Zone 06' }, type: 'parking' },
  { id: 'zone-07', name: { ru: 'Зона 07', en: 'Zone 07' }, type: 'parking' },
  { id: 'intake-warehouse', name: { ru: 'Склад приёмки', en: 'Intake warehouse' }, type: 'warehouse' },
  { id: 'parts-warehouse', name: { ru: 'Склад деталей', en: 'Parts warehouse' }, type: 'warehouse' },
];

const zn = (zone, isRu) => typeof zone.name === 'string' ? zone.name : zone.name[isRu ? 'ru' : 'en'];
const zd = (zone, isRu) => zone.desc ? zone.desc[isRu ? 'ru' : 'en'] : '';

const DEFAULT_CAMERAS = Array.from({ length: 16 }, (_, i) => ({ id: `cam-${String(i).padStart(2,'0')}`, num: String(i).padStart(2,'0') }));
const camLabel = (num, isRu) => (isRu ? 'КАМ' : 'CAM') + num;

const DEFAULT_MAPPING = {
  'barrier':          { 'cam-00': 10 },
  'parking':          { 'cam-01': 10 },
  'gates':            { 'cam-02': 10 },
  'post-1':           { 'cam-12': 10, 'cam-11': 5 },
  'post-2':           { 'cam-12': 8, 'cam-11': 10 },
  'post-3':           { 'cam-14': 10 },
  'post-4':           { 'cam-14': 8, 'cam-13': 10 },
  'post-5':           { 'cam-13': 10, 'cam-08': 8, 'cam-09': 5 },
  'post-6':           { 'cam-08': 10 },
  'post-7':           { 'cam-03': 10, 'cam-04': 8, 'cam-02': 5 },
  'post-8':           { 'cam-04': 10, 'cam-03': 8, 'cam-02': 5 },
  'post-9':           { 'cam-04': 10, 'cam-05': 8 },
  'post-10':          { 'cam-05': 10 },
  'zone-01':          { 'cam-15': 10 },
  'zone-03':          { 'cam-14': 5 },
  'zone-04':          { 'cam-10': 10, 'cam-11': 8 },
  'zone-05':          { 'cam-10': 10, 'cam-08': 5 },
  'zone-06':          { 'cam-09': 10, 'cam-08': 8, 'cam-10': 5 },
  'zone-07':          { 'cam-05': 5 },
  'intake-warehouse': { 'cam-06': 10 },
  'parts-warehouse':  { 'cam-07': 10 },
};

const TYPE_COLORS = { entry: '#10b981', exit: '#ef4444', lift: '#6366f1', diag: '#a855f7', parking: '#f59e0b', warehouse: '#64748b' };
const TYPE_ICONS_MAP = { entry: DoorOpen, exit: DoorOpen, lift: Wrench, diag: Search, parking: ParkingCircle, warehouse: Warehouse };

function ZoneIcon({ type, size = 12 }) {
  const Icon = TYPE_ICONS_MAP[type] || Wrench;
  return <Icon size={size} style={{ color: TYPE_COLORS[type] || '#94a3b8', flexShrink: 0 }} />;
}

const PRIORITY_OPTIONS = [
  { value: 10, label: 'P10' },
  { value: 8, label: 'P8' },
  { value: 5, label: 'P5' },
  { value: 3, label: 'P3' },
  { value: 1, label: 'P1' },
];

export default function CameraMapping() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRu = i18n.language === 'ru';

  const [mapping, setMapping] = useState(() => {
    try {
      const saved = localStorage.getItem('cameraMappingData');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).some(k => k in DEFAULT_MAPPING)) return parsed;
      }
    } catch {}
    return JSON.parse(JSON.stringify(DEFAULT_MAPPING));
  });
  const [selectedZone, setSelectedZone] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const saveMapping = () => { localStorage.setItem('cameraMappingData', JSON.stringify(mapping)); setHasChanges(false); };
  const resetMapping = () => { localStorage.removeItem('cameraMappingData'); setMapping(JSON.parse(JSON.stringify(DEFAULT_MAPPING))); setSelectedZone(null); setHasChanges(false); };

  const toggleCamera = (zoneId, camId) => {
    setMapping(prev => {
      const zone = { ...(prev[zoneId] || {}) };
      if (zone[camId]) delete zone[camId]; else zone[camId] = 5;
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
      if (cams[camId]) { const zone = DEFAULT_ZONES.find(z => z.id === zoneId); zones.push({ zone, priority: cams[camId] }); }
    }
    return zones;
  };

  const totalLinks = Object.values(mapping).reduce((s, z) => s + Object.keys(z).length, 0);
  const unmappedZones = DEFAULT_ZONES.filter(z => !mapping[z.id] || Object.keys(mapping[z.id]).length === 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {isRu ? 'Разметка камер' : 'Camera Mapping'}
          </h2>
          <HelpButton pageKey="cameraMapping" />
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              {isRu ? 'Изменения' : 'Changed'}
            </span>
          )}
          <button onClick={resetMapping} className="px-2 py-1 rounded-lg text-xs hover:opacity-80"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border-glass)' }}>
            {isRu ? 'Сброс' : 'Reset'}
          </button>
          <button onClick={saveMapping} className="px-2.5 py-1 rounded-lg text-xs font-medium text-white hover:opacity-90"
            style={{ background: hasChanges ? 'var(--accent)' : 'var(--text-muted)' }}>
            {isRu ? 'Сохранить' : 'Save'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <StatPill label={isRu ? 'Зон' : 'Zones'} value={DEFAULT_ZONES.length} color="var(--accent)" />
        <StatPill label={isRu ? 'Камер' : 'Cameras'} value={DEFAULT_CAMERAS.length} color="var(--accent)" />
        <StatPill label={isRu ? 'Привязок' : 'Links'} value={totalLinks} color="var(--success)" />
        <StatPill label={isRu ? 'Без камер' : 'No cam'} value={unmappedZones.length} color={unmappedZones.length > 0 ? 'var(--danger)' : 'var(--success)'} />
      </div>

      {/* Main: zones + editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Zones list */}
        <div className="lg:col-span-1">
          <div className="glass rounded-xl overflow-hidden">
            {DEFAULT_ZONES.map((zone, i) => {
              const color = TYPE_COLORS[zone.type] || '#94a3b8';
              const camCount = Object.keys(getZoneCameras(zone.id)).length;
              const isSelected = selectedZone?.id === zone.id;
              return (
                <button key={zone.id} onClick={() => setSelectedZone(zone)}
                  className="w-full text-left px-3 py-2 flex items-center justify-between transition-all hover:opacity-80"
                  style={{
                    background: isSelected ? color + '12' : 'transparent',
                    borderBottom: i < DEFAULT_ZONES.length - 1 ? '1px solid var(--border-glass)' : 'none',
                    borderLeft: isSelected ? `3px solid ${color}` : '3px solid transparent',
                  }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <ZoneIcon type={zone.type} />
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{zn(zone, isRu)}</span>
                  </div>
                  <span className="text-[11px] font-bold flex-shrink-0 ml-2"
                    style={{ color: camCount > 0 ? color : 'var(--danger)' }}>
                    {camCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {selectedZone ? (
            <div className="glass rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <ZoneIcon type={selectedZone.type} size={16} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{zn(selectedZone, isRu)}</span>
                {selectedZone.desc && (
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>({zd(selectedZone, isRu)})</span>
                )}
              </div>

              <div className="space-y-1">
                {DEFAULT_CAMERAS.map(cam => {
                  const zoneCams = getZoneCameras(selectedZone.id);
                  const isLinked = !!zoneCams[cam.id];
                  const priority = zoneCams[cam.id] || 0;
                  const color = TYPE_COLORS[selectedZone.type] || '#6366f1';
                  const camZones = getCameraZones(cam.id).filter(z => z.zone.id !== selectedZone.id);

                  return (
                    <div key={cam.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                      style={{
                        background: isLinked ? color + '08' : 'transparent',
                        border: `1px solid ${isLinked ? color + '30' : 'var(--border-glass)'}`,
                      }}>
                      {/* Toggle */}
                      <button onClick={() => toggleCamera(selectedZone.id, cam.id)}
                        className="w-8 h-4 rounded-full transition-all relative flex-shrink-0"
                        style={{ background: isLinked ? color : (isDark ? '#334155' : '#cbd5e1') }}>
                        <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                          style={{ left: isLinked ? '17px' : '2px' }} />
                      </button>

                      <Camera size={11} style={{ color: isLinked ? color : 'var(--text-muted)', flexShrink: 0 }} />
                      <span className="text-xs font-medium" style={{ color: isLinked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {camLabel(cam.num, isRu)}
                      </span>

                      {/* Other zones */}
                      <div className="flex gap-1 flex-1 min-w-0">
                        {camZones.slice(0, 3).map(({ zone: z }) => (
                          <span key={z.id} className="text-[10px] px-1 py-px rounded truncate"
                            style={{ background: 'var(--bg-glass)', color: 'var(--text-muted)', maxWidth: 80 }}>
                            {zn(z, isRu)}
                          </span>
                        ))}
                      </div>

                      {/* Priority */}
                      {isLinked && (
                        <select value={priority} onChange={e => setPriority(selectedZone.id, cam.id, parseInt(e.target.value))}
                          className="text-[11px] px-1.5 py-0.5 rounded outline-none cursor-pointer flex-shrink-0"
                          style={{ background: isDark ? '#1e293b' : '#f1f5f9', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
                          {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="glass rounded-xl p-8 text-center">
              <ArrowLeft size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {isRu ? 'Выберите зону слева' : 'Select a zone on the left'}
              </p>
            </div>
          )}

          {/* Matrix */}
          <div className="glass rounded-xl p-3 mt-3 overflow-x-auto">
            <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {isRu ? 'Матрица покрытия' : 'Coverage Matrix'}
            </h3>
            <table className="w-full text-[11px]">
              <thead>
                <tr>
                  <th className="text-left px-1.5 py-1" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Зона' : 'Zone'}</th>
                  {DEFAULT_CAMERAS.map(c => (
                    <th key={c.id} className="px-1 py-1 text-center" style={{ color: 'var(--text-muted)' }}>{c.num}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEFAULT_ZONES.map(zone => {
                  const cams = getZoneCameras(zone.id);
                  const color = TYPE_COLORS[zone.type] || '#94a3b8';
                  return (
                    <tr key={zone.id} style={{ borderTop: '1px solid var(--border-glass)' }}
                      className="cursor-pointer hover:opacity-80" onClick={() => setSelectedZone(zone)}>
                      <td className="px-1.5 py-1 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        <div className="flex items-center gap-1">
                          <ZoneIcon type={zone.type} size={10} />
                          {zn(zone, isRu)}
                        </div>
                      </td>
                      {DEFAULT_CAMERAS.map(cam => {
                        const prio = cams[cam.id];
                        return (
                          <td key={cam.id} className="px-1 py-1 text-center">
                            {prio ? (
                              <span className="inline-block w-5 h-5 leading-5 rounded text-white text-[10px] font-bold"
                                style={{ background: color, opacity: prio >= 8 ? 1 : prio >= 5 ? 0.6 : 0.35 }}>
                                {prio}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--border-glass)' }}>-</span>
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

function StatPill({ label, value, color }) {
  return (
    <div className="glass px-3 py-1.5 flex items-center gap-2">
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}
