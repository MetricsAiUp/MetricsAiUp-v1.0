# План V2 — Раздел `/data-1c` и `/discrepancies` (1С + IMAP + матчинг с CV)

> Статус: согласовано в брейнсторминге 2026-05-06.
> Старый `/data-1c` (`Data1C.jsx`, `routes/data1c.js`, `services/sync1C.js`, `data/1c-*.json`) подлежит сносу.

---

## 0. Цели и философия

1. **Автоматический импорт** трёх xlsx из Gmail-почтового ящика (IMAP, без участия пользователя).
2. **Append-only архив** всего, что пришло — никогда не теряем данные, видим хронологию.
3. **Матчинг человеческого ввода (1С) с объективным CV** — и автоматическая детекция нестыковок:
   - где завышены нормочасы,
   - где работа не на том посту,
   - где наряд оформлен «задним числом» / без фактической работы.
4. **Не ломать существующее:** CV-слой и `WorkOrder` остаются, 1С-данные — отдельная вселенная, связанная только опционально.

---

## 1. Решения (итог брейнсторминга)

| # | Тема | Решение |
|---|---|---|
| Q1 | Модель данных | 3 raw-таблицы + 2 сводные (по orderNumber и по этапам) |
| Q2 | Перезапись raw | Append-only (не перезаписываем, дозаписываем) |
| Q3 | Грануляция | Гибрид: `OneCWorkOrderMerged` (по orderNumber) + `OneCStageMerged` (по этапам) |
| Q4 | Дедупликация | Append-only с дедупом по `contentHash` |
| Q5 | Связь с `WorkOrder` | Раздельные слои (1С read-only, CV отдельно), связь по `orderNumber` опциональная |
| Q6 | Ключи матчинга | Каскад VIN → plate → fuzzy plate (Levenshtein ≤ 2), окно ±N часов как tie-breaker |
| Q7 | Discrepancy MVP | 6 типов: `no_show_in_cv`, `no_show_in_1c`, `wrong_post`, `overstated_norm_hours`, `understated_actual_time`, `time_mismatch` |
| Q8 | Триггер матчинга | Гибрид: `setImmediate` после импорта + cron 30 мин + кнопка |
| Q9 | IMAP-креды | AES-256-GCM в БД, ключ в `.env` (`IMAP_ENCRYPTION_KEY`) |
| Q10 | Маппинг постов | Regex для «ПОСТ N» + `Post.externalAliases`; не наши места = `Post.isTracked=false` (новое поле) |
| Q11 | Тоггл «показать нестыковки» | Per-страница (5 страниц), глобальное состояние в `User.uiState` (JSON в БД) |
| Q12 | Глобальные настройки | `Imap1CConfig` (новая) + расширенный `Settings` |
| Q13 | UI `/data-1c` | 5 вкладок: Сейчас / Импорты / Несопоставленные рабочие места / Аналитика выработки / Настройки |
| Q14 | UI `/discrepancies` | KPI + группировка по типам + таблица с фильтрами + expand-row |
| Q15 | Lifecycle Discrepancy | `open → acknowledged → resolved`, плюс `dismissed` (false positive) |
| Q16 | Уведомления | Critical → in-app + Telegram сразу; warning/info → in-app real-time + Telegram дайджест 09:00 |
| Q17 | Ретеншн | MVP: всё навсегда, через пару месяцев — пересмотр |
| Q18 | RBAC | 4 новых permission: `view_1c`, `manage_1c_import`, `manage_1c_config`, `manage_discrepancies` |
| Q19 | Миграция | Снос старого + сохранение manual upload xlsx через UI («Импорты»). Парсеры — новые. |
| Q20 | Определение типа xlsx | Column signature (B) + опциональный `?forceType=` для UI |

---

## 2. Phase 1 — Prisma-схема и миграция

### 2.1 Новые модели в `backend/prisma/schema.prisma`

