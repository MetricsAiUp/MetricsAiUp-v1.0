import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';

function SegmentForm({ segment, onChange, onDelete }) {
  return (
    <div className="p-2 bg-slate-800 rounded space-y-1.5 relative group">
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={segment.name}
          placeholder="Segment name"
          onChange={e => onChange({ ...segment, name: e.target.value })}
          className="w-full text-xs"
        />
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-400 text-xs ml-2 opacity-0 group-hover:opacity-100"
        >
          Del
        </button>
      </div>
      <div className="text-xs text-slate-500">Position</div>
      <div className="grid grid-cols-3 gap-1">
        <label className="text-xs text-slate-500">X
          <input type="number" value={segment.position.x} step={0.5}
            onChange={e => onChange({ ...segment, position: { ...segment.position, x: +e.target.value } })} className="w-full" />
        </label>
        <label className="text-xs text-slate-500">Y
          <input type="number" value={segment.position.y} step={0.5}
            onChange={e => onChange({ ...segment, position: { ...segment.position, y: +e.target.value } })} className="w-full" />
        </label>
        <label className="text-xs text-slate-500">Z
          <input type="number" value={segment.position.z} step={0.5}
            onChange={e => onChange({ ...segment, position: { ...segment.position, z: +e.target.value } })} className="w-full" />
        </label>
      </div>
      <div className="text-xs text-slate-500">Size</div>
      <div className="grid grid-cols-3 gap-1">
        <label className="text-xs text-slate-500">W
          <input type="number" value={segment.size.width} min={0.5} step={0.5}
            onChange={e => onChange({ ...segment, size: { ...segment.size, width: +e.target.value } })} className="w-full" />
        </label>
        <label className="text-xs text-slate-500">H
          <input type="number" value={segment.size.height} min={0.5} step={0.5}
            onChange={e => onChange({ ...segment, size: { ...segment.size, height: +e.target.value } })} className="w-full" />
        </label>
        <label className="text-xs text-slate-500">D
          <input type="number" value={segment.size.depth} min={0.5} step={0.5}
            onChange={e => onChange({ ...segment, size: { ...segment.size, depth: +e.target.value } })} className="w-full" />
        </label>
      </div>
    </div>
  );
}

export default function RoomForm() {
  const { currentRoom, editRoom } = useStore();
  const [form, setForm] = useState({ name: '', width: 10, height: 4, depth: 8 });
  const [segments, setSegments] = useState([]);

  useEffect(() => {
    if (currentRoom) {
      setForm({
        name: currentRoom.name,
        width: currentRoom.width,
        height: currentRoom.height,
        depth: currentRoom.depth
      });
      setSegments(currentRoom.segments || []);
    }
  }, [currentRoom]);

  const handleSave = () => {
    if (!currentRoom) return;
    editRoom(currentRoom.id, { ...form, segments });
  };

  const addSegment = () => {
    const newSeg = {
      id: `seg_${Date.now()}`,
      name: `Segment ${segments.length + 1}`,
      position: { x: form.width, y: 0, z: 0 },
      size: { width: 5, height: form.height, depth: form.depth },
    };
    setSegments([...segments, newSeg]);
  };

  const updateSegment = (idx, updated) => {
    setSegments(segments.map((s, i) => i === idx ? updated : s));
  };

  const deleteSegment = (idx) => {
    setSegments(segments.filter((_, i) => i !== idx));
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
        <div className="text-xs text-slate-500">Main segment</div>
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

        {/* Additional segments */}
        {segments.length > 0 && (
          <div className="text-xs text-slate-500 mt-2">Additional segments</div>
        )}
        <div className="space-y-2">
          {segments.map((seg, i) => (
            <SegmentForm
              key={seg.id}
              segment={seg}
              onChange={(updated) => updateSegment(i, updated)}
              onDelete={() => deleteSegment(i)}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} className="flex-1 bg-slate-700 hover:bg-slate-600 text-sm py-1 rounded">
            Save
          </button>
          <button onClick={addSegment} className="bg-blue-700 hover:bg-blue-600 text-sm py-1 px-3 rounded text-white">
            + Segment
          </button>
        </div>
      </div>
    </div>
  );
}
