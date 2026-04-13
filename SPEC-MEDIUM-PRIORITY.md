# Спецификация: Средний приоритет

> 5 задач | Общая оценка: 3-4 часа

---

## MP-1. Общий компонент Pagination

### Проблема
Пагинация дублируется в 6 страницах с тремя разными паттернами:
- **Pattern A** (Sessions, WorkOrders): полноценная пагинация с номерами страниц, ellipsis, select perPage, «...из N»
- **Pattern B** (Audit, Events): иконочная пагинация (ChevronLeft/Right), compact
- **Pattern C** (Dashboard): простая пагинация (только номера страниц)

Каждая реализация: ~40-60 строк JSX, повторяющийся код.

### Решение

#### Новый файл: `frontend/src/components/Pagination.jsx`

```jsx
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Props:
 * @param {number} page          - текущая страница (1-indexed)
 * @param {number} totalPages    - всего страниц
 * @param {number} totalItems    - всего записей
 * @param {number} perPage       - записей на странице
 * @param {number[]} perPageOptions - варианты [10, 20, 50, 100]
 * @param {function} onPageChange    - (page) => void
 * @param {function} onPerPageChange - (perPage) => void
 * @param {boolean} compact      - компактный режим (без номеров страниц)
 * @param {boolean} showPerPage  - показывать select perPage
 * @param {object} t             - i18n функция или { of: 'из', rowsPerPage: 'Строк:' }
 */
export default function Pagination({
  page, totalPages, totalItems, perPage,
  perPageOptions = [10, 20, 50, 100],
  onPageChange, onPerPageChange,
  compact = false,
  showPerPage = true,
  t,
}) {
  if (totalPages <= 1 && !showPerPage) return null;

  const isRu = typeof t === 'function'
    ? t('common.of') === 'из'
    : false;
  const ofLabel = isRu ? 'из' : 'of';
  const rowsLabel = isRu ? 'Строк на странице:' : 'Rows per page:';

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, totalItems);

  // Генерация номеров с ellipsis
  const pageNumbers = [];
  if (!compact) {
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
        pageNumbers.push(i);
      } else if (pageNumbers[pageNumbers.length - 1] !== '...') {
        pageNumbers.push('...');
      }
    }
  }

  const btnStyle = (disabled) => ({
    background: 'var(--bg-glass)',
    color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      {/* Left: info + perPage */}
      <div className="flex items-center gap-2">
        {showPerPage && onPerPageChange && (
          <>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {rowsLabel}
            </span>
            <select
              value={perPage}
              onChange={(e) => {
                onPerPageChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="px-2 py-1 rounded-lg text-xs outline-none cursor-pointer"
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
              }}
            >
              {perPageOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </>
        )}
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {from}–{to} {ofLabel} {totalItems}
        </span>
      </div>

      {/* Right: navigation */}
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={page === 1}
          className="p-1 rounded-lg text-xs disabled:cursor-default" style={btnStyle(page === 1)}>
          {compact ? <ChevronsLeft size={16} /> : '«'}
        </button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
          className="p-1 rounded-lg text-xs disabled:cursor-default" style={btnStyle(page === 1)}>
          {compact ? <ChevronLeft size={16} /> : '‹'}
        </button>

        {compact ? (
          <span className="text-xs px-2 font-medium" style={{ color: 'var(--text-primary)' }}>
            {page} / {totalPages}
          </span>
        ) : (
          pageNumbers.map((p, i) =>
            p === '...' ? (
              <span key={`dot-${i}`} className="px-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                ...
              </span>
            ) : (
              <button key={p} onClick={() => onPageChange(p)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: page === p ? 'var(--accent)' : 'var(--bg-glass)',
                  color: page === p ? 'white' : 'var(--text-muted)',
                }}>
                {p}
              </button>
            )
          )
        )}

        <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages}
          className="p-1 rounded-lg text-xs disabled:cursor-default" style={btnStyle(page === totalPages)}>
          {compact ? <ChevronRight size={16} /> : '›'}
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={page === totalPages}
          className="p-1 rounded-lg text-xs disabled:cursor-default" style={btnStyle(page === totalPages)}>
          {compact ? <ChevronsRight size={16} /> : '»'}
        </button>
      </div>
    </div>
  );
}
```

#### Использование в страницах

**Sessions.jsx** (замена ~55 строк → 1 строка):
```jsx
import Pagination from '../components/Pagination';

<Pagination
  page={page} totalPages={totalPages} totalItems={filtered.length}
  perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}
/>
```

**Audit.jsx** (компактный режим):
```jsx
<Pagination
  page={page + 1} totalPages={totalPages} totalItems={filtered.length}
  perPage={perPage} onPageChange={(p) => setPage(p - 1)}
  onPerPageChange={setPerPage} compact
/>
```

**Dashboard.jsx** (простой, без perPage):
```jsx
<Pagination
  page={recPage} totalPages={recTotalPages} totalItems={recommendations.length}
  perPage={perPage} onPageChange={setRecPage} showPerPage={false}
/>
```

