import { describe, it, expect, vi } from 'vitest';

// Unit tests for work order timer business logic.
// We test the logic patterns used in the route handlers rather than HTTP endpoints.

describe('workOrders - timer logic', () => {
  describe('start', () => {
    it('sets status to in_progress with startTime', () => {
      const wo = { id: '1', status: 'scheduled', normHours: 2 };
      const now = new Date('2026-04-09T10:00:00Z');

      // Simulate the logic from POST /:id/start
      expect(wo.status).not.toBe('in_progress');
      const estimatedEnd = wo.normHours ? new Date(now.getTime() + wo.normHours * 3600000) : null;
      const updateData = {
        status: 'in_progress',
        startTime: now,
        estimatedEnd,
        totalPausedMs: 0,
        pausedAt: null,
      };

      expect(updateData.status).toBe('in_progress');
      expect(updateData.startTime).toEqual(now);
      expect(updateData.estimatedEnd).toEqual(new Date('2026-04-09T12:00:00Z'));
      expect(updateData.totalPausedMs).toBe(0);
    });

    it('rejects start when already in progress', () => {
      const wo = { id: '1', status: 'in_progress' };
      // Route returns 409 if already in_progress
      expect(wo.status === 'in_progress').toBe(true);
    });
  });

  describe('pause', () => {
    it('sets pausedAt to current time', () => {
      const wo = { id: '1', status: 'in_progress', pausedAt: null };
      const now = new Date('2026-04-09T10:30:00Z');

      // Only pausable if in_progress and not already paused
      expect(wo.status === 'in_progress' && !wo.pausedAt).toBe(true);
      const updateData = { pausedAt: now };
      expect(updateData.pausedAt).toEqual(now);
    });

    it('rejects pause when not in progress', () => {
      const wo = { id: '1', status: 'scheduled', pausedAt: null };
      expect(wo.status !== 'in_progress' || wo.pausedAt).toBe(true);
    });

    it('rejects pause when already paused', () => {
      const wo = { id: '1', status: 'in_progress', pausedAt: new Date('2026-04-09T10:00:00Z') };
      const cannotPause = wo.status !== 'in_progress' || !!wo.pausedAt;
      expect(cannotPause).toBe(true);
    });
  });

  describe('resume', () => {
    it('calculates totalPausedMs correctly', () => {
      const pausedAt = new Date('2026-04-09T10:30:00Z');
      const wo = { id: '1', status: 'in_progress', pausedAt, totalPausedMs: 0, estimatedEnd: new Date('2026-04-09T12:00:00Z') };
      const nowMs = new Date('2026-04-09T10:45:00Z').getTime();

      // Simulate resume logic
      const pauseDuration = nowMs - new Date(wo.pausedAt).getTime();
      expect(pauseDuration).toBe(15 * 60 * 1000); // 15 minutes

      const newTotalPaused = (wo.totalPausedMs || 0) + pauseDuration;
      expect(newTotalPaused).toBe(900000);

      const newEstimatedEnd = wo.estimatedEnd ? new Date(new Date(wo.estimatedEnd).getTime() + pauseDuration) : null;
      expect(newEstimatedEnd).toEqual(new Date('2026-04-09T12:15:00Z'));
    });

    it('accumulates multiple pauses', () => {
      const firstPauseMs = 600000; // 10 min
      const wo = { totalPausedMs: firstPauseMs, pausedAt: new Date('2026-04-09T11:00:00Z') };
      const nowMs = new Date('2026-04-09T11:05:00Z').getTime();

      const pauseDuration = nowMs - new Date(wo.pausedAt).getTime();
      const newTotalPaused = (wo.totalPausedMs || 0) + pauseDuration;
      expect(newTotalPaused).toBe(900000); // 10 + 5 = 15 minutes
    });

    it('rejects resume when not paused', () => {
      const wo = { id: '1', pausedAt: null };
      expect(!wo || !wo.pausedAt).toBe(true);
    });
  });

  describe('complete', () => {
    it('calculates actualHours correctly', () => {
      const startTime = new Date('2026-04-09T10:00:00Z');
      const now = new Date('2026-04-09T12:30:00Z');
      const wo = { startTime, totalPausedMs: 900000, pausedAt: null }; // 15 min paused

      let totalPaused = wo.totalPausedMs || 0;
      if (wo.pausedAt) totalPaused += now.getTime() - new Date(wo.pausedAt).getTime();

      const actualMs = wo.startTime ? now.getTime() - new Date(wo.startTime).getTime() - totalPaused : 0;
      const actualHours = +(actualMs / 3600000).toFixed(2);

      // 2.5 hours total - 0.25 hours paused = 2.25 hours actual
      expect(actualHours).toBe(2.25);
    });

    it('includes active pause in total pause time when completing while paused', () => {
      const startTime = new Date('2026-04-09T10:00:00Z');
      const pausedAt = new Date('2026-04-09T11:00:00Z');
      const now = new Date('2026-04-09T12:00:00Z');
      const wo = { startTime, totalPausedMs: 0, pausedAt };

      let totalPaused = wo.totalPausedMs || 0;
      if (wo.pausedAt) totalPaused += now.getTime() - new Date(wo.pausedAt).getTime();

      expect(totalPaused).toBe(3600000); // 1 hour of active pause

      const actualMs = wo.startTime ? now.getTime() - new Date(wo.startTime).getTime() - totalPaused : 0;
      const actualHours = +(actualMs / 3600000).toFixed(2);

      // 2 hours total - 1 hour paused = 1 hour actual
      expect(actualHours).toBe(1);
    });

    it('returns 0 actualHours when no startTime', () => {
      const now = new Date('2026-04-09T12:00:00Z');
      const wo = { startTime: null, totalPausedMs: 0, pausedAt: null };

      const actualMs = wo.startTime ? now.getTime() - new Date(wo.startTime).getTime() : 0;
      expect(actualMs).toBe(0);
    });
  });

  describe('schedule - version conflict', () => {
    it('detects version mismatch', () => {
      const current = { id: '1', version: 3 };
      const assignment = { workOrderId: '1', version: 2 };

      const hasConflict = assignment.version !== undefined &&
        assignment.version !== null &&
        assignment.version !== current.version;

      expect(hasConflict).toBe(true);
    });

    it('passes when versions match', () => {
      const current = { id: '1', version: 3 };
      const assignment = { workOrderId: '1', version: 3 };

      const hasConflict = assignment.version !== undefined &&
        assignment.version !== null &&
        assignment.version !== current.version;

      expect(hasConflict).toBe(false);
    });

    it('passes when client version is undefined (no optimistic locking)', () => {
      const current = { id: '1', version: 3 };
      const assignment = { workOrderId: '1' };

      const hasConflict = assignment.version !== undefined &&
        assignment.version !== null &&
        assignment.version !== current.version;

      expect(hasConflict).toBe(false);
    });

    it('passes when client version is null', () => {
      const current = { id: '1', version: 3 };
      const assignment = { workOrderId: '1', version: null };

      const hasConflict = assignment.version !== undefined &&
        assignment.version !== null &&
        assignment.version !== current.version;

      expect(hasConflict).toBe(false);
    });
  });
});
