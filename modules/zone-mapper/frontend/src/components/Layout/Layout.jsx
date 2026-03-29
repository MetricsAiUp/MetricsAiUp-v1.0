import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import Sidebar from '../Sidebar/Sidebar';
import Scene from '../Viewport3D/Scene';
import PreviewPanel from '../CameraPreview/PreviewPanel';
import CameraContextMenu from '../Viewport3D/CameraContextMenu';
import StreamModal from '../StreamModal/StreamModal';

export default function Layout() {
  const { fetchRooms, currentRoom, selectedCameraId, projection } = useStore();
  const [contextMenu, setContextMenu] = useState(null); // { x, y, camera }
  const [streamCamera, setStreamCamera] = useState(null); // { name, rtspCameraId }

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const handleCameraContextMenu = useCallback((screenPos, camera) => {
    setContextMenu({ x: screenPos.x, y: screenPos.y, camera });
  }, []);

  const handleWatchStream = useCallback(() => {
    if (contextMenu?.camera) {
      setStreamCamera({
        name: contextMenu.camera.name,
        rtspCameraId: contextMenu.camera.rtspCameraId
      });
    }
  }, [contextMenu]);

  return (
    <div className="flex h-screen w-screen">
      {/* Left sidebar */}
      <div className="w-80 min-w-80 bg-slate-900 border-r border-slate-700 flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-slate-700">
          <h1 className="text-lg font-bold text-blue-400">3D Zone Mapper</h1>
          <p className="text-xs text-slate-500 mt-1">3D &rarr; 2D motion zone projection</p>
        </div>
        <Sidebar />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* 3D Viewport */}
        <div className="flex-1 relative">
          {currentRoom ? (
            <Scene onCameraContextMenu={handleCameraContextMenu} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <div className="text-6xl mb-4">&#x1f3e0;</div>
                <p className="text-lg">Select or create a room to start</p>
              </div>
            </div>
          )}
        </div>

        {/* Camera preview panel */}
        {selectedCameraId && (
          <div className="h-72 border-t border-slate-700 bg-slate-900">
            <PreviewPanel />
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
        />
      )}

      {/* Stream modal */}
      {streamCamera && (
        <StreamModal
          camName={streamCamera.name}
          rtspCameraId={streamCamera.rtspCameraId}
          onClose={() => setStreamCamera(null)}
        />
      )}
    </div>
  );
}
