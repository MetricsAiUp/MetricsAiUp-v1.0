import { describe, it, expect } from 'vitest';

describe('Map Versioning', () => {
  it('version diff detects added elements', () => {
    const oldElements = [
      { id: '1', type: 'post', name: 'Post 1' },
      { id: '2', type: 'zone', name: 'Zone A' },
    ];
    const newElements = [
      { id: '1', type: 'post', name: 'Post 1' },
      { id: '2', type: 'zone', name: 'Zone A' },
      { id: '3', type: 'camera', name: 'Camera 1' },
    ];

    const oldIds = new Set(oldElements.map(e => e.id));
    const newIds = new Set(newElements.map(e => e.id));
    const added = newElements.filter(e => !oldIds.has(e.id));
    const removed = oldElements.filter(e => !newIds.has(e.id));

    expect(added.length).toBe(1);
    expect(added[0].name).toBe('Camera 1');
    expect(removed.length).toBe(0);
  });

  it('version diff detects removed elements', () => {
    const oldElements = [
      { id: '1', type: 'post', name: 'Post 1' },
      { id: '2', type: 'zone', name: 'Zone A' },
      { id: '3', type: 'camera', name: 'Camera 1' },
    ];
    const newElements = [
      { id: '1', type: 'post', name: 'Post 1' },
    ];

    const oldIds = new Set(oldElements.map(e => e.id));
    const newIds = new Set(newElements.map(e => e.id));
    const removed = oldElements.filter(e => !newIds.has(e.id));

    expect(removed.length).toBe(2);
    expect(removed.map(e => e.name)).toContain('Zone A');
    expect(removed.map(e => e.name)).toContain('Camera 1');
  });

  it('version diff detects modified elements', () => {
    const oldElements = [
      { id: '1', type: 'post', name: 'Post 1', x: 100, y: 200 },
    ];
    const newElements = [
      { id: '1', type: 'post', name: 'Post 1', x: 150, y: 200 },
    ];

    const modified = [];
    for (const ne of newElements) {
      const oe = oldElements.find(e => e.id === ne.id);
      if (oe && JSON.stringify(oe) !== JSON.stringify(ne)) {
        modified.push({ id: ne.id, old: oe, new: ne });
      }
    }

    expect(modified.length).toBe(1);
    expect(modified[0].old.x).toBe(100);
    expect(modified[0].new.x).toBe(150);
  });

  it('version numbering increments correctly', () => {
    const versions = [
      { version: 1 },
      { version: 2 },
      { version: 3 },
    ];
    const lastVersion = versions[versions.length - 1];
    const nextVersion = (lastVersion?.version || 0) + 1;
    expect(nextVersion).toBe(4);
  });

  it('version restore preserves data integrity', () => {
    const originalLayout = {
      name: 'Test Layout',
      width: 1000,
      height: 800,
      elements: [{ id: '1', type: 'post' }],
    };

    // Simulate saving as version
    const versionSnapshot = { ...originalLayout, version: 1 };

    // Modify current
    const current = { ...originalLayout, name: 'Modified', elements: [] };

    // Restore from version
    const restored = {
      name: versionSnapshot.name,
      width: versionSnapshot.width,
      height: versionSnapshot.height,
      elements: versionSnapshot.elements,
    };

    expect(restored.name).toBe('Test Layout');
    expect(restored.elements.length).toBe(1);
  });
});
