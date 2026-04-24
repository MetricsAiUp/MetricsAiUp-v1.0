import { useMemo, useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import useDragOnPlane from '../../hooks/useDragOnPlane';
import { useSceneContext } from './SceneContext';

const HANDLE_SIZE = 0.15;
const MIN_SIZE = 0.2;

function ZoneStatusLabel({ zone, monitoringState }) {
  const ms = monitoringState;
  const isOccupied = ms ? ms.status === 'occupied' : zone.liftStatus === 'occupied';
  const isLift = (zone.type || 'lift') === 'lift';
  const statusBg = isOccupied ? (isLift ? '#dc2626' : '#ea580c') : '#16a34a';
  const statusText = isLift
    ? (isOccupied ? 'ЗАНЯТ' : 'СВОБОДЕН')
    : (isOccupied ? 'РАБОТЫ ВЕДУТСЯ' : 'НЕТ РАБОТ');

  return (
    <>
      <div style={{
        background: statusBg, color: '#fff', padding: '2px 6px',
        fontSize: '10px', fontFamily: 'system-ui, sans-serif',
        fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.5px',
        borderRadius: ms?.car ? '0' : '0 0 3px 3px',
      }}>
        {statusText}
        {ms?.lastUpdate && (
          <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 4, fontSize: '8px' }}>
            {new Date(ms.lastUpdate).toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'})}
          </span>
        )}
      </div>
      {ms?.car && (
        <div style={{
          background: 'rgba(0,0,0,0.8)', color: '#e2e8f0',
          padding: '2px 6px', borderRadius: '0 0 3px 3px',
          fontSize: '9px', fontFamily: 'system-ui, sans-serif',
          whiteSpace: 'nowrap', lineHeight: 1.4,
        }}>
          {ms.car.model && (
            <div style={{ color: '#93c5fd' }}>{ms.car.model} {ms.car.color && `(${ms.car.color})`}</div>
          )}
          {ms.car.plate && (
            <div style={{ color: '#fbbf24', fontFamily: 'monospace', fontWeight: 700, fontSize: '10px' }}>
              {ms.car.plate}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ResizeHandle({ position, onDragStart, onDrag, onDragEnd, orbitControlsRef }) {
  const [hovered, setHovered] = useState(false);

  const dragHandlers = useDragOnPlane({
    planeNormal: new THREE.Vector3(0, 1, 0),
    planeConstant: -position[1],
    onDragStart,
    onDrag,
    onDragEnd,
    orbitControlsRef,
  });

  return (
    <mesh
      position={position}
      onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'nwse-resize'; }}
      onPointerLeave={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = ''; }}
      {...dragHandlers}
    >
      <boxGeometry args={[HANDLE_SIZE, HANDLE_SIZE, HANDLE_SIZE]} />
      <meshStandardMaterial color={hovered ? '#fbbf24' : '#f59e0b'} />
    </mesh>
  );
}

export default function ZoneBox({ zone, selected, onClick, onUpdate, room, editMode, monitoringState }) {
  const { position: pos, size, color } = zone;
  const { orbitControlsRef } = useSceneContext();
  const [localPos, setLocalPos] = useState(null);
  const [localSize, setLocalSize] = useState(null);
  const didDragRef = useRef(false);

  const currentPos = localPos || pos;
  const currentSize = localSize || size;

  const edges = useMemo(() => {
    const geo = new THREE.BoxGeometry(currentSize.width, currentSize.height, currentSize.depth);
    return new THREE.EdgesGeometry(geo);
  }, [currentSize.width, currentSize.height, currentSize.depth]);

  const center = [
    currentPos.x + currentSize.width / 2,
    currentPos.y + currentSize.height / 2,
    currentPos.z + currentSize.depth / 2
  ];

  // --- Zone drag-to-move (only when selected) ---
  const moveDrag = useDragOnPlane({
    planeNormal: new THREE.Vector3(0, 1, 0),
    planeConstant: -(pos.y + size.height / 2),
    onDragStart: () => ({ x: pos.x, z: pos.z }),
    onDrag: (delta, start) => {
      didDragRef.current = true;
      const nx = Math.max(0, Math.min(room.width - size.width, start.x + delta.x));
      const nz = Math.max(0, Math.min(room.depth - size.depth, start.z + delta.z));
      setLocalPos({ x: nx, y: pos.y, z: nz });
    },
    onDragEnd: () => {
      if (localPos) {
        onUpdate({ position: localPos, size });
      }
      setLocalPos(null);
    },
    orbitControlsRef,
    enabled: selected && editMode,
  });

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (!didDragRef.current) {
      onClick();
    }
    didDragRef.current = false;
  }, [onClick]);

  // --- Resize handles (4 corners on top face) ---
  const topY = currentPos.y + currentSize.height;
  const corners = [
    { key: 'minmin', pos: [currentPos.x, topY, currentPos.z], fx: -1, fz: -1 },
    { key: 'maxmin', pos: [currentPos.x + currentSize.width, topY, currentPos.z], fx: 1, fz: -1 },
    { key: 'minmax', pos: [currentPos.x, topY, currentPos.z + currentSize.depth], fx: -1, fz: 1 },
    { key: 'maxmax', pos: [currentPos.x + currentSize.width, topY, currentPos.z + currentSize.depth], fx: 1, fz: 1 },
  ];

  const makeResizeHandlers = (fx, fz) => ({
    onDragStart: () => ({
      pos: { ...pos },
      size: { ...size },
    }),
    onDrag: (delta, start) => {
      didDragRef.current = true;
      let nx = start.pos.x;
      let nz = start.pos.z;
      let nw = start.size.width;
      let nd = start.size.depth;

      if (fx === -1) {
        nx = Math.max(0, start.pos.x + delta.x);
        nw = Math.max(MIN_SIZE, start.size.width - delta.x);
        if (nx + nw > start.pos.x + start.size.width) {
          nx = start.pos.x + start.size.width - MIN_SIZE;
          nw = MIN_SIZE;
        }
      } else {
        nw = Math.max(MIN_SIZE, start.size.width + delta.x);
        if (nx + nw > room.width) nw = room.width - nx;
      }

      if (fz === -1) {
        nz = Math.max(0, start.pos.z + delta.z);
        nd = Math.max(MIN_SIZE, start.size.depth - delta.z);
        if (nz + nd > start.pos.z + start.size.depth) {
          nz = start.pos.z + start.size.depth - MIN_SIZE;
          nd = MIN_SIZE;
        }
      } else {
        nd = Math.max(MIN_SIZE, start.size.depth + delta.z);
        if (nz + nd > room.depth) nd = room.depth - nz;
      }

      setLocalPos({ x: nx, y: pos.y, z: nz });
      setLocalSize({ width: nw, height: size.height, depth: nd });
    },
    onDragEnd: () => {
      if (localPos || localSize) {
        onUpdate({
          position: localPos || pos,
          size: localSize || size,
        });
      }
      setLocalPos(null);
      setLocalSize(null);
    },
  });

  return (
    <group>
      <group
        position={center}
        onClick={handleClick}
        onPointerDown={moveDrag.onPointerDown}
        onPointerMove={moveDrag.onPointerMove}
        onPointerUp={moveDrag.onPointerUp}
        onPointerEnter={() => { document.body.style.cursor = 'grab'; }}
        onPointerLeave={() => { document.body.style.cursor = ''; }}
      >
        <mesh>
          <boxGeometry args={[currentSize.width, currentSize.height, currentSize.depth]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={selected ? 0.4 : 0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={color} linewidth={selected ? 2 : 1} />
        </lineSegments>

        {/* Label */}
        <Html
          position={[0, currentSize.height / 2 + 0.15, 0]}
          center
          distanceFactor={8}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{ textAlign: 'center', minWidth: 100 }}>
            {/* Zone name */}
            <div style={{
              background: selected ? color : 'rgba(0,0,0,0.7)',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: '3px 3px 0 0',
              fontSize: '11px',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: selected ? 600 : 400,
              whiteSpace: 'nowrap',
              border: `1px solid ${color}`,
              borderBottom: 'none',
            }}>
              {zone.name}
            </div>
            <ZoneStatusLabel zone={zone} monitoringState={monitoringState} />
          </div>
        </Html>
      </group>

      {selected && editMode && corners.map(c => (
        <ResizeHandle
          key={c.key}
          position={c.pos}
          orbitControlsRef={orbitControlsRef}
          {...makeResizeHandlers(c.fx, c.fz)}
        />
      ))}
    </group>
  );
}
