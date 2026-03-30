import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

function Segment({ segment, isMain }) {
  const { position: pos, size } = segment;
  const { width, height, depth } = size;

  const edges = useMemo(() => {
    const geo = new THREE.BoxGeometry(width, height, depth);
    return new THREE.EdgesGeometry(geo);
  }, [width, height, depth]);

  const center = [
    pos.x + width / 2,
    pos.y + height / 2,
    pos.z + depth / 2
  ];

  return (
    <group position={center}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={isMain ? '#475569' : '#334155'} linewidth={1} />
      </lineSegments>

      {/* Floor */}
      <mesh position={[0, -height / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={isMain ? 0.5 : 0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Segment label (only for non-main segments) */}
      {!isMain && segment.name && (
        <Html position={[0, height / 2 + 0.1, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(0,0,0,0.5)',
            color: '#94a3b8',
            padding: '1px 5px',
            borderRadius: '2px',
            fontSize: '9px',
            fontFamily: 'system-ui, sans-serif',
            whiteSpace: 'nowrap',
            border: '1px solid #334155',
          }}>
            {segment.name}
          </div>
        </Html>
      )}
    </group>
  );
}

export default function RoomBox({ room }) {
  const segments = room.segments || [];

  // Main segment from room dimensions (backward compat)
  const mainSegment = {
    id: 'main',
    name: room.name,
    position: { x: 0, y: 0, z: 0 },
    size: { width: room.width, height: room.height, depth: room.depth },
  };

  return (
    <group>
      <Segment segment={mainSegment} isMain />
      {segments.map(seg => (
        <Segment key={seg.id} segment={seg} isMain={false} />
      ))}
    </group>
  );
}