### Страницы для рефакторинга
| Страница | Текущий размер блока | После |
|----------|---------------------|-------|
| Sessions.jsx | ~55 строк | 4 строки |
| WorkOrders.jsx | ~55 строк | 4 строки |
| Audit.jsx | ~38 строк | 4 строки |
| Events.jsx | ~30 строк | 4 строки |
| Dashboard.jsx (recommendations) | ~18 строк | 4 строки |
| Dashboard.jsx (events) | ~18 строк | 4 строки |

### Ожидаемый эффект
- ~210 строк дублирования → 1 компонент ~100 строк
- Единый UI/UX пагинации
- Проще менять стиль — одно место

### Риск: **Низкий** — чистый рефакторинг UI

---

## MP-2. Хук useAsync для API-запросов

### Проблема
В 18+ страницах повторяется один и тот же паттерн:
```javascript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  setLoading(true);
  api.get('/api/something')
    .then(res => setData(res.data))
    .catch(console.error)
    .finally(() => setLoading(false));
}, [dependency]);
```

Это 8-10 строк boilerplate на каждый API-запрос. Многие страницы имеют 2-3 таких блока.

### Решение

#### Новый файл: `frontend/src/hooks/useAsync.js`

```javascript
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * useAsync — универсальный хук для API-запросов
 *
 * @param {string} url            - API endpoint
 * @param {object} options        - { enabled, deps, transform, initialData }
 * @returns {{ data, loading, error, refetch }}
 *
 * Примеры:
 *   const { data, loading } = useAsync('/api/sessions?status=active');
 *   const { data, refetch } = useAsync('/api/users', { deps: [filter] });
 *   const { data } = useAsync('/api/stats', { transform: r => r.stats });
 */
export default function useAsync(url, options = {}) {
  const {
    enabled = true,
    deps = [],
    transform = null,
    initialData = null,
  } = options;

  const { api } = useAuth();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled || !url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url);
      if (!mountedRef.current) return;
      const result = transform ? transform(res) : res.data ?? res;
      setData(result);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err);
      console.error(`[useAsync] ${url}:`, err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [url, enabled, ...deps]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
```

#### Использование в страницах

**До (Sessions.jsx, ~10 строк):**
```javascript
const [sessions, setSessions] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  setLoading(true);
  api.get(`/api/sessions?status=${status}`)
    .then(res => setSessions(res.data.sessions || []))
    .catch(console.error)
    .finally(() => setLoading(false));
}, [status]);
```

**После (3 строки):**
```javascript
const { data: sessions = [], loading, refetch } = useAsync(
  `/api/sessions?status=${status}`,
  { deps: [status], transform: r => r.data.sessions || [] }
);
```

**Analytics.jsx:**
```javascript
const { data: history = [], loading } = useAsync('/api/analytics-history', {
  transform: r => r.data,
});
```

### Страницы для рефакторинга
Все страницы с `api.get` в `useEffect`: Sessions, WorkOrders, Analytics, Events, Audit, Dashboard, Cameras, Health, Shifts, Users, CameraMapping, MyPost, WorkerStats, ReportSchedule, PostsDetail, DashboardPosts — **16+ страниц**.

### Ожидаемый эффект
- ~160+ строк boilerplate → 1 хук 60 строк
- Единообразная обработка loading/error
- `refetch` для ручного обновления (pull-to-refresh, after mutation)
- `mountedRef` предотвращает setState на unmounted компонентах

### Риск: **Низкий** — постепенный рефакторинг, страница за страницей

---

## MP-3. Structured Logging (Winston)

### Проблема
Backend использует `console.log`/`console.error` повсеместно (~50+ мест). Нет:
- Уровней логирования (debug/info/warn/error)
- Структурированного формата (JSON)
- Ротации файлов
- Контекста запроса (requestId, userId)

### Решение

#### Установка
```bash
cd /project/backend && npm install winston
```

#### Новый файл: `backend/src/config/logger.js`