```prisma
// ==========================================
// 1С Импорт (Email + xlsx)
// ==========================================

model OneCImport {
  id              String   @id @default(uuid())
  uid             String                                                      // IMAP UID
  messageId       String?  @map("message_id")                                 // RFC 5322 Message-ID
  fromAddress     String   @map("from_address")
  subject         String?
  receivedAt      DateTime @map("received_at")
  processedAt     DateTime @default(now()) @map("processed_at")
  status          String   @default("pending")                                // pending | success | partial | error_unknown_format | error
  source          String   @default("imap")                                   // imap | manual
  uploadedBy      String?  @map("uploaded_by")                                // userId если manual
  attachmentName  String?  @map("attachment_name")
  attachmentSize  Int?     @map("attachment_size")
  detectedType    String?  @map("detected_type")                              // plan | repair | performed | unknown
  rowsTotal       Int      @default(0) @map("rows_total")
  rowsInserted    Int      @default(0) @map("rows_inserted")                  // дельты после дедупа
  errorMessage    String?  @map("error_message")
  createdAt       DateTime @default(now()) @map("created_at")

  planRows      OneCPlanRow[]
  repairRows    OneCRepairSnapshot[]
  performedRows OneCWorkPerformed[]

  @@unique([uid, attachmentName])     // защита от двойной обработки
  @@index([receivedAt])
  @@index([status])
  @@map("one_c_imports")
}

// raw-строки из «Основного (анализ) (XLSX)»
model OneCPlanRow {
  id                String   @id @default(uuid())
  importId          String   @map("import_id")
  documentText      String   @map("document_text")                            // "Заказ-наряд №КОЛ00037610 от 02.05 / Закрыт"
  documentType      String?  @map("document_type")                            // "Заказ-наряд" | "План ремонта" | "Заявка на ремонт" (parsed)
  organization      String?
  vehicleText       String?  @map("vehicle_text")
  number            String                                                     // "КОЛ00037610" (D)
  plateNumber       String?  @map("plate_number")
  vin               String?
  scheduledStart    DateTime @map("scheduled_start")
  scheduledEnd      DateTime @map("scheduled_end")
  postRawName       String   @map("post_raw_name")                             // "ПОСТ 1 Кол(2-х ст >2,5т)"
  postId            String?  @map("post_id")                                   // resolved
  durationSec       Int?     @map("duration_sec")
  isOutdated        Boolean  @default(false) @map("is_outdated")               // "Не актуален" = Да
  receivedAt        DateTime @map("received_at")                                // copy from import for filtering
  contentHash       String   @map("content_hash")                               // sha256 бизнес-полей
  createdAt         DateTime @default(now()) @map("created_at")

  import OneCImport @relation(fields: [importId], references: [id], onDelete: Cascade)

  @@index([number])
  @@index([plateNumber])
  @@index([vin])
  @@index([scheduledStart])
  @@index([receivedAt])
  @@index([contentHash])
  @@map("one_c_plan_rows")
}

// raw-строки из «Сводная ведомость_Простыня (анализ) (XLSX)»
model OneCRepairSnapshot {
  id                  String   @id @default(uuid())
  importId            String   @map("import_id")
  vehicleText         String?  @map("vehicle_text")
  vin                 String?
  brand               String?
  model               String?
  plateNumber1        String?  @map("plate_number_1")                         // E "Государственный номер"
  plateNumber2        String?  @map("plate_number_2")                         // F "Гос. номер"
  warrantyEnd         DateTime? @map("warranty_end")
  yearMade            Int?     @map("year_made")
  orderText           String?  @map("order_text")
  orderNumber         String   @map("order_number")
  orderDate           DateTime @map("order_date")
  state               String                                                   // "В работе" | "Заявка" | "Ожидание"
  repairKind          String?  @map("repair_kind")
  mileage             Int?
  workStartedAt       DateTime? @map("work_started_at")
  workFinishedAt      DateTime? @map("work_finished_at")
  closedAt            DateTime? @map("closed_at")
  basis               String?                                                  // "План ремонта № 00000004979 ..."
  basisStart          DateTime? @map("basis_start")
  basisEnd            DateTime? @map("basis_end")
  master              String?
  dispatcher          String?
  receivedAt          DateTime @map("received_at")
  contentHash         String   @map("content_hash")
  createdAt           DateTime @default(now()) @map("created_at")

  import OneCImport @relation(fields: [importId], references: [id], onDelete: Cascade)

  @@index([orderNumber])
  @@index([vin])
  @@index([plateNumber1])
  @@index([state])
  @@index([receivedAt])
  @@index([contentHash])
  @@map("one_c_repair_snapshots")
}

// raw-строки из «Выработка исполнителей_… (XLSX)»
model OneCWorkPerformed {
  id                  String   @id @default(uuid())
  importId            String   @map("import_id")
  vehicleText         String?  @map("vehicle_text")
  vin                 String?
  brand               String?
  model               String?
  plateNumber         String?  @map("plate_number")
  yearMade            Int?     @map("year_made")
  orderText           String?  @map("order_text")
  orderNumber         String   @map("order_number")
  orderDate           DateTime @map("order_date")
  repairKind          String?  @map("repair_kind")
  state               String                                                   // "Закрыт"
  workStartedAt       DateTime? @map("work_started_at")
  workFinishedAt      DateTime? @map("work_finished_at")
  closedAt            DateTime  @map("closed_at")
  master              String?
  dispatcher          String?
  executor            String?                                                  // "Сотрудник"
  basisPlateNumber    String?  @map("basis_plate_number")
  mileage             Int?
  causeDescription    String?  @map("cause_description")
  normHours           Float?   @map("norm_hours")                              // U "Итого"
  receivedAt          DateTime @map("received_at")
  contentHash         String   @map("content_hash")
  createdAt           DateTime @default(now()) @map("created_at")

  import OneCImport @relation(fields: [importId], references: [id], onDelete: Cascade)

  @@index([orderNumber])
  @@index([vin])
  @@index([plateNumber])
  @@index([executor])
  @@index([closedAt])
  @@index([receivedAt])
  @@index([contentHash])
  @@map("one_c_work_performed")
}

// ==========================================
// Сводные таблицы (append-only с дедупом по contentHash)
// ==========================================

model OneCWorkOrderMerged {
  id              String   @id @default(uuid())
  orderNumber     String   @map("order_number")
  // identity
  vin             String?
  brand           String?
  model           String?
  plateNumber     String?  @map("plate_number")
  yearMade        Int?     @map("year_made")
  mileage         Int?
  // dates
  orderDate       DateTime? @map("order_date")
  scheduledStart  DateTime? @map("scheduled_start")
  scheduledEnd    DateTime? @map("scheduled_end")
  workStartedAt   DateTime? @map("work_started_at")
  workFinishedAt  DateTime? @map("work_finished_at")
  closedAt        DateTime? @map("closed_at")
  // organizational
  state           String?                                                       // последнее известное состояние
  documentType    String?  @map("document_type")
  organization    String?
  repairKind      String?  @map("repair_kind")
  basis           String?
  master          String?
  dispatcher      String?
  executor        String?
  causeDescription String? @map("cause_description")
  normHours       Float?   @map("norm_hours")
  // sources flags
  inPlan          Boolean  @default(false) @map("in_plan")
  inRepair        Boolean  @default(false) @map("in_repair")
  inPerformed     Boolean  @default(false) @map("in_performed")
  // meta
  contentHash     String   @map("content_hash")
  receivedAt      DateTime @map("received_at")
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([orderNumber, receivedAt(sort: Desc)])
  @@index([vin])
  @@index([plateNumber])
  @@index([state])
  @@index([executor])
  @@index([contentHash])
  @@map("one_c_work_order_merged")
}

model OneCStageMerged {
  id              String   @id @default(uuid())
  orderNumber     String   @map("order_number")
  postRawName     String   @map("post_raw_name")
  postId          String?  @map("post_id")                                      // resolved (nullable если не наш пост)
  scheduledStart  DateTime @map("scheduled_start")
  scheduledEnd    DateTime @map("scheduled_end")
  durationSec     Int?     @map("duration_sec")
  isOutdated      Boolean  @default(false) @map("is_outdated")
  // copy для удобства
  vin             String?
  plateNumber     String?  @map("plate_number")
  contentHash     String   @map("content_hash")
  receivedAt      DateTime @map("received_at")
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([orderNumber, postRawName, scheduledStart, receivedAt(sort: Desc)])
  @@index([postId, scheduledStart])
  @@index([scheduledStart])
  @@index([contentHash])
  @@map("one_c_stage_merged")
}

// ==========================================
// Матчинг 1С ↔ CV
// ==========================================

model OneCCvMatch {
  id                String   @id @default(uuid())
  orderNumber       String   @map("order_number")
  vehicleSessionId  String?  @map("vehicle_session_id")
  postStayId        String?  @map("post_stay_id")
  matchType         String   @map("match_type")                                // exact_vin | exact_plate | fuzzy_plate | none
  confidence        Float
  windowApplied     Boolean  @default(false) @map("window_applied")            // tie-breaker сработал
  matchedAt         DateTime @default(now()) @map("matched_at")
  context           String?                                                     // JSON: candidates considered, chosen reason

  @@unique([orderNumber, vehicleSessionId])
  @@index([orderNumber])
  @@index([vehicleSessionId])
  @@map("one_c_cv_match")
}

// ==========================================
// Discrepancy (нестыковки)
// ==========================================

model Discrepancy {
  id              String   @id @default(uuid())
  type            String                                                        // no_show_in_cv | no_show_in_1c | wrong_post | overstated_norm_hours | understated_actual_time | time_mismatch
  severity        String   @default("warning")                                  // critical | warning | info
  status          String   @default("open")                                     // open | acknowledged | resolved | dismissed
  // context
  orderNumber     String?  @map("order_number")
  vehicleSessionId String? @map("vehicle_session_id")
  postId          String?  @map("post_id")
  plateNumber     String?  @map("plate_number")
  vin             String?
  // payload (что не сошлось)
  oneCValue       String?  @map("one_c_value")                                  // JSON с полями из 1С
  cvValue         String?  @map("cv_value")                                     // JSON с полями из CV
  description     String                                                         // RU human-readable
  descriptionEn   String?  @map("description_en")
  // lifecycle
  detectedAt      DateTime @default(now()) @map("detected_at")
  acknowledgedAt  DateTime? @map("acknowledged_at")
  acknowledgedBy  String?   @map("acknowledged_by")
  resolvedAt      DateTime? @map("resolved_at")
  resolvedBy      String?   @map("resolved_by")
  closeReason     String?   @map("close_reason")                                 // fixed_in_1c | cv_error | acceptable | other (опционально)
  closeComment    String?   @map("close_comment")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@unique([type, orderNumber, postId, vehicleSessionId])                       // дедуп: одна и та же нестыковка не плодится
  @@index([status, severity, detectedAt(sort: Desc)])
  @@index([type])
  @@index([orderNumber])
  @@index([postId])
  @@map("discrepancies")
}

// ==========================================
// IMAP-конфиг (отдельная таблица из-за пароля и сложности)
// ==========================================

model Imap1CConfig {
  id                  Int      @id @default(1)
  host                String   @default("imap.gmail.com")
  port                Int      @default(993)
  useSsl              Boolean  @default(true) @map("use_ssl")
  user                String                                                     // metrics.up.ai@gmail.com
  passwordEncrypted   String   @map("password_encrypted")                        // AES-256-GCM(secret из .env)
  fromFilter          String   @default("zakaz@paradavto.by") @map("from_filter")
  subjectMask         String?  @map("subject_mask")                              // optional regex
  intervalMinutes     Int      @default(30) @map("interval_minutes")
  matchWindowHours    Int      @default(24) @map("match_window_hours")
  enabled             Boolean  @default(false)
  markAsRead          Boolean  @default(true) @map("mark_as_read")
  deleteAfterDays     Int?     @map("delete_after_days")                         // null = не удалять
  lastFetchAt         DateTime? @map("last_fetch_at")
  lastFetchStatus     String?   @map("last_fetch_status")                        // ok | error
  lastFetchError      String?   @map("last_fetch_error")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  updatedBy           String?   @map("updated_by")

  @@map("imap_1c_config")
}
```

