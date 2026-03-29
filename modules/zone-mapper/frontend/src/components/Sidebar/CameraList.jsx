import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { RTSP_CAMERAS } from '../../api/streaming';

export default function CameraList() {
  const { currentRoom, selectedCameraId, selectCamera, addCamera, removeCamera, fetchProjection, downloadExport } = useStore();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '', x: 0, y: 3, z: 0, yaw: 45, pitch: -20, roll: 0, fov: 90, resW: 1920, resH: 1080, rtspCameraId: ''
  });

  const cameras = currentRoom?.cameras || [];

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await addCamera({
      name: form.name,
      position: { x: form.x, y: form.y, z: form.z },
      rotation: { yaw: form.yaw, pitch: form.pitch, roll: form.roll },
      fov: form.fov,
      resolution: { width: form.resW, height: form.resH },
      rtspCameraId: form.rtspCameraId || undefined
    });
    setCreating(false);
    setForm({ name: '', x: 0, y: 3, z: 0, yaw: 45, pitch: -20, roll: 0, fov: 90, resW: 1920, resH: 1080, rtspCameraId: '' });
  };

  const handleSelect = async (camId) => {
    selectCamera(camId);
    await fetchProjection(camId);
  };

  const getRtspName = (rtspId) => {
    const cam = RTSP_CAMERAS.find(c => c.id === rtspId);
    return cam ? cam.id : null;
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cameras</h3>
        <button
          onClick={() => setCreating(!creating)}
          className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded"
        >
          {creating ? 'Cancel' : '+ Camera'}
        </button>
      </div>

      {creating && (
        <div className="mb-3 p-2 bg-slate-800 rounded space-y-2">
          <input type="text" placeholder="Camera name" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} className="w-full" />
          <div className="text-xs text-slate-500">RTSP Camera</div>
          <select
            value={form.rtspCameraId}
            onChange={e => setForm({ ...form, rtspCameraId: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
          >
            <option value="">-- Not linked --</option>
            {RTSP_CAMERAS.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="text-xs text-slate-500">Position (m)</div>
          <div className="grid grid-cols-3 gap-1">
            <input type="number" value={form.x} step={0.5} placeholder="X" onChange={e => setForm({ ...form, x: +e.target.value })} />
            <input type="number" value={form.y} step={0.5} placeholder="Y" onChange={e => setForm({ ...form, y: +e.target.value })} />
            <input type="number" value={form.z} step={0.5} placeholder="Z" onChange={e => setForm({ ...form, z: +e.target.value })} />
          </div>
          <div className="text-xs text-slate-500">Rotation (deg)</div>
          <div className="grid grid-cols-3 gap-1">
            <input type="number" value={form.yaw} step={5} placeholder="Yaw" onChange={e => setForm({ ...form, yaw: +e.target.value })} />
            <input type="number" value={form.pitch} step={5} placeholder="Pitch" onChange={e => setForm({ ...form, pitch: +e.target.value })} />
            <input type="number" value={form.roll} step={5} placeholder="Roll" onChange={e => setForm({ ...form, roll: +e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-1">
            <label className="text-xs text-slate-500">FOV
              <input type="number" value={form.fov} min={10} max={180} onChange={e => setForm({ ...form, fov: +e.target.value })} className="w-full" />
            </label>
            <label className="text-xs text-slate-500">Res W
              <input type="number" value={form.resW} min={320} onChange={e => setForm({ ...form, resW: +e.target.value })} className="w-full" />
            </label>
            <label className="text-xs text-slate-500">Res H
              <input type="number" value={form.resH} min={240} onChange={e => setForm({ ...form, resH: +e.target.value })} className="w-full" />
            </label>
          </div>
          <button onClick={handleCreate} className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm py-1 rounded">
            Add Camera
          </button>
        </div>
      )}

      <div className="space-y-1">
        {cameras.map(c => (
          <div
            key={c.id}
            onClick={() => handleSelect(c.id)}
            className={`p-2 rounded cursor-pointer flex items-center justify-between group ${
              selectedCameraId === c.id ? 'bg-purple-900/50 border border-purple-600' : 'bg-slate-800 hover:bg-slate-750 border border-transparent'
            }`}
          >
            <div>
              <div className="text-sm">{c.name}</div>
              <div className="text-xs text-slate-500">
                FOV {c.fov}&deg; &middot; {c.resolution.width}x{c.resolution.height}
                {c.rtspCameraId && <span className="ml-1 text-purple-400">&middot; {getRtspName(c.rtspCameraId)}</span>}
              </div>
            </div>
            <div className="flex gap-1 items-center">
              <button
                onClick={e => { e.stopPropagation(); downloadExport(c.id); }}
                className="text-blue-400 hover:text-blue-300 text-xs opacity-0 group-hover:opacity-100"
                title="Export 2D config"
              >
                Export
              </button>
              <button
                onClick={e => { e.stopPropagation(); removeCamera(c.id); }}
                className="text-red-500 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100"
              >
                Del
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
