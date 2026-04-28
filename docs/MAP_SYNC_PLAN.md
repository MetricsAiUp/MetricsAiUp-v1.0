# План: автопропагация элементов карты (Map → Post/Zone/Camera)

**Автор:** Артём
**Ветка:** `artisom`
**Бэкап перед началом:** `backup/artisom-pre-mapsync` (от коммита `bcb572d`)
**Дата:** 2026-04-28

## Цель
Сделать так, чтобы при добавлении / удалении / переименовании поста, зоны или камеры в `MapEditor`, изменение автоматически попадало во все нужные места:
- БД (Prisma-таблицы `Post`, `Zone`, `Camera`)
- API-ответы (`/api/posts`, `/api/zones`, `/api/cameras`, `/api/predict`, `/api/posts-analytics`, `/api/monitoring/*`)
- Demo-генератор (`generateDemoData.js`, `seedDemoDb.js`)
- Frontend (динамические имена через API, без хардкода в `i18n`)

После реализации **никакого хардкода `<= 11` или `POST_TYPES = {1: 'heavy', ...}`** в коде остаться не должно.

---

## Текущая проблема (хардкод по файлам)

| Файл | Что захардкожено |
|------|------------------|
| `backend/src/routes/postsData.js` | `POST_TYPES`, `POST_ZONES`, два цикла `for (let num = 1; num <= 11; num++)` |
| `backend/src/routes/predict.js` | `Array.from({ length: 11 })` (строки 38, 70) |
| `backend/src/services/monitoringProxy.js` | `postNum <= 11`, regex-парсинг имён зон |
| `backend/src/generateDemoData.js` | `for (let i = 1; i <= 11; i++)` + if-цепочка типов |
| `backend/src/seedDemoDb.js` | то же самое |
| `frontend/src/i18n/ru.json`, `en.json` | ключи `posts.post1` … `posts.post11` |

---

## Этап А — БД и синхронизация (безопасно: только добавляем данные)

### Шаг 1. Расширить Prisma-схему

**Файл:** `backend/prisma/schema.prisma`

**Что добавляем:**

```prisma
model Post {
  // ... существующие поля
  type             String    @default("light")   // heavy | light | special
  displayName      String?                        // "Пост 4 — легковое"
  displayNameEn    String?                        // "Post 4 — light vehicles"
  externalZoneName String?                        // "Пост 04 — легковое/грузовое" (из CV API)
  externalAliases  String?                        // JSON-массив доп. имён
  deleted          Boolean   @default(false)
  deletedAt        DateTime?
}

model Zone {
  // ... существующие поля
  displayName    String?
  displayNameEn  String?
  category       String   @default("repair")     // repair | waiting | entry | parking | free
  deleted        Boolean  @default(false)
  deletedAt      DateTime?
}

model Camera {
  // ... существующие поля
  deleted    Boolean   @default(false)
  deletedAt  DateTime?
}
```

**Команда:**
```bash
cd backend && npx prisma migrate dev --name add_map_propagation_fields
```

**Результат:** в БД появились новые nullable-поля. Существующие данные не сломаны. Старый код продолжает работать.

---

### Шаг 2. Сервис синхронизации MapLayout → Post/Zone/Camera

**Файл:** `backend/src/services/mapSyncService.js` *(новый)*

**Что делает функция `syncMapLayoutToEntities(layout)`:**
1. Парсит `layout.elements` — массив элементов карты.
2. Группирует по типу: `post`, `zone`, `camera`.
3. Для каждого элемента из карты — `prisma.X.upsert()` (создаёт или обновляет).
4. Для записей в БД, которых **нет** в карте — `deleted = true` (soft-delete, FK не ломаем).
5. Эмитит Socket.IO события: `post:created`, `post:updated`, `post:deleted`, аналогично для zone/camera.

