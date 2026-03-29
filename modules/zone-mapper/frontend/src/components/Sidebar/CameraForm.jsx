import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { RTSP_CAMERAS } from '../../api/streaming';

export default function CameraForm() {
  const { currentRoom, selectedCameraId, editCamera, fetchProjection } = useStore();
  const camera = currentRoom?.cameras?.find(c => c.id === selectedCameraId);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (camera) {
      setForm({
        name: camera.name,
        px: camera.position.x, py: camera.position.y, pz: camera.position.z,
        yaw: camera.rotation.yaw, pitch: camera.rotation.pitch, roll: camera.rotation.roll,
        fov: camera.fov,
        resW: camera.resolution.width, resH: camera.resolution.height,
        rtspCameraId: camera.rtspCameraId || ''
      });
    }
  }, [camera]);

  if (!form || !camera) return null;

  const handleSave = async () => {
    await editCamera(camera.id, {
      name: form.name,
      position: { x: form.px, y: form.py, z: form.pz },
      rotation: { yaw: form.yaw, pitch: form.pitch, roll: form.roll },
      fov: form.fov,
      resolution: { width: form.resW, height: form.resH },
      rtspCameraId: form.rtspCameraId || undefined
    });
    await fetchProjection(camera.id);
  };

  return (
    <div className="p-3 bg-slate-800/50">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Edit Camera</h4>
      <div className="space-y-2">
        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full" />

        {/* RTSP Camera binding */}
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

        <div className="text-xs text-slate-500">Position</div>
        <div className="grid grid-cols-3 gap-1">
          <label className="text-xs text-slate-500">X<input type="number" value={form.px} step={0.1} onChange={e => setForm({ ...form, px: +e.target.value })} className="w-full" /></label>
          <label className="text-xs text-slate-500">Y<input type="number" value={form.py} step={0.1} onChange={e => setForm({ ...form, py: +e.target.value })} className="w-full" /></label>
          <label className="text-xs text-slate-500">Z<input type="number" value={form.pz} step={0.1} onChange={e => setForm({ ...form, pz: +e.target.value })} className="w-full" /></label>
        </div>

        <div className="text-xs text-slate-500">Rotation (deg)</div>
        <div className="grid grid-cols-3 gap-1">
          <label className="text-xs text-slate-500">Yaw<input type="number" value={form.yaw} step={1} onChange={e => setForm({ ...form, yaw: +e.target.value })} className="w-full" /></label>
          <label className="text-xs text-slate-500">Pitch<input type="number" value={form.pitch} step={1} onChange={e => setForm({ ...form, pitch: +e.target.value })} className="w-full" /></label>
          <label className="text-xs text-slate-500">Roll<input type="number" value={form.roll} step={1} onChange={e => setForm({ ...form, roll: +e.target.value })} className="w-full" /></label>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <label className="text-xs text-slate-500">FOV<input type="number" value={form.fov} min={10} max={180} onChange={e => setForm({ ...form, fov: +e.target.value })} className="w-full" /></label>
          <label className="text-xs text-slate-500">Res W<input type="number" value={form.resW} min={320} onChange={e => setForm({ ...form, resW: +e.target.value })} className="w-full" /></label>
          <label className="text-xs text-slate-500">Res H<input type="number" value={form.resH} min={240} onChange={e => setForm({ ...form, resH: +e.target.value })} className="w-full" /></label>
        </div>

        <button onClick={handleSave} className="w-full bg-slate-700 hover:bg-slate-600 text-sm py-1 rounded">Save</button>
      </div>
    </div>
  );
}
