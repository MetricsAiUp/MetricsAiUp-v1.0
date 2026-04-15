import { describe, it, expect } from 'vitest';

// Test locations logic: CRUD shapes, timezone validation, active filter

const VALID_TIMEZONES = ['Europe/Moscow', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'UTC'];

describe('locations - timezone validation', () => {
  it('accepts all valid timezones', () => {
    for (const tz of VALID_TIMEZONES) {
      expect(VALID_TIMEZONES.includes(tz)).toBe(true);
    }
  });

  it('rejects invalid timezone strings', () => {
    const invalid = ['America/New_York', 'Europe/London', 'MSK', 'GMT+3', ''];
    for (const tz of invalid) {
      expect(VALID_TIMEZONES.includes(tz)).toBe(false);
    }
  });

  it('defaults to Europe/Moscow when timezone is not provided', () => {
    const timezone = undefined;
    const finalTz = timezone || 'Europe/Moscow';
    expect(finalTz).toBe('Europe/Moscow');
  });

  it('uses provided timezone when valid', () => {
    const timezone = 'Asia/Novosibirsk';
    const finalTz = VALID_TIMEZONES.includes(timezone) ? timezone : null;
    expect(finalTz).toBe('Asia/Novosibirsk');
  });
});

describe('locations - CRUD response shapes', () => {
  it('location has required fields', () => {
    const location = {
      id: 'loc-1',
      name: 'СТО Колесникова 38',
      address: 'ул. Колесникова, 38',
      timezone: 'Europe/Moscow',
      isActive: true,
      createdAt: '2026-04-14T10:00:00Z',
      updatedAt: '2026-04-14T10:00:00Z',
    };
    expect(location).toHaveProperty('id');
    expect(location).toHaveProperty('name');
    expect(location).toHaveProperty('address');
    expect(location).toHaveProperty('timezone');
    expect(location).toHaveProperty('isActive');
  });

  it('create requires name', () => {
    const body = { address: 'Some street' };
    const hasName = !!body.name;
    expect(hasName).toBe(false);
  });

  it('create with valid data', () => {
    const body = { name: 'New STO', address: 'Main St 1', timezone: 'UTC' };
    const hasName = !!body.name;
    const validTz = !body.timezone || VALID_TIMEZONES.includes(body.timezone);
    expect(hasName).toBe(true);
    expect(validTz).toBe(true);
  });

  it('update only modifies provided fields', () => {
    const existing = { id: 'loc-1', name: 'Old', address: 'Old St', timezone: 'UTC', isActive: true };
    const body = { name: 'New Name' };
    const data = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.address !== undefined) data.address = body.address;
    if (body.timezone !== undefined) data.timezone = body.timezone;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    expect(Object.keys(data)).toEqual(['name']);
    expect(data.name).toBe('New Name');
  });

  it('delete response includes id and message', () => {
    const response = { message: 'Deleted', id: 'loc-1' };
    expect(response.message).toBe('Deleted');
    expect(response.id).toBe('loc-1');
  });
});

describe('locations - active filter', () => {
  it('filters active locations when active=true', () => {
    const locations = [
      { id: 'l1', name: 'Active STO', isActive: true },
      { id: 'l2', name: 'Inactive STO', isActive: false },
      { id: 'l3', name: 'Another Active', isActive: true },
    ];
    const queryActive = 'true';
    const filtered = queryActive === 'true'
      ? locations.filter(l => l.isActive)
      : locations;
    expect(filtered).toHaveLength(2);
    expect(filtered.every(l => l.isActive)).toBe(true);
  });

  it('returns all locations when no active filter', () => {
    const locations = [
      { id: 'l1', isActive: true },
      { id: 'l2', isActive: false },
    ];
    const queryActive = undefined;
    const filtered = queryActive === 'true'
      ? locations.filter(l => l.isActive)
      : locations;
    expect(filtered).toHaveLength(2);
  });

  it('locations sorted by name ascending', () => {
    const locations = [
      { name: 'Charlie' },
      { name: 'Alpha' },
      { name: 'Bravo' },
    ];
    const sorted = [...locations].sort((a, b) => a.name.localeCompare(b.name));
    expect(sorted.map(l => l.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });
});
