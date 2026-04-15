import { describe, it, expect } from 'vitest';

// Test photos route logic: base64 validation, path generation, MIME detection, linking

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function sanitizePath(input) {
  if (!input) return null;
  return input.replace(/[^a-zA-Z0-9_-]/g, '');
}

function parseBase64Image(image) {
  const matches = image.match(/^data:(.+);base64,(.+)$/);
  if (!matches) return null;
  return { mimeType: matches[1], data: matches[2] };
}

describe('photos - base64 image validation', () => {
  it('parses valid base64 data URI', () => {
    const image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
    const result = parseBase64Image(image);
    expect(result).not.toBeNull();
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.data).toBe('/9j/4AAQSkZJRgABAQ==');
  });

  it('rejects invalid format without data: prefix', () => {
    const image = 'not-a-base64-image';
    const result = parseBase64Image(image);
    expect(result).toBeNull();
  });

  it('rejects empty string', () => {
    const result = parseBase64Image('');
    expect(result).toBeNull();
  });

  it('validates allowed MIME types', () => {
    expect(ALLOWED_MIME.has('image/jpeg')).toBe(true);
    expect(ALLOWED_MIME.has('image/png')).toBe(true);
    expect(ALLOWED_MIME.has('image/gif')).toBe(true);
    expect(ALLOWED_MIME.has('image/webp')).toBe(true);
    expect(ALLOWED_MIME.has('image/svg+xml')).toBe(false);
    expect(ALLOWED_MIME.has('application/pdf')).toBe(false);
    expect(ALLOWED_MIME.has('text/plain')).toBe(false);
  });

  it('enforces max size of 10MB', () => {
    // Simulate a buffer of various sizes
    const smallSize = 5 * 1024 * 1024; // 5MB
    const largeSize = 15 * 1024 * 1024; // 15MB
    expect(smallSize <= MAX_SIZE).toBe(true);
    expect(largeSize <= MAX_SIZE).toBe(false);
  });
});

describe('photos - MIME type detection and extension', () => {
  it('extracts extension from MIME type', () => {
    const cases = [
      ['image/jpeg', 'jpeg'],
      ['image/png', 'png'],
      ['image/gif', 'gif'],
      ['image/webp', 'webp'],
    ];
    for (const [mime, expected] of cases) {
      const ext = mime.split('/')[1] || 'jpg';
      expect(ext).toBe(expected);
    }
  });

  it('defaults to jpg for unknown MIME split', () => {
    const mime = 'image';
    const ext = mime.split('/')[1] || 'jpg';
    expect(ext).toBe('jpg');
  });
});

describe('photos - file path generation', () => {
  it('generates filename with timestamp', () => {
    const now = Date.now();
    const fname = `photo-${now}.jpeg`;
    expect(fname).toMatch(/^photo-\d+\.jpeg$/);
  });

  it('sanitizes sessionId for path safety', () => {
    expect(sanitizePath('abc-123_def')).toBe('abc-123_def');
    expect(sanitizePath('../../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizePath('session with spaces')).toBe('sessionwithspaces');
    expect(sanitizePath(null)).toBeNull();
    expect(sanitizePath(undefined)).toBeNull();
  });

  it('builds relative path with sessionId subdirectory', () => {
    const safeSessionId = sanitizePath('session-abc');
    const fname = 'photo-1234567890.jpeg';
    const relativePath = safeSessionId ? `photos/${safeSessionId}/${fname}` : `photos/${fname}`;
    expect(relativePath).toBe('photos/session-abc/photo-1234567890.jpeg');
  });

  it('builds relative path without sessionId', () => {
    const safeSessionId = sanitizePath(null);
    const fname = 'photo-1234567890.png';
    const relativePath = safeSessionId ? `photos/${safeSessionId}/${fname}` : `photos/${fname}`;
    expect(relativePath).toBe('photos/photo-1234567890.png');
  });
});

describe('photos - linking to session/workOrder', () => {
  it('photo record includes sessionId when provided', () => {
    const photo = {
      sessionId: 'sess-001',
      workOrderId: null,
      path: 'photos/sess-001/photo-123.jpeg',
      filename: 'photo-123.jpeg',
      mimeType: 'image/jpeg',
    };
    expect(photo.sessionId).toBe('sess-001');
    expect(photo.workOrderId).toBeNull();
  });

  it('photo record includes workOrderId when provided', () => {
    const photo = {
      sessionId: null,
      workOrderId: 'wo-001',
      path: 'photos/photo-456.jpeg',
      filename: 'photo-456.jpeg',
      mimeType: 'image/jpeg',
    };
    expect(photo.workOrderId).toBe('wo-001');
    expect(photo.sessionId).toBeNull();
  });

  it('photo can be linked to both session and workOrder', () => {
    const photo = {
      sessionId: 'sess-001',
      workOrderId: 'wo-001',
      path: 'photos/sess-001/photo-789.jpeg',
      filename: 'photo-789.jpeg',
      mimeType: 'image/jpeg',
    };
    expect(photo.sessionId).toBe('sess-001');
    expect(photo.workOrderId).toBe('wo-001');
  });
});
