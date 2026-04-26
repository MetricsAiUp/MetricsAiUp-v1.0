import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../../store/useStore';

// Direct fetch helpers for AnalysisTab-specific endpoints (settings, autopoll,
// monitoring). The store / client.js doesn't expose these, so they live here.
const api = (path, opts) => fetch(`./api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());
const apiGet = (path) => api(path);
const apiPut = (path, body) => api(path, { method: 'PUT', body: JSON.stringify(body) });

const getZones2d = (roomId, camId) => apiGet(`/rooms/${roomId}/cameras/${camId}/zones2d`);
const getSettings = () => apiGet('/settings');
const updateSettings = (data) => apiPut('/settings', data);
const getMonitoringState = () => apiGet('/monitoring/state');
const getAutoPollStatus = () => apiGet('/autopoll/status');

function SettingsPanel({ onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-20250514');
  const [analyzeMode, setAnalyzeMode] = useState('always');
  const [provider, setProvider] = useState('v2');
  const [anpr, setAnpr] = useState({
    anprHost: '', anprPort: '', anprUser: '', anprPassword: '',
    anprRequestQueue: '', anprAppId: '',
  });
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings().then(s => {
      setApiKey(s.anthropicApiKey || '');
      setModel(s.visionModel || 'claude-sonnet-4-20250514');
      setAnalyzeMode(s.analyzeMode || 'always');
      setProvider(s.visionProvider || 'v2');
      setAnpr({
        anprHost: s.anprHost || '',
        anprPort: s.anprPort || '',
        anprUser: s.anprUser || '',
        anprPassword: s.anprPassword || '',
        anprRequestQueue: s.anprRequestQueue || '',
        anprAppId: s.anprAppId || '',
      });
      setConfigured(s.configured);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateSettings({
        anthropicApiKey: apiKey,
        visionModel: model,
        analyzeMode,
        visionProvider: provider,
        ...anpr,
      });
      setConfigured(result.configured);
    } catch {}
    setSaving(false);
  };

  if (!loaded) return null;

  const setAnprField = (k, v) => setAnpr(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-slate-900 rounded-lg border border-slate-600 shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white mb-4">Settings</h3>
        <div className="space-y-4">

          {/* Provider toggle — top-level decision: Anthropic vs ANPR-RTX3070 */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Метод распознавания</label>
            <div className="space-y-1.5">
              <label className="flex items-start gap-2 p-2 bg-slate-800/50 border border-slate-700 rounded cursor-pointer hover:bg-slate-800">
                <input
                  type="radio" name="visionProvider" value="v2"
                  checked={provider === 'v2'} onChange={() => setProvider('v2')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm text-slate-200">Сервер ANPR — RTX 3070 <span className="text-[0.65rem] text-slate-500">(по умолчанию)</span></div>
                  <div className="text-[0.65rem] text-slate-500">Локальный сервис распознавания во внутренней VPN — занятость, ТС, госномер.</div>
                </div>
              </label>
              <label className="flex items-start gap-2 p-2 bg-slate-800/50 border border-slate-700 rounded cursor-pointer hover:bg-slate-800">
                <input
                  type="radio" name="visionProvider" value="claude"
                  checked={provider === 'claude'} onChange={() => setProvider('claude')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm text-slate-200">Anthropic (Claude Vision)</div>
                  <div className="text-[0.65rem] text-slate-500">Внешний платный провайдер. Используется ключ и модель ниже.</div>
                </div>
              </label>
            </div>
          </div>

          {/* ANPR connection — shown when v2 is selected (collapsed otherwise) */}
          {provider === 'v2' && (
            <div className="border border-slate-700 rounded p-3 bg-slate-800/30 space-y-2">
              <div className="text-xs text-slate-400 font-medium">ANPR-сервер (RabbitMQ)</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[0.65rem] text-slate-500 block mb-0.5">IP / Host</label>
                  <input
                    type="text" value={anpr.anprHost}
                    onChange={e => setAnprField('anprHost', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[0.65rem] text-slate-500 block mb-0.5">Port</label>
                  <input
                    type="number" value={anpr.anprPort}
                    onChange={e => setAnprField('anprPort', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[0.65rem] text-slate-500 block mb-0.5">Логин</label>
                  <input
                    type="text" value={anpr.anprUser}
                    onChange={e => setAnprField('anprUser', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[0.65rem] text-slate-500 block mb-0.5">Пароль</label>
                  <input
                    type="password" value={anpr.anprPassword}
                    onChange={e => setAnprField('anprPassword', e.target.value)}
                    placeholder={anpr.anprPassword?.startsWith('****') ? '' : 'пароль'}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="text-[0.65rem] text-slate-500 block mb-0.5">Очередь запросов</label>
                <input
                  type="text" value={anpr.anprRequestQueue}
                  onChange={e => setAnprField('anprRequestQueue', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-[0.65rem] text-slate-500 block mb-0.5">App ID <span className="text-slate-600">(очередь ответов: plate_results_v2_&lt;app_id&gt;)</span></label>
                <input
                  type="text" value={anpr.anprAppId}
                  onChange={e => setAnprField('anprAppId', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
            </div>
          )}

          {/* Anthropic credentials — kept as-is, only relevant when provider=claude */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Anthropic API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-api03-..."
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200"
            />
            {configured && apiKey.startsWith('****') && (
              <div className="text-xs text-green-400 mt-1">Key configured. Enter new key to replace.</div>
            )}
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Vision Model (only used if Anthropic provider is active)</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200"
            >
              <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (recommended)</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (faster, cheaper)</option>
              <option value="claude-opus-4-6">Claude Opus 4.6 (most accurate)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Режим анализа</label>
            <div className="space-y-1.5">
              <label className="flex items-start gap-2 p-2 bg-slate-800/50 border border-slate-700 rounded cursor-pointer hover:bg-slate-800">
                <input
                  type="radio"
                  name="analyzeMode"
                  value="always"
                  checked={analyzeMode === 'always'}
                  onChange={() => setAnalyzeMode('always')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm text-slate-200">Всегда анализировать</div>
                  <div className="text-[0.65rem] text-slate-500">Каждый цикл шлёт все кадры в распознавание. Подходит, когда сервис распознавания локальный/бесплатный (текущий v2).</div>
                </div>
              </label>
              <label className="flex items-start gap-2 p-2 bg-slate-800/50 border border-slate-700 rounded cursor-pointer hover:bg-slate-800">
                <input
                  type="radio"
                  name="analyzeMode"
                  value="on_change"
                  checked={analyzeMode === 'on_change'}
                  onChange={() => setAnalyzeMode('on_change')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm text-slate-200">Только при изменениях</div>
                  <div className="text-[0.65rem] text-slate-500">Цикл пропускает зону, если кадры не отличаются от прошлого раза (JPEG-хеш). Экономит вызовы при платном/внешнем провайдере.</div>
                </div>
              </label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Translate a server lifecycle event to a human log line.
function eventToLogMsg(ev) {
  switch (ev.name) {
    case 'autopoll_started': return `[AutoPoll] Started (${Math.round((ev.intervalMs || 0) / 1000)}s)`;
    case 'autopoll_stopped': return `[AutoPoll] Stopped`;
    case 'cycle_start':      return `════════ Цикл #${ev.cycleNum} ════════`;
    case 'cycle_end':        return `════════ Цикл завершён: ${ev.analyzed || 0} analyzed, ${ev.skipped || 0} skipped, ${Math.round((ev.durationMs || 0) / 1000)}s, ${ev.apiCalls || 0} API ════════`;
    case 'cycle_skipped':    return `[AutoPoll] Cycle skipped (previous still running)`;
    case 'zone_start':       return `"${ev.zoneName}" — fetching ${(ev.cameras || []).length} cams...`;
    case 'crop_fetched':     return `  ${ev.camName}: ${Math.round((ev.jpegSize || 0) / 1024)}KB ${ev.changed ? '⚡ CHANGED' : '— no change'}`;
    case 'crop_error':       return `  ${ev.camName}: ✕ ERROR ${ev.error}`;
    case 'zone_skipped':     return `  ⏭ SKIP — no visual changes`;
    case 'camera_call':      return `  → ${ev.camName}: sending to ${ev.provider || 'vision'}...`;
    case 'camera_result':    return `  ← ${ev.camName}: ${ev.occupied ? '🔴 OCCUPIED' : '🟢 FREE'} [${ev.confidence || ''}] ${ev.latencyMs || 0}ms`;
    case 'camera_error':     return `  ✕ ${ev.camName}: ${ev.error}`;
    case 'zone_result':      return `  ━━ ${ev.status === 'occupied' ? '🔴 ЗАНЯТ' : '🟢 СВОБОДЕН'} ━━`;
    default:                 return `[${ev.name}] ${JSON.stringify(ev)}`;
  }
}

