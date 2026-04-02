# План PHOENIX — Полный бэкенд и продакшен-готовность MetricsAiUp

> **Кодовое название:** PHOENIX (перерождение из прототипа в production)
> **Создан:** 2026-04-02
> **Автор:** Claude + Артём
> **Текущий статус:** ПЛАНИРОВАНИЕ

---

## Обзор

Проект MetricsAiUp — функциональный прототип (MVP) с полным UI. Для production нужно:
- Реальный бэкенд с БД
- Безопасная авторизация
- Real-time обновления
- Камеры (HLS/RTSP)
- Оптимизация и тесты

**12 этапов. Оценка: 4-6 недель.**

---

## ЭТАП 1: Реальный бэкенд (REST API)
**Приоритет:** КРИТИЧЕСКИЙ | **Срок:** 3-5 дней

### Что сделать:
1. Развернуть Express.js + Prisma ORM + PostgreSQL
2. Создать миграции БД для всех сущностей:
   - `User` (id, email, passwordHash, firstName, lastName, role, pages, isActive)
   - `Post` (id, number, name, type, zoneId, status, maxCapacityHours)
   - `Zone` (id, name, type, description)
   - `VehicleSession` (id, plateNumber, entryTime, exitTime, status, trackId)
   - `PostStay` (postId, sessionId, startTime, endTime, hasWorker, activeTime, idleTime)
   - `WorkOrder` (id, orderNumber, plateNumber, workType, normHours, actualHours, status, scheduledTime, postId)
   - `Event` (id, type, zoneId, postId, confidence, createdAt)
   - `Recommendation` (id, type, message, status, zoneId, postId)
   - `Camera` (id, number, location, rtspUrl, isOnline)
   - `CameraZone` (cameraId, zoneId, priority)
