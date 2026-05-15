# PLAN — Сводный отчёт «Занятость и загрузка» (`/utilization`)

> Статус: концепция зафиксирована, готово к реализации.
> Ветка: `artisom`.
> Связанные страницы: `/dashboard-posts`, `/posts-detail`, `/post-history/:n`, `/zone-history/:name`.

## 1. Цель

Сводный отчёт по **занятости в часах** и **загрузке в процентах** для постов и зон СТО за произвольный период, выбираемый пользователем. Дополнительно — финансовый блок (заработано / упущенная выручка) и ручной учёт погрешности.

Всё считается **в рамках рабочей смены/окна работы СТО** — не календарных 24×7.

## 2. Метрики и формулы

| Термин | Формула | Источник |
|---|---|---|
| **Рабочий фонд поста (ШBF_post)** | Σ минут смен поста за период | `Shift` + `ShiftWorker.postId` |
| **Рабочий фонд зоны (ШBF_zone)** | Σ `(workEnd − workStart)` по дням `workDays` за период | `Location.workStart/End/Days` |
| **Занятость поста, ч** | Σ длительностей `PostStay` (статус ≠ free), обрезанных по интервалам смен | `PostStay` |
| **Занятость зоны, ч** | Σ длительностей `ZoneStay` (статус ≠ free), обрезанных по окну `[workStart, workEnd]` | `ZoneStay` |
| **Простой, ч** | `ШBF − Занятость` | вычисляемое |
| **Загрузка, %** | `Занятость / ШBF × 100` | вычисляемое |
| **Потенциал, ₽** | `ШBF × hourlyRate` (только посты) | `Location.hourlyRate` |
| **Заработано, ₽** | `Занятость × hourlyRate` (только посты) | вычисляемое |
| **Упущ. выручка, ₽** | `Простой × hourlyRate` (только посты) | вычисляемое |

Ставка `hourlyRate` — **одна на всё СТО**, хранится в `Location`. Для зон финансовых метрик нет.

Погрешность `errorMarginPct` применяется как ±% ко всем значениям часов и денег в UI (отображается рядом с числом и в виде диапазона у фин-метрик).

## 3. Изменения БД (миграция Prisma)

```prisma
model Location {
  // ...существующие поля
  workStart        String   @default("08:00")        @map("work_start")     // HH:mm в Location.timezone
  workEnd          String   @default("20:00")        @map("work_end")
  workDays         String   @default("1,2,3,4,5,6")  @map("work_days")      // ISO дни недели через запятую
  hourlyRate       Decimal?                          @map("hourly_rate")    // ₽/ч, единая ставка СТО
  currency         String   @default("RUB")
  errorMarginPct   Float?                            @map("error_margin_pct")
  errorMarginNote  String?                           @map("error_margin_note")
}
```

`Post.hourlyRate` **не добавляем** — ставка фиксированная для всего СТО.

## 4. Бэкенд

### 4.1 Новый сервис `backend/src/services/utilizationReport.js`

Чистые функции расчёта:
- `intersectIntervals(stays, windows)` — пересечение `PostStay/ZoneStay` с интервалами смен/окна работы → корректные «занятые» минуты.
- `buildPostShiftWindows(shifts, postIds, from, to)` — собрать рабочие интервалы по каждому посту.
- `buildZoneWorkWindows(location, from, to)` — собрать рабочие окна СТО по дням из `workStart/End/Days` (с учётом `Location.timezone`).
- `computeUtilization({ from, to, entity, locationId })` — основная функция.

Учёт TZ: `getAppTimezone()` / `Location.timezone` (двухуровневые TZ уже работают).

### 4.2 Новый роут `backend/src/routes/reports.js`

```
GET /api/reports/utilization
  ?from=ISO &to=ISO &entity=posts|zones &compare=true|false
  → 200 { period, errorMargin, hourlyRate, currency, totals, byEntity, compare? }

PUT /api/reports/utilization/settings
  body: { workStart?, workEnd?, workDays?, hourlyRate?, currency?, errorMarginPct?, errorMarginNote? }
  → 200 { ok: true }
  permission: manage_settings
```

