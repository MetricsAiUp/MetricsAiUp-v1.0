import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';

const COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ec4899', '#06b6d4', '#f97316'];

function ZoneStatus({ zone, monState }) {
  const mon = monState.find(m => m.zone === zone.name);
  const status = mon?.status || zone.liftStatus || 'free';
  const isOccupied = status === 'occupied';
  const isLift = (zone.type || 'lift') === 'lift';
  return (
    <>
      <div className="text-xs text-slate-500">
        {zone.size.width}x{zone.size.height}x{zone.size.depth}m
        <span className="ml-1 text-slate-600">
          {isLift ? 'Подъёмник' : 'Прочие'}
        </span>
        <span className={`ml-1 ${isOccupied ? 'text-red-400' : 'text-green-400'}`}>
          {isLift
            ? (isOccupied ? '(занят)' : '(свободен)')
            : (isOccupied ? '(ведутся)' : '(не ведутся)')
          }
        </span>
      </div>
      {mon?.car?.plate && (
        <div className="text-[0.65rem] text-yellow-400 font-mono">
          {mon.car.plate} <span className="text-slate-500">{mon.car.model || ''}</span>
        </div>
      )}
    </>
  );
}

export default function ZoneList() {
  const { currentRoom, selectedZoneId, selectZone, addZone, removeZone } = useStore();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '', x: 1, y: 0, z: 1, width: 2, height: 2, depth: 2, color: '#22c55e'
  });

  const zones = currentRoom?.zones || [];
  const [monState, setMonState] = useState([]);
  // Two-step delete: first click on a zone arms it (id stored here),
  // second click within 4s actually removes it. Auto-disarms on timeout.
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  useEffect(() => {
    if (!pendingDeleteId) return;
    const t = setTimeout(() => setPendingDeleteId(null), 4000);
    return () => clearTimeout(t);
  }, [pendingDeleteId]);

  const requestDelete = async (zone) => {
    if (pendingDeleteId !== zone.id) {
      // First click — arm.
      setPendingDeleteId(zone.id);
      return;
    }
    // Second click — final confirm via native dialog, then delete.
    const ok = window.confirm(`Удалить зону "${zone.name}" безвозвратно?\nЭто действие нельзя отменить.`);
    setPendingDeleteId(null);
    if (ok) await removeZone(zone.id);
  };

  useEffect(() => {
    const load = () => {
      fetch('./api/monitoring/state').then(r => r.ok ? r.json() : []).then(setMonState).catch(() => {});
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await addZone({
      name: form.name,
      position: { x: form.x, y: form.y, z: form.z },
      size: { width: form.width, height: form.height, depth: form.depth },
      color: form.color
    });
    const nextColor = COLORS[(zones.length + 1) % COLORS.length];
    setCreating(false);
    setForm({ name: '', x: 1, y: 0, z: 1, width: 2, height: 2, depth: 2, color: nextColor });
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Zones</h3>
        <button
          onClick={() => setCreating(!creating)}
          className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
        >
          {creating ? 'Cancel' : '+ Zone'}
        </button>
      </div>

      {creating && (
        <div className="mb-3 p-2 bg-slate-800 rounded space-y-2">
          <div className="flex gap-2">
            <input type="text" placeholder="Zone name" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} className="flex-1" />
            <input type="color" value={form.color}
              onChange={e => setForm({ ...form, color: e.target.value })} className="w-8 h-8 p-0 rounded" />
          </div>
          <div className="text-xs text-slate-500 mb-1">Position (m)</div>
          <div className="grid grid-cols-3 gap-1">
            <input type="number" value={form.x} step={0.5} placeholder="X"
              onChange={e => setForm({ ...form, x: +e.target.value })} />
            <input type="number" value={form.y} step={0.5} placeholder="Y"
              onChange={e => setForm({ ...form, y: +e.target.value })} />
            <input type="number" value={form.z} step={0.5} placeholder="Z"
              onChange={e => setForm({ ...form, z: +e.target.value })} />
          </div>
          <div className="text-xs text-slate-500 mb-1">Size (m)</div>
          <div className="grid grid-cols-3 gap-1">
            <input type="number" value={form.width} step={0.5} min={0.1} placeholder="W"
              onChange={e => setForm({ ...form, width: +e.target.value })} />
            <input type="number" value={form.height} step={0.5} min={0.1} placeholder="H"
              onChange={e => setForm({ ...form, height: +e.target.value })} />
            <input type="number" value={form.depth} step={0.5} min={0.1} placeholder="D"
              onChange={e => setForm({ ...form, depth: +e.target.value })} />
          </div>
          <button onClick={handleCreate} className="w-full bg-green-600 hover:bg-green-700 text-white text-sm py-1 rounded">
            Add Zone
          </button>
        </div>
      )}

      <div className="space-y-1">
        {zones.map(z => (
          <div
            key={z.id}
            onClick={() => selectZone(z.id)}
            className={`p-2 rounded cursor-pointer flex items-center justify-between group ${
              selectedZoneId === z.id ? 'bg-slate-700 border border-slate-500' : 'bg-slate-800 hover:bg-slate-750 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: z.color }} />
              <div>
                <div className="text-sm">{z.name}</div>
                <ZoneStatus zone={z} monState={monState} />
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); requestDelete(z); }}
              title={pendingDeleteId === z.id ? 'Нажмите ещё раз для подтверждения' : 'Удалить зону'}
              className={
                pendingDeleteId === z.id
                  ? 'text-white bg-red-600 hover:bg-red-700 text-xs px-2 py-0.5 rounded animate-pulse opacity-100'
                  : 'text-red-500 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100'
              }
            >
              {pendingDeleteId === z.id ? 'Точно?' : 'Del'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
