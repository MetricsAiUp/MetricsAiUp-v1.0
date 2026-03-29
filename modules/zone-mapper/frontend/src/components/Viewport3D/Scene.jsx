import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { useStore } from '../../store/useStore';
import SceneContext from './SceneContext';
import RoomBox from './RoomBox';
import ZoneBox from './ZoneBox';
import CameraCone from './CameraCone';
import Grid from './Grid';

function SceneContent({ onCameraContextMenu }) {
  const { currentRoom, selectedZoneId, selectedCameraId, selectZone, selectCamera, editZone, editCamera } = useStore();
  const orbitRef = useRef();

  if (!currentRoom) return null;

  return (
    <SceneContext.Provider value={{ orbitControlsRef: orbitRef }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} />
      <pointLight position={[0, currentRoom.height, 0]} intensity={0.3} />

      <Grid size={Math.max(currentRoom.width, currentRoom.depth) * 2} />
      <RoomBox room={currentRoom} />

      {(currentRoom.zones || []).map(zone => (
        <ZoneBox
          key={zone.id}
          zone={zone}
          selected={zone.id === selectedZoneId}
          onClick={() => selectZone(zone.id)}
          onUpdate={(data) => editZone(zone.id, data)}
          room={currentRoom}
        />
      ))}

      {(currentRoom.cameras || []).map(cam => (
        <CameraCone
          key={cam.id}
          camera={cam}
          selected={cam.id === selectedCameraId}
          onClick={() => selectCamera(cam.id)}
          onUpdate={(data) => editCamera(cam.id, data)}
          onContextMenu={onCameraContextMenu}
          room={currentRoom}
        />
      ))}

      <OrbitControls
        ref={orbitRef}
        makeDefault
        target={[currentRoom.width / 2, currentRoom.height / 2, currentRoom.depth / 2]}
      />

      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport />
      </GizmoHelper>

      <axesHelper args={[2]} position={[0, 0, 0]} />
    </SceneContext.Provider>
  );
}

export default function Scene({ onCameraContextMenu }) {
  const { currentRoom } = useStore();
  if (!currentRoom) return null;

  const maxDim = Math.max(currentRoom.width, currentRoom.height, currentRoom.depth);

  return (
    <Canvas
      camera={{ position: [maxDim * 1.5, maxDim * 1.2, maxDim * 1.5], fov: 50, near: 0.1, far: 500 }}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneContent onCameraContextMenu={onCameraContextMenu} />
    </Canvas>
  );
}