### 2.2 Изменения существующих моделей

```prisma
// User: добавить uiState (JSON в строке) — для тоггла «показать нестыковки» и будущих UI-настроек
model User {
  // ...
  uiState        String   @default("{}") @map("ui_state")
  // ...
}

// Post: добавить isTracked — для пометки «не наш» постов из 1С (Приёмка, ОК и пр.)
model Post {
  // ...
  isTracked    Boolean  @default(true) @map("is_tracked")
  // ...
  @@index([isTracked])
}
```

### 2.3 Миграция

```bash
cd /project/backend
npx prisma migrate dev --name add_oneC_v2_and_discrepancies
npx prisma generate
```

### 2.4 Seed permissions (расширение `prisma/seed.js`)

```js
// Добавить в permissionData:
{ key: 'view_1c',              displayName: 'Просмотр 1С',                     group: '1c' },
{ key: 'manage_1c_import',     displayName: 'Импорт 1С',                       group: '1c' },
{ key: 'manage_1c_config',     displayName: 'Настройки IMAP/1С',               group: '1c' },
{ key: 'manage_discrepancies', displayName: 'Управление нестыковками',         group: 'discrepancies' },

// Распределение по ролям:
admin:    [...все, включая 4 новых];
director: [..., 'view_1c', 'manage_discrepancies'];
manager:  [..., 'view_1c', 'manage_1c_import', 'manage_discrepancies'];
mechanic: [...без новых];
viewer:   [..., 'view_1c'];
```

