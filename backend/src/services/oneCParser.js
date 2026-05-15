// Парсер трёх типов xlsx из 1С (ParadAvto):
//   plan      — «Основной (анализ) (XLSX)»
//   repair    — «Сводная ведомость_Простыня (анализ) (XLSX)»
//   performed — «Выработка исполнителей_… (XLSX)»
//
// detectType()  — column signature по 1-й строке листа TDSheet.
// parse*()      — возвращают массивы сырых объектов (без записи в БД).
//                 Дальнейшую запись делает oneCImporter.
//
// Все три файла раз в N часов прилетают на email и складываются в OneCImport,
// откуда importer вызывает парсер.

const XLSX = require('xlsx');
const { parseInTz, DEFAULT_TZ } = require('../utils/dateUtils');
const settingsReader = require('../routes/settings');

// ----------- date parsing helpers ------------

// xlsx с raw:true + cellDates:true превращает date-cells в Date.
// Но в фактических файлах даты часто записаны как строки "DD.MM.YYYY HH:mm:ss"
// (т.к. 1С не всегда задаёт numFmt). Парсим оба варианта.
//
// Даты в xlsx из 1С — это wall-clock в часовом поясе Location (Минск/Москва),
// без timezone-индикатора. Поэтому интерпретируем их в TZ из настроек
// и приводим к UTC через parseInTz().
function getOneCTz() {
  try {
    const s = settingsReader.readSettings();
    // Приоритет: oneCSourceTimezone (TZ источника 1С) → timezone (общесистемный) → DEFAULT_TZ.
    if (s && s.oneCSourceTimezone) return s.oneCSourceTimezone;
    if (s && s.timezone) return s.timezone;
    return DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

function pad2(n) { return String(n).padStart(2, '0'); }

function parseDate(v) {
  if (v == null || v === '') return null;
  const tz = getOneCTz();
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    // xlsx с cellDates:true укладывает wall-clock в UTC-компоненты Date.
    // Переинтерпретируем UTC-компоненты как wall-clock в TZ Location.
    const dateStr = `${v.getUTCFullYear()}-${pad2(v.getUTCMonth() + 1)}-${pad2(v.getUTCDate())}`;
    const timeStr = `${pad2(v.getUTCHours())}:${pad2(v.getUTCMinutes())}`;
    const baseMs = parseInTz(dateStr, timeStr, tz);
    if (!Number.isFinite(baseMs)) return null;
    return new Date(baseMs + v.getUTCSeconds() * 1000);
  }
  if (typeof v === 'number') {
    // Excel serial date — компоненты — это wall-clock в TZ Location.
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const dateStr = `${d.y}-${pad2(d.m)}-${pad2(d.d)}`;
    const timeStr = `${pad2(d.H || 0)}:${pad2(d.M || 0)}`;
    const ms = parseInTz(dateStr, timeStr, tz);
    if (!Number.isFinite(ms)) return null;
    return new Date(ms + Math.floor(d.S || 0) * 1000);
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    // "DD.MM.YYYY HH:mm:ss" or "DD.MM.YYYY HH:mm" or "DD.MM.YYYY"
    const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      const [, dd, mm, yyyy, hh, mi, ss] = m;
      const dateStr = `${yyyy}-${pad2(+mm)}-${pad2(+dd)}`;
      const timeStr = `${pad2(+(hh || 0))}:${pad2(+(mi || 0))}`;
      const baseMs = parseInTz(dateStr, timeStr, tz);
      if (!Number.isFinite(baseMs)) return null;
      return new Date(baseMs + (+(ss || 0)) * 1000);
    }
    // ISO-строка (с явным TZ-маркером) — пускаем как есть.
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// SheetJS с raw:false форматирует числа по en-US локали (запятая = разделитель тысяч):
// 43200 → "43,200". Раньше парсер трактовал «,» как десятичный → 43.2 → 43.
// Поэтому отличаем шаблон «1,234» / «43,200,000» (тысячи) от русского «12,5» (десятичный).
function normalizeNumberString(v) {
  let cleaned = v.replace(/[\s\u00A0]/g, '');
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, ''); // тысячи (en-US)
  } else {
    cleaned = cleaned.replace(',', '.'); // десятичный (ru)
  }
  return cleaned;
}

