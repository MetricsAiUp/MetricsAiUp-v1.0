import { describe, it, expect } from 'vitest';
import ru from '../i18n/ru.json';
import en from '../i18n/en.json';

function getKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      keys.push(...getKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

describe('i18n translations', () => {
  const ruKeys = getKeys(ru);
  const enKeys = getKeys(en);

  it('ru.json and en.json have the same number of keys', () => {
    expect(ruKeys.length).toBe(enKeys.length);
  });

  it('every ru key exists in en', () => {
    const enSet = new Set(enKeys);
    const missing = ruKeys.filter(k => !enSet.has(k));
    expect(missing).toEqual([]);
  });

  it('every en key exists in ru', () => {
    const ruSet = new Set(ruKeys);
    const missing = enKeys.filter(k => !ruSet.has(k));
    expect(missing).toEqual([]);
  });

  it('no empty string values in ru', () => {
    const empty = ruKeys.filter(k => {
      const parts = k.split('.');
      let val = ru;
      for (const p of parts) val = val[p];
      return val === '';
    });
    expect(empty).toEqual([]);
  });

  it('no empty string values in en', () => {
    const empty = enKeys.filter(k => {
      const parts = k.split('.');
      let val = en;
      for (const p of parts) val = val[p];
      return val === '';
    });
    expect(empty).toEqual([]);
  });

  it('has at least 240 translation keys', () => {
    expect(ruKeys.length).toBeGreaterThanOrEqual(240);
  });
});
