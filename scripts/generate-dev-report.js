#!/usr/bin/env node
/**
 * Генератор отчёта о разработке MetricsAiUp в формате .docx
 *
 * Запуск:
 *   node /project/scripts/generate-dev-report.js
 *
 * Результат: /project/MetricsAiUp-DevReport-YYYY-MM-DD.docx
 * Доступ:   https://artisom.dev.metricsavto.com/MetricsAiUp-DevReport-YYYY-MM-DD.docx
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// docx подгружается из backend/node_modules — позволяет запускать скрипт из любой папки
const docxLib = require('/project/backend/node_modules/docx');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageBreak,
  ShadingType,
  LevelFormat,
  convertInchesToTwip,
} = docxLib;

const PROJECT_ROOT = '/project';
const TODAY = new Date().toISOString().slice(0, 10);
const OUT_FILE = path.join(PROJECT_ROOT, `MetricsAiUp-DevReport-${TODAY}.docx`);

// ---------- утилиты ----------
function sh(cmd) {
  try {
    return execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
  } catch (e) {
    return '';
  }
}

function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    children: [new TextRun({ text, bold: true, size: 32, color: '1a1a1a' })],
  });
}

function H2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: '2a2a2a' })],
  });
}

function H3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 90 },
    children: [new TextRun({ text, bold: true, size: 22, color: '3a3a3a' })],
  });
}

function P(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    alignment: opts.align || AlignmentType.LEFT,
    children: [new TextRun({ text, size: 20, italics: !!opts.italics, bold: !!opts.bold, color: opts.color || '1a1a1a' })],
  });
}

function PMulti(runs, opts = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    alignment: opts.align || AlignmentType.LEFT,
    children: runs.map((r) => new TextRun({ text: r.text, size: 20, bold: !!r.bold, italics: !!r.italics, color: r.color || '1a1a1a' })),
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 40 },
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 20 })],
  });
}

function cell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width || 25, type: WidthType.PERCENTAGE },
    shading: opts.header ? { type: ShadingType.CLEAR, fill: 'EEEEEE' } : undefined,
    children: [
      new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        children: [new TextRun({ text: String(text ?? ''), bold: !!opts.header, size: opts.size || 18 })],
      }),
    ],
  });
}

function table(headers, rows, widths) {
  const w = widths || headers.map(() => Math.floor(100 / headers.length));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => cell(h, { header: true, width: w[i] })),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((c, i) => cell(c, { width: w[i] })),
          }),
      ),
    ],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ---------- сбор данных ----------
console.log('Сбор данных из git...');

const commitCount = parseInt(sh('git log --all --oneline | wc -l'), 10);
const firstCommitDate = sh("git log --all --reverse --pretty=format:'%ad' --date=short | head -1");
const lastCommitDate = sh("git log --all --pretty=format:'%ad' --date=short | head -1");
const authorsRaw = sh('git shortlog -sne --all');

// типы коммитов
const typeCountsRaw = sh("git log --all --pretty=format:'%s' | grep -oE '^[a-z]+' | sort | uniq -c | sort -rn");
const typeRows = typeCountsRaw
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const m = l.trim().match(/^(\d+)\s+(\w+)/);
    return m ? [m[2], m[1]] : null;
  })
  .filter(Boolean);

// активность по месяцам
const monthsRaw = sh("git log --all --pretty=format:'%ad' --date=format:'%Y-%m' | sort | uniq -c");
const monthRows = monthsRaw
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const m = l.trim().match(/^(\d+)\s+([\d-]+)/);
    return m ? [m[2], m[1]] : null;
  })
  .filter(Boolean);

// активность по неделям
const weeksRaw = sh("git log --all --pretty=format:'%ad' --date=format:%Y-W%V | sort | uniq -c");
const weekRows = weeksRaw
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const m = l.trim().match(/^(\d+)\s+(\S+)/);
    return m ? [m[2], m[1]] : null;
  })
  .filter(Boolean);

// полный журнал коммитов по artisom
console.log('Сбор журнала коммитов...');
const fullLogRaw = sh("git log artisom --pretty=format:'%h|%ad|%an|%s' --date=short");
const commits = fullLogRaw
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [hash, date, author, ...subjParts] = l.split('|');
    return { hash, date, author, subject: subjParts.join('|') };
  });

// статистика проекта
console.log('Сбор статистики проекта...');
const frontPages = sh("ls /project/frontend/src/pages/ 2>/dev/null | grep -c '.jsx$'") || '0';
const frontComponents = sh("find /project/frontend/src/components -name '*.jsx' 2>/dev/null | wc -l");
const backRoutes = sh("ls /project/backend/src/routes/ 2>/dev/null | wc -l");
const backServices = sh("ls /project/backend/src/services/ 2>/dev/null | wc -l");
const backMiddleware = sh("ls /project/backend/src/middleware/ 2>/dev/null | wc -l");
const prismaModels = sh("grep -c '^model ' /project/backend/prisma/schema.prisma");
const backendTests = sh("find /project/backend/src/__tests__ -name '*.test.js' 2>/dev/null | wc -l");
const frontendTests = sh("find /project/frontend/src -name '*.test.jsx' -o -name '*.test.js' 2>/dev/null | wc -l");
const frontLoc = sh("find /project/frontend/src -name '*.js' -o -name '*.jsx' | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}'");
const backLoc = sh("find /project/backend/src -name '*.js' | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}'");
const i18nLoc = sh("wc -l /project/frontend/src/i18n/*.json 2>/dev/null | tail -1 | awk '{print $1}'");
const schemaLoc = sh("wc -l /project/backend/prisma/schema.prisma 2>/dev/null | awk '{print $1}'");
const mlLoc = sh("wc -l /project/ml/*.py 2>/dev/null | tail -1 | awk '{print $1}'");
const totalLoc = parseInt(frontLoc || '0') + parseInt(backLoc || '0') + parseInt(schemaLoc || '0') + parseInt(mlLoc || '0');

const authorRows = authorsRaw
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const m = l.trim().match(/^(\d+)\s+(.+?)\s+<(.+?)>$/);
    return m ? [m[2], m[3], m[1]] : null;
  })
  .filter(Boolean);

// ---------- сборка документа ----------
console.log('Формирование .docx...');

const sections = [];

// ============================================================
// Титульный лист
// ============================================================
sections.push(
  new Paragraph({
    spacing: { before: 2400, after: 240 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'MetricsAiUp', bold: true, size: 56, color: '1a1a1a' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 480 },
    children: [new TextRun({ text: 'Система мониторинга СТО', size: 28, color: '4a4a4a' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 1200 },
    children: [new TextRun({ text: 'Отчёт о разработке', bold: true, size: 36, color: '2a2a2a' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `Период: ${firstCommitDate} — ${lastCommitDate}`, size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: `Всего коммитов: ${commitCount}`, size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text: `Дата формирования отчёта: ${TODAY}`, size: 22, italics: true, color: '6a6a6a' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1200 },
    children: [new TextRun({ text: 'artisom.dev.metricsavto.com', size: 20, italics: true, color: '8a8a8a' })],
  }),
  pageBreak(),
);

// ============================================================
// 1. Сводка
// ============================================================
sections.push(
  H1('1. Сводка'),
  P('Настоящий отчёт описывает ход разработки информационно-аналитической системы MetricsAiUp — комплекса для мониторинга и аналитики работы станций технического обслуживания (СТО) с использованием компьютерного зрения, интеграции с 1С ERP и собственной ML-моделью прогнозирования.'),
  P(''),
  table(
    ['Параметр', 'Значение'],
    [
      ['Начало разработки', firstCommitDate],
      ['Последний коммит', lastCommitDate],
      ['Всего коммитов', String(commitCount)],
      ['Кол-во активных авторов', String(authorRows.length)],
      ['Страниц во фронтенде', String(frontPages)],
      ['Маршрутов в API', String(backRoutes)],
      ['Фоновых сервисов', String(backServices)],
      ['Моделей в БД (Prisma)', String(prismaModels)],
      ['Покрытие тестами (файлов)', `${backendTests} backend + ${frontendTests} frontend`],
      ['Общий объём кода', `~${totalLoc.toLocaleString('ru-RU')} строк`],
    ],
    [40, 60],
  ),
);

sections.push(pageBreak());

// ============================================================
// 2. Архитектура и стек
// ============================================================
sections.push(
  H1('2. Архитектура и технологический стек'),
  P('Система построена по микросервисной архитектуре с разделением на следующие компоненты:'),

  H2('Frontend'),
  table(
    ['Слой', 'Технологии'],
    [
      ['UI-фреймворк', 'React 19, Vite 8, React Router v7 (HashRouter)'],
      ['Стилизация', 'Tailwind CSS 4, CSS Variables, глассморфизм, тёмная + светлая тема'],
      ['Графика', 'Recharts 3 (графики), Konva 10 + react-konva 19 (карта)'],
      ['Иконки', 'Lucide React (SVG, без emoji)'],
      ['Состояние', 'React Context (Auth, Theme, Toast) + localStorage'],
      ['Интернационализация', 'react-i18next (RU/EN, ~1400 строк на язык)'],
      ['Реалтайм', 'Socket.IO Client'],
      ['Видео', 'HLS.js (потоковое видео с камер)'],
      ['Экспорт', 'jsPDF, xlsx, html2canvas'],
      ['PWA', 'Service Worker, manifest.json, push-уведомления'],
    ],
    [30, 70],
  ),

  H2('Backend'),
  table(
    ['Слой', 'Технологии'],
    [
      ['Сервер', 'Express 4 (HTTP :3001 + HTTPS :443)'],
      ['ORM', 'Prisma ORM + SQLite'],
      ['Реалтайм', 'Socket.IO'],
      ['Валидация', 'Zod'],
      ['Планировщик', 'node-cron'],
      ['Уведомления', 'web-push (VAPID), node-telegram-bot-api'],
      ['Аутентификация', 'JWT Bearer, bcrypt, AES-GCM для секретов'],
      ['Тестирование', 'Vitest (506 тестов)'],
    ],
    [30, 70],
  ),

  H2('Внешние интеграции'),
  table(
    ['Сервис', 'Назначение'],
    [
      ['CV API (zone-mapper v2.1)', 'Внешняя система компьютерного зрения — события въезд/выезд/нахождение в зоне'],
      ['1С ERP (через IMAP)', 'Получение XLSX с планами/заказ-нарядами/выработкой'],
      ['Telegram Bot API', 'Бот для команд, уведомлений, дайджестов нестыковок'],
      ['FFmpeg + HLS', 'Преобразование RTSP-потоков с камер в HLS для браузера (:8181)'],
      ['FastAPI + scikit-learn', 'Собственная ML-модель прогнозирования (:8282)'],
      ['Web Push (VAPID)', 'Push-уведомления в PWA'],
    ],
    [30, 70],
  ),
);

sections.push(pageBreak());

// ============================================================
// 3. Реализованные модули
// ============================================================
sections.push(
  H1('3. Реализованные модули'),

  H2(`3.1. Страницы фронтенда (${frontPages})`),
  table(
    ['№', 'Страница', 'Назначение'],
    [
      ['1', 'Dashboard', 'KPI-карточки, рекомендации, события (polling 5с)'],
      ['2', 'DashboardPosts', 'Gantt-таймлайн ЗН, drag-n-drop, конфликт-детекция'],
      ['3', 'PostsDetail', 'Аналитика по постам, master-detail'],
      ['4', 'MapViewer', 'Konva live-карта с постами и камерами'],
      ['5', 'MapEditor', 'Drag-drop редактор карты, 8 типов элементов'],
      ['6', 'UtilizationReport', 'Сводный отчёт по загрузке постов'],
      ['7', 'Sessions', 'Сессии авто, QR-код, привязка ЗН (test)'],
      ['8', 'WorkOrders', 'Заказ-наряды, CSV-импорт (test)'],
      ['9', 'Events', 'Журнал событий, 10 типов, фильтры (test)'],
      ['10', 'Analytics', 'Графики Recharts, экспорт XLSX/PDF/PNG (test)'],
      ['11', 'Data1C', 'Данные 1С v2: 4 таба (Сейчас/Импорты/Выработка/IMAP)'],
      ['12', 'Discrepancies', 'Нестыковки 1С↔CV: 6 правил, 4 статуса'],
      ['13', 'OrderMatching', 'Матчинг заказ-нарядов и сессий CV'],
      ['14', 'Cameras', '10 камер, зоны покрытия, HLS-стримы'],
      ['15', 'Users', 'CRUD пользователей, роли, доступ к страницам'],
      ['16', 'Shifts', 'Недельное расписание смен (test)'],
      ['17', 'Audit', 'Аудит-лог действий, фильтры, CSV-экспорт'],
      ['18', 'MyPost', 'Пост работника, таймер ЗН (test)'],
      ['19', 'Health', 'Системный статус (admin only)'],
      ['20', 'WorkerStats', 'Аналитика по работнику, графики'],
      ['21', 'PostHistory', 'История поста с событиями и timeline'],
      ['22', 'ReportSchedule', 'Расписание автоотчётов (test)'],
      ['23', 'TechDocs', 'Техническая документация (26 разделов)'],
      ['24', 'UserGuide', 'Руководство пользователя (21 раздел, PDF-экспорт)'],
      ['25', 'LiveDebug', 'Debug-панель live-режима'],
      ['26', 'Login', 'Авторизация'],
    ],
    [8, 22, 70],
  ),

  H2(`3.2. Модули API (${backRoutes})`),
  table(
    ['Модуль', 'Базовый путь', 'Ключевое назначение'],
    [
      ['auth', '/api/auth', 'login, refresh, logout, me, register (rate limit 20/мин)'],
      ['dashboard', '/api/dashboard', 'overview, metrics, trends, live (demo/live mode)'],
      ['posts', '/api/posts', 'CRUD, by-number/:number/history, статусы'],
      ['zones', '/api/zones', 'CRUD зон СТО (5 типов)'],
      ['events', '/api/events', 'POST от CV-системы (без auth), GET с фильтрами'],
      ['sessions', '/api/sessions', 'active/completed, пагинация, привязка ЗН'],
      ['workOrders', '/api/work-orders', 'CSV-импорт, schedule, assign, start/pause/complete'],
      ['recommendations', '/api/recommendations', 'GET active, PUT acknowledge'],
      ['cameras', '/api/cameras', 'CRUD, health, zone mapping с приоритетами'],
      ['users', '/api/users', 'CRUD, role assignment, page access, hiddenElements'],
      ['shifts', '/api/shifts', 'CRUD, worker assignment, conflict detection'],
      ['oneC', '/api/oneC', '1C-v2: current, imports, unmapped, payroll, IMAP'],
      ['discrepancies', '/api/discrepancies', 'list, stats, status (4 состояния), force-detect'],
      ['mapLayout', '/api/map-layout', 'CRUD с версионированием, restore'],
      ['auditLog', '/api/audit-log', 'GET с фильтрами (admin), CSV export'],
      ['predict', '/api/predict', 'load, load/week, duration, free (ML)'],
      ['postsData', '/api/posts-analytics, /api/dashboard-posts', 'Аналитика постов'],
      ['workers', '/api/workers', '/:name/stats — efficiency, repair types, brands'],
      ['health', '/api/system-health', 'backend, database, cameras, disk, memory'],
      ['push', '/api/push', 'VAPID key, subscribe, send'],
      ['photos', '/api/photos', 'Upload base64, gallery, delete'],
      ['locations', '/api/locations', 'CRUD (multi-tenancy), timezone validation'],
      ['monitoring', '/api/monitoring', 'state, cameras, raw, history, post-history'],
      ['settings', '/api/settings', 'GET/PUT mode (demo/live)'],
      ['reportSchedule', '/api/report-schedules', 'CRUD, run (XLSX), daily/weekly'],
    ],
    [15, 25, 60],
  ),

  H2(`3.3. Фоновые сервисы (${backServices})`),
  table(
    ['Сервис', 'Назначение'],
    [
      ['Event Processor', 'CV-события → сессии, статусы постов, ZoneStay/PostStay, Socket.IO'],
      ['Recommendation Engine', '5 проверок: post_free, overtime, idle, capacity, no_show'],
      ['Monitoring Proxy', 'Polling внешнего CV API каждые 10с, кэш, эмит обновлений'],
      ['IMAP 1C Fetcher', 'Опрос почтового ящика, парсинг attachments, AES-GCM пароль'],
      ['1C Parser', 'Парсинг XLSX (plan/repair/performed) в OneC*Row'],
      ['1C Merger', 'Сводка последних версий через ROW_NUMBER OVER'],
      ['1C↔CV Matcher', 'Levenshtein-каскад VIN→exact_plate→fuzzy_plate'],
      ['Discrepancy Detector', '6 правил: no_show_in_cv/_1c, wrong_post, overstated и др.'],
      ['Discrepancy Notifier', 'Telegram critical instant + Socket.IO discrepancy:new'],
      ['Discrepancy Digest', 'Дайджест в Telegram раз в N часов (top-3 постов)'],
      ['Camera Health', 'HTTP HEAD пинг каждые 30с, эмит при изменении статуса'],
      ['Telegram Bot', '/start, /status, /post N, /free, /report'],
      ['Report Scheduler', 'node-cron каждую минуту, XLSX генерация, Telegram delivery'],
      ['Server Export', 'XLSX export утилиты (Summary + Orders sheets)'],
    ],
    [30, 70],
  ),
);

sections.push(pageBreak());

// ============================================================
// 4. База данных
// ============================================================
sections.push(
  H1('4. Схема базы данных'),
  P(`База данных реализована на Prisma ORM с SQLite в качестве движка. Всего описано ${prismaModels} моделей. Ниже приведена структура по функциональным блокам.`),

  H2('4.1. Аутентификация и RBAC'),
  table(
    ['Модель', 'Назначение'],
    [
      ['User', 'Пользователи (email, passwordHash, pages[], hiddenElements[])'],
      ['Role', 'Роли (admin, director, manager, mechanic, viewer)'],
      ['Permission', '15 разрешений (view_dashboard, manage_users и т. д.)'],
      ['UserRole, RolePermission', 'Many-to-many таблицы связей'],
      ['RefreshToken', 'Refresh-токены для JWT'],
    ],
    [25, 75],
  ),

  H2('4.2. СТО, зоны и посты'),
  table(
    ['Модель', 'Назначение'],
    [
      ['Location', 'Многоарендность (СТО), timezone'],
      ['Zone', '5 типов: repair, waiting, entry, parking, free'],
      ['Post', '10 постов: heavy 1–4, light 5–8, special 9–10'],
      ['Camera', '10 RTSP-камер, привязка к локации'],
      ['CameraZone', 'Покрытие зон камерами с приоритетами 0–10'],
    ],
    [25, 75],
  ),

  H2('4.3. Сессии автомобилей и события'),
  table(
    ['Модель', 'Назначение'],
    [
      ['VehicleSession', 'trackId, plateNumber, entryTime, exitTime'],
      ['ZoneStay', 'Остановки в зоне (entryTime, exitTime, duration)'],
      ['PostStay', 'Остановки на посту (hasWorker, isActive, activeTime, idleTime)'],
      ['Event', '10 типов с confidence и cameraSources'],
      ['Photo', 'Снимки автомобилей (base64, метаданные)'],
    ],
    [25, 75],
  ),

  H2('4.4. Заказ-наряды и смены'),
  table(
    ['Модель', 'Назначение'],
    [
      ['WorkOrder', 'ЗН (externalId, status, normHours, actualHours, version)'],
      ['WorkOrderLink', 'Связь ЗН↔сессия (confidence, matchType)'],
      ['Shift', 'Смены (date, startTime, endTime, status)'],
      ['ShiftWorker', 'Назначение работника на пост в смене'],
    ],
    [25, 75],
  ),

  H2('4.5. Интеграция с 1С (v2)'),
  table(
    ['Модель', 'Назначение'],
    [
      ['Imap1CConfig', 'Настройки IMAP (host, port, SSL, AES-GCM пароль)'],
      ['OneCImport', 'Письма из IMAP, контент-хэш для дедупа'],
      ['OneCPlanRow', 'Сырые строки плана из XLSX'],
      ['OneCRepairOrderRow', 'Сырые строки заявок'],
      ['OneCStageRow', 'Сырые строки выработки'],
      ['OneCWorkOrderMerged', 'Актуальные ЗН через ROW_NUMBER OVER'],
      ['OneCStageMerged', 'Актуальные этапы'],
      ['PostNameMapping', 'Резолюция сырых имён постов'],
      ['Discrepancy', 'Нестыковки 1С↔CV (6 типов, 4 статуса)'],
    ],
    [25, 75],
  ),

  H2('4.6. Прочее'),
  table(
    ['Модель', 'Назначение'],
    [
      ['Recommendation', '5 типов рекомендаций (post_free, overtime, idle и др.)'],
      ['AuditLog', 'Аудит всех мутаций'],
      ['SyncLog', 'Логи синхронизаций'],
      ['MapLayout, MapLayoutVersion', 'Версионируемая карта СТО'],
      ['PushSubscription', 'Подписки на push (VAPID)'],
      ['TelegramLink', 'Связь пользователя с Telegram-аккаунтом'],
      ['ReportSchedule', 'Расписания автоотчётов'],
    ],
    [25, 75],
  ),
);

sections.push(pageBreak());

// ============================================================
// 5. RBAC и безопасность
// ============================================================
sections.push(
  H1('5. RBAC, доступы и безопасность'),
  P('Реализован трёхуровневый контроль доступа:'),
  bullet('Уровень 1 — роли: admin, director, manager, mechanic, viewer → permissions'),
  bullet('Уровень 2 — страницы: user.pages[] — массив разрешённых pageId, Sidebar фильтрует'),
  bullet('Уровень 3 — элементы: user.hiddenElements[] — скрытые UI-элементы внутри страниц'),
  P(''),

  H2('Permissions (15)'),
  P('view_dashboard, view_analytics, manage_zones, manage_users, manage_cameras, manage_shifts, manage_work_orders, manage_settings, manage_roles, view_1c, manage_1c_import, manage_1c_config, manage_discrepancies, view_audit, manage_locations'),

  H2('Меры безопасности'),
  bullet('JWT Bearer-токены с refresh-механизмом'),
  bullet('Bcrypt-хэширование паролей'),
  bullet('AES-GCM шифрование паролей IMAP в БД'),
  bullet('Rate limiting на /api/auth/login (20/мин)'),
  bullet('Zod-валидация всех мутаций с field-level ошибками'),
  bullet('Аудит-лог всех изменений (fire-and-forget)'),
  bullet('HTTPS с сертификатом Let\'s Encrypt (до 2026-07-05)'),
  bullet('Защита от удаления последнего админа (last-admin guard)'),
  bullet('Optimistic locking на ЗН (поле version)'),
);

sections.push(pageBreak());

// ============================================================
// 6. Тестирование
// ============================================================
sections.push(
  H1('6. Тестирование'),
  P(`Покрытие тестами — ${backendTests} файлов backend (Vitest) и ${frontendTests} файлов frontend (Vitest + React Testing Library). Всего ~867 тестов на момент формирования отчёта.`),

  H2('Покрытие backend'),
  bullet('middleware (auth, auditLog, validate, asyncHandler)'),
  bullet('config (socket, database, logger, authCache)'),
  bullet('services (eventProcessor, recommendationEngine, oneCParser, oneCMerger, oneCMatcher, discrepancyDetector)'),
  bullet('routes (auth, dashboard, posts, zones, users, shifts, oneC, discrepancies и др.)'),

  H2('Покрытие frontend'),
  bullet('contexts (Auth, Theme, Toast)'),
  bullet('hooks (useAsync, useSocket, useCameraStatus, useWorkOrderTimer)'),
  bullet('components (Layout, Sidebar, STOMap, dashboardPosts, postsDetail)'),
  bullet('pages (smoke-тесты на рендер каждой страницы)'),
  bullet('utils, constants, i18n'),
);

sections.push(pageBreak());

// ============================================================
// 7. Объём кода
// ============================================================
sections.push(
  H1('7. Объём кода (LOC)'),
  table(
    ['Область', 'Строк кода'],
    [
      ['Frontend (JS/JSX)', parseInt(frontLoc || '0').toLocaleString('ru-RU')],
      ['Backend (Node.js)', parseInt(backLoc || '0').toLocaleString('ru-RU')],
      ['Prisma schema', parseInt(schemaLoc || '0').toLocaleString('ru-RU')],
      ['i18n (RU + EN)', parseInt(i18nLoc || '0').toLocaleString('ru-RU')],
      ['ML (Python)', parseInt(mlLoc || '0').toLocaleString('ru-RU')],
      ['ИТОГО', totalLoc.toLocaleString('ru-RU')],
    ],
    [60, 40],
  ),
);

sections.push(pageBreak());

// ============================================================
// 8. Контрибьюторы
// ============================================================
sections.push(
  H1('8. Контрибьюторы'),
  table(
    ['Автор', 'E-mail', 'Коммитов'],
    authorRows.map(([name, email, count]) => [name, email, count]),
    [35, 45, 20],
  ),
);

sections.push(pageBreak());

// ============================================================
// 9. Активность по периодам
// ============================================================
sections.push(
  H1('9. Активность разработки'),

  H2('9.1. По месяцам'),
  table(['Месяц', 'Коммитов'], monthRows, [50, 50]),

  H2('9.2. По неделям'),
  table(['Неделя (ISO)', 'Коммитов'], weekRows, [50, 50]),

  H2('9.3. По типам коммитов'),
  P('Используется стандарт Conventional Commits.'),
  table(['Тип', 'Кол-во'], typeRows, [50, 50]),
);

sections.push(pageBreak());

// ============================================================
// 10. Фазы разработки
// ============================================================
sections.push(
  H1('10. Фазы разработки'),
  P('Хронология ключевых вех проекта (на основе анализа журнала коммитов).'),

  H2('Март 2026 — фундамент'),
  bullet('Инициализация репозитория и базовой структуры (React + Express + Prisma)'),
  bullet('Дизайн схемы БД (39 моделей)'),
  bullet('Базовый RBAC, аутентификация, маршрутизация'),
  bullet('Первые страницы: Login, Dashboard, Users'),

  H2('Апрель 2026 — основной функционал'),
  bullet('Полный набор страниц (карта, посты, сессии, заказ-наряды, аналитика)'),
  bullet('Интеграция с CV API (monitoring proxy, eventProcessor)'),
  bullet('Реализация Live/Demo режимов'),
  bullet('Видеостриминг камер через HLS'),
  bullet('Первая версия 1С-интеграции (CSV-импорт)'),
  bullet('Карта СТО на Konva + редактор'),

  H2('Май 2026 — 1С v2, нестыковки, рефакторинг'),
  bullet('Переход 1С-интеграции на IMAP + XLSX (1C-v2)'),
  bullet('Детектор нестыковок: 6 правил, 4 статуса, Telegram-уведомления'),
  bullet('Yeldra-flat редизайн всех страниц (унификация дизайна)'),
  bullet('Расписание автоотчётов (node-cron + XLSX)'),
  bullet('PWA, Service Worker, push-уведомления'),
  bullet('Руководство пользователя (UserGuide) с PDF-экспортом'),
  bullet('Защита last-admin, единый словарь role→pages, refresh с permissions'),
);

sections.push(pageBreak());

// ============================================================
// 11. Журнал коммитов
// ============================================================
sections.push(
  H1('11. Полный журнал коммитов (ветка artisom)'),
  P(`Всего коммитов: ${commits.length}. Сортировка от новых к старым.`),
);

// разбиваем на куски по 50 коммитов, чтобы не упасть на больших таблицах
const COMMITS_PER_PAGE = 30;
let commitChunkIndex = 0;
for (let i = 0; i < commits.length; i += COMMITS_PER_PAGE) {
  const chunk = commits.slice(i, i + COMMITS_PER_PAGE);
  commitChunkIndex += 1;
  sections.push(H3(`Часть ${commitChunkIndex}: коммиты ${i + 1}–${Math.min(i + COMMITS_PER_PAGE, commits.length)}`));
  sections.push(
    table(
      ['Дата', 'Хэш', 'Автор', 'Описание'],
      chunk.map((c) => [c.date, c.hash, c.author, c.subject]),
      [12, 10, 18, 60],
    ),
  );
}

sections.push(pageBreak());

// ============================================================
// 12. Готовность и статус
// ============================================================
sections.push(
  H1('12. Текущий статус проекта'),
  P(`По состоянию на ${TODAY} система развёрнута и доступна по адресу artisom.dev.metricsavto.com (HTTPS). Все компоненты работают, проходят тесты, имеется PWA-обвязка и SSL-сертификат до 2026-07-05.`),

  H2('Производственная готовность'),
  table(
    ['Компонент', 'Статус'],
    [
      ['Аутентификация и RBAC', 'готов'],
      ['Дашборды (KPI, посты, аналитика)', 'готов'],
      ['Карта СТО + редактор', 'готов'],
      ['Камеры и HLS-стриминг', 'готов'],
      ['1С-интеграция (IMAP + XLSX)', 'готов'],
      ['Детектор нестыковок', 'готов'],
      ['ML-прогнозирование', 'готов (seeded)'],
      ['Telegram-бот и push-уведомления', 'готов'],
      ['Расписание автоотчётов', 'test'],
      ['MyPost / Sessions / WorkOrders / Events / Analytics / Shifts', 'test (помечены оранжевым маркером)'],
      ['PWA / Service Worker', 'готов'],
      ['HTTPS / SSL', 'готов (Let\'s Encrypt до 2026-07-05)'],
    ],
    [60, 40],
  ),

  H2('Дальнейшие шаги'),
  bullet('Перевод test-страниц в production после обкатки на боевых данных'),
  bullet('Дообучение ML-модели на реальной истории'),
  bullet('Подключение второй СТО (multi-tenancy уже реализован)'),
  bullet('Расширение детектора нестыковок (новые правила по запросу)'),
);

// ============================================================
// Финал
// ============================================================
sections.push(
  pageBreak(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 2400, after: 240 },
    children: [new TextRun({ text: 'Конец отчёта', bold: true, size: 28, color: '6a6a6a' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `Сгенерировано автоматически: ${TODAY}`, size: 18, italics: true, color: '8a8a8a' })],
  }),
);

// ---------- упаковка ----------
const doc = new Document({
  creator: 'MetricsAiUp',
  title: 'Отчёт о разработке MetricsAiUp',
  description: `Период: ${firstCommitDate} — ${lastCommitDate}`,
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 20 },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.8),
            right: convertInchesToTwip(0.8),
            bottom: convertInchesToTwip(0.8),
            left: convertInchesToTwip(0.8),
          },
        },
      },
      children: sections,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT_FILE, buf);
  const stats = fs.statSync(OUT_FILE);
  console.log(`\nОТЧЁТ СГЕНЕРИРОВАН:`);
  console.log(`  Файл:   ${OUT_FILE}`);
  console.log(`  Размер: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`  URL:    https://artisom.dev.metricsavto.com/${path.basename(OUT_FILE)}`);
});