### 2.5 ENV-переменные (добавить в `.env` и `.env.example`)

```
IMAP_ENCRYPTION_KEY=<32-байтный hex, генерируется один раз>
```

### 2.6 Vue: индексы и производительность

- Все `contentHash` поля проиндексированы (для быстрого dedup-lookup).
- `(orderNumber, receivedAt DESC)` — основной индекс для view `*_current`.
- `(type, orderNumber, postId, vehicleSessionId)` уникальный — защита от дубликатов в `Discrepancy`.

---

## 3. Phase 2 — IMAP-fetcher и парсеры xlsx

### 3.1 Новые зависимости (`backend/package.json`)

```json
{
  "dependencies": {
    "imapflow": "^1.0.150",
    "mailparser": "^3.7.1"
  }
}
```

### 3.2 Новые файлы

```
backend/src/services/imap1cFetcher.js       — main IMAP loop
backend/src/services/oneCParser.js          — общий парсер xlsx (3 типа)
backend/src/services/oneCImporter.js        — оркестратор: parser → raw rows → merger trigger
backend/src/services/postNameResolver.js    — regex + Post.externalAliases
backend/src/utils/crypto.js                 — AES-256-GCM encrypt/decrypt
backend/src/utils/contentHash.js            — sha256 бизнес-полей
```

### 3.3 `imap1cFetcher.js` — поведение

- На старте: загрузить `Imap1CConfig`. Если `enabled=false` → не запускать loop.
- Cron каждые `intervalMinutes` (`node-cron`): `*/{interval} * * * *`.
- Каждый цикл:
  1. Создать `OneCImport` с `status=pending` для каждого подходящего письма.
  2. `imapflow` connect → SEARCH `FROM ${fromFilter} SINCE ${lastFetchAt - 1h}`.
  3. Для каждого письма: проверить UID не в `OneCImport`, скачать вложения.
  4. Для каждого вложения `.xlsx`: вызвать `oneCImporter.process(import, attachment)`.
  5. После всех писем: установить `\\Seen` если `markAsRead=true`.
  6. Если `deleteAfterDays` задано — удалить старые `\\Seen` сообщения старше N дней.
  7. Обновить `lastFetchAt`, `lastFetchStatus`.
- Регистрация в `_serviceRegistry.js`.

### 3.4 `oneCParser.js` — поведение

```js
// Public:
function detectType(workbook): 'plan' | 'repair' | 'performed' | 'unknown'
function parsePlan(workbook): OneCPlanRow[]    // raw, без сохранения
function parseRepair(workbook): OneCRepairSnapshot[]
function parsePerformed(workbook): OneCWorkPerformed[]
```

**`detectType` — column signature:**
```js
const SIGNATURES = {
  plan:      ['Документ', 'Рабочее место', 'Не актуален', 'Продолжительность'],
  repair:    ['Состояние', 'Основание', 'Дата окончания гарантийного срока'],
  performed: ['Сотрудник', 'Итого', 'Дата закрытия'],
};
// Берём row 0 → trim → match: тип у которого все поля сигнатуры присутствуют.
// Если совпало >1 → unknown (impossible for valid xlsx).
```

**Парсеры:**
- Конвертация `Excel serial date` → `Date` через `xlsx.SSF.parse_date_code` (либо `XLSX.utils.sheet_to_json` с `cellDates: true`).
- Trim строк, нормализация `Не актуален` → boolean.
- `documentType` парсится regex'ом из «Документ» (`Заказ-наряд`/`План ремонта`/`Заявка на ремонт`).
- Парсеры **возвращают сырые объекты**, без записи в БД (это делает `oneCImporter`).

### 3.5 `oneCImporter.js` — поведение

```js
async function process(oneCImport, attachmentBuffer)
```

1. Прочитать `XLSX.read(attachmentBuffer)`.
2. `detectType()` → если `unknown` → `import.status='error_unknown_format'`.
3. Парсер → массив raw-строк.
4. Для каждой строки:
   - вычислить `contentHash`,
   - resolve `postId` через `postNameResolver` (если plan),
   - upsert в raw-таблицу (вставка всегда, dedup в сводных).
5. Триггер `oneCMerger.mergeForImport(importId)`.
6. После merger — `setImmediate(() => discrepancyDetector.detectForOrder(...))`.
7. Обновить `import.status='success'`, `rowsTotal`, `rowsInserted`.
8. На любой error — `status='error'`, `errorMessage=err.message`.

### 3.6 `postNameResolver.js`

```js
// Regex для очевидных «ПОСТ N»:
const POST_REGEX = /^\s*(?:ПОСТ|Пост|Post)\s*(\d{1,2})\b/;

async function resolve(rawName: string) {
  // 1. Пробуем regex → ищем Post.number
  // 2. Если не сработало — ищем Post.externalAliases (JSON.parse, .includes(rawName))
  // 3. Если не сработало — записываем в OneCUnmappedPost (новая таблица?) для UI «Несопоставленные»
  //    и возвращаем null
  // returns { postId | null, isTracked: bool }
}
```

