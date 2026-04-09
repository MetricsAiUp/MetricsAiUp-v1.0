# MetricsAiUp — Техническая документация

> Версия документации: 1.0  
> Дата создания: 2026-04-09  
> Проект: Система мониторинга автосервиса (СТО)

---

## Содержание

1. [Обзор системы](#1-обзор-системы)
2. [Архитектура](#2-архитектура)
3. [Инфраструктура и деплой](#3-инфраструктура-и-деплой)
4. [База данных](#4-база-данных)
5. [Backend API](#5-backend-api)
6. [Backend Services](#6-backend-services)
7. [Middleware](#7-middleware)
8. [Socket.IO](#8-socketio)
9. [Frontend — Страницы](#9-frontend--страницы)
10. [Frontend — Компоненты](#10-frontend--компоненты)
11. [Frontend — Контексты](#11-frontend--контексты)
12. [Frontend — Хуки](#12-frontend--хуки)
13. [Frontend — Утилиты](#13-frontend--утилиты)
14. [RBAC — Система доступа](#14-rbac--система-доступа)
15. [Интернационализация (i18n)](#15-интернационализация-i18n)
16. [PWA и Service Worker](#16-pwa-и-service-worker)
17. [HLS Видеостриминг](#17-hls-видеостриминг)
18. [Интеграция с 1С](#18-интеграция-с-1с)
19. [Тестирование](#19-тестирование)
20. [Физическая карта СТО](#20-физическая-карта-сто)
21. [Зависимости проекта](#21-зависимости-проекта)
22. [Переменные окружения](#22-переменные-окружения)
23. [Seed-данные](#23-seed-данные)

---

## 1. Обзор системы

**MetricsAiUp** — система мониторинга автосервиса (СТО), обеспечивающая:

- Real-time отслеживание автомобилей на территории СТО через CV-систему и камеры
- Управление заказ-нарядами с Gantt-таймлайном и drag-n-drop
- Аналитику загрузки постов, эффективности работников, метрик обслуживания
- Интеграцию с 1С Альфа-Авто (импорт/экспорт XLSX)
- Видеонаблюдение через 10 RTSP-камер с HLS-стримингом
- AI-рекомендации по оптимизации загрузки
- Push-уведомления и Telegram-бот
- PWA с offline-поддержкой

### Стек технологий

| Слой | Технологии |
|------|-----------|
| **Frontend** | React 19.2, Vite 8, Tailwind CSS 4, Recharts 3, Konva 10, react-i18next, Socket.IO Client, HLS.js, jsPDF, xlsx |
| **Backend** | Express 4, Prisma ORM, SQLite, Socket.IO 4, Zod, node-cron, web-push, node-telegram-bot-api |
| **Стриминг** | FFmpeg (RTSP → HLS), Node.js HTTPS сервер |
| **Инфраструктура** | Nginx reverse proxy, Let's Encrypt SSL, Docker-контейнер |
| **Тестирование** | Vitest, React Testing Library, jsdom |

---

## 2. Архитектура

### Структура проекта

```
/project
├── frontend/src/
│   ├── App.jsx              # HashRouter, 20 маршрутов, lazy-loaded
│   ├── main.jsx             # ThemeProvider → ToastProvider → AuthProvider → AppRoutes
│   ├── components/          # 17 компонентов + подпапки
│   │   ├── Layout.jsx       # Sidebar + Header + Outlet
│   │   ├── Sidebar.jsx      # Навигация, фильтрация по user.pages
│   │   ├── STOMap.jsx        # Карта СТО (Konva)
│   │   ├── HelpButton.jsx   # Контекстная справка
│   │   ├── DateRangePicker.jsx, DeltaBadge.jsx, PostTimer.jsx, QRBadge.jsx
│   │   ├── LiveSTOWidget.jsx, PredictionWidget.jsx, SparkLine.jsx, WeeklyHeatmap.jsx
│   │   ├── PhotoGallery.jsx, CameraStreamModal.jsx, LocationSwitcher.jsx
│   │   ├── NotificationCenter.jsx, Skeleton.jsx
│   │   ├── dashboardPosts/  # GanttTimeline, TimelineRow, WorkOrderModal, ConflictModal, ShiftSettings
│   │   └── postsDetail/     # PostCardsView, PostTableView, PostDetailPanel
│   ├── pages/               # 20 страниц (см. раздел 9)
│   ├── contexts/            # AuthContext, ThemeContext, ToastContext
│   ├── hooks/               # useSocket, useWorkOrderTimer, useCameraStatus
│   ├── utils/               # translate.js, export.js
│   └── i18n/                # ru.json, en.json (~512 ключей)
├── backend/
│   ├── src/
│   │   ├── index.js          # Express, HTTP :3001 + HTTPS :3444, Socket.IO
│   │   ├── routes/           # 22 модуля маршрутов (70+ эндпоинтов)
│   │   ├── middleware/       # auth, auditLog, validate, asyncHandler
│   │   ├── services/         # 7 фоновых сервисов
│   │   └── config/           # socket.js, database.js
│   └── prisma/               # schema.prisma (22 модели), миграции, seed.js
├── data/                     # 29 JSON файлов (моки/fallback)
├── server.js                 # HLS-стриминг камер (:8181)
├── sw.js                     # Service Worker v11
├── manifest.json             # PWA манифест
└── index.html                # Entry point
```

### Data Flow

```
┌──────────┐     HTTP/WS      ┌──────────────┐     Prisma      ┌────────┐
│ Frontend │ ──────────────── │  Backend API  │ ─────────────── │ SQLite │
│ React 19 │     :3001/:3444  │  Express 4    │                 │ dev.db │
└──────────┘                  └──────────────┘                  └────────┘
     │                              │
     │ Socket.IO                    │ CV Events
     │ (real-time updates)          │ (POST /api/events)
     │                              │
     │                        ┌─────────────┐
     │                        │ CV-система  │
     │                        │ (камеры)    │
     │                        └─────────────┘
     │
     │ HLS.js                 ┌─────────────┐
     └─────────────────────── │ HLS Server  │ ← FFmpeg ← RTSP камеры
                    :8181     │ server.js   │
                              └─────────────┘
```

**Fallback-цепочка загрузки данных:**
1. Backend API (`/api/*`) — основной источник
2. JSON-моки в `/data/` — при недоступности backend
3. localStorage — только для users, camera mapping

---

## 3. Инфраструктура и деплой

### Серверы и порты

| Сервер | Порт | Протокол | Назначение |
|--------|------|----------|-----------|
| Nginx | 8080 | HTTP | Reverse proxy, статика фронтенда |
| Express Backend | 3001 | HTTP | REST API + Socket.IO |
| Express Backend | 3444 | HTTPS | REST API + Socket.IO (SSL) |
| HLS Streaming | 8181 | HTTPS | RTSP→HLS для камер |
| Frontend HTTPS | 443 | HTTPS | HTTPS прокси фронтенда |

### Домен и SSL

- **Домен:** `artisom.dev.metricsavto.com`
- **Сертификат:** `/project/.ssl/fullchain.pem`
- **Ключ:** `/project/.ssl/privkey.pem`
- **Истекает:** 2026-07-05 (Let's Encrypt)
- Все порты контейнера (80-65535) проброшены 1:1 на VPS через WireGuard

### Nginx конфигурация

```
Порт 8080 (default_server)
├── /api/*       → proxy http://127.0.0.1:3001 (fallback: 3000, 3002)
├── /socket.io/* → proxy http://127.0.0.1:3001 (WebSocket upgrade)
├── /cam-api/*   → proxy http://127.0.0.1:8181/api/
├── /hls/*       → статика /project/hls/ (CORS, no-cache)
└── /*           → SPA fallback (try_files → index.html)
```

### Билд и деплой фронтенда

```bash
cd /project/frontend && npm run build && cp -r dist/* /project/
```

После билда — бампить `CACHE_NAME` в `sw.js` (текущий: `metricsaiup-v11`).

### Запуск backend

```bash
cd /project/backend && node src/index.js
```

Фоновые сервисы запускаются автоматически:
1. File watcher для 1С sync
2. Telegram-бот
3. Camera health check (каждые 30с)
4. Report scheduler (node-cron)
5. Demo data generator (каждые 2 мин)

---

## 4. База данных

### Общие сведения

- **ORM:** Prisma 5.20
- **БД:** SQLite (`backend/prisma/dev.db`, ~57 MB)
- **Моделей:** 22
- **Миграции:** `/project/backend/prisma/migrations/`

### Модели данных

#### RBAC (контроль доступа)

**User**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| email | String (unique) | Email для входа |
| password | String | bcrypt hash |
| firstName | String | Имя |
| lastName | String | Фамилия |
| isActive | Boolean (true) | Активен ли аккаунт |
| createdAt | DateTime | Дата создания |
| updatedAt | DateTime | Дата обновления |
| → roles | UserRole[] | Роли пользователя |

**Role**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| name | String (unique) | admin, director, manager, mechanic, viewer |
| displayName | String | Отображаемое имя |
| description | String? | Описание роли |
| → users | UserRole[] | Пользователи с ролью |
| → permissions | RolePermission[] | Разрешения роли |

**Permission**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| key | String (unique) | Ключ (view_dashboard, manage_users и др.) |
| displayName | String | Отображаемое имя |
| group | String | Группа (dashboard, zones, users и др.) |
| description | String? | Описание |

**UserRole** — связь many-to-many (userId + roleId — composite PK)

**RolePermission** — связь many-to-many (roleId + permissionId — composite PK)

#### Зоны и посты

**Zone**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| name | String | Название зоны |
| type | String ("repair") | repair / waiting / entry / parking / free |
| description | String? | Описание |
| coordinates | String? | JSON-полигон для карты |
| isActive | Boolean (true) | Активна ли |
| → posts | Post[] | Посты в зоне |
| → stays | ZoneStay[] | Пребывания авто |
| → cameras | CameraZone[] | Камеры зоны |

**Post**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| zoneId | String (FK) | Зона |
| name | String | Название ("Пост 1") |
| type | String ("light") | light / heavy / special |
| status | String ("free") | free / occupied / occupied_no_work / active_work |
| coordinates | String? | JSON-координаты на карте |
| isActive | Boolean (true) | Активен ли |

#### Камеры

**Camera**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| name | String | Название ("CAM 01 — 3.5 СТО") |
| rtspUrl | String | RTSP URL потока |
| isActive | Boolean (true) | Активна ли |

**CameraZone** — связь Camera ↔ Zone с приоритетом
| Поле | Тип | Описание |
|------|-----|---------|
| cameraId | String (PK, FK) | Камера |
| zoneId | String (PK, FK) | Зона |
| priority | Int (0) | Приоритет (0-10) |

#### Сессии и пребывания

**VehicleSession**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| plateNumber | String? | Гос. номер |
| entryTime | DateTime (now) | Время въезда |
| exitTime | DateTime? | Время выезда |
| status | String ("active") | active / completed |
| trackId | String? | ID трека от CV |

**ZoneStay**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| zoneId | String (FK) | Зона |
| vehicleSessionId | String (FK) | Сессия |
| entryTime | DateTime (now) | Вход в зону |
| exitTime | DateTime? | Выход из зоны |
| duration | Int? | Длительность (мс) |

**PostStay**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| postId | String (FK) | Пост |
| vehicleSessionId | String (FK) | Сессия |
| startTime | DateTime (now) | Начало на посту |
| endTime | DateTime? | Конец на посту |
| hasWorker | Boolean (false) | Есть ли работник |
| isActive | Boolean (false) | Активна ли работа |
| activeTime | Int (0) | Время работы (мс) |
| idleTime | Int (0) | Время простоя (мс) |

#### События

**Event**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| type | String | Тип события (10 типов, см. ниже) |
| zoneId | String (FK) | Зона |
| postId | String? (FK) | Пост |
| vehicleSessionId | String? (FK) | Сессия |
| cameraId | String? (FK) | Камера-источник |
| cameraSources | String ("[]") | JSON-массив ID камер |
| confidence | Float (0) | Уверенность CV (0-1) |
| startTime | DateTime (now) | Время начала |
| endTime | DateTime? | Время окончания |
| rawData | String? | Сырые данные от CV (JSON) |
| **Индексы:** type, zoneId, createdAt | | |

**10 типов событий:**
- `vehicle_entered_zone` — авто въехал в зону
- `vehicle_left_zone` — авто покинул зону
- `vehicle_moving` — авто движется
- `vehicle_waiting` — авто ожидает
- `post_occupied` — пост занят
- `post_vacated` — пост освобождён
- `worker_present` — работник на посту
- `worker_absent` — работник ушёл
- `work_activity` — идёт работа
- `work_idle` — простой

#### Заказ-наряды

**WorkOrder**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| externalId | String? (unique) | ID из внешней системы |
| orderNumber | String | Номер ЗН |
| scheduledTime | DateTime | Запланированное время |
| status | String ("scheduled") | scheduled / in_progress / completed / cancelled / no_show |
| plateNumber | String? | Гос. номер |
| workType | String? | Тип работ |
| normHours | Float? | Нормо-часы |
| actualHours | Float? | Фактические часы |
| brand | String? | Марка авто |
| model | String? | Модель авто |
| worker | String? | Работник |
| master | String? | Мастер |
| postNumber | Int? | Номер поста |
| startTime | DateTime? | Фактическое начало |
| endTime | DateTime? | Фактическое окончание |
| estimatedEnd | DateTime? | Расчётное окончание |
| pausedAt | DateTime? | Время паузы |
| totalPausedMs | Int (0) | Суммарное время пауз (мс) |
| version | Int (0) | Версия для optimistic locking |
| **Индексы:** postNumber, status | | |

**WorkOrderLink** — связь ЗН с сессией/постом
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| vehicleSessionId | String (FK) | Сессия |
| postStayId | String? (FK) | Пребывание на посту |
| workOrderId | String (FK) | Заказ-наряд |
| confidence | Float (0) | Уверенность связи |
| matchType | String | Тип связи |

#### Смены

**Shift**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| name | String | Название смены |
| date | DateTime | Дата |
| startTime | String | Начало ("HH:MM") |
| endTime | String | Конец ("HH:MM") |
| status | String ("planned") | planned / active / completed |
| notes | String? | Заметки |

**ShiftWorker**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| shiftId | String (FK) | Смена |
| name | String | Имя работника |
| role | String | mechanic / master / diagnostician |
| postId | String? | Назначенный пост |

#### Рекомендации

**Recommendation**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| type | String | no_show / post_free / capacity_available / work_overtime / vehicle_idle |
| zoneId | String? (FK) | Зона |
| postId | String? (FK) | Пост |
| message | String | Сообщение (RU) |
| messageEn | String? | Сообщение (EN) |
| status | String ("active") | active / acknowledged / resolved |

#### Аудит

**AuditLog**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| userId | String? | ID пользователя |
| userName | String? | Имя пользователя |
| action | String | create / update / delete |
| entity | String | Тип сущности |
| entityId | String? | ID сущности |
| oldData | String? | Предыдущие данные (JSON) |
| newData | String? | Новые данные (JSON) |
| ip | String? | IP-адрес |
| **Индексы:** userId, action, entity, createdAt | | |

#### Карта

**MapLayout**
| Поле | Тип | Описание |
|------|-----|---------|
| id | String (UUID) | PK |
| name | String | Название |
| width | Float (46540) | Ширина (мм) |
| height | Float (30690) | Высота (мм) |
| bgImage | String? | Фон |
| elements | String ("[]") | JSON-массив элементов |
| isActive | Boolean (true) | Активна ли |

**MapLayoutVersion** — история версий
| Поле | Тип | Описание |
|------|-----|---------|
| layoutId | String (FK) | Карта |
| version | Int | Номер версии |
| Unique: [layoutId, version] | | |

#### Прочие модели

**SyncLog** — история синхронизации 1С
- type: "import" / "export"
- source: "manual" / "auto" / "api"
- filename, status, records, errors, details (JSON)

**Photo** — фотографии
- sessionId?, workOrderId?, path, filename, mimeType
- Индексы: sessionId, workOrderId

**PushSubscription** — push-подписки
- userId, endpoint (unique), keys (JSON)

**Location** — локации (multi-tenancy)
- name, address, timezone ("Europe/Moscow")

**TelegramLink** — связь пользователя с Telegram
- userId (unique), chatId, username

**ReportSchedule** — расписание отчётов
- name, frequency (daily/weekly), dayOfWeek, hour, minute, format, chatId, isActive, lastRunAt

---

## 5. Backend API

### Middleware Express (порядок)

1. `helmet()` — Security headers (CSP отключен)
2. `cors({ origin: true, credentials: true })` — CORS для всех origins
3. `morgan('dev')` — Логирование запросов
4. `express.json({ limit: '50mb' })` — JSON-парсер
5. `cookieParser()` — Cookie-парсер

### Аутентификация (/api/auth)

| Метод | Путь | Auth | Тело запроса | Ответ |
|-------|------|------|-------------|-------|
| POST | `/login` | - | `{ email, password }` | `{ token, user: {id, email, firstName, lastName} }` |
| POST | `/refresh` | - | Cookie `refreshToken` | `{ token, user }` |
| POST | `/logout` | - | — | Очистка cookie |
| GET | `/me` | JWT | — | Объект пользователя |
| POST | `/register` | JWT + `manage_users` | `{ email, password, firstName, lastName, roleIds }` | `{ id, email }` |

- **Access Token:** JWT, срок 24ч
- **Refresh Token:** httpOnly cookie, срок 7д, path=/api/auth, secure, sameSite=none
- **Rate Limit:** 20 попыток/мин на IP (только login)

### Дашборд (/api/dashboard)

| Метод | Путь | Query | Ответ |
|-------|------|-------|-------|
| GET | `/overview` | — | `{ activeSessions, zonesWithVehicles, postsStatus, activeRecommendations }` |
| GET | `/metrics` | `?period=24h\|7d\|30d` | `{ zoneMetrics, postMetrics, workOrderMetrics, period }` |
| GET | `/trends` | — | 7-дневные тренды |
| GET | `/live` | — | `{ vehiclesOnSite, totalPosts, posts[], summary: {working, occupied, free, idle} }` |

### Зоны (/api/zones)

| Метод | Путь | Auth | Permission | Тело / Ответ |
|-------|------|------|-----------|-------------|
| GET | `/` | JWT | — | Список зон с постами, камерами, _count stays |
| GET | `/:id` | JWT | — | Зона с постами и active stays |
| POST | `/` | JWT | `manage_zones` | `{ name, type, description?, coordinates? }` |
| PUT | `/:id` | JWT | `manage_zones` | Частичное обновление |
| DELETE | `/:id` | JWT | `manage_zones` | Soft delete (isActive: false) |

**Zone types:** `repair`, `waiting`, `entry`, `parking`, `free`

### Посты (/api/posts)

| Метод | Путь | Auth | Permission | Тело / Query |
|-------|------|------|-----------|-------------|
| GET | `/` | JWT | — | `?zoneId=xxx` → посты с зоной и текущими stays |
| GET | `/:id` | JWT | — | Пост с зоной и последними 10 stays |
| POST | `/` | JWT | `manage_zones` | `{ zoneId, name, type?, coordinates? }` |
| PUT | `/:id` | JWT | `manage_zones` | Частичное обновление |
| DELETE | `/:id` | JWT | `manage_zones` | Soft delete |

**Post types:** `light`, `heavy`, `special`  
**Post statuses:** `free`, `occupied`, `occupied_no_work`, `active_work`

### Камеры (/api/cameras)

| Метод | Путь | Auth | Permission | Тело |
|-------|------|------|-----------|------|
| GET | `/health` | JWT | — | Статусы камер из кэша |
| GET | `/` | JWT | — | Список камер с зонами и _count events |
| GET | `/:id` | JWT | — | Камера с зонами и последними 20 событиями |
| POST | `/` | JWT | `manage_cameras` | `{ name, rtspUrl }` |
| PUT | `/:id` | JWT | `manage_cameras` | `{ name?, rtspUrl?, isActive? }` |
| DELETE | `/:id` | JWT | `manage_cameras` | Soft delete |
| POST | `/:id/zones` | JWT | `manage_cameras` | `{ zones: [{zoneId, priority}] }` |

### События (/api/events)

| Метод | Путь | Auth | Тело / Query |
|-------|------|------|-------------|
| POST | `/` | **Без auth** | `{ type, zoneId, postId?, vehicleSessionId?, cameraId?, cameraSources?, confidence?, startTime?, endTime?, rawData? }` |
| GET | `/` | JWT | `?zoneId=&postId=&type=&limit=50&offset=0` → `{ events[], total }` |

POST `/api/events` — основной вход для CV-системы. Вызывает `processEvent()` из EventProcessor.

### Сессии (/api/sessions)

| Метод | Путь | Auth | Query | Ответ |
|-------|------|------|-------|-------|
| GET | `/` | JWT | `?status=active\|completed&limit=50&offset=0` | `{ sessions[], total }` |
| GET | `/:id` | JWT | — | Сессия с zoneStays, postStays, workOrderLinks, events |

### Заказ-наряды (/api/work-orders)

| Метод | Путь | Auth | Permission | Описание |
|-------|------|------|-----------|---------|
| GET | `/` | JWT | — | `?status=&limit=50&offset=0&dateFrom=&dateTo=` |
| POST | `/import-csv` | JWT | `manage_work_orders` | `{ csvData: "..." }` → `{ imported, orders[] }` |
| PUT | `/:id/assign` | JWT | `manage_work_orders` | `{ postId, startTime, endTime }` |
| POST | `/schedule` | JWT | `manage_work_orders` | Batch-обновление с versioning (см. ниже) |
| POST | `/:id/start` | JWT | — | Старт ЗН → status: in_progress, estimatedEnd |
| POST | `/:id/pause` | JWT | — | Пауза ЗН → pausedAt |
| POST | `/:id/resume` | JWT | — | Возобновление → totalPausedMs обновлён |
| POST | `/:id/complete` | JWT | — | Завершение → actualHours рассчитан |

**Versioning (optimistic locking):**

POST `/schedule` принимает:
```json
{
  "assignments": [
    {
      "workOrderId": "string",
      "postId": "string",
      "postNumber": 1,
      "startTime": "ISO",
      "endTime": "ISO",
      "version": 5
    }
  ]
}
```

При конфликте версии → HTTP 409:
```json
{
  "error": "conflict",
  "conflicts": [
    {
      "workOrderId": "...",
      "reason": "version_mismatch",
      "clientVersion": 5,
      "serverVersion": 6,
      "serverData": { ... }
    }
  ]
}
```

### Рекомендации (/api/recommendations)

| Метод | Путь | Auth | Query | Ответ |
|-------|------|------|-------|-------|
| GET | `/` | JWT | `?status=active` | Рекомендации с зоной и постом |
| PUT | `/:id/acknowledge` | JWT | — | status → "acknowledged" |

### Пользователи (/api/users)

| Метод | Путь | Auth | Permission | Описание |
|-------|------|------|-----------|---------|
| GET | `/` | JWT | `manage_users` | `?active=true\|false` → `{ users[], roles, availablePages }` |
| GET | `/:id` | JWT | `manage_users` | Форматированный объект пользователя |
| POST | `/` | JWT | `manage_users` | Создание пользователя |
| PUT | `/:id` | JWT | `manage_users` | Обновление (роли заменяются целиком) |
| DELETE | `/:id` | JWT | `manage_users` | Soft delete (нельзя удалить себя) |

Ответ содержит `roles` (список ролей с цветами) и `availablePages` (с названиями RU/EN).

### Смены (/api/shifts)

| Метод | Путь | Auth | Permission | Описание |
|-------|------|------|-----------|---------|
| GET | `/` | JWT | — | `?date=&status=&week=YYYY-MM-DD` |
| GET | `/:id` | JWT | — | Смена с работниками |
| POST | `/` | JWT | `manage_shifts` | Создание с работниками, conflict detection |
| PUT | `/:id` | JWT | `manage_shifts` | Обновление (работники заменяются целиком) |
| DELETE | `/:id` | JWT | `manage_shifts` | Удаление |
| POST | `/:id/complete` | JWT | `manage_shifts` | Завершение → handover data |

**Conflict detection** при создании/обновлении:
- `same_shift_duplicate` — один работник дважды в одной смене
- `cross_shift_overlap` — работник в пересекающихся сменах

Отправить с `force: true` для игнорирования конфликтов.

### Данные 1С (/api/1c)

| Метод | Путь | Auth | Описание |
|-------|------|------|---------|
| POST | `/import` | JWT | `{ filename, data: "base64" }` → импорт XLSX |
| POST | `/export` | JWT | `{ filters }` → скачивание XLSX |
| GET | `/sync-history` | JWT | История синхронизаций (limit 50) |
| GET | `/planning` | — | JSON из /data/1c-planning.json |
| GET | `/workers` | — | JSON из /data/1c-workers.json |
| GET | `/stats` | — | JSON из /data/1c-stats.json |

### Карта (/api/map-layout)

| Метод | Путь | Auth | Permission | Описание |
|-------|------|------|-----------|---------|
| GET | `/` | — | — | `?all=true` → все карты или активная |
| GET | `/:id` | — | — | Карта по ID |
| POST | `/` | JWT | `manage_zones` | Создание (если isActive — деактивирует остальные) |
| PUT | `/:id` | JWT | `manage_zones` | Обновление + сохранение предыдущей версии |
| GET | `/:id/versions` | — | — | История версий |
| POST | `/:id/restore/:ver` | JWT | `manage_zones` | Восстановление версии |
| DELETE | `/:id` | JWT | `manage_zones` | Удаление |

### Аудит-лог (/api/audit-log)

| Метод | Путь | Auth | Query |
|-------|------|------|-------|
| GET | `/` | JWT (admin) | `?userId=&action=&entity=&from=&to=&limit=50&offset=0` |
| GET | `/export-csv` | JWT (admin) | Те же фильтры → CSV с BOM (max 10000) |

### Предсказания (/api/predict)

| Метод | Путь | Auth | Описание |
|-------|------|------|---------|
| GET | `/load` | — | `?date=&post=N` → почасовая загрузка |
| GET | `/load/week` | — | `?post=N` → недельная загрузка |
| GET | `/duration` | — | `?work_type=&brand=` → прогноз длительности |
| GET | `/free` | — | Прогноз свободных постов |
| GET | `/health` | — | `{ status: "ok", service: "ml-predict-builtin" }` |

Предсказания используют seeded random (детерминистично для конкретного часа/дня).

### Аналитика постов

| Метод | Путь | Auth | Описание |
|-------|------|------|---------|
| GET | `/api/posts-analytics` | JWT | Аналитика по каждому посту с daily breakdown |
| GET | `/api/dashboard-posts` | JWT | Gantt-данные: посты + timeline + freeWorkOrders |
| GET | `/api/analytics-history` | JWT | 30 дней аналитики по постам (seeded random) |
| GET | `/api/work-orders-crud` | JWT | CRUD-список ЗН с пагинацией |
| PUT | `/api/work-orders-crud/:id` | JWT | Обновление ЗН |
| POST | `/api/work-orders-crud` | JWT | Создание ЗН |
| DELETE | `/api/work-orders-crud/:id` | JWT | Удаление ЗН |

### Работники (/api/workers)

| Метод | Путь | Auth | Описание |
|-------|------|------|---------|
| GET | `/` | JWT | Список уникальных работников из ЗН |
| GET | `/:name/stats` | JWT | `?from=&to=` → summary, topRepairTypes, topBrands, dailyStats, recentOrders |

### Системное здоровье (/api/system-health)

| Метод | Путь | Auth | Ответ |
|-------|------|------|-------|
| GET | `/` | JWT | `{ backend: {status, uptime, memoryUsage}, database: {status, pingMs, sizeMB}, cameras[], sync1c, disk: {usagePercent, usedBytes} }` |

### Push-уведомления (/api/push)

| Метод | Путь | Auth | Описание |
|-------|------|------|---------|
| GET | `/vapid-key` | — | VAPID public key |
| POST | `/subscribe` | JWT | `{ endpoint, keys: {p256dh, auth} }` |
| POST | `/send` | JWT + `manage_users` | `{ userId?, title, body, url }` → push всем или одному |

### Фотографии (/api/photos)

| Метод | Путь | Auth | Описание |
|-------|------|------|---------|
| POST | `/` | JWT | `{ sessionId?, workOrderId?, image: "data:image/jpeg;base64,..." }` (max 10MB) |
| GET | `/` | JWT | `?sessionId=&workOrderId=` |
| DELETE | `/:id` | JWT | Удаление фото |

Допустимые MIME: jpeg, png, gif, webp. Файлы сохраняются в `/data/photos/`.

### Локации (/api/locations)

| Метод | Путь | Auth | Permission | Описание |
|-------|------|------|-----------|---------|
| GET | `/` | JWT | — | `?active=true` |
| GET | `/:id` | JWT | — | По ID |
| POST | `/` | JWT | `manage_users` | `{ name, address?, timezone? }` |
| PUT | `/:id` | JWT | `manage_users` | Обновление |
| DELETE | `/:id` | JWT | `manage_users` | Удаление |

**Допустимые timezone:** Europe/Moscow, Europe/Samara, Asia/Yekaterinburg, Asia/Novosibirsk, UTC

### Расписание отчётов (/api/report-schedules)

| Метод | Путь | Auth | Описание |
|-------|------|------|---------|
| GET | `/` | JWT | Все расписания |
| POST | `/` | JWT | `{ name, frequency, dayOfWeek?, hour, minute, format, chatId? }` |
| PUT | `/:id` | JWT | Обновление |
| DELETE | `/:id` | JWT | Удаление |
| POST | `/:id/run` | JWT | Генерация и скачивание XLSX |

---

## 6. Backend Services

### Event Processor (eventProcessor.js)

Основная функция: `processEvent(data)` — обработка событий от CV-системы.

**Обработчики по типу события:**
- `handleVehicleEnteredZone()` — создаёт ZoneStay
- `handleVehicleLeftZone()` — закрывает ZoneStay с duration
- `handlePostOccupied()` — создаёт PostStay, обновляет статус поста
- `handlePostVacated()` — закрывает PostStay, обновляет статус поста
- `handleWorkerPresent/Absent()` — обновляет hasWorker в PostStay
- `handleWorkActivity/Idle()` — обновляет isActive в PostStay

После обработки вызывает `checkRecommendations()`.

### Recommendation Engine (recommendationEngine.js)

5 проверок:
1. **post_free** — пост свободен > 30 мин
2. **work_overtime** — время работы > 120% нормо-часов
3. **vehicle_idle** — авто без работника > 15 мин
4. **capacity_available** — > 50% постов в зоне свободны
5. **no_show** — ЗН scheduled > 30 мин → статус no_show

### 1C Sync Service (sync1C.js)

- `importFromXlsx(buffer, filename, source)` — парсинг XLSX, детекция типа (planning/workers)
- `exportToXlsx(filters)` — генерация XLSX из БД
- `startFileWatcher()` — мониторинг `/data/1c-import/`
- Результаты записываются в `/data/1c-planning.json`, `/data/1c-workers.json`, `/data/1c-stats.json`

### Camera Health Check (cameraHealthCheck.js)

- Запуск каждые 30 секунд
- Проверка 10 камер (cam01-cam10) через `/api/stream/status`
- При изменении статуса — Socket.IO emit `camera:status`

### Telegram Bot (telegramBot.js)

Требует `TELEGRAM_BOT_TOKEN` в env.

Команды:
- `/start [userId]` — привязка к пользователю
- `/status` — текущий статус СТО
- `/post N` — статус поста N
- `/free` — свободные посты
- `/report` — генерация отчёта

### Report Scheduler (reportScheduler.js)

- node-cron по расписанию из БД
- Генерация XLSX-отчётов
- Отправка через Telegram (если chatId указан)

### Server Export (serverExport.js)

Утилиты для серверной генерации XLSX-файлов.

---

## 7. Middleware

### auth.js

- `authenticate(req, res, next)` — проверка JWT Bearer-токена, загрузка пользователя с ролями и permissions
- `requirePermission(...keys)` — проверка наличия хотя бы одного из permissions
- Строит массив `pages` из основной роли
- Отклоняет refresh-токены, использованные как access

### auditLog.js

- `auditLog(action, entity)` — логирует успешные мутации (статус 200-299)
- `captureOldData(model)` — захватывает состояние сущности до изменения
- Записывает: userId, userName, action, entity, entityId, oldData, newData, ip

### validate.js

- `validate(schema)` — Zod-валидация req.body
- При ошибке: `400 { error, details: [{ field, message }] }`

### asyncHandler.js

- Обёртка для async route handlers
- Ловит Prisma P2025 ошибки (запись не найдена) → 404

---

## 8. Socket.IO

### Подключение

- Сервер: инициализируется на HTTP и HTTPS серверах
- Клиент: transports `['websocket', 'polling']`, 5 попыток reconnect, 2-10с задержка
- JWT авторизация (опциональная)

### Подписки (клиент → сервер)

| Событие | Данные | Room |
|---------|--------|------|
| `subscribe:zone` | `{ zoneId }` | `zone:${zoneId}` |
| `subscribe:post` | `{ postId }` | `post:${postId}` |
| `subscribe:all` | — | `all_events` |

### Emit (сервер → клиент)

| Событие | Данные | Room |
|---------|--------|------|
| `post:status_changed` | `{ postId, postNumber, status, plateNumber, workerName, timestamp }` | broadcast |
| `schedule:updated` | `{ count }` | broadcast |
| `workOrder:started` | `{ workOrderId, postNumber, startTime }` | broadcast |
| `workOrder:completed` | `{ workOrderId }` | broadcast |
| `camera:status` | `{ camId, online, lastCheck }` | broadcast |
| `recommendation` | Recommendation object | `all_events` |
| `event` | Event object | `all_events` |
| `zone:update` | Event object | `zone:${zoneId}` |
| `post:update` | Event object | `post:${postId}` |

---

## 9. Frontend — Страницы

### Dashboard (Dashboard.jsx)

**Назначение:** Главная страница с KPI-метриками и рекомендациями.

| Метрика | Источник |
|---------|---------|
| Активные сессии | `/api/dashboard/overview` → activeSessions |
| Свободные посты | postsStatus.free |
| Занятые посты | postsStatus.occupied |
| Рекомендации | `/api/recommendations` |
| Недавние события | `/api/events?limit=10` |
| Тренды | `/api/dashboard/trends` |

- **Polling:** 5 секунд
- **Виджеты:** LiveSTOWidget, PredictionWidget
- **Действия:** Acknowledge рекомендации (PUT), фильтр событий по типу

### DashboardPosts (DashboardPosts.jsx) — 521 LOC

**Назначение:** Gantt-таймлайн расписания ЗН по постам с drag-n-drop.

**Ключевые возможности:**
- Drag-n-drop ЗН между постами и временными слотами
- Конфликт-детекция пересечений
- Версионирование расписания (optimistic locking, HTTP 409)
- Привязка к текущей смене

**Компоненты:**
- GanttTimeline → TimelineRow (по каждому посту)
- WorkOrderModal — детали ЗН
- ShiftSettings — настройки смены
- ConflictModal — разрешение конфликтов версий

**Socket.IO:** слушает `schedule:updated` для мультиюзер-синхронизации

### PostsDetail (PostsDetail.jsx) — 226 LOC

**Назначение:** Детальная аналитика по каждому посту.

- Периоды: today, yesterday, week, month, custom
- Режимы: cards / table
- PostDetailPanel: подробная информация по выбранному посту (работники, ЗН, алерты, события)
- ListModal: полные списки с прокруткой

### MapViewer (MapViewer.jsx)

**Назначение:** Live-карта СТО на Konva canvas.

- Загружает layout из `/api/map-layouts`
- Данные постов из `/api/dashboard-posts`
- Посты — круги с цветом по статусу
- Камеры с визуализацией FOV
- По клику — модальное окно поста или стрим камеры

### MapEditor (MapEditor.jsx) — 1244 LOC

**Назначение:** Drag-drop редактор карты СТО.

**8 типов элементов:** building, post, zone, camera, door, wall, label, infozone

**Возможности:**
- Рисование элементов на canvas
- Snap-to-grid (10px)
- Трансформация (rotate, scale)
- Undo/redo
- Сохранение в БД с версионированием
- Import/export JSON
- Загрузка фона (изображение)

### Sessions (Sessions.jsx)

**Назначение:** Отслеживание сессий автомобилей на территории.

- Табы: active / completed
- Фильтр по посту, сортировка по entryTime/post/plate/zone
- SessionModal: SVG-превью номера, привязка ЗН по номеру, QR-код

### WorkOrders (WorkOrders.jsx)

**Назначение:** Управление заказ-нарядами.

- CSV-импорт (POST `/import-csv`)
- Фильтры: статус, дата, текстовый поиск
- Сортировка по всем колонкам
- Цветовые бейджи статусов: scheduled (info), in_progress (warning), completed (success), cancelled (muted), no_show (danger)

### Events (Events.jsx)

**Назначение:** Журнал событий с фильтрами.

- Группы фильтров: vehicle / post / worker / work
- Фильтр по зоне, посту, текстовый поиск
- Пагинация: 25/50/100 на странице
- Auto-refresh (polling 5с, переключатель)
- EVENT_META: метаданные с цветами и иконками для каждого типа

### Analytics (Analytics.jsx) — 655 LOC

**Назначение:** Графики аналитики с экспортом.

- Период: 30d / 7d / 24h / today
- Графики Recharts: Line, Bar, Pie, Area
- Экспорт: XLSX (4 листа), PDF (A4 landscape), PNG (отдельный график)
- Контекстное меню для экспорта графика как PNG

### Data1C (Data1C.jsx) — 926 LOC

**Назначение:** Интеграция с 1С Альфа-Авто.

- 3 таба: Статистика, Планирование, Выработка
- Excel-импорт через drag-n-drop
- Дедупликация при импорте
- Пагинация: 25/50/100
- Сортировка по всем колонкам
- Экспорт XLSX

### Cameras (Cameras.jsx)

**Назначение:** Обзор камер видеонаблюдения.

- 10 камер с расположением и покрытием
- Группировка по зонам с приоритетами
- HLS-стриминг через CameraStreamModal

### CameraMapping (CameraMapping.jsx) — 312 LOC

**Назначение:** Маппинг камера ↔ зона с приоритетами.

- Выбор зоны → редактирование приоритетов камер
- Приоритеты: P1, P3, P5, P8, P10
- Матрица покрытия
- Хранение: localStorage.cameraMappingData

### Users (Users.jsx)

**Назначение:** CRUD пользователей.

- Создание/редактирование/деактивация
- Назначение роли и доступных страниц (checkbox grid)
- Нельзя деактивировать свой аккаунт

### Shifts (Shifts.jsx)

**Назначение:** Недельное расписание смен.

- Навигация по неделям
- Создание/редактирование смен с работниками
- Назначение работников на посты
- Конфликт-детекция (дубли, пересечения)
- Статусы: planned / active / completed

### Audit (Audit.jsx)

**Назначение:** Аудит-лог действий пользователей (только admin).

- Фильтры: action, entity, userId, дата
- Пагинация: 25/50/100
- Раскрываемые строки с before/after JSON
- CSV-экспорт

### MyPost (MyPost.jsx)

**Назначение:** Рабочее место механика.

- Показывает назначенный пост и текущий ЗН
- Таймер с прогресс-баром
- Уровни предупреждений: 80% (warning), 95% (critical), 100%+ (overtime)
- Кнопки: Start, Pause, Resume, Complete

### Health (Health.jsx)

**Назначение:** Мониторинг системы (только admin).

- Backend: статус, uptime, Node.js версия
- Database: ping (мс), размер (МБ)
- Memory: heap usage (%)
- Disk: usage %, used/total GB
- Cameras: online/total
- Auto-refresh: 30с

### WorkerStats (WorkerStats.jsx)

**Назначение:** Аналитика по конкретному работнику.

- URL: `/worker-stats/:workerName`
- Период: dateFrom/dateTo
- Графики: Bar (типы ремонта), Pie (марки авто), Line (дневная выработка)
- Таблица: summary, topRepairTypes, topBrands, dailyStats, recentOrders

### ReportSchedule (ReportSchedule.jsx)

**Назначение:** Расписание автоматической генерации отчётов.

- Частота: daily / weekly
- Формат: XLSX
- Telegram delivery через chatId
- Кнопка "Запустить сейчас" → скачивание XLSX

### Login (Login.jsx)

**Назначение:** Страница авторизации.

- Email + Password
- Переключатели: тема (dark/light), язык (RU/EN)
- Fallback: mock login из `/data/users.json` при недоступности backend
- Кнопка сброса (очистка localStorage)

---

## 10. Frontend — Компоненты

### Layout.jsx
Обёртка для всех защищённых страниц. Содержит Header (тема, язык, пользователь) и Sidebar (навигация).

### Sidebar.jsx
- Навигация: фильтрация пунктов по `user.pages`
- Admin видит все пункты
- Подменю для постов
- Сворачиваемый режим (160px → icon mode)

### HelpButton.jsx
Контекстная справка. Принимает `pageKey`, показывает модальное окно с инструкцией для текущей страницы.

### DateRangePicker.jsx
Два поля ввода даты (from/to) с обработчиками onChange.

### DeltaBadge.jsx
Бейдж изменения: стрелка вверх/вниз + значение (%). Используется в аналитике для сравнения периодов.

### PostTimer.jsx
Таймер заказ-наряда с цветовым индикатором. Принимает work order, показывает elapsed time и warning level.

### QRBadge.jsx
QR-код для сессии. Генерируется через `qrcode.react`. Содержит: sessionId, plateNumber, entryTime.

### LiveSTOWidget.jsx
Виджет текущего состояния СТО: количество авто на территории, работающие/простаивающие/свободные посты.

### PredictionWidget.jsx
Виджет ML-предсказаний: прогноз загрузки постов, время до освобождения.

### SparkLine.jsx
Мини-график тренда (SVG). Принимает: data, height, color.

### WeeklyHeatmap.jsx
Тепловая карта активности за неделю. 7 дней × 24 часа.

### PhotoGallery.jsx
Галерея фотографий с zoom и lightbox.

### CameraStreamModal.jsx
Модальное окно с HLS-стримом камеры. Использует HLS.js для проигрывания `.m3u8`.

### LocationSwitcher.jsx
Переключатель между локациями (multi-tenancy).

### NotificationCenter.jsx
Центр уведомлений (real-time через Socket.IO).

### Skeleton.jsx
Placeholder-компоненты загрузки (скелетон).

### dashboardPosts/

| Компонент | Назначение |
|-----------|-----------|
| GanttTimeline | Gantt-диаграмма с постами и временными блоками |
| TimelineRow | Одна строка (пост) в Gantt |
| TimelineHeader | Заголовок с метками времени |
| FreeWorkOrdersTable | Таблица нераспределённых ЗН |
| WorkOrderModal | Модальное окно деталей ЗН |
| ShiftSettings | Настройки смены (часы, количество постов) |
| ConflictModal | Диалог разрешения конфликтов при сохранении |
| Legend | Легенда статусов |

### postsDetail/

| Компонент | Назначение |
|-----------|-----------|
| PostCardsView | Карточный layout постов |
| PostTableView | Табличный layout постов |
| PostDetailPanel | Панель детальной информации по посту |

---

## 11. Frontend — Контексты

### AuthContext

**Предоставляет:**
```js
{
  user,          // { id, email, firstName, lastName, role, roles, pages, permissions }
  loading,       // boolean
  login(email, password),
  logout(),
  hasPermission(key),
  updateCurrentUser(updatedUser),
  api            // { get, post, put, delete }
}
```

**API-клиент:**
- Автоматический `Authorization: Bearer {token}` header
- GET: возвращает `{ data }` или `null` при ошибке (не бросает)
- POST/PUT/DELETE: бросает ошибку при неуспехе
- Автоматический refresh token при 401

**Login flow:**
1. POST `/api/auth/login` → получение token
2. GET `/api/auth/me` → получение user info
3. Сохранение в localStorage: `token`, `currentUser`
4. Подключение Socket.IO

**Mock login (fallback):**
При недоступности backend — загрузка пользователей из `/data/users.json`, проверка email/password.

### ThemeContext

```js
{
  theme,         // 'dark' | 'light'
  toggleTheme()  // переключение
}
```

- Сохраняет в localStorage (`theme`)
- Устанавливает CSS-класс `dark` на document

### ToastContext

```js
{
  toast: {
    success(msg, duration?),  // default 4s
    error(msg, duration?),    // default 8s
    warning(msg, duration?),  // default 4s
    info(msg, duration?)      // default 4s
  }
}
```

- Максимум 3 toast одновременно
- Auto-dismiss по таймеру
- Стили: glassmorphism + backdrop blur + иконки Lucide

---

## 12. Frontend — Хуки

### useSocket.js

```js
connectSocket(token)       // Инициализация Socket.IO
disconnectSocket()         // Отключение
getSocket()                // Текущий инстанс

useSocketStatus()          // boolean — подключён ли
useSocket(event, callback) // Подписка на событие
useSubscribe(channel)      // Подписка на room (zone:/post:)
usePolling(callback, ms)   // Polling-fallback (default 5000ms)
```

**Конфигурация Socket.IO:**
- Transports: websocket + polling fallback
- Reconnect: 5 попыток, задержка 2-10с
- Auto-subscribe: `subscribe:all` при подключении

### useWorkOrderTimer.js

```js
useWorkOrderTimer(workOrder, api)
→ {
  elapsedMs,     // мс с начала (за вычетом пауз)
  percentUsed,   // 0-200 (процент от нормо-часов)
  warningLevel,  // 'none' | 'warning' (80%) | 'critical' (95%) | 'overtime' (100%+)
  isPaused,      // boolean
  isRunning,     // boolean
  start(),       // POST /api/work-orders/:id/start
  pause(),       // POST /api/work-orders/:id/pause
  resume(),      // POST /api/work-orders/:id/resume
  complete()     // POST /api/work-orders/:id/complete
}
```

Обновляется каждую секунду при isRunning.

### useCameraStatus.js

```js
useCameraStatus()
→ { [camId]: { online: boolean } }
```

- Начальная загрузка: GET `/api/cameras/health`
- Обновления: Socket.IO event `camera:status`

---

## 13. Frontend — Утилиты

### translate.js

```js
translateZone(name, isRu)  // "Ремонтная зона" → "Repair zone"
translatePost(name, isRu)  // "Пост 1" → "Post 1"
```

### export.js

```js
exportToXlsx(data, postSummaries, filteredPosts, filteredDaily, isRu)
// → 4-листовая книга: Summary, Posts, Daily, Details
// → файл: analytics-YYYY-MM-DD.xlsx

exportToPdf(containerRef, isRu)
// → A4 landscape PDF через html2canvas
// → файл: analytics-YYYY-MM-DD.pdf

downloadChartAsPng(chartEl, filename?)
// → PNG из DOM-элемента через html2canvas
// → файл: chart-YYYY-MM-DD.png
```

---

## 14. RBAC — Система доступа

### Роли и разрешения

| Роль | Permissions |
|------|-----------|
| **admin** | Все 15 + manage_roles, manage_settings |
| **director** | view_dashboard, view_analytics, view_zones, view_posts, view_sessions, view_events, view_work_orders, view_recommendations, view_cameras |
| **manager** | view_dashboard, view_zones, view_posts, view_sessions, view_events, manage_work_orders, view_recommendations |
| **mechanic** | view_dashboard, view_posts, view_sessions |
| **viewer** | view_dashboard, view_zones, view_posts |

### 15 permissions

```
view_dashboard, view_analytics, view_zones, manage_zones,
view_posts, view_sessions, view_events,
view_work_orders, manage_work_orders,
view_recommendations,
manage_users, manage_roles, manage_settings,
view_cameras, manage_cameras
```

### Маппинг страниц → permissions

```js
PAGE_PERMISSIONS = {
  'dashboard':       ['view_dashboard'],
  'dashboard-posts': ['view_dashboard'],
  'posts-detail':    ['view_dashboard', 'view_posts'],
  'map':             ['view_zones'],
  'map-view':        ['view_zones'],
  'map-editor':      ['manage_zones'],
  'sessions':        ['view_sessions'],
  'work-orders':     ['view_work_orders'],
  'events':          ['view_events'],
  'analytics':       ['view_analytics'],
  'cameras':         ['view_cameras'],
  'camera-mapping':  ['manage_cameras'],
  'shifts':          ['view_shifts', 'manage_shifts'],
  'data-1c':         ['view_work_orders'],
  'users':           ['manage_users'],
  'audit':           ['manage_users']
}
```

### Страницы по умолчанию для ролей

```js
ROLE_DEFAULT_PAGES = {
  admin:    [все страницы],
  manager:  ['dashboard', 'dashboard-posts', 'posts-detail', 'map-view',
             'sessions', 'work-orders', 'events', 'analytics',
             'cameras', 'data-1c', 'shifts', 'report-schedule'],
  director: ['dashboard', 'dashboard-posts', 'posts-detail', 'map-view',
             'sessions', 'work-orders', 'events', 'analytics',
             'cameras', 'data-1c'],
  mechanic: ['dashboard', 'my-post', 'sessions'],
  viewer:   ['dashboard', 'map-view', 'sessions']
}
```

### Контроль доступа

- **Backend:** middleware `requirePermission('manage_users')` на маршрутах
- **Frontend:** `hasPermission(key)` из AuthContext
- **Sidebar:** фильтрация по `user.pages.includes(pageId)` (admin видит всё)
- **Client-side:** проверка `user.role === 'admin'` для Health и Audit

---

## 15. Интернационализация (i18n)

### Настройка

- **Framework:** react-i18next + i18next
- **Языки:** Русский (default) + English
- **Хранение:** localStorage (`language`)
- **Fallback:** 'ru'
- **Файлы:** `frontend/src/i18n/ru.json`, `frontend/src/i18n/en.json`

### Статистика

- **Общее число ключей:** ~512
- **Число секций:** 36
- **Паритет:** 100% (все ключи в обоих файлах)

### Секции i18n

| Секция | Описание | Примеры ключей |
|--------|---------|---------------|
| app | Название приложения | title, subtitle |
| nav | Навигация | dashboard, sessions, workOrders, analytics... |
| auth | Авторизация | login, email, password, loginError |
| dashboard | Дашборд | activeSessions, freePosts, occupiedPosts |
| dashboardPosts | Gantt-таймлайн | title, occupied, free, conflict, saved |
| postsDetail | Аналитика постов | title, planVsFact, workers, statistics |
| sessions | Сессии | plateNumber, entryTime, currentZone |
| workOrders | Заказ-наряды | orderNumber, status, importCsv |
| events | События | type, zone, post, confidence |
| analytics | Аналитика | heatmap, export, summary, daily |
| data1c | Данные 1С | statistics, planning, uploadFrom1c |
| cameras | Камеры | byZone, allCameras, noSignal |
| cameraMapping | Маппинг камер | zones, cameras, links, unmapped |
| users | Пользователи | newUser, editUser, role, pages |
| shifts | Смены | weekOf, newShift, workers, conflicts |
| audit | Аудит | dateFrom, dateTo, exportCsv |
| myPost | Мой пост | currentWO, workTimer, normHours |
| health | Здоровье | backend, database, cameras, disk |
| workerStats | Статистика работника | totalWO, efficiency, brands |
| reportSchedule | Расписание отчётов | frequency, daily, weekly, format |
| mapEditor | Редактор карты | uploadBg, load, exportJson, grid |
| mapView | Карта | currentVehicle, layers, zoomIn |
| mapVersions | Версии карты | restore, diff, current |
| liveWidget | Виджет | vehiclesOnSite, working, idle |
| predict | Предсказания | loadForecast, freeIn, accuracy |
| recommendations | Рекомендации | no_show, post_free, overtime |
| zones | Зоны | repair, waiting, entry, parking, free |
| posts | Посты | free, occupied, active_work, light, heavy, special |
| common | Общее | loading, save, cancel, delete, search, noData |
| theme | Тема | light, dark |
| timer | Таймер | remaining, overtime |
| photos | Фото | upload, takePhoto, gallery |
| qr | QR-код | title, print, scan |
| pwa | PWA | install, offline, newVersion |
| notifications | Уведомления | liveConnected |
| location | Локации | switch, all, summary |

### Использование

```jsx
const { t, i18n } = useTranslation();
const isRu = i18n.language === 'ru';

t('nav.dashboard')              // "Дашборд" / "Dashboard"
i18n.changeLanguage('en')       // Переключение языка
```

---

## 16. PWA и Service Worker

### manifest.json

```json
{
  "name": "MetricsAiUp - Мониторинг СТО",
  "short_name": "MetricsAiUp",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#6366f1",
  "start_url": "./"
}
```

### Service Worker (sw.js v11)

- **Cache:** `metricsaiup-v11`
- **Стратегия:** Network-first
- **Исключения:** `/api/*`, `/socket.io/*` (всегда live)
- **Кэшируемое:** `./`, `./index.html`, `./favicon.svg`

**Push-уведомления:**
- Получает JSON из push event
- Показывает notification с title, body, icon
- По клику — фокус на окно или открытие нового

---

## 17. HLS Видеостриминг

### Архитектура

```
RTSP камера → FFmpeg → HLS segments (.ts + .m3u8) → Node.js HTTPS сервер → HLS.js клиент
```

### Конфигурация (server.js)

- **Порт:** 8181 (HTTPS)
- **Камер:** 10 (cam01-cam10)
- **RTSP IP:** 86.57.249.76 (порты 1732, 1832)
- **Сегменты:** 2 секунды, 6 в плейлисте
- **Codec:** copy (без перекодирования)
- **Audio:** отключен

### API стриминга

| Метод | Путь | Описание |
|-------|------|---------|
| POST | `/api/stream/start/:camId` | Запуск стрима камеры |
| POST | `/api/stream/stop/:camId` | Остановка стрима |
| GET | `/api/stream/status` | Статусы всех стримов |

### Авто-рестарт

При падении FFmpeg — автоматический перезапуск через 3 секунды.

---

## 18. Интеграция с 1С

### Потоки данных

1. **Ручной импорт:** Drag-n-drop XLSX на странице Data1C → POST `/api/1c/import`
2. **Автоматический импорт:** File watcher следит за `/data/1c-import/`
3. **Экспорт:** POST `/api/1c/export` → XLSX-файл

### Типы данных

**Planning (Планирование):**
- Номер заказ-наряда, рабочее место, начало/окончание
- Мастер, тип работ, нормо-часы, бренд/модель, гос. номер

**Workers (Выработка):**
- Вид ремонта, сотрудник, дата начала/окончания
- Нормо-часы, статус, бренд, модель

### Дедупликация

- **Планирование:** по (номер + рабочее место + начало)
- **Выработка:** по (номер + сотрудник + дата начала)

### Выходные файлы

- `/data/1c-planning.json` — планирование (1261 строка)
- `/data/1c-workers.json` — выработка (15589 строк)
- `/data/1c-stats.json` — статистика синхронизации

---

## 19. Тестирование

### Фреймворк

- **Test Runner:** Vitest
- **DOM:** jsdom
- **UI Testing:** React Testing Library
- **Assertions:** @testing-library/jest-dom

### Конфигурация

```js
// vite.config.js → test
{
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.js',
  css: false
}
```

### Тестовые файлы (18 файлов)

| Файл | Что тестирует |
|------|-------------|
| constants.test.js | Константы приложения |
| i18n.test.js | Загрузка переводов |
| locationSwitcher.test.jsx | Компонент переключателя локаций |
| mapElements.test.js | Элементы карты |
| mapLayout.test.js | Структура карты |
| mapVersioning.test.js | Версионирование карты |
| myPost.test.js | Страница рабочего места |
| permissions.test.js | Система разрешений |
| photoGallery.test.jsx | Компонент галереи |
| postTimer.test.js | Таймер заказ-наряда |
| predictionWidget.test.jsx | Виджет предсказаний |
| pwa.test.js | PWA функциональность |
| qrBadge.test.jsx | QR-код компонент |
| stoMapTheme.test.js | Тема карты |
| storage.test.js | localStorage обёртки |
| telegramBot.test.js | Telegram-бот интеграция |
| utils.test.js | Утилиты |

### Запуск

```bash
# Frontend
cd /project/frontend && npm test      # Однократный запуск
cd /project/frontend && npm run test:watch  # Watch mode

# Backend
cd /project/backend && npm test
```

---

## 20. Физическая карта СТО

### Расположение

- **Адрес:** ул. Колесникова, 38, Москва
- **Timezone:** Europe/Moscow
- **Размер карты:** 46540×30690 мм

### Зоны (5)

| Зона | Тип | Посты | Камеры |
|------|-----|-------|--------|
| Ремонтная зона (1-4) | repair | Посты 1-4 (heavy) | CAM 01, 02, 03 |
| Ремонтная зона (5-8) | repair | Посты 5-8 (light) | CAM 01, 02, 03 |
| Диагностика (9-10) | repair | Посты 9-10 (special) | CAM 01, 02, 03 |
| Въезд/Выезд | entry | — | CAM 01, 02, 03 |
| Парковка/Ожидание | parking | — | CAM 01, 02, 03 |

### Посты (10)

| Пост | Тип | Зона | Описание |
|------|-----|------|---------|
| 1-4 | heavy | Ремонт 1-4 | 2-стоечные подъёмники, тяжёлый ремонт |
| 5-8 | light | Ремонт 5-8 | 2-стоечные подъёмники, лёгкий ремонт |
| 9 | special | Диагностика | Диагностика |
| 10 | special | Диагностика | Спец. работы |

### Камеры (10)

| ID | Расположение | Покрытие |
|----|-------------|---------|
| cam01 | 3.5 СТО | Ремонт 1-4 + проезд |
| cam02 | 3.11 СТО | Общий вид |
| cam03 | 3.9 СТО | Диагностика |
| cam04 | 3.10 СТО | Диагностика |
| cam05 | 3.4 СТО | Ремонт 1-4 |
| cam06 | 3.6 СТО | Проезд |
| cam07 | 3.2 СТО | Проезд |
| cam08 | 3.3 СТО | Ремонт 5-8 |
| cam09 | 3.1 СТО | Въезд |
| cam10 | 3.7 Склад | Склад |

---

## 21. Зависимости проекта

### Frontend (production)

| Пакет | Версия | Назначение |
|-------|--------|-----------|
| react | 19.2.4 | UI framework |
| react-dom | 19.2.4 | React DOM |
| react-router-dom | 7.13.1 | HashRouter, routes |
| tailwindcss | 4.2.2 | CSS framework |
| @tailwindcss/vite | 4.2.2 | Vite plugin |
| recharts | 3.8.0 | Графики |
| konva | 10.2.3 | Canvas rendering |
| react-konva | 19.2.3 | React-обёртка для Konva |
| i18next | 25.9.0 | Интернационализация |
| react-i18next | 16.5.8 | React-обёртка |
| socket.io-client | 4.8.3 | WebSocket |
| hls.js | 1.6.15 | HLS видео |
| jspdf | 4.2.1 | PDF-генерация |
| html2canvas | 1.4.1 | DOM → Canvas |
| xlsx | 0.18.5 | Excel export |
| qrcode.react | 4.2.0 | QR-коды |
| lucide-react | 0.577.0 | Иконки |
| axios | 1.13.6 | HTTP-клиент |
| pdfjs-dist | 5.6.205 | PDF-просмотр |

### Frontend (dev)

| Пакет | Версия | Назначение |
|-------|--------|-----------|
| vite | 8.0.1 | Build tool |
| vitest | 4.1.2 | Testing |
| @vitejs/plugin-react | 6.0.1 | React plugin |
| @testing-library/react | 16.3.2 | React testing |
| @testing-library/jest-dom | 6.9.1 | DOM assertions |
| jsdom | 29.0.1 | DOM environment |
| typescript | 5.9.3 | TypeScript |
| eslint | 9.39.4 | Linting |

### Backend (production)

| Пакет | Версия | Назначение |
|-------|--------|-----------|
| express | 4.21.0 | Web framework |
| @prisma/client | 5.20.0 | ORM |
| jsonwebtoken | 9.0.2 | JWT |
| bcryptjs | 2.4.3 | Хеширование |
| socket.io | 4.8.0 | WebSocket |
| helmet | 7.1.0 | Security headers |
| cors | 2.8.5 | CORS |
| morgan | 1.10.0 | Logging |
| cookie-parser | 1.4.7 | Cookies |
| zod | 4.3.6 | Валидация |
| node-cron | 4.2.1 | Планировщик |
| xlsx | 0.18.5 | Excel |
| csv-parse | 5.5.6 | CSV-парсинг |
| web-push | 3.6.7 | Push-уведомления |
| node-telegram-bot-api | 0.67.0 | Telegram |
| dotenv | 16.4.5 | Env-переменные |

### Backend (dev)

| Пакет | Версия | Назначение |
|-------|--------|-----------|
| prisma | 5.20.0 | CLI + migration |
| nodemon | 3.1.7 | Auto-restart |
| vitest | 4.1.3 | Testing |

---

## 22. Переменные окружения

### Backend (.env)

| Переменная | Значение | Описание |
|-----------|---------|---------|
| DATABASE_URL | `file:./dev.db` | Путь к SQLite |
| JWT_SECRET | `change-me-in-production` | Секрет JWT |
| PORT | `3001` | HTTP-порт Express |
| NODE_ENV | `development` | Окружение |

### Опциональные

| Переменная | Описание |
|-----------|---------|
| TELEGRAM_BOT_TOKEN | Токен Telegram-бота |
| VAPID_PUBLIC_KEY | VAPID ключ для Web Push |
| VAPID_PRIVATE_KEY | Приватный VAPID ключ |

### localStorage ключи (frontend)

| Ключ | Тип | Описание |
|------|-----|---------|
| `token` | string | JWT access token |
| `currentUser` | JSON | Объект текущего пользователя |
| `language` | string | `ru` / `en` |
| `theme` | string | `dark` / `light` |
| `dashboardPostsSettings` | JSON | Настройки Gantt-таймлайна |
| `dashboardPostsSchedule` | JSON | Кэш расписания |
| `cameraMappingData` | JSON | Маппинг камер по зонам |

---

## 23. Seed-данные

### Пользователи

| Email | Пароль | Роль | Имя | Активен |
|-------|--------|------|-----|---------|
| admin@metricsai.up | admin123 | admin | Admin MetricsAI | Да |
| demo@metricsai.up | demo12345 | manager | Генри Форд | Да |
| manager@metricsai.up | demo123 | manager | Сергей Петров | Да |
| mechanic@metricsai.up | demo123 | mechanic | Иван Козлов | Нет |

### Зоны (5)

| Название | Тип |
|---------|-----|
| Ремонтная зона (посты 1-4) | repair |
| Ремонтная зона (посты 5-8) | repair |
| Диагностика (посты 9-10) | repair |
| Зона Въезд/Выезд | entry |
| Зона Ожидания / Парковка | parking |

### Посты (10)

Посты 1-4 (heavy), 5-8 (light), 9-10 (special) — по зонам.

### Камеры (10)

cam01–cam10 с RTSP URL и маппингом на зоны.

---

*Документация сгенерирована 2026-04-09. MetricsAiUp v1.0.*
