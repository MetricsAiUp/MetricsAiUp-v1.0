import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx';

const oneCParser = require('../../services/oneCParser');

// Helper to build an in-memory workbook from rows
function buildWorkbook(headerRow, dataRows = [], sheetName = 'TDSheet') {
  const aoa = [headerRow, ...dataRows];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  return wb;
}

describe('oneCParser — _parseDate', () => {
  const parseDate = oneCParser._parseDate;
  it('returns null for empty/null', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate('   ')).toBeNull();
  });
  it('passes through Date instance', () => {
    const d = new Date('2026-04-14T10:00:00Z');
    expect(parseDate(d)).toBe(d);
  });
  it('rejects invalid Date', () => {
    expect(parseDate(new Date('garbage'))).toBeNull();
  });
  it('parses DD.MM.YYYY HH:mm:ss', () => {
    const d = parseDate('14.04.2026 10:30:45');
    expect(d).toBeInstanceOf(Date);
    expect(d.toISOString()).toBe('2026-04-14T10:30:45.000Z');
  });
  it('parses DD.MM.YYYY HH:mm', () => {
    const d = parseDate('14.04.2026 10:30');
    expect(d.toISOString()).toBe('2026-04-14T10:30:00.000Z');
  });
  it('parses DD.MM.YYYY (date only)', () => {
    const d = parseDate('14.04.2026');
    expect(d.toISOString()).toBe('2026-04-14T00:00:00.000Z');
  });
  it('parses ISO string', () => {
    const d = parseDate('2026-04-14T10:00:00Z');
    expect(d.toISOString()).toBe('2026-04-14T10:00:00.000Z');
  });
  it('returns null for unparseable string', () => {
    expect(parseDate('not a date')).toBeNull();
  });
});

describe('oneCParser — _parseInt', () => {
  const pi = oneCParser._parseInt;
  it('handles null/empty/numbers/strings', () => {
    expect(pi(null)).toBeNull();
    expect(pi('')).toBeNull();
    expect(pi(42)).toBe(42);
    expect(pi(42.7)).toBe(42);
    expect(pi('123')).toBe(123);
  });
  it('treats en-US thousands separator correctly (43,200 → 43200)', () => {
    expect(pi('43,200')).toBe(43200);
    expect(pi('1,234,567')).toBe(1234567);
  });
  it('treats single comma as ru decimal (12,5 → 12)', () => {
    expect(pi('12,5')).toBe(12);
  });
  it('returns null for garbage', () => {
    expect(pi('abc')).toBeNull();
  });
});

describe('oneCParser — _parseFloat', () => {
  const pf = oneCParser._parseFloat;
  it('handles numbers and pass-throughs', () => {
    expect(pf(0.5)).toBe(0.5);
  });
  it('parses ru decimal (12,5 → 12.5)', () => {
    expect(pf('12,5')).toBe(12.5);
  });
  it('parses en-US thousands (43,200 → 43200)', () => {
    expect(pf('43,200')).toBe(43200);
  });
  it('parses en-US thousands+decimal (1,234.5)', () => {
    expect(pf('1,234.5')).toBe(1234.5);
  });
  it('returns null for empty or garbage', () => {
    expect(pf('')).toBeNull();
    expect(pf('abc')).toBeNull();
  });
});

describe('oneCParser — detectType()', () => {
  it('detects plan signature', () => {
    const wb = buildWorkbook(['Документ', 'Орг.', 'Авто', 'Номер', 'Гос.номер', 'VIN', 'Дата нач.', 'Дата кон.', 'Рабочее место', 'Продолжительность', 'Не актуален']);
    expect(oneCParser.detectType(wb)).toBe('plan');
  });
  it('detects repair signature', () => {
    const wb = buildWorkbook(['Авто', 'VIN', 'Состояние', 'Основание', 'Дата окончания гарантийного срока']);
    expect(oneCParser.detectType(wb)).toBe('repair');
  });
  it('detects performed signature', () => {
    const wb = buildWorkbook(['Авто', 'VIN', 'Сотрудник', 'Итого', 'Дата закрытия']);
    expect(oneCParser.detectType(wb)).toBe('performed');
  });
  it('returns unknown when no signature matches', () => {
    const wb = buildWorkbook(['a', 'b', 'c']);
    expect(oneCParser.detectType(wb)).toBe('unknown');
  });
  it('returns unknown when multiple match (ambiguous)', () => {
    // Headers that include both plan and repair signatures
    const wb = buildWorkbook(['Документ', 'Рабочее место', 'Не актуален', 'Продолжительность', 'Состояние', 'Основание', 'Дата окончания гарантийного срока']);
    expect(oneCParser.detectType(wb)).toBe('unknown');
  });
});

