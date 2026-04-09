# MetricsAiUp — Система мониторинга СТО

## Среда
- Docker-контейнер, рабочая директория: `/project`
- **Домен:** `artisom.dev.metricsavto.com`
- Все порты контейнера (80-65535) проброшены 1:1 на VPS
- Node.js 20, Python 3.11, PHP 8.2, Go 1.22, git, curl, wget

## Публичные URL
- **Frontend:** `https://artisom.dev.metricsavto.com/` (Nginx :8080 → VPS проксирует)
- **Backend API:** `https://artisom.dev.metricsavto.com:3001/api/` (Express HTTP)
- **Backend HTTPS:** `https://artisom.dev.metricsavto.com:3444/api/` (Express HTTPS)
- **HLS Streaming:** `https://artisom.dev.metricsavto.com:8181/` (камеры)
- **Любой порт:** `https://artisom.dev.metricsavto.com:{PORT}/`
- WebSocket проксируется через Socket.IO

## Запуск серверов
- **Backend:** `cd /project/backend && node src/index.js` — HTTP :3001 + HTTPS :3444
- **Frontend:** `cd /project/frontend && npm run build && cp -r dist/* /project/` — Nginx раздаёт статику
- **HLS:** `cd /project && node server.js` — RTSP→HLS стриминг :8181
- **НЕ ИСПОЛЬЗОВАТЬ localStorage как fallback** — всегда работать через бэкенд API
- При ошибках API — чинить бэкенд, а не обходить проблему

## Стек
- **Frontend:** React 19 + Vite 8, Tailwind CSS 4, Recharts 3, Konva 10 + react-konva 19, react-i18next (RU/EN), Socket.IO Client, HLS.js, jsPDF, xlsx
- **Backend:** Express 4 + Prisma ORM + SQLite (HTTP :3001 + HTTPS :3444), Socket.IO, Zod, node-cron, web-push, node-telegram-bot-api
- **Роутинг:** HashRouter (React Router v7), lazy-loaded страницы
- **Иконки:** Lucide React (SVG), без emoji
- **Дизайн:** Glassmorphism, тёмная + светлая тема (CSS Variables)
- **Состояние:** React Context (Auth, Theme, Toast) + localStorage
- **PWA:** Service Worker (sw.js), manifest.json, push-уведомления

