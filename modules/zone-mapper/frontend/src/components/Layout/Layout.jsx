import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { getZones2d } from '../../api/client';
import Sidebar from '../Sidebar/Sidebar';
import Scene from '../Viewport3D/Scene';
import PreviewPanel from '../CameraPreview/PreviewPanel';
import CameraContextMenu from '../Viewport3D/CameraContextMenu';
import StreamModal from '../StreamModal/StreamModal';
import ZoneOverlayModal from '../ZoneOverlayModal/ZoneOverlayModal';
import CameraGrid from '../CameraGrid/CameraGrid';

const TABS = [
  { id: 'cameras', label: 'Все камеры', icon: '📹' },
  { id: '3d', label: '3D Конструктор', icon: '🧊' },
];

export default function Layout() {
  const { fetchRooms, currentRoom, selectedCameraId } = useStore();
  const [activeTab, setActiveTab] = useState('cameras');
  const [contextMenu, setContextMenu] = useState(null);
  const [streamCamera, setStreamCamera] = useState(null);
  const [zoneOverlayCamera, setZoneOverlayCamera] = useState(null);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const handleCameraContextMenu = useCallback((screenPos, camera) => {
    setContextMenu({ x: screenPos.x, y: screenPos.y, camera });
  }, []);

  const handleWatchStream = useCallback(async () => {
    if (!contextMenu?.camera) return;
    const cam = contextMenu.camera;
    let zones2d = null;
    if (currentRoom) {
      try { zones2d = await getZones2d(currentRoom.id, cam.id); } catch {}
    }
    setStreamCamera({ name: cam.name, rtspCameraId: cam.rtspCameraId, zones2d: zones2d || [] });
  }, [contextMenu, currentRoom]);

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
          <CameraGrid />
        )}

        {activeTab === '3d' && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 relative">
              {currentRoom ? (
                <Scene onCameraContextMenu={handleCameraContextMenu} />
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
