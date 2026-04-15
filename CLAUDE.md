# MetricsAiUp — Система мониторинга СТО

## Среда
- Docker-контейнер, рабочая директория: `/project`
- **Домен:** `artisom.dev.metricsavto.com`
- Все порты контейнера (80-65535) проброшены 1:1 на VPS через WireGuard
- Node.js 20, Python 3.11, git, curl, wget

## Публичные URL
| URL | Назначение |
|-----|-----------|
| `https://artisom.dev.metricsavto.com/` | Frontend + API (HTTPS :443) |
| `http://artisom.dev.metricsavto.com:3001/api/` | Backend API (HTTP :3001) |
| `https://artisom.dev.metricsavto.com/api/` | Backend API (HTTPS :443) |
| `https://artisom.dev.metricsavto.com:8181/` | HLS-стриминг камер |
| WebSocket | Socket.IO через `/socket.io/` |

## Запуск серверов
```bash
# Backend (HTTP :3001 + HTTPS :443 — фронт + API)
cd /project/backend && node src/index.js

# Frontend (билд → Express раздаёт статику напрямую)
cd /project/frontend && npm run build && cp -r dist/* /project/

# HLS-стриминг камер (:8181)
cd /project && node server.js
```

## Стек
| Слой | Технологии |
|------|-----------|
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, Recharts 3, Konva 10 + react-konva 19, react-i18next (RU/EN), Socket.IO Client, HLS.js, jsPDF, xlsx |
| **Backend** | Express 4, Prisma ORM + SQLite, Socket.IO, Zod, node-cron, web-push, node-telegram-bot-api |
| **Роутинг** | HashRouter (React Router v7), lazy-loaded страницы |
| **Дизайн** | Glassmorphism, тёмная + светлая тема (CSS Variables), Lucide React (SVG-иконки, без emoji) |
| **Состояние** | React Context (Auth, Theme, Toast) + localStorage |
| **PWA** | Service Worker (`sw.js` v23), manifest.json, push-уведомления |
| **ML** | FastAPI + scikit-learn (predict_api.py :8282) |
| **Тесты** | Vitest, React Testing Library, jsdom |

## Архитектура
```
/project
├── frontend/src/
│   ├── App.jsx                 # HashRouter, 23 маршрута + ProtectedRoute (lazy-loaded)
│   ├── main.jsx                # ThemeProvider → ToastProvider → AuthProvider → AppRoutes
│   ├── components/             # 19 корневых + dashboardPosts/ (9) + postsDetail/ (4)
│   ├── pages/                  # 23 страницы
│   ├── contexts/               # AuthContext, ThemeContext, ToastContext
│   ├── hooks/                  # useAsync, useSocket, useCameraStatus, useWorkOrderTimer
│   ├── utils/                  # translate.js, export.js
│   ├── constants/              # index.js, mapTheme.js
│   └── i18n/                   # ru.json, en.json (~613 строк)
├── backend/
│   ├── src/
│   │   ├── index.js            # Express, HTTP :3001 + HTTPS :3444, Socket.IO, фоновые сервисы
│   │   ├── routes/             # 24 модуля маршрутов (70+ эндпоинтов)
│   │   ├── middleware/         # auth.js, auditLog.js, validate.js, asyncHandler.js
│   │   ├── services/           # 8 сервисов (фоновые)
│   │   └── config/             # socket.js, database.js, logger.js, authCache.js
│   └── prisma/                 # schema.prisma (27 моделей), миграции, seed.js
├── ml/                         # predict_api.py — FastAPI ML-сервис (:8282)
├── data/                       # 28 JSON файлов (моки/fallback)
├── server.js                   # HLS-стриминг камер (FFmpeg RTSP→HLS :8181)
├── sw.js                       # Service Worker v23 (network-first, push)
├── manifest.json               # PWA манифест
└── index.html                  # Entry point (SPA)
```

## Frontend — 23 страницы