## Архитектура
```
/project
├── frontend/src/
│   ├── App.jsx              # HashRouter, 20 маршрутов + ProtectedRoute (lazy-loaded)
│   ├── main.jsx             # ThemeProvider → ToastProvider → AuthProvider → AppRoutes
│   ├── components/          # 17 компонентов + подпапки (dashboardPosts/, postsDetail/)
│   │   ├── Layout.jsx       # Sidebar + Header + Outlet
│   │   ├── Sidebar.jsx      # Навигация, фильтрация по user.pages
│   │   ├── STOMap.jsx        # Карта СТО (Konva)
│   │   ├── HelpButton.jsx   # Контекстная справка
│   │   ├── DateRangePicker, DeltaBadge, PostTimer, QRBadge
│   │   ├── LiveSTOWidget, PredictionWidget, SparkLine, WeeklyHeatmap
│   │   ├── PhotoGallery, CameraStreamModal, LocationSwitcher
│   │   ├── NotificationCenter, Skeleton
│   │   └── dashboardPosts/  # GanttTimeline, TimelineRow, WorkOrderModal, ConflictModal, ShiftSettings
│   ├── pages/               # 20 страниц
│   │   ├── Dashboard.jsx     # KPI-карточки, рекомендации, события (polling 5с)
│   │   ├── DashboardPosts.jsx # Gantt-таймлайн ЗН, drag-n-drop, конфликт-детекция (521 LOC)
│   │   ├── PostsDetail.jsx   # Аналитика по постам, master-detail (226 LOC)
│   │   ├── MapViewer.jsx     # Konva live-карта с постами и камерами
│   │   ├── MapEditor.jsx     # Drag-drop редактор карты, 8 типов элементов (1244 LOC)
│   │   ├── Sessions.jsx      # Сессии авто, QR-код, привязка ЗН
│   │   ├── WorkOrders.jsx    # Заказ-наряды, CSV-импорт, start/pause/complete
│   │   ├── Events.jsx        # Журнал событий, 10 типов, фильтры, auto-refresh
│   │   ├── Analytics.jsx     # Графики Recharts, экспорт XLSX/PDF/PNG (655 LOC)
│   │   ├── Data1C.jsx        # Данные 1С: Excel-импорт, sync, export (926 LOC)
│   │   ├── Cameras.jsx       # 10 камер, зоны покрытия, HLS стримы
│   │   ├── CameraMapping.jsx # Маппинг камера↔зона, приоритеты
│   │   ├── Users.jsx         # CRUD пользователей, роли, доступ к страницам
│   │   ├── Shifts.jsx        # Недельное расписание смен, worker assignment
│   │   ├── Audit.jsx         # Аудит-лог действий, фильтры, CSV-экспорт
│   │   ├── MyPost.jsx        # Пост работника, таймер ЗН, play/pause/complete
│   │   ├── Health.jsx        # Системный статус (admin only)
│   │   ├── WorkerStats.jsx   # Аналитика по работнику, графики
│   │   ├── ReportSchedule.jsx # Расписание автоотчётов
│   │   └── Login.jsx         # Авторизация
│   ├── contexts/
│   │   ├── AuthContext.jsx   # Авторизация, API-клиент, permissions, Socket.IO
│   │   ├── ThemeContext.jsx  # Тема dark/light
│   │   └── ToastContext.jsx  # Toast-уведомления (success/error/warning/info)
│   ├── hooks/
│   │   ├── useSocket.js      # usePolling, useSocket, useSubscribe, connectSocket
│   │   ├── useWorkOrderTimer.js # Таймер ЗН с warningLevel
│   │   └── useCameraStatus.js   # Статус камер через Socket.IO
│   ├── utils/
│   │   ├── translate.js      # translateZone(), translatePost()
│   │   └── export.js         # exportToXlsx(), exportToPdf(), downloadChartAsPng()
│   └── i18n/                 # ru.json, en.json (~543 строки, ~512 ключей)
├── backend/
│   ├── src/
│   │   ├── index.js          # Express, HTTP :3001 + HTTPS :3444, Socket.IO, фоновые сервисы
│   │   ├── routes/           # 22 модуля (см. Backend API)
│   │   ├── middleware/       # auth.js, auditLog.js, validate.js (Zod), asyncHandler.js
│   │   ├── services/         # 7 сервисов (см. Backend Services)
│   │   └── config/           # socket.js, database.js (Prisma)
│   └── prisma/               # schema.prisma (22 модели), миграции, seed.js
├── data/                     # 29 JSON файлов (моки/fallback)
├── assets/                   # Vite билд-ассеты
├── server.js                 # HLS-стриминг камер (порт 8181, FFmpeg RTSP→HLS)
├── sw.js                     # Service Worker v11 (network-first, push)
├── manifest.json             # PWA манифест
└── index.html                # Entry point
```

## Backend API — 22 модуля маршрутов (70+ эндпоинтов)

