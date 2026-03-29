import { Grid as DreiGrid } from '@react-three/drei';

export default function Grid({ size = 20 }) {
  return (
    <DreiGrid
      args={[size, size]}
      cellSize={1}
      cellThickness={0.5}
      cellColor="#334155"
      sectionSize={5}
      sectionThickness={1}
      sectionColor="#475569"
      fadeDistance={size * 2}
      fadeStrength={1}
      infiniteGrid={false}
      position={[size / 2, 0, size / 2]}
    />
  );
}