function parseInt2(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Math.trunc(v);
  if (typeof v === 'string') {
    const n = Number(normalizeNumberString(v));
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function parseFloat2(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(normalizeNumberString(v));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function s(v) {
  if (v == null) return null;
  const trimmed = String(v).trim();
  return trimmed === '' ? null : trimmed;
}

function bool(v, trueValues = ['да', 'yes', 'true', '1']) {
  if (v == null) return false;
  return trueValues.includes(String(v).trim().toLowerCase());
}

// ----------- column signatures ------------

const SIGNATURES = {
  plan: ['Документ', 'Рабочее место', 'Не актуален', 'Продолжительность'],
  repair: ['Состояние', 'Основание', 'Дата окончания гарантийного срока'],
  performed: ['Сотрудник', 'Итого', 'Дата закрытия'],
};

function getHeaderRow(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
  return { aoa, header: aoa[0] || [], sheetName };
}

function detectType(workbook) {
  const got = getHeaderRow(workbook);
  if (!got) return 'unknown';
  const headers = (got.header || []).map((h) => (h == null ? '' : String(h).trim()));
  const matches = [];
  for (const [type, sig] of Object.entries(SIGNATURES)) {
    if (sig.every((col) => headers.includes(col))) matches.push(type);
  }
  if (matches.length === 1) return matches[0];
  return 'unknown';
}

// ----------- parsers ------------

// plan: «Основной (анализ) (XLSX)»
// Колонки: A=Документ B=Организация C=Автомобиль D=Номер E=Гос.номер F=VIN
// G=Дата начала H=Дата конца I=Рабочее место J=Продолжительность(сек) K=Не актуален
function parsePlan(workbook, receivedAt) {
  const got = getHeaderRow(workbook);
  if (!got) return [];
  const rows = got.aoa.slice(1); // skip header
  const out = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.every((c) => c == null || c === '')) continue;
    const number = s(r[3]);
    const postRawName = s(r[8]);
    const scheduledStart = parseDate(r[6]);
    const scheduledEnd = parseDate(r[7]);
    if (!number || !postRawName || !scheduledStart || !scheduledEnd) continue;

    const rawDocText = s(r[0]) || '';
    // Убираем хвостовые статусы 1С «(проведен)» / «(записан)» — это служебная метка, в таблицу не пишем.
    const documentText = rawDocText.replace(/\s*\((?:проведен|записан)\)\s*$/iu, '').trim();
    const docTypeMatch = documentText.match(/^(Заказ-наряд|План ремонта|Заявка на ремонт)/u);

    out.push({
      documentText,
      documentType: docTypeMatch ? docTypeMatch[1] : null,
      organization: s(r[1]),
      vehicleText: s(r[2]),
      number,
      plateNumber: s(r[4]),
      vin: s(r[5]),
      scheduledStart,
      scheduledEnd,
      postRawName,
      durationSec: parseInt2(r[9]),
      isOutdated: bool(r[10]),
      receivedAt,
    });
  }
  return out;
}

// repair: «Сводная ведомость_Простыня (анализ) (XLSX)»
// Колонки: A=Авто B=VIN C=Марка D=Модель E=Гос.номер1 F=Гос.номер2
// G=Гарантия до H=Год I=Заказ-наряд J=Номер K=Дата L=Состояние M=Вид ремонта
// N=Пробег O=Дата начала работ(факт) P=Дата окончания(факт) Q=Дата закрытия
// R=Основание S=Дата начала(план) T=Дата окончания(план) U=Мастер V=Диспетчер
function parseRepair(workbook, receivedAt) {
  const got = getHeaderRow(workbook);
  if (!got) return [];
  const rows = got.aoa.slice(1);
  const out = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.every((c) => c == null || c === '')) continue;
    const orderNumber = s(r[9]);
    const orderDate = parseDate(r[10]);
    const state = s(r[11]);
    if (!orderNumber || !orderDate || !state) continue;

    out.push({
      vehicleText: s(r[0]),
      vin: s(r[1]),
      brand: s(r[2]),
      model: s(r[3]),
      plateNumber1: s(r[4]),
      plateNumber2: s(r[5]),
      warrantyEnd: parseDate(r[6]),
      yearMade: parseInt2(r[7]),
      orderText: s(r[8]),
      orderNumber,
      orderDate,
      state,
      repairKind: s(r[12]),
      mileage: parseInt2(r[13]),
      workStartedAt: parseDate(r[14]),
      workFinishedAt: parseDate(r[15]),
      closedAt: parseDate(r[16]),
      // Основание: убираем хвостовые статусы 1С «(проведен)»/«(записан)» — это служебная метка.
      basis: (() => {
        const v = s(r[17]);
        return v ? v.replace(/\s*\((?:проведен|записан)\)\s*$/iu, '').trim() || null : null;
      })(),
      basisStart: parseDate(r[18]),
      basisEnd: parseDate(r[19]),
      master: s(r[20]),
      dispatcher: s(r[21]),
      receivedAt,
    });
  }
  return out;
}

