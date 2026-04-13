# Спецификация: Высокий приоритет

> 5 задач | Общая оценка: ~1-1.5 часа

---

## HP-1. Индексы базы данных

### Проблема
Отсутствуют индексы на часто фильтруемых полях. Запросы к сессиям, постам, заказ-нарядам, event processor делают full table scan по SQLite.

### Затронутые модели и поля

**Tier 1 — Критические (event processing, dashboard):**

| Модель | Поле(я) | Тип | Кто использует |
|--------|---------|-----|----------------|
| `VehicleSession` | `status` | single | sessions.js, dashboard.js (`/overview`, `/live`) |
| `VehicleSession` | `trackId, status` | composite | eventProcessor.js — `findFirst` при каждом CV-событии |
| `PostStay` | `vehicleSessionId, endTime` | composite | eventProcessor.js — поиск открытых stay (5+ вызовов) |
| `PostStay` | `postId, endTime` | composite | eventProcessor.js — handleWorkerPresent, handleWorkActivity |
| `Post` | `isActive` | single | posts.js, dashboard.js, postsData.js — каждый запрос постов |
| `WorkOrder` | `status, scheduledTime` | composite | workOrders.js, recommendationEngine.js |

**Tier 2 — Операционные:**

| Модель | Поле(я) | Тип | Кто использует |
|--------|---------|-----|----------------|
| `Zone` | `isActive` | single | zones.js — все запросы зон |
| `Post` | `zoneId` | single | posts.js — фильтр по зоне |
| `Recommendation` | `status` | single | recommendations.js, dashboard.js |
| `WorkOrder` | `scheduledTime` | single | postsData.js, dashboard.js — range-запросы |
| `Recommendation` | `type, zoneId, postId, status` | composite | recommendationEngine.js — dedup |

### План реализации

Добавить в `backend/prisma/schema.prisma`:

```prisma
model VehicleSession {
  // ...existing fields...
  @@index([status])
  @@index([trackId, status])
}

model PostStay {
  // ...existing fields...
  @@index([vehicleSessionId, endTime])
  @@index([postId, endTime])
}

model Post {
  // ...existing fields...
  @@index([isActive])
  @@index([zoneId])
}

model Zone {
  // ...existing fields...
  @@index([isActive])
}

model WorkOrder {
  // ...existing fields... (уже есть postNumber, status)
  @@index([status, scheduledTime])
  @@index([scheduledTime])
}

model Recommendation {
  // ...existing fields...
  @@index([status])
  @@index([type, zoneId, postId, status])
}
```

### Шаги
1. Добавить `@@index` директивы в `schema.prisma`
2. `cd backend && npx prisma migrate dev --name add-performance-indexes`
3. `npx prisma migrate status` — проверить
4. Перезапустить backend

### Ожидаемый эффект
- Event processing: -60% латентность (findFirst по trackId)
- Dashboard API: -40% время ответа (status фильтры)
- Recommendation dedup: -50% (composite индекс)

### Риск: **Низкий** (additive миграция, не меняет данные)

---

## HP-2. Кэширование авторизации (In-Memory)

### Проблема
На **каждый** HTTP-запрос выполняется 4-уровневый Prisma include:
```
User → UserRole[] → Role → RolePermission[] → Permission
```
Для пользователя с 2 ролями и 15 permissions = ~35 записей из 5 таблиц на **каждый** запрос.

### Текущий код
`backend/src/middleware/auth.js:19-34`:
```javascript
const user = await prisma.user.findUnique({
  where: { id: payload.userId },
  include: {
    roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
  },
});
```

### Решение: In-Memory Map с TTL + invalidation

#### Новый файл: `backend/src/config/authCache.js`
```javascript
const AUTH_CACHE_TTL = 15 * 60 * 1000; // 15 минут
const cache = new Map();

function get(userId) {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > AUTH_CACHE_TTL) {
    cache.delete(userId);
    return null;
  }
  return entry.data;
}

function set(userId, data) {
  cache.set(userId, { data, ts: Date.now() });
}

function invalidate(userId) {
  cache.delete(userId);
}

function invalidateAll() {
  cache.clear();
}

module.exports = { get, set, invalidate, invalidateAll };
```

#### Изменения в `auth.js`
```javascript
const authCache = require('../config/authCache');

async function authenticate(req, res, next) {
  // ...JWT verify...

  let user = authCache.get(payload.userId);
  if (!user) {
    user = await prisma.user.findUnique({ /* ...existing include... */ });
    if (user) authCache.set(payload.userId, user);
  }

  // ...build permissions, attach req.user...
}
```

