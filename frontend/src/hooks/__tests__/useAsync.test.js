import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';

// Mock AuthContext
const mockApi = {
  get: vi.fn(),
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ api: mockApi }),
}));

// Import after mocking
const { default: useAsync } = await import('../useAsync');

describe('useAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches data on mount', async () => {
    mockApi.get.mockResolvedValue({ data: { items: [1, 2, 3] } });

    const { result } = renderHook(() => useAsync('/api/test'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ items: [1, 2, 3] });
    expect(result.current.error).toBeNull();
    expect(mockApi.get).toHaveBeenCalledWith('/api/test');
  });

  it('applies transform function', async () => {
    mockApi.get.mockResolvedValue({ data: { items: [1, 2, 3] } });

    const { result } = renderHook(() =>
      useAsync('/api/test', { transform: (res) => res.data.items })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([1, 2, 3]);
  });

  it('handles errors', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAsync('/api/test'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error.message).toBe('Network error');
  });

  it('does not fetch when enabled=false', async () => {
    const { result } = renderHook(() =>
      useAsync('/api/test', { enabled: false })
    );

    // Should not be loading and should not have called API
    expect(result.current.loading).toBe(false);
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('uses initialData', () => {
    const { result } = renderHook(() =>
      useAsync('/api/test', { enabled: false, initialData: 'default' })
    );

    expect(result.current.data).toBe('default');
  });

  it('provides refetch function', async () => {
    mockApi.get.mockResolvedValue({ data: 'first' });

    const { result } = renderHook(() => useAsync('/api/test'));

    await waitFor(() => {
      expect(result.current.data).toBe('first');
    });

    mockApi.get.mockResolvedValue({ data: 'second' });
    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toBe('second');
    });

    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });
});
