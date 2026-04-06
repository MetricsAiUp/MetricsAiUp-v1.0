import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Stage, Layer, Rect, Circle, Text, Group, Line, Transformer, Image as KonvaImage } from 'react-konva';
import {
  MousePointer2, Square, Hexagon, Camera, DoorOpen, Type, Minus, Maximize2, ArrowRightLeft,
  Upload, Save, Download, Trash2, Grid3X3, RotateCcw, ZoomIn, ZoomOut, RefreshCw,
} from 'lucide-react';

const ELEMENT_DEFAULTS = {
  building: { width: 930, height: 614, color: '#22c55e' },
  driveway: { width: 300, height: 40, color: '#94a3b8' },
  post:   { width: 120, height: 80, color: '#3b82f6' },
  zone:   { width: 160, height: 100, color: '#22c55e' },
  camera: { width: 24, height: 24, color: '#ef4444', data: { direction: 0, fov: 90, range: 80 } },
  door:   { width: 60, height: 8, color: '#f59e0b' },
  wall:   { width: 200, height: 6, color: '#6b7280' },
  label:  { width: 100, height: 30, color: '#a855f7' },
};

const DRAFT_KEY = 'stoMapLayout_draft';

let idCounter = Date.now();
const newId = () => `el-${idCounter++}`;

const TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select',
    tip: { ru: 'Выбор и перемещение элементов. Кликните на элемент для редактирования, перетащите для перемещения.', en: 'Select and move elements. Click to edit, drag to move.' } },
  { id: 'building', icon: Maximize2, label: 'Building',
    tip: { ru: 'Внешние границы здания СТО. Определяет общий контур. Кликните на canvas чтобы разместить.', en: 'STO building outline. Defines the outer boundary. Click canvas to place.' } },
  { id: 'post', icon: Square, label: 'Post',
    tip: { ru: 'Рабочий пост (подъёмник). Привязывается к реальному посту по номеру. На карте показывает статус и авто.', en: 'Work post (lift). Links to real post by number. Shows status and vehicle on map.' } },
  { id: 'zone', icon: Hexagon, label: 'Zone',
    tip: { ru: 'Свободная зона / зона ожидания. Показывает количество автомобилей в зоне.', en: 'Free zone / waiting area. Shows vehicle count in the zone.' } },
  { id: 'camera', icon: Camera, label: 'Camera',
    tip: { ru: 'Камера видеонаблюдения. По клику на карте откроется стрим с камеры.', en: 'Surveillance camera. Clicking on map opens the camera stream.' } },
  { id: 'driveway', icon: ArrowRightLeft, label: 'Driveway',
    tip: { ru: 'Проезд / проезжая часть. Рисует границы проезда для автомобилей между постами и зонами. Можно растягивать и поворачивать.', en: 'Driveway / roadway. Draws driveway boundaries between posts and zones. Can be resized and rotated.' } },
  { id: 'door', icon: DoorOpen, label: 'Door',
    tip: { ru: 'Дверь / ворота / въезд. Визуальный элемент для обозначения входов.', en: 'Door / gate / entrance. Visual element marking entry points.' } },
  { id: 'wall', icon: Minus, label: 'Wall',
    tip: { ru: 'Стена / перегородка. Визуальный элемент для обозначения границ.', en: 'Wall / partition. Visual element marking boundaries.' } },
  { id: 'label', icon: Type, label: 'Label',
    tip: { ru: 'Текстовая подпись. Добавьте название зоны, направление или примечание.', en: 'Text label. Add zone name, direction or note.' } },
];

