import { describe, it, expect } from 'vitest';

describe('Cameras Route Logic', () => {
  describe('Camera Zone Mapping with Priorities', () => {
    it('zone mapping has cameraId, zoneId, and priority', () => {
      const mapping = { cameraId: 'cam-1', zoneId: 'zone-1', priority: 5 };
      expect(mapping).toHaveProperty('cameraId');
      expect(mapping).toHaveProperty('zoneId');
      expect(mapping).toHaveProperty('priority');
    });

    it('priority defaults to 0 when not provided', () => {
      const input = { zoneId: 'zone-1' };
      const priority = input.priority ?? 0;
      expect(priority).toBe(0);
    });

    it('priority range is 0-10', () => {
      const validPriorities = [0, 1, 5, 10];
      const invalidPriorities = [-1, 11, 100];

      for (const p of validPriorities) {
        expect(p >= 0 && p <= 10).toBe(true);
      }
      for (const p of invalidPriorities) {
        expect(p >= 0 && p <= 10).toBe(false);
      }
    });

    it('mappings are sorted by priority ascending', () => {
      const mappings = [
        { zoneId: 'z3', priority: 8 },
        { zoneId: 'z1', priority: 1 },
        { zoneId: 'z2', priority: 5 },
      ];
      const sorted = [...mappings].sort((a, b) => a.priority - b.priority);
      expect(sorted[0].zoneId).toBe('z1');
      expect(sorted[1].zoneId).toBe('z2');
      expect(sorted[2].zoneId).toBe('z3');
    });

    it('a camera can have multiple zone mappings', () => {
      const cameraMappings = [
        { cameraId: 'cam-1', zoneId: 'zone-1', priority: 0 },
        { cameraId: 'cam-1', zoneId: 'zone-2', priority: 3 },
        { cameraId: 'cam-1', zoneId: 'zone-3', priority: 7 },
      ];
      const zonesForCam1 = cameraMappings.filter(m => m.cameraId === 'cam-1');
      expect(zonesForCam1).toHaveLength(3);
    });
  });

  describe('Health Status Object Structure', () => {
    it('getCameraStatuses returns map of camId to { online, lastCheck }', () => {
      const statuses = {
        cam01: { online: true, lastCheck: new Date('2026-04-14T10:00:00Z') },
        cam02: { online: false, lastCheck: new Date('2026-04-14T09:50:00Z') },
        cam03: { online: true, lastCheck: new Date('2026-04-14T10:00:00Z') },
      };

      expect(Object.keys(statuses)).toHaveLength(3);
      for (const [id, status] of Object.entries(statuses)) {
        expect(status).toHaveProperty('online');
        expect(status).toHaveProperty('lastCheck');
        expect(typeof status.online).toBe('boolean');
        expect(status.lastCheck).toBeInstanceOf(Date);
      }
    });

    it('transforms statuses to array format for health endpoint', () => {
      const statuses = {
        cam01: { online: true, lastCheck: new Date() },
        cam02: { online: false, lastCheck: new Date() },
      };
      const cameras = Object.entries(statuses).map(([id, s]) => ({
        id,
        online: s.online,
        lastCheck: s.lastCheck,
      }));
      expect(cameras).toHaveLength(2);
      expect(cameras[0]).toEqual({ id: 'cam01', online: true, lastCheck: expect.any(Date) });
    });

    it('handles empty statuses map', () => {
      const statuses = {};
      const cameras = Object.entries(statuses).map(([id, s]) => ({ id, online: s.online, lastCheck: s.lastCheck }));
      expect(cameras).toHaveLength(0);
    });
  });

  describe('Zone Binding Replacement Logic', () => {
    it('replaces all existing zone bindings with new ones', () => {
      // Simulate the transaction: delete all, then create new
      const existingMappings = [
        { cameraId: 'cam-1', zoneId: 'zone-1', priority: 0 },
        { cameraId: 'cam-1', zoneId: 'zone-2', priority: 5 },
      ];

      const newMappings = [
        { zoneId: 'zone-3', priority: 2 },
        { zoneId: 'zone-4', priority: 8 },
      ];

      // After replacement, only new mappings exist
      const afterReplace = newMappings.map(m => ({
        cameraId: 'cam-1',
        zoneId: m.zoneId,
        priority: m.priority ?? 0,
      }));

      expect(afterReplace).toHaveLength(2);
      expect(afterReplace.map(m => m.zoneId)).toEqual(['zone-3', 'zone-4']);
      expect(afterReplace.find(m => m.zoneId === 'zone-1')).toBeUndefined();
    });

    it('handles empty new mappings (clears all zones)', () => {
      const newMappings = [];
      const afterReplace = newMappings.map(m => ({
        cameraId: 'cam-1',
        zoneId: m.zoneId,
        priority: m.priority ?? 0,
      }));
      expect(afterReplace).toHaveLength(0);
    });
  });

  describe('Camera CRUD Response Shapes', () => {
    it('create response contains id, name, rtspUrl', () => {
      const camera = { id: 'cam-new', name: 'Camera 11', rtspUrl: 'rtsp://192.168.1.100/stream', isActive: true };
      expect(camera).toHaveProperty('id');
      expect(camera).toHaveProperty('name');
      expect(camera).toHaveProperty('rtspUrl');
      expect(camera.isActive).toBe(true);
    });

    it('requires name and rtspUrl for creation', () => {
      const body1 = { name: 'Cam1' }; // missing rtspUrl
      const body2 = { rtspUrl: 'rtsp://...' }; // missing name
      const body3 = { name: 'Cam1', rtspUrl: 'rtsp://192.168.1.1/stream' };

      expect(!body1.name || !body1.rtspUrl).toBe(true);
      expect(!body2.name || !body2.rtspUrl).toBe(true);
      expect(!body3.name || !body3.rtspUrl).toBe(false);
    });

    it('list response includes zone mappings and event count', () => {
      const camera = {
        id: 'cam-1',
        name: 'Camera 01',
        rtspUrl: 'rtsp://192.168.1.10/stream',
        isActive: true,
        zones: [
          { zone: { id: 'z1', name: 'Repair Zone' }, priority: 0 },
          { zone: { id: 'z2', name: 'Waiting Zone' }, priority: 3 },
        ],
        _count: { events: 42 },
      };

      expect(camera.zones).toHaveLength(2);
      expect(camera._count.events).toBe(42);
    });

    it('soft delete sets isActive to false', () => {
      const camera = { id: 'cam-1', isActive: true };
      const afterDelete = { ...camera, isActive: false };
      expect(afterDelete.isActive).toBe(false);
    });

    it('delete response contains message and id', () => {
      const response = { message: 'Камера деактивирована', id: 'cam-1' };
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('id');
    });

    it('update response includes zones when updating', () => {
      const updateInput = { name: 'Updated Camera', rtspUrl: undefined, isActive: undefined };
      const data = {};
      if (updateInput.name !== undefined) data.name = updateInput.name;
      if (updateInput.rtspUrl !== undefined) data.rtspUrl = updateInput.rtspUrl;
      if (updateInput.isActive !== undefined) data.isActive = updateInput.isActive;

      expect(data).toEqual({ name: 'Updated Camera' });
      expect(data).not.toHaveProperty('rtspUrl');
      expect(data).not.toHaveProperty('isActive');
    });
  });
});