| Модуль | Путь | Ключевые операции |
|--------|------|-------------------|
| auth | `/api/auth` | login, refresh, logout, me, register |
| dashboard | `/api/dashboard` | overview, metrics(?period=24h\|7d\|30d), trends, live |
| posts | `/api/posts` | CRUD, статусы (free/occupied/occupied_no_work/active_work) |
| zones | `/api/zones` | CRUD, типы (repair/waiting/entry/parking/free) |
| events | `/api/events` | POST от CV-системы, GET с фильтрами |
| sessions | `/api/sessions` | active/completed, связь с ZoneStay/PostStay |
| workOrders | `/api/work-orders` | CSV-импорт, schedule (версионирование), start/pause/resume/complete |
| recommendations | `/api/recommendations` | GET active, PUT acknowledge |
| cameras | `/api/cameras` | CRUD, health, zone mapping с приоритетами |
| users | `/api/users` | CRUD, role assignment, page access |
| shifts | `/api/shifts` | CRUD, worker assignment, conflict detection, complete |
| data1c | `/api/1c` | import XLSX, export XLSX, sync-history, planning/workers/stats |
| mapLayout | `/api/map-layout` | CRUD с версионированием, restore |
| auditLog | `/api/audit-log` | GET с фильтрами, CSV export |
| predict | `/api/predict` | load, load/week, duration, free, health |
| postsData | `/api/posts-analytics`, `/api/dashboard-posts`, `/api/analytics-history` | Аналитика постов |
| workers | `/api/workers` | Список, stats с daily breakdown |
| health | `/api/system-health` | backend, database, cameras, disk status |
| push | `/api/push` | VAPID key, subscribe, send |
| photos | `/api/photos` | Upload base64, gallery, delete |
| locations | `/api/locations` | CRUD (multi-tenancy) |
| reportSchedule | `/api/report-schedules` | CRUD, run (generate XLSX) |

## Backend Services (фоновые)

| Сервис | Файл | Что делает |
|--------|------|-----------|
| Event Processor | eventProcessor.js | Обработка CV-событий → сессии, статусы постов, Socket.IO |
| Recommendation Engine | recommendationEngine.js | 5 проверок: post_free (>30мин), overtime (>120%), idle (>15мин), capacity, no_show |
| 1C Sync | sync1C.js | File watcher `/data/1c-import/`, парсинг XLSX, JSON-генерация |
| Camera Health | cameraHealthCheck.js | Пинг каждые 30с, Socket.IO emit |
| Telegram Bot | telegramBot.js | /start, /status, /post N, /free, /report |
| Report Scheduler | reportScheduler.js | node-cron, XLSX генерация, Telegram delivery |
| Server Export | serverExport.js | XLSX export утилиты |

## Middleware

| Файл | Назначение |
|------|-----------|
| auth.js | JWT верификация (Bearer), requirePermission(...keys) |
| auditLog.js | Логирование мутаций (create/update/delete) с old/new data |
| validate.js | Zod-валидация request body |
| asyncHandler.js | Обёртка async handlers, Prisma P2025 errors |

## База данных — Prisma + SQLite (22 модели)

**RBAC:** User → UserRole → Role → RolePermission → Permission
- 15 permissions: view_dashboard, view_analytics, manage_zones, manage_users, manage_cameras и др.
- 5 ролей: admin (все), director (view), manager (dashboard+WO), mechanic (посты), viewer (dashboard)

**Зоны/Посты:** Zone (5 зон) → Post (10 постов: heavy 1-4, light 5-8, special 9-10)

**Камеры:** Camera (10 RTSP) → CameraZone (приоритеты 0-10)

**Сессии:** VehicleSession → ZoneStay, PostStay (hasWorker, isActive, activeTime, idleTime)

**Заказ-наряды:** WorkOrder (externalId, status, normHours, version для конфликтов) → WorkOrderLink

**Смены:** Shift → ShiftWorker (name, role, postId)

**Прочее:** Event (10 типов, confidence, cameraSources), Recommendation, AuditLog, SyncLog, MapLayout → MapLayoutVersion, Photo, PushSubscription, TelegramLink, ReportSchedule, Location

## Socket.IO Events

**Клиент → Сервер:** subscribe:zone, subscribe:post, subscribe:all
**Сервер → Клиент:** post:status_changed, schedule:updated, workOrder:started/completed, camera:status, recommendation, event, zone:update, post:update

## Data Flow

Все страницы загружают данные через `api.get()` из AuthContext → запросы идут на backend `/api/*`.
Backend отдаёт данные из Prisma/SQLite. JSON-моки в `/data/` используются только как fallback при недоступности backend.

