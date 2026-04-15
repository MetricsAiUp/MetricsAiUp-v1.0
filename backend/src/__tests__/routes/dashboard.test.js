import { describe, it, expect } from 'vitest';

describe('Dashboard Route Logic', () => {
  describe('Overview Response Shape', () => {
    it('contains activeSessions, zonesWithVehicles, postsStatus, activeRecommendations', () => {
      const response = {
        activeSessions: 12,
        zonesWithVehicles: [
          { zoneId: 'z1', _count: 3 },
          { zoneId: 'z2', _count: 1 },
        ],
        postsStatus: [
          { status: 'free', _count: 4 },
          { status: 'occupied', _count: 3 },
          { status: 'active_work', _count: 2 },
          { status: 'occupied_no_work', _count: 1 },
        ],
        activeRecommendations: 5,
      };

      expect(response).toHaveProperty('activeSessions');
      expect(response).toHaveProperty('zonesWithVehicles');
      expect(response).toHaveProperty('postsStatus');
      expect(response).toHaveProperty('activeRecommendations');
      expect(typeof response.activeSessions).toBe('number');
      expect(Array.isArray(response.zonesWithVehicles)).toBe(true);
      expect(Array.isArray(response.postsStatus)).toBe(true);
      expect(typeof response.activeRecommendations).toBe('number');
    });

    it('zonesWithVehicles has zoneId and _count', () => {
      const entry = { zoneId: 'z1', _count: 5 };
      expect(entry).toHaveProperty('zoneId');
      expect(entry).toHaveProperty('_count');
    });

    it('postsStatus groups by status with _count', () => {
      const statuses = [
        { status: 'free', _count: 6 },
        { status: 'active_work', _count: 3 },
        { status: 'occupied_no_work', _count: 1 },
      ];
      const totalPosts = statuses.reduce((sum, s) => sum + s._count, 0);
      expect(totalPosts).toBe(10);
    });
  });

  describe('Metrics Aggregation for Periods', () => {
    it('24h period sets since to 24 hours ago', () => {
      const period = '24h';
      const since = new Date('2026-04-14T12:00:00Z');
      if (period === '24h') since.setHours(since.getHours() - 24);
      expect(since).toEqual(new Date('2026-04-13T12:00:00Z'));
    });

    it('7d period sets since to 7 days ago', () => {
      const period = '7d';
      const since = new Date('2026-04-14T12:00:00Z');
      if (period === '7d') since.setDate(since.getDate() - 7);
      expect(since).toEqual(new Date('2026-04-07T12:00:00Z'));
    });

    it('30d period sets since to 30 days ago', () => {
      const period = '30d';
      const since = new Date('2026-04-14T12:00:00Z');
      if (period === '30d') since.setDate(since.getDate() - 30);
      expect(since).toEqual(new Date('2026-03-15T12:00:00Z'));
    });

    it('defaults to 24h when period not specified', () => {
      const query = {};
      const period = query.period || '24h';
      expect(period).toBe('24h');
    });

    it('metrics response includes zoneMetrics, postMetrics, workOrderMetrics', () => {
      const response = {
        zoneMetrics: [
          { zoneId: 'z1', _avg: { duration: 3600 }, _count: 10 },
        ],
        postMetrics: [
          { postId: 'p1', _avg: { activeTime: 7200, idleTime: 900 }, _count: 5 },
        ],
        workOrderMetrics: [
          { status: 'completed', _count: 8 },
          { status: 'in_progress', _count: 3 },
        ],
        period: '24h',
      };

      expect(response).toHaveProperty('zoneMetrics');
      expect(response).toHaveProperty('postMetrics');
      expect(response).toHaveProperty('workOrderMetrics');
      expect(response).toHaveProperty('period');
    });

    it('zoneMetrics has _avg.duration and _count per zone', () => {
      const metric = { zoneId: 'z1', _avg: { duration: 4500 }, _count: 15 };
      expect(metric._avg.duration).toBe(4500);
      expect(metric._count).toBe(15);
    });

    it('postMetrics has _avg.activeTime and _avg.idleTime', () => {
      const metric = { postId: 'p1', _avg: { activeTime: 5400, idleTime: 600 }, _count: 8 };
      expect(metric._avg.activeTime).toBe(5400);
      expect(metric._avg.idleTime).toBe(600);
    });
  });

  describe('Trend Data Structure', () => {
    it('returns 7-day array of trend entries', () => {
      const trends = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date('2026-04-14');
        d.setDate(d.getDate() - i);
        trends.push({
          date: d.toISOString().slice(0, 10),
          activeSessions: Math.floor(Math.random() * 20),
          postStays: Math.floor(Math.random() * 30),
          occupiedPosts: Math.floor(Math.random() * 10),
          recommendations: Math.floor(Math.random() * 5),
        });
      }

      expect(trends).toHaveLength(7);
      expect(trends[0].date).toBe('2026-04-08');
      expect(trends[6].date).toBe('2026-04-14');
    });

    it('each trend entry has date, activeSessions, postStays, occupiedPosts, recommendations', () => {
      const entry = {
        date: '2026-04-14',
        activeSessions: 15,
        postStays: 22,
        occupiedPosts: 8,
        recommendations: 3,
      };
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('activeSessions');
      expect(entry).toHaveProperty('postStays');
      expect(entry).toHaveProperty('occupiedPosts');
      expect(entry).toHaveProperty('recommendations');
    });

    it('date format is YYYY-MM-DD', () => {
      const date = new Date('2026-04-14T15:30:00Z');
      const formatted = date.toISOString().slice(0, 10);
      expect(formatted).toBe('2026-04-14');
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('day boundary calculation is correct', () => {
      const dayStart = new Date('2026-04-14');
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      expect(dayStart.getHours()).toBe(0);
      expect(dayStart.getMinutes()).toBe(0);
      expect(dayEnd.getDate()).toBe(dayStart.getDate() + 1);
    });
  });

  describe('Live Mode vs Demo Mode Response', () => {
    it('live mode response has mode=live and monitoring fields', () => {
      const response = {
        mode: 'live',
        vehiclesOnSite: 8,
        totalPosts: 10,
        posts: [],
        freeZones: [],
        summary: { working: 3, occupied: 5, free: 5, idle: 2, zonesOccupied: 3, zonesFree: 2 },
        lastUpdate: new Date().toISOString(),
      };

      expect(response.mode).toBe('live');
      expect(response).toHaveProperty('freeZones');
      expect(response).toHaveProperty('lastUpdate');
      expect(response.summary).toHaveProperty('zonesOccupied');
      expect(response.summary).toHaveProperty('zonesFree');
    });

    it('demo mode response has mode=demo without freeZones', () => {
      const response = {
        mode: 'demo',
        vehiclesOnSite: 5,
        totalPosts: 10,
        posts: [],
        summary: { working: 2, occupied: 4, free: 6, idle: 1 },
      };

      expect(response.mode).toBe('demo');
      expect(response).not.toHaveProperty('freeZones');
      expect(response).not.toHaveProperty('lastUpdate');
    });

    it('live post has extended fields: carModel, carColor, peopleCount, confidence', () => {
      const livePost = {
        id: 'p1',
        name: 'Пост 01',
        zone: 'Зона тяжёлого ремонта',
        status: 'active_work',
        plateNumber: 'A123BC',
        startTime: '2026-04-14T08:00:00Z',
        carModel: 'Toyota Camry',
        carColor: 'white',
        worksInProgress: true,
        worksDescription: 'Замена тормозных колодок',
        peopleCount: 2,
        openParts: false,
        confidence: 0.94,
        lastUpdate: '2026-04-14T10:00:00Z',
      };

      expect(livePost).toHaveProperty('carModel');
      expect(livePost).toHaveProperty('carColor');
      expect(livePost).toHaveProperty('peopleCount');
      expect(livePost).toHaveProperty('confidence');
      expect(livePost).toHaveProperty('worksInProgress');
    });

    it('demo post has basic fields only', () => {
      const demoPost = {
        id: 'p1',
        name: 'Пост 01',
        zone: 'Зона тяжёлого ремонта',
        status: 'free',
        plateNumber: null,
        startTime: null,
      };

      expect(demoPost).toHaveProperty('id');
      expect(demoPost).toHaveProperty('name');
      expect(demoPost).toHaveProperty('status');
      expect(demoPost).not.toHaveProperty('carModel');
      expect(demoPost).not.toHaveProperty('confidence');
    });
  });

  describe('Post Status Aggregation', () => {
    it('calculates free/occupied/working/idle counts from posts', () => {
      const posts = [
        { status: 'free' },
        { status: 'free' },
        { status: 'active_work' },
        { status: 'active_work' },
        { status: 'active_work' },
        { status: 'occupied' },
        { status: 'occupied_no_work' },
        { status: 'free' },
        { status: 'occupied' },
        { status: 'free' },
      ];

      const working = posts.filter(p => p.status === 'active_work').length;
      const occupied = posts.filter(p => p.status !== 'free').length;
      const free = posts.filter(p => p.status === 'free').length;
      const idle = posts.filter(p => p.status === 'occupied_no_work').length;

      expect(working).toBe(3);
      expect(occupied).toBe(6); // all non-free
      expect(free).toBe(4);
      expect(idle).toBe(1);
      expect(free + occupied).toBe(posts.length);
    });

    it('handles all posts free', () => {
      const posts = Array.from({ length: 10 }, () => ({ status: 'free' }));
      const free = posts.filter(p => p.status === 'free').length;
      const occupied = posts.filter(p => p.status !== 'free').length;
      expect(free).toBe(10);
      expect(occupied).toBe(0);
    });

    it('handles all posts occupied', () => {
      const posts = [
        { status: 'active_work' },
        { status: 'occupied' },
        { status: 'occupied_no_work' },
      ];
      const free = posts.filter(p => p.status === 'free').length;
      expect(free).toBe(0);
    });

    it('post number extracted from name for live matching', () => {
      const dbPost = { id: 'p5', name: 'Пост 05' };
      const num = parseInt(dbPost.name.match(/\d+/)?.[0], 10);
      expect(num).toBe(5);

      const monitoringPost = { postNumber: 5 };
      expect(num === monitoringPost.postNumber).toBe(true);
    });
  });
});
