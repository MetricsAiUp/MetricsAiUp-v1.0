import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Store event handlers so we can simulate events
let mockSocketHandlers = {};
let mockSocket = null;

function createMockSocket() {
  mockSocketHandlers = {};
  mockSocket = {
    on: vi.fn((event, handler) => {
      if (!mockSocketHandlers[event]) mockSocketHandlers[event] = [];
      mockSocketHandlers[event].push(handler);
    }),
    off: vi.fn((event, handler) => {
      if (mockSocketHandlers[event]) {
        mockSocketHandlers[event] = mockSocketHandlers[event].filter((h) => h !== handler);
      }
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    id: 'mock-socket-id',
  };
  return mockSocket;
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => createMockSocket()),
}));

// We need to re-import after mocking to get a fresh module for each test
let socketModule;

describe('useSocket module', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    // Reset the module to clear the module-level `socket` variable
    vi.resetModules();
    socketModule = await import('../useSocket');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('getSocket returns null before connection', () => {
    expect(socketModule.getSocket()).toBeNull();
  });

  it('connectSocket creates socket with auth token', async () => {
    const { io } = await import('socket.io-client');
    socketModule.connectSocket('my-test-token');

    expect(io).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { token: 'my-test-token' },
      })
    );
    expect(socketModule.getSocket()).not.toBeNull();
  });

  it('connectSocket emits subscribe:all on connect', () => {
    socketModule.connectSocket('token123');

    // Simulate the 'connect' event
    expect(mockSocketHandlers['connect']).toBeDefined();
    const connectHandler = mockSocketHandlers['connect'][0];
    connectHandler();

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:all');
  });

  it('disconnectSocket calls socket.disconnect', () => {
    socketModule.connectSocket('token');
    const sock = socketModule.getSocket();
    socketModule.disconnectSocket();

    expect(sock.disconnect).toHaveBeenCalled();
    expect(socketModule.getSocket()).toBeNull();
  });

  it('usePolling calls callback at interval', () => {
    const callback = vi.fn();
    renderHook(() => socketModule.usePolling(callback, 3000));

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('usePolling cleans up interval on unmount', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => socketModule.usePolling(callback, 2000));

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    // Should still be 1 — no more calls after unmount
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('usePolling skips when intervalMs is 0', () => {
    const callback = vi.fn();
    renderHook(() => socketModule.usePolling(callback, 0));

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
