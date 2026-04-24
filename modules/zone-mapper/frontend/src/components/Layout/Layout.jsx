import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import Sidebar from '../Sidebar/Sidebar';
import Scene from '../Viewport3D/Scene';
import PreviewPanel from '../CameraPreview/PreviewPanel';
import CameraContextMenu from '../Viewport3D/CameraContextMenu';
import StreamModal from '../StreamModal/StreamModal';
import ZoneOverlayModal from '../ZoneOverlayModal/ZoneOverlayModal';
import CameraGrid from '../CameraGrid/CameraGrid';
import AnalysisTab from '../AnalysisTab/AnalysisTab';

const TABS = [
  { id: 'cameras', label: 'Все камеры', icon: '📹' },
  { id: '3d', label: '3D Конструктор', icon: '🧊' },
  { id: 'analysis', label: 'Тестовая обработка', icon: '🔬' },
];

export default function Layout() {
  const { fetchRooms, currentRoom, selectedCameraId } = useStore();
  const [activeTab, setActiveTab] = useState('cameras');
  const [editMode, setEditMode] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [streamCamera, setStreamCamera] = useState(null);
  const [zoneOverlayCamera, setZoneOverlayCamera] = useState(null);
  const [monitoringData, setMonitoringData] = useState([]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  // Poll monitoring state every 10s for 3D labels
  useEffect(() => {
    const load = () => {
      fetch('./api/monitoring/state').then(r => r.ok ? r.json() : []).then(setMonitoringData).catch(() => {});
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const handleCameraContextMenu = useCallback((screenPos, camera) => {
    setContextMenu({ x: screenPos.x, y: screenPos.y, camera });
  }, []);

  const handleWatchStream = useCallback(async () => {
    if (!contextMenu?.camera) return;
    const cam = contextMenu.camera;
    let zones2d = null;
    if (currentRoom) {
      try {
        const raw = await fetch(`./api/rooms/${currentRoom.id}/cameras/${cam.id}/zones2d`).then(r => r.json());
        if (raw && raw.length) {
          const zones3d = currentRoom.zones || [];
          let monState = monitoringData;
          if (!monState.length) {
            try { monState = await fetch('./api/monitoring/state').then(r => r.json()); } catch {}
          }
          zones2d = raw.map(z2d => {
            const z3d = zones3d.find(zz => zz.id === z2d.zoneId);
            const mon = monState.find(m => m.zone === (z3d?.name || z2d.zoneName));
            return {
              ...z2d,
              zoneName: z3d?.name || z2d.zoneName,
              color: z3d?.color || z2d.color,
              type: z3d?.type || z2d.type || 'lift',
              liftStatus: mon?.status || z3d?.liftStatus || z2d.liftStatus || 'free',
              car: mon?.car || null,
            };
          });
        }
      } catch {}
    }
    setStreamCamera({ name: cam.name, rtspCameraId: cam.rtspCameraId, zones2d: zones2d || [] });
  }, [contextMenu, currentRoom, monitoringData]);

  const handleShowZones = useCallback(() => {
    if (contextMenu?.camera) setZoneOverlayCamera(contextMenu.camera);
  }, [contextMenu]);

  return (
    <div className="flex h-screen w-screen">
      {/* Left sidebar — only for 3D tab */}
      {activeTab === '3d' && (
        <div className="w-80 min-w-80 bg-slate-900 border-r border-slate-700 flex flex-col overflow-y-auto">
          <div className="p-3 border-b border-slate-700">
            <h1 className="text-lg font-bold text-blue-400">3D Zone Mapper</h1>
            <p className="text-xs text-slate-500 mt-1">3D → 2D motion zone projection</p>
          </div>
          <Sidebar />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab bar */}
        <div className="flex items-center bg-slate-900 border-b border-slate-700 px-4 h-11 flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 h-full text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-blue-500'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}

          {/* Header right info */}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Система активна
            </span>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'cameras' && (
          <CameraGrid currentRoom={currentRoom} />
        )}

        {activeTab === 'analysis' && (
          <AnalysisTab currentRoom={currentRoom} />
        )}

        {activeTab === '3d' && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 relative">
              {/* Edit mode toggle */}
              {currentRoom && (
                <button
                  onClick={() => setEditMode(!editMode)}
                  className={`absolute top-3 right-3 z-20 text-xs px-3 py-1.5 rounded-md font-medium shadow-lg transition-colors ${
                    editMode
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  {editMode ? 'Запретить редактирование' : 'Разрешить редактирование'}
                </button>
              )}
              {currentRoom ? (
                <Scene onCameraContextMenu={handleCameraContextMenu} editMode={editMode} monitoringData={monitoringData} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🏠</div>
                    <p className="text-lg">Select or create a room to start</p>
                  </div>
                </div>
              )}
            </div>
            {selectedCameraId && (
              <div className="h-72 border-t border-slate-700 bg-slate-900">
                <PreviewPanel />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <CameraContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          camera={contextMenu.camera}
          onClose={() => setContextMenu(null)}
          onWatchStream={handleWatchStream}
          onShowZones={handleShowZones}
        />
      )}

      {/* Stream modal with zone overlay */}
      {streamCamera && (
        <StreamModal
          camName={streamCamera.name}
          rtspCameraId={streamCamera.rtspCameraId}
          zones2d={streamCamera.zones2d}
          onClose={() => setStreamCamera(null)}
        />
      )}

      {/* Zone overlay modal */}
      {zoneOverlayCamera && currentRoom && (
        <ZoneOverlayModal
          camera={zoneOverlayCamera}
          roomId={currentRoom.id}
          onClose={() => setZoneOverlayCamera(null)}
        />
      )}
    </div>
  );
}
