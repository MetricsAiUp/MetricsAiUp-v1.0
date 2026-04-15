import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Test the map-layout.json data file
const layoutPath = path.join(__dirname, '../../../data/map-layout.json');
const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));

describe('map-layout.json', () => {
  it('has required top-level fields', () => {
    expect(layout).toHaveProperty('name');
    expect(layout).toHaveProperty('width');
    expect(layout).toHaveProperty('height');
    expect(layout).toHaveProperty('elements');
  });

  it('has STO Kolesnikova name', () => {
    expect(layout.name).toContain('Колесникова');
  });

  it('has valid dimensions', () => {
    expect(layout.width).toBeGreaterThan(900);
    expect(layout.height).toBeGreaterThan(600);
  });

  it('has posts', () => {
    const posts = layout.elements.filter(e => e.type === 'post');
    expect(posts.length).toBeGreaterThanOrEqual(10);
  });

  it('has free zones', () => {
    const zones = layout.elements.filter(e => e.type === 'zone');
    expect(zones.length).toBeGreaterThanOrEqual(1);
  });

  it('has cameras', () => {
    const cameras = layout.elements.filter(e => e.type === 'camera');
    expect(cameras.length).toBeGreaterThanOrEqual(10);
  });

  it('cameras have direction/fov/range in data', () => {
    const cameras = layout.elements.filter(e => e.type === 'camera');
    cameras.forEach(cam => {
      if (cam.data) {
        expect(cam.data).toHaveProperty('direction');
        expect(cam.data).toHaveProperty('fov');
        expect(cam.data).toHaveProperty('range');
      }
    });
  });

  it('has building outline', () => {
    const buildings = layout.elements.filter(e => e.type === 'building');
    expect(buildings.length).toBeGreaterThanOrEqual(1);
  });

  it('all elements have required fields', () => {
    layout.elements.forEach(el => {
      expect(el).toHaveProperty('id');
      expect(el).toHaveProperty('type');
      expect(el).toHaveProperty('x');
      expect(el).toHaveProperty('y');
      expect(typeof el.x).toBe('number');
      expect(typeof el.y).toBe('number');
    });
  });

  it('no elements have negative coordinates', () => {
    layout.elements.forEach(el => {
      expect(el.x).toBeGreaterThanOrEqual(-10);
      expect(el.y).toBeGreaterThanOrEqual(-10);
    });
  });

  it('element IDs are unique', () => {
    const ids = layout.elements.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
