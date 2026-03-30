import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';

const ZONE_TYPES = [
  { value: 'lift', label: 'Подъёмник' },
  { value: 'other', label: 'Прочие работы' },
];

export default function ZoneForm() {
  const { currentRoom, selectedZoneId, editZone } = useStore();
  const zone = currentRoom?.zones?.find(z => z.id === selectedZoneId);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (zone) {
      setForm({
        name: zone.name,
        color: zone.color,
        px: zone.position.x, py: zone.position.y, pz: zone.position.z,
        sw: zone.size.width, sh: zone.size.height, sd: zone.size.depth,
        type: zone.type || 'lift',
        liftStatus: zone.liftStatus || 'free',
      });
    }
  }, [zone]);

  if (!form || !zone) return null;

  const handleSave = () => {
    editZone(zone.id, {
      name: form.name,
      color: form.color,
      position: { x: form.px, y: form.py, z: form.pz },
      size: { width: form.sw, height: form.sh, depth: form.sd },
      type: form.type,
      liftStatus: form.liftStatus,
    });
  };

  return (
    <div className="p-3 bg-slate-800/50">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Edit Zone</h4>
      <div className="space-y-2">
        <div className="flex gap-2">
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="flex-1" />
          <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-8 h-8 p-0 rounded" />
        </div>

        {/* Zone type */}
        <div className="text-xs text-slate-500">Type</div>
        <select
          value={form.type}
          onChange={e => setForm({ ...form, type: e.target.value })}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
        >
          {ZONE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* Status */}
        <div className="text-xs text-slate-500">Status</div>
        {form.type === 'lift' ? (
          <div className="flex gap-2">
            <button
              onClick={() => setForm({ ...form, liftStatus: 'free' })}
              className={`flex-1 py-1.5 rounded text-xs font-medium ${
                form.liftStatus === 'free' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >Свободен</button>
            <button
              onClick={() => setForm({ ...form, liftStatus: 'occupied' })}
              className={`flex-1 py-1.5 rounded text-xs font-medium ${
                form.liftStatus === 'occupied' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >Занят</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setForm({ ...form, liftStatus: 'free' })}
              className={`flex-1 py-1.5 rounded text-xs font-medium ${
                form.liftStatus === 'free' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >Не ведутся</button>
            <button
              onClick={() => setForm({ ...form, liftStatus: 'occupied' })}
              className={`flex-1 py-1.5 rounded text-xs font-medium ${
                form.liftStatus === 'occupied' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >Ведутся</button>
          </div>
        )}

        <div className="text-xs text-slate-500">Position</div>
        <div className="grid grid-cols-3 gap-1">
          <label className="text-xs text-slate-500">X<input type="number" value={form.px} step={0.1} onChange={e => setForm({ ...form, px: +e.target.value })} className="w-full" /></label>
          <label className="text-xs text-slate-500">Y<input type="number" value={form.py} step={0.1} onChange={e => setForm({ ...form, py: +e.target.value })} className="w-full" /></label>
          <label className="text-xs text-slate-500">Z<input type="number" value={form.pz} step={0.1} onChange={e => setForm({ ...form, pz: +e.target.value })} className="w-full" /></label>
        </div>
        <div className="text-xs text-slate-500">Size</div>
        <div className="grid grid-cols-3 gap-1">
          <label className="text-xs text-slate-500">W<input type="number" value={form.sw} step={0.1} min={0.1} onChange={e => setForm({ ...form, sw: +e.target.value })} className="w-full" /></label>
          <label className="text-xs text-slate-500">H<input type="number" value={form.sh} step={0.1} min={0.1} onChange={e => setForm({ ...form, sh: +e.target.value })} className="w-full" /></label>
          <label className="text-xs text-slate-500">D<input type="number" value={form.sd} step={0.1} min={0.1} onChange={e => setForm({ ...form, sd: +e.target.value })} className="w-full" /></label>
        </div>
        <button onClick={handleSave} className="w-full bg-slate-700 hover:bg-slate-600 text-sm py-1 rounded">Save</button>
      </div>
    </div>
  );
}