export default function AnalysisTab({ currentRoom }) {
  // Pull room list + selector from the global store so this tab can switch
  // ремзоны without forcing the user back to the 3D tab.
  const { rooms, fetchRoom } = useStore();

  // Auto-select the first room when this tab is opened and nothing is selected
  // yet. Done once per rooms-list change; explicit user picks aren't overridden.
  useEffect(() => {
    if (!currentRoom && rooms && rooms.length > 0) {
      fetchRoom(rooms[0].id);
    }
  }, [currentRoom, rooms, fetchRoom]);

  const [zoneMap, setZoneMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [autoPollRunning, setAutoPollRunning] = useState(false);
  const [autoPollStats, setAutoPollStats] = useState(null);
  const [monitoringState, setMonitoringState] = useState([]);
  const [liveState, setLiveState] = useState({ phase: 'idle', currentZone: null, currentCamera: null, cycleNum: 0 });
  const logRef = useRef(null);
  // zoneMap mirror — applyEvent reads camera rect/resolution from here
  // without re-creating the callback on every zoneMap change.
  const zoneMapRef = useRef({});
  useEffect(() => { zoneMapRef.current = zoneMap; }, [zoneMap]);

  const addLog = useCallback((msg, time) => {
    const t = time ? new Date(time).toLocaleTimeString('ru-RU') : new Date().toLocaleTimeString('ru-RU');
    setLogs(prev => [...prev.slice(-300), { time: t, msg }]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs.length]);

  // Check API config
  useEffect(() => {
    getSettings().then(s => setApiConfigured(s.configured)).catch(() => {});
  }, [showSettings]);

  // Poll monitoring state every 5s — DB is source of truth for last-known status.
  useEffect(() => {
    const load = () => {
      getMonitoringState().then(setMonitoringState).catch(() => {});
    };
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  // Apply a single server event to local state — log line + zoneMap status + liveState.
  const applyEvent = useCallback((ev) => {
    addLog(eventToLogMsg(ev), ev.ts);

    // liveState — always reflects the latest "what's happening now".
    setLiveState(prev => {
      const next = { ...prev };
      if (ev.name === 'cycle_start') { next.cycleNum = ev.cycleNum; next.phase = 'cycling'; }
      if (ev.name === 'cycle_end')   { next.phase = 'idle'; next.currentZone = null; next.currentCamera = null; }
      if (ev.name === 'zone_start')  { next.phase = 'fetching'; next.currentZone = ev.zoneName; next.currentCamera = null; }
      if (ev.name === 'camera_call') { next.phase = 'analyzing'; next.currentZone = ev.zoneName; next.currentCamera = ev.camName; }
      if (ev.name === 'autopoll_started') next.phase = 'cycling';
      if (ev.name === 'autopoll_stopped') next.phase = 'idle';
      return next;
    });

    // zoneMap status reflection: highlight active zone, mark skipped/done as cycle moves.
    if (ev.name === 'zone_start') {
      const local = zoneMapRef.current[ev.zoneName];
      // Seed analyses[] preserving the PREVIOUS cycle's result per camera.
      // We mark each tile pending=true (spinner), but keep the prior
      // occupied/vehicle/plate so a skipped tile (no re-analysis this cycle)
      // can still show what was there last time. Crops are fetched on
      // `crop_fetched` — not here — to avoid showing the previous cycle's
      // image after the server has already started fetching a new one.
      setZoneMap(prev => {
        const prevZone = prev[ev.zoneName];
        if (!prevZone) return prev;
        const prevByCam = {};
        for (const a of (prevZone.analyses || [])) prevByCam[a.camId] = a;
        const seeded = (local?.cameras || []).map(c => {
          const old = prevByCam[c.camId] || {};
          return {
            // Carry forward last known recognition data
            ...old,
            camId: c.camId,
            camName: c.camName,
            // Reset transient state for the new cycle
            pending: true,
            error: false,
            errorMsg: undefined,
            skipped: false,
          };
        });
        return { ...prev, [ev.zoneName]: { ...prevZone, status: 'analyzing', analyses: seeded } };
      });
    }
    if (ev.name === 'crop_fetched') {
      // Server just cached a fresh JPEG for this (zone,camId) — pull it down
      // for display. `ts=ev.ts` cache-busts the browser/proxy.
      const url = `./api/autopoll/crop?zone=${encodeURIComponent(ev.zoneName)}&camId=${encodeURIComponent(ev.camId)}&ts=${ev.ts}`;
      fetch(url)
        .then(r => r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`)))
        .then(blob => {
          const imageUrl = URL.createObjectURL(blob);
          setZoneMap(prev => {
            const z = prev[ev.zoneName];
            if (!z) return prev;
            const analyses = (z.analyses || []).map(a => {
              if (a.camId !== ev.camId) return a;
              // Revoke the previous object URL to avoid memory leaks across cycles.
              if (a.imageUrl) { try { URL.revokeObjectURL(a.imageUrl); } catch {} }
              // Server now returns the FULL camera frame; we keep rect/resolution
              // on the tile so the renderer can CSS-crop to the zone area.
              return { ...a, imageUrl, rect: ev.rect || a.rect, resolution: ev.resolution || a.resolution };
            });
            return { ...prev, [ev.zoneName]: { ...z, analyses } };
          });
        })
        .catch(() => { /* tile keeps spinner; camera_result/error will resolve it */ });
    }
    if (ev.name === 'camera_result') {
      // Merge per-camera analysis result into the matching tile.
      setZoneMap(prev => {
        const z = prev[ev.zoneName];
        if (!z) return prev;
        const analyses = z.analyses.map(a =>
          a.camId === ev.camId
            ? {
                ...a,
                pending: false,
                occupied: ev.occupied,
                confidence: ev.confidence,
                vehicle: ev.vehicle,
                plate: ev.plate,
                worksInProgress: ev.worksInProgress,
                peopleCount: ev.peopleCount,
                openParts: ev.openParts,
                description: ev.description,
              }
            : a
        );
        return { ...prev, [ev.zoneName]: { ...z, analyses } };
      });
    }
    if (ev.name === 'camera_error') {
      setZoneMap(prev => {
        const z = prev[ev.zoneName];
        if (!z) return prev;
        const analyses = z.analyses.map(a =>
          a.camId === ev.camId
            ? { ...a, pending: false, error: true, errorMsg: ev.error, occupied: false }
            : a
        );
        return { ...prev, [ev.zoneName]: { ...z, analyses } };
      });
    }
    if (ev.name === 'crop_error') {
      // Server failed to fetch crop — that camera will never reach Claude
      // and won't emit camera_result. Clear pending now or the tile spins forever.
      setZoneMap(prev => {
        const z = prev[ev.zoneName];
        if (!z) return prev;
        const analyses = z.analyses.map(a =>
          a.camId === ev.camId
            ? { ...a, pending: false, error: true, errorMsg: ev.error || 'crop fetch failed', occupied: false }
            : a
        );
        return { ...prev, [ev.zoneName]: { ...z, analyses } };
      });
    }
    if (ev.name === 'zone_skipped') {
      // Cycle skipped this zone — no recognition call. The previous
      // occupied/vehicle/plate values were preserved on zone_start, so just
      // drop pending and tag the tile as `skipped` to render a "БЕЗ ИЗМ."
      // overlay on top of the prior result.
      setZoneMap(prev => {
        const z = prev[ev.zoneName];
        if (!z) return prev;
        const analyses = (z.analyses || []).map(a =>
          a.pending ? { ...a, pending: false, skipped: true } : a
        );
        return { ...prev, [ev.zoneName]: { ...z, status: 'skipped', analyses } };
      });
    }
    if (ev.name === 'zone_result') {
      // After zone_result, any tile still pending means it never went through
      // Claude (e.g. silent error path) — clear it.
      setZoneMap(prev => {
        const z = prev[ev.zoneName];
        if (!z) return prev;
        const analyses = (z.analyses || []).map(a =>
          a.pending ? { ...a, pending: false, error: true, errorMsg: 'no result' } : a
        );
        return { ...prev, [ev.zoneName]: { ...z, status: 'done', result: ev.status, lastResultAt: ev.ts, analyses } };
      });
      // After each zone finishes, refresh DB-backed monitoring state so the
      // zone card shows the freshly-saved car/plate without waiting for the
      // 5s poll.
      getMonitoringState().then(setMonitoringState).catch(() => {});
    }
    if (ev.name === 'cycle_end') {
      // Refresh stats after cycle completes.
      getAutoPollStatus().then(s => {
        setAutoPollStats(s);
        setAutoPollRunning(!!s.running);
      }).catch(() => {});
    }
  }, [addLog]);

  // Subscribe to server-side event stream + load initial snapshot.
  // This is the entire driver loop now — no browser-side setInterval.
  useEffect(() => {
    let cancelled = false;

    // 1) One-shot snapshot so a freshly-opened page shows current state immediately.
    fetch('./api/autopoll/state')
      .then(r => r.json())
      .then(snap => {
        if (cancelled) return;
        if (snap.liveState) setLiveState(snap.liveState);
        if (snap.stats) {
          setAutoPollStats(snap.stats);
          setAutoPollRunning(!!snap.stats.running);
        }
        if (Array.isArray(snap.recentEvents)) {
          for (const ev of snap.recentEvents) {
            addLog(eventToLogMsg(ev), ev.ts);
          }
        }
      })
      .catch(() => {});

    // 2) Live event stream via SSE.
    const es = new EventSource('./api/autopoll/events');
    es.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data);
        applyEvent(ev);
      } catch {}
    };
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here.
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [applyEvent, addLog]);

  // The server owns autopoll lifecycle (autopollEnabled + autopollIntervalMs in
  // settings.json). This page is a pure observer — no start/stop/run-once UI.

  const cycleRunning = liveState.phase !== 'idle';
  const cycleProgress = liveState.currentZone
    ? `${liveState.currentZone}${liveState.currentCamera ? ` • ${liveState.currentCamera}` : ''}`
    : '';

  // Build zone-to-cameras mapping
  useEffect(() => {
    if (!currentRoom) return;
    setLoading(true);
    const cameras = currentRoom.cameras || [];
    const zones3d = currentRoom.zones || [];

    const buildMap = async () => {
      const map = {};

      for (const z of zones3d) {
        map[z.name] = {
          zoneId: z.id,
          type: z.type || 'lift',
          liftStatus: z.liftStatus || 'free',
          cameras: [],
          analyses: [],
          status: null,
          result: null,
        };
      }

      for (const cam of cameras) {
        if (!cam.rtspCameraId) continue;
        try {
          const zones2d = await getZones2d(currentRoom.id, cam.id);
          if (!zones2d || !zones2d.length) continue;
          for (const z2d of zones2d) {
            const name = z2d.zoneName;
            let entry = map[name];
            if (!entry) {
              for (const [k, v] of Object.entries(map)) {
                if (v.zoneId === z2d.zoneId) { entry = v; break; }
              }
            }
            if (!entry) {
              const z3d = zones3d.find(z => z.id === z2d.zoneId);
              entry = {
                zoneId: z2d.zoneId, type: z3d?.type || 'lift',
                liftStatus: z3d?.liftStatus || 'free',
                cameras: [], analyses: [], status: null, result: null,
              };
              map[z2d.zoneName || z2d.zoneId] = entry;
            }
            entry.cameras.push({
              camId: cam.rtspCameraId, camName: cam.name,
              cam3dId: cam.id, rect: z2d.rect,
              resolution: cam.resolution || { width: 1920, height: 1080 },
            });
          }
        } catch {}
      }

      setZoneMap(map);
      setLoading(false);
      addLog(`Loaded ${Object.keys(map).length} zones from ${cameras.length} cameras`);
    };

    buildMap();
  }, [currentRoom, addLog]);

  if (!currentRoom) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        {rooms && rooms.length > 0 ? 'Загрузка ремзоны...' : 'Сначала создайте ремзону во вкладке 3D Конструктор'}
      </div>
    );
  }

  const zoneEntries = Object.entries(zoneMap);

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a]">
      {/* Header */}
      <div className="px-6 py-3 border-b border-[#333] flex-shrink-0">
        <div className="flex items-center justify-between mb-2 gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Работа системы распознавания</h2>
            <span className="text-xs text-slate-400">
              {zoneEntries.length} zones
              {apiConfigured
                ? <span className="text-green-400 ml-2">API configured</span>
                : <span className="text-red-400 ml-2">API key not set</span>
              }
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Ремзона:</label>
            <select
              value={currentRoom.id}
              onChange={e => fetchRoom(e.target.value)}
              className="bg-[#252525] border border-[#444] text-slate-200 text-xs rounded px-2 py-1.5 max-w-[18rem]"
            >
              {(rooms || []).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button onClick={() => setShowSettings(true)}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-3 py-1.5 rounded-md">
              Settings
            </button>
          </div>
        </div>

        {/* Status bar — observer of the server-side autopoll loop */}
        <div className="flex items-center gap-3 bg-[#252525] rounded-lg px-4 py-2.5">
          <span className="text-xs text-slate-400 font-medium">Auto-poll:</span>
          <span className={`text-xs px-2 py-0.5 rounded ${autoPollRunning ? 'bg-green-900/40 text-green-400 border border-green-700/40' : 'bg-slate-700/40 text-slate-400 border border-slate-600/40'}`}>
            {autoPollRunning ? 'on' : 'off'}
          </span>

          <div className="ml-auto flex items-center gap-4 text-[0.65rem] text-slate-500">
            {cycleRunning && cycleProgress && (
              <span className="flex items-center gap-1 text-yellow-400">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                {cycleProgress}
              </span>
            )}
            {autoPollRunning && !cycleRunning && (
              <span className="flex items-center gap-1 text-green-400">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Waiting...
              </span>
            )}
            {autoPollStats && (
              <>
                {autoPollStats.cyclesTotal > 0 && (
                  <span>Cycles: {autoPollStats.cyclesTotal}</span>
                )}
                {autoPollStats.zonesAnalyzed > 0 && (
                  <span>Analyzed: {autoPollStats.zonesAnalyzed} | Skipped: {autoPollStats.zonesSkipped} | API: {autoPollStats.apiCalls || 0}</span>
                )}
                {autoPollStats.lastRun && (
                  <span>Last: {new Date(autoPollStats.lastRun).toLocaleTimeString('ru-RU')}</span>
                )}
                {autoPollStats.lastCycleDuration > 0 && (
                  <span>{Math.round(autoPollStats.lastCycleDuration / 1000)}s</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Zone table */}
        <div className="flex-1 overflow-y-auto p-4 pb-8">
          {loading ? (
            <div className="text-slate-500 text-center py-8">Loading zones...</div>
          ) : (
            <div className="space-y-3">
              {zoneEntries.map(([zoneName, entry]) => {
                const dbState = monitoringState.find(m => m.zone === zoneName);
                return (
                <div key={zoneName} className="bg-[#252525] border border-[#333] rounded-lg overflow-hidden">
                  {/* Zone header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${
                        (dbState?.status || entry.result) === 'occupied' ? 'bg-red-500' :
                        (dbState?.status || entry.result) === 'free' ? 'bg-green-500' : 'bg-slate-600'
                      }`} />
                      <div>
                        <span className="text-sm font-medium text-white">{zoneName}</span>
                        <span className="text-xs text-slate-500 ml-2">
                          {entry.type === 'lift' ? 'Подъёмник' : 'Прочие работы'}
                        </span>
                        {dbState && (
                          <span className="text-xs ml-2">
                            <span className={dbState.status === 'occupied' ? 'text-red-400' : 'text-green-400'}>
                              DB: {dbState.status === 'occupied' ? 'ЗАНЯТ' : 'СВОБОДЕН'}
                            </span>
                            {dbState.car?.plate && <span className="text-yellow-400 font-mono ml-1">{dbState.car.plate}</span>}
                            {dbState.car?.model && <span className="text-slate-500 ml-1">{dbState.car.model}</span>}
                            {dbState.lastUpdate && <span className="text-slate-600 ml-1">({new Date(dbState.lastUpdate).toLocaleTimeString('ru-RU')})</span>}
                            {dbState.history?.length > 0 && <span className="text-slate-600 ml-1">[{dbState.history.length} records/24h]</span>}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {entry.cameras.length} cam: {entry.cameras.map(c => c.camId).join(', ')}
                      </span>
                      {entry.result && (
                        <span className={`text-xs px-2.5 py-1 rounded font-bold ${
                          entry.result === 'occupied' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {entry.result === 'occupied' ? 'ЗАНЯТ' : 'СВОБОДЕН'}
                        </span>
                      )}
                      {/* Read-only status badge — page is an observer, no action buttons. */}
                      <span className={`text-xs px-2.5 py-1 rounded font-medium ${
                        entry.status === 'analyzing' ? 'bg-yellow-600/20 text-yellow-400 animate-pulse'
                        : entry.status === 'skipped' ? 'bg-slate-700 text-slate-400'
                        : entry.status === 'done' ? 'bg-slate-700/50 text-slate-500'
                        : 'bg-slate-800 text-slate-600'
                      }`}>
                        {entry.status === 'analyzing' ? 'Анализ...'
                          : entry.status === 'skipped' ? 'Без изменений'
                          : entry.status === 'done' ? 'Проанализирован'
                          : 'Ожидание цикла'}
                      </span>
                    </div>
                  </div>

                  {/* Camera analyses */}
                  {entry.analyses.length > 0 && (
                    <div className="flex flex-wrap gap-3 p-3">
                      {entry.analyses.map((a, i) => (
                        <div key={i} className="bg-[#1e1e1e] border border-[#333] rounded-md overflow-hidden" style={{ width: 240 }}>
                          <div className="relative aspect-video bg-black" style={{ cursor: a.imageUrl ? 'pointer' : 'default' }}
                            onClick={() => { if (a.imageUrl) window.open(a.imageUrl, '_blank'); }}>
                            {a.imageUrl ? (
                              a.rect && a.resolution && a.resolution.width > 0 && a.resolution.height > 0 ? (
                                // Backend now sends the full camera frame so v2 ANPR has enough
                                // resolution to read plates. Crop to the zone's rect via CSS so
                                // the tile keeps showing the same area as before.
                                <div className="absolute inset-0 overflow-hidden">
                                  <img
                                    src={a.imageUrl}
                                    alt={`${a.camName} crop`}
                                    style={{
                                      position: 'absolute',
                                      left: `${-(a.rect.x / a.rect.w) * 100}%`,
                                      top: `${-(a.rect.y / a.rect.h) * 100}%`,
                                      width: `${(a.resolution.width / a.rect.w) * 100}%`,
                                      height: `${(a.resolution.height / a.rect.h) * 100}%`,
                                      maxWidth: 'none',
                                    }}
                                  />
                                </div>
                              ) : (
                                <img src={a.imageUrl} alt={`${a.camName} crop`} className="w-full h-full object-cover" />
                              )
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-red-400 text-xs">{a.errorMsg || 'Error'}</div>
                            )}
                            {/* Pending spinner */}
                            {a.pending && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                            <div className="absolute top-1 left-1 bg-black/70 text-[0.6rem] text-slate-300 px-1.5 py-0.5 rounded">
                              {a.camName}
                            </div>
                            {!a.pending && (
                              <div className="absolute top-1 right-1 flex items-center gap-1">
                                {/* Main occupied/free badge — shown for both fresh AND skipped tiles
                                    (skipped tiles carry forward last cycle's verdict). */}
                                {a.error ? (
                                  <div className="text-[0.6rem] px-1.5 py-0.5 rounded font-bold bg-slate-700 text-slate-400">ERR</div>
                                ) : (typeof a.occupied === 'boolean') ? (
                                  <div className={`text-[0.6rem] px-1.5 py-0.5 rounded font-bold ${
                                    a.occupied ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                                  }`}>
                                    {a.occupied ? 'АВТО' : 'ПУСТО'}
                                  </div>
                                ) : null}
                                {/* "БЕЗ ИЗМ." chip — sits next to the main badge when this tile
                                    wasn't re-analyzed in the current cycle. */}
                                {a.skipped && (
                                  <div className="text-[0.55rem] px-1 py-0.5 rounded bg-slate-600/70 text-slate-300" title="Кадр не изменился — повторный анализ пропущен, показан результат прошлого цикла">
                                    БЕЗ ИЗМ.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="px-2 py-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400">Авто:</span>
                              <span className={`text-xs font-bold ${
                                a.error ? 'text-slate-500'
                                : (typeof a.occupied !== 'boolean') ? 'text-slate-500'
                                : a.occupied ? 'text-red-400' : 'text-green-400'
                              }`}>
                                {a.error ? 'Ошибка'
                                  : (typeof a.occupied !== 'boolean') ? '—'
                                  : a.occupied ? 'ДА' : 'НЕТ'}
                              </span>
                            </div>
                            {!a.error && a.occupied && a.vehicle && (
                              <div className="text-[0.65rem] text-slate-300 bg-slate-800/50 rounded px-1.5 py-1">
                                <div>{[a.vehicle.make, a.vehicle.model].filter(Boolean).join(' ') || '—'} <span className="text-slate-500">({a.vehicle.body || '?'})</span></div>
                                <div>Цвет: {a.vehicle.color || '—'}</div>
                                {a.plate && <div className="text-yellow-400 font-mono">{a.plate}</div>}
                              </div>
                            )}
                            {!a.error && a.openParts && a.openParts.length > 0 && (
                              <div className="text-[0.6rem] text-orange-400">Открыто: {a.openParts.join(', ')}</div>
                            )}
                            {!a.error && (typeof a.occupied === 'boolean') && (
                              <div className="flex items-center justify-between text-[0.6rem]">
                                <span className={a.worksInProgress ? 'text-orange-400' : 'text-slate-600'}>
                                  {a.worksInProgress ? 'Работы ведутся' : 'Нет работ'}
                                </span>
                                <span className={a.peopleCount > 0 ? 'text-blue-400' : 'text-slate-600'}>
                                  Люди: {a.peopleCount}
                                </span>
                              </div>
                            )}
                            {!a.error && a.description && (
                              <div className="text-[0.6rem] text-slate-500 italic">{a.description}</div>
                            )}
                            {!a.error && a.confidence && (
                              <div className="text-[0.5rem] text-slate-600">
                                {a.confidence}{a.latencyMs ? ` | ${a.latencyMs}ms` : ''}{a.skipped ? ' | прошлый цикл' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {entry.cameras.length === 0 && (
                    <div className="px-4 py-2 text-xs text-slate-600">No cameras see this zone</div>
                  )}
                </div>
              );
              })}
            </div>
          )}
        </div>

        {/* Log panel */}
        <div className="w-80 border-l border-[#333] bg-[#1e1e1e] flex flex-col flex-shrink-0">
          <div className="px-3 py-2 border-b border-[#333] flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Logs</span>
            <button onClick={() => setLogs([])} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto px-2 py-1 font-mono text-[0.6rem]">
            {logs.map((log, i) => (
              <div key={i} className="py-0.5 border-b border-[#2a2a2a] text-slate-400">
                <span className="text-slate-600">{log.time}</span> {log.msg}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
