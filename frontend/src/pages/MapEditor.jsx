import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Stage, Layer, Rect, Circle, Text, Group, Line, Transformer, Image as KonvaImage } from 'react-konva';
import {
  MousePointer2, Square, Hexagon, Camera, DoorOpen, Type, Minus, Maximize2, ArrowRightLeft,
  Upload, Save, Download, Trash2, Grid3X3, RotateCcw, ZoomIn, ZoomOut, RefreshCw,
  Magnet, Copy, Undo2, Redo2, PenTool, LayoutDashboard, Check, X, Edit2,
} from 'lucide-react';
import HelpButton from '../components/HelpButton';
import { MAP_FONT_FAMILY, MAP_LETTER_SPACING } from '../constants';

const ELEMENT_DEFAULTS = {
  building: { width: 0, height: 0, color: '#22c55e', points: [] },
  driveway: { width: 300, height: 40, color: '#f59e0b' },
  post:   { width: 120, height: 80, color: '#3b82f6' },
  zone:   { width: 160, height: 100, color: '#22c55e' },
  camera: { width: 24, height: 24, color: '#ef4444', data: { direction: 0, fov: 90, range: 80 } },
  door:   { width: 60, height: 8, color: '#f59e0b', thickness: 8 },
  wall:   { width: 200, height: 6, color: '#6b7280', thickness: 6 },
  label:  { width: 100, height: 30, color: '#a855f7' },
  infozone: { width: 200, height: 150, color: '#8b5cf6' },
};

const AREA_TYPES = new Set(['building', 'post', 'zone', 'driveway', 'infozone']);

// Scale font size relative to element dimensions
const calcFontSize = (w, h, base = 0.3, min = 10, max = 28) =>
  Math.round(Math.max(min, Math.min(Math.min(w, h) * base, max)));

const SNAP_STEP = 10;
const HISTORY_LIMIT = 50;

const snapToGrid = (value, step = SNAP_STEP) => Math.round(value / step) * step;

let idCounter = Date.now();
const newId = () => `el-${idCounter++}`;

const TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select',
    tip: { ru: 'Выбор и перемещение элементов. Кликните на элемент для редактирования, перетащите для перемещения.', en: 'Select and move elements. Click to edit, drag to move.' } },
  { id: 'building', icon: PenTool, label: 'Building',
    tip: { ru: 'Контур здания СТО (полигон). Кликайте для добавления точек, двойной клик — завершить. Esc — отмена.', en: 'STO building outline (polygon). Click to add points, double-click to finish. Esc to cancel.' } },
  { id: 'post', icon: Square, label: 'Post',
    tip: { ru: 'Рабочий пост (подъёмник). Привязывается к реальному посту по номеру. На карте показывает статус и авто.', en: 'Work post (lift). Links to real post by number. Shows status and vehicle on map.' } },
  { id: 'zone', icon: Hexagon, label: 'Zone',
    tip: { ru: 'Свободная зона / зона ожидания. Показывает количество автомобилей в зоне.', en: 'Free zone / waiting area. Shows vehicle count in the zone.' } },
  { id: 'camera', icon: Camera, label: 'Camera',
    tip: { ru: 'Камера видеонаблюдения. По клику на карте откроется стрим с камеры.', en: 'Surveillance camera. Clicking on map opens the camera stream.' } },
  { id: 'driveway', icon: ArrowRightLeft, label: 'Driveway',
    tip: { ru: 'Проезд / проезжая часть. Рисует границы проезда для автомобилей между постами и зонами. Можно растягивать и поворачивать.', en: 'Driveway / roadway. Draws driveway boundaries between posts and zones. Can be resized and rotated.' } },
  { id: 'door', icon: DoorOpen, label: 'Door',
    tip: { ru: 'Дверь / ворота / въезд. Кликайте для добавления точек, Применить — завершить. Ширину можно настроить в свойствах.', en: 'Door / gate / entrance. Click to add points, Apply to finish. Width adjustable in properties.' } },
  { id: 'wall', icon: Minus, label: 'Wall',
    tip: { ru: 'Стена / перегородка. Кликайте для добавления точек, двойной клик — завершить. Толщину можно настроить в свойствах.', en: 'Wall / partition. Click to add points, double-click to finish. Thickness adjustable in properties.' } },
  { id: 'label', icon: Type, label: 'Label',
    tip: { ru: 'Текстовая подпись. Добавьте название зоны, направление или примечание.', en: 'Text label. Add zone name, direction or note.' } },
  { id: 'infozone', icon: LayoutDashboard, label: 'Info Zone',
    tip: { ru: 'Зона для легенды и доп. информации. На карте просмотра здесь отобразится легенда статусов и статистика.', en: 'Legend & info area. Shows status legend and stats on the map viewer.' } },
];

