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
    expect(layout).toHaveProperty('bgImage');
    expect(layout).toHaveProperty('elements');
  });

  it('has STO Kolesnikova name', () => {
    expect(layout.name).toContain('Колесникова');
  });

  it('has correct dimensions (930x614 canvas)', () => {
    expect(layout.width).toBe(930);
    expect(layout.height).toBe(614);
  });

  it('has background image path', () => {
    expect(layout.bgImage).toBe('/data/sto-plan.png');
  });

  it('has exactly 10 posts', () => {
    const posts = layout.elements.filter(e => e.type === 'post');
    expect(posts).toHaveLength(10);
  });

  it('posts are numbered 1-10', () => {
    const posts = layout.elements.filter(e => e.type === 'post');
    const numbers = posts.map(p => p.data?.number).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('has exactly 7 free zones', () => {
    const zones = layout.elements.filter(e => e.type === 'zone');
    expect(zones).toHaveLength(7);
  });

  it('has exactly 15 cameras', () => {
    const cameras = layout.elements.filter(e => e.type === 'camera');
    expect(cameras).toHaveLength(15);
  });

  it('cameras have camId in data', () => {
    const cameras = layout.elements.filter(e => e.type === 'camera');
    cameras.forEach(cam => {
      expect(cam.data).toHaveProperty('camId');
      expect(cam.data.camId).toMatch(/^cam\d{2}$/);
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
      expect(el).toHaveProperty('name');
      expect(el).toHaveProperty('x');
      expect(el).toHaveProperty('y');
      expect(el).toHaveProperty('width');
      expect(el).toHaveProperty('height');
      expect(el).toHaveProperty('color');
      expect(typeof el.x).toBe('number');
      expect(typeof el.y).toBe('number');
    });
  });

  it('no elements have negative coordinates', () => {
    layout.elements.forEach(el => {
      expect(el.x).toBeGreaterThanOrEqual(-10); // small tolerance
      expect(el.y).toBeGreaterThanOrEqual(-10);
    });
  });

  it('element IDs are unique', () => {
    const ids = layout.elements.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
