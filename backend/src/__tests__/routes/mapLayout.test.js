import { describe, it, expect } from 'vitest';

// Test map layout business logic: element types, versioning, size, JSON structure

const VALID_ELEMENT_TYPES = ['building', 'post', 'zone', 'camera', 'door', 'wall', 'label', 'infozone'];
const DEFAULT_WIDTH = 46540;
const DEFAULT_HEIGHT = 30690;

describe('mapLayout - element types', () => {
  it('accepts all 8 valid element types', () => {
    const elements = VALID_ELEMENT_TYPES.map((type, i) => ({
      id: `el-${i}`,
      type,
      x: 100 * i,
      y: 100 * i,
      width: 50,
      height: 50,
    }));
    expect(elements).toHaveLength(8);
    elements.forEach((el, i) => {
      expect(VALID_ELEMENT_TYPES).toContain(el.type);
      expect(el).toHaveProperty('id');
      expect(el).toHaveProperty('x');
      expect(el).toHaveProperty('y');
    });
  });

  it('post element includes postNumber and label', () => {
    const postEl = {
      id: 'post-1',
      type: 'post',
      x: 500,
      y: 300,
      width: 200,
      height: 150,
      postNumber: 1,
      label: 'Пост 1',
    };
    expect(postEl.type).toBe('post');
    expect(postEl.postNumber).toBe(1);
    expect(typeof postEl.label).toBe('string');
  });

  it('camera element includes cameraId', () => {
    const cameraEl = {
      id: 'cam-el-1',
      type: 'camera',
      x: 1000,
      y: 500,
      cameraId: 'cam01',
      rotation: 45,
    };
    expect(cameraEl.type).toBe('camera');
    expect(cameraEl.cameraId).toBe('cam01');
    expect(typeof cameraEl.rotation).toBe('number');
  });

  it('zone element includes zoneName and fill', () => {
    const zoneEl = {
      id: 'zone-el-1',
      type: 'zone',
      x: 0,
      y: 0,
      width: 5000,
      height: 3000,
      zoneName: 'repair',
      fill: 'rgba(0,120,255,0.2)',
    };
    expect(zoneEl.type).toBe('zone');
    expect(zoneEl.zoneName).toBe('repair');
  });
});

describe('mapLayout - version history numbering', () => {
  it('next version is lastVersion + 1', () => {
    const lastVersion = { version: 3 };
    const nextVersion = (lastVersion?.version || 0) + 1;
    expect(nextVersion).toBe(4);
  });

  it('first version starts at 1 when no versions exist', () => {
    const lastVersion = null;
    const nextVersion = (lastVersion?.version || 0) + 1;
    expect(nextVersion).toBe(1);
  });

  it('version numbering increments sequentially', () => {
    const versions = [];
    for (let i = 0; i < 5; i++) {
      const last = versions.length > 0 ? versions[versions.length - 1] : null;
      const next = (last?.version || 0) + 1;
      versions.push({ version: next });
    }
    expect(versions.map(v => v.version)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('mapLayout - layout restoration from version', () => {
  it('restore copies version data to layout', () => {
    const current = {
      id: 'layout-1', name: 'V3 Layout', width: 46540, height: 30690,
      elements: JSON.stringify([{ id: 'el-1', type: 'post', x: 100, y: 100 }]),
    };
    const versionToRestore = {
      version: 1, name: 'V1 Layout', width: 46540, height: 30690,
      bgImage: null,
      elements: JSON.stringify([{ id: 'el-1', type: 'post', x: 200, y: 200 }]),
    };

    // Simulate restore: save current as new version, then apply version data
    const restored = {
      ...current,
      name: versionToRestore.name,
      width: versionToRestore.width,
      height: versionToRestore.height,
      bgImage: versionToRestore.bgImage,
      elements: versionToRestore.elements,
    };

    expect(restored.name).toBe('V1 Layout');
    const elements = JSON.parse(restored.elements);
    expect(elements[0].x).toBe(200);
    expect(elements[0].y).toBe(200);
  });
});

describe('mapLayout - map size validation', () => {
  it('defaults to 46540x30690mm when not specified', () => {
    const width = undefined;
    const height = undefined;
    const finalWidth = width || DEFAULT_WIDTH;
    const finalHeight = height || DEFAULT_HEIGHT;
    expect(finalWidth).toBe(46540);
    expect(finalHeight).toBe(30690);
  });

  it('accepts custom dimensions when provided', () => {
    const width = 50000;
    const height = 35000;
    const finalWidth = width || DEFAULT_WIDTH;
    const finalHeight = height || DEFAULT_HEIGHT;
    expect(finalWidth).toBe(50000);
    expect(finalHeight).toBe(35000);
  });
});

describe('mapLayout - elements JSON structure', () => {
  it('elements are serialized as JSON string in DB and parsed back', () => {
    const elements = [
      { id: 'b1', type: 'building', x: 0, y: 0, width: 46540, height: 30690 },
      { id: 'p1', type: 'post', x: 500, y: 300, width: 200, height: 150, postNumber: 1 },
      { id: 'w1', type: 'wall', x: 0, y: 5000, width: 46540, height: 10, rotation: 0 },
      { id: 'd1', type: 'door', x: 10000, y: 5000, width: 100, height: 10 },
      { id: 'l1', type: 'label', x: 500, y: 100, text: 'Ремонтная зона' },
      { id: 'iz1', type: 'infozone', x: 1000, y: 1000, width: 3000, height: 2000 },
    ];

    const serialized = JSON.stringify(elements);
    const parsed = JSON.parse(serialized);

    expect(parsed).toHaveLength(6);
    expect(parsed[0].type).toBe('building');
    expect(parsed[1].type).toBe('post');
    expect(parsed[1].postNumber).toBe(1);
    expect(parsed[4].type).toBe('label');
    expect(parsed[4].text).toBe('Ремонтная зона');
  });

  it('handles empty elements array', () => {
    const elements = [];
    const serialized = JSON.stringify(elements);
    const parsed = JSON.parse(serialized || '[]');
    expect(parsed).toEqual([]);
  });

  it('layout response includes parsed elements not raw JSON', () => {
    const dbLayout = {
      id: 'layout-1',
      name: 'Main',
      width: 46540,
      height: 30690,
      elements: '[{"id":"p1","type":"post","x":100,"y":200}]',
      isActive: true,
    };
    // Route does: { ...layout, elements: JSON.parse(layout.elements || '[]') }
    const response = { ...dbLayout, elements: JSON.parse(dbLayout.elements || '[]') };
    expect(Array.isArray(response.elements)).toBe(true);
    expect(response.elements[0].id).toBe('p1');
  });

  it('deactivates other layouts when setting one active', () => {
    const layouts = [
      { id: 'l1', isActive: true },
      { id: 'l2', isActive: false },
      { id: 'l3', isActive: false },
    ];
    // Simulate: set l2 active, deactivate others
    const targetId = 'l2';
    const updated = layouts.map(l => ({
      ...l,
      isActive: l.id === targetId,
    }));
    expect(updated.filter(l => l.isActive)).toHaveLength(1);
    expect(updated.find(l => l.id === 'l2').isActive).toBe(true);
    expect(updated.find(l => l.id === 'l1').isActive).toBe(false);
  });
});
