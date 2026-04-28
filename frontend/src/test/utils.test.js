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

  it('uses post.displayName when given an object (RU)', () => {
    const post = { name: 'Пост 1', displayName: 'Кузовной пост', displayNameEn: 'Body Post' };
    expect(translatePost(post, true)).toBe('Кузовной пост');
  });

  it('uses post.displayNameEn when given an object (EN)', () => {
    const post = { name: 'Пост 1', displayName: 'Кузовной пост', displayNameEn: 'Body Post' };
    expect(translatePost(post, false)).toBe('Body Post');
  });

  it('falls back to displayName when displayNameEn is missing (EN)', () => {
    const post = { name: 'Пост 5', displayName: 'Развал-схождение' };
    // RU-only displayName: тогда EN получает displayName, далее POST_NAMES не сработает,
    // и replace('Пост','Post') не применится (нет слова "Пост"). Возвращается RU как есть.
    expect(translatePost(post, false)).toBe('Развал-схождение');
  });

  it('falls back to name when displayName is empty', () => {
    const post = { name: 'Пост 2' };
    expect(translatePost(post, true)).toBe('Пост 2');
    expect(translatePost(post, false)).toBe('Post 2');
  });

  it('returns undefined for empty object input', () => {
    expect(translatePost({}, true)).toBeUndefined();
    expect(translatePost({}, false)).toBeUndefined();
  });

  it('legacy string API still works after object support added', () => {
    expect(translatePost('Пост 3', true)).toBe('Пост 3');
    expect(translatePost('Пост 3', false)).toBe('Post 3');
  });
});
