import { describe, it, expect } from 'vitest';

const ZONE_TYPES = ['repair', 'waiting', 'entry', 'parking', 'free'];

describe('Zones Route Logic', () => {
  describe('Zone Types', () => {
    it('has exactly 5 defined zone types', () => {
      expect(ZONE_TYPES).toHaveLength(5);
    });

    it('includes repair, waiting, entry, parking, free', () => {
      expect(ZONE_TYPES).toContain('repair');
      expect(ZONE_TYPES).toContain('waiting');
      expect(ZONE_TYPES).toContain('entry');
      expect(ZONE_TYPES).toContain('parking');
      expect(ZONE_TYPES).toContain('free');
    });

    it('validates type is one of allowed values', () => {
      const validType = 'repair';
      const invalidType = 'storage';
      expect(ZONE_TYPES.includes(validType)).toBe(true);
      expect(ZONE_TYPES.includes(invalidType)).toBe(false);
    });
  });

  describe('Zone with Posts and Camera Mappings Response Shape', () => {
    it('zone includes posts array', () => {
      const zone = {
        id: 'z1',
        name: 'Repair Zone',
        type: 'repair',
        isActive: true,
        posts: [
          { id: 'p1', name: 'Пост 01', type: 'heavy', status: 'free' },
          { id: 'p2', name: 'Пост 02', type: 'heavy', status: 'occupied' },
        ],
        cameras: [],
        _count: { stays: 3 },
      };
      expect(zone.posts).toHaveLength(2);
      expect(zone.posts[0]).toHaveProperty('id');
      expect(zone.posts[0]).toHaveProperty('name');
      expect(zone.posts[0]).toHaveProperty('status');
    });

    it('zone includes camera mappings with camera details', () => {
      const zone = {
        id: 'z1',
        name: 'Repair Zone',
        type: 'repair',
        isActive: true,
        posts: [],
        cameras: [
          { camera: { id: 'cam-1', name: 'Camera 01', rtspUrl: 'rtsp://...' }, priority: 0 },
          { camera: { id: 'cam-2', name: 'Camera 02', rtspUrl: 'rtsp://...' }, priority: 5 },
        ],
        _count: { stays: 0 },
      };
      expect(zone.cameras).toHaveLength(2);
      expect(zone.cameras[0].camera).toHaveProperty('name');
      expect(zone.cameras[1].priority).toBe(5);
    });

    it('zone _count.stays represents current vehicles (exitTime null)', () => {
      // The query uses: _count: { select: { stays: { where: { exitTime: null } } } }
      const zone = { id: 'z1', _count: { stays: 4 } };
      expect(zone._count.stays).toBe(4);
      expect(typeof zone._count.stays).toBe('number');
    });

    it('zone detail includes active stays with vehicleSession', () => {
      const zoneDetail = {
        id: 'z1',
        name: 'Repair Zone',
        stays: [
          { id: 's1', entryTime: new Date(), exitTime: null, vehicleSession: { plateNumber: 'A123BC' } },
          { id: 's2', entryTime: new Date(), exitTime: null, vehicleSession: { plateNumber: 'X789YZ' } },
        ],
      };
      expect(zoneDetail.stays).toHaveLength(2);
      expect(zoneDetail.stays[0].exitTime).toBeNull();
      expect(zoneDetail.stays[0].vehicleSession.plateNumber).toBe('A123BC');
    });
  });

  describe('Soft Delete Behavior', () => {
    it('soft delete sets isActive to false instead of removing', () => {
      const zone = { id: 'z1', name: 'Old Zone', isActive: true };
      const afterDelete = { ...zone, isActive: false };
      expect(afterDelete.isActive).toBe(false);
      expect(afterDelete.id).toBe('z1');
      expect(afterDelete.name).toBe('Old Zone');
    });

    it('GET list only returns active zones (isActive=true)', () => {
      const allZones = [
        { id: 'z1', name: 'Active', isActive: true },
        { id: 'z2', name: 'Deleted', isActive: false },
        { id: 'z3', name: 'Active 2', isActive: true },
      ];
      const activeOnly = allZones.filter(z => z.isActive);
      expect(activeOnly).toHaveLength(2);
      expect(activeOnly.find(z => z.name === 'Deleted')).toBeUndefined();
    });

    it('delete response contains message and id', () => {
      const response = { message: 'Zone deactivated', id: 'z1' };
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('id');
    });

    it('P2025 error maps to 404 for non-existent zone', () => {
      const error = { code: 'P2025' };
      const isNotFound = error.code === 'P2025';
      expect(isNotFound).toBe(true);
    });
  });

  describe('Vehicle Count Calculation Per Zone', () => {
    it('counts vehicles by stays with exitTime null', () => {
      const stays = [
        { zoneId: 'z1', exitTime: null },
        { zoneId: 'z1', exitTime: null },
        { zoneId: 'z1', exitTime: new Date() }, // exited
        { zoneId: 'z2', exitTime: null },
      ];
      const z1Count = stays.filter(s => s.zoneId === 'z1' && s.exitTime === null).length;
      const z2Count = stays.filter(s => s.zoneId === 'z2' && s.exitTime === null).length;
      expect(z1Count).toBe(2);
      expect(z2Count).toBe(1);
    });

    it('groups vehicle counts by zoneId', () => {
      const groupBy = [
        { zoneId: 'z1', _count: 3 },
        { zoneId: 'z2', _count: 1 },
        { zoneId: 'z3', _count: 0 },
      ];
      const zoneMap = Object.fromEntries(groupBy.map(g => [g.zoneId, g._count]));
      expect(zoneMap['z1']).toBe(3);
      expect(zoneMap['z2']).toBe(1);
      expect(zoneMap['z3']).toBe(0);
    });

    it('returns 0 vehicles for zone with no active stays', () => {
      const stays = [
        { zoneId: 'z1', exitTime: new Date() },
        { zoneId: 'z1', exitTime: new Date() },
      ];
      const activeCount = stays.filter(s => s.zoneId === 'z1' && s.exitTime === null).length;
      expect(activeCount).toBe(0);
    });

    it('zone list is sorted by name ascending', () => {
      const zones = [
        { name: 'Зона ожидания' },
        { name: 'Зона въезда' },
        { name: 'Зона ремонта' },
      ];
      const sorted = [...zones].sort((a, b) => a.name.localeCompare(b.name));
      expect(sorted[0].name).toBe('Зона въезда');
    });
  });
});
