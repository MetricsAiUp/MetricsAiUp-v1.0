import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Get CJS module references (shared with SUT via require cache) ---

const prisma = require('../../config/database');
const socket = require('../../config/socket');

// --- Spy setup ---

const spies = {};

function setupSpies() {
  spies.postFindUnique = vi.spyOn(prisma.post, 'findUnique');
  spies.postStayFindFirst = vi.spyOn(prisma.postStay, 'findFirst');
  spies.workOrderFindMany = vi.spyOn(prisma.workOrder, 'findMany');
  spies.workOrderUpdate = vi.spyOn(prisma.workOrder, 'update');
  spies.zoneFindUnique = vi.spyOn(prisma.zone, 'findUnique');
  spies.recFindFirst = vi.spyOn(prisma.recommendation, 'findFirst');
  spies.recCreate = vi.spyOn(prisma.recommendation, 'create');
  spies.getIO = vi.spyOn(socket, 'getIO');
}

setupSpies();

// --- Import SUT ---

const { checkRecommendations } = require('../../services/recommendationEngine');

// --- Test Suite ---

describe('recommendationEngine - checkRecommendations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T12:00:00Z'));
    vi.clearAllMocks();

    // Re-setup spies after clearAllMocks
    setupSpies();

    // Default: no existing recommendation
    spies.recFindFirst.mockResolvedValue(null);
    spies.recCreate.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'rec_1', ...data, status: 'active' }),
    );

    // Default empty results
    spies.postFindUnique.mockResolvedValue(null);
    spies.postStayFindFirst.mockResolvedValue(null);
    spies.workOrderFindMany.mockResolvedValue([]);
    spies.zoneFindUnique.mockResolvedValue(null);

    spies.getIO.mockReturnValue({
      to: vi.fn(() => ({ emit: vi.fn() })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setupSpies();
  });

  // --- checkPostFree ---

  it('checkPostFree: creates recommendation when post idle > 30 min', async () => {
    spies.postFindUnique.mockResolvedValue({
      id: 'post_01',
      name: 'Post 1',
      status: 'free',
    });

    const endTime = new Date('2026-04-14T11:15:00Z');
    spies.postStayFindFirst.mockImplementation((args) => {
      // checkVehicleIdle: has hasWorker: false
      if (args?.where?.hasWorker === false) {
        return Promise.resolve(null);
      }
      // checkWorkOvertime: has include
      if (args?.include?.vehicleSession) {
        return Promise.resolve(null);
      }
      // checkPostFree: orderBy endTime desc
      return Promise.resolve({
        id: 'ps_1',
        postId: 'post_01',
        endTime,
      });
    });

    await checkRecommendations(null, 'post_01');

    expect(spies.recCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'post_free',
        postId: 'post_01',
      }),
    });
  });

  it('checkPostFree: skips when post is not free', async () => {
    spies.postFindUnique.mockResolvedValue({
      id: 'post_01',
      name: 'Post 1',
      status: 'occupied',
    });

    await checkRecommendations(null, 'post_01');

    const postFreeCalls = spies.recCreate.mock.calls.filter(
      (call) => call[0].data.type === 'post_free',
    );
    expect(postFreeCalls).toHaveLength(0);
  });

  it('checkPostFree: skips when post has been free for less than 30 min', async () => {
    spies.postFindUnique.mockResolvedValue({
      id: 'post_01',
      name: 'Post 1',
      status: 'free',
    });

    const endTime = new Date('2026-04-14T11:50:00Z');
    spies.postStayFindFirst.mockImplementation((args) => {
      if (args?.where?.hasWorker === false) return Promise.resolve(null);
      if (args?.include?.vehicleSession) return Promise.resolve(null);
      return Promise.resolve({
        id: 'ps_1',
        postId: 'post_01',
        endTime,
      });
    });

    await checkRecommendations(null, 'post_01');

    const postFreeCalls = spies.recCreate.mock.calls.filter(
      (call) => call[0].data.type === 'post_free',
    );
    expect(postFreeCalls).toHaveLength(0);
  });

  // --- checkWorkOvertime ---

  it('checkWorkOvertime: creates recommendation when elapsed > normHours * 1.2', async () => {
    spies.postFindUnique.mockResolvedValue({
      id: 'post_01',
      name: 'Post 1',
      status: 'active_work',
    });

    const startTime = new Date('2026-04-14T09:00:00Z');

    spies.postStayFindFirst.mockImplementation((args) => {
      // checkWorkOvertime query has include.vehicleSession
      if (args?.include?.vehicleSession) {
        return Promise.resolve({
          id: 'ps_1',
          postId: 'post_01',
          startTime,
          endTime: null,
          vehicleSession: {
            workOrderLinks: [
              {
                workOrder: {
                  id: 'wo_1',
                  normHours: 2,
                  status: 'in_progress',
                },
              },
            ],
          },
        });
      }
      return Promise.resolve(null);
    });

    await checkRecommendations(null, 'post_01');

    const overtimeCalls = spies.recCreate.mock.calls.filter(
      (call) => call[0].data.type === 'work_overtime',
    );
    expect(overtimeCalls).toHaveLength(1);
    expect(overtimeCalls[0][0].data.postId).toBe('post_01');
  });

  it('checkWorkOvertime: skips when within norm', async () => {
    spies.postFindUnique.mockResolvedValue({
      id: 'post_01',
      name: 'Post 1',
      status: 'active_work',
    });

    const startTime = new Date('2026-04-14T11:00:00Z');
    spies.postStayFindFirst.mockImplementation((args) => {
      if (args?.include?.vehicleSession) {
        return Promise.resolve({
          id: 'ps_1',
          postId: 'post_01',
          startTime,
          endTime: null,
          vehicleSession: {
            workOrderLinks: [
              {
                workOrder: { id: 'wo_1', normHours: 2, status: 'in_progress' },
              },
            ],
          },
        });
      }
      return Promise.resolve(null);
    });

    await checkRecommendations(null, 'post_01');

    const overtimeCalls = spies.recCreate.mock.calls.filter(
      (call) => call[0].data.type === 'work_overtime',
    );
    expect(overtimeCalls).toHaveLength(0);
  });

  // --- checkVehicleIdle ---

  it('checkVehicleIdle: creates recommendation when vehicle without worker > 15 min', async () => {
    spies.postFindUnique.mockResolvedValue({
      id: 'post_01',
      name: 'Post 1',
      status: 'occupied_no_work',
    });

    const startTime = new Date('2026-04-14T11:40:00Z');

    spies.postStayFindFirst.mockImplementation((args) => {
      if (args?.where?.hasWorker === false) {
        return Promise.resolve({
          id: 'ps_idle',
          postId: 'post_01',
          hasWorker: false,
          startTime,
          endTime: null,
        });
      }
      return Promise.resolve(null);
    });

    await checkRecommendations(null, 'post_01');

    const idleCalls = spies.recCreate.mock.calls.filter(
      (call) => call[0].data.type === 'vehicle_idle',
    );
    expect(idleCalls).toHaveLength(1);
    expect(idleCalls[0][0].data.postId).toBe('post_01');
  });

  it('checkVehicleIdle: skips when idle time < 15 min', async () => {
    spies.postFindUnique.mockResolvedValue({
      id: 'post_01',
      name: 'Post 1',
      status: 'occupied_no_work',
    });

    const startTime = new Date('2026-04-14T11:55:00Z');

    spies.postStayFindFirst.mockImplementation((args) => {
      if (args?.where?.hasWorker === false) {
        return Promise.resolve({
          id: 'ps_idle',
          postId: 'post_01',
          hasWorker: false,
          startTime,
          endTime: null,
        });
      }
      return Promise.resolve(null);
    });

    await checkRecommendations(null, 'post_01');

    const idleCalls = spies.recCreate.mock.calls.filter(
      (call) => call[0].data.type === 'vehicle_idle',
    );
    expect(idleCalls).toHaveLength(0);
  });

  // --- checkCapacityAvailable ---

  it('checkCapacityAvailable: creates recommendation when > 50% posts free', async () => {
    spies.zoneFindUnique.mockResolvedValue({
      id: 'zone_01',
      name: 'Repair Zone',
      posts: [
        { id: 'p1', status: 'free', isActive: true },
        { id: 'p2', status: 'free', isActive: true },
        { id: 'p3', status: 'free', isActive: true },
        { id: 'p4', status: 'occupied', isActive: true },
      ],
    });

    await checkRecommendations('zone_01', null);

    const capCalls = spies.recCreate.mock.calls.filter(
      (call) => call[0].data.type === 'capacity_available',
    );
    expect(capCalls).toHaveLength(1);
    expect(capCalls[0][0].data.zoneId).toBe('zone_01');
  });

  it('checkCapacityAvailable: skips when <= 50% posts free', async () => {
    spies.zoneFindUnique.mockResolvedValue({
      id: 'zone_01',
      name: 'Repair Zone',
      posts: [
        { id: 'p1', status: 'free', isActive: true },
        { id: 'p2', status: 'occupied', isActive: true },
        { id: 'p3', status: 'occupied', isActive: true },
        { id: 'p4', status: 'occupied', isActive: true },
      ],
    });

    await checkRecommendations('zone_01', null);

    const capCalls = spies.recCreate.mock.calls.filter(
      (call) => call[0].data.type === 'capacity_available',
    );
    expect(capCalls).toHaveLength(0);
  });

  it('checkCapacityAvailable: skips when zone not found', async () => {
    spies.zoneFindUnique.mockResolvedValue(null);

    await checkRecommendations('zone_missing', null);

    const capCalls = spies.recCreate.mock.calls.filter(
      (call) => call[0].data.type === 'capacity_available',
    );
    expect(capCalls).toHaveLength(0);
  });

  // --- checkNoShow ---

  it('checkNoShow: transitions scheduled WOs past 30 min to no_show', async () => {
    spies.workOrderFindMany.mockResolvedValue([
      {
        id: 'wo_late',
        orderNumber: 'WO-001',
        status: 'scheduled',
        scheduledTime: new Date('2026-04-14T11:00:00Z'),
      },
    ]);
    spies.workOrderUpdate.mockResolvedValue({
      id: 'wo_late',
      status: 'no_show',
    });

    await checkRecommendations(null, null);

    expect(spies.workOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'wo_late' },
      data: { status: 'no_show' },
    });

    const noShowCalls = spies.recCreate.mock.calls.filter(
      (call) => call[0].data.type === 'no_show',
    );
    expect(noShowCalls).toHaveLength(1);
  });

  it('checkNoShow: does not transition WOs within 30 min window', async () => {
    spies.workOrderFindMany.mockResolvedValue([]);

    await checkRecommendations(null, null);

    expect(spies.workOrderUpdate).not.toHaveBeenCalled();
  });

  // --- createRecommendation duplicate prevention ---

  it('createRecommendation: prevents duplicates when active recommendation exists', async () => {
    spies.postFindUnique.mockResolvedValue({
      id: 'post_01',
      name: 'Post 1',
      status: 'free',
    });

    const endTime = new Date('2026-04-14T11:00:00Z');
    spies.postStayFindFirst.mockImplementation((args) => {
      if (args?.where?.hasWorker === false) return Promise.resolve(null);
      if (args?.include?.vehicleSession) return Promise.resolve(null);
      return Promise.resolve({
        id: 'ps_1',
        postId: 'post_01',
        endTime,
      });
    });

    // Active recommendation already exists
    spies.recFindFirst.mockResolvedValue({
      id: 'rec_existing',
      type: 'post_free',
      postId: 'post_01',
      status: 'active',
    });

    await checkRecommendations(null, 'post_01');

    expect(spies.recCreate).not.toHaveBeenCalled();
  });

  // --- Routing: post checks vs zone checks ---

  it('runs post checks when postId is provided', async () => {
    spies.postFindUnique.mockResolvedValue({
      id: 'post_01',
      name: 'Post 1',
      status: 'occupied',
    });

    await checkRecommendations(null, 'post_01');

    expect(spies.postFindUnique).toHaveBeenCalledWith({
      where: { id: 'post_01' },
    });
  });

  it('runs zone checks when zoneId is provided', async () => {
    spies.zoneFindUnique.mockResolvedValue({
      id: 'zone_01',
      name: 'Repair Zone',
      posts: [{ id: 'p1', status: 'occupied', isActive: true }],
    });

    await checkRecommendations('zone_01', null);

    expect(spies.zoneFindUnique).toHaveBeenCalledWith({
      where: { id: 'zone_01' },
      include: { posts: { where: { isActive: true } } },
    });
  });

  it('does not run post checks when postId is null', async () => {
    await checkRecommendations('zone_01', null);

    expect(spies.postFindUnique).not.toHaveBeenCalled();
  });

  it('does not run zone capacity check when zoneId is null', async () => {
    spies.postFindUnique.mockResolvedValue({
      id: 'post_01',
      name: 'Post 1',
      status: 'occupied',
    });

    await checkRecommendations(null, 'post_01');

    expect(spies.zoneFindUnique).not.toHaveBeenCalled();
  });

  // --- Socket.IO and error handling ---
  // Note: getIO is destructured in recommendationEngine.js, so vi.spyOn on
  // the socket module does not intercept the SUT's internal reference.
  // The try/catch in createRecommendation handles Socket.IO errors gracefully.

  it('recommendation creation succeeds even when Socket.IO is not initialized', async () => {
    // getIO() will throw because Socket.IO is not initialized in tests,
    // but the try/catch in createRecommendation handles this gracefully
    spies.postFindUnique.mockResolvedValue({
      id: 'post_01',
      name: 'Post 1',
      status: 'free',
    });

    const endTime = new Date('2026-04-14T11:00:00Z');
    spies.postStayFindFirst.mockImplementation((args) => {
      if (args?.where?.hasWorker === false) return Promise.resolve(null);
      if (args?.include?.vehicleSession) return Promise.resolve(null);
      return Promise.resolve({
        id: 'ps_1',
        postId: 'post_01',
        endTime,
      });
    });

    // Should complete without throwing despite Socket.IO not being available
    await expect(checkRecommendations(null, 'post_01')).resolves.not.toThrow();

    // Recommendation was still created in the database
    expect(spies.recCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'post_free',
        postId: 'post_01',
      }),
    });
  });
});
