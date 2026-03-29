import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';

export default function RoomForm() {
  const { currentRoom, editRoom } = useStore();
  const [form, setForm] = useState({ name: '', width: 10, height: 4, depth: 8 });

  useEffect(() => {
    if (currentRoom) {
      setForm({
        name: currentRoom.name,
        width: currentRoom.width,
        height: currentRoom.height,
        depth: currentRoom.depth
      });
    }
  }, [currentRoom]);

  const handleSave = () => {
    if (!currentRoom) return;
    editRoom(currentRoom.id, form);
  };

  if (!currentRoom) return null;

  return (
    <div className="p-3">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Room Settings</h3>
      <div className="space-y-2">
        <input
          type="text"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="w-full"
        />
        <div className="grid grid-cols-3 gap-1">
          <label className="text-xs text-slate-500">
            Width
            <input type="number" value={form.width} min={1} step={0.5}
              onChange={e => setForm({ ...form, width: +e.target.value })} className="w-full" />
          </label>
          <label className="text-xs text-slate-500">
            Height
            <input type="number" value={form.height} min={1} step={0.5}
              onChange={e => setForm({ ...form, height: +e.target.value })} className="w-full" />
          </label>
          <label className="text-xs text-slate-500">
            Depth
            <input type="number" value={form.depth} min={1} step={0.5}
              onChange={e => setForm({ ...form, depth: +e.target.value })} className="w-full" />
          </label>
        </div>
        <button onClick={handleSave} className="w-full bg-slate-700 hover:bg-slate-600 text-sm py-1 rounded">
          Update Room
        </button>
      </div>
    </div>
  );
}
