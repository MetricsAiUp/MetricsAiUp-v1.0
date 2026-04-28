import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { getSnapshotUrl } from '../../api/streaming';

// Direct fetch to avoid circular dep with client.js → useStore chain
const fetchJson = (path, opts) => fetch(`./api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());
const getProjection = (roomId, camId) => fetchJson(`/rooms/${roomId}/cameras/${camId}/projection`);
const getZones2d = (roomId, camId) => fetchJson(`/rooms/${roomId}/cameras/${camId}/zones2d`);
const saveZones2d = (roomId, camId, zones2d) => fetchJson(`/rooms/${roomId}/cameras/${camId}/zones2d`, { method: 'PUT', body: JSON.stringify({ zones2d }) });

// AABB of a points array (used to keep `rect` in sync with `points` so
// non-polygon-aware code paths still see a valid bounding rect.)
function aabbOfPoints(points) {
  if (!points || points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Inscribe an N-gon into the given rect. The polygon centre = rect centre,
// vertices spread on an ellipse touching the rect edges. Top vertex is
// slightly rotated (-90°) so a 4-gon ends up as a diamond instead of a
// rectangle (giving instant visual feedback that polygon mode is on).
function inscribeNGon(rect, n) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const rx = rect.w / 2;
  const ry = rect.h / 2;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return pts;
}

// Editable rectangle zone on SVG (legacy / new rect zones).
function EditableZone({ zone, scale, selected, onSelect, onChange }) {
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

// Editable polygon zone on SVG. Drag a vertex to reshape; drag the polygon
// body to translate; double-click an edge to insert a vertex at its mid-point;
// right-click a vertex to remove (only when >3 vertices remain).
function EditablePolygon({ zone, scale, selected, onSelect, onChange }) {
  const startRef = useRef(null);
  const points = zone.points;
  const handleSize = 14 / scale;

  const polyStr = points.map(p => `${p.x},${p.y}`).join(' ');
  const labelAnchor = points.reduce(
    (a, p) => (p.y < a.y || (p.y === a.y && p.x < a.x) ? p : a),
    points[0],
  );

  const onBodyDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(zone.zoneId);
    const svg = e.target.closest('svg');
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    startRef.current = { sx: svgPt.x, sy: svgPt.y, points: points.map(p => ({ ...p })) };

    const onMove = (ev) => {
      const mpt = svg.createSVGPoint();
      mpt.x = ev.clientX; mpt.y = ev.clientY;
      const mp = mpt.matrixTransform(svg.getScreenCTM().inverse());
      const dx = mp.x - startRef.current.sx;
      const dy = mp.y - startRef.current.sy;
      const moved = startRef.current.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
      onChange(zone.zoneId, moved);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onVertexDown = (e, idx) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(zone.zoneId);
    if (e.button === 2) return; // handled by onContextMenu
    const svg = e.target.closest('svg');
    const startPts = points.map(p => ({ ...p }));

    const onMove = (ev) => {
      const mpt = svg.createSVGPoint();
      mpt.x = ev.clientX; mpt.y = ev.clientY;
      const mp = mpt.matrixTransform(svg.getScreenCTM().inverse());
      const next = startPts.map((p, i) => i === idx ? { x: mp.x, y: mp.y } : p);
      onChange(zone.zoneId, next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Right-click on vertex → remove (min 3 vertices).
  const onVertexContext = (e, idx) => {
    e.preventDefault();
    e.stopPropagation();
    if (points.length <= 3) return;
    const next = points.filter((_, i) => i !== idx);
    onChange(zone.zoneId, next);
  };

  // Double-click an edge → insert vertex at its midpoint, capped at 20 total.
  const onEdgeDoubleClick = (e, idx) => {
    e.stopPropagation();
    if (points.length >= 20) return;
    const a = points[idx];
    const b = points[(idx + 1) % points.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const next = [...points.slice(0, idx + 1), mid, ...points.slice(idx + 1)];
    onChange(zone.zoneId, next);
  };

  return (
    <g>
      <polygon
        points={polyStr}
        fill={zone.color || '#22c55e'}
        fillOpacity={selected ? 0.25 : 0.12}
        stroke={zone.color || '#22c55e'}
        strokeWidth={selected ? 2.5 / scale : 1.5 / scale}
        style={{ cursor: 'move' }}
        onPointerDown={onBodyDown}
      />
      {/* Invisible thicker stroke per edge to catch double-clicks for vertex insertion. */}
      {selected && points.map((p, i) => {
        const q = points[(i + 1) % points.length];
        return (
          <line
            key={`edge-${i}`}
            x1={p.x} y1={p.y} x2={q.x} y2={q.y}
            stroke="transparent"
            strokeWidth={10 / scale}
            style={{ cursor: 'copy' }}
            onDoubleClick={(e) => onEdgeDoubleClick(e, i)}
          />
        );
      })}
      <text
        x={labelAnchor.x + 4 / scale} y={labelAnchor.y + 14 / scale}
        fill="#fff"
        fontSize={12 / scale}
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
        style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        {zone.zoneName}
      </text>
      {selected && points.map((p, i) => (
        <rect
          key={`v-${i}`}
          x={p.x - handleSize / 2}
          y={p.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          fill="#22c55e"
          stroke="#fff"
          strokeWidth={1.5 / scale}
          rx={2 / scale}
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => onVertexDown(e, i)}
          onContextMenu={(e) => onVertexContext(e, i)}
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
  const [selectedZone3dId, setSelectedZone3dId] = useState('');
  // Number of polygon vertices to inscribe into the rubber-banded rect.
  // 0 = pure rectangle (legacy); 3..20 = N-gon. Rectangle stays the default
  // because it covers >90% of bays; ANPR side accepts both shapes.
  const [drawShapeN, setDrawShapeN] = useState(0);
  const svgRef = useRef();

  const resolution = camera.resolution || { width: 1920, height: 1080 };

  // 3D zones available for binding on this camera — full room list minus
  // those already mapped here. Picking from this list (instead of typing a
  // free-form name) guarantees that 2D mappings carry the real 3D zone id,
  // so they never become orphans if a 3D zone is renamed later.
  const zones3d = currentRoom?.zones || [];
  const availableZones3d = zones3d.filter(z3 => !zones.some(z2 => z2.zoneId === z3.id));

  // Ensure at least 10% of each zone is visible on the frame
  const clampZonesToFrame = useCallback((zoneList) => {
    const W = resolution.width, H = resolution.height;
    return zoneList.map(z => {
      const { x, y, w, h } = z.rect;
      // Calculate visible area
      const visX1 = Math.max(0, x), visY1 = Math.max(0, y);
      const visX2 = Math.min(W, x + w), visY2 = Math.min(H, y + h);
      const visW = Math.max(0, visX2 - visX1), visH = Math.max(0, visY2 - visY1);
      const visArea = visW * visH;
      const totalArea = w * h;
      if (totalArea <= 0) return z;

      const visiblePct = visArea / totalArea;
      if (visiblePct >= 0.1) return z; // at least 10% visible, OK

      // Clamp: move the rect so at least 10% is inside the frame
      let nx = x, ny = y;
      if (x + w < W * 0.02) nx = -w * 0.9;       // mostly off left — bring right edge in
      if (x > W * 0.98) nx = W - w * 0.1;          // mostly off right
      if (y + h < H * 0.02) ny = -h * 0.9;         // mostly off top
      if (y > H * 0.98) ny = H - h * 0.1;           // mostly off bottom

      // Simple clamp: ensure at least 10% overlap
      nx = Math.max(-w * 0.9, Math.min(W - w * 0.1, nx));
      ny = Math.max(-h * 0.9, Math.min(H - h * 0.1, ny));

      const dx = nx - x;
      const dy = ny - y;
      const out = { ...z, rect: { x: nx, y: ny, w, h } };
      // If polygon zone, translate the points by the same delta so the visible
      // shape and the bbox stay in sync.
      if (Array.isArray(z.points) && z.points.length >= 3 && (dx || dy)) {
        out.points = z.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
      }
      return out;
    });
  }, [resolution]);

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
        setZones(clampZonesToFrame(custom));
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
        setZones(clampZonesToFrame(projected));
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
    const W = resolution.width, H = resolution.height;
    // Clamp so at least 10% stays visible
    const r = { ...newRect };
    r.x = Math.max(-r.w * 0.9, Math.min(W - r.w * 0.1, r.x));
    r.y = Math.max(-r.h * 0.9, Math.min(H - r.h * 0.1, r.y));
    setZones(prev => prev.map(z => z.zoneId === zoneId ? { ...z, rect: r } : z));
    setHasCustom(true);
  };

  // Polygon edit: receive new points[], recompute rect = AABB(points) so the
  // legacy `rect` field (still used by the ANPR fallback path and analytics
  // tile crops) stays accurate.
  const handlePolygonChange = (zoneId, newPoints) => {
    setZones(prev => prev.map(z => {
      if (z.zoneId !== zoneId) return z;
      return { ...z, points: newPoints, rect: aabbOfPoints(newPoints) };
    }));
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
    // Resolve the picked 3D zone — required for adding a mapping.
    const z3d = zones3d.find(z => z.id === selectedZone3dId);
    if (!z3d) {
      setDrawStart(null);
      setDrawRect(null);
      return;
    }
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
    const color = colors[zones.length % colors.length];
    const newZone = {
      zoneId: z3d.id,
      zoneName: z3d.name,
      color,
      rect: { ...drawRect },
    };
    if (drawShapeN >= 3 && drawShapeN <= 20) {
      // Inscribe an N-gon inside the rubber-banded rect. The user then drags
      // the vertices to fit the actual zone outline. rect stays = AABB(points).
      const pts = inscribeNGon(drawRect, drawShapeN);
      newZone.points = pts;
      newZone.rect = aabbOfPoints(pts);
    }
    setZones(prev => [...prev, newZone]);
    setHasCustom(true);
    setDrawStart(null);
    setDrawRect(null);
    setDrawing(false);
    setSelectedZone3dId('');
    setDrawShapeN(0);
    setSelectedZoneId(newZone.zoneId);
  };

  const handleRenameZone = (zoneId, newName) => {
    setZones(prev => prev.map(z => z.zoneId === zoneId ? { ...z, zoneName: newName } : z));
    setHasCustom(true);
  };

  // Convert a rect-only zone to a polygon (4 vertices = the rect corners).
  // User can then drag/insert/remove vertices to refine the outline.
  const handleConvertToPolygon = (zoneId) => {
    setZones(prev => prev.map(z => {
      if (z.zoneId !== zoneId) return z;
      if (Array.isArray(z.points) && z.points.length >= 3) return z;
      const { x, y, w, h } = z.rect;
      const pts = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
      return { ...z, points: pts };
    }));
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
              onContextMenu={(e) => e.preventDefault()}
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
                  Array.isArray(z.points) && z.points.length >= 3 ? (
                    <EditablePolygon
                      key={z.zoneId}
                      zone={z}
                      scale={scale}
                      selected={z.zoneId === selectedZoneId}
                      onSelect={setSelectedZoneId}
                      onChange={handlePolygonChange}
                    />
                  ) : (
                    <EditableZone
                      key={z.zoneId}
                      zone={z}
                      scale={scale}
                      selected={z.zoneId === selectedZoneId}
                      onSelect={setSelectedZoneId}
                      onChange={handleZoneChange}
                    />
                  )
                ))
              )}

              {/* Drawing preview */}
              {drawRect && (
                drawShapeN >= 3 ? (
                  <polygon
                    points={inscribeNGon(drawRect, drawShapeN).map(p => `${p.x},${p.y}`).join(' ')}
                    fill="#22c55e"
                    fillOpacity={0.2}
                    stroke="#22c55e"
                    strokeWidth={2 / scale}
                    strokeDasharray={`${4 / scale}`}
                  />
                ) : (
                  <rect
                    x={drawRect.x} y={drawRect.y}
                    width={drawRect.w} height={drawRect.h}
                    fill="#22c55e"
                    fillOpacity={0.2}
                    stroke="#22c55e"
                    strokeWidth={2 / scale}
                    strokeDasharray={`${4 / scale}`}
                  />
                )
              )}
            </svg>

            {/* Drawing mode banner */}
            {drawing && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-green-800/90 text-green-200 text-xs px-3 py-1.5 rounded-full">
                {drawShapeN >= 3
                  ? `Draw a rectangle — ${drawShapeN}-угольник будет вписан в него`
                  : 'Draw a rectangle to create a zone'}
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
                  disabled={availableZones3d.length === 0}
                  title={availableZones3d.length === 0 ? 'Все зоны комнаты уже привязаны к этой камере' : ''}
                  className="text-xs bg-green-700 hover:bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-2 py-0.5 rounded"
                >
                  + Add
                </button>
              ) : (
                <button
                  onClick={() => { setDrawing(false); setDrawStart(null); setDrawRect(null); setSelectedZone3dId(''); setDrawShapeN(0); }}
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-0.5 rounded"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Pick which 3D zone this rectangle maps to (shown when drawing).
                Forces the 2D mapping to carry a real 3D zone id, so it never
                becomes an orphan if the 3D zone is renamed later. */}
            {drawing && (
              <>
                <select
                  value={selectedZone3dId}
                  onChange={e => setSelectedZone3dId(e.target.value)}
                  className="mb-2 w-full bg-slate-800 border border-green-600 rounded px-2 py-1 text-xs text-slate-200"
                  autoFocus
                >
                  <option value="">— выберите зону —</option>
                  {availableZones3d.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
                {/* Shape picker: rect (default) or N-gon (3..20). Polygon zones
                    are sent to ANPR as `polygon` so neighbour cars sitting in
                    the bbox but outside the outline are excluded. */}
                <div className="mb-2 flex items-center gap-2">
                  <label className="text-[0.65rem] text-slate-400 uppercase tracking-wider">Форма</label>
                  <select
                    value={drawShapeN === 0 ? 'rect' : String(drawShapeN)}
                    onChange={e => setDrawShapeN(e.target.value === 'rect' ? 0 : parseInt(e.target.value, 10))}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs text-slate-200"
                  >
                    <option value="rect">Прямоугольник</option>
                    {Array.from({ length: 18 }, (_, i) => i + 3).map(n => (
                      <option key={n} value={n}>{n}-угольник</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {drawing && !selectedZone3dId && (
              <div className="mb-2 text-[0.65rem] text-slate-500">
                Выберите зону, затем нарисуйте прямоугольник на кадре
              </div>
            )}
            {drawing && selectedZone3dId && drawShapeN >= 3 && (
              <div className="mb-2 text-[0.65rem] text-slate-500">
                После создания: тяните вершины. Двойной клик по ребру — добавить вершину; ПКМ по вершине — удалить.
              </div>
            )}

            <div className="space-y-1 overflow-y-auto flex-1">
              {zones.map(z => {
                const isPoly = Array.isArray(z.points) && z.points.length >= 3;
                return (
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
                    <div className="text-slate-500 mt-0.5 ml-4 flex items-center gap-2">
                      <span>{Math.round(z.rect.w)}x{Math.round(z.rect.h)}</span>
                      {isPoly ? (
                        <span className="text-cyan-400">{z.points.length}-уг.</span>
                      ) : (
                        z.zoneId === selectedZoneId && (
                          <button
                            onClick={e => { e.stopPropagation(); handleConvertToPolygon(z.zoneId); }}
                            className="text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline"
                          >
                            → polygon
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
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
