import { useMemo } from 'react';
import * as THREE from 'three';

export default function RoomBox({ room }) {
  const { width, height, depth } = room;

  const edges = useMemo(() => {
    const geo = new THREE.BoxGeometry(width, height, depth);
    return new THREE.EdgesGeometry(geo);
  }, [width, height, depth]);

  return (
    <group position={[width / 2, height / 2, depth / 2]}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#475569" linewidth={1} />
      </lineSegments>

      {/* Semi-transparent floor */}
      <mesh position={[0, -height / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
