import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Тесты helper-функций backupScheduler.js. Не импортируем сервис, чтобы не
// зацепить cron / prisma — реплицируем pure helpers.

function fmtTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function pruneDir(dir, keep) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.db'));
  } catch {
    return 0;
  }
  files.sort();
  const toDelete = files.length > keep ? files.slice(0, files.length - keep) : [];
  for (const f of toDelete) {
    try {
      fs.unlinkSync(path.join(dir, f));
    } catch {
      /* ignore */
    }
  }
  return toDelete.length;
}

describe('backupScheduler - fmtTimestamp', () => {
  it('formats date as YYYYMMDD-HHMMSS', () => {
    // Сравниваем формат строго: 8 цифр, дефис, 6 цифр.
    const ts = fmtTimestamp(new Date(2026, 4, 1, 9, 5, 7)); // May 1 2026 09:05:07 local
    expect(ts).toBe('20260501-090507');
  });

  it('zero-pads single-digit fields', () => {
    const ts = fmtTimestamp(new Date(2026, 0, 2, 3, 4, 5));
    expect(ts).toBe('20260102-030405');
  });

  it('handles end of month and year boundaries', () => {
    const ts = fmtTimestamp(new Date(2026, 11, 31, 23, 59, 59)); // Dec 31
    expect(ts).toBe('20261231-235959');
  });

  it('produces lexicographically sortable strings', () => {
    const a = fmtTimestamp(new Date(2026, 0, 1, 0, 0, 0));
    const b = fmtTimestamp(new Date(2026, 0, 1, 0, 0, 1));
    const c = fmtTimestamp(new Date(2026, 0, 2, 0, 0, 0));
    expect([c, a, b].sort()).toEqual([a, b, c]);
  });
});

describe('backupScheduler - pruneDir', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-prune-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function touch(name) {
    fs.writeFileSync(path.join(tmpDir, name), 'x');
  }

  it('keeps last N files (lex-sorted)', () => {
    touch('dev-20260101-000000.db');
    touch('dev-20260102-000000.db');
    touch('dev-20260103-000000.db');
    touch('dev-20260104-000000.db');
    const deleted = pruneDir(tmpDir, 2);
    expect(deleted).toBe(2);
    const remaining = fs.readdirSync(tmpDir).sort();
    expect(remaining).toEqual(['dev-20260103-000000.db', 'dev-20260104-000000.db']);
  });

  it('returns 0 when count <= keep', () => {
    touch('dev-1.db');
    touch('dev-2.db');
    expect(pruneDir(tmpDir, 5)).toBe(0);
    expect(fs.readdirSync(tmpDir)).toHaveLength(2);
  });

  it('ignores non-.db files', () => {
    touch('dev-1.db');
    touch('dev-2.db');
    touch('readme.txt');
    touch('other.json');
    const deleted = pruneDir(tmpDir, 1);
    expect(deleted).toBe(1);
    // .txt и .json должны остаться.
    expect(fs.existsSync(path.join(tmpDir, 'readme.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'other.json'))).toBe(true);
  });

  it('returns 0 if directory does not exist', () => {
    expect(pruneDir(path.join(tmpDir, 'missing'), 5)).toBe(0);
  });

  it('keep=0 means remove all .db files', () => {
    touch('a.db');
    touch('b.db');
    expect(pruneDir(tmpDir, 0)).toBe(2);
    expect(fs.readdirSync(tmpDir).filter(f => f.endsWith('.db'))).toEqual([]);
  });
});

describe('backupScheduler - schedule trigger flags', () => {
  // Реплика логики копирования в weekly/monthly:
  function shouldCopyWeekly(d) { return d.getDay() === 0; }
  function shouldCopyMonthly(d) { return d.getDate() === 1; }

  it('weekly trigger only on Sunday', () => {
    expect(shouldCopyWeekly(new Date(2026, 4, 3))).toBe(true);   // Sun May 3 2026
    expect(shouldCopyWeekly(new Date(2026, 4, 4))).toBe(false);  // Mon
    expect(shouldCopyWeekly(new Date(2026, 4, 9))).toBe(false);  // Sat
  });

  it('monthly trigger only on first of month', () => {
    expect(shouldCopyMonthly(new Date(2026, 4, 1))).toBe(true);
    expect(shouldCopyMonthly(new Date(2026, 4, 2))).toBe(false);
    expect(shouldCopyMonthly(new Date(2026, 4, 31))).toBe(false);
  });
});
