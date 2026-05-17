import { describe, it, expect } from 'vitest';
import { translateZone, translatePost, translateWorksDesc } from '../translate.js';

describe('translateZone', () => {
  it('returns RU name as-is when isRu=true', () => {
    expect(translateZone('Зона 01', true)).toBe('Зона 01');
  });

  it('replaces "Зона" → "Zone" when isRu=false', () => {
    expect(translateZone('Зона 01', false)).toBe('Zone 01');
    expect(translateZone('Зона 10', false)).toBe('Zone 10');
  });

  it('handles falsy input', () => {
    expect(translateZone(null, false)).toBeNull();
    expect(translateZone('', false)).toBe('');
  });
});

describe('translatePost', () => {
  it('returns RU name when isRu=true', () => {
    expect(translatePost('Пост 5', true)).toBe('Пост 5');
  });

  it('maps known RU post names to EN', () => {
    expect(translatePost('Пост 1', false)).toBe('Post 1');
    expect(translatePost('Пост 10', false)).toBe('Post 10');
  });

  it('replaces "Пост" → "Post" for unknown', () => {
    expect(translatePost('Пост alpha', false)).toBe('Post alpha');
  });

  it('accepts object {name, displayName, displayNameEn}', () => {
    const post = { name: 'Пост 5', displayName: 'Heavy', displayNameEn: 'Heavy EN' };
    expect(translatePost(post, true)).toBe('Heavy');
    expect(translatePost(post, false)).toBe('Heavy EN');
  });

  it('falls back to displayName when displayNameEn missing', () => {
    const post = { name: 'Пост 6', displayName: 'Light' };
    expect(translatePost(post, false)).toBe('Light');
  });
});

describe('translateWorksDesc', () => {
  it('returns text as-is when not RU', () => {
    expect(translateWorksDesc('Engine work', false)).toBe('Engine work');
  });

  it('returns text as-is when already starts with Cyrillic', () => {
    expect(translateWorksDesc('Работы ведутся', true)).toBe('Работы ведутся');
  });

  it('returns falsy input unchanged', () => {
    expect(translateWorksDesc('', true)).toBe('');
    expect(translateWorksDesc(null, true)).toBeNull();
  });

  it('translates phrase patterns first (priority)', () => {
    const out = translateWorksDesc('Engine compartment is open', true);
    // "engine compartment" → "моторный отсек"
    expect(out).toMatch(/моторный отсек/i);
  });

  it('translates individual words when no phrase matches', () => {
    const out = translateWorksDesc('Brakes maintenance', true);
    expect(out).toMatch(/тормоза/i);
    expect(out).toMatch(/ТО/);
  });

  it('capitalizes first letter of the result', () => {
    const out = translateWorksDesc('engine inspection', true);
    expect(out.charAt(0)).toBe(out.charAt(0).toUpperCase());
  });

  it('collapses multiple spaces from empty-replacements', () => {
    const out = translateWorksDesc('the engine is running', true);
    expect(out).not.toMatch(/\s{2,}/);
  });
});