> **Доп. модель:** `OneCUnmappedPost(rawName String @id, firstSeenAt DateTime, lastSeenAt DateTime, occurrences Int)` — для вкладки «Несопоставленные». Создаётся при первом вызове resolve, который ничего не нашёл; в UI админ выбирает Post или жмёт «не наш».

### 3.7 `crypto.js`

```js
const crypto = require('crypto');
const KEY = Buffer.from(process.env.IMAP_ENCRYPTION_KEY, 'hex'); // 32 байта

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(packed) {
  const buf = Buffer.from(packed, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
```

### 3.8 Тесты

- `backend/src/__tests__/services/oneCParser.test.js` — парсинг трёх sample xlsx (положить в `__tests__/fixtures/`).
- `backend/src/__tests__/services/postNameResolver.test.js` — regex + alias-lookup.
- `backend/src/__tests__/utils/crypto.test.js` — encrypt/decrypt round-trip.

---

## 4. Phase 3 — Сводные с дедупом

### 4.1 Новый файл

```
backend/src/services/oneCMerger.js
```

### 4.2 Поведение `mergeForImport(importId)`

1. Загрузить все raw-строки этого `importId`.
2. Для каждой:
   - **OneCStageMerged** (только из plan):
     - Вычислить ключ `(orderNumber, postRawName, scheduledStart)`.
     - SELECT последнюю запись по ключу `ORDER BY receivedAt DESC LIMIT 1`.
     - Если `lastRow.contentHash !== newRow.contentHash` (или нет последней) → INSERT.
     - Иначе → пропустить.
   - **OneCWorkOrderMerged** (из всех трёх типов):
     - Ключ `(orderNumber)`.
     - SELECT последнюю запись по `orderNumber ORDER BY receivedAt DESC LIMIT 1`.
     - Сформировать новую агрегированную запись:
       - `inPlan/inRepair/inPerformed` = true для соответствующего типа,
       - merge полей: новые перекрывают старые при заполнении (предпочитаем `performed > repair > plan` по полям, которые есть в нескольких).
     - Вычислить `contentHash` от агрегата.
     - Если хэш не совпал с прошлым → INSERT.

### 4.3 SQL view (через миграцию или Prisma raw)

```sql
CREATE VIEW one_c_work_order_merged_current AS
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY order_number ORDER BY received_at DESC) rn
  FROM one_c_work_order_merged
) WHERE rn = 1;

CREATE VIEW one_c_stage_merged_current AS
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY order_number, post_raw_name, scheduled_start ORDER BY received_at DESC) rn
  FROM one_c_stage_merged
) WHERE rn = 1;
```

Prisma не поддерживает views напрямую → читаем через `$queryRawUnsafe` или объявляем как model с `@@map` к view + `view` блок.

### 4.4 Тесты

- `oneCMerger.test.js` — дедуп: повторный импорт идентичной строки → 0 новых записей; изменение поля → +1 запись.

---

## 5. Phase 4 — Матчинг 1С↔CV и Discrepancy

### 5.1 Новые файлы

```
backend/src/services/oneCCvMatcher.js
backend/src/services/discrepancyDetector.js
backend/src/services/discrepancyRules/
  ├── noShowInCv.js
  ├── noShowIn1C.js
  ├── wrongPost.js
  ├── overstatedNormHours.js
  ├── understatedActualTime.js
  └── timeMismatch.js
```

### 5.2 `oneCCvMatcher.js` — каскад

```js
async function findCvMatch(oneCRecord) {
  const { vin, plateNumber, scheduledStart } = oneCRecord;
  const windowH = await getMatchWindowHours();   // из Imap1CConfig
  const candidates = [];

  // 1. Точный VIN (если есть)
  if (vin) {
    const cv = await prisma.vehicleSession.findMany({ where: { /* vin via plateNumber if not stored */ } });
    if (cv.length === 1) return { ...cv[0], matchType: 'exact_vin', confidence: 1.0 };
    if (cv.length > 1)  return chooseClosest(cv, scheduledStart, windowH, 'exact_vin', 0.95);
  }

  // 2. Точный plate
  if (plateNumber) {
    const cv = await prisma.vehicleSession.findMany({ where: { plateNumber } });
    if (cv.length === 1) return { ...cv[0], matchType: 'exact_plate', confidence: 0.9 };
    if (cv.length > 1)  return chooseClosest(cv, scheduledStart, windowH, 'exact_plate', 0.85);
  }

  // 3. Fuzzy plate (Levenshtein ≤ 2) только в окне — иначе слишком много мусора
  if (plateNumber) {
    const allCv = await prisma.vehicleSession.findMany({ where: { plateNumber: { not: null }, /* в окне */ } });
    const fuzzy = allCv.filter(cv => levenshtein(cv.plateNumber, plateNumber) <= 2);
    if (fuzzy.length >= 1) return chooseClosest(fuzzy, scheduledStart, windowH, 'fuzzy_plate', 0.55);
  }

  // 4. Не нашли — orphan
  return { matchType: 'none', confidence: 0 };
}
```

### 5.3 `discrepancyDetector.js`

```js
async function detectForOrder(orderNumber)        // single order
async function detectAll(opts = { since: '24h' }) // bulk for cron

// Внутри detectForOrder:
// 1. Загрузить current OneCWorkOrderMerged + relevant OneCStageMerged.
// 2. Загрузить match (или создать через oneCCvMatcher).
// 3. Прогнать все 6 правил → собрать массив новых Discrepancy.
// 4. Upsert в Discrepancy (по @@unique([type, orderNumber, postId, vehicleSessionId])).
//    Если новая → emit Socket.IO 'discrepancy:new'.
//    Если severity=critical → отправить в Telegram через telegramBot.
```

### 5.4 Правила (severity)

