import { describe, it, expect } from 'vitest';
import { translateZone, translatePost } from '../utils/translate';

describe('translateZone', () => {
  it('returns Russian zone names when isRu=true', () => {
    expect(translateZone('Ремонтная зона (посты 5-9)', true)).toBe('Ремонтная зона (посты 5-9)');
  });

  it('translates zone names to English when isRu=false', () => {
    expect(translateZone('Ремонтная зона (посты 5-9)', false)).toContain('Repair');
  });

  it('returns original name for unknown zones', () => {
    expect(translateZone('Unknown Zone', false)).toBe('Unknown Zone');
  });
});

describe('translatePost', () => {
  it('returns Russian post names when isRu=true', () => {
    expect(translatePost('Пост 1', true)).toBe('Пост 1');
  });

  it('translates post names to English', () => {
    expect(translatePost('Пост 1', false)).toBe('Post 1');
  });

  it('handles post with number', () => {
    expect(translatePost('Пост 10', false)).toBe('Post 10');
  });
});