| Страница | Файл | Описание |
|----------|------|----------|
| Dashboard | Dashboard.jsx | KPI-карточки, рекомендации, события (polling 5с) |
| DashboardPosts | DashboardPosts.jsx (510) | Gantt-таймлайн ЗН, drag-n-drop, конфликт-детекция |
| PostsDetail | PostsDetail.jsx | Аналитика по постам, master-detail |
| MapViewer | MapViewer.jsx (1442) | Konva live-карта с постами и камерами |
| MapEditor | MapEditor.jsx (1245) | Drag-drop редактор карты, 8 типов элементов |
| Sessions | Sessions.jsx (434) | Сессии авто, QR-код, привязка ЗН |
| WorkOrders | WorkOrders.jsx | Заказ-наряды, CSV-импорт, start/pause/complete |
| Events | Events.jsx (297) | Журнал событий, 10 типов, фильтры, auto-refresh |
| Analytics | Analytics.jsx (668) | Графики Recharts, экспорт XLSX/PDF/PNG |
| Data1C | Data1C.jsx (900) | Данные 1С: Excel-импорт, sync, export |
| Cameras | Cameras.jsx | 10 камер, зоны покрытия, HLS стримы |
| CameraMapping | CameraMapping.jsx (328) | Маппинг камера↔зона, приоритеты |
| Users | Users.jsx | CRUD пользователей, роли, доступ к страницам |
| Shifts | Shifts.jsx | Недельное расписание смен, worker assignment |
| Audit | Audit.jsx | Аудит-лог действий, фильтры, CSV-экспорт |
| MyPost | MyPost.jsx | Пост работника, таймер ЗН, play/pause/complete |
| Health | Health.jsx | Системный статус (admin only) |
| WorkerStats | WorkerStats.jsx | Аналитика по работнику, графики |
| PostHistory | PostHistory.jsx | История поста с событиями и timeline |
| ReportSchedule | ReportSchedule.jsx | Расписание автоотчётов |
| TechDocs | TechDocs.jsx | Техническая документация (26 разделов) |
| LiveDebug | LiveDebug.jsx | Debug-панель live-режима |
| Login | Login.jsx | Авторизация |

## Frontend — Компоненты

**Корневые (19):** Layout, Sidebar, STOMap (510 LOC), HelpButton, ErrorBoundary, NotificationCenter, CameraStreamModal, LiveSTOWidget, PredictionWidget, PostTimer, Pagination, DateRangePicker, DeltaBadge, SparkLine, WeeklyHeatmap, PhotoGallery, QRBadge, LocationSwitcher, Skeleton

**dashboardPosts/ (9):** GanttTimeline, TimelineRow, TimelineHeader, WorkOrderModal, ConflictModal, ShiftSettings, FreeWorkOrdersTable, Legend, constants.js

**postsDetail/ (4):** PostDetailPanel (756 LOC), PostTableView, PostCardsView, CollapsibleSection

## Frontend — Contexts, Hooks, Utils

| Модуль | Файл | Назначение |
|--------|------|-----------|
| **AuthContext** | contexts/AuthContext.jsx | Авторизация, API-клиент (get/post/put/delete), permissions, Socket.IO, appMode (demo/live), isElementVisible() |
| **ThemeContext** | contexts/ThemeContext.jsx | Тема dark/light, CSS класс `.dark` |
| **ToastContext** | contexts/ToastContext.jsx | Toast-уведомления (success/error/warning/info), макс. 3 |
| **useAsync** | hooks/useAsync.js | Универсальный data-fetching хук (data, loading, error, refetch) |
| **useSocket** | hooks/useSocket.js | Socket.IO singleton, usePolling, useSubscribe, useSocketStatus |
| **useCameraStatus** | hooks/useCameraStatus.js | Статус камер (online/offline) через API + Socket.IO |
| **useWorkOrderTimer** | hooks/useWorkOrderTimer.js | Таймер ЗН: elapsed, percentUsed, warningLevel, start/pause/resume/complete |
| **translate.js** | utils/translate.js | translateZone(), translatePost(), translateWorksDesc() |
| **export.js** | utils/export.js | exportToXlsx(), exportToPdf(), downloadChartAsPng() |

## Backend API — 24 модуля маршрутов (70+ эндпоинтов)