**Псевдокод:**
```js
async function syncMapLayoutToEntities(layout) {
  const elements = layout.elements || [];
  const postsInMap = elements.filter(e => e.type === 'post');

  // Upsert постов из карты
  for (const el of postsInMap) {
    await prisma.post.upsert({
      where: { number: el.number },
      update: {
        type: el.postType || 'light',
        displayName: el.label,
        displayNameEn: el.labelEn,
        externalZoneName: el.externalZoneName,
        deleted: false,
        deletedAt: null,
      },
      create: {
        number: el.number,
        type: el.postType || 'light',
        displayName: el.label,
        displayNameEn: el.labelEn,
        externalZoneName: el.externalZoneName,
        status: 'free',
      },
    });
  }

  // Soft-delete постов которых больше нет в карте
  const numbersInMap = postsInMap.map(p => p.number);
  await prisma.post.updateMany({
    where: { number: { notIn: numbersInMap }, deleted: false },
    data: { deleted: true, deletedAt: new Date() },
  });

  // Аналогично для зон и камер
  // ...
}
```

**Результат:** одна функция, которая приводит БД в соответствие с картой. Может быть вызвана из любого места (endpoint, миграция, админ-команда).

---

### Шаг 3. Подключить sync к endpoint сохранения карты

**Файл:** `backend/src/routes/mapLayout.js`

**Что меняем:** в `PUT /api/map-layout` после сохранения слоя — вызываем `syncMapLayoutToEntities(layout)`.

```js
router.put('/', authenticate, requirePermission('manage_map'), async (req, res) => {
  const layout = await prisma.mapLayout.update({ where: { id: 1 }, data: { ... } });
  await syncMapLayoutToEntities(layout);   // ← новое
  res.json(layout);
});
```

**Также:** добавить вызов sync в `POST /api/map-layout/restore/:versionId` (после восстановления версии).

**Результат:** любое сохранение карты в редакторе автоматически обновляет таблицы Post/Zone/Camera. Делать ничего вручную не нужно.

---

### Шаг 4. Bootstrap-миграция текущих данных

**Файл:** `backend/scripts/migrateMapToEntities.js` *(новый)*

**Что делает:**
1. Читает текущий `MapLayout` из БД.
2. Для каждого поста — проставляет `type` по правилу bootstrap (1-4 = heavy, 5-8 + 11 = light, 9-10 = special) и `displayName` из `i18n/ru.json`, `displayNameEn` из `en.json`.
3. Заполняет `externalZoneName` для постов: например `Post 4` → `"Пост 04 — легковое/грузовое"`.
4. Вызывает `syncMapLayoutToEntities()`.

**Команда:**
```bash
cd backend && node scripts/migrateMapToEntities.js
```

**Результат:** все 11 постов, все зоны и камеры теперь нормализованно лежат в БД с заполненными `type`, `displayName`, `externalZoneName`. Скрипт идемпотентный — можно запускать повторно.

---

### Коммит этапа А

```
git add backend/prisma backend/src/services/mapSyncService.js backend/src/routes/mapLayout.js backend/scripts/migrateMapToEntities.js
git commit -m "feat: map layout sync service + Post/Zone/Camera propagation schema"
```

**Что проверить после коммита:**
- `npx prisma migrate status` — миграция применена.
- Открыть `MapEditor`, добавить тестовый "Пост 99", сохранить. Проверить `prisma studio` — пост 99 появился в БД.
- Удалить пост 99 из карты, сохранить. Проверить `Post.where(number=99)` — `deleted=true`.

---

## Этап Б — Убираем хардкод (по файлу за коммит)

### Шаг 5.1. `backend/src/routes/postsData.js`

**Удаляем:**
- Константы `POST_TYPES`, `POST_ZONES` (строки 5-16)

**Меняем:**
- Циклы `for (let num = 1; num <= 11; num++)` (строки 437, 675) → `prisma.post.findMany({ where: { deleted: false }, orderBy: { number: 'asc' } })`
- `POST_TYPES[num]` → `post.type`
- `POST_ZONES[num]` → имя зоны через join: `post.zone.displayName` (либо отдельный запрос)

**Коммит:**
```
git commit -m "refactor: postsData.js reads posts from DB instead of hardcoded constants"
```

**Что проверить:** `/api/posts-analytics`, `/api/dashboard-posts` отдают то же самое что раньше.

---

### Шаг 5.2. `backend/src/routes/predict.js`

**Меняем:**
- `Array.from({ length: 11 }, (_, i) => i + 1)` → `(await prisma.post.findMany({ where: { deleted: false } })).map(p => p.number)`