| Тип | Severity | Условие |
|---|---|---|
| `no_show_in_cv` | critical | 1С: state=`Закрыт` или `В работе` И VIN/plate валиден И нет CV-сессии в окне ±N ч |
| `no_show_in_1c` | warning | CV PostStay > 30 мин на отслеживаемом посту И нет current `OneCStageMerged` для этого окна |
| `wrong_post` | warning | matched CV PostStay.postId ≠ resolved 1С postId |
| `overstated_norm_hours` | critical | 1С normHours > 1.5 × CV PostStay.activeTime (в часах) |
| `understated_actual_time` | warning | CV PostStay.activeTime > 1.5 × 1С normHours |
| `time_mismatch` | warning | abs(1С.closedAt − CV PostStay.endTime) > 60 мин |

### 5.5 Триггеры

- **После импорта:** `oneCImporter.process` → `setImmediate(() => detectForOrder(orderNumber))` для каждого затронутого orderNumber (батч в очередь).
- **Cron 30 мин:** `discrepancyDetector.detectAll({ since: '24h' })` — догоняет CV-данные, появившиеся после импорта 1С.
- **Кнопка:** `POST /api/discrepancies/run` (admin only) — `detectAll({ since: '7d' })`.

### 5.6 Тесты

- `discrepancyDetector.test.js` — каждое правило отдельно с фикстурами.
- `oneCCvMatcher.test.js` — каскад VIN/plate/fuzzy + окно.

---

## 6. Phase 5 — REST API

### 6.1 Новые файлы

```
backend/src/routes/oneC.js                  — /api/oneC/*
backend/src/routes/discrepancies.js         — /api/discrepancies/*
backend/src/schemas/oneC.js                 — Zod схемы
backend/src/schemas/discrepancies.js
```

### 6.2 Endpoints `/api/oneC/*`

| Метод | Путь | Permission | Что делает |
|---|---|---|---|
| GET | `/config` | `manage_1c_config` | Конфиг IMAP (пароль маскируется как `****`) |
| PUT | `/config` | `manage_1c_config` | Update config (пароль шифруется через `crypto.encrypt`) |
| POST | `/config/test` | `manage_1c_config` | Проверить IMAP-соединение (без сохранения изменений) |
| GET | `/imports` | `view_1c` | Список писем (пагинация, фильтр по статусу) |
| GET | `/imports/:id` | `view_1c` | Детали + ошибки |
| POST | `/imports/run` | `manage_1c_import` | Форс IMAP-цикл |
| POST | `/imports/upload` | `manage_1c_import` | multipart xlsx + `?forceType=plan|repair|performed` |
| GET | `/current` | `view_1c` | Сводная (`OneCWorkOrderMerged_current`) с фильтрами |
| GET | `/raw/:type` | `view_1c` | Сырые срезы (для дебага) |
| GET | `/payroll` | `view_1c` | Аналитика выработки (агрегация `OneCWorkPerformed`) |
| GET | `/unmapped-posts` | `manage_1c_import` | Список несопоставленных |
| POST | `/unmapped-posts/resolve` | `manage_1c_import` | `{ rawName, postId|null, isTracked }` |

### 6.3 Endpoints `/api/discrepancies/*`

| Метод | Путь | Permission | Что делает |
|---|---|---|---|
| GET | `/` | `view_1c` | Список с фильтрами (`?status=open&severity=critical&type=...&postId=...&from=...&to=...`) |
| GET | `/stats` | `view_1c` | KPI: всего, новых за 24ч, по типам/severity, top problem mаsters |
| GET | `/:id` | `view_1c` | Детали (1С + CV side-by-side) |
| PATCH | `/:id/status` | `manage_discrepancies` | `{ status: 'acknowledged'\|'resolved'\|'dismissed', closeReason?, closeComment? }` |
| POST | `/run` | `manage_discrepancies` | Пересчёт (admin only внутри) |

### 6.4 Endpoint `/api/users/me/ui-state`

| Метод | Путь | Permission | Что делает |
|---|---|---|---|
| PATCH | `/api/users/me/ui-state` | auth (любой залогиненный) | `{ patch: { showDiscrepancies: bool, ... } }` — merge в `User.uiState` |

### 6.5 Zod-схемы (`schemas/oneC.js`)

```js
const imap1cConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  useSsl: z.boolean(),
  user: z.string().email(),
  password: z.string().min(1).optional(),         // optional если не меняем
  fromFilter: z.string().min(1),
  subjectMask: z.string().optional(),
  intervalMinutes: z.number().int().min(5).max(1440),
  matchWindowHours: z.number().int().min(1).max(168),
  enabled: z.boolean(),
  markAsRead: z.boolean(),
  deleteAfterDays: z.number().int().min(0).optional().nullable(),
});

const uploadQuerySchema = z.object({
  forceType: z.enum(['plan', 'repair', 'performed']).optional(),
});
```

### 6.6 Регистрация в `index.js`

```js
app.use('/api/oneC', require('./routes/oneC'));
app.use('/api/discrepancies', require('./routes/discrepancies'));
// /api/users/me/ui-state — extending users router
```

### 6.7 Тесты

- `routes/oneC.test.js` — config CRUD + permissions, manual upload (mock parser).
- `routes/discrepancies.test.js` — list/filter/status patch + permissions.

---

## 7. Phase 6 — Уведомления

### 7.1 Файлы

```
backend/src/services/discrepancyNotifier.js   — real-time + critical Telegram
backend/src/services/discrepancyDigest.js     — cron 09:00 daily digest
```

### 7.2 `discrepancyNotifier.js`

