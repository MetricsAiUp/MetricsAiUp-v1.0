import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { getProjection, getZones2d, saveZones2d } from '../../api/client';
import { getSnapshotUrl } from '../../api/streaming';

// Editable rectangle zone on SVG
function EditableZone({ zone, scale, selected, onSelect, onChange, onDelete }) {
  const startRef = useRef(null);

  const { x, y, w, h } = zone.rect;
  const handleSize = 14 / scale;
  const edgeWidth = 6 / scale;
  const corners = [
    { key: 'tl', cx: x, cy: y, cursor: 'nwse-resize' },
    { key: 'tr', cx: x + w, cy: y, cursor: 'nesw-resize' },
    { key: 'bl', cx: x, cy: y + h, cursor: 'nesw-resize' },
    { key: 'br', cx: x + w, cy: y + h, cursor: 'nwse-resize' },
  ];
  const edges = [
    { key: 't', cx: x + w / 2, cy: y, ew: w * 0.6, eh: edgeWidth, cursor: 'ns-resize' },
    { key: 'b', cx: x + w / 2, cy: y + h, ew: w * 0.6, eh: edgeWidth, cursor: 'ns-resize' },
    { key: 'l', cx: x, cy: y + h / 2, ew: edgeWidth, eh: h * 0.6, cursor: 'ew-resize' },
    { key: 'r', cx: x + w, cy: y + h / 2, ew: edgeWidth, eh: h * 0.6, cursor: 'ew-resize' },
  ];

  const onPointerDown = (e, type) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(zone.zoneId);
    const svg = e.target.closest('svg');
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    startRef.current = { sx: svgPt.x, sy: svgPt.y, rect: { ...zone.rect } };

    const onMove = (ev) => {
      const mpt = svg.createSVGPoint();
      mpt.x = ev.clientX; mpt.y = ev.clientY;
      const mp = mpt.matrixTransform(svg.getScreenCTM().inverse());
      const dx = mp.x - startRef.current.sx;
      const dy = mp.y - startRef.current.sy;
      const r = startRef.current.rect;

      let newRect;
      if (type === 'move') {
        newRect = { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h };
      } else {
        let nx = r.x, ny = r.y, nw = r.w, nh = r.h;
        if (type === 'l' || type.includes('l')) { nx = r.x + dx; nw = r.w - dx; }
        if (type === 'r' || type.includes('r')) { nw = r.w + dx; }
        if (type === 't' || type.includes('t')) { ny = r.y + dy; nh = r.h - dy; }
        if (type === 'b' || type.includes('b')) { nh = r.h + dy; }
        if (nw < 10) { nw = 10; if (type === 'l' || type.includes('l')) nx = r.x + r.w - 10; }
        if (nh < 10) { nh = 10; if (type === 't' || type.includes('t')) ny = r.y + r.h - 10; }
        newRect = { x: nx, y: ny, w: nw, h: nh };
      }
      onChange(zone.zoneId, newRect);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <g>
      <rect
        x={x} y={y} width={Math.max(w, 0)} height={Math.max(h, 0)}
        fill={zone.color || '#22c55e'}
        fillOpacity={selected ? 0.25 : 0.12}
        stroke={zone.color || '#22c55e'}
        strokeWidth={selected ? 2.5 / scale : 1.5 / scale}
        style={{ cursor: 'move' }}
        onPointerDown={(e) => onPointerDown(e, 'move')}
      />
      {/* Zone name label */}
      <text
        x={x + 4 / scale} y={y + 14 / scale}
        fill="#fff"
        fontSize={12 / scale}
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
        style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        {zone.zoneName}
      </text>
      {/* Edge resize handles */}
      {selected && edges.map(e => (
        <rect
          key={e.key}
          x={e.cx - e.ew / 2}
          y={e.cy - e.eh / 2}
          width={e.ew}
          height={e.eh}
          fill="#22c55e"
          fillOpacity={0.5}
          stroke="none"
          style={{ cursor: e.cursor }}
          onPointerDown={(ev) => onPointerDown(ev, e.key)}
        />
      ))}
      {/* Corner resize handles */}
      {selected && corners.map(c => (
        <rect
          key={c.key}
          x={c.cx - handleSize / 2}
          y={c.cy - handleSize / 2}
          width={handleSize}
          height={handleSize}
          fill="#22c55e"
          stroke="#fff"
          strokeWidth={1.5 / scale}
          rx={2 / scale}
          style={{ cursor: c.cursor }}
          onPointerDown={(e) => onPointerDown(e, c.key)}
        />
      ))}
    </g>
  );
}

