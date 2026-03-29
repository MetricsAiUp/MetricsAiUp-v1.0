import { useEffect } from 'react';
import { useStore } from '../../store/useStore';

export default function PreviewPanel() {
  const { currentRoom, selectedCameraId, projection, fetchProjection, downloadExport } = useStore();
  const camera = currentRoom?.cameras?.find(c => c.id === selectedCameraId);

  useEffect(() => {
    if (selectedCameraId) {
      fetchProjection(selectedCameraId);
    }
  }, [selectedCameraId, currentRoom, fetchProjection]);

  if (!camera || !projection) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Loading projection...
      </div>
    );
  }

  const { resolution } = projection.camera;
  const viewW = resolution.width;
  const viewH = resolution.height;

  // Scale to fit container (max ~500px wide)
  const scale = Math.min(450 / viewW, 250 / viewH);

  return (
    <div className="h-full flex">
      <div className="flex-1 flex items-center justify-center p-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-400">
              Camera Preview: {camera.name} ({resolution.width}x{resolution.height})
            </h3>
            <button
              onClick={() => downloadExport(camera.id)}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
            >
              Export JSON Config
            </button>
          </div>
          <svg
            width={viewW * scale}
            height={viewH * scale}
            viewBox={`0 0 ${viewW} ${viewH}`}
            className="bg-slate-950 rounded border border-slate-700"
          >
            {/* Frame border */}
            <rect x={0} y={0} width={viewW} height={viewH} fill="none" stroke="#334155" strokeWidth={2} />

            {/* Crosshair */}
            <line x1={viewW / 2} y1={0} x2={viewW / 2} y2={viewH} stroke="#1e293b" strokeWidth={1} />
            <line x1={0} y1={viewH / 2} x2={viewW} y2={viewH / 2} stroke="#1e293b" strokeWidth={1} />

            {/* Projected zones */}
            {projection.projections.map(p => {
              if (!p.visible || p.polygon.length < 3) return null;
              const points = p.polygon.map(pt => pt.join(',')).join(' ');
              return (
                <g key={p.zoneId}>
                  <polygon
                    points={points}
                    fill={p.color}
                    fillOpacity={0.25}
                    stroke={p.color}
                    strokeWidth={2}
                  />
                  {/* Zone label at centroid */}
                  <text
                    x={p.polygon.reduce((s, pt) => s + pt[0], 0) / p.polygon.length}
                    y={p.polygon.reduce((s, pt) => s + pt[1], 0) / p.polygon.length}
                    fill="white"
                    fontSize={Math.max(14, viewW * 0.015)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontWeight="bold"
                    style={{ textShadow: '0 0 4px rgba(0,0,0,0.8)' }}
                  >
                    {p.zoneName}
                  </text>
                </g>
              );
            })}

            {/* Resolution label */}
            <text x={10} y={viewH - 10} fill="#475569" fontSize={12}>
              {viewW}x{viewH}
            </text>
          </svg>
        </div>
      </div>

      {/* Zone list in projection */}
      <div className="w-56 border-l border-slate-700 p-3 overflow-y-auto">
        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Projected Zones</h4>
        {projection.projections.map(p => (
          <div key={p.zoneId} className="flex items-center gap-2 py-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className={`text-sm ${p.visible ? '' : 'text-slate-600 line-through'}`}>
              {p.zoneName}
            </span>
            {!p.visible && <span className="text-xs text-slate-600">(hidden)</span>}
          </div>
        ))}
        {projection.projections.length === 0 && (
          <p className="text-xs text-slate-600">No zones in room</p>
        )}
      </div>
    </div>
  );
}