export default function MapEditor() {
  const { t, i18n } = useTranslation();
  const { user, api } = useAuth();
  const toast = useToast();

  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tool, setTool] = useState('select');
  const [bgImage, setBgImage] = useState(null);
  const [bgDataUrl, setBgDataUrl] = useState(null);
  const [showGrid, setShowGrid] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 900, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [layoutId, setLayoutId] = useState(null);
  const [mapName, setMapName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const fileInputRef = useRef(null);

  const selected = elements.find(e => e.id === selectedId) || null;

  // Resize canvas to fit container
  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setStageSize({ width: rect.width, height: rect.height });
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Attach transformer to selected node
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    const stage = stageRef.current;
    if (selectedId && tool === 'select') {
      const node = stage.findOne(`#${selectedId}`);
      if (node) { trRef.current.nodes([node]); trRef.current.getLayer().batchDraw(); return; }
    }
    trRef.current.nodes([]);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedId, tool, elements]);

  // Load layout from API on mount, fallback to draft from localStorage
  useEffect(() => {
    let cancelled = false;
    const loadFromApi = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/api/map-layout');
        if (!cancelled && data) {
          setLayoutId(data.id || null);
          setMapName(data.name || '');
          if (data.elements) setElements(data.elements);
          if (data.bgImage) loadImageFromUrl(data.bgImage);
          setLoading(false);
          return;
        }
      } catch { /* API unavailable, fall through to draft */ }
      // Fallback: load draft from localStorage
      if (!cancelled) {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          try {
            const data = JSON.parse(saved);
            if (data.elements) setElements(data.elements);
            if (data.mapName) setMapName(data.mapName);
            if (data.bgDataUrl) loadImageFromUrl(data.bgDataUrl);
          } catch { /* ignore */ }
        }
      }
      if (!cancelled) setLoading(false);
    };
    loadFromApi();
    return () => { cancelled = true; };
  }, []);

  // Draft autosave to localStorage every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const draft = { elements, bgDataUrl, mapName };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 30000);
    return () => clearInterval(interval);
  }, [elements, bgDataUrl, mapName]);

  const loadImageFromUrl = useCallback((dataUrl) => {
    setBgDataUrl(dataUrl);
    const img = new window.Image();
    img.onload = () => setBgImage(img);
    img.src = dataUrl;
  }, []);

  // Background upload
  const handleBgUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadImageFromUrl(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Save to API
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: mapName || 'Untitled',
        width: stageSize.width,
        height: stageSize.height,
        bgImage: bgDataUrl,
        elements,
      };
      let res;
      if (layoutId) {
        res = await api.put('/api/map-layout/' + layoutId, payload);
      } else {
        res = await api.post('/api/map-layout', payload);
      }
      if (res.data?.id) setLayoutId(res.data.id);
      toast.success(t('mapEditor.saveSuccess') || 'Layout saved');
      // Clear draft after successful save
      localStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      toast.error((t('mapEditor.saveError') || 'Save failed') + ': ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // Load from API
  const handleLoad = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/map-layout');
      if (data) {
        setLayoutId(data.id || null);
        setMapName(data.name || '');
        setElements(data.elements || []);
        if (data.bgImage) loadImageFromUrl(data.bgImage);
        else { setBgImage(null); setBgDataUrl(null); }
        setSelectedId(null);
        toast.success(t('mapEditor.loadSuccess') || 'Layout loaded');
      } else {
        toast.info(t('mapEditor.noLayout') || 'No saved layout found');
      }
    } catch (err) {
      toast.error((t('mapEditor.loadError') || 'Load failed') + ': ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Export JSON
  const handleExport = () => {
    const data = JSON.stringify({ elements, bgDataUrl }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sto-map-layout.json'; a.click();
    URL.revokeObjectURL(url);
  };

  // Clear all
  const handleClear = () => {
    setElements([]); setSelectedId(null); setBgImage(null); setBgDataUrl(null);
    setLayoutId(null); setMapName('');
    localStorage.removeItem(DRAFT_KEY);
  };

  // Click on stage to add element
  const handleStageClick = (e) => {
    if (tool === 'select') {
      if (e.target === e.target.getStage()) setSelectedId(null);
      return;
    }
    const defaults = ELEMENT_DEFAULTS[tool];
    if (!defaults) return;
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    const x = (pointer.x - stagePos.x) / stageScale;
    const y = (pointer.y - stagePos.y) / stageScale;
    const el = {
      id: newId(), type: tool,
      x: x - defaults.width / 2, y: y - defaults.height / 2,
      width: defaults.width, height: defaults.height,
      rotation: 0, name: `${tool}-${elements.filter(e => e.type === tool).length + 1}`,
      color: defaults.color, data: defaults.data ? { ...defaults.data } : {},
    };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
    setTool('select');
  };

  // Zoom with wheel
  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.08;
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    const oldScale = stageScale;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.1, Math.min(5, newScale));
    const mousePointTo = { x: (pointer.x - stagePos.x) / oldScale, y: (pointer.y - stagePos.y) / oldScale };
    setStageScale(clampedScale);
    setStagePos({ x: pointer.x - mousePointTo.x * clampedScale, y: pointer.y - mousePointTo.y * clampedScale });
  };

  // Drag element
  const handleDragEnd = (id, e) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, x: e.target.x(), y: e.target.y() } : el));
  };

  // Transform element
  const handleTransformEnd = (id, e) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    setElements(prev => prev.map(el => el.id === id ? {
      ...el, x: node.x(), y: node.y(),
      width: Math.max(10, node.width() * scaleX),
      height: Math.max(10, node.height() * scaleY),
      rotation: node.rotation(),
    } : el));
  };

  // Update selected element property
  const updateProp = (key, value) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, [key]: value } : el));
  };

  // Delete selected
  const deleteSelected = () => {
    if (!selectedId) return;
    setElements(prev => prev.filter(e => e.id !== selectedId));
    setSelectedId(null);
  };

  // Zoom buttons
  const zoomIn = () => setStageScale(s => Math.min(5, s * 1.2));
  const zoomOut = () => setStageScale(s => Math.max(0.1, s / 1.2));
  const resetView = () => { setStageScale(1); setStagePos({ x: 0, y: 0 }); };

  // Grid lines (small 20px + bold every 100px)
  const gridLines = [];
  if (showGrid) {
    const step = 20;
    const w = stageSize.width / stageScale + Math.abs(stagePos.x / stageScale);
    const h = stageSize.height / stageScale + Math.abs(stagePos.y / stageScale);
    for (let i = 0; i < w; i += step) {
      const bold = i % 100 === 0;
      gridLines.push(<Line key={`gv${i}`} points={[i, 0, i, h]} stroke="#555" strokeWidth={bold ? 0.8 : 0.3} opacity={bold ? 0.4 : 0.2} />);
    }
    for (let i = 0; i < h; i += step) {
      const bold = i % 100 === 0;
      gridLines.push(<Line key={`gh${i}`} points={[0, i, w, i]} stroke="#555" strokeWidth={bold ? 0.8 : 0.3} opacity={bold ? 0.4 : 0.2} />);
    }
  }

  // Render element on canvas
  const renderElement = (el) => {
    const isSelected = el.id === selectedId;
    const common = {
      id: el.id, x: el.x, y: el.y, rotation: el.rotation,
      draggable: tool === 'select',
      onClick: () => { if (tool === 'select') setSelectedId(el.id); },
      onTap: () => { if (tool === 'select') setSelectedId(el.id); },
      onDragEnd: (e) => handleDragEnd(el.id, e),
      onTransformEnd: (e) => handleTransformEnd(el.id, e),
    };
    if (el.type === 'camera') {
      const cx = el.width / 2, cy = el.height / 2;
      const dir = (el.data?.direction || 0) * Math.PI / 180;
      const fov = (el.data?.fov || 90) * Math.PI / 180;
      const range = el.data?.range || 80;
      // FOV cone points: center → left edge → right edge
      const lx = cx + Math.cos(dir - fov / 2) * range;
      const ly = cy + Math.sin(dir - fov / 2) * range;
      const rx = cx + Math.cos(dir + fov / 2) * range;
      const ry = cy + Math.sin(dir + fov / 2) * range;
      // Mid-arc points for smoother cone
      const mx = cx + Math.cos(dir) * range;
      const my = cy + Math.sin(dir) * range;
      return (
        <Group key={el.id} {...common}>
          <Line points={[cx, cy, lx, ly, mx, my, rx, ry]} closed fill={el.color} opacity={0.15} stroke={el.color} strokeWidth={1} dash={[4, 2]} />
          <Circle x={cx} y={cy} radius={el.width / 2} fill={el.color} opacity={0.9} stroke={isSelected ? '#fff' : '#000'} strokeWidth={isSelected ? 2 : 1} />
          <Circle x={cx} y={cy} radius={3} fill="#fff" />
          <Text text={el.name} x={-20} y={el.height + 4} width={el.width + 40} fontSize={9} fill={el.color} align="center" />
        </Group>
      );
    }
    if (el.type === 'label') {
      return (
        <Group key={el.id} {...common}>
          <Text text={el.name} width={el.width} height={el.height} fontSize={14} fill={el.color} align="center" verticalAlign="middle" />
        </Group>
      );
    }
    // post, zone, door, wall — all rectangles
    return (
      <Group key={el.id} {...common}>
        <Rect width={el.width} height={el.height} fill={el.color} opacity={el.type === 'zone' ? 0.35 : 0.75} stroke={isSelected ? '#fff' : el.color} strokeWidth={isSelected ? 2 : 1} cornerRadius={el.type === 'post' ? 4 : 0} />
        {el.type !== 'wall' && (
          <Text text={el.name} width={el.width} height={el.height} fontSize={11} fill="#fff" align="center" verticalAlign="middle" padding={2} />
        )}
      </Group>
    );
  };

  const inputCls = "w-full px-2 py-1 rounded text-xs border outline-none";

  // Permission check: only admin / manage_zones
  if (user?.role !== 'admin' && !user?.permissions?.includes('manage_zones')) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">{t('common.error')}: Access denied</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ color: 'var(--text-primary)' }}>
      {/* Top Bar */}
      <div className="glass-static flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-glass)' }}>
        <h2 className="text-sm font-semibold mr-2" style={{ color: 'var(--accent)' }}>{t('mapEditor.title')}</h2>

        <input
          type="text"
          value={mapName}
          onChange={e => setMapName(e.target.value)}
          placeholder={t('mapEditor.mapName') || 'Map name'}
          className="px-2 py-1 rounded text-xs border outline-none"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)', width: 160 }}
        />

        <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleBgUpload} />
        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:opacity-80 transition-opacity" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
          <Upload size={13} /> {t('mapEditor.uploadBg')}
        </button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:opacity-80 transition-opacity disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>
          <Save size={13} /> {saving ? '...' : t('common.save')}
        </button>
        <button onClick={handleLoad} disabled={loading} className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:opacity-80 transition-opacity disabled:opacity-50" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
          <RefreshCw size={13} /> {loading ? '...' : t('mapEditor.load')}
        </button>
        <button onClick={handleExport} className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:opacity-80 transition-opacity" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
          <Download size={13} /> {t('mapEditor.exportJson')}
        </button>
        <button onClick={handleClear} className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:opacity-80 transition-opacity" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', color: '#ef4444' }}>
          <Trash2 size={13} /> {t('mapEditor.clear')}
        </button>

        <div className="flex-1" />

        <button onClick={() => setShowGrid(!showGrid)} className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:opacity-80 transition-opacity" style={{ background: showGrid ? 'var(--accent)' : 'var(--bg-card)', color: showGrid ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border-glass)' }}>
          <Grid3X3 size={13} /> {t('mapEditor.grid')}
        </button>
        <button onClick={zoomIn} className="p-1 rounded hover:opacity-80" style={{ color: 'var(--text-secondary)' }}><ZoomIn size={16} /></button>
        <button onClick={zoomOut} className="p-1 rounded hover:opacity-80" style={{ color: 'var(--text-secondary)' }}><ZoomOut size={16} /></button>
        <button onClick={resetView} className="p-1 rounded hover:opacity-80" style={{ color: 'var(--text-secondary)' }}><RotateCcw size={16} /></button>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{Math.round(stageScale * 100)}%</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <div className="glass-static flex flex-col gap-1 p-2 flex-shrink-0" style={{ width: 52, borderRight: '1px solid var(--border-glass)' }}>
          {TOOLS.map(tl => {
            const Icon = tl.icon;
            const active = tool === tl.id;
            const isRu = i18n.language === 'ru';
            return (
              <div key={tl.id} className="relative group">
                <button onClick={() => setTool(tl.id)}
                  className="flex items-center justify-center w-9 h-9 rounded-lg transition-all"
                  style={{ background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-secondary)' }}>
                  <Icon size={16} />
                </button>
                <div className="absolute left-12 top-0 z-50 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg"
                  style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', fontSize: '11px', whiteSpace: 'nowrap', minWidth: 180, maxWidth: 280, whiteSpace: 'normal' }}>
                  <div className="font-bold text-xs mb-1" style={{ color: 'var(--accent)' }}>{tl.label}</div>
                  {tl.tip?.[isRu ? 'ru' : 'en']}
                </div>
              </div>
            );
          })}
          <div className="flex-1" />
          <div className="relative group">
            <button className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 14 }}>?</span>
            </button>
            <div className="absolute left-12 bottom-0 z-50 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg"
              style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', fontSize: '11px', minWidth: 220, maxWidth: 300 }}>
              <div className="font-bold text-xs mb-2" style={{ color: 'var(--accent)' }}>
                {i18n.language === 'ru' ? 'Как пользоваться' : 'How to use'}
              </div>
              <div className="space-y-1" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {i18n.language === 'ru' ? (<>
                  <div>1. Загрузите фон (план СТО в PNG)</div>
                  <div>2. Выберите инструмент слева</div>
                  <div>3. Кликните на canvas для размещения</div>
                  <div>4. Перетаскивайте и меняйте размер</div>
                  <div>5. Правая панель — свойства элемента</div>
                  <div>6. Сохраните через кнопку «Сохранить»</div>
                  <div className="mt-1 pt-1" style={{ borderTop: '1px solid var(--border-glass)' }}>
                    <b>Колесо мыши</b> — масштаб<br/>
                    <b>Delete</b> — удалить выбранный<br/>
                    <b>Перетаскивание</b> — перемещение canvas
                  </div>
                </>) : (<>
                  <div>1. Upload background (STO plan PNG)</div>
                  <div>2. Select a tool from the left</div>
                  <div>3. Click on canvas to place element</div>
                  <div>4. Drag and resize elements</div>
                  <div>5. Right panel — element properties</div>
                  <div>6. Save via the "Save" button</div>
                  <div className="mt-1 pt-1" style={{ borderTop: '1px solid var(--border-glass)' }}>
                    <b>Mouse wheel</b> — zoom<br/>
                    <b>Delete</b> — remove selected<br/>
                    <b>Drag canvas</b> — pan view
                  </div>
                </>)}
              </div>
            </div>
          </div>
          <span className="text-center text-xs" style={{ color: 'var(--text-muted)', fontSize: 9 }}>{elements.length}</span>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 overflow-hidden" style={{ background: 'var(--bg-primary)', cursor: tool === 'select' ? 'default' : 'crosshair' }}>
          <Stage ref={stageRef} width={stageSize.width} height={stageSize.height}
            scaleX={stageScale} scaleY={stageScale} x={stagePos.x} y={stagePos.y}
            draggable={tool === 'select'}
            onDragEnd={(e) => { if (e.target === stageRef.current) setStagePos({ x: e.target.x(), y: e.target.y() }); }}
            onClick={handleStageClick} onTap={handleStageClick} onWheel={handleWheel}>
            <Layer>
              {bgImage && <KonvaImage image={bgImage} x={0} y={0} width={bgImage.width} height={bgImage.height} />}
              {gridLines}
              {elements.map(renderElement)}
              {selectedId && tool === 'select' && <Transformer ref={trRef} rotateEnabled enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']} boundBoxFunc={(oldBox, newBox) => { if (newBox.width < 10 || newBox.height < 10) return oldBox; return newBox; }} />}
            </Layer>
          </Stage>
        </div>

        {/* Right Properties Panel */}
        <div className="glass-static flex flex-col p-3 flex-shrink-0 overflow-y-auto" style={{ width: 200, borderLeft: '1px solid var(--border-glass)' }}>
          <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--accent)' }}>{t('mapEditor.properties')}</h3>
          {selected ? (
            <div className="space-y-2">
              <div>
                <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('mapEditor.elName')}</label>
                <input value={selected.name} onChange={e => updateProp('name', e.target.value)} className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('mapEditor.elType')}</label>
                <select value={selected.type} onChange={e => updateProp('type', e.target.value)} className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}>
                  {Object.keys(ELEMENT_DEFAULTS).map(tp => <option key={tp} value={tp}>{tp}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('mapEditor.elColor')}</label>
                <input type="color" value={selected.color} onChange={e => updateProp('color', e.target.value)} className="w-full h-7 rounded cursor-pointer border-0" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>W</label>
                  <input type="number" value={Math.round(selected.width)} onChange={e => updateProp('width', +e.target.value)} className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
                </div>
                <div className="flex-1">
                  <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>H</label>
                  <input type="number" value={Math.round(selected.height)} onChange={e => updateProp('height', +e.target.value)} className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>X</label>
                  <input type="number" value={Math.round(selected.x)} onChange={e => updateProp('x', +e.target.value)} className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
                </div>
                <div className="flex-1">
                  <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>Y</label>
                  <input type="number" value={Math.round(selected.y)} onChange={e => updateProp('y', +e.target.value)} className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('mapEditor.rotation')}</label>
                <input type="number" value={Math.round(selected.rotation)} onChange={e => updateProp('rotation', +e.target.value)} className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
              </div>
              {selected.type === 'camera' && (
                <div className="space-y-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-glass)' }}>
                  <label className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                    {i18n.language === 'ru' ? 'Поле зрения камеры' : 'Camera FOV'}
                  </label>
                  <div>
                    <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {i18n.language === 'ru' ? 'Направление (0-360°)' : 'Direction (0-360°)'}
                    </label>
                    <input type="range" min="0" max="360" value={selected.data?.direction || 0}
                      onChange={e => updateProp('data', { ...selected.data, direction: +e.target.value })}
                      className="w-full" />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selected.data?.direction || 0}°</span>
                  </div>
                  <div>
                    <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {i18n.language === 'ru' ? 'Угол обзора (°)' : 'FOV angle (°)'}
                    </label>
                    <input type="range" min="10" max="180" value={selected.data?.fov || 90}
                      onChange={e => updateProp('data', { ...selected.data, fov: +e.target.value })}
                      className="w-full" />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selected.data?.fov || 90}°</span>
                  </div>
                  <div>
                    <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {i18n.language === 'ru' ? 'Дальность (px)' : 'Range (px)'}
                    </label>
                    <input type="range" min="20" max="200" value={selected.data?.range || 80}
                      onChange={e => updateProp('data', { ...selected.data, range: +e.target.value })}
                      className="w-full" />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selected.data?.range || 80}px</span>
                  </div>
                </div>
              )}
              <button onClick={deleteSelected} className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs mt-2 hover:opacity-80 transition-opacity" style={{ background: '#ef44441a', color: '#ef4444', border: '1px solid #ef444433' }}>
                <Trash2 size={12} /> {t('common.delete')}
              </button>
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('mapEditor.noSelection')}</p>
          )}

          {/* Elements list */}
          <h3 className="text-xs font-semibold mt-4 mb-2" style={{ color: 'var(--accent)' }}>{t('mapEditor.elements')}</h3>
          <div className="space-y-0.5 overflow-y-auto flex-1" style={{ maxHeight: 300 }}>
            {elements.map(el => (
              <button key={el.id} onClick={() => { setSelectedId(el.id); setTool('select'); }}
                className="w-full text-left px-2 py-1 rounded text-xs truncate transition-all"
                style={{
                  background: el.id === selectedId ? 'var(--accent-light)' : 'transparent',
                  color: el.id === selectedId ? 'var(--accent)' : 'var(--text-secondary)',
                }}>
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: el.color, verticalAlign: 'middle' }} />
                {el.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
