import { useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { useStore } from '../../store/useStore';
import SceneContext from './SceneContext';
import RoomBox from './RoomBox';
import ZoneBox from './ZoneBox';
import CameraCone from './CameraCone';
import Grid from './Grid';

// Compute total bounding box of room + all segments
function getRoomBounds(room) {
  let maxX = room.width, maxY = room.height, maxZ = room.depth;
  let minX = 0, minY = 0, minZ = 0;

  for (const seg of (room.segments || [])) {
    const sx = seg.position.x, sy = seg.position.y, sz = seg.position.z;
    minX = Math.min(minX, sx);
    minY = Math.min(minY, sy);
    minZ = Math.min(minZ, sz);
    maxX = Math.max(maxX, sx + seg.size.width);
    maxY = Math.max(maxY, sy + seg.size.height);
    maxZ = Math.max(maxZ, sz + seg.size.depth);
  }

  return { minX, minY, minZ, maxX, maxY, maxZ, width: maxX - minX, height: maxY - minY, depth: maxZ - minZ };
}

function SceneContent({ onCameraContextMenu, editMode, monitoringData }) {
  const { currentRoom, selectedZoneId, selectedCameraId, selectZone, selectCamera, editZone, editCamera } = useStore();
  const orbitRef = useRef();

  if (!currentRoom) return null;

  const bounds = useMemo(() => getRoomBounds(currentRoom), [currentRoom]);

  return (
    <SceneContext.Provider value={{ orbitControlsRef: orbitRef }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} />
      <pointLight position={[0, bounds.maxY, 0]} intensity={0.3} />

      <Grid size={Math.max(bounds.width, bounds.depth) * 2} />
      <RoomBox room={currentRoom} />

      {(currentRoom.zones || []).map(zone => (
        <ZoneBox
          key={zone.id}
          zone={zone}
          selected={zone.id === selectedZoneId}
          onClick={() => selectZone(zone.id === selectedZoneId ? null : zone.id)}
          onUpdate={(data) => editZone(zone.id, data)}
          room={currentRoom}
          editMode={editMode}
          monitoringState={monitoringData?.find(m => m.zone === zone.name)}
        />
      ))}

      {(currentRoom.cameras || []).map(cam => (
        <CameraCone
          key={cam.id}
          camera={cam}
          selected={cam.id === selectedCameraId}
          onClick={() => selectCamera(cam.id === selectedCameraId ? null : cam.id)}
          onUpdate={(data) => editCamera(cam.id, data)}
          onContextMenu={onCameraContextMenu}
          room={currentRoom}
          editMode={editMode}
        />
      ))}

      <OrbitControls
        ref={orbitRef}
        makeDefault
        target={[(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, (bounds.minZ + bounds.maxZ) / 2]}
      />

      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport />
      </GizmoHelper>

      <axesHelper args={[2]} position={[0, 0, 0]} />
    </SceneContext.Provider>
  );
}

export default function Scene({ onCameraContextMenu, editMode, monitoringData }) {
  const { currentRoom } = useStore();
  if (!currentRoom) return null;

  const bounds = getRoomBounds(currentRoom);
  const maxDim = Math.max(bounds.width, bounds.height, bounds.depth);

  return (
    <Canvas
      camera={{ position: [maxDim * 1.5, maxDim * 1.2, maxDim * 1.5], fov: 50, near: 0.1, far: 500 }}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneContent onCameraContextMenu={onCameraContextMenu} editMode={editMode} monitoringData={monitoringData} />
    </Canvas>
  );
}