export default function MapEditor() {
  const { t, i18n } = useTranslation();
  const { user, api } = useAuth();
  const toast = useToast();

  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [tool, setTool] = useState('select');
  const [bgImage, setBgImage] = useState(null);
  const [bgDataUrl, setBgDataUrl] = useState(null);
  const [bgOpacity, setBgOpacity] = useState(0.5);
  const [showGrid, setShowGrid] = useState(true);
  const [stageSize, setStageSize] = useState({ width: 900, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [layoutId, setLayoutId] = useState(null);
  const [mapName, setMapName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [drawingPolygon, setDrawingPolygon] = useState(null); // { points: [x,y,...], elType: 'building'|... }

  // Map frame — fixed container representing the final map area
  const [mapFrame, setMapFrame] = useState({ width: 935, height: 680 });

  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const fileInputRef = useRef(null);
  const pageRef = useRef(null);

  // Закрываем редактор при смене выделения / инструмента / удалении элемента
  useEffect(() => {
    if (editingId && editingId !== selectedId) setEditingId(null);
  }, [selectedId, editingId]);
  useEffect(() => {
    if (tool !== 'select') setEditingId(null);
  }, [tool]);

  // Undo/Redo history
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);

  const pushHistory = useCallback((els) => {
    if (isUndoRedoRef.current) return;
    const h = historyRef.current;
    const idx = historyIndexRef.current;
    // Trim future states
    historyRef.current = h.slice(0, idx + 1);
    historyRef.current.push(JSON.stringify(els));
    if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    isUndoRedoRef.current = true;
    setElements(JSON.parse(historyRef.current[historyIndexRef.current]));
    isUndoRedoRef.current = false;
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    isUndoRedoRef.current = true;
    setElements(JSON.parse(historyRef.current[historyIndexRef.current]));
    isUndoRedoRef.current = false;
  }, []);

  const selected = elements.find(e => e.id === selectedId) || null;

  // Set page height to fill viewport exactly
  useEffect(() => {
    const setHeight = () => {
      if (!pageRef.current) return;
      const top = pageRef.current.getBoundingClientRect().top;
      pageRef.current.style.height = `${window.innerHeight - top}px`;
    };
    setHeight();
    window.addEventListener('resize', setHeight);
    return () => window.removeEventListener('resize', setHeight);
  }, []);

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

  // Attach transformer to selected node (skip for polygon-mode elements)
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    const stage = stageRef.current;
    const sel = elements.find(e => e.id === selectedId);
    const isPolygon = sel?.shapeMode === 'polygon';
    if (selectedId && tool === 'select' && !isPolygon) {
      const node = stage.findOne(`#${selectedId}`);
      if (node) { trRef.current.nodes([node]); trRef.current.getLayer().batchDraw(); return; }
    }
    trRef.current.nodes([]);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedId, tool, elements]);

  // Load layout from API — moved after fitFrameToView/loadImageFromUrl declarations
  const loadLayoutOnMount = useRef(false);

  // Track element changes for undo/redo
  useEffect(() => {
    pushHistory(elements);
  }, [elements, pushHistory]);

  // Keyboard shortcuts: Ctrl+Z, Ctrl+Shift+Z, Ctrl+D, Delete, Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.key === 'Z') { e.preventDefault(); redo(); }
      if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); duplicateSelected(); }
      if (e.key === 'Delete' && selectedId) { e.preventDefault(); deleteSelected(); }
      if (e.key === 'Escape' && drawingPolygon) { e.preventDefault(); setDrawingPolygon(null); setTool('select'); }
      // Arrow keys — move selected element (Shift = 1px, default = 5px)
      if (selectedId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 5;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        setElements(prev => prev.map(el => el.id === selectedId ? { ...el, x: el.x + dx, y: el.y + dy } : el));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedId, elements, drawingPolygon]);


  // Fit view to map frame
  const fitFrameToView = useCallback(() => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    if (cw < 10 || ch < 10) return;
    const s = Math.min(cw / mapFrame.width, ch / mapFrame.height);
    const offsetX = (cw - mapFrame.width * s) / 2;
    const offsetY = (ch - mapFrame.height * s) / 2;
    setStageScale(s);
    setStagePos({ x: offsetX, y: offsetY });
  }, [mapFrame]);

  // Auto-fit frame on mount and when mapFrame changes
  useEffect(() => {
    // Delay to ensure container has final layout dimensions
    const t = setTimeout(fitFrameToView, 100);
    window.addEventListener('resize', fitFrameToView);
    return () => { clearTimeout(t); window.removeEventListener('resize', fitFrameToView); };
  }, [fitFrameToView]);

  const loadImageFromUrl = useCallback((dataUrl) => {
    setBgDataUrl(dataUrl);
    const img = new window.Image();
    img.onload = () => {
      setBgImage(img);
      // Fit view to map frame after loading image
      setTimeout(fitFrameToView, 50);
    };
    img.src = dataUrl;
  }, [fitFrameToView]);

  // Background upload (supports images + PDF)
  const handleBgUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      // PDF → render to canvas → PNG data URL
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const scale = 2; // high-res
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        loadImageFromUrl(dataUrl);
        toast.success(i18n.language === 'ru' ? `PDF загружен (${canvas.width}×${canvas.height}px)` : `PDF loaded (${canvas.width}×${canvas.height}px)`);
      } catch (err) {
        console.error('PDF render error:', err);
        toast.error(i18n.language === 'ru' ? 'Ошибка загрузки PDF' : 'PDF load error');
      }
    } else {
      // Image file
      const reader = new FileReader();
      reader.onload = (ev) => loadImageFromUrl(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Load layout from API on mount
  useEffect(() => {
    if (loadLayoutOnMount.current) return;
    loadLayoutOnMount.current = true;
    let cancelled = false;
    const loadFromApi = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/api/map-layout');
        if (!cancelled && data) {
          setLayoutId(data.id || null);
          setMapName(data.name || '');
          if (data.elements) setElements(data.elements);
          if (data.mapFrame) setMapFrame(data.mapFrame);
          else if (data.width && data.height) setMapFrame({ width: data.width, height: data.height });
          if (data.bgImage) loadImageFromUrl(data.bgImage);
          else setTimeout(fitFrameToView, 50);
        }
      } catch (err) {
        console.error('Failed to load layout:', err);
      }
      if (!cancelled) setLoading(false);
    };
    loadFromApi();
    return () => { cancelled = true; };
  }, [loadImageFromUrl, fitFrameToView]);

  // Save to API
  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: mapName || 'Untitled',
      width: mapFrame.width,
      height: mapFrame.height,
      bgImage: bgDataUrl,
      elements,
    };
    try {
      let res;
      if (layoutId) {
        res = await api.put('/api/map-layout/' + layoutId, payload);
      } else {
        res = await api.post('/api/map-layout', payload);
      }
      if (res.data?.id) setLayoutId(res.data.id);
      toast.success(t('mapEditor.saveSuccess') || 'Layout saved');
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
        if (data.mapFrame) setMapFrame(data.mapFrame);
          else if (data.width && data.height) setMapFrame({ width: data.width, height: data.height });
        if (data.bgImage) loadImageFromUrl(data.bgImage);
        else { setBgImage(null); setBgDataUrl(null); setTimeout(fitFrameToView, 50); }
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

  // Finish polygon drawing — create element of given type
  const finishPolygon = useCallback((pts, elType) => {
    const type = elType || 'building';
    const minPts = (type === 'wall' || type === 'door') ? 4 : 6; // wall/door needs 2+ points, others 3+
    if (!pts || pts.length < minPts) return;
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const maxX = Math.max(...xs), maxY = Math.max(...ys);
    const relPoints = pts.map((v, i) => i % 2 === 0 ? v - minX : v - minY);
    const defaults = ELEMENT_DEFAULTS[type] || {};
    const el = {
      id: newId(), type,
      x: minX, y: minY,
      width: maxX - minX, height: maxY - minY,
      rotation: 0, name: `${type}-${elements.filter(e => e.type === type).length + 1}`,
      color: defaults.color || '#22c55e',
      points: relPoints, shapeMode: 'polygon',
      data: { ...(defaults.data || {}), ...(defaults.thickness != null ? { thickness: defaults.thickness } : {}) },
    };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
    setDrawingPolygon(null);
    setTool('select');
  }, [elements]);

  // Check if currently in polygon drawing mode
  const isPolygonDrawing = drawingPolygon !== null;

  // Click on stage to add element
  const handleStageClick = (e) => {
    if (tool === 'select') {
      if (e.target === e.target.getStage()) setSelectedId(null);
      return;
    }

    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    const x = (pointer.x - stagePos.x) / stageScale;
    const y = (pointer.y - stagePos.y) / stageScale;
    const px = snapEnabled ? snapToGrid(x) : x;
    const py = snapEnabled ? snapToGrid(y) : y;

    // Polygon drawing mode (building/wall/door always, others when activated via drawingPolygon)
    if (isPolygonDrawing || tool === 'building' || tool === 'wall' || tool === 'door') {
      const drawType = drawingPolygon?.elType || tool;
      if (!drawingPolygon) {
        setDrawingPolygon({ points: [px, py], elType: drawType });
      } else {
        const fp = drawingPolygon.points;
        const dist = Math.hypot(px - fp[0], py - fp[1]);
        if (drawType !== 'wall' && drawType !== 'door' && fp.length >= 6 && dist < 15 / stageScale) {
          finishPolygon(fp, drawingPolygon.elType);
        } else {
          let nx = px, ny = py;
          // Wall/Door/Driveway: constrain to 90° angles (horizontal/vertical segments only)
          if ((drawType === 'wall' || drawType === 'door' || drawType === 'driveway') && fp.length >= 2) {
            const prevX = fp[fp.length - 2], prevY = fp[fp.length - 1];
            const dx = Math.abs(px - prevX), dy = Math.abs(py - prevY);
            if (dx >= dy) { ny = prevY; } else { nx = prevX; }
          }
          setDrawingPolygon(prev => ({ ...prev, points: [...prev.points, nx, ny] }));
        }
      }
      return;
    }

    const defaults = ELEMENT_DEFAULTS[tool];
    if (!defaults) return;
    const el = {
      id: newId(), type: tool,
      x: px - defaults.width / 2, y: py - defaults.height / 2,
      width: defaults.width, height: defaults.height,
      rotation: 0, name: `${tool}-${elements.filter(e => e.type === tool).length + 1}`,
      color: defaults.color, shapeMode: 'rect',
      data: defaults.data ? { ...defaults.data } : {},
    };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
    setTool('select');
  };

  // Double-click to finish polygon
  const handleStageDblClick = (e) => {
    if (!drawingPolygon) return;
    const dblMinPts = (drawingPolygon.elType === 'wall' || drawingPolygon.elType === 'door') ? 4 : 6;
    if (drawingPolygon.points.length >= dblMinPts) {
      e.evt?.preventDefault();
      finishPolygon(drawingPolygon.points, drawingPolygon.elType);
    }
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

  // Drag element (with optional snap)
  const handleDragEnd = (id, e) => {
    let x = e.target.x(), y = e.target.y();
    if (snapEnabled) { x = snapToGrid(x); y = snapToGrid(y); e.target.x(x); e.target.y(y); }
    setElements(prev => prev.map(el => el.id === id ? { ...el, x, y } : el));
  };

  // Transform element (with optional snap) — use stored el.width/height, NOT node.width()
  const handleTransformEnd = (id, e) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    let x = node.x(), y = node.y();
    const currentEl = elements.find(el => el.id === id);
    let w = Math.max(10, (currentEl?.width || 100) * scaleX);
    let h = Math.max(10, (currentEl?.height || 100) * scaleY);
    if (snapEnabled) { x = snapToGrid(x); y = snapToGrid(y); w = snapToGrid(w); h = snapToGrid(h); node.x(x); node.y(y); }
    setElements(prev => prev.map(el => el.id === id ? {
      ...el, x, y, width: w, height: h, rotation: node.rotation(),
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

  // Duplicate selected element
  const duplicateSelected = () => {
    const el = elements.find(e => e.id === selectedId);
    if (!el) return;
    const copy = {
      ...el,
      id: newId(),
      x: el.x + 20,
      y: el.y + 20,
      name: el.name + (i18n.language === 'ru' ? ' (копия)' : ' (copy)'),
      data: el.data ? { ...el.data } : {},
    };
    setElements(prev => [...prev, copy]);
    setSelectedId(copy.id);
  };

  // Polygon vertex editing
  const handleVertexDrag = (elId, vertexIndex, e) => {
    let x = e.target.x(), y = e.target.y();
    if (snapEnabled) { x = snapToGrid(x); y = snapToGrid(y); }
    setElements(prev => prev.map(el => {
      if (el.id !== elId) return el;
      const pts = [...el.points];
      pts[vertexIndex * 2] = x;
      pts[vertexIndex * 2 + 1] = y;
      return { ...el, points: pts };
    }));
  };

  const addVertexOnEdge = (elId, edgeIndex, pos) => {
    setElements(prev => prev.map(el => {
      if (el.id !== elId) return el;
      const pts = [...el.points];
      const insertAt = (edgeIndex + 1) * 2;
      pts.splice(insertAt, 0, pos.x, pos.y);
      return { ...el, points: pts };
    }));
  };

  const removeVertex = (elId, vertexIndex) => {
    setElements(prev => prev.map(el => {
      if (el.id !== elId) return el;
      const pts = [...el.points];
      if (pts.length <= 4) return el; // min 2 points
      pts.splice(vertexIndex * 2, 2);
      return { ...el, points: pts };
    }));
  };

  // Zoom buttons
  const zoomIn = () => setStageScale(s => Math.min(5, s * 1.2));
  const zoomOut = () => setStageScale(s => Math.max(0.1, s / 1.2));

  const resetView = () => fitFrameToView();

  // Grid lines inside map frame only (small 20px + bold every 100px)
  const gridLines = [];
  if (showGrid) {
    const step = 20;
    const fw = mapFrame.width, fh = mapFrame.height;
    for (let i = 0; i <= fw; i += step) {
      const bold = i % 100 === 0;
      gridLines.push(<Line key={`gv${i}`} points={[i, 0, i, fh]} stroke="#555" strokeWidth={bold ? 0.8 : 0.3} opacity={bold ? 0.4 : 0.2} />);
    }
    for (let i = 0; i <= fh; i += step) {
      const bold = i % 100 === 0;
      gridLines.push(<Line key={`gh${i}`} points={[0, i, fw, i]} stroke="#555" strokeWidth={bold ? 0.8 : 0.3} opacity={bold ? 0.4 : 0.2} />);
    }
  }

  // Render element on canvas
  const renderElement = (el) => {
    const isSelected = el.id === selectedId;
    const common = {
      id: el.id, x: el.x, y: el.y, rotation: el.rotation || 0,
      draggable: tool === 'select',
      onClick: () => { if (tool === 'select') setSelectedId(el.id); },
      onTap: () => { if (tool === 'select') setSelectedId(el.id); },
      onContextMenu: (e) => {
        e.evt.preventDefault();
        if (tool !== 'select') return;
        setSelectedId(el.id);
        setEditingId(el.id);
      },
      onDragEnd: (e) => handleDragEnd(el.id, e),
      onTransformEnd: (e) => handleTransformEnd(el.id, e),
    };

    const isAreaType = AREA_TYPES.has(el.type);
    const isPolygon = el.shapeMode === 'polygon' && el.points?.length >= 4;

    // ── POLYGON MODE for any area type ──
    if (isAreaType && isPolygon) {
      const pts = el.points;
      const vertexColor = '#e11d48';
      const fillOpacity = el.type === 'building' ? 0.08 : el.type === 'zone' ? 0.2
        : el.type === 'driveway' ? 0.25 : 0.15;
      const dash = el.type === 'building' ? [8, 4] : el.type === 'infozone' ? [4, 4]
        : el.type === 'driveway' ? [8, 4] : undefined;
      return (
        <Group key={el.id} {...common}>
          <Line points={pts} closed fill={el.color} opacity={fillOpacity}
            stroke={el.color} strokeWidth={isSelected ? 3 : 2} dash={dash} />
          {isSelected && pts.length >= 4 && (() => {
            // Edge midpoints — click to add vertex
            const edges = [];
            const numPts = pts.length / 2;
            for (let i = 0; i < numPts; i++) {
              const ni = (i + 1) % numPts;
              const mx = (pts[i * 2] + pts[ni * 2]) / 2;
              const my = (pts[i * 2 + 1] + pts[ni * 2 + 1]) / 2;
              edges.push(
                <Circle key={`edge${i}`} x={mx} y={my} radius={5}
                  fill="#3b82f6" stroke="#fff" strokeWidth={1.5} opacity={0.6}
                  hitStrokeWidth={10}
                  onClick={() => addVertexOnEdge(el.id, i, { x: mx, y: my })}
                  onTap={() => addVertexOnEdge(el.id, i, { x: mx, y: my })} />
              );
            }
            return edges;
          })()}
          {isSelected && pts.length >= 2 && Array.from({ length: pts.length / 2 }, (_, i) => (
            <Circle key={i} x={pts[i * 2]} y={pts[i * 2 + 1]} radius={10}
              fill={vertexColor} stroke="#fff" strokeWidth={3}
              shadowBlur={6} shadowColor={vertexColor} shadowOpacity={0.6}
              draggable
              onDragEnd={(e) => handleVertexDrag(el.id, i, e)}
              onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; removeVertex(el.id, i); }} />
          ))}
          {(() => {
            const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
            const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
            const fs = calcFontSize(bw || 100, bh || 60, 0.25, 11, 24);
            return <Text text={el.name} x={Math.min(...xs)} y={Math.min(...ys) - fs - 4}
              fontSize={fs} fill={el.color} fontStyle="600"
              fontFamily={MAP_FONT_FAMILY}
              letterSpacing={MAP_LETTER_SPACING.header} />;
          })()}
        </Group>
      );
    }

    // ── RECT MODE for area types ──
    if (isAreaType) {
      const w = el.width || 100, h = el.height || 60;
      const fillOpacity = el.type === 'building' ? 0.08 : el.type === 'zone' ? 0.35
        : el.type === 'infozone' ? 0.1 : el.type === 'driveway' ? 0.25 : 0.75;
      const dash = el.type === 'building' ? [8, 4] : el.type === 'infozone' ? [4, 4]
        : el.type === 'driveway' ? [8, 4] : undefined;
      const cr = el.type === 'post' ? 4 : el.type === 'infozone' ? 8 : 0;
      return (
        <Group key={el.id} {...common}>
          {/* Hit rect for proper Transformer sizing */}
          <Rect width={w} height={h} fill={el.color} opacity={fillOpacity}
            stroke={isSelected ? '#fff' : el.color} strokeWidth={isSelected ? 2 : 1}
            cornerRadius={cr} dash={dash} />
          <Text text={el.name} width={w} height={h}
            fontSize={calcFontSize(w, h, el.type === 'driveway' ? 0.55 : 0.3, 11, 28)}
            fill={el.type === 'building' || el.type === 'infozone' || el.type === 'driveway' ? el.color : '#fff'}
            fontStyle={el.type === 'building' || el.type === 'infozone' || el.type === 'driveway' ? '700' : '500'}
            fontFamily={MAP_FONT_FAMILY}
            letterSpacing={MAP_LETTER_SPACING.header}
            align="center" verticalAlign="middle" padding={4} />
        </Group>
      );
    }

    // ── Camera ──
    if (el.type === 'camera') {
      const cx = el.width / 2, cy = el.height / 2;
      const dir = (el.data?.direction || 0) * Math.PI / 180;
      const fov = (el.data?.fov || 90) * Math.PI / 180;
      const range = el.data?.range || 80;
      const lx = cx + Math.cos(dir - fov / 2) * range;
      const ly = cy + Math.sin(dir - fov / 2) * range;
      const rx = cx + Math.cos(dir + fov / 2) * range;
      const ry = cy + Math.sin(dir + fov / 2) * range;
      const mx = cx + Math.cos(dir) * range;
      const my = cy + Math.sin(dir) * range;
      return (
        <Group key={el.id} {...common}>
          <Line points={[cx, cy, lx, ly, mx, my, rx, ry]} closed fill={el.color} opacity={0.15} stroke={el.color} strokeWidth={1} dash={[4, 2]} />
          <Circle x={cx} y={cy} radius={el.width / 2} fill={el.color} opacity={0.9} stroke={isSelected ? '#fff' : '#000'} strokeWidth={isSelected ? 2 : 1} />
          <Circle x={cx} y={cy} radius={3} fill="#fff" />
          <Text text={el.name} x={cx} y={-Math.max(10, Math.round(el.width * 0.5)) - 4}
            fontSize={Math.max(10, Math.round(el.width * 0.5))} fill={el.color} fontStyle="600"
            fontFamily={MAP_FONT_FAMILY}
            letterSpacing={MAP_LETTER_SPACING.header}
            rotation={-(el.rotation || 0)} offsetX={0} align="left" />
        </Group>
      );
    }

    // ── Label ──
    if (el.type === 'label') {
      return (
        <Group key={el.id} {...common}>
          <Rect width={el.width} height={el.height} fill="transparent" />
          <Text text={el.name} width={el.width} height={el.height}
            fontSize={calcFontSize(el.width, el.height, 0.45, 12, 32)} fill={el.color}
            fontFamily={MAP_FONT_FAMILY} fontStyle="500"
            align="center" verticalAlign="middle" />
        </Group>
      );
    }

    // ── Wall / Door (polygon mode) ──
    if ((el.type === 'wall' || el.type === 'door') && el.shapeMode === 'polygon' && el.points?.length >= 4) {
      const pts = el.points;
      const thickness = el.data?.thickness || 6;
      const vertexColor = '#e11d48';
      return (
        <Group key={el.id} {...common}>
          <Line points={pts} closed={false} stroke={el.color} strokeWidth={thickness}
            opacity={0.85} lineCap="round" lineJoin="round" />
          {isSelected && (
            <Line points={pts} closed={false} stroke="#fff" strokeWidth={thickness + 4}
              opacity={0.15} lineCap="round" lineJoin="round" />
          )}
          {isSelected && pts.length >= 4 && (() => {
            const edges = [];
            const numPts = pts.length / 2;
            for (let i = 0; i < numPts - 1; i++) {
              const mx = (pts[i * 2] + pts[(i + 1) * 2]) / 2;
              const my = (pts[i * 2 + 1] + pts[(i + 1) * 2 + 1]) / 2;
              edges.push(
                <Circle key={`edge${i}`} x={mx} y={my} radius={4}
                  fill="#3b82f6" stroke="#fff" strokeWidth={1} opacity={0.6}
                  hitStrokeWidth={10}
                  onClick={() => addVertexOnEdge(el.id, i, { x: mx, y: my })}
                  onTap={() => addVertexOnEdge(el.id, i, { x: mx, y: my })} />
              );
            }
            return edges;
          })()}
          {isSelected && pts.length >= 2 && Array.from({ length: pts.length / 2 }, (_, i) => (
            <Circle key={i} x={pts[i * 2]} y={pts[i * 2 + 1]} radius={6}
              fill={vertexColor} stroke="#fff" strokeWidth={2}
              shadowBlur={4} shadowColor={vertexColor} shadowOpacity={0.6}
              draggable
              onDragEnd={(e) => handleVertexDrag(el.id, i, e)}
              onContextMenu={(e) => { e.evt.preventDefault(); e.cancelBubble = true; removeVertex(el.id, i); }} />
          ))}
        </Group>
      );
    }

    // ── Door, Wall (rect mode, legacy) ──
    return (
      <Group key={el.id} {...common}>
        <Rect width={el.width} height={el.height} fill={el.color} opacity={0.75} stroke={isSelected ? '#fff' : el.color} strokeWidth={isSelected ? 2 : 1} />
        {el.type !== 'wall' && (
          <Text text={el.name} width={el.width} height={el.height}
            fontSize={calcFontSize(el.width, el.height, 0.4, 10, 24)} fill="#fff"
            fontFamily={MAP_FONT_FAMILY} fontStyle="500"
            align="center" verticalAlign="middle" padding={2} />
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
    <div ref={pageRef} className="flex flex-col overflow-hidden" style={{ color: 'var(--text-primary)' }}>
      {/* Top Bar */}
      <div className="glass-static flex items-center gap-1 px-2 py-1 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-glass)' }}>
        <HelpButton pageKey="mapEditor" />
        <input
          type="text"
          value={mapName}
          onChange={e => setMapName(e.target.value)}
          placeholder={t('mapEditor.mapName') || 'Map name'}
          className="px-1.5 py-0.5 rounded text-xs border outline-none"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)', width: 130 }}
        />
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.pdf,application/pdf" className="hidden" onChange={handleBgUpload} />
        {[
          { key: 'upload', onClick: () => fileInputRef.current?.click(), icon: Upload, tip: { ru: 'Загрузить фон (PNG, JPG, PDF)', en: 'Upload background (PNG, JPG, PDF)' }, color: 'var(--text-secondary)' },
        ].map(btn => (
          <div key={btn.key} className="relative group">
            <button onClick={btn.onClick} className="p-1 rounded hover:opacity-80" style={{ color: btn.color }}>
              <btn.icon size={14} />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg whitespace-nowrap"
              style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(12px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', fontSize: '11px' }}>
              {btn.tip[i18n.language === 'ru' ? 'ru' : 'en']}
            </div>
          </div>
        ))}
        <button onClick={() => loadImageFromUrl('/data/sto-plan.png')} className="px-1.5 py-0.5 rounded text-[10px] hover:opacity-80" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
          {i18n.language === 'ru' ? 'План' : 'Plan'}
        </button>
        {bgImage && (<>
          <div className="relative group">
            <button onClick={() => { setBgImage(null); setBgDataUrl(null); }} className="p-1 rounded hover:opacity-80" style={{ color: '#ef4444' }}>
              <X size={14} />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg whitespace-nowrap"
              style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(12px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', fontSize: '11px' }}>
              {i18n.language === 'ru' ? 'Убрать фон' : 'Remove bg'}
            </div>
          </div>
          <input type="range" min="0" max="100" value={Math.round(bgOpacity * 100)}
            onChange={e => setBgOpacity(+e.target.value / 100)}
            title={`${i18n.language === 'ru' ? 'Прозрачность' : 'Opacity'}: ${Math.round(bgOpacity * 100)}%`}
            style={{ width: 50, accentColor: 'var(--accent)' }} />
        </>)}
        <div style={{ width: 1, height: 16, background: 'var(--border-glass)' }} />
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] hover:opacity-80 disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>
          <Save size={12} /> {saving ? '...' : t('common.save')}
        </button>
        {[
          { key: 'load', onClick: handleLoad, icon: RefreshCw, tip: { ru: 'Загрузить с сервера', en: 'Load from server' }, color: 'var(--text-secondary)', disabled: loading },
          { key: 'export', onClick: handleExport, icon: Download, tip: { ru: 'Экспорт JSON', en: 'Export JSON' }, color: 'var(--text-secondary)' },
          { key: 'clear', onClick: handleClear, icon: Trash2, tip: { ru: 'Очистить всё', en: 'Clear all' }, color: '#ef4444' },
        ].map(btn => (
          <div key={btn.key} className="relative group">
            <button onClick={btn.onClick} disabled={btn.disabled} className="p-1 rounded hover:opacity-80 disabled:opacity-50" style={{ color: btn.color }}>
              <btn.icon size={14} />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg whitespace-nowrap"
              style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(12px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', fontSize: '11px' }}>
              {btn.tip[i18n.language === 'ru' ? 'ru' : 'en']}
            </div>
          </div>
        ))}
        <div className="flex-1" />
        {[
          { key: 'undo', onClick: undo, icon: Undo2, tip: { ru: 'Отменить (Ctrl+Z)', en: 'Undo (Ctrl+Z)' }, color: 'var(--text-secondary)' },
          { key: 'redo', onClick: redo, icon: Redo2, tip: { ru: 'Повторить (Ctrl+Shift+Z)', en: 'Redo (Ctrl+Shift+Z)' }, color: 'var(--text-secondary)' },
          { key: 'sep1', sep: true },
          { key: 'snap', onClick: () => setSnapEnabled(!snapEnabled), icon: Magnet, tip: { ru: 'Привязка к сетке', en: 'Snap to grid' }, color: snapEnabled ? 'var(--accent)' : 'var(--text-muted)' },
          { key: 'grid', onClick: () => setShowGrid(!showGrid), icon: Grid3X3, tip: { ru: 'Сетка', en: 'Grid' }, color: showGrid ? 'var(--accent)' : 'var(--text-muted)' },
          { key: 'zoomIn', onClick: zoomIn, icon: ZoomIn, tip: { ru: 'Приблизить', en: 'Zoom in' }, color: 'var(--text-secondary)' },
          { key: 'zoomOut', onClick: zoomOut, icon: ZoomOut, tip: { ru: 'Отдалить', en: 'Zoom out' }, color: 'var(--text-secondary)' },
          { key: 'reset', onClick: resetView, icon: RotateCcw, tip: { ru: 'Сбросить вид', en: 'Reset view' }, color: 'var(--text-secondary)' },
        ].map(btn => btn.sep ? (
          <div key={btn.key} style={{ width: 1, height: 16, background: 'var(--border-glass)' }} />
        ) : (
          <div key={btn.key} className="relative group">
            <button onClick={btn.onClick} className="p-1 rounded hover:opacity-80" style={{ color: btn.color }}>
              <btn.icon size={14} />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg whitespace-nowrap"
              style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(12px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', fontSize: '11px' }}>
              {btn.tip[i18n.language === 'ru' ? 'ru' : 'en']}
            </div>
          </div>
        ))}
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{Math.round(stageScale * 100)}%</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <div className="glass-static flex flex-col gap-0.5 p-1.5 flex-shrink-0" style={{ width: 44, borderRight: '1px solid var(--border-glass)' }}>
          {TOOLS.map(tl => {
            const Icon = tl.icon;
            const active = tool === tl.id;
            const isRu = i18n.language === 'ru';
            return (
              <div key={tl.id} className="relative group">
                <button onClick={() => { setTool(tl.id); if (tl.id !== 'select') setSelectedId(null); }}
                  className="flex items-center justify-center w-8 h-8 rounded-md transition-all"
                  style={{
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    boxShadow: active ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                  }}>
                  <Icon size={15} />
                </button>
                <div className="absolute top-0 z-50 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg"
                  style={{ left: 'calc(100% + 8px)', background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', fontSize: '11px', minWidth: 180, maxWidth: 260 }}>
                  <div className="font-bold text-xs mb-1" style={{ color: 'var(--accent)' }}>{tl.label}</div>
                  <div style={{ lineHeight: 1.4 }}>{tl.tip?.[isRu ? 'ru' : 'en']}</div>
                </div>
              </div>
            );
          })}
          <div className="flex-1" />
          <div className="relative group">
            <button className="flex items-center justify-center w-8 h-8 rounded-md" style={{ color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 13 }}>?</span>
            </button>
            <div className="absolute bottom-0 z-50 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg"
              style={{ left: 'calc(100% + 8px)', background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', fontSize: '11px', minWidth: 220, maxWidth: 300 }}>
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
        <div ref={containerRef} className="flex-1 overflow-hidden relative" style={{ background: 'var(--bg-primary)', cursor: tool === 'select' ? 'default' : 'crosshair' }}>
          {/* Polygon drawing toolbar */}
          {(tool === 'building' || tool === 'wall' || tool === 'door' || isPolygonDrawing) && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-lg"
              style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(12px)', border: '1px solid #22c55e55', color: '#22c55e' }}>
              <PenTool size={14} />
              {drawingPolygon ? (<>
                <span className="text-xs font-medium">
                  {i18n.language === 'ru'
                    ? `Точек: ${drawingPolygon.points.length / 2}`
                    : `Points: ${drawingPolygon.points.length / 2}`}
                </span>
                {/* Undo last point */}
                <button onClick={() => {
                  if (drawingPolygon.points.length <= 2) {
                    setDrawingPolygon(null); setTool('select');
                  } else {
                    setDrawingPolygon(prev => ({ ...prev, points: prev.points.slice(0, -2) }));
                  }
                }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:opacity-80 transition-opacity"
                  style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)' }}>
                  <Undo2 size={12} /> {i18n.language === 'ru' ? 'Назад' : 'Undo'}
                </button>
                {/* Apply / Finish */}
                <button onClick={() => {
                  const minPts = (drawingPolygon.elType === 'wall' || drawingPolygon.elType === 'door') ? 4 : 6;
                  if (drawingPolygon.points.length >= minPts) {
                    finishPolygon(drawingPolygon.points, drawingPolygon.elType);
                  }
                }}
                  disabled={drawingPolygon.points.length < ((drawingPolygon.elType === 'wall' || drawingPolygon.elType === 'door') ? 4 : 6)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-30"
                  style={{ background: '#22c55e', color: '#fff' }}>
                  <Check size={12} /> {i18n.language === 'ru' ? 'Применить' : 'Apply'}
                </button>
                {/* Cancel */}
                <button onClick={() => { setDrawingPolygon(null); setTool('select'); }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:opacity-80 transition-opacity"
                  style={{ background: '#ef44441a', color: '#ef4444', border: '1px solid #ef444433' }}>
                  <X size={12} /> {i18n.language === 'ru' ? 'Отмена' : 'Cancel'}
                </button>
              </>) : (
                <span className="text-xs font-medium">
                  {i18n.language === 'ru'
                    ? 'Кликните для первой точки контура'
                    : 'Click to place first point'}
                </span>
              )}
            </div>
          )}
          <Stage ref={stageRef} width={stageSize.width} height={stageSize.height}
            scaleX={stageScale} scaleY={stageScale} x={stagePos.x} y={stagePos.y}
            draggable={tool === 'select'}
            onDragEnd={(e) => { if (e.target === stageRef.current) setStagePos({ x: e.target.x(), y: e.target.y() }); }}
            onClick={handleStageClick} onTap={handleStageClick}
            onDblClick={handleStageDblClick} onDblTap={handleStageDblClick}
            onWheel={handleWheel}>
            <Layer>
              {/* Map frame background */}
              <Rect x={0} y={0} width={mapFrame.width} height={mapFrame.height}
                fill="#0f172a" stroke="#f59e0b" strokeWidth={3 / stageScale}
                shadowColor="#f59e0b" shadowBlur={8 / stageScale} shadowOpacity={0.5} />
              {/* Background image fitted into map frame */}
              {bgImage && (() => {
                const s = Math.min(mapFrame.width / bgImage.width, mapFrame.height / bgImage.height);
                const bw = bgImage.width * s, bh = bgImage.height * s;
                return <KonvaImage image={bgImage} x={0} y={0} width={bw} height={bh} opacity={bgOpacity} />;
              })()}
              {gridLines}
              {elements.map(renderElement)}
              {/* Drawing polygon preview */}
              {drawingPolygon && drawingPolygon.points.length >= 2 && (
                <>
                  {/* Line connecting all placed points */}
                  {drawingPolygon.points.length >= 4 && (
                    <Line points={drawingPolygon.points}
                      stroke="#22c55e" strokeWidth={3} dash={[8, 4]}
                      fill="#22c55e" opacity={0.08} closed={false} />
                  )}
                  {/* Vertex dots */}
                  {Array.from({ length: drawingPolygon.points.length / 2 }, (_, i) => (
                    <Circle key={`dp${i}`}
                      x={drawingPolygon.points[i * 2]} y={drawingPolygon.points[i * 2 + 1]}
                      radius={i === 0 ? 12 : 10}
                      fill={i === 0 ? '#22c55e' : '#e11d48'} stroke="#fff" strokeWidth={3}
                      shadowBlur={8} shadowColor={i === 0 ? '#22c55e' : '#e11d48'} shadowOpacity={0.7} />
                  ))}
                  {/* Number labels on vertices */}
                  {Array.from({ length: drawingPolygon.points.length / 2 }, (_, i) => (
                    <Text key={`dpt${i}`}
                      x={drawingPolygon.points[i * 2] - 4} y={drawingPolygon.points[i * 2 + 1] - 5}
                      text={String(i + 1)} fontSize={10} fontStyle="700" fill="#fff"
                      fontFamily={MAP_FONT_FAMILY} />
                  ))}
                </>
              )}
              {selectedId && tool === 'select' && <Transformer ref={trRef} rotateEnabled enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']} boundBoxFunc={(oldBox, newBox) => { if (newBox.width < 10 || newBox.height < 10) return oldBox; return newBox; }} />}
            </Layer>
          </Stage>
        </div>

        {/* Right Properties Panel */}
        <div className="glass-static flex flex-col p-2 flex-shrink-0 overflow-y-auto" style={{ width: 160, borderLeft: '1px solid var(--border-glass)', minHeight: 0 }}>
          <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--accent)' }}>{t('mapEditor.properties')}</h3>
          {selected ? (editingId === selected.id ? (
            <div className="space-y-2">
              <button onClick={() => setEditingId(null)}
                className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-xs mb-1 hover:opacity-80 transition-opacity"
                style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)' }}>
                <X size={12} /> {i18n.language === 'ru' ? 'Свернуть' : 'Collapse'}
              </button>
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
              {/* Shape mode toggle for area elements */}
              {AREA_TYPES.has(selected.type) && (
                <div className="space-y-1 mt-1 pt-1" style={{ borderTop: '1px solid var(--border-glass)' }}>
                  <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    {i18n.language === 'ru' ? 'Форма' : 'Shape'}
                  </label>
                  <div className="flex gap-1">
                    <button onClick={() => {
                      if (selected.shapeMode === 'rect') return;
                      // Convert polygon → rect (use bounding box)
                      updateProp('shapeMode', 'rect');
                    }}
                      className="flex-1 px-2 py-1 rounded text-xs font-medium transition-all"
                      style={{
                        background: selected.shapeMode !== 'polygon' ? 'var(--accent)' : 'var(--bg-card)',
                        color: selected.shapeMode !== 'polygon' ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid var(--border-glass)',
                      }}>
                      <Square size={10} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
                      {i18n.language === 'ru' ? 'Прямоуг.' : 'Rect'}
                    </button>
                    <button onClick={() => {
                      if (selected.shapeMode === 'polygon') return;
                      // Start polygon drawing for this element type
                      const elType = selected.type;
                      setElements(prev => prev.filter(e => e.id !== selectedId));
                      setSelectedId(null);
                      setDrawingPolygon({ points: [], elType });
                      setTool(elType);
                    }}
                      className="flex-1 px-2 py-1 rounded text-xs font-medium transition-all"
                      style={{
                        background: selected.shapeMode === 'polygon' ? 'var(--accent)' : 'var(--bg-card)',
                        color: selected.shapeMode === 'polygon' ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid var(--border-glass)',
                      }}>
                      <PenTool size={10} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
                      {i18n.language === 'ru' ? 'Полигон' : 'Polygon'}
                    </button>
                  </div>
                </div>
              )}

              {/* W/H/X/Y/Rotation — show for rect-mode elements */}
              {selected.shapeMode !== 'polygon' && (<>
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
                  <input type="number" value={Math.round(selected.rotation || 0)} onChange={e => updateProp('rotation', +e.target.value)} className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
                </div>
              </>)}

              {/* Wall / Door thickness */}
              {(selected.type === 'wall' || selected.type === 'door') && selected.shapeMode === 'polygon' && (
                <div className="space-y-1 mt-1 pt-1" style={{ borderTop: '1px solid var(--border-glass)' }}>
                  <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    {i18n.language === 'ru' ? (selected.type === 'door' ? 'Ширина' : 'Толщина') : (selected.type === 'door' ? 'Width' : 'Thickness')}
                  </label>
                  <input type="range" min="2" max="40" value={selected.data?.thickness || 6}
                    onChange={e => updateProp('data', { ...selected.data, thickness: +e.target.value })}
                    className="w-full" />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selected.data?.thickness || 6}px</span>
                </div>
              )}

              {/* Polygon info: point count + redraw button */}
              {selected.shapeMode === 'polygon' && selected.points?.length >= 4 && (
                <div className="space-y-2 mt-1">
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {i18n.language === 'ru' ? 'Точек:' : 'Points:'} {selected.points.length / 2}
                  </div>
                  <div className="space-y-0.5 max-h-32 overflow-y-auto">
                    {Array.from({ length: selected.points.length / 2 }, (_, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span className="w-4">{i + 1}.</span>
                        <span>{Math.round(selected.points[i * 2])}, {Math.round(selected.points[i * 2 + 1])}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => {
                    const elType = selected.type;
                    setElements(prev => prev.filter(e => e.id !== selectedId));
                    setSelectedId(null);
                    setDrawingPolygon({ points: [], elType });
                    setTool(elType);
                  }}
                    className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs hover:opacity-80 transition-opacity"
                    style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--border-glass)' }}>
                    <PenTool size={12} /> {i18n.language === 'ru' ? 'Перерисовать' : 'Redraw'}
                  </button>
                </div>
              )}

              {/* Post-specific properties (number, label, postType) — синхронизируются в БД через mapSyncService */}
              {selected.type === 'post' && (
                <div className="space-y-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-glass)' }}>
                  <label className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                    {i18n.language === 'ru' ? 'Параметры поста' : 'Post properties'}
                  </label>
                  <div>
                    <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {i18n.language === 'ru' ? 'Номер' : 'Number'}
                    </label>
                    <input type="number" min="1" value={selected.number ?? ''}
                      onChange={e => updateProp('number', e.target.value === '' ? null : +e.target.value)}
                      className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {i18n.language === 'ru' ? 'Метка (RU)' : 'Label (RU)'}
                    </label>
                    <input value={selected.label || ''} onChange={e => updateProp('label', e.target.value)}
                      placeholder={i18n.language === 'ru' ? 'Пост 4 — легковое' : 'e.g. Пост 4 — легковое'}
                      className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {i18n.language === 'ru' ? 'Метка (EN)' : 'Label (EN)'}
                    </label>
                    <input value={selected.labelEn || ''} onChange={e => updateProp('labelEn', e.target.value)}
                      placeholder="Post 4 — light"
                      className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {i18n.language === 'ru' ? 'Тип поста' : 'Post type'}
                    </label>
                    <select value={selected.postType || 'light'} onChange={e => updateProp('postType', e.target.value)}
                      className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}>
                      <option value="light">light</option>
                      <option value="heavy">heavy</option>
                      <option value="special">special</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {i18n.language === 'ru' ? 'Имя зоны во внешнем CV API' : 'External CV zone name'}
                    </label>
                    <input value={selected.externalZoneName || ''} onChange={e => updateProp('externalZoneName', e.target.value)}
                      placeholder={i18n.language === 'ru' ? 'Пост 04 — легковое/грузовое' : 'CV API zone name'}
                      className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
                  </div>
                </div>
              )}

              {/* Zone-specific properties (label, zoneType) */}
              {selected.type === 'zone' && (
                <div className="space-y-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-glass)' }}>
                  <label className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                    {i18n.language === 'ru' ? 'Параметры зоны' : 'Zone properties'}
                  </label>
                  <div>
                    <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {i18n.language === 'ru' ? 'Метка (RU)' : 'Label (RU)'}
                    </label>
                    <input value={selected.label || ''} onChange={e => updateProp('label', e.target.value)}
                      className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {i18n.language === 'ru' ? 'Метка (EN)' : 'Label (EN)'}
                    </label>
                    <input value={selected.labelEn || ''} onChange={e => updateProp('labelEn', e.target.value)}
                      className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {i18n.language === 'ru' ? 'Тип зоны' : 'Zone type'}
                    </label>
                    <select value={selected.zoneType || 'repair'} onChange={e => updateProp('zoneType', e.target.value)}
                      className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}>
                      <option value="repair">repair</option>
                      <option value="waiting">waiting</option>
                      <option value="entry">entry</option>
                      <option value="parking">parking</option>
                      <option value="free">free</option>
                    </select>
                  </div>
                </div>
              )}

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
              <button onClick={handleSave} disabled={saving} className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs mt-2 hover:opacity-80 transition-opacity disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>
                <Save size={12} /> {saving ? '...' : t('common.save')}
              </button>
              <button onClick={() => {
                const elType = selected.type;
                setElements(prev => prev.filter(e => e.id !== selectedId));
                setSelectedId(null);
                setDrawingPolygon({ points: [], elType });
                setTool(elType);
              }} className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs mt-1 hover:opacity-80 transition-opacity" style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--border-glass)' }}>
                <PenTool size={12} /> {i18n.language === 'ru' ? 'Перерисовать' : 'Redraw'}
              </button>
              <button onClick={duplicateSelected} className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs mt-1 hover:opacity-80 transition-opacity" style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--border-glass)' }}>
                <Copy size={12} /> {t('mapEditor.duplicate')} <span className="opacity-50 ml-1">Ctrl+D</span>
              </button>
              <button onClick={deleteSelected} className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs mt-1 hover:opacity-80 transition-opacity" style={{ background: '#ef44441a', color: '#ef4444', border: '1px solid #ef444433' }}>
                <Trash2 size={12} /> {t('common.delete')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>
                <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: selected.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{selected.name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{selected.type}</div>
                </div>
              </div>
              <button onClick={() => setEditingId(selected.id)}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs hover:opacity-80 transition-opacity"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                <Edit2 size={12} /> {i18n.language === 'ru' ? 'Редактировать' : 'Edit'}
              </button>
              <p className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                {i18n.language === 'ru' ? 'ПКМ по элементу или иконка карандаша в списке' : 'Right-click element or pencil icon in list'}
              </p>
              <button onClick={duplicateSelected} className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs mt-1 hover:opacity-80 transition-opacity" style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--border-glass)' }}>
                <Copy size={12} /> {t('mapEditor.duplicate')} <span className="opacity-50 ml-1">Ctrl+D</span>
              </button>
              <button onClick={deleteSelected} className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs mt-1 hover:opacity-80 transition-opacity" style={{ background: '#ef44441a', color: '#ef4444', border: '1px solid #ef444433' }}>
                <Trash2 size={12} /> {t('common.delete')}
              </button>
            </div>
          )) : (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('mapEditor.noSelection')}</p>
              <div className="pt-2" style={{ borderTop: '1px solid var(--border-glass)' }}>
                <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--accent)' }}>
                  {i18n.language === 'ru' ? 'Размер карты' : 'Map Size'}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>W</label>
                    <input type="number" value={mapFrame.width} onChange={e => setMapFrame(f => ({ ...f, width: +e.target.value || 100 }))} className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>H</label>
                    <input type="number" value={mapFrame.height} onChange={e => setMapFrame(f => ({ ...f, height: +e.target.value || 100 }))} className={inputCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
                  </div>
                </div>
                <button onClick={fitFrameToView} className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs mt-2 hover:opacity-80 transition-opacity" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                  <Maximize2 size={12} /> {i18n.language === 'ru' ? 'Вписать' : 'Fit'}
                </button>
              </div>
            </div>
          )}

          {/* Elements list */}
          <h3 className="text-xs font-semibold mt-4 mb-2" style={{ color: 'var(--accent)' }}>{t('mapEditor.elements')}</h3>
          <div className="space-y-0.5 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
            {elements.map(el => (
              <div key={el.id}
                className="group flex items-center gap-1 rounded transition-all"
                style={{
                  background: el.id === selectedId ? 'var(--accent-light)' : 'transparent',
                }}>
                <button onClick={() => { setSelectedId(el.id); setTool('select'); }}
                  className="flex-1 text-left px-2 py-1 text-xs truncate"
                  style={{ color: el.id === selectedId ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: el.color, verticalAlign: 'middle' }} />
                  {el.name}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); setEditingId(el.id); setTool('select'); }}
                  title={i18n.language === 'ru' ? 'Редактировать' : 'Edit'}
                  aria-label={i18n.language === 'ru' ? 'Редактировать' : 'Edit'}
                  className="flex-shrink-0 p-1 mr-1 rounded opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-[var(--bg-card)] transition-opacity"
                  style={{ color: editingId === el.id ? 'var(--accent)' : 'var(--text-muted)', opacity: editingId === el.id ? 1 : undefined }}>
                  <Edit2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
