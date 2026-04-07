import { describe, it, expect } from 'vitest';

// Test map element types and their properties
const ELEMENT_DEFAULTS = {
  building: { width: 930, height: 614, color: '#22c55e' },
  driveway: { width: 300, height: 40, color: '#94a3b8' },
  post:     { width: 120, height: 80, color: '#3b82f6' },
  zone:     { width: 160, height: 100, color: '#22c55e' },
  camera:   { width: 24, height: 24, color: '#ef4444' },
  door:     { width: 60, height: 8, color: '#f59e0b' },
  wall:     { width: 200, height: 6, color: '#6b7280' },
  label:    { width: 100, height: 30, color: '#a855f7' },
};

describe('Map element types', () => {
  it('has 8 element types', () => {
    expect(Object.keys(ELEMENT_DEFAULTS)).toHaveLength(8);
  });

  it('all types have width, height, color', () => {
    Object.entries(ELEMENT_DEFAULTS).forEach(([type, def]) => {
      expect(def).toHaveProperty('width');
      expect(def).toHaveProperty('height');
      expect(def).toHaveProperty('color');
      expect(def.width).toBeGreaterThan(0);
      expect(def.height).toBeGreaterThan(0);
    });
  });

  it('post is blue (#3b82f6)', () => {
    expect(ELEMENT_DEFAULTS.post.color).toBe('#3b82f6');
  });

  it('camera is red (#ef4444)', () => {
    expect(ELEMENT_DEFAULTS.camera.color).toBe('#ef4444');
  });

  it('zone is green (#22c55e)', () => {
    expect(ELEMENT_DEFAULTS.zone.color).toBe('#22c55e');
  });

  it('driveway is gray (#94a3b8)', () => {
    expect(ELEMENT_DEFAULTS.driveway.color).toBe('#94a3b8');
  });

  it('building has full canvas size', () => {
    expect(ELEMENT_DEFAULTS.building.width).toBe(930);
    expect(ELEMENT_DEFAULTS.building.height).toBe(614);
  });
});

describe('Camera FOV calculations', () => {
  // Test the FOV cone geometry
  function calcFovPoints(direction, fov, range) {
    const dir = direction * Math.PI / 180;
    const fovRad = fov * Math.PI / 180;
    const cx = 12, cy = 12;
    return {
      left: {
        x: cx + Math.cos(dir - fovRad / 2) * range,
        y: cy + Math.sin(dir - fovRad / 2) * range,
      },
      right: {
        x: cx + Math.cos(dir + fovRad / 2) * range,
        y: cy + Math.sin(dir + fovRad / 2) * range,
      },
      mid: {
        x: cx + Math.cos(dir) * range,
        y: cy + Math.sin(dir) * range,
      },
    };
  }

  it('direction 0° points right', () => {
    const pts = calcFovPoints(0, 90, 100);
    expect(pts.mid.x).toBeGreaterThan(100); // mid point is far right
    expect(Math.abs(pts.mid.y - 12)).toBeLessThan(1); // centered vertically
  });

  it('direction 90° points down', () => {
    const pts = calcFovPoints(90, 90, 100);
    expect(pts.mid.y).toBeGreaterThan(100); // mid point is far down
    expect(Math.abs(pts.mid.x - 12)).toBeLessThan(1); // centered horizontally
  });

  it('direction 180° points left', () => {
    const pts = calcFovPoints(180, 90, 100);
    expect(pts.mid.x).toBeLessThan(-80); // mid point is far left
  });

  it('wider FOV spreads cone', () => {
    const narrow = calcFovPoints(0, 30, 100);
    const wide = calcFovPoints(0, 120, 100);
    const narrowSpread = Math.abs(narrow.left.y - narrow.right.y);
    const wideSpread = Math.abs(wide.left.y - wide.right.y);
    expect(wideSpread).toBeGreaterThan(narrowSpread);
  });

  it('longer range extends cone', () => {
    const short = calcFovPoints(0, 90, 50);
    const long = calcFovPoints(0, 90, 150);
    expect(long.mid.x).toBeGreaterThan(short.mid.x);
  });
});