Ответ `/utilization` для `entity=posts`:
```json
{
  "period": { "from": "...", "to": "...", "days": 7 },
  "errorMargin": { "pct": 10, "note": "..." },
  "hourlyRate": 1800, "currency": "RUB",
  "totals": {
    "shiftFund": 720, "busy": 612, "idle": 108, "loadPct": 85,
    "potential": 1296000, "earned": 1101600, "lost": 194400
  },
  "byEntity": [
    { "id": 1, "number": 1, "name": "Тяжёлый-1", "type": "heavy",
      "shiftFund": 80, "busy": 72, "idle": 8, "loadPct": 90,
      "earned": 129600, "lost": 14400,
      "byDay": [{ "date": "2026-05-09", "busy": 10.2, "loadPct": 95 }] }
  ],
  "compare": { /* те же поля для предыдущего периода такой же длины */ }
}
```

Для `entity=zones` — без полей `earned/lost/potential` в `totals` и без `earned/lost` в `byEntity`.

### 4.3 Регистрация роута в `backend/src/index.js`

```js
const reportsRouter = require('./routes/reports');
app.use('/api/reports', reportsRouter);
```

## 5. Фронтенд

### 5.1 Новая страница `frontend/src/pages/UtilizationReport.jsx`

Структура (см. ASCII-макет в §7):
1. **Шапка** — название, период (пресеты + custom), таб `Посты | Зоны`, ставка (inline-edit при `manage_settings`), погрешность (inline-edit), экспорт.
2. **KPI операционные (3 карточки)** — ШBF, Занятость (±%), Загрузка (±п.п.).
3. **KPI финансовые (3 карточки)** — только при табе `Посты`: Потенциал, Заработано (±), Упущ. выручка (±).
4. **Хитмап-календарь** — компонент `UtilizationHeatmap.jsx`, клетка = день; два горизонтальных бара (часы + %). Тултип с финансами дня.
5. **Топ-3 потерь** — только при `Посты`, сортировка по `lost ₽` desc.
6. **Сводная таблица** — сортируемая, цветовая шкала по %, итоговая строка Σ.
7. **Тренд по дням** — Recharts `ComposedChart`: столбцы — часы, линия — %.
8. **Примечание о погрешности** — `errorMarginNote`.
9. **Drill-down**: правая выезжающая панель при клике по клетке/строке — мини-таймлайн `PostStay/ZoneStay` за день/период, ссылка в `PostHistory`/`ZoneHistory`.

### 5.2 Новый компонент `frontend/src/components/UtilizationHeatmap.jsx`

Календарь-сетка (как на референсном скрине от пользователя):
- Заголовок: дни недели Пн-Вс.
- Клетки: одна на день периода (если период > 7 дней — wrap по неделям).
- Внутри клетки: число (например, кол-во записей или дата), затем два бара (часы + %).
- Цвет бара по % через градиент: <50 серый, 50–70 жёлтый, 70–90 зелёный, >90 насыщ-зелёный, >100 красно-оранжевый.
- Onclick → drill-down panel.

Переиспользует логику `WeeklyHeatmap.jsx`, но с другой моделью данных.

### 5.3 Интеграционные кнопки

В шапке `DashboardPosts.jsx` и `PostsDetail.jsx`:
```jsx
<button onClick={() => navigate(`/utilization?from=${period.start}&to=${period.end}`)}>
  <BarChart3 size={14} /> Сводный отчёт
</button>
```

### 5.4 Роутинг

`App.jsx` — добавить:
```jsx
const UtilizationReport = lazy(() => import('./pages/UtilizationReport'));
<Route path="/utilization" element={<ProtectedRoute pageId="utilization"><UtilizationReport /></ProtectedRoute>} />
```

### 5.5 Sidebar и permissions

- Sidebar: пункт скрыт по умолчанию (доступ через кнопки из dashboard-posts/posts-detail), но добавить в `pages[]` пользователя `utilization`.
- Permissions:
  - просмотр — `view_analytics`
  - правка ставки/погрешности/окна работы — `manage_settings`

### 5.6 i18n

