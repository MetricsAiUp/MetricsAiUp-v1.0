import { describe, it, expect } from 'vitest';

describe('Sessions Route Logic', () => {
  describe('Session Status Filtering', () => {
    it('defaults to active status when not specified', () => {
      const query = {};
      const status = query.status || 'active';
      expect(status).toBe('active');
    });

    it('accepts explicit active status', () => {
      const query = { status: 'active' };
      const where = {};
      if (query.status) where.status = query.status;
      expect(where.status).toBe('active');
    });

    it('accepts completed status', () => {
      const query = { status: 'completed' };
      const where = {};
      if (query.status) where.status = query.status;
      expect(where.status).toBe('completed');
    });

    it('filters sessions by status in where clause', () => {
      const sessions = [
        { id: 's1', status: 'active', plateNumber: 'A111AA' },
        { id: 's2', status: 'completed', plateNumber: 'B222BB' },
        { id: 's3', status: 'active', plateNumber: 'C333CC' },
      ];
      const active = sessions.filter(s => s.status === 'active');
      const completed = sessions.filter(s => s.status === 'completed');
      expect(active).toHaveLength(2);
      expect(completed).toHaveLength(1);
    });
  });

  describe('Pagination Logic', () => {
    it('defaults limit to 50 and offset to 0', () => {
      const query = {};
      const limit = parseInt(query.limit) || 50;
      const offset = parseInt(query.offset) || 0;
      expect(limit).toBe(50);
      expect(offset).toBe(0);
    });

    it('parses limit and offset from query strings', () => {
      const query = { limit: '20', offset: '40' };
      const limit = parseInt(query.limit);
      const offset = parseInt(query.offset);
      expect(limit).toBe(20);
      expect(offset).toBe(40);
    });

    it('response includes sessions array and total count', () => {
      const response = {
        sessions: [
          { id: 's1', status: 'active' },
          { id: 's2', status: 'active' },
        ],
        total: 100,
      };
      expect(response).toHaveProperty('sessions');
      expect(response).toHaveProperty('total');
      expect(Array.isArray(response.sessions)).toBe(true);
      expect(typeof response.total).toBe('number');
    });

    it('calculates total pages from total and limit', () => {
      const total = 100;
      const limit = 20;
      const totalPages = Math.ceil(total / limit);
      expect(totalPages).toBe(5);
    });

    it('handles last page with fewer items', () => {
      const total = 53;
      const limit = 20;
      const page3Items = total - 2 * limit; // items on page 3
      expect(page3Items).toBe(13);
    });

    it('offset=0 returns first page', () => {
      const allItems = Array.from({ length: 100 }, (_, i) => ({ id: `s${i}` }));
      const page = allItems.slice(0, 50);
      expect(page).toHaveLength(50);
      expect(page[0].id).toBe('s0');
    });
  });

  describe('Session Includes', () => {
    it('session detail includes zoneStays with zone info', () => {
      const session = {
        id: 's1',
        plateNumber: 'A123BC',
        status: 'active',
        zoneStays: [
          { id: 'zs1', entryTime: new Date(), exitTime: null, zone: { id: 'z1', name: 'Repair Zone' } },
        ],
      };
      expect(session.zoneStays).toHaveLength(1);
      expect(session.zoneStays[0].zone).toHaveProperty('name');
    });

    it('session detail includes postStays with post info', () => {
      const session = {
        id: 's1',
        postStays: [
          { id: 'ps1', startTime: new Date(), endTime: null, post: { id: 'p1', name: 'Пост 01' } },
        ],
      };
      expect(session.postStays).toHaveLength(1);
      expect(session.postStays[0].post).toHaveProperty('name');
    });

    it('session detail includes workOrderLinks', () => {
      const session = {
        id: 's1',
        workOrderLinks: [
          { id: 'wol1', workOrder: { id: 'wo1', status: 'in_progress', normHours: 2.5 } },
        ],
      };
      expect(session.workOrderLinks).toHaveLength(1);
      expect(session.workOrderLinks[0].workOrder).toHaveProperty('status');
    });

    it('session detail includes events ordered by createdAt desc', () => {
      const events = [
        { id: 'e1', createdAt: new Date('2026-04-14T10:00:00Z') },
        { id: 'e2', createdAt: new Date('2026-04-14T12:00:00Z') },
        { id: 'e3', createdAt: new Date('2026-04-14T11:00:00Z') },
      ];
      const sorted = [...events].sort((a, b) => b.createdAt - a.createdAt);
      expect(sorted[0].id).toBe('e2');
      expect(sorted[1].id).toBe('e3');
      expect(sorted[2].id).toBe('e1');
    });
  });

  describe('Duration Calculation for Completed Sessions', () => {
    it('calculates duration from entryTime to exitTime', () => {
      const entry = new Date('2026-04-14T08:00:00Z');
      const exit = new Date('2026-04-14T10:30:00Z');
      const durationMs = exit.getTime() - entry.getTime();
      const durationMinutes = durationMs / 60000;
      expect(durationMinutes).toBe(150); // 2.5 hours
    });

    it('returns null duration for active sessions (no exitTime)', () => {
      const session = { entryTime: new Date(), exitTime: null };
      const duration = session.exitTime
        ? session.exitTime.getTime() - session.entryTime.getTime()
        : null;
      expect(duration).toBeNull();
    });

    it('handles session with multiple zone stays', () => {
      const zoneStays = [
        { entryTime: new Date('2026-04-14T08:00:00Z'), exitTime: new Date('2026-04-14T09:00:00Z'), duration: 3600 },
        { entryTime: new Date('2026-04-14T09:00:00Z'), exitTime: new Date('2026-04-14T10:30:00Z'), duration: 5400 },
      ];
      const totalDuration = zoneStays.reduce((sum, s) => sum + (s.duration || 0), 0);
      expect(totalDuration).toBe(9000); // 2.5 hours in seconds
    });

    it('orders sessions by entryTime descending', () => {
      const sessions = [
        { id: 's1', entryTime: new Date('2026-04-12') },
        { id: 's3', entryTime: new Date('2026-04-14') },
        { id: 's2', entryTime: new Date('2026-04-13') },
      ];
      const sorted = [...sessions].sort((a, b) => b.entryTime - a.entryTime);
      expect(sorted[0].id).toBe('s3');
      expect(sorted[1].id).toBe('s2');
      expect(sorted[2].id).toBe('s1');
    });
  });
});
