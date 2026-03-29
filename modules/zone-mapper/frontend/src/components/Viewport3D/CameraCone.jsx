import { useMemo, useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import useDragOnPlane from '../../hooks/useDragOnPlane';
import { useSceneContext } from './SceneContext';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function DragHandle({ position, color, hoverColor, size = 0.12, onDragStart, onDrag, onDragEnd, orbitControlsRef, planeNormal, planeConstant, cursor = 'grab' }) {
  const [hovered, setHovered] = useState(false);

  const dragHandlers = useDragOnPlane({
    planeNormal: planeNormal || new THREE.Vector3(0, 1, 0),
    planeConstant: planeConstant || 0,
    onDragStart,
    onDrag,
    onDragEnd,
    orbitControlsRef,
  });

  return (
    <mesh
      position={position}
      onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = cursor; }}
      onPointerLeave={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = ''; }}
      {...dragHandlers}
    >
      <sphereGeometry args={[size, 8, 8]} />
      <meshStandardMaterial color={hovered ? (hoverColor || '#fbbf24') : (color || '#f59e0b')} />
    </mesh>
  );
}

export default function CameraCone({ camera, selected, onClick, onUpdate, onContextMenu, room }) {
  const { position: pos, rotation: rot, fov } = camera;
  const { orbitControlsRef } = useSceneContext();
  const [localPos, setLocalPos] = useState(null);
  const [localRot, setLocalRot] = useState(null);
  const [localFov, setLocalFov] = useState(null);
  const didDragRef = useRef(false);

  const currentPos = localPos || pos;
  const currentRot = localRot || rot;
  const currentFov = localFov || fov;

  const euler = useMemo(() => {
    return new THREE.Euler(
      currentRot.pitch * DEG2RAD,
      currentRot.yaw * DEG2RAD,
      currentRot.roll * DEG2RAD,
      'YXZ'
    );
  }, [currentRot.yaw, currentRot.pitch, currentRot.roll]);

  const coneLength = 2;

  const frustumLines = useMemo(() => {
    const halfH = coneLength * Math.tan((currentFov / 2) * DEG2RAD);
    const aspect = camera.resolution.width / camera.resolution.height;
    const halfV = halfH / aspect;

    const points = [
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(-halfH, halfV, coneLength),
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(halfH, halfV, coneLength),
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(-halfH, -halfV, coneLength),
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(halfH, -halfV, coneLength),
      new THREE.Vector3(-halfH, halfV, coneLength), new THREE.Vector3(halfH, halfV, coneLength),
      new THREE.Vector3(halfH, halfV, coneLength), new THREE.Vector3(halfH, -halfV, coneLength),
      new THREE.Vector3(halfH, -halfV, coneLength), new THREE.Vector3(-halfH, -halfV, coneLength),
      new THREE.Vector3(-halfH, -halfV, coneLength), new THREE.Vector3(-halfH, halfV, coneLength),
    ];

    return new THREE.BufferGeometry().setFromPoints(points);
  }, [currentFov, camera.resolution.width, camera.resolution.height]);

  // --- Camera drag-to-move (on horizontal plane at camera Y) ---
  const moveDrag = useDragOnPlane({
    planeNormal: new THREE.Vector3(0, 1, 0),
    planeConstant: -pos.y,
    onDragStart: () => ({ x: pos.x, z: pos.z }),
    onDrag: (delta, start) => {
      didDragRef.current = true;
      const nx = Math.max(0, Math.min(room.width, start.x + delta.x));
      const nz = Math.max(0, Math.min(room.depth, start.z + delta.z));
      setLocalPos({ x: nx, y: pos.y, z: nz });
    },
    onDragEnd: () => {
      if (localPos) {
        onUpdate({ position: localPos });
      }
      setLocalPos(null);
    },
    orbitControlsRef,
  });

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (!didDragRef.current) onClick();
    didDragRef.current = false;
  }, [onClick]);

  const handleContextMenu = useCallback((e) => {
    e.stopPropagation();
    if (e.nativeEvent) e.nativeEvent.preventDefault();
    if (onContextMenu) {
      onContextMenu(
        { x: e.nativeEvent?.clientX || e.clientX || 0, y: e.nativeEvent?.clientY || e.clientY || 0 },
        camera
      );
    }
  }, [onContextMenu, camera]);

  // --- Yaw handle: sphere on a ring around the camera ---
  const yawRadius = 1.2;
  const yawHandlePos = [
    Math.sin(currentRot.yaw * DEG2RAD) * yawRadius,
    0,
    Math.cos(currentRot.yaw * DEG2RAD) * yawRadius,
  ];

  // Yaw ring geometry
  const yawRing = useMemo(() => {
    const segments = 48;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.sin(a) * yawRadius, 0, Math.cos(a) * yawRadius));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  // --- Pitch handle: sphere on a vertical arc ---
  const pitchRadius = 0.8;
  const pitchHandleLocalPos = useMemo(() => {
    const a = currentRot.pitch * DEG2RAD;
    const yawRad = currentRot.yaw * DEG2RAD;
    const forward = new THREE.Vector3(Math.sin(yawRad), 0, Math.cos(yawRad));
    const up = new THREE.Vector3(0, 1, 0);
    const dir = forward.clone().multiplyScalar(Math.cos(a)).add(up.clone().multiplyScalar(-Math.sin(a)));
    return dir.multiplyScalar(pitchRadius).toArray();
  }, [currentRot.pitch, currentRot.yaw]);

  // Pitch arc geometry
  const pitchArc = useMemo(() => {
    const segments = 24;
    const pts = [];
    const yawRad = currentRot.yaw * DEG2RAD;
    const forward = new THREE.Vector3(Math.sin(yawRad), 0, Math.cos(yawRad));
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= segments; i++) {
      const a = ((i / segments) - 0.5) * Math.PI; // -90 to +90 deg
      const dir = forward.clone().multiplyScalar(Math.cos(a)).add(up.clone().multiplyScalar(-Math.sin(a)));
      pts.push(dir.multiplyScalar(pitchRadius));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [currentRot.yaw]);

  // --- FOV handle: sphere at the edge of frustum ---
  const fovHandleDistance = coneLength;
  const halfH = fovHandleDistance * Math.tan((currentFov / 2) * DEG2RAD);

  // Transform the FOV handle position to world space (relative to camera)
  const fovHandleLocalPos = useMemo(() => {
    const localP = new THREE.Vector3(halfH, 0, fovHandleDistance);
    localP.applyEuler(euler);
    return localP.toArray();
  }, [halfH, fovHandleDistance, euler]);

  return (
    <group>
      <group
        position={[currentPos.x, currentPos.y, currentPos.z]}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerDown={moveDrag.onPointerDown}
        onPointerMove={moveDrag.onPointerMove}
        onPointerUp={moveDrag.onPointerUp}
        onPointerEnter={() => { document.body.style.cursor = 'grab'; }}
        onPointerLeave={() => { document.body.style.cursor = ''; }}
      >
        {/* Camera body */}
        <mesh>
          <boxGeometry args={[0.3, 0.2, 0.3]} />
          <meshStandardMaterial color={selected ? '#a855f7' : '#8b5cf6'} />
        </mesh>

        {/* FOV frustum */}
        <group rotation={euler}>
          <lineSegments geometry={frustumLines}>
            <lineBasicMaterial
              color={selected ? '#c084fc' : '#7c3aed'}
              transparent
              opacity={selected ? 0.8 : 0.4}
            />
          </lineSegments>
        </group>

        {/* === Selected handles === */}
        {selected && (
          <>
            {/* Yaw ring */}
            <line geometry={yawRing}>
              <lineBasicMaterial color="#22d3ee" transparent opacity={0.4} />
            </line>

            {/* Yaw handle */}
            <DragHandle
              position={yawHandlePos}
              color="#06b6d4"
              hoverColor="#22d3ee"
              size={0.1}
              cursor="ew-resize"
              orbitControlsRef={orbitControlsRef}
              planeNormal={new THREE.Vector3(0, 1, 0)}
              planeConstant={-currentPos.y}
              onDragStart={() => ({ yaw: rot.yaw, cx: currentPos.x, cz: currentPos.z })}
              onDrag={(delta, start, point) => {
                didDragRef.current = true;
                const dx = point.x - currentPos.x;
                const dz = point.z - currentPos.z;
                const newYaw = Math.atan2(dx, dz) * RAD2DEG;
                setLocalRot({ ...rot, yaw: newYaw });
              }}
              onDragEnd={() => {
                if (localRot) onUpdate({ rotation: localRot });
                setLocalRot(null);
              }}
            />

            {/* Pitch arc */}
            <line geometry={pitchArc}>
              <lineBasicMaterial color="#fb923c" transparent opacity={0.4} />
            </line>

            {/* Pitch handle */}
            <DragHandle
              position={pitchHandleLocalPos}
              color="#f97316"
              hoverColor="#fb923c"
              size={0.1}
              cursor="ns-resize"
              orbitControlsRef={orbitControlsRef}
              planeNormal={(() => {
                const yawRad = currentRot.yaw * DEG2RAD;
                return new THREE.Vector3(-Math.cos(yawRad), 0, Math.sin(yawRad));
              })()}
              planeConstant={(() => {
                const yawRad = currentRot.yaw * DEG2RAD;
                const n = new THREE.Vector3(-Math.cos(yawRad), 0, Math.sin(yawRad));
                return -n.dot(new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z));
              })()}
              onDragStart={() => ({ pitch: rot.pitch })}
              onDrag={(delta, start, point) => {
                didDragRef.current = true;
                const yawRad = currentRot.yaw * DEG2RAD;
                const forward = new THREE.Vector3(Math.sin(yawRad), 0, Math.cos(yawRad));
                const toPoint = new THREE.Vector3(
                  point.x - currentPos.x,
                  point.y - currentPos.y,
                  point.z - currentPos.z
                );
                const fwd = toPoint.dot(forward);
                const up = toPoint.y;
                const newPitch = Math.max(-89, Math.min(89, -Math.atan2(up, Math.abs(fwd)) * RAD2DEG));
                setLocalRot({ ...rot, pitch: newPitch });
              }}
              onDragEnd={() => {
                if (localRot) onUpdate({ rotation: localRot });
                setLocalRot(null);
              }}
            />

            {/* FOV handle */}
            <DragHandle
              position={fovHandleLocalPos}
              color="#4ade80"
              hoverColor="#86efac"
              size={0.1}
              cursor="col-resize"
              orbitControlsRef={orbitControlsRef}
              planeNormal={new THREE.Vector3(0, 1, 0)}
              planeConstant={-currentPos.y}
              onDragStart={() => ({ fov: camera.fov })}
              onDrag={(delta, start, point) => {
                didDragRef.current = true;
                const dx = point.x - currentPos.x;
                const dz = point.z - currentPos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                const newFov = Math.max(10, Math.min(170, Math.atan2(dist, fovHandleDistance) * 2 * RAD2DEG));
                setLocalFov(newFov);
              }}
              onDragEnd={() => {
                if (localFov != null) onUpdate({ fov: localFov });
                setLocalFov(null);
              }}
            />
          </>
        )}
      </group>
    </group>
  );
}