- Экспортирует `notify(discrepancy)` (вызывается из `discrepancyDetector` после INSERT).
- `io.emit('discrepancy:new', { id, type, severity, postId, orderNumber })` — для Sidebar-бейджа и `NotificationCenter`.
- Если `severity === 'critical'`:
  - `telegramBot.broadcastMessage(`🚨 ${formatDiscrepancy(d)}`)` — всем привязанным пользователям с `manage_discrepancies`.
  - PWA push (`web-push`) — всем `PushSubscription`.

### 7.3 `discrepancyDigest.js`

- Cron `0 9 * * *` (09:00 каждый день).
- Загрузить все Discrepancy с `detectedAt` за прошлые сутки + ещё `open` несбросленные.
- Сформировать markdown-отчёт: `За 24ч: 12 (critical: 3, warning: 5, info: 4). Топ постов: ...`.
- Отправить в Telegram-группу из `Settings.discrepancyDigestChatId` (новая настройка).

### 7.4 Frontend — `NotificationCenter.jsx`

- Подписаться на `socket.on('discrepancy:new', ...)` → добавить в feed.
- Бейдж в Sidebar: счётчик `Discrepancy.where(status='open')` через `GET /api/discrepancies/stats`.

### 7.5 Тесты

- `discrepancyNotifier.test.js` — мок socket.io + telegramBot.
- `discrepancyDigest.test.js` — формат сообщения, cron-логика.

---

## 8. Phase 7 — UI

### 8.1 Новые страницы

```
frontend/src/pages/Data1C.jsx                         (полностью заменить старый)
frontend/src/pages/Discrepancies.jsx                  (новая)
frontend/src/components/data1c/
  ├── Data1CCurrent.jsx        — вкладка «Сейчас»
  ├── Data1CImports.jsx        — вкладка «Импорты» (список + upload + run)
  ├── Data1CUnmappedPosts.jsx  — вкладка «Несопоставленные»
  ├── Data1CPayroll.jsx        — вкладка «Аналитика выработки»
  ├── Data1CSettings.jsx       — вкладка «Настройки» (IMAP-конфиг)
  └── ImportRow.jsx            — карточка одного письма
frontend/src/components/discrepancies/
  ├── DiscrepancyKpiBar.jsx
  ├── DiscrepancyTypeCards.jsx
  ├── DiscrepancyTable.jsx
  ├── DiscrepancyExpandRow.jsx — 1С vs CV side-by-side
  └── ShowDiscrepanciesToggle.jsx — кнопка-тоггл (на 5 страницах)
```

### 8.2 Маршруты (App.jsx)

```jsx
const Data1C = lazy(() => import('./pages/Data1C'));            // переписан
const Discrepancies = lazy(() => import('./pages/Discrepancies'));

<Route path="/data-1c" element={<ProtectedRoute><Data1C /></ProtectedRoute>} />
<Route path="/discrepancies" element={<ProtectedRoute><Discrepancies /></ProtectedRoute>} />
```

### 8.3 `ShowDiscrepanciesToggle.jsx` — глобальный тоггл

```jsx
function ShowDiscrepanciesToggle() {
  const { user, api, updateCurrentUser } = useAuth();
  const enabled = user.uiState?.showDiscrepancies === true;

  const onToggle = async () => {
    const next = !enabled;
    await api.patch('/users/me/ui-state', { patch: { showDiscrepancies: next } });
    updateCurrentUser({ ...user, uiState: { ...user.uiState, showDiscrepancies: next } });
  };

  return <button onClick={onToggle}>...</button>;
}
```

Рендер на: `Dashboard`, `DashboardPosts`, `MapViewer`, `PostsDetail`, `MyPost`. Состояние влияет на оверлеи (красные точки, бейджи на постах).

### 8.4 Sidebar

- Добавить пункт «Нестыковки» (`/discrepancies`) с иконкой `AlertTriangle` и бейджем-счётчиком (из `useAsync('/api/discrepancies/stats')`).

### 8.5 i18n

Расширить `ru.json` / `en.json`:
```json
"data1c": {
  "tabs": {
    "current": "Сейчас",
    "imports": "Импорты",
    "unmapped": "Несопоставленные рабочие места",
    "payroll": "Аналитика выработки",
    "settings": "Настройки"
  },
  "imap": { "host": "...", "user": "...", ... },
  // ... все ключи UI
},
"discrepancies": {
  "title": "Нестыковки",
  "types": {
    "no_show_in_cv": "Авто не приехало по данным CV",
    "no_show_in_1c": "Авто на посту без оформления в 1С",
    "wrong_post": "Не тот пост",
    "overstated_norm_hours": "Завышены нормочасы",
    "understated_actual_time": "Заниженное фактическое время",
    "time_mismatch": "Расхождение времени закрытия"
  },
  "severity": { "critical": "Критично", "warning": "Внимание", "info": "Инфо" },
  "status": { "open": "Открыто", "acknowledged": "Принято", "resolved": "Решено", "dismissed": "Отклонено" },
  // ...
}
```

### 8.6 Permission gating на Sidebar/Layout

```jsx
hasPermission('view_1c')           → пункт «1С» виден
hasPermission('manage_1c_config')  → вкладка «Настройки» виден внутри Data1C
hasPermission('manage_discrepancies') → кнопки «Принять/Решить/Отклонить» активны
```

---

## 9. Phase 8 — Снос старого 1С-стека

### 9.1 Удалить файлы

```
backend/src/routes/data1c.js                  — старый API
backend/src/services/sync1C.js                — file watcher
backend/src/__tests__/routes/data1c.test.js
backend/src/__tests__/services/sync1C.test.js
backend/src/parse1C.js                        — устарел
backend/src/seedDemoDb.js                     — проверить, есть ли 1С-моки
data/1c-import/                               — папка + содержимое
data/1c-import/processed/
data/1c-workers.json
data/1c-planning.json
data/1c-stats.json
frontend/src/pages/Data1C.jsx                 — заменён в Phase 7
```

