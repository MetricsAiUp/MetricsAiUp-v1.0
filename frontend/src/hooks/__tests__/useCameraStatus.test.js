import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockGet = vi.fn();
let socketCallback = null;

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    api: {
      get: mockGet,
    },
  }),
}));

vi.mock('../useSocket', () => ({
  useSocket: (event, cb) => {
    socketCallback = cb;
  },
}));

import { useCameraStatus } from '../useCameraStatus';

describe('useCameraStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketCallback = null;
    mockGet.mockResolvedValue({
      data: { cam01: { online: true }, cam02: { online: false } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial camera statuses from API', async () => {
    const { result } = renderHook(() => useCameraStatus());

    await waitFor(() => {
      expect(result.current).toEqual({
        cam01: { online: true },
        cam02: { online: false },
      });
    });

    expect(mockGet).toHaveBeenCalledWith('/api/cameras/health');
  });

  it('updates status on socket event', async () => {
    const { result } = renderHook(() => useCameraStatus());

    // Wait for initial API data to load
    await waitFor(() => {
      expect(result.current.cam01).toBeDefined();
    });

    // Simulate a socket event updating cam02 to online
    act(() => {
      socketCallback({ camId: 'cam02', online: true });
    });

    expect(result.current.cam02).toEqual({ online: true });
  });

  it('handles API error gracefully', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useCameraStatus());

    // Should not throw, returns empty object
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    expect(result.current).toEqual({});
  });
});