Новый namespace `utilization` в `ru.json` / `en.json`:
- `utilization.title`, `utilization.kpi.shiftFund/busy/loadPct/potential/earned/lost`, `utilization.table.*`, `utilization.heatmap.*`, `utilization.error.*`, `utilization.tooltips.*`, `utilization.export.*`.

### 5.7 Экспорт

`utils/export.js` уже имеет `exportToXlsx/Pdf/Png`:
- **XLSX:** листы `Сводка`, `По дням`, `По постам`, `По зонам`, `Примечание`.
- **PDF:** KPI + хитмап + таблица + примечание.
- **PNG:** скрин графика тренда.

## 6. Очерёдность реализации (todo)

1. Миграция БД: добавить поля в `Location`.
2. Сервис `utilizationReport.js` — функции расчёта + unit-тесты.
3. Роут `reports.js` — `GET /utilization`, `PUT /utilization/settings`.
4. Регистрация в `index.js`, права в `auth.js`.
5. Фронт: страница `UtilizationReport.jsx` (скелет, моки).
6. Подключение к API, заменить моки.
7. Компонент `UtilizationHeatmap.jsx`.
8. Drill-down правая панель.
9. Экспорт (XLSX/PDF/PNG).
10. i18n (ru + en).
11. Кнопки-переходы в `DashboardPosts.jsx` и `PostsDetail.jsx`.
12. Регистрация роута в `App.jsx`, `pages[]` пользователя.
13. Тесты frontend + backend.
14. Бамп `CACHE_NAME` в `sw.js`, билд фронта.

## 7. Финальный макет страницы

```
┌──────────────────────────────────────────────────────────────────┐
│ ← «Сводный отчёт: занятость и загрузка»                           │
│ [Период ▾] [Сегодня/7д/30д/Custom] [Посты | Зоны]                 │
│ Ставка: 1 800 ₽/ч ⚙ │ Погрешность: ±10% ⚙ │ [XLSX•PDF•PNG]       │
└──────────────────────────────────────────────────────────────────┘
┌─ KPI операционные ───────────────────────────────────────────────┐
│ Раб. фонд: 720 ч │ Занятость: 612 ч (±10%) │ Загрузка: 85% (±9пп)│
└──────────────────────────────────────────────────────────────────┘
┌─ KPI финансовые (только для постов) ─────────────────────────────┐
│ Потенциал: 1 296 000 ₽ │ Заработано: 1 101 600 ₽ │ Упущ.: 194 400 ₽│
└──────────────────────────────────────────────────────────────────┘
┌─ Хитмап-календарь (день = клетка, 2 бара: ч + %) ────────────────┐
│ ▰▰▰▰▰▰▰ 10.2ч / ▰▰▰▰▰▰▰ 95%  …                                  │
└──────────────────────────────────────────────────────────────────┘
┌─ Топ-3 потерь (только посты) ────────────────────────────────────┐
│ #10 → 45 000 ₽   #9 → 39 600 ₽   #7 → 32 400 ₽                   │
└──────────────────────────────────────────────────────────────────┘
┌─ Сводная таблица (сортируемая, цв. шкала) ───────────────────────┐
│ # │ Имя │ ШBF │ Занят. │ Прост. │ Загр.% │ Заработ. │ Потери       │
└──────────────────────────────────────────────────────────────────┘
┌─ Тренд по дням (ComposedChart) + примечание ─────────────────────┐
│ столбцы — часы, линия — %                                        │
│ ⓘ Погрешность ±10%. {errorMarginNote}                            │
└──────────────────────────────────────────────────────────────────┘
```

## 8. Решения, принятые при дизайне

| Решение | Альтернативы рассмотренные | Выбор |
|---|---|---|
| Метрики | занят/работа/простой/КИВ | **только занят. + загрузка** |
| Зоны | агрегат постов / независимо / гибрид | **независимо через `ZoneStay`** |
| ШBF зон | по сменам / фикс. окно / 24ч | **фикс. окно `Location.workStart/End/Days`** |
| Размещение | в Sidebar / вкладка Analytics / отдельная + переходы | **отдельная + кнопки из DashboardPosts/PostsDetail** |
| Ставка | на пост / на тип / гибрид / на СТО | **единая на всё СТО** |
| Погрешность | автоматическая / ручная | **ручная (поля в `Location`)** |