| Модуль | Путь | Ключевые операции |
|--------|------|-------------------|
| auth | `/api/auth` | login (rate limit 20/мин), refresh, logout, me, register |
| dashboard | `/api/dashboard` | overview, metrics(?period=24h\|7d\|30d), trends, live (demo/live mode) |
| posts | `/api/posts` | CRUD, by-number/:number/history, статусы (free/occupied/occupied_no_work/active_work) |
| zones | `/api/zones` | CRUD, типы (repair/waiting/entry/parking/free) |
| events | `/api/events` | POST от CV-системы (без auth), GET с фильтрами |
| sessions | `/api/sessions` | active/completed, пагинация, ZoneStay/PostStay/WorkOrderLinks |
| workOrders | `/api/work-orders` | CSV-импорт, schedule (version conflict 409), assign, start/pause/resume/complete |
| recommendations | `/api/recommendations` | GET active, PUT acknowledge |
| cameras | `/api/cameras` | CRUD, health, zone mapping с приоритетами (0-10) |
| users | `/api/users` | CRUD, role assignment, page access, hiddenElements |
| shifts | `/api/shifts` | CRUD, worker assignment, conflict detection, complete (handover) |
| data1c | `/api/1c` | import XLSX (auto-detect planning/workers), export XLSX, sync-history, planning/workers/stats |
| mapLayout | `/api/map-layout` | CRUD с версионированием, restore, public GET |
| auditLog | `/api/audit-log` | GET с фильтрами (admin), CSV export |
| predict | `/api/predict` | load, load/week, duration, free, health (seeded random) |
| postsData | `/api/posts-analytics`, `/api/dashboard-posts`, `/api/analytics-history`, `/api/work-orders-crud` | Аналитика постов |
| workers | `/api/workers` | Список, /:name/stats (efficiency, repair types, brands, daily) |
| health | `/api/system-health` | backend, database, cameras, disk, memory |
| push | `/api/push` | VAPID key, subscribe (upsert), send (broadcast/user) |
| photos | `/api/photos` | Upload base64, gallery, delete |
| locations | `/api/locations` | CRUD (multi-tenancy), timezone validation |
| monitoring | `/api/monitoring` | state, cameras, raw, history, zone-history, post-history, full-history, health |
| settings | `/api/settings` | GET/PUT mode (demo/live), triggers demo generator / monitoring proxy |
| reportSchedule | `/api/report-schedules` | CRUD, run (generate XLSX), daily/weekly frequency |

## Backend Services (8 фоновых)

| Сервис | Файл | Что делает |
|--------|------|-----------|
| Event Processor | eventProcessor.js | CV-события → сессии, статусы постов, ZoneStay/PostStay, Socket.IO |
| Recommendation Engine | recommendationEngine.js | 5 проверок: post_free (>30мин), overtime (>120%), idle (>15мин), capacity (>50%), no_show (>30мин) |
| Monitoring Proxy | monitoringProxy.js | Polling внешнего CV API каждые 10с, кэш, Socket.IO emit при изменениях |
| 1C Sync | sync1C.js | File watcher `/data/1c-import/` каждые 5 мин, XLSX парсинг, JSON-генерация, дедупликация |
| Camera Health | cameraHealthCheck.js | HTTP HEAD пинг каждые 30с, Socket.IO emit при изменении статуса |
| Telegram Bot | telegramBot.js | /start, /status, /post N, /free, /report |
| Report Scheduler | reportScheduler.js | node-cron каждую минуту, XLSX генерация, Telegram delivery |
| Server Export | serverExport.js | XLSX export утилиты (Summary + Orders sheets) |

## Middleware

| Файл | Назначение |
|------|-----------|
| auth.js | JWT Bearer, buildReqUser() (permissions, pages, hiddenElements), requirePermission(...keys), authCache (15 мин TTL) |
| auditLog.js | Fire-and-forget логирование мутаций (200-299), captureOldData() для update/delete |
| validate.js | Zod-валидация req.body → 400 с field-level details |
| asyncHandler.js | Обёртка async handlers, Prisma P2025 → 404 |

## База данных — Prisma + SQLite (27 моделей)

**RBAC:** User → UserRole → Role → RolePermission → Permission
- 15 permissions: view_dashboard, view_analytics, manage_zones, manage_users, manage_cameras, manage_shifts, manage_work_orders, manage_settings, manage_roles и др.
- 5 ролей: admin (все страницы), director (view), manager (dashboard+WO+shifts), mechanic (посты), viewer (dashboard)

**Зоны/Посты:** Zone (5 типов) → Post (10 постов: heavy 1-4, light 5-8, special 9-10, статусы: free/occupied/occupied_no_work/active_work)

**Камеры:** Camera (10 RTSP) → CameraZone (приоритеты 0-10)

**Сессии:** VehicleSession (trackId, plateNumber) → ZoneStay (entryTime, exitTime, duration), PostStay (hasWorker, isActive, activeTime, idleTime)

**Заказ-наряды:** WorkOrder (externalId, status, normHours, actualHours, version для optimistic locking) → WorkOrderLink (confidence, matchType)

**Смены:** Shift (date, startTime, endTime, status) → ShiftWorker (name, role, postId)

**Прочее:** Event (10 типов, confidence, cameraSources), Recommendation (5 типов), AuditLog, SyncLog, MapLayout → MapLayoutVersion, Photo, PushSubscription, TelegramLink, ReportSchedule, Location

## Dual Mode — Demo / Live