describe('oneCParser — parsePlan', () => {
  const HEADER = ['Документ', 'Организация', 'Автомобиль', 'Номер', 'Гос.номер', 'VIN', 'Дата нач.', 'Дата кон.', 'Рабочее место', 'Продолжительность', 'Не актуален'];

  it('parses a valid row and strips (проведен) from documentText', () => {
    const wb = buildWorkbook(HEADER, [[
      'План ремонта № 100 (проведен)', 'ООО Тест', 'Toyota Camry', 'P-100', 'A100AA', 'V100', '14.04.2026 08:00:00', '14.04.2026 10:00:00', 'Пост 1', '7200', 'Нет',
    ]]);
    const out = oneCParser.parsePlan(wb, new Date('2026-04-14T07:00:00Z'));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      documentText: 'План ремонта № 100',
      documentType: 'План ремонта',
      organization: 'ООО Тест',
      vehicleText: 'Toyota Camry',
      number: 'P-100',
      plateNumber: 'A100AA',
      vin: 'V100',
      postRawName: 'Пост 1',
      durationSec: 7200,
      isOutdated: false,
    });
    expect(out[0].scheduledStart.toISOString()).toBe('2026-04-14T08:00:00.000Z');
    expect(out[0].scheduledEnd.toISOString()).toBe('2026-04-14T10:00:00.000Z');
  });
  it('skips rows missing required fields', () => {
    const wb = buildWorkbook(HEADER, [
      ['', '', '', '', '', '', '', '', '', '', ''], // empty
      ['План № 1', '', '', null, '', '', '14.04.2026', '14.04.2026', null, '', ''], // no number/post
    ]);
    expect(oneCParser.parsePlan(wb, new Date())).toEqual([]);
  });
  it('detects documentType "Заказ-наряд"', () => {
    const wb = buildWorkbook(HEADER, [[
      'Заказ-наряд № КОЛ-100', 'org', 'Toyota', 'WO-1', 'A100', 'V', '14.04.2026', '14.04.2026', 'Пост 1', '0', '',
    ]]);
    const out = oneCParser.parsePlan(wb, new Date());
    expect(out[0].documentType).toBe('Заказ-наряд');
  });
});

describe('oneCParser — parseRepair', () => {
  const HEADER = [
    'Авто', 'VIN', 'Марка', 'Модель', 'Гос.номер1', 'Гос.номер2',
    'Гарантия до', 'Год', 'Заказ-наряд', 'Номер', 'Дата', 'Состояние',
    'Вид ремонта', 'Пробег', 'Факт начало', 'Факт окончание', 'Дата закрытия',
    'Основание', 'Основание начало', 'Основание конец', 'Мастер', 'Диспетчер',
  ];
  it('parses valid row and strips (проведен) from basis', () => {
    const wb = buildWorkbook(HEADER, [[
      'Toyota Camry', 'V100', 'Toyota', 'Camry', 'A100AA', null,
      null, '2020', 'Заказ № КОЛ-1', 'КОЛ-1', '14.04.2026', 'Закрыт',
      'TO', null, '14.04.2026 08:00:00', '14.04.2026 12:00:00', '14.04.2026 12:30:00',
      'План № 100 (записан)', '14.04.2026 08:00:00', '14.04.2026 10:00:00', 'Иван', 'Петр',
    ]]);
    const out = oneCParser.parseRepair(wb, new Date());
    expect(out).toHaveLength(1);
    expect(out[0].orderNumber).toBe('КОЛ-1');
    expect(out[0].state).toBe('Закрыт');
    expect(out[0].basis).toBe('План № 100');
    expect(out[0].yearMade).toBe(2020);
    expect(out[0].master).toBe('Иван');
  });
  it('skips rows missing required orderNumber/orderDate/state', () => {
    const wb = buildWorkbook(HEADER, [[
      'Auto', 'V', 'T', 'C', 'A', null, null, '', '', null, null, null,
      null, null, null, null, null, null, null, null, null, null,
    ]]);
    expect(oneCParser.parseRepair(wb, new Date())).toEqual([]);
  });
});

describe('oneCParser — parsePerformed', () => {
  const HEADER = [
    'Авто', 'VIN', 'Марка', 'Модель', 'Гос.номер', 'Год',
    'Заказ-наряд', 'Номер', 'Дата', 'Вид', 'Состояние',
    'Факт начало', 'Факт окончание', 'Дата закрытия',
    'Мастер', 'Диспетчер', 'Сотрудник', 'Основание.Гос.номер',
    'Пробег', 'Описание', 'Итого',
  ];
  it('parses valid row including normHours', () => {
    const wb = buildWorkbook(HEADER, [[
      'Toyota', 'V', 'Toyota', 'Camry', 'A100', '2020',
      'Заказ № К-1', 'К-1', '14.04.2026', 'TO', 'Закрыт',
      '14.04.2026 08:00:00', '14.04.2026 12:00:00', '14.04.2026 12:30:00',
      'Иван', 'Петр', 'Олег', 'A100',
      '50000', 'Замена масла', '2,5',
    ]]);
    const out = oneCParser.parsePerformed(wb, new Date());
    expect(out).toHaveLength(1);
    expect(out[0].orderNumber).toBe('К-1');
    expect(out[0].normHours).toBe(2.5);
    expect(out[0].executor).toBe('Олег');
  });
  it('defaults state to "Закрыт" when blank', () => {
    const wb = buildWorkbook(HEADER, [[
      'Toyota', 'V', 'T', 'C', 'A', '2020',
      'ZN', 'K-1', '14.04.2026', 'TO', null,
      '14.04.2026 08:00:00', '14.04.2026 12:00:00', '14.04.2026 12:30:00',
      'M', 'D', 'E', 'A',
      '0', 'desc', '1',
    ]]);
    expect(oneCParser.parsePerformed(wb, new Date())[0].state).toBe('Закрыт');
  });
  it('skips sub-header rows (no orderNumber/orderDate/closedAt)', () => {
    const wb = buildWorkbook(HEADER, [[
      null, null, null, null, null, null,
      null, null, null, null, null,
      null, null, null,
      null, null, null, null,
      null, null, 'Количество нормочасов',
    ]]);
    expect(oneCParser.parsePerformed(wb, new Date())).toEqual([]);
  });
});

describe('oneCParser — readWorkbook + SIGNATURES exports', () => {
  it('readWorkbook reads buffer', () => {
    const wb = buildWorkbook(['Документ', 'Рабочее место', 'Не актуален', 'Продолжительность']);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const back = oneCParser.readWorkbook(buf);
    expect(back.SheetNames).toContain('TDSheet');
  });
  it('exports signature map', () => {
    expect(Object.keys(oneCParser.SIGNATURES)).toEqual(['plan', 'repair', 'performed']);
  });
});
