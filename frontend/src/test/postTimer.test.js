import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Test the usePostTimerText hook logic
describe('PostTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports default component and usePostTimerText hook', async () => {
    const mod = await import('../components/PostTimer');
    expect(mod.default).toBeDefined();
    expect(mod.usePostTimerText).toBeDefined();
  });

  it('usePostTimerText returns empty when no estimatedEnd', async () => {
    const { usePostTimerText } = await import('../components/PostTimer');
    const { result } = renderHook(() => usePostTimerText(null, null));
    expect(result.current.text).toBe('');
    expect(result.current.color).toBe('#94a3b8');
  });

  it('usePostTimerText returns green color when time remaining is >35%', async () => {
    const { usePostTimerText } = await import('../components/PostTimer');
    const now = Date.now();
    const start = new Date(now - 1000 * 60 * 10).toISOString(); // 10 min ago
    const end = new Date(now + 1000 * 60 * 50).toISOString(); // 50 min from now (50/60 = 83% remaining)

    const { result } = renderHook(() => usePostTimerText(end, start));
    expect(result.current.color).toBe('#10b981'); // green
    expect(result.current.pulse).toBe(false);
    expect(result.current.text).not.toBe('');
  });

  it('usePostTimerText returns red+pulse when time exceeded', async () => {
    const { usePostTimerText } = await import('../components/PostTimer');
    const now = Date.now();
    const start = new Date(now - 1000 * 60 * 70).toISOString(); // 70 min ago
    const end = new Date(now - 1000 * 60 * 10).toISOString(); // 10 min ago (past)

    const { result } = renderHook(() => usePostTimerText(end, start));
    expect(result.current.color).toBe('#ef4444'); // red
    expect(result.current.pulse).toBe(true);
    expect(result.current.text).toMatch(/^\+/); // starts with +
  });

  it('usePostTimerText returns yellow when 15-35% remaining', async () => {
    const { usePostTimerText } = await import('../components/PostTimer');
    const now = Date.now();
    const start = new Date(now - 1000 * 60 * 45).toISOString(); // 45 min ago
    const end = new Date(now + 1000 * 60 * 15).toISOString(); // 15 min left (25% of 60 min)

    const { result } = renderHook(() => usePostTimerText(end, start));
    expect(result.current.color).toBe('#f59e0b'); // yellow
    expect(result.current.pulse).toBe(false);
  });

  it('formats time correctly with hours', async () => {
    const { usePostTimerText } = await import('../components/PostTimer');
    const now = Date.now();
    const start = new Date(now - 1000 * 60).toISOString();
    const end = new Date(now + 1000 * 3700).toISOString(); // ~1h remaining

    const { result } = renderHook(() => usePostTimerText(end, start));
    expect(result.current.text).toMatch(/1:\d{2}:\d{2}/); // h:mm:ss
  });
});