export default function ZoneOverlayModal({ camera, roomId, onClose }) {
  const { currentRoom } = useStore();
  const [zones, setZones] = useState([]);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [frameUrl, setFrameUrl] = useState(null);
  const [hasCustom, setHasCustom] = useState(false);
  const [drawing, setDrawing] = useState(false); // drawing new zone mode
  const [drawStart, setDrawStart] = useState(null);
  const [drawRect, setDrawRect] = useState(null);
  const [newZoneName, setNewZoneName] = useState('');
  const svgRef = useRef();

  const resolution = camera.resolution || { width: 1920, height: 1080 };

  const [frameStatus, setFrameStatus] = useState('idle'); // idle | loading | done | error

  // Capture frame: server-side FFmpeg snapshot (single JPEG from RTSP, no HLS needed)
  const captureFrame = useCallback(async () => {
    if (!camera.rtspCameraId) return;
    setFrameStatus('loading');
    try {
      const url = getSnapshotUrl(camera.rtspCameraId);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Snapshot failed: ${resp.status}`);
      const blob = await resp.blob();
      setFrameUrl(URL.createObjectURL(blob));
      setFrameStatus('done');
    } catch (err) {
      console.warn('Frame capture failed:', err);
      setFrameStatus('error');
    }
  }, [camera.rtspCameraId]);

  // Load zones
  const loadZones = useCallback(async (forceProjection = false) => {
    setLoading(true);
    try {
      let custom = null;
      if (!forceProjection) {
        custom = await getZones2d(roomId, camera.id);
      }

      if (custom && custom.length > 0) {
        setZones(custom);
        setHasCustom(true);
      } else {
        const proj = await getProjection(roomId, camera.id);
        const projected = (proj.projections || [])
          .filter(p => p.visible && p.polygon.length >= 3)
          .map(p => {
            const xs = p.polygon.map(pt => pt[0]);
            const ys = p.polygon.map(pt => pt[1]);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            return {
              zoneId: p.zoneId,
              zoneName: p.zoneName,
              color: p.color || '#22c55e',
              rect: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
            };
          });
        setZones(projected);
        setHasCustom(false);
      }
    } catch (err) {
      console.error('Failed to load zones:', err);
    }
    setLoading(false);
  }, [roomId, camera.id]);

  useEffect(() => {
    loadZones();
    captureFrame();
  }, [loadZones, captureFrame]);

  const handleZoneChange = (zoneId, newRect) => {
    setZones(prev => prev.map(z => z.zoneId === zoneId ? { ...z, rect: newRect } : z));
    setHasCustom(true);
  };

  const handleDeleteZone = (zoneId) => {
    setZones(prev => prev.filter(z => z.zoneId !== zoneId));
    if (selectedZoneId === zoneId) setSelectedZoneId(null);
    setHasCustom(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveZones2d(roomId, camera.id, zones);
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
  };

  const handleRecalculate = () => {
    loadZones(true);
  };

  // --- Drawing new zone ---
  const svgPointFromEvent = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  const handleSvgPointerDown = (e) => {
    if (!drawing) {
      setSelectedZoneId(null);
      return;
    }
    e.preventDefault();
    const pt = svgPointFromEvent(e);
    if (!pt) return;
    setDrawStart({ x: pt.x, y: pt.y });
    setDrawRect(null);
  };

  const handleSvgPointerMove = (e) => {
    if (!drawing || !drawStart) return;
    const pt = svgPointFromEvent(e);
    if (!pt) return;
    const x = Math.min(drawStart.x, pt.x);
    const y = Math.min(drawStart.y, pt.y);
    const w = Math.abs(pt.x - drawStart.x);
    const h = Math.abs(pt.y - drawStart.y);
    setDrawRect({ x, y, w, h });
  };

  const handleSvgPointerUp = () => {
    if (!drawing || !drawRect || drawRect.w < 5 || drawRect.h < 5) {
      setDrawStart(null);
      setDrawRect(null);
      return;
    }
    // Create the new zone
    const name = newZoneName.trim() || `Zone ${zones.length + 1}`;
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
    const color = colors[zones.length % colors.length];
    const newZone = {
      zoneId: `custom_${Date.now()}`,
      zoneName: name,
      color,
      rect: { ...drawRect },
    };
    setZones(prev => [...prev, newZone]);
    setHasCustom(true);
    setDrawStart(null);
    setDrawRect(null);
    setDrawing(false);
    setNewZoneName('');
    setSelectedZoneId(newZone.zoneId);
  };

  const handleRenameZone = (zoneId, newName) => {
    setZones(prev => prev.map(z => z.zoneId === zoneId ? { ...z, zoneName: newName } : z));
    setHasCustom(true);
  };

  // SVG scaling
  const maxW = 900, maxH = 560;
  const scale = Math.min(maxW / resolution.width, maxH / resolution.height);
  const svgW = resolution.width * scale;
  const svgH = resolution.height * scale;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-slate-900 rounded-lg border border-slate-600 shadow-2xl overflow-hidden"
        style={{ width: svgW + 250 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div>
            <h3 className="text-sm font-semibold text-white">Zone overlay — {camera.name}</h3>
            <span className="text-xs text-slate-400">
              {resolution.width}x{resolution.height}
              {hasCustom && <span className="text-yellow-400 ml-2">(custom)</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRecalculate}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-cyan-400 px-3 py-1 rounded"
            >
              Recalculate from 3D
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none ml-2">&times;</button>
          </div>
        </div>

        {/* Canvas + sidebar */}
        <div className="p-4 flex gap-4">
          <div className="relative" style={{ width: svgW, height: svgH, cursor: drawing ? 'crosshair' : 'default' }}>
            {/* Camera frame background */}
            {frameUrl && (
              <img
                src={frameUrl}
                alt="Camera frame"
                className="absolute inset-0 w-full h-full object-cover rounded"
                style={{ opacity: 0.7 }}
              />
            )}
            {!frameUrl && (
              <div className="absolute inset-0 bg-slate-800 rounded flex items-center justify-center">
                {frameStatus === 'loading' && (
                  <div className="text-center">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <div className="text-xs text-slate-400">Starting stream and capturing frame...</div>
                  </div>
                )}
                {frameStatus === 'error' && (
                  <div className="text-center">
                    <div className="text-xs text-red-400 mb-2">Failed to capture frame</div>
                    <button onClick={captureFrame} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded">
                      Retry
                    </button>
                  </div>
                )}
                {(frameStatus === 'idle' && !camera.rtspCameraId) && (
                  <div className="text-xs text-slate-500">No RTSP camera linked</div>
                )}
              </div>
            )}

            {/* SVG overlay */}
            <svg
              ref={svgRef}
              className="absolute inset-0"
              width={svgW}
              height={svgH}
              viewBox={`0 0 ${resolution.width} ${resolution.height}`}
              onPointerDown={handleSvgPointerDown}
              onPointerMove={handleSvgPointerMove}
              onPointerUp={handleSvgPointerUp}
            >
              <rect
                x={0} y={0}
                width={resolution.width} height={resolution.height}
                fill="none"
                stroke="#475569"
                strokeWidth={2 / scale}
              />
              <line x1={resolution.width / 2} y1={0} x2={resolution.width / 2} y2={resolution.height} stroke="#334155" strokeWidth={1 / scale} strokeDasharray={`${4 / scale}`} />
              <line x1={0} y1={resolution.height / 2} x2={resolution.width} y2={resolution.height / 2} stroke="#334155" strokeWidth={1 / scale} strokeDasharray={`${4 / scale}`} />

              {loading ? (
                <text x={resolution.width / 2} y={resolution.height / 2} fill="#94a3b8" fontSize={16 / scale} textAnchor="middle">Loading zones...</text>
              ) : (
                zones.map(z => (
                  <EditableZone
                    key={z.zoneId}
                    zone={z}
                    scale={scale}
                    selected={z.zoneId === selectedZoneId}
                    onSelect={setSelectedZoneId}
                    onChange={handleZoneChange}
                    onDelete={handleDeleteZone}
                  />
                ))
              )}

              {/* Drawing preview */}
              {drawRect && (
                <rect
                  x={drawRect.x} y={drawRect.y}
                  width={drawRect.w} height={drawRect.h}
                  fill="#22c55e"
                  fillOpacity={0.2}
                  stroke="#22c55e"
                  strokeWidth={2 / scale}
                  strokeDasharray={`${4 / scale}`}
                />
              )}
            </svg>

            {/* Drawing mode banner */}
            {drawing && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-green-800/90 text-green-200 text-xs px-3 py-1.5 rounded-full">
                Draw a rectangle to create a zone
              </div>
            )}
          </div>

          {/* Zone list sidebar */}
          <div className="w-52 min-w-52 flex flex-col" style={{ maxHeight: svgH }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Zones ({zones.length})</div>
              {!drawing ? (
                <button
                  onClick={() => setDrawing(true)}
                  className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-0.5 rounded"
                >
                  + Add
                </button>
              ) : (
                <button
                  onClick={() => { setDrawing(false); setDrawStart(null); setDrawRect(null); }}
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-0.5 rounded"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* New zone name input (shown when drawing) */}
            {drawing && (
              <input
                type="text"
                placeholder="Zone name..."
                value={newZoneName}
                onChange={e => setNewZoneName(e.target.value)}
                className="mb-2 w-full bg-slate-800 border border-green-600 rounded px-2 py-1 text-xs text-slate-200"
                autoFocus
              />
            )}

            <div className="space-y-1 overflow-y-auto flex-1">
              {zones.map(z => (
                <div
                  key={z.zoneId}
                  onClick={() => setSelectedZoneId(z.zoneId === selectedZoneId ? null : z.zoneId)}
                  className={`p-2 rounded cursor-pointer text-xs group ${
                    z.zoneId === selectedZoneId
                      ? 'bg-green-900/50 border border-green-600'
                      : 'bg-slate-800 hover:bg-slate-750 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: z.color }} />
                      {z.zoneId === selectedZoneId ? (
                        <input
                          type="text"
                          value={z.zoneName}
                          onChange={e => { e.stopPropagation(); handleRenameZone(z.zoneId, e.target.value); }}
                          onClick={e => e.stopPropagation()}
                          className="bg-slate-700 border-none rounded px-1 py-0 text-xs text-slate-200 w-full"
                        />
                      ) : (
                        <span className="text-slate-200 truncate">{z.zoneName}</span>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteZone(z.zoneId); }}
                      className="text-red-500 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0"
                    >
                      Del
                    </button>
                  </div>
                  <div className="text-slate-500 mt-0.5 ml-4">
                    {Math.round(z.rect.w)}x{Math.round(z.rect.h)}
                  </div>
                </div>
              ))}
              {zones.length === 0 && !loading && (
                <div className="text-xs text-slate-500 py-2">No zones yet. Click "+ Add" to draw one.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
