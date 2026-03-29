import { useState } from 'react';
import { useStore } from '../../store/useStore';

export default function RoomList() {
  const { rooms, currentRoom, fetchRoom, addRoom, removeRoom } = useStore();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', width: 10, height: 4, depth: 8 });

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    const room = await addRoom(form);
    setCreating(false);
    setForm({ name: '', width: 10, height: 4, depth: 8 });
    await fetchRoom(room.id);
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Rooms</h2>
        <button
          onClick={() => setCreating(!creating)}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
        >
          {creating ? 'Cancel' : '+ New'}
        </button>
      </div>

      {creating && (
        <div className="mb-3 p-2 bg-slate-800 rounded space-y-2">
          <input
            type="text"
            placeholder="Room name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full"
          />
          <div className="grid grid-cols-3 gap-1">
            <label className="text-xs text-slate-500">
              W(m)
              <input type="number" value={form.width} min={1} step={0.5}
                onChange={e => setForm({ ...form, width: +e.target.value })} className="w-full" />
            </label>
            <label className="text-xs text-slate-500">
              H(m)
              <input type="number" value={form.height} min={1} step={0.5}
                onChange={e => setForm({ ...form, height: +e.target.value })} className="w-full" />
            </label>
            <label className="text-xs text-slate-500">
              D(m)
              <input type="number" value={form.depth} min={1} step={0.5}
                onChange={e => setForm({ ...form, depth: +e.target.value })} className="w-full" />
            </label>
          </div>
          <button onClick={handleCreate} className="w-full bg-green-600 hover:bg-green-700 text-white text-sm py-1 rounded">
            Create
          </button>
        </div>
      )}

      <div className="space-y-1">
        {rooms.map(r => (
          <div
            key={r.id}
            onClick={() => fetchRoom(r.id)}
            className={`p-2 rounded cursor-pointer flex items-center justify-between group ${
              currentRoom?.id === r.id ? 'bg-blue-900/50 border border-blue-600' : 'bg-slate-800 hover:bg-slate-750 border border-transparent'
            }`}
          >
            <div>
              <div className="text-sm font-medium">{r.name}</div>
              <div className="text-xs text-slate-500">{r.width}x{r.height}x{r.depth}m &middot; {r.camerasCount} cam &middot; {r.zonesCount} zones</div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); removeRoom(r.id); }}
              className="text-red-500 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100"
            >
              Del
            </button>
          </div>
        ))}
        {rooms.length === 0 && !creating && (
          <p className="text-xs text-slate-600 text-center py-4">No rooms yet. Create one!</p>
        )}
      </div>
    </div>
  );
}