### 9.2 Чистка `index.js`

Убрать:
```js
const { startFileWatcher } = require('./services/sync1C');
startFileWatcher();
app.use('/api/1c', require('./routes/data1c'));
```

Добавить (если ещё не):
```js
const { start1CImapFetcher } = require('./services/imap1cFetcher');
start1CImapFetcher();
app.use('/api/oneC', require('./routes/oneC'));
app.use('/api/discrepancies', require('./routes/discrepancies'));
```

### 9.3 Проверки перед сносом

- `grep -r "from '../routes/data1c'"` — должно быть 0 совпадений.
- `grep -r "/api/1c/"` в frontend → 0 (заменено на `/api/oneC/`).
- `grep -r "1c-planning\|1c-workers\|1c-stats"` → 0.
- Cтарый `WorkOrder.externalId` оставляем (используется в Gantt).
- `SyncLog` оставляем (общая для других sync).

---

## 10. Phase 9 — Тесты

### Бэк
- `services/imap1cFetcher.test.js` — мок `imapflow`, проверка цикла.
- `services/oneCParser.test.js` — три фикстуры xlsx (sample data из текущих файлов).
- `services/oneCMerger.test.js` — дедуп по хэшу.
- `services/oneCCvMatcher.test.js` — каскад + окно.
- `services/discrepancyDetector.test.js` — все 6 правил.
- `services/discrepancyNotifier.test.js` — Socket.IO + Telegram.
- `services/discrepancyDigest.test.js` — формат + cron.
- `routes/oneC.test.js` — API + permissions.
- `routes/discrepancies.test.js` — API + permissions.
- `utils/crypto.test.js` — encrypt/decrypt.
- `services/postNameResolver.test.js` — regex + alias.

### Фронт (Vitest + RTL)
- `Discrepancies.test.jsx` — render KPI + table + filters.
- `Data1CSettings.test.jsx` — submit IMAP form, masked password.
- `ShowDiscrepanciesToggle.test.jsx` — patch ui-state, optimistic update.

---

## 11. Phase 10 — Финиш

### 11.1 i18n
- Все строки в новых компонентах через `t('...')`.
- `ru.json` и `en.json` синхронны (один и тот же набор ключей).

### 11.2 HelpButton
- Добавить разделы помощи для `/data-1c` и `/discrepancies` в `HelpButton.jsx` (RU + EN).

### 11.3 sw.js
- После каждого фронтового билда: bump `CACHE_NAME` → `metricsaiup-v89` (потом по мере правок).

### 11.4 Чистка README/доков
- Обновить `CLAUDE.md` секцию про 1С (упоминания `sync1C` → `imap1cFetcher` etc.).
- Обновить количество маршрутов/сервисов.

### 11.5 Smoke-test полного цикла

1. Настроить IMAP-конфиг через UI (admin).
2. Кнопка «Запустить сейчас» → подтянулись 3 письма.
3. В `OneCImport` — три записи `success`.
4. В `OneCWorkOrderMerged` / `OneCStageMerged` — данные.
5. Через 10 сек — Discrepancy появились (если CV-сессии есть).
6. На `/dashboard` нажать тоггл «Показать нестыковки» → красные точки на постах.
7. На `/discrepancies` — KPI + таблица.
8. Закрыть одну нестыковку как `dismissed` → исчезла из счётчика.
9. Telegram-чат — пришёл алерт о critical.

---

## 12. Зависимости фаз

```
Phase 1 (схема) ──┬─→ Phase 2 (IMAP+парсеры) ──→ Phase 3 (сводные)
                  │                                        │
                  └────────────────────────────────────────┴─→ Phase 4 (матчинг+Discrepancy)
                                                                       │
                                                                       └──→ Phase 5 (API)
                                                                              │
                                                                              ├──→ Phase 6 (уведомления)
                                                                              └──→ Phase 7 (UI)
                                                                                            │
                                                                                            └──→ Phase 8 (снос старого)
                                                                                            
Phase 9 (тесты): пишутся параллельно каждой фазе
Phase 10 (финиш): после всех остальных
```

---

## 13. Открытые риски и решения

| Риск | Митигация |
|---|---|
| Gmail App Password недействителен / 2FA не настроен | Phase 5 — endpoint `POST /api/oneC/config/test` показывает живую ошибку до сохранения |
| Парсер ломается при изменении колонок 1С | Column signature по нескольким маркер-полям + `?forceType=` для override + UI «Несопоставленные» собирает диагностику |
| Append-only растёт неконтролируемо | Phase 1: `contentHash`-индекс + сжатие через дедуп. Если за полгода БД > 5GB — добавить ретеншн (Phase 11+) |
| Discrepancy спамит false positive | Lifecycle `dismissed` + `closeReason` собирает статистику для тюнинга порогов в правилах |
| Конфликт с CV-системой если у авто несколько визитов в день | Окно ±N часов как tie-breaker + `OneCCvMatch.context` хранит JSON со списком кандидатов |
| Потеря IMAP-кредов при ротации `IMAP_ENCRYPTION_KEY` | Документировать в README; миграционный скрипт если потребуется ротация |

---

## 14. Готовность к старту

✅ Schema проверена (`backend/prisma/schema.prisma`)
✅ Зависимости определены (`imapflow`, `mailparser` нужно добавить)
✅ Фикстуры доступны (3 xlsx уже в `/project`)
✅ Креды получены (Gmail App Password в docx)
✅ Permissions распределены по 5 ролям

> Рекомендуемый порядок старта: **Phase 1 (схема + миграция + seed) → Phase 2 (parser + IMAP)**.
> Каждая фаза заканчивается рабочим коммитом в ветку `artisom`.
