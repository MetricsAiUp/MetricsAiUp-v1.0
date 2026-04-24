import { useState, useEffect, useCallback, useRef } from 'react';

// Direct fetch helpers — no imports from client.js or useStore to avoid circular deps
const api = (path, opts) => fetch(`./api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());
const apiGet = (path) => api(path);
const apiPost = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
const apiPut = (path, body) => api(path, { method: 'PUT', body: JSON.stringify(body) });

const getZones2d = (roomId, camId) => apiGet(`/rooms/${roomId}/cameras/${camId}/zones2d`);
const getSettings = () => apiGet('/settings');
const updateSettings = (data) => apiPut('/settings', data);
const analyzeImage = (imageBase64, zoneName, zoneType) => apiPost('/analyze', { imageBase64, zoneName, zoneType });
const sendToCollector = (data) => apiPost('/collector/result', data);
const getMonitoringState = () => apiGet('/monitoring/state');
const apiStartAutoPoll = (intervalMs) => apiPost('/autopoll/start', { intervalMs });
const apiStopAutoPoll = () => apiPost('/autopoll/stop', {});
const getAutoPollStatus = () => apiGet('/autopoll/status');
const runAutoPollOnce = () => apiPost('/autopoll/once', {});

// Streaming API helpers
const getStreamBase = () => {
  const match = window.location.pathname.match(/^(\/p\/[^/]+)\//);
  return match ? `${match[1]}/8181` : 'http://localhost:8181';
};
const getCropUrl = (camId, rect, fw = 1920, fh = 1080) =>
  `${getStreamBase()}/api/stream/snapshot/${camId}/crop?x=${rect.x}&y=${rect.y}&w=${rect.w}&h=${rect.h}&fw=${fw}&fh=${fh}`;

function SettingsPanel({ onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-20250514');
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings().then(s => {
      setApiKey(s.anthropicApiKey || '');
      setModel(s.visionModel || 'claude-sonnet-4-20250514');
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
      });
      setConfigured(result.configured);
    } catch {}
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-slate-900 rounded-lg border border-slate-600 shadow-2xl w-[480px] p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white mb-4">API Settings</h3>
        <div className="space-y-4">
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
            <label className="text-xs text-slate-400 block mb-1">Vision Model</label>
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

export default function AnalysisTab({ currentRoom }) {
  const [zoneMap, setZoneMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [autoPollRunning, setAutoPollRunning] = useState(false);
  const [autoPollInterval, setAutoPollInterval] = useState(60000);
  const [autoPollStats, setAutoPollStats] = useState(null);
  const [monitoringState, setMonitoringState] = useState([]);
  const logRef = useRef(null);

  const addLog = useCallback((msg) => {
    setLogs(prev => [...prev.slice(-300), { time: new Date().toLocaleTimeString('ru-RU'), msg }]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs.length]);

  // Check API config
  useEffect(() => {
    getSettings().then(s => setApiConfigured(s.configured)).catch(() => {});
  }, [showSettings]);

  // Poll monitoring state every 5s
  useEffect(() => {
    const load = () => {
      getMonitoringState().then(setMonitoringState).catch(() => {});
    };
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  // Previous crop hashes for change detection
  const prevCropsRef = useRef({});
  const smartCycleRef = useRef(null);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [cycleProgress, setCycleProgress] = useState('');

  // Compute simple hash from image blob for change detection
  const hashBlob = async (blob) => {
    const buf = await blob.arrayBuffer();
    return buf.byteLength.toString() + '_' + new Uint8Array(buf).slice(0, 32).reduce((a, b) => a + b, 0);
  };

  // Smart cycle: go through each zone, check change, analyze if needed, update UI
  const runSmartCycle = useCallback(async () => {
    if (cycleRunning) return;
    setCycleRunning(true);
    const zoneNames = Object.keys(zoneMap).filter(n => zoneMap[n].cameras.length > 0);
    let analyzed = 0, skipped = 0;
    const startTime = Date.now();

    addLog(`════════ Цикл: ${zoneNames.length} zones to check ════════`);

    for (let i = 0; i < zoneNames.length; i++) {
      const zoneName = zoneNames[i];
      const entry = zoneMap[zoneName];
      setCycleProgress(`${i + 1}/${zoneNames.length}: ${zoneName}`);

      addLog(`[${i + 1}/${zoneNames.length}] "${zoneName}" — fetching crops from ${entry.cameras.length} cameras...`);

      // Fetch crops and check for changes
      let anyChanged = false;
      const cropData = [];

      for (const cam of entry.cameras) {
        const cropUrl = getCropUrl(cam.camId, cam.rect, cam.resolution.width, cam.resolution.height);
        try {
          const resp = await fetch(cropUrl);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          const hash = await hashBlob(blob);
          const key = `${cam.camId}_${zoneName}`;
          const prevHash = prevCropsRef.current[key];
          const changed = !prevHash || prevHash !== hash;
          prevCropsRef.current[key] = hash;

          cropData.push({ cam, blob, changed });
          if (changed) anyChanged = true;

          addLog(`  ${cam.camName}: ${Math.round(blob.size / 1024)}KB ${changed ? '⚡ CHANGED' : '— no change'}`);
        } catch (err) {
          addLog(`  ${cam.camName}: ✕ ERROR ${err.message}`);
          cropData.push({ cam, blob: null, changed: false, error: true });
        }
      }

      if (!anyChanged) {
        addLog(`  ⏭ SKIP — no visual changes in any camera`);
        skipped++;

        setZoneMap(prev => ({
          ...prev,
          [zoneName]: { ...prev[zoneName], status: 'skipped' }
        }));
        continue;
      }

      // Analyze with Claude Vision
      addLog(`  🔍 Change detected! Sending to Claude Vision...`);
      setZoneMap(prev => ({
        ...prev,
        [zoneName]: { ...prev[zoneName], status: 'analyzing', analyses: [], result: null }
      }));

      const analyses = [];
      for (const { cam, blob, error } of cropData) {
        if (error || !blob) {
          analyses.push({ camId: cam.camId, camName: cam.camName, error: true, occupied: false });
          setZoneMap(prev => ({ ...prev, [zoneName]: { ...prev[zoneName], analyses: [...analyses] } }));
          continue;
        }

        try {
          const imageUrl = URL.createObjectURL(blob);

          // Show crop immediately (pending Claude result)
          const pending = { camId: cam.camId, camName: cam.camName, imageUrl, pending: true };
          analyses.push(pending);
          setZoneMap(prev => ({ ...prev, [zoneName]: { ...prev[zoneName], analyses: [...analyses] } }));

          const arrayBuf = await blob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));

          addLog(`  → ${cam.camName}: sending to Claude...`);
          const result = await analyzeImage(base64, zoneName, entry.type);
          Object.assign(pending, result, { pending: false });
          setZoneMap(prev => ({ ...prev, [zoneName]: { ...prev[zoneName], analyses: [...analyses] } }));

          const emoji = result.occupied ? '🔴' : '🟢';
          addLog(`  ← ${cam.camName}: ${emoji} ${result.occupied ? 'OCCUPIED' : 'FREE'} [${result.confidence}]`);
          if (result.vehicle) addLog(`     ${result.vehicle.make || ''} ${result.vehicle.model || ''} ${result.vehicle.color || ''}`);
          if (result.plate) addLog(`     Plate: ${result.plate}`);
          if (result.description) addLog(`     "${result.description}"`);
        } catch (err) {
          addLog(`  ✕ ${cam.camName}: ${err.message}`);
          analyses.push({ camId: cam.camId, camName: cam.camName, error: true, occupied: false });
          setZoneMap(prev => ({ ...prev, [zoneName]: { ...prev[zoneName], analyses: [...analyses] } }));
        }
      }

      const valid = analyses.filter(a => !a.error && !a.pending);
      const occupiedCount = valid.filter(a => a.occupied).length;
      const freeCount = valid.filter(a => !a.occupied).length;
      const result = occupiedCount > freeCount ? 'occupied' : 'free';

      addLog(`  ━━ ${result === 'occupied' ? '🔴 ЗАНЯТ' : '🟢 СВОБОДЕН'} (${occupiedCount}/${valid.length}) ━━`);

      try {
        await sendToCollector({ zoneName, zoneType: entry.type, analyses: analyses.filter(a => !a.pending), timestamp: new Date().toISOString() });
        addLog(`  → DB saved`);
      } catch (err) {
        addLog(`  ✕ DB: ${err.message}`);
      }

      setZoneMap(prev => ({ ...prev, [zoneName]: { ...prev[zoneName], status: 'done', analyses, result } }));
      analyzed++;
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    addLog(`════════ Цикл завершён: ${analyzed} analyzed, ${skipped} skipped, ${duration}s ════════`);
    setCycleRunning(false);
    setCycleProgress('');

    // Refresh monitoring state
    getMonitoringState().then(setMonitoringState).catch(() => {});
  }, [zoneMap, addLog]);

  // Auto-cycle timer — all through refs to avoid stale closures
  const autoCycleRef = useRef(null);
  const cycleRunningRef = useRef(false);
  const runSmartCycleRef = useRef(runSmartCycle);
  const autoPollRunningRef = useRef(false);

  useEffect(() => { cycleRunningRef.current = cycleRunning; }, [cycleRunning]);
  useEffect(() => { runSmartCycleRef.current = runSmartCycle; }, [runSmartCycle]);
  useEffect(() => { autoPollRunningRef.current = autoPollRunning; }, [autoPollRunning]);

  const startAutoPollLocal = useCallback(() => {
    if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    setAutoPollRunning(true);
    autoPollRunningRef.current = true;
    addLog(`[AutoPoll] Started (every ${autoPollInterval / 1000}s)`);
    // Run first cycle immediately
    runSmartCycleRef.current();
    // Set repeating interval
    autoCycleRef.current = setInterval(() => {
      if (!cycleRunningRef.current) {
        addLog('[AutoPoll] Starting next cycle...');
        runSmartCycleRef.current();
      } else {
        addLog('[AutoPoll] Previous cycle still running, waiting...');
      }
    }, autoPollInterval);
  }, [autoPollInterval, addLog]);

  const stopAutoPollLocal = useCallback(() => {
    if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    autoCycleRef.current = null;
    setAutoPollRunning(false);
    autoPollRunningRef.current = false;
    addLog('[AutoPoll] Stopped');
  }, [addLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    };
  }, []);

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

  // Helper: analyze a single zone — shows crops progressively in UI
  const analyzeZone = useCallback(async (zoneName) => {
    const entry = zoneMap[zoneName];
    if (!entry || entry.cameras.length === 0) return;

    // Clear previous and set analyzing
    setZoneMap(prev => ({
      ...prev,
      [zoneName]: { ...prev[zoneName], status: 'analyzing', analyses: [], result: null }
    }));

    addLog(`━━━ [${zoneName}] Analysis (${entry.cameras.length} cameras) ━━━`);
    const analyses = [];

    for (const cam of entry.cameras) {
      addLog(`[${zoneName}] → ${cam.camName}: capturing crop...`);
      const cropUrl = getCropUrl(cam.camId, cam.rect, cam.resolution.width, cam.resolution.height);

      try {
        const resp = await fetch(cropUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const imageUrl = URL.createObjectURL(blob);

        // Show crop immediately in UI (before Claude analysis)
        const pending = { camId: cam.camId, camName: cam.camName, imageUrl, pending: true };
        analyses.push(pending);
        setZoneMap(prev => ({
          ...prev,
          [zoneName]: { ...prev[zoneName], analyses: [...analyses] }
        }));

        addLog(`[${zoneName}] → ${cam.camName}: ${Math.round(blob.size/1024)}KB, sending to Claude...`);

        const arrayBuf = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
        const result = await analyzeImage(base64, zoneName, entry.type);

        // Update with real result
        Object.assign(pending, result, { pending: false });
        setZoneMap(prev => ({
          ...prev,
          [zoneName]: { ...prev[zoneName], analyses: [...analyses] }
        }));

        const emoji = result.occupied ? '🔴' : '🟢';
        addLog(`[${zoneName}] ← ${cam.camName}: ${emoji} ${result.occupied ? 'OCCUPIED' : 'FREE'} [${result.confidence}]`);
        if (result.vehicle) addLog(`[${zoneName}]   ${result.vehicle.make || ''} ${result.vehicle.model || ''} ${result.vehicle.color || ''}`);
        if (result.plate) addLog(`[${zoneName}]   Plate: ${result.plate}`);
        if (result.openParts?.length) addLog(`[${zoneName}]   Open: ${result.openParts.join(', ')}`);
        addLog(`[${zoneName}]   "${result.description}"`);

      } catch (err) {
        addLog(`[${zoneName}] ✕ ${cam.camName}: ${err.message}`);
        analyses.push({ camId: cam.camId, camName: cam.camName, error: true, errorMsg: err.message, occupied: false });
        setZoneMap(prev => ({
          ...prev,
          [zoneName]: { ...prev[zoneName], analyses: [...analyses] }
        }));
      }
    }

    const valid = analyses.filter(a => !a.error && !a.pending);
    const occupiedCount = valid.filter(a => a.occupied).length;
    const freeCount = valid.filter(a => !a.occupied).length;
    const result = occupiedCount > freeCount ? 'occupied' : 'free';

    addLog(`━━━ [${zoneName}] ${result === 'occupied' ? '🔴 ЗАНЯТ' : '🟢 СВОБОДЕН'} (${occupiedCount}/${valid.length}) ━━━`);

    try {
      await sendToCollector({ zoneName, zoneType: entry.type, analyses: analyses.filter(a => !a.pending), timestamp: new Date().toISOString() });
      addLog(`[${zoneName}] → DB saved`);
    } catch (err) {
      addLog(`[${zoneName}] ✕ DB: ${err.message}`);
    }

    setZoneMap(prev => ({
      ...prev,
      [zoneName]: { ...prev[zoneName], status: 'done', analyses, result }
    }));
  }, [zoneMap, addLog]);

  const analyzeAll = useCallback(async () => {
    addLog('════════ Starting analysis of ALL zones ════════');
    for (const zoneName of Object.keys(zoneMap)) {
      if (zoneMap[zoneName].cameras.length > 0) {
        await analyzeZone(zoneName);
      }
    }
    addLog('════════ All zones analyzed ════════');
  }, [zoneMap, analyzeZone]);

  if (!currentRoom) {
    return <div className="h-full flex items-center justify-center text-slate-500">Select a room in 3D Constructor first</div>;
  }

  const zoneEntries = Object.entries(zoneMap);

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a]">
      {/* Header */}
      <div className="px-6 py-3 border-b border-[#333] flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Тестовая обработка</h2>
            <span className="text-xs text-slate-400">
              {currentRoom.name} — {zoneEntries.length} zones
              {apiConfigured
                ? <span className="text-green-400 ml-2">API configured</span>
                : <span className="text-red-400 ml-2">API key not set</span>
              }
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-3 py-1.5 rounded-md">
              Settings
            </button>
            <button onClick={analyzeAll} disabled={!apiConfigured}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-md font-medium disabled:opacity-50">
              Browser: все
            </button>
          </div>
        </div>

        {/* Auto-poll control bar */}
        <div className="flex items-center gap-3 bg-[#252525] rounded-lg px-4 py-2.5">
          <span className="text-xs text-slate-400 font-medium">Auto-poll:</span>
          <select value={autoPollInterval} onChange={e => setAutoPollInterval(+e.target.value)}
            disabled={autoPollRunning}
            className="bg-[#333] text-xs text-slate-300 border border-[#444] rounded px-2 py-1 disabled:opacity-50">
            <option value={30000}>30 сек</option>
            <option value={60000}>1 мин</option>
            <option value={120000}>2 мин</option>
            <option value={180000}>3 мин</option>
            <option value={300000}>5 мин</option>
            <option value={600000}>10 мин</option>
            <option value={1200000}>20 мин</option>
          </select>
          <button onClick={autoPollRunning ? stopAutoPollLocal : startAutoPollLocal} disabled={!apiConfigured}
            className={`text-xs px-4 py-1.5 rounded-md font-medium disabled:opacity-50 ${
              autoPollRunning ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' : 'bg-green-600 hover:bg-green-700 text-white'
            }`}>
            {autoPollRunning ? 'Stop' : 'Start'}
          </button>
          <button onClick={runSmartCycle} disabled={!apiConfigured || cycleRunning}
            className={`text-xs px-3 py-1.5 rounded-md font-medium disabled:opacity-50 ${
              cycleRunning ? 'bg-yellow-600 text-white animate-pulse' : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}>
            {cycleRunning ? 'Running...' : '1 цикл'}
          </button>

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
            <span className="text-slate-600">skip if no visual change</span>
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
                      <button
                        onClick={() => analyzeZone(zoneName)}
                        disabled={entry.cameras.length === 0 || entry.status === 'analyzing' || !apiConfigured}
                        className={`text-xs px-3 py-1.5 rounded font-medium ${
                          entry.status === 'analyzing' ? 'bg-yellow-600/20 text-yellow-400 animate-pulse'
                          : entry.status === 'skipped' ? 'bg-slate-700 text-slate-400'
                          : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        {entry.status === 'analyzing' ? 'Анализ...' : entry.status === 'skipped' ? 'Skipped (no change)' : 'Анализировать'}
                      </button>
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
                              <img src={a.imageUrl} alt={`${a.camName} crop`} className="w-full h-full object-cover" />
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
                              <div className={`absolute top-1 right-1 text-[0.6rem] px-1.5 py-0.5 rounded font-bold ${
                                a.error ? 'bg-slate-700 text-slate-400' : a.occupied ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                              }`}>
                                {a.error ? 'ERR' : a.occupied ? 'АВТО' : 'ПУСТО'}
                              </div>
                            )}
                          </div>
                          <div className="px-2 py-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400">Авто:</span>
                              <span className={`text-xs font-bold ${a.error ? 'text-slate-500' : a.occupied ? 'text-red-400' : 'text-green-400'}`}>
                                {a.error ? 'Ошибка' : a.occupied ? 'ДА' : 'НЕТ'}
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
                            {!a.error && (
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
                            {!a.error && (
                              <div className="text-[0.5rem] text-slate-600">
                                {a.confidence} | {a.model?.split('-').slice(0,2).join('-')} | {a.tokensUsed}tok
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