**Коммит:**
```
git commit -m "refactor: predict.js uses dynamic post list from DB"
```

**Что проверить:** `/api/predict/load`, `/api/predict/free` работают.

---

### Шаг 5.3. `backend/src/services/monitoringProxy.js`

**Меняем:**
- `postNum <= 11` → проверка существования поста в БД через lookup-таблицу.
- Парсинг имён зон CV API: вместо regex `^Пост\s+(\d{2})` — поиск по `Post.externalZoneName` и `Post.externalAliases`.
- Загружаем при старте сервиса карту имён `externalZoneName` → `Post.id`/`number`. Кэшируем, инвалидируем по Socket.IO событию `post:updated`.

**Коммит:**
```
git commit -m "refactor: monitoringProxy maps CV zones via Post.externalZoneName lookup"
```

**Что проверить:** `/api/monitoring/state`, `/api/monitoring/post-history/4` возвращают данные.

---

### Шаг 5.4. `backend/src/generateDemoData.js`

**Меняем:**
- Цикл `for (let i = 1; i <= 11; i++)` → `for (const post of await prisma.post.findMany({ where: { deleted: false } }))`
- Тип определяется через `post.type`, не if-цепочкой.
- Массив зон строится из `prisma.zone.findMany()`.

**Коммит:**
```
git commit -m "refactor: generateDemoData reads posts/zones from DB"
```

**Что проверить:** demo-режим — переключиться на demo, дождаться генерации (2 мин), проверить Dashboard.

---

### Шаг 5.5. `backend/src/seedDemoDb.js`

**Меняем:** аналогично шагу 5.4 — список постов и типов из БД.

**Коммит:**
```
git commit -m "refactor: seedDemoDb uses DB posts/zones definitions"
```

**Что проверить:** на чистой БД запустить seed — посты создаются с правильными `type`/`displayName`.

---

## Этап В — Frontend

### Шаг 6.1. Расширить API ответ для `/api/posts`, `/api/zones`, `/api/cameras`

Добавить в response поля `displayName`, `displayNameEn`, `type`, `category` (для zones).

**Коммит:**
```
git commit -m "feat: API returns displayName/type fields for posts/zones"
```

---

### Шаг 6.2. Использовать `displayName` в компонентах

**Где менять:** все места, где сейчас `t(\`posts.post${number}\`)` — заменить на `post.displayName || \`${t('posts.label')} ${post.number}\``. С учётом локали:

```jsx
const name = i18n.language === 'en'
  ? (post.displayNameEn || `${t('posts.label')} ${post.number}`)
  : (post.displayName || `${t('posts.label')} ${post.number}`);
```

**Удалить из i18n:**
- Из `frontend/src/i18n/ru.json` — ключи `posts.post1` … `posts.post11`.
- Из `frontend/src/i18n/en.json` — то же самое.
- Оставить `posts.label = "Пост" / "Post"`.

**Коммит:**
```
git commit -m "feat: frontend uses dynamic post displayName from API instead of i18n hardcode"
```

**Что проверить:** Dashboard, MapViewer, PostsDetail, DashboardPosts отображают имена постов корректно на ru и en.

---

### Шаг 7. UI редактирования свойств элемента в MapEditor

**Файл:** `frontend/src/pages/MapEditor.jsx`

**Что добавить:** при выделении элемента — боковая панель свойств:

**Для поста:**
- Номер (number, integer)
- Тип (select: heavy / light / special)
- Название RU (displayName)
- Название EN (displayNameEn)
- Имя в CV API (externalZoneName)

**Для зоны:**
- Имя (name)
- Категория (select: repair / waiting / entry / parking / free)
- Название RU/EN
- Список номеров постов (array)

**Для камеры:**
- Имя (name)
- RTSP URL
- HLS URL
- Список зон с приоритетами

**Что сохраняется:** при `Save Layout` все эти поля летят в `MapLayout.elements[]` и подхватываются `mapSyncService` (Шаг 3).

**Коммит:**
```
git commit -m "feat: MapEditor properties panel for posts/zones/cameras"
```