| | Demo | Live |
|---|------|------|
| **Данные** | Генерируются каждые 2 мин (generateDemoData.js) | Polling внешнего CV API каждые 10с (monitoringProxy.js) |
| **Dashboard /live** | Из БД (Prisma) | Из кэша monitoring proxy |
| **Posts analytics** | Из БД (seeded random) | Из внешнего API с историей |
| **Переключение** | PUT /api/settings { mode: 'live' } | PUT /api/settings { mode: 'demo' } |

## Socket.IO Events

**Клиент → Сервер:** subscribe:zone, subscribe:post, subscribe:all
**Сервер → Клиент:** post:status_changed, schedule:updated, workOrder:started/completed, camera:status, recommendation, event, zone:update, post:update, settings:changed

## Data Flow

```
CV-система → POST /api/events → eventProcessor → DB + Socket.IO → Frontend
1С ERP     → XLSX → sync1C (file watcher) → JSON → /api/1c/* → Frontend
ML         → /api/predict/* → FastAPI :8282 → Frontend (PredictionWidget)
Камеры     → RTSP → FFmpeg → HLS :8181 → CameraStreamModal (hls.js)
Frontend   → api.get/post/put/delete → Backend /api/* → Prisma/SQLite
```

**Fallback-цепочка:** Backend API → JSON моки в `/data/` → localStorage (только token, user, theme, language)

## RBAC — 3 уровня доступа
1. **Роли** (admin, director, manager, mechanic, viewer) → permissions
2. **Страницы** (user.pages[] — массив разрешённых pageId, Sidebar фильтрует)
3. **Элементы** (user.hiddenElements[] — скрытые UI-элементы, isElementVisible())

**Backend:** `authenticate` → `requirePermission('manage_users')`
**Frontend:** `hasPermission(key)`, `isElementVisible(pageId, elementId)` из AuthContext

## Тестирование

```bash
# Backend (Vitest, 35 файлов, 506 тестов)
cd /project/backend && npm test

# Frontend (Vitest + React Testing Library, 45 файлов, 361 тест)
cd /project/frontend && npm test
```

**Покрытие:** middleware (4), config (2), services (2), routes (20+7 existing), contexts (3), hooks (4), components (14+4+2), pages (23 smoke), utils, constants, i18n

## localStorage ключи
| Ключ | Что хранит | Модуль |
|------|------------|--------|
| `token` | JWT-токен | AuthContext |
| `currentUser` | Объект пользователя | AuthContext |
| `language` | `ru` / `en` | i18n |
| `theme` | `dark` / `light` | ThemeContext |
| `appMode` | `demo` / `live` | AuthContext |
| `dashboardPostsSettings` | Настройки таймлайна | DashboardPosts |
| `dashboardPostsSchedule` | Кэш расписания | DashboardPosts |

## Билд и деплой
```bash
cd /project/frontend && npm run build && cp -r dist/* /project/
# После билда — бампить CACHE_NAME в sw.js (текущий: metricsaiup-v23)
```

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

## КРИТИЧНО — НЕТ ПРОКСИ

**НИКОГДА не используй Nginx, https-proxy, reverse proxy или любые прокси-сервера внутри этого контейнера!**
- Express backend на :3001 раздаёт и API, и фронтенд напрямую
- HTTPS через встроенный https.createServer на :443
- HLS-стриминг на :8181 напрямую через node server.js
- Все порты проброшены 1:1 на VPS через WireGuard — прокси НЕ НУЖНЫ
- Не запускать `nginx`, не создавать nginx конфиги, не писать proxy-скрипты
- НЕ слушать порт 8080 — он не нужен
- Порты: 443 (HTTPS фронт+API), 3001 (HTTP фронт+API), 8181 (HLS камеры)

## Правила
- **НЕ делать git commit и git push без прямой команды пользователя**
- **Данные ТОЛЬКО через БД (Prisma/SQLite)**, не редактировать JSON-моки напрямую
- **НЕ ИСПОЛЬЗОВАТЬ localStorage как fallback** — чинить бэкенд
- **Менять ТОЛЬКО то, что просят** — не трогать лишние файлы и БД
- В live-режиме не скрывать страницы, а убирать demo-данные
- Все файлы только в `/project`, dev server на `0.0.0.0`
- i18n: все тексты через `t('key')`, оба языка (ru.json + en.json)
- Иконки: только Lucide React, без emoji
- После каждого билда фронта — бампить CACHE_NAME в sw.js
- Метрики: status — главный сигнал, worksInProgress при free — погрешность