// performed: «Выработка исполнителей_… (XLSX)»
// Колонки: A=Авто B=VIN C=Марка D=Модель E=Гос.номер F=Год
// G=Заказ-наряд H=Номер I=Дата J=Вид K=Состояние
// L=Дата начала M=Дата окончания N=Дата закрытия O=Мастер P=Диспетчер
// Q=Сотрудник R=Основание.Гос.номер S=Пробег T=Описание U=Итого(нормочасы)
//
// ВНИМАНИЕ: 2-я строка (index=1) — служебный под-заголовок ("U: Количество нормочасов").
// Мы определяем «служебная ли это строка»: если orderNumber пусто, всё прочее null,
// а в U стоит текст — пропускаем.
function parsePerformed(workbook, receivedAt) {
  const got = getHeaderRow(workbook);
  if (!got) return [];
  const rows = got.aoa.slice(1);
  const out = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.every((c) => c == null || c === '')) continue;
    const orderNumber = s(r[7]);
    const orderDate = parseDate(r[8]);
    const closedAt = parseDate(r[13]);
    if (!orderNumber || !orderDate || !closedAt) continue; // фильтрует и под-заголовок

    out.push({
      vehicleText: s(r[0]),
      vin: s(r[1]),
      brand: s(r[2]),
      model: s(r[3]),
      plateNumber: s(r[4]),
      yearMade: parseInt2(r[5]),
      orderText: s(r[6]),
      orderNumber,
      orderDate,
      repairKind: s(r[9]),
      state: s(r[10]) || 'Закрыт',
      workStartedAt: parseDate(r[11]),
      workFinishedAt: parseDate(r[12]),
      closedAt,
      master: s(r[14]),
      dispatcher: s(r[15]),
      executor: s(r[16]),
      basisPlateNumber: s(r[17]),
      mileage: parseInt2(r[18]),
      causeDescription: s(r[19]),
      normHours: parseFloat2(r[20]),
      receivedAt,
    });
  }
  return out;
}

function readWorkbook(buffer) {
  return XLSX.read(buffer, { type: 'buffer', cellDates: true });
}

module.exports = {
  detectType,
  parsePlan,
  parseRepair,
  parsePerformed,
  readWorkbook,
  SIGNATURES,
  // exposed for tests
  _parseDate: parseDate,
  _parseFloat: parseFloat2,
  _parseInt: parseInt2,
};
