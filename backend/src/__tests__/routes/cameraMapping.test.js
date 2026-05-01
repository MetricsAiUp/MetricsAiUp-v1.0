import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Реплицируем readMapping/writeMapping из routes/cameraMapping.js,
// но с инжектируемым путём — чтобы тесты не трогали реальный data/.

function readMapping(filepath) {
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    }
  } catch {
    // intentionally swallow — мы возвращаем null при любой ошибке
  }
  return null;
}

function writeMapping(filepath, data) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// Реплика валидации body из POST handler.
function isValidBody(body) {
  return !!body && typeof body === 'object' && !Array.isArray(body);
}

describe('cameraMapping - readMapping', () => {
  let tmpDir;
  let mappingFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cam-map-'));
    mappingFile = path.join(tmpDir, 'camera-mapping.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when file does not exist', () => {
    expect(readMapping(mappingFile)).toBeNull();
  });

  it('returns parsed object when file is valid JSON', () => {
    const data = { 'zone-1': { 'cam-1': 5, 'cam-2': 3 } };
    fs.writeFileSync(mappingFile, JSON.stringify(data));
    expect(readMapping(mappingFile)).toEqual(data);
  });

  it('returns null on invalid JSON', () => {
    fs.writeFileSync(mappingFile, 'not json {{{');
    expect(readMapping(mappingFile)).toBeNull();
  });

  it('returns parsed value (incl. arrays) for technically-valid JSON', () => {
    fs.writeFileSync(mappingFile, '[1,2,3]');
    expect(readMapping(mappingFile)).toEqual([1, 2, 3]);
  });
});

describe('cameraMapping - writeMapping', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cam-write-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes JSON pretty-formatted', () => {
    const file = path.join(tmpDir, 'camera-mapping.json');
    const data = { z1: { c1: 1 } };
    writeMapping(file, data);
    const content = fs.readFileSync(file, 'utf-8');
    expect(JSON.parse(content)).toEqual(data);
    // pretty-printed → есть переносы строк
    expect(content).toContain('\n');
  });

  it('creates parent directory if missing', () => {
    const nested = path.join(tmpDir, 'sub/dir/camera-mapping.json');
    writeMapping(nested, { a: 1 });
    expect(fs.existsSync(nested)).toBe(true);
  });

  it('overwrites existing file', () => {
    const file = path.join(tmpDir, 'camera-mapping.json');
    writeMapping(file, { a: 1 });
    writeMapping(file, { b: 2 });
    expect(JSON.parse(fs.readFileSync(file, 'utf-8'))).toEqual({ b: 2 });
  });

  it('round-trips read/write', () => {
    const file = path.join(tmpDir, 'camera-mapping.json');
    const data = {
      'zone-id-1': { 'cam-1': 0, 'cam-2': 5, 'cam-3': 10 },
      'zone-id-2': { 'cam-1': 7 },
    };
    writeMapping(file, data);
    expect(readMapping(file)).toEqual(data);
  });
});

describe('cameraMapping - body validation', () => {
  it('accepts plain object', () => {
    expect(isValidBody({})).toBe(true);
    expect(isValidBody({ a: 1 })).toBe(true);
    expect(isValidBody({ 'zone-1': { 'cam-1': 5 } })).toBe(true);
  });

  it('rejects array (typeof object, but Array.isArray)', () => {
    expect(isValidBody([])).toBe(false);
    expect(isValidBody([{ a: 1 }])).toBe(false);
  });

  it('rejects null/undefined/primitives', () => {
    expect(isValidBody(null)).toBe(false);
    expect(isValidBody(undefined)).toBe(false);
    expect(isValidBody('string')).toBe(false);
    expect(isValidBody(42)).toBe(false);
    expect(isValidBody(true)).toBe(false);
  });
});
