import { useMemo, useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import useDragOnPlane from '../../hooks/useDragOnPlane';
import { useSceneContext } from './SceneContext';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// Standalone handle — lives outside the camera body group to avoid event bubbling
function Handle({ worldPosition, color, hoverColor, size = 0.12, cursor = 'grab', planeNormal, planeConstant, cameraFacing, objectPosition, onDragStart, onDrag, onDragEnd, orbitControlsRef }) {
  const [hovered, setHovered] = useState(false);

  const dragHandlers = useDragOnPlane({
    planeNormal: planeNormal || new THREE.Vector3(0, 1, 0),
    planeConstant: planeConstant || 0,
    cameraFacing,
    objectPosition,
    onDragStart,
    onDrag,
    onDragEnd,
    orbitControlsRef,
  });

  return (
    <mesh
      position={worldPosition}
      onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = cursor; }}
      onPointerLeave={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = ''; }}
      {...dragHandlers}
    >
      <sphereGeometry args={[size, 8, 8]} />
      <meshStandardMaterial color={hovered ? (hoverColor || '#fbbf24') : (color || '#f59e0b')} />
    </mesh>
  );
}

export default function CameraCone({ camera, selected, onClick, onUpdate, onContextMenu, room, editMode }) {
  const { position: pos, rotation: rot, fov } = camera;
  const { orbitControlsRef } = useSceneContext();
  const [localPos, setLocalPos] = useState(null);
  const [localRot, setLocalRot] = useState(null);
  const [localFov, setLocalFov] = useState(null);
  const didDragRef = useRef(false);

  const currentPos = localPos || pos;
  const currentRot = localRot || rot;
  const currentFov = localFov ?? fov;

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

  // --- Camera drag-to-move (only when selected, camera-facing plane) ---
  const moveDrag = useDragOnPlane({
    planeNormal: new THREE.Vector3(0, 0, 1),
    planeConstant: 0,
    cameraFacing: true,
    objectPosition: new THREE.Vector3(pos.x, pos.y, pos.z),
    onDragStart: () => ({ x: pos.x, y: pos.y, z: pos.z }),
    onDrag: (delta, start) => {
      didDragRef.current = true;
      const nx = Math.max(0, Math.min(room.width, start.x + delta.x));
      const ny = Math.max(0, Math.min(room.height, start.y + delta.y));
      const nz = Math.max(0, Math.min(room.depth, start.z + delta.z));
      setLocalPos({ x: nx, y: ny, z: nz });
    },
    onDragEnd: () => {
      if (localPos) onUpdate({ position: localPos });
      setLocalPos(null);
    },
    orbitControlsRef,
    enabled: selected && editMode,
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

  // ============ HANDLE POSITIONS (world space) ============

  // Yaw handle: on XZ ring around camera
  const yawRadius = 1.2;
  const yawHandleWorld = [
    currentPos.x + Math.sin(currentRot.yaw * DEG2RAD) * yawRadius,
    currentPos.y,
    currentPos.z + Math.cos(currentRot.yaw * DEG2RAD) * yawRadius,
  ];

  // Yaw ring (local to camera position)
  const yawRing = useMemo(() => {
    const segments = 48;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        currentPos.x + Math.sin(a) * yawRadius,
        currentPos.y,
        currentPos.z + Math.cos(a) * yawRadius
      ));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [currentPos.x, currentPos.y, currentPos.z]);

  // Pitch handle: on vertical arc in yaw direction
  const pitchRadius = 0.8;
  const pitchHandleWorld = useMemo(() => {
    const a = currentRot.pitch * DEG2RAD;
    const yawRad = currentRot.yaw * DEG2RAD;
    const forward = new THREE.Vector3(Math.sin(yawRad), 0, Math.cos(yawRad));
    const up = new THREE.Vector3(0, 1, 0);
    const dir = forward.clone().multiplyScalar(Math.cos(a)).add(up.clone().multiplyScalar(-Math.sin(a)));
    return [
      currentPos.x + dir.x * pitchRadius,
      currentPos.y + dir.y * pitchRadius,
      currentPos.z + dir.z * pitchRadius,
    ];
  }, [currentRot.pitch, currentRot.yaw, currentPos.x, currentPos.y, currentPos.z]);

  // Pitch arc (world space)
  const pitchArc = useMemo(() => {
    const segments = 24;
    const pts = [];
    const yawRad = currentRot.yaw * DEG2RAD;
    const forward = new THREE.Vector3(Math.sin(yawRad), 0, Math.cos(yawRad));
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= segments; i++) {
      const a = ((i / segments) - 0.5) * Math.PI;
      const dir = forward.clone().multiplyScalar(Math.cos(a)).add(up.clone().multiplyScalar(-Math.sin(a)));
      pts.push(new THREE.Vector3(
        currentPos.x + dir.x * pitchRadius,
        currentPos.y + dir.y * pitchRadius,
        currentPos.z + dir.z * pitchRadius
      ));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [currentRot.yaw, currentPos.x, currentPos.y, currentPos.z]);

  // FOV handle: at the right edge of the frustum (world space)
  const fovHandleDistance = coneLength;
  const halfH = fovHandleDistance * Math.tan((currentFov / 2) * DEG2RAD);
  const fovHandleWorld = useMemo(() => {
    const localP = new THREE.Vector3(halfH, 0, fovHandleDistance);
    localP.applyEuler(euler);
    return [
      currentPos.x + localP.x,
      currentPos.y + localP.y,
      currentPos.z + localP.z,
    ];
  }, [halfH, fovHandleDistance, euler, currentPos.x, currentPos.y, currentPos.z]);

  return (
    <group>
      {/* Camera body + frustum — this group handles move drag */}
      <group
        position={[currentPos.x, currentPos.y, currentPos.z]}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerDown={moveDrag.onPointerDown}
        onPointerMove={moveDrag.onPointerMove}
        onPointerUp={moveDrag.onPointerUp}
        onPointerEnter={() => { document.body.style.cursor = selected ? 'grab' : 'pointer'; }}
        onPointerLeave={() => { document.body.style.cursor = ''; }}
      >
        <mesh>
          <boxGeometry args={[0.3, 0.2, 0.3]} />
          <meshStandardMaterial color={selected ? '#a855f7' : '#8b5cf6'} />
        </mesh>

        {/* Label */}
        <Html
          position={[0, 0.25, 0]}
          center
          distanceFactor={8}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: selected ? '#a855f7' : 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '11px',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: selected ? 600 : 400,
            whiteSpace: 'nowrap',
            border: '1px solid #8b5cf6',
          }}>
            {camera.name}{camera.rtspCameraId ? ` (${camera.rtspCameraId})` : ''}
          </div>
        </Html>

        <group rotation={euler}>
          <lineSegments geometry={frustumLines}>
            <lineBasicMaterial
              color={selected ? '#c084fc' : '#7c3aed'}
              transparent
              opacity={selected ? 0.8 : 0.4}
            />
          </lineSegments>
        </group>
      </group>

      {/* Handles are OUTSIDE the body group — no event bubbling to move drag */}
      {selected && editMode && (
        <>
          {/* Yaw ring visual */}
          <line geometry={yawRing}>
            <lineBasicMaterial color="#22d3ee" transparent opacity={0.4} />
          </line>

          {/* Yaw handle */}
          <Handle
            worldPosition={yawHandleWorld}
            color="#06b6d4"
            hoverColor="#22d3ee"
            size={0.1}
            cursor="ew-resize"
            orbitControlsRef={orbitControlsRef}
            planeNormal={new THREE.Vector3(0, 1, 0)}
            planeConstant={-currentPos.y}
            onDragStart={() => rot.yaw}
            onDrag={(delta, startYaw, point) => {
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

          {/* Pitch arc visual */}
          <line geometry={pitchArc}>
            <lineBasicMaterial color="#fb923c" transparent opacity={0.4} />
          </line>

          {/* Pitch handle */}
          <Handle
            worldPosition={pitchHandleWorld}
            color="#f97316"
            hoverColor="#fb923c"
            size={0.1}
            cursor="ns-resize"
            orbitControlsRef={orbitControlsRef}
            planeNormal={(() => {
              // Vertical plane aligned with camera's yaw direction
              const yawRad = currentRot.yaw * DEG2RAD;
              return new THREE.Vector3(-Math.cos(yawRad), 0, Math.sin(yawRad));
            })()}
            planeConstant={(() => {
              const yawRad = currentRot.yaw * DEG2RAD;
              const n = new THREE.Vector3(-Math.cos(yawRad), 0, Math.sin(yawRad));
              return -n.dot(new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z));
            })()}
            onDragStart={() => rot.pitch}
            onDrag={(delta, startPitch, point) => {
              didDragRef.current = true;
              const yawRad = currentRot.yaw * DEG2RAD;
              const forward = new THREE.Vector3(Math.sin(yawRad), 0, Math.cos(yawRad));
              const toPoint = new THREE.Vector3(
                point.x - currentPos.x,
                point.y - currentPos.y,
                point.z - currentPos.z
              ).normalize();
              const fwd = toPoint.dot(forward);
              const up = -toPoint.y;
              const newPitch = Math.max(-89, Math.min(89, Math.atan2(up, Math.abs(fwd)) * RAD2DEG));
              setLocalRot({ ...rot, pitch: newPitch });
            }}
            onDragEnd={() => {
              if (localRot) onUpdate({ rotation: localRot });
              setLocalRot(null);
            }}
          />

          {/* FOV handle */}
          <Handle
            worldPosition={fovHandleWorld}
            color="#4ade80"
            hoverColor="#86efac"
            size={0.1}
            cursor="col-resize"
            orbitControlsRef={orbitControlsRef}
            cameraFacing
            objectPosition={new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z)}
            onDragStart={() => ({ fov: camera.fov, startHalfH: halfH })}
            onDrag={(delta, start) => {
              didDragRef.current = true;
              // Project delta onto the frustum's horizontal direction to get FOV change
              const yawRad = currentRot.yaw * DEG2RAD;
              const pitchRad = currentRot.pitch * DEG2RAD;
              // Right vector of the camera
              const right = new THREE.Vector3(Math.cos(yawRad), 0, -Math.sin(yawRad));
              const proj = delta.dot(right);
              const newHalfH = Math.max(0.1, start.startHalfH + proj);
              const newFov = Math.max(10, Math.min(170, Math.atan(newHalfH / fovHandleDistance) * 2 * RAD2DEG));
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
  );
}
