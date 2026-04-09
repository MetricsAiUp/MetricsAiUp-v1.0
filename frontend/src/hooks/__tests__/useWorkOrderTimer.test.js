import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkOrderTimer } from '../useWorkOrderTimer';

describe('useWorkOrderTimer', () => {
  const mockApi = {
    post: vi.fn().mockResolvedValue({ data: {} }),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns zero elapsed when no workOrder', () => {
    const { result } = renderHook(() => useWorkOrderTimer(null, mockApi));
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.warningLevel).toBe('none');
    expect(result.current.isPaused).toBe(false);
    expect(result.current.isRunning).toBe(false);
  });

  it('returns zero elapsed when workOrder has no startTime', () => {
    const { result } = renderHook(() => useWorkOrderTimer({ id: 1 }, mockApi));
    expect(result.current.elapsedMs).toBe(0);
  });

  it('calculates elapsed from startTime for in_progress order', () => {
    const workOrder = {
      id: 1,
      status: 'in_progress',
      startTime: '2026-04-09T10:00:00Z', // 2 hours ago
      normHours: 4,
      totalPausedMs: 0,
    };
    const { result } = renderHook(() => useWorkOrderTimer(workOrder, mockApi));
    // 2 hours = 7200000 ms
    expect(result.current.elapsedMs).toBe(7200000);
  });

  it('returns correct warningLevel at different percentages', () => {
    // 80% used -> warning (normHours=1, elapsed ~48min = 2880000ms)
    const workOrder80 = {
      id: 1,
      status: 'in_progress',
      startTime: new Date(Date.now() - 2880000).toISOString(), // 48 min ago
      normHours: 1,
      totalPausedMs: 0,
    };
    const { result: r80 } = renderHook(() => useWorkOrderTimer(workOrder80, mockApi));
    expect(r80.current.warningLevel).toBe('warning');

    // 95% used -> critical (normHours=1, elapsed ~57min = 3420000ms)
    const workOrder95 = {
      id: 2,
      status: 'in_progress',
      startTime: new Date(Date.now() - 3420000).toISOString(),
      normHours: 1,
      totalPausedMs: 0,
    };
    const { result: r95 } = renderHook(() => useWorkOrderTimer(workOrder95, mockApi));
    expect(r95.current.warningLevel).toBe('critical');

    // 100%+ used -> overtime (normHours=1, elapsed 70min = 4200000ms)
    const workOrder100 = {
      id: 3,
      status: 'in_progress',
      startTime: new Date(Date.now() - 4200000).toISOString(),
      normHours: 1,
      totalPausedMs: 0,
    };
    const { result: r100 } = renderHook(() => useWorkOrderTimer(workOrder100, mockApi));
    expect(r100.current.warningLevel).toBe('overtime');
  });

  it('isPaused is true when pausedAt is set', () => {
    const workOrder = {
      id: 1,
      status: 'in_progress',
      startTime: '2026-04-09T10:00:00Z',
      pausedAt: '2026-04-09T11:00:00Z',
      normHours: 4,
      totalPausedMs: 0,
    };
    const { result } = renderHook(() => useWorkOrderTimer(workOrder, mockApi));
    expect(result.current.isPaused).toBe(true);
    expect(result.current.isRunning).toBe(false);
    // Elapsed should be from start to pausedAt: 1 hour = 3600000ms
    expect(result.current.elapsedMs).toBe(3600000);
  });

  it('calculates elapsed for completed order using endTime', () => {
    const workOrder = {
      id: 1,
      status: 'completed',
      startTime: '2026-04-09T10:00:00Z',
      endTime: '2026-04-09T11:30:00Z',
      normHours: 2,
      totalPausedMs: 600000, // 10 min paused
    };
    const { result } = renderHook(() => useWorkOrderTimer(workOrder, mockApi));
    // 1.5 hours - 10 min = 5400000 - 600000 = 4800000ms
    expect(result.current.elapsedMs).toBe(4800000);
  });
});