**Fallback-цепочка:** Backend API → JSON моки в `/data/` → localStorage (только users, camera mapping)

## localStorage ключи
| Ключ | Что хранит | Где используется |
|------|------------|------------------|
| `token` | JWT-токен | AuthContext |
| `currentUser` | Объект текущего пользователя | AuthContext |
| `language` | `ru` / `en` | i18n |
| `theme` | `dark` / `light` | ThemeContext |
| `dashboardPostsSettings` | Настройки таймлайна | DashboardPosts |
| `dashboardPostsSchedule` | Локальный кэш расписания | DashboardPosts |
| `cameraMappingData` | Маппинг камер по зонам | CameraMapping |

## RBAC — Система доступа
- **Роли:** admin, director, manager, mechanic, viewer
- **Доступ к страницам:** массив `pages` у пользователя
- **Sidebar** фильтрует по `user.pages.includes(pageId)` (admin видит всё)
- **Middleware:** `requirePermission('manage_users')` на backend
- **Frontend:** `hasPermission(key)` из AuthContext

## Карта СТО
- **MapViewer:** live-карта на Konva, постоянно обновляется (polling/Socket.IO)
- **MapEditor:** drag-drop редактор, 8 типов элементов (building, post, zone, camera, door, wall, label, infozone)
- **Размер:** 46540x30690mm, snap-to-grid 10px
- **Версионирование:** сохранение в БД, история версий, restore

## 1С Интеграция
- **Import:** XLSX через drag-n-drop или file watcher (`/data/1c-import/`)
- **Export:** XLSX генерация с фильтрами
- **Sync Log:** история операций в БД
- **3 JSON файла:** 1c-planning.json, 1c-workers.json, 1c-stats.json

## Билд и деплой
```bash
cd /project/frontend && npm run build && cp -r dist/* /project/
```
Nginx раздаёт из `/project/`. После билда — бампить `CACHE_NAME` в `sw.js`.

## Правила
- **НЕ делать git commit и git push без прямой команды пользователя**
- **Данные ТОЛЬКО через БД (Prisma/SQLite)**, не редактировать JSON-моки напрямую
- **НЕ ИСПОЛЬЗОВАТЬ localStorage как fallback** — чинить бэкенд
- **Менять ТОЛЬКО то, что просят** — не трогать лишние файлы и БД
- Все файлы только в `/project`
- Dev server на `0.0.0.0`
- i18n: все тексты через `t('key')`, оба языка (ru.json + en.json, ~512 ключей)
- Иконки: только Lucide React, без emoji
- После каждого билда фронта — бампить CACHE_NAME в sw.js

## Nginx (/etc/nginx/sites-enabled/default)
- **Нет прав записи** (owner: root)
- `/api/*` → proxy на backend (3001 → 3000 → 3002 fallback)
- `/socket.io/` → WebSocket proxy
- `/cam-api/*` → proxy на HLS сервер :8181
- `/hls/*` → статика `/project/hls/` с CORS
- `/` → SPA fallback (`try_files $uri $uri/ /index.html`)

## SSL/HTTPS
- **Сертификат:** `/project/.ssl/fullchain.pem`
- **Ключ:** `/project/.ssl/privkey.pem`
- **Домен:** `artisom.dev.metricsavto.com`
- **Истекает:** 2026-07-05

## Seed-пользователи
| Email | Роль | Имя |
|-------|------|-----|
| admin@metricsai.up | admin | Admin MetricsAI |
| demo@metricsai.up | manager | Генри Форд |
| manager@metricsai.up | manager | Сергей Петров |
| mechanic@metricsai.up | mechanic | Иван Козлов (неактивен) |

## Крупные файлы
- `MapEditor.jsx` — 1244 LOC
- `Data1C.jsx` — 926 LOC
- `Analytics.jsx` — 655 LOC
- `DashboardPosts.jsx` — 521 LOC
- `CameraMapping.jsx` — 312 LOC