#### Invalidation — добавить в `routes/users.js`
```javascript
const authCache = require('../config/authCache');

// PUT /api/users/:id — после обновления:
authCache.invalidate(req.params.id);

// DELETE /api/users/:id — после деактивации:
authCache.invalidate(req.params.id);
```

### Ожидаемый эффект
- 95% cache hit rate (типичная 8-часовая сессия, TTL 15 мин)
- Auth middleware: ~15ms → <1ms на повторных запросах
- Нагрузка на БД: -90% по auth-запросам

### Риск: **Средний** — нужно корректно инвалидировать при смене ролей

---

## HP-3. React ErrorBoundary

### Проблема
Нет Error Boundary — падение любого компонента (ошибка рендера, null reference) роняет всё приложение белым экраном без возможности восстановления.

### Решение

#### Новый файл: `frontend/src/components/ErrorBoundary.jsx`
```jsx
import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8"
          style={{ color: 'var(--text-primary)' }}>
          <AlertTriangle size={48} style={{ color: 'var(--accent)', marginBottom: '1rem' }} />
          <h2 className="text-lg font-bold mb-2">
            {this.props.fallbackTitle || 'Something went wrong'}
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {this.props.retryLabel || 'Retry'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

#### Интеграция в `App.jsx`
Обернуть каждый lazy-loaded route в ErrorBoundary:
```jsx
import ErrorBoundary from './components/ErrorBoundary';

<Route path="/analytics" element={
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}><Analytics /></Suspense>
  </ErrorBoundary>
} />
```

Или обернуть `<Layout>` целиком (проще, защищает все вложенные routes):
```jsx
<Route element={
  <ErrorBoundary fallbackTitle={t('common.errorOccurred')} retryLabel={t('common.retry')}>
    <Layout />
  </ErrorBoundary>
}>
  {/* ...all child routes... */}
</Route>
```

#### i18n ключи (добавить)
```json
// ru.json → common
"errorOccurred": "Произошла ошибка",
"retry": "Повторить"

// en.json → common
"errorOccurred": "Something went wrong",
"retry": "Retry"
```

### Ожидаемый эффект
- Падение одной страницы не роняет приложение
- Пользователь видит понятное сообщение + кнопку «Повторить»
- Console.error сохраняет стектрейс для отладки

### Риск: **Низкий**

---

## HP-4. Удалить неиспользуемый axios

### Проблема
`axios@^1.13.6` в `frontend/package.json` — не используется нигде в коде. Все API-запросы идут через `fetch()` обёртку в `AuthContext.jsx`.

### Шаги
```bash
cd /project/frontend && npm uninstall axios
```

### Проверка
```bash
grep -r "axios" frontend/src/  # должен быть пустой результат
```

### Ожидаемый эффект
- node_modules: -2 MB
- Чище зависимости

### Риск: **Низкий**

---

## HP-5. Очистка stale build assets

### Проблема
В `/project/assets/` скопились ~1,210 старых JS/CSS чанков (~86 MB). Каждый `npm run build && cp -r dist/*` добавляет новые файлы, но не удаляет старые. Это засоряет `git status` и диск.

### Решение

#### Вариант A: Скрипт prebuild (постоянное решение)
Добавить в `frontend/package.json`:
```json
{
  "scripts": {
    "prebuild": "rm -rf ../assets/*.js ../assets/*.css 2>/dev/null || true",
    "build": "vite build"
  }
}
```

#### Вариант B: Одноразовая очистка
```bash
rm -rf /project/assets/*.js /project/assets/*.css
cd /project/frontend && npm run build && cp -r dist/* /project/
```

#### Добавить в `.gitignore`
```
assets/
```

### Ожидаемый эффект
- Дисковое пространство: ~86 MB → ~5 MB
- `git status` чище (нет сотен untracked файлов)

### Риск: **Низкий** — assets пересоздаются при каждом билде

---

## Порядок выполнения

| # | Задача | Оценка | Зависимости | Риск |
|---|--------|--------|-------------|------|
| 1 | HP-4: Удалить axios | 2 мин | нет | Низкий |
| 2 | HP-5: Очистка assets | 5 мин | нет | Низкий |
| 3 | HP-3: ErrorBoundary | 15 мин | нет | Низкий |
| 4 | HP-1: DB индексы | 10 мин | нет | Низкий |
| 5 | HP-2: Auth кэш | 30 мин | нет | Средний |

**Общее время:** ~1–1.5 часа
**Параллельность:** HP-1, HP-3, HP-4, HP-5 — полностью независимы