**Что проверить:** добавить в редакторе "Пост 12" с типом "light" и именем "Пост 12 — экспресс". Сохранить. Проверить:
- В `/api/posts` появился пост 12.
- В Dashboard / MapViewer он есть.
- В CV-API маппинге работает (если задали `externalZoneName`).

---

## Этап Г — Тесты и деплой

### Шаг 8. Тесты

**Backend (Vitest):**
- `backend/src/services/__tests__/mapSyncService.test.js`:
  - Добавили пост в layout → upsert.
  - Убрали пост из layout → soft-delete.
  - Переименовали пост → update displayName.
  - Камера/зона аналогично.
- `backend/src/routes/__tests__/mapLayout.test.js`:
  - PUT карты → sync вызвался.
  - Restore версии → sync вызвался.

**Frontend (Vitest):**
- Smoke-тесты страниц (уже есть) — должны не сломаться после удаления `posts.postN` из i18n.
- Новый тест: `MapEditor` сохраняет поля свойств в layout.

**Команды:**
```bash
cd backend && npm test
cd frontend && npm test
```

**Коммит:**
```
git commit -m "test: map sync service + MapEditor properties tests"
```

---

### Шаг 9. Билд и деплой

```bash
cd /project/frontend && npm run build && cp -r dist/* /project/
# в sw.js бампим CACHE_NAME (текущий v23 → v24)
```

Перезапуск backend:
```bash
pkill -f 'node src/index.js' && cd /project/backend && nohup node src/index.js > /tmp/backend.log 2>&1 & disown
```

**Коммит:**
```
git commit -m "build: bump cache version after map sync rollout"
```

---

## Финальный итог

| Этап | Коммитов | Что получаем |
|------|----------|--------------|
| А (схема + sync + миграция) | 1 | БД готова, sync работает на сохранении карты |
| Б (удаление хардкода) | 5 | Backend полностью динамический |
| В (frontend) | 3 | UI отображает динамические имена + редактор свойств |
| Г (тесты + деплой) | 2 | Регрессия защищена, прод работает |
| **Итого** | **~11 коммитов** | **Map → авто-БД → авто-API → авто-UI** |

---

## Пользовательский сценарий после реализации

1. Артём в MapEditor перетаскивает на карту "Пост 12".
2. В панели свойств справа выбирает тип "light", вписывает "Пост 12 — экспресс-замена" и `externalZoneName = "Пост 12 — экспресс"`.
3. Жмёт "Сохранить".
4. Сразу:
   - Dashboard показывает 12 постов.
   - MapViewer рисует пост с именем.
   - Analytics строит по нему графики.
   - monitoringProxy при следующем polling-цикле подхватит зону из CV-API через `externalZoneName`.
5. **Никаких правок кода. Никаких миграций. Никаких i18n-ключей.**

---

## Возможные подводные камни и их решения

| Проблема | Решение |
|----------|---------|
| FK на `Event.postId`, `ZoneStay.zoneId`, `PostStay.postId` при удалении | Soft-delete (`deleted=true`), записи остаются |
| `authCache` (15 мин TTL) или Socket.IO клиенты не знают про новый пост | `mapSyncService` эмитит `post:created`/`zone:created` через Socket.IO |
| `MapLayoutVersion` (версионирование) — какую версию синкать | Только активную; при `restore` тоже триггерим sync |
| `monitoringProxy` regex `Пост\s+(\d{2})` сейчас работает для всех постов | Заменяется на lookup по `externalZoneName` + `externalAliases` |
| `generateDemoData` раньше создавал 10/11 постов гвоздями | Теперь читает из БД — что в карте, то и генерится |
| Старый i18n-ключ `posts.post11` вдруг где-то остался | Grep по `posts.post` после удаления — должно остаться только `posts.label` |
| Бэкап на случай отката | `git checkout backup/artisom-pre-mapsync` или `git reset --hard backup/artisom-pre-mapsync` |

---

## Команды отката (если что-то пошло не так)

```bash
# Откатить код к состоянию до начала
git reset --hard backup/artisom-pre-mapsync

# Откатить миграцию Prisma
cd backend && npx prisma migrate resolve --rolled-back add_map_propagation_fields
```