```javascript
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? format.json()
      : format.combine(format.colorize(), format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${message}${metaStr}`;
        }))
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: '/project/logs/error.log',
      level: 'error',
      maxsize: 5 * 1024 * 1024,  // 5MB
      maxFiles: 3,
    }),
    new transports.File({
      filename: '/project/logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});

module.exports = logger;
```

#### Миграция (постепенная)

**Фаза 1:** Заменить в index.js, services:
```javascript
const logger = require('./config/logger');

// Было:
console.log('[Server] HTTP running on port 3001');
// Стало:
logger.info('HTTP server started', { port: 3001 });

// Было:
console.error('[DemoGen] Error:', err.message);
// Стало:
logger.error('DemoGen failed', { error: err.message });
```

**Фаза 2:** Middleware для request logging (замена morgan):
```javascript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: Date.now() - start,
      userId: req.user?.id,
    });
  });
  next();
});
```

**Фаза 3:** Заменить console.log/error в routes и services.

### Файлы для изменения
| Файл | console.log/error | Приоритет |
|------|-------------------|-----------|
| index.js | ~15 | Высокий |
| eventProcessor.js | ~8 | Высокий |
| services/*.js (6 файлов) | ~20 | Средний |
| routes/*.js (22 файла) | ~10 | Низкий |

### Ожидаемый эффект
- JSON-логи для production (парсинг в ELK/Grafana)
- Ротация файлов (не переполняет диск)
- Уровни логирования (LOG_LEVEL=warn в production)
- Контекст запроса (userId, method, url, duration)

### Риск: **Низкий** — постепенная миграция, `console.*` продолжает работать

---

## MP-4. API Documentation (OpenAPI/Swagger)

### Проблема
70+ эндпоинтов без документации. Новому разработчику нужно читать код чтобы понять API.

### Решение

#### Установка
```bash
cd /project/backend && npm install swagger-jsdoc swagger-ui-express
```

#### Конфигурация в `index.js`

```javascript
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MetricsAiUp API',
      version: '1.0.0',
      description: 'API мониторинга СТО',
    },
    servers: [
      { url: 'https://artisom.dev.metricsavto.com:3444', description: 'HTTPS' },
      { url: 'http://localhost:3001', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

#### Аннотации в маршрутах (пример `routes/sessions.js`)

```javascript
/**
 * @openapi
 * /api/sessions:
 *   get:
 *     summary: Список сессий
 *     tags: [Sessions]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Список сессий
 */
router.get('/', authenticate, asyncHandler(async (req, res) => { ... }));
```

### Порядок документирования (по приоритету)
1. **auth** — login, refresh, me (используют все клиенты)
2. **dashboard** — overview, metrics, trends, live
3. **work-orders** — CRUD, import, start/pause/complete
4. **sessions** — active, completed
5. **posts, zones** — CRUD
6. Остальные 17 модулей — по мере необходимости

### Ожидаемый эффект
- Swagger UI на `/api-docs`
- Интерактивное тестирование API
- Auto-generated TypeScript клиент (через openapi-generator)

### Риск: **Низкий** — additive, не меняет runtime

---

## MP-5. Увеличение покрытия тестами

### Текущее состояние
- 24 тестовых файла
- Страницы: 0% покрытие
- Контексты: 0%
- Хуки: ~15% (только useWorkOrderTimer)
- Компоненты: ~20% (базовые snapshot-тесты)
- Utils: ~60%

### Целевое покрытие: 60%

### Приоритеты тестирования

#### Фаза 1: Критические контексты и хуки
```
frontend/src/contexts/__tests__/
  AuthContext.test.jsx     — login, logout, permissions, API wrapper
  ToastContext.test.jsx    — success/error/warning, auto-dismiss

frontend/src/hooks/__tests__/
  useAsync.test.js         — loading, error, refetch, transform
  useSocket.test.js        — connect, subscribe, polling
```

#### Фаза 2: Ключевые компоненты
```
frontend/src/components/__tests__/
  Pagination.test.jsx      — page navigation, perPage change
  ErrorBoundary.test.jsx   — error catch, retry
  Sidebar.test.jsx         — role-based filtering
  ShiftSettings.test.jsx   — week schedule, copy to all
```

#### Фаза 3: Backend маршруты (integration)
```
backend/src/__tests__/
  auth.test.js             — login, register, refresh, permissions
  workOrders.test.js       — CRUD, schedule, start/complete
  sessions.test.js         — list, filter, pagination
  dashboard.test.js        — overview, metrics, trends
```

#### Фаза 4: Backend сервисы
```
backend/src/services/__tests__/
  eventProcessor.test.js   — event handling, session creation
  recommendationEngine.test.js — threshold checks, dedup
```

### Инструменты
- **Frontend:** Vitest + @testing-library/react (уже установлены)
- **Backend:** Vitest (уже в devDependencies)
- **Mocking:** vi.mock для Prisma, fetch

### Ожидаемый эффект
- Защита от регрессий при рефакторинге
- Документация поведения через тесты
- CI/CD-ready (vitest --coverage)

### Риск: **Низкий** — тесты не влияют на production

---

## Порядок выполнения

| # | Задача | Оценка | Зависимости | Риск |
|---|--------|--------|-------------|------|
| 1 | MP-1: Pagination | 40 мин | нет | Низкий |
| 2 | MP-2: useAsync | 30 мин | нет | Низкий |
| 3 | MP-3: Winston | 45 мин | нет | Низкий |
| 4 | MP-4: Swagger | 60 мин | нет | Низкий |
| 5 | MP-5: Тесты | 2-3 часа | MP-1, MP-2 (тестировать новое) | Низкий |

**Общее время:** ~5-6 часов
**Параллельность:** MP-1, MP-2, MP-3, MP-4 — независимы
**MP-5** лучше делать после MP-1 и MP-2 (тестировать новые компоненты)