3. API endpoints (REST):
   - `GET/POST/PUT/DELETE /api/users`
   - `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
   - `GET /api/posts`, `GET /api/zones`, `GET /api/sessions`
   - `GET /api/work-orders`, `POST /api/work-orders/import`
   - `GET /api/events`, `GET /api/recommendations`
   - `GET /api/dashboard/overview`, `GET /api/dashboard/posts`
   - `GET /api/analytics/history?period=7d`
   - `GET /api/cameras`, `GET /api/cameras/:id/stream`
   - `POST /api/1c/import` (Excel upload)
4. Убрать API-обёртку из AuthContext (маппинг URL→JSON)
5. Создать единый API-клиент (`/frontend/src/api/client.js`)
6. Добавить error handling middleware
7. Добавить request validation (zod или joi)
8. Seed-скрипт для заполнения БД тестовыми данными

### Результат:
- Все данные в PostgreSQL
- Фронтенд обращается к реальному API
- Мок-JSON больше не используются

---

## ЭТАП 2: Безопасная авторизация
**Приоритет:** КРИТИЧЕСКИЙ | **Срок:** 1-2 дня

### Что сделать:
1. Пароли: bcrypt хеширование (не plaintext)
2. JWT токены:
   - Access token (15 мин, в памяти)
   - Refresh token (7 дней, httpOnly cookie)
3. Middleware `requireAuth` для защищённых маршрутов
4. Middleware `requireRole('admin')` для управления пользователями
5. Серверная проверка permissions (не только клиент)
6. Rate limiting на `/api/auth/login` (5 попыток / мин)
7. CSRF protection для cookie-based auth
8. Logout: инвалидация refresh token
9. Убрать пароли из localStorage
10. Фронтенд: axios interceptor для автоматического refresh

### Результат:
- Безопасная авторизация с JWT
- Серверная валидация прав
- Защита от brute-force

---

## ЭТАП 3: WebSocket (real-time)
**Приоритет:** ВЫСОКИЙ | **Срок:** 2 дня

### Что сделать:
1. Socket.IO сервер на бэкенде
2. Каналы событий:
   - `post:status` — изменение статуса поста
   - `session:update` — новая/изменённая сессия
   - `event:new` — новое событие от CV
   - `workorder:update` — обновление ЗН
   - `recommendation:new` — новая рекомендация
3. Фронтенд: заменить usePolling на useSocket
4. Reconnection logic с exponential backoff
5. Connection status indicator в Header
6. Fallback на polling если WS недоступен
7. JWT-аутентификация для WS-подключений

### Результат:
- Мгновенные обновления (< 100ms)
- Индикатор подключения
- Убрана задержка polling 5 сек

---

## ЭТАП 4: Error handling UI
**Приоритет:** ВЫСОКИЙ | **Срок:** 1 день

### Что сделать:
1. Компонент `<Toast />` (уведомления):
   - Типы: success, error, warning, info
   - Auto-dismiss (5 сек)
   - Stack (до 3 одновременно)
   - Glassmorphism стиль
2. Toast context / provider
3. Заменить все `console.error` на `toast.error()`
4. Error boundary для React (catch render errors)
5. Retry button на failed requests
6. Loading skeletons для Dashboard, PostsDetail, Analytics
7. Empty states с иллюстрациями (не просто "Нет данных")
8. Network error page (offline detection)

### Результат:
- Пользователь видит ошибки
- Красивые loading states
- Retry логика

---

## ЭТАП 5: Рефакторинг state management
**Приоритет:** СРЕДНИЙ | **Срок:** 2-3 дня

### Что сделать:
1. Создать `/frontend/src/services/localStorage.js`:
   - Централизованные ключи
   - TTL (время жизни)
   - Типизированные getter/setter
2. Или перейти на Zustand для глобального state:
   - authStore (user, token, permissions)
   - uiStore (theme, language, sidebar state)
   - dataStore (cached API responses)
3. Убрать localStorage из 6+ файлов
4. Добавить cache invalidation при logout
5. SWR или React Query для серверного state:
   - Автоматический refetch
   - Кеширование
   - Оптимистичные обновления
6. Дедупликация запросов (не грузить одно и то же дважды)

### Результат:
- Единый источник правды
- Нет stale cache проблем
- Быстрее UX (оптимистичные апдейты)

---

## ЭТАП 6: Извлечение shared констант
**Приоритет:** СРЕДНИЙ | **Срок:** 1 день

### Что сделать:
1. Создать `/frontend/src/constants/`:
   - `colors.js` — STATUS_COLORS, POST_COLORS, CHART_COLORS
   - `eventTypes.js` — EVENT_TYPES (один раз, не в Dashboard + Events)
   - `cameras.js` — ALL_CAMERAS (один раз, не в MapView + Cameras + CameraMapping)
   - `zones.js` — zone/post names и маппинги
   - `config.js` — POLLING_INTERVAL, API_BASE, etc.
   - `permissions.js` — PAGE_PERMISSIONS маппинг
2. Заменить все дупликаты на импорты из constants
3. Удалить translate.js (заменить на i18n ключи)
4. Убрать магические числа (5000ms polling, etc.)

### Результат:
- Нет дублирования
- Одно место для изменений
- Легче поддерживать

---

## ЭТАП 7: Оптимизация производительности
**Приоритет:** СРЕДНИЙ | **Срок:** 1-2 дня

### Что сделать:
1. `useMemo` для тяжёлых вычислений:
   - PostsDetail: фильтрация постов, агрегация метрик
   - Analytics: postSummaries, chart datasets
   - DashboardPosts: stats calculation
2. `React.memo` для чистых компонентов:
   - StatCard, TimelineRow, PostRect, CameraIcon
3. Code splitting (lazy loading):
   - `React.lazy()` для каждой страницы
   - `Suspense` с loading fallback
   - Уменьшит initial bundle с 1.5MB до ~300KB
4. STOMap: debounce resize handler
5. Data1C: Excel parsing в Web Worker
6. Events: серверная пагинация (limit/offset)
7. Таблицы: виртуализация (react-virtual) для 1000+ строк
8. Картинки: lazy loading, WebP формат

### Результат:
- Initial load < 1 сек
- Smooth UI при больших данных
- Нет фриз при Excel парсинге

---

## ЭТАП 8: Камеры (HLS/RTSP streaming)
**Приоритет:** СРЕДНИЙ | **Срок:** 3-4 дня

### Что сделать:
1. Backend: FFmpeg процесс для RTSP → HLS конвертации
2. API: `GET /api/cameras/:id/stream` → HLS manifest URL
3. API: `POST /api/cameras/:id/start`, `POST /api/cameras/:id/stop`
4. Фронтенд: интегрировать hls.js или video.js
5. Заменить placeholder в CameraStreamModal на реальный плеер
6. Контролы: play/pause, fullscreen, snapshot
7. Статус камер: online/offline/error
8. Запись фрагментов (последние 30 сек)
9. Overlay: timestamp, camera name, zone
10. Карта СТО: превью с камер в реальном времени

### Результат:
- Реальные видеопотоки с камер
- Контролы стрима
- Запись фрагментов

---

## ЭТАП 9: TypeScript
**Приоритет:** НИЗКИЙ | **Срок:** 3-5 дней

### Что сделать:
1. Переименовать `.jsx` → `.tsx`
2. Определить интерфейсы:
   ```typescript
   interface Post { id: string; number: number; name: string; type: PostType; status: PostStatus; ... }
   interface User { id: string; email: string; role: UserRole; pages: PageId[]; ... }
   interface WorkOrder { id: string; orderNumber: string; ... }
   interface Event { id: string; type: EventType; ... }
   ```
3. Типизировать API client (generic fetch wrapper)
4. Типизировать React contexts (AuthContext, ThemeContext)
5. Типизировать component props
6. Strict mode в tsconfig
7. Убрать `any` типы

### Результат:
- Type safety
- Автодополнение IDE
- Раннее обнаружение ошибок

---

## ЭТАП 10: Компонентный рефакторинг
**Приоритет:** НИЗКИЙ | **Срок:** 2 дня

### Что сделать:
1. Извлечь из DashboardPosts.jsx (963 LOC):
   - `<GanttTimeline />` — основная визуализация
   - `<ShiftSettings />` — модалка настроек
   - `<FreeWorkOrdersTable />` — уже есть, вынести в отдельный файл
   - `<TimelineHeader />` — уже есть, вынести
2. Извлечь из PostsDetail.jsx (1169 LOC):
   - `<PostCalendar />` — календарный вид
   - `<PostCardsView />` — плитки
   - `<PostTableView />` — табличный вид
   - `<CollapsibleSection />` — уже есть, вынести
3. Создать shared компоненты:
   - `<Modal />` — единый модал (backdrop, close, title)
   - `<DataTable />` — таблица с сортировкой/фильтрацией
   - `<GlassTooltip />` — glassmorphism tooltip
   - `<PeriodSelector />` — переключатель периодов
   - `<StatusBadge />` — бейдж статуса
4. Убрать дублирование CameraStreamModal (MapView + Cameras)

### Результат:
- Файлы < 300 LOC
- Переиспользуемые компоненты
- Легче тестировать

---

## ЭТАП 11: Полная i18n
**Приоритет:** НИЗКИЙ | **Срок:** 1 день

### Что сделать:
1. Перенести все захардкоженные строки в ru.json/en.json:
   - STOMap.jsx: STATUS_LABELS (8 строк)
   - Events.jsx: EVENT_TYPES (10 строк)
   - Cameras.jsx: TYPE_LABELS_RU (5 строк)
   - MapView.jsx: stat labels (8 строк)
   - DashboardPosts.jsx: stat labels (7 строк)
   - Dashboard.jsx: "Все" / "All" (1 строка)
   - App.jsx: "Loading..." (1 строка)
   - ~50 строк всего
2. Аудит en.json — проверить полноту
3. Использовать `i18n.language` вместо `'ru-RU'` для дат
4. Добавить pluralization rules
5. Lazy load языковых файлов

### Результат:
- 0 захардкоженных строк
- Полная EN версия
- Готовность к новым языкам

---

## ЭТАП 12: Тесты
**Приоритет:** НИЗКИЙ | **Срок:** 5+ дней

### Что сделать:
1. Настройка:
   - Vitest (unit/component tests)
   - React Testing Library
   - Playwright (E2E)
   - Coverage reporting
2. Unit тесты:
   - `buildPermissions()` — 10 кейсов
   - `translateZone()`, `translatePost()` — 5 кейсов
   - `loadColor()`, `effColor()` — 6 кейсов
   - Sort functions — 8 кейсов
   - Excel parser — 5 кейсов
3. Component тесты:
   - Login: valid/invalid credentials
   - Sidebar: permission-based rendering
   - Dashboard: stat cards rendering
   - PostsDetail: cards/table toggle
   - Users: CRUD flow
4. Integration тесты:
   - Login → Dashboard → PostsDetail → Back
   - Create user → Login as new user → See limited pages
   - Import Excel → See data in tables
5. E2E тесты (Playwright):
   - Full user journey
   - Theme switching
   - Language switching
   - File upload
6. API тесты:
   - Auth endpoints
   - CRUD endpoints
   - Validation errors

### Результат:
- >80% coverage
- CI/CD pipeline ready
- Confidence в рефакторинге

---

## Порядок выполнения

```
Неделя 1: ЭТАПЫ 1 + 2 (бэкенд + авторизация)
Неделя 2: ЭТАПЫ 3 + 4 (WebSocket + error handling)
Неделя 3: ЭТАПЫ 5 + 6 + 7 (state + constants + performance)
Неделя 4: ЭТАП 8 (камеры)
Неделя 5: ЭТАПЫ 9 + 10 (TypeScript + компоненты)
Неделя 6: ЭТАПЫ 11 + 12 (i18n + тесты)
```

---

## Зависимости между этапами

```
ЭТАП 1 (бэкенд) ──→ ЭТАП 2 (auth) ──→ ЭТАП 3 (WebSocket)
                                        ↓
ЭТАП 6 (constants) ──→ ЭТАП 10 (компоненты) ──→ ЭТАП 9 (TypeScript)
                                                  ↓
ЭТАП 7 (perf) ─────────────────────────────→ ЭТАП 12 (тесты)
                                                  ↑
ЭТАП 4 (errors) ──→ ЭТАП 5 (state) ──────────────┘

ЭТАП 8 (камеры) — независимый
ЭТАП 11 (i18n) — независимый
```

---

## Риски

| Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|
| PostgreSQL недоступен в Docker | Средняя | Высокое | Fallback на SQLite |
| RTSP камеры не отвечают | Высокая | Среднее | Mock streams для демо |
| Большие Excel файлы (10k+ строк) | Средняя | Среднее | Web Worker + пагинация |
| Миграция данных из JSON | Низкая | Низкое | Seed script |

---

## Команда для запуска

Когда Артём скажет "запускай PHOENIX" — начинаем с ЭТАПА 1.

---

*"Из пепла прототипа восстанет production-ready система."*
