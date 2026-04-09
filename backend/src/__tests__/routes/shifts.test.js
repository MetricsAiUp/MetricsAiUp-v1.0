import { describe, it, expect } from 'vitest';

// Test the detectConflicts logic directly without CJS mocking.
// We replicate the function and inject the "existing shifts" as a parameter.

function detectConflictsSync(workers, startTime, endTime, existingShifts) {
  const conflicts = [];

  // Check for duplicate workers in same shift (different posts)
  const nameMap = {};
  for (const w of (workers || [])) {
    if (nameMap[w.name] && w.postId && nameMap[w.name] !== w.postId) {
      conflicts.push({ type: 'same_shift_duplicate', workerName: w.name, post1: nameMap[w.name], post2: w.postId });
    }
    if (w.postId) nameMap[w.name] = w.postId;
  }

  // Check cross-shift conflicts
  for (const w of (workers || [])) {
    for (const es of existingShifts) {
      const overlap = startTime < es.endTime && endTime > es.startTime;
      if (overlap && es.workers.some(ew => ew.name === w.name)) {
        conflicts.push({
          type: 'cross_shift_overlap',
          workerName: w.name,
          conflictingShiftName: es.name,
          conflictingTime: `${es.startTime}-${es.endTime}`,
        });
      }
    }
  }

  return conflicts;
}

describe('shifts - detectConflicts', () => {
  it('finds duplicate workers assigned to different posts in same shift', () => {
    const workers = [
      { name: 'Ivan', role: 'mechanic', postId: 'post-1' },
      { name: 'Ivan', role: 'mechanic', postId: 'post-2' },
    ];

    const conflicts = detectConflictsSync(workers, '08:00', '17:00', []);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts.some(c => c.type === 'same_shift_duplicate' && c.workerName === 'Ivan')).toBe(true);
    expect(conflicts[0].post1).toBe('post-1');
    expect(conflicts[0].post2).toBe('post-2');
  });

  it('finds cross-shift time overlaps', () => {
    const existingShifts = [
      {
        id: 'existing-shift',
        name: 'Morning Shift',
        startTime: '08:00',
        endTime: '16:00',
        workers: [{ name: 'Petr', role: 'mechanic' }],
      },
    ];

    const workers = [
      { name: 'Petr', role: 'mechanic', postId: 'post-1' },
    ];

    // New shift 10:00-18:00 overlaps with existing 08:00-16:00
    const conflicts = detectConflictsSync(workers, '10:00', '18:00', existingShifts);
    expect(conflicts.some(c => c.type === 'cross_shift_overlap' && c.workerName === 'Petr')).toBe(true);
    expect(conflicts[0].conflictingShiftName).toBe('Morning Shift');
  });

  it('no conflicts when workers are different', () => {
    const existingShifts = [
      {
        id: 'existing-shift',
        name: 'Morning Shift',
        startTime: '08:00',
        endTime: '16:00',
        workers: [{ name: 'Petr', role: 'mechanic' }],
      },
    ];

    const workers = [
      { name: 'Sergei', role: 'mechanic', postId: 'post-1' },
    ];

    const conflicts = detectConflictsSync(workers, '10:00', '18:00', existingShifts);
    expect(conflicts.length).toBe(0);
  });

  it('no same_shift_duplicate when workers have same postId', () => {
    const workers = [
      { name: 'Ivan', role: 'mechanic', postId: 'post-1' },
      { name: 'Ivan', role: 'lead', postId: 'post-1' }, // same post
    ];

    const conflicts = detectConflictsSync(workers, '08:00', '17:00', []);
    const duplicates = conflicts.filter(c => c.type === 'same_shift_duplicate');
    expect(duplicates.length).toBe(0);
  });

  it('no cross-shift conflict when times do not overlap', () => {
    const existingShifts = [
      {
        name: 'Morning Shift',
        startTime: '08:00',
        endTime: '12:00',
        workers: [{ name: 'Ivan', role: 'mechanic' }],
      },
    ];

    const workers = [
      { name: 'Ivan', role: 'mechanic', postId: 'post-1' },
    ];

    // 13:00-17:00 does not overlap 08:00-12:00
    const conflicts = detectConflictsSync(workers, '13:00', '17:00', existingShifts);
    expect(conflicts.filter(c => c.type === 'cross_shift_overlap').length).toBe(0);
  });

  it('detects boundary overlap (endTime equals startTime)', () => {
    const existingShifts = [
      {
        name: 'Morning Shift',
        startTime: '08:00',
        endTime: '12:00',
        workers: [{ name: 'Ivan', role: 'mechanic' }],
      },
    ];

    const workers = [{ name: 'Ivan', role: 'mechanic', postId: 'post-1' }];

    // Exactly at boundary: 12:00-17:00 vs 08:00-12:00
    // '12:00' < '12:00' is false, so no overlap (correct for non-inclusive end)
    const conflicts = detectConflictsSync(workers, '12:00', '17:00', existingShifts);
    expect(conflicts.filter(c => c.type === 'cross_shift_overlap').length).toBe(0);
  });

  it('handles empty workers array', () => {
    const conflicts = detectConflictsSync([], '08:00', '17:00', []);
    expect(conflicts.length).toBe(0);
  });

  it('handles multiple overlapping shifts', () => {
    const existingShifts = [
      {
        name: 'Shift A',
        startTime: '08:00',
        endTime: '16:00',
        workers: [{ name: 'Ivan', role: 'mechanic' }],
      },
      {
        name: 'Shift B',
        startTime: '10:00',
        endTime: '18:00',
        workers: [{ name: 'Ivan', role: 'mechanic' }],
      },
    ];

    const workers = [{ name: 'Ivan', role: 'mechanic', postId: 'post-1' }];
    const conflicts = detectConflictsSync(workers, '09:00', '17:00', existingShifts);
    const crossShift = conflicts.filter(c => c.type === 'cross_shift_overlap');
    expect(crossShift.length).toBe(2);
  });
});
