# Планы улучшений MetricsAiUp

## A. Dashboard и мониторинг

### A1. Живые уведомления в шапке (Socket.IO)

**Цель:** Заменить polling в NotificationCenter на подписку Socket.IO. Реагировать на события `recommendation`.

**Файлы:**
| Файл | Действие |
|---|---|
| `frontend/src/components/NotificationCenter.jsx` | Изменить: заменить polling на useSocket |
| `backend/src/services/recommendationEngine.js` | Изменить: добавить `messageEn` |
| `frontend/src/i18n/ru.json`, `en.json` | Добавить ключи `notifications.*` |

**План:**
1. Бэкенд: добавить `messageEn` при создании рекомендаций в `createRecommendation`
2. Фронтенд: убрать `usePolling(checkRecommendations, 10000)`, заменить на `useSocket('recommendation', callback)`
3. Оставить однократную загрузку при монтировании для восстановления непрочитанных
4. Дедупликация: хранить Set из `rec.id` в useRef
5. При reconnect: догрузить пропущенные через `GET /api/recommendations?since={lastTimestamp}`

**Формат события Socket.IO `recommendation`:**
```json
{
  "id": "uuid",
  "type": "vehicle_idle | work_overtime | no_show | post_free | capacity_available",
  "zoneId": "uuid | null",
  "postId": "uuid | null",
  "message": "Текст на русском",
  "messageEn": "English text",
  "status": "active",
  "createdAt": "ISO"
}
```

**Риски:** дублирование при reconnect, замыкание на enabledTypes (решено через useRef в useSocket).

---

### A2. Виджет "Сейчас на СТО"

**Цель:** Компактная сводка в реальном времени: авто на территории, статусы постов, простои.

**Файлы:**
| Файл | Действие |
|---|---|
| `frontend/src/components/LiveSTOWidget.jsx` | Создать |
| `frontend/src/pages/Dashboard.jsx` | Добавить виджет |
| `backend/src/routes/dashboard.js` | Новый эндпоинт `GET /api/dashboard/live` |
| `frontend/src/i18n/ru.json`, `en.json` | Ключи `liveWidget.*` |

**План:**
1. Бэкенд: `GET /api/dashboard/live` — activeSessions count, все посты с текущими stays, простои >15 мин
2. Фронтенд: `LiveSTOWidget.jsx` с `usePolling(10с)` + debounced `useSocket('event', fetchData)`
3. UI: строка сводки + компактная таблица постов (имя, статус, номер авто, время на посту)
4. Посты с простоем >15 мин — оранжевый/красный фон
5. Встроить между StatCards и PredictionWidget

**Формат ответа `GET /api/dashboard/live`:**
```json
{
  "vehiclesOnSite": 5,
  "totalPosts": 10,
  "posts": [
    { "id": "uuid", "name": "Пост 1", "zone": "Ремзона А", "status": "active_work", "plateNumber": "А123ВС77", "sinceMinutes": 45 }
  ],
  "summary": { "working": 3, "occupied": 4, "free": 4, "idle": 1 }
}
```

**Риски:** шквал API-запросов при частых CV-событиях (debounce 2-3с), sinceMinutes устаревает (вернуть ISO startTime).

---

### A3. Мини-спарклайны на KPI-карточках

**Цель:** Тренд-график (sparkline) за 7 дней под числом каждой StatCard.

**Файлы:**
| Файл | Действие |
|---|---|
| `frontend/src/components/SparkLine.jsx` | Создать (Recharts LineChart без осей) |
| `frontend/src/pages/Dashboard.jsx` | Изменить StatCard, добавить загрузку трендов |
| `backend/src/routes/dashboard.js` | Новый эндпоинт `GET /api/dashboard/trends` |

**План:**
1. Бэкенд: `GET /api/dashboard/trends` — 7 дней x 4 метрики (sessions, postStays, occupiedPosts, recommendations). Оптимизация: 4 запроса с GROUP BY вместо цикла по дням
2. Фронтенд: `SparkLine.jsx` — Recharts `<LineChart>` без осей/тултипов, только линия
3. Расширить StatCard: проп `sparkData` + `sparkKey`
4. Загружать тренды в `fetchData` параллельно с overview

**Формат ответа `GET /api/dashboard/trends`:**
```json
[
  { "date": "2026-04-02", "activeSessions": 12, "postStays": 8, "occupiedPosts": 5, "recommendations": 3 },
  ...
]
```

**Риски:** CSS-переменные в Recharts SVG stroke (использовать hex), пустые данные (SparkLine возвращает null).

---

## B. Заказ-наряды и планирование

### B4. Таймер на посту с привязкой к ЗН

**Цель:** Привязать таймер MyPost к реальному work order: автостарт, предупреждение при 80% нормочасов, автозавершение.

**Файлы:**
| Файл | Действие |
|---|---|
| `backend/prisma/schema.prisma` | +pausedAt DateTime?, +totalPausedMs Int @default(0) |
| `backend/src/routes/workOrders.js` | +POST /:id/start, /pause, /resume, /complete |
| `frontend/src/hooks/useWorkOrderTimer.js` | Создать: хук таймера |
| `frontend/src/pages/MyPost.jsx` | Рефакторинг: привязка к API |
| `frontend/src/components/PostTimer.jsx` | +warningThreshold 0.8 |

**План:**
1. Миграция: добавить `pausedAt`, `totalPausedMs` в WorkOrder
2. API:
   - `POST /start` — status='in_progress', startTime=now(), вычислить estimatedEnd
   - `POST /pause` — pausedAt=now()
   - `POST /resume` — totalPausedMs += (now - pausedAt), обнулить pausedAt, скорректировать estimatedEnd
   - `POST /complete` — status='completed', endTime=now(), actualHours = (end - start - paused) / 3600000
   - Socket.IO эмит `workOrder:started/paused/resumed/completed`
3. Хук `useWorkOrderTimer`:
   - elapsedMs = Date.now() - startTime - totalPausedMs
   - warningLevel: none | warning(80%) | critical(95%) | overtime(100%)
   - Экспорт: { elapsedMs, warningLevel, percentUsed, start, pause, resume, complete }
4. MyPost.jsx: заменить локальный таймер на хук, UI для предупреждений

**Риски:** рассинхронизация часов (сервер возвращает serverTime), одновременное управление (409 Conflict).

---

### B5. DashboardPosts: оптимистичное обновление + конфликт-резолюция

**Цель:** Версионирование ЗН, транзакционное сохранение, обработка конфликтов при одновременном редактировании.

**Файлы:**
| Файл | Действие |
|---|---|
| `backend/prisma/schema.prisma` | +version Int @default(0) в WorkOrder |
| `backend/src/routes/workOrders.js` | Переписать POST /schedule с проверкой версий + $transaction |
| `frontend/src/pages/DashboardPosts.jsx` | Оптимистичное обновление, обработка 409 |
| `frontend/src/components/dashboardPosts/ConflictModal.jsx` | Создать |

**План:**
1. Миграция: +version в WorkOrder
2. Бэкенд: `POST /schedule` в `$transaction`, проверка version каждого ЗН, при mismatch — 409 с деталями конфликтов
3. Фронтенд: snapshot перед drop, при 409 — откат + ConflictModal
4. ConflictModal: "Принять серверную версию" (reload) / "Перезаписать" (force save)
5. Socket.IO: подписка на `schedule:updated` для мультипользовательской синхронизации

**Формат 409:**
```json
{
  "error": "conflict",
  "conflicts": [
    { "workOrderId": "uuid", "reason": "version_mismatch", "clientVersion": 5, "serverVersion": 7, "serverData": {...} }
  ]
}
```

**Риски:** SQLite файловый лок при транзакциях (приемлемо для 10 постов), сложность UI конфликтов (упростить до одной кнопки перезагрузки).

---

### B6. WorkOrders: фильтр по дате

**Цель:** Date range picker для фильтрации ЗН по scheduledTime.

**Файлы:**
| Файл | Действие |
|---|---|
| `frontend/src/pages/WorkOrders.jsx` | +date inputs, серверная + клиентская фильтрация |
| `frontend/src/components/DateRangePicker.jsx` | Создать (нативные input[type=date] + пресеты) |
| `backend/src/routes/workOrders.js` | +dateFrom, dateTo в GET /api/work-orders |

**План:**
1. Бэкенд: добавить `dateFrom`/`dateTo` query params в GET /api/work-orders (5 строк кода)
2. Создать `DateRangePicker.jsx`: два input[type=date] + пресеты (Сегодня, Вчера, Неделя, Месяц, Все)
3. Интеграция: серверная фильтрация в fetchOrders + клиентская как fallback в useMemo
4. Расположить между заголовком и фильтрами статуса

**Риски:** часовой пояс (dateTo включительно — конец дня 23:59:59), нативный date picker выглядит по-разному.

---

## C. Аналитика

### C7. Экспорт отчётов по расписанию

**Цель:** Серверная генерация XLSX по cron, отправка в Telegram.

**Файлы:**
| Файл | Действие |
|---|---|
| `backend/prisma/schema.prisma` | +модель ReportSchedule |
| `backend/src/services/reportScheduler.js` | Создать: cron-планировщик |
| `backend/src/services/serverExport.js` | Создать: серверная генерация XLSX |
| `backend/src/routes/reportSchedule.js` | Создать: CRUD API |
| `backend/src/services/telegramBot.js` | +sendDocument, broadcastDocument |
| `frontend/src/pages/ReportSchedule.jsx` | Создать: UI настройки (или секция в Analytics) |

**План:**
1. Модель `ReportSchedule`: name, frequency(daily/weekly), dayOfWeek, hour, minute, format, chatId, isActive, lastRunAt
2. Серверный XLSX: перенести логику из `frontend/src/utils/export.js` на бэкенд (xlsx library)
3. Telegram: `sendDocument(chatId, buffer, filename, caption)` через node-telegram-bot-api
4. Планировщик: `node-cron` каждую минуту проверяет активные расписания
5. REST: GET/POST/PUT/DELETE /api/report-schedules + POST /:id/run (тест)
6. UI: таблица расписаний + форма создания + кнопка "Отправить сейчас"

**Новые зависимости:** `node-cron`

**Риски:** PDF на сервере невозможен через html2canvas (использовать только XLSX или pdfkit), дублирование логики front/back.

---

### C8. Сравнение периодов

**Цель:** Overlay двух линий на графиках (текущий vs предыдущий период), дельта в процентах.

**Файлы:**
| Файл | Действие |
|---|---|
| `frontend/src/pages/Analytics.jsx` | +toggle сравнения, двойные линии, дельты |
| `frontend/src/components/DeltaBadge.jsx` | Создать: компонент +5.2%↑ / -3.1%↓ |

**План:**
1. State: `compareMode: boolean`, `compareTo: 'prev'`
2. useMemo: вычислить prevFilteredPosts — slice предыдущего периода из history.posts[].days[]
3. Дельты: разница текущих и предыдущих totals в процентах
4. DeltaBadge: стрелка + цвет (зеленый вверх, красный вниз)
5. Графики: второй набор линий с `strokeDasharray="5 5"`, объединённый trendData с prefix `prev_`
6. Toggle-кнопка "Сравнить" рядом с фильтрами периодов

**Риски:** 10 постов x 2 периода = 20 линий (нечитаемо — показывать агрегат или 1 пост), при 30d нужны данные за 60 дней.

---

### C9. Heatmap загрузки по дням недели

**Цель:** Тепловая карта: X — часы (8-20), Y — дни недели, цвет — средняя загрузка.

**Файлы:**
| Файл | Действие |
|---|---|
| `frontend/src/components/WeeklyHeatmap.jsx` | Создать (custom SVG или HTML-таблица) |
| `frontend/src/pages/Analytics.jsx` | Добавить компонент |

**План:**
1. useMemo: агрегация posts[].days[].hourly[] → grid[7 дней][12 часов] → avgOccupancy
2. WeeklyHeatmap: SVG с цветными rect, подписи дней (Пн-Вс) и часов (8:00-19:00)
3. Цветовая шкала: зеленый(<20%) → желтый(40-60%) → красный(>80%)
4. Tooltip при hover: день, час, точное значение, кол-во точек данных
5. Фильтр по посту (dropdown: Все / конкретный)

**Риски:** при 7d каждый день недели = 1 точка (мало для статистики), разделить Пн-Пт и Сб-Вс визуально.

---

## D. Карта СТО

### D10. MapViewer: real-time статусы постов через Socket.IO

**Цель:** Цвет поста на карте меняется при CV-событиях без перезагрузки.

**Файлы:**
| Файл | Действие |
|---|---|
| `backend/src/services/eventProcessor.js` | Расширить payload: эмитить `post:status_changed` с полным статусом |
| `frontend/src/pages/MapViewer.jsx` | +useSocket('post:status_changed', updateZonesData) |
| `frontend/src/pages/MapView.jsx` | Аналогично |
| `frontend/src/hooks/useSocket.js` | Опционально: хук usePostStatusStream |

**План:**
1. Бэкенд: после обновления статуса поста в eventProcessor, прочитать актуальный объект поста из БД, эмитить `post:status_changed` в `all_events`
2. Фронтенд: `useSocket('post:status_changed', data => setZonesData(prev => ...))` — точечное обновление
3. Увеличить интервал polling до 30с (fallback)
4. При reconnect: полный рефетч через fetchRealtime()
5. Flash-анимация при смене статуса (Konva.Tween на shadowBlur)

**Формат `post:status_changed`:**
```json
{
  "postId": "uuid",
  "postNumber": 6,
  "status": "active_work",
  "plateNumber": "A123BC77",
  "workerName": "Иванов А.",
  "timestamp": "ISO"
}
```

**Риски:** race condition при обновлении state (решено функциональной формой setState), доп. нагрузка на БД при обогащении payload.

---

### D11. MapViewer: индикатор онлайн камер

**Цель:** Камеры на карте показывают статус: зелёная пульсация (онлайн) или серый (оффлайн).

**Файлы:**
| Файл | Действие |
|---|---|
| `backend/src/services/cameraHealthCheck.js` | Создать: проверка камер каждые 30с |
| `backend/src/routes/cameras.js` | +GET /api/cameras/health |
| `backend/src/index.js` | Запуск cameraHealthCheck |
| `frontend/src/hooks/useCameraStatus.js` | Создать: REST + Socket.IO подписка |
| `frontend/src/components/STOMap.jsx` | CameraIcon: +проп online, цвет, пульсация |
| `frontend/src/pages/MapViewer.jsx` | CameraEl: аналогично |

**План:**
1. `cameraHealthCheck.js`: каждые 30с HEAD-запрос к `https://localhost:8181/hls/{camId}/stream.m3u8`, результат в in-memory Map
2. При изменении статуса — Socket.IO emit `camera:status`
3. `GET /api/cameras/health`: вернуть текущие статусы из Map
4. `useCameraStatus()`: начальная загрузка REST + подписка Socket.IO
5. STOMap/MapViewer: онлайн — зелёная заливка + пульсирующий Circle, оффлайн — серый, opacity 0.5

**Риски:** HLS-сервер может быть не запущен (все камеры оффлайн — корректно), SSL self-signed (rejectUnauthorized: false).

---

## E. Смены и работники

### E12. Shifts: детекция конфликтов назначений

**Цель:** Предупреждение если работник назначен на два поста в одну смену или в пересекающиеся смены.

**Файлы:**
| Файл | Действие |
|---|---|
| `backend/src/routes/shifts.js` | +detectConflicts() в POST и PUT |
| `frontend/src/pages/Shifts.jsx` | +клиентская валидация в ShiftFormModal |
| `frontend/src/i18n/ru.json`, `en.json` | Ключи `shifts.conflict*` |

**Два типа конфликтов:**
1. **Внутрисменный:** один работник → два разных поста внутри одной смены
2. **Межсменный:** один работник → разные смены в один день с пересечением времени

**План:**
1. Бэкенд: функция `detectConflicts(date, startTime, endTime, workers, excludeShiftId?)`:
   - Проверка дубликатов по name внутри workers
   - Запрос смен на ту же дату, проверка пересечений по времени
   - При конфликтах: 409 (если не `force: true`)
2. Фронтенд: валидация в ShiftFormModal перед onSave:
   - Клиентская проверка по allShifts (уже загружены)
   - Модалка предупреждения: "Сохранить всё равно" / "Исправить"
3. Zod-схема: +force: z.boolean().optional()

**Риски:** идентификация по ФИО (разное написание), двойная логика mock/API.

---

### E13. Статистика по работнику

**Цель:** Персональная карточка работника: выработка, эффективность, ЗН, простои, типы ремонта.

**Файлы:**
| Файл | Действие |
|---|---|
| `frontend/src/pages/WorkerStats.jsx` | Создать |
| `frontend/src/App.jsx` | +Route /worker-stats/:workerName |
| `backend/src/routes/workers.js` | Создать: GET /api/workers, GET /api/workers/:name/stats |
| `frontend/src/pages/Shifts.jsx` | +Link на карточку по клику на ФИО |
| `frontend/src/i18n/ru.json`, `en.json` | Секция `workerStats.*` |

**План:**
1. Бэкенд: `GET /api/workers/:name/stats?from=...&to=...`
   - WorkOrder из БД (worker = name)
   - 1c-workers.json фильтрация
   - ShiftWorker для графика смен
   - Агрегация: totalWO, completedWO, normHours, actualHours, avgEfficiency, idleTime
2. Фронтенд: WorkerStats.jsx:
   - Заголовок: ФИО, роль, текущий пост
   - 4 KPI карточки: ЗН, нормочасы, эффективность, простои
   - AreaChart выработки по дням
   - PieChart типов ремонта
   - Таблица последних ЗН
3. Роутинг: `/worker-stats/:workerName` (encodeURIComponent)
4. Ссылки из Shifts, PostsDetail, WorkOrders

**Формат `GET /api/workers/:name/stats`:**
```json
{
  "worker": { "name": "...", "role": "mechanic", "currentPost": "post-1" },
  "summary": { "totalWorkOrders": 45, "completedWorkOrders": 38, "totalNormHours": 67.5, "avgEfficiency": 93.4, "totalIdleHours": 12.8 },
  "topRepairTypes": [{ "type": "Гарантия ОП", "count": 15, "normHours": 8.2 }],
  "topBrands": [{ "brand": "OPEL", "count": 10 }],
  "dailyStats": [{ "date": "2026-04-01", "workOrders": 3, "normHours": 4.2, "efficiency": 87.5 }],
  "recentOrders": [{ "number": "КОЛ00033312", "repairType": "...", "brand": "OPEL", "normHours": 0.2 }]
}
```

**Риски:** нет уникального ID работника (совпадение ФИО), большой объём 1c-workers.json.

---

## F. Системные

### F14. Audit log: фильтр по дате + экспорт CSV

**Цель:** Date range picker, экспорт отфильтрованных данных в CSV.

**Файлы:**
| Файл | Действие |
|---|---|
| `frontend/src/pages/Audit.jsx` | +date inputs, серверная фильтрация, кнопка CSV |
| `backend/src/routes/auditLog.js` | +GET /api/audit-log/export-csv |
| `frontend/src/i18n/ru.json`, `en.json` | Ключи audit.dateFrom/dateTo/exportCsv |

**План:**
1. Бэкенд: `GET /api/audit-log/export-csv` — та же фильтрация что в GET /, но CSV с BOM для Excel
2. Фронтенд: перевести на серверную фильтрацию (бэкенд уже поддерживает from/to/action/entity)
3. Два `input[type=date]` в блок фильтров, стилизация под glass-дизайн
4. Кнопка "Скачать CSV": прямой fetch → blob → download
5. Пагинация по total с сервера

**Риски:** кириллица в CSV (BOM решает), dateTo включительно (конец дня 23:59:59).

---

### F15. Страница здоровья системы (/health)

**Цель:** Статус бэкенда, БД, камер, 1С синхронизации, диска. Автообновление.

**Файлы:**
| Файл | Действие |
|---|---|
| `backend/src/routes/health.js` | Создать |
| `backend/src/index.js` | Подключить маршрут |
| `frontend/src/pages/Health.jsx` | Создать |
| `frontend/src/App.jsx` | +Route /health |
| `frontend/src/components/Sidebar.jsx` | +пункт навигации |
| `frontend/src/i18n/ru.json`, `en.json` | Секция `health.*` |

**План:**
1. Бэкенд: `GET /api/system-health` (admin only):
   - Backend: uptime, version, nodeVersion, memoryUsage
   - Database: ping (SELECT 1), sizeBytes
   - Cameras: HTTP GET к HLS-серверу :8181/api/stream/status
   - 1C Sync: последний SyncLog
   - Disk: `df -B1 /`
2. Фронтенд: Health.jsx:
   - 5 карточек в сетке (glass-static)
   - Автообновление каждые 30с
   - Цветовые индикаторы: БД ping (<50ms зеленый, <200ms желтый, >200ms красный), диск (<70% зеленый, <90% желтый, ≥90% красный)
   - Иконки: Activity, Database, HardDrive, Camera, RefreshCw
3. Sidebar: +пункт "Здоровье системы" с иконкой Activity

**Формат `GET /api/system-health`:**
```json
{
  "backend": { "status": "ok", "uptime": 86400, "version": "1.0.0", "nodeVersion": "v20.11.0", "memoryUsage": {...} },
  "database": { "status": "ok", "pingMs": 2, "sizeMB": 5.0 },
  "cameras": [{ "id": "cam01", "name": "CAM 01", "streaming": true }],
  "sync1c": { "lastSyncAt": "ISO", "status": "success", "records": 42, "errors": 0 },
  "disk": { "totalBytes": 107374182400, "usedBytes": 53687091200, "usagePercent": 50 }
}
```

**Риски:** HLS-сервер не запущен (cameras: unreachable), execSync('df') блокирует (приемлемо для admin).

---

## Рекомендуемый порядок реализации

| # | Задача | Сложность | Миграция БД | Новые зависимости |
|---|--------|-----------|-------------|-------------------|
| 1 | B6 — Фильтр ЗН по дате | Низкая | Нет | Нет |
| 2 | C9 — Heatmap дни×часы | Низкая | Нет | Нет |
| 3 | A1 — Уведомления Socket.IO | Низкая | Нет | Нет |
| 4 | A3 — Спарклайны | Низкая | Нет | Нет |
| 5 | F14 — Аудит: даты + CSV | Низкая | Нет | Нет |
| 6 | D10 — Real-time карта | Средняя | Нет | Нет |
| 7 | C8 — Сравнение периодов | Средняя | Нет | Нет |
| 8 | A2 — Виджет "Сейчас на СТО" | Средняя | Нет | Нет |
| 9 | E12 — Конфликты смен | Средняя | Нет | Нет |
| 10 | D11 — Индикатор камер | Средняя | Нет | Нет |
| 11 | B4 — Таймер с привязкой к ЗН | Средняя | Да | Нет |
| 12 | F15 — Здоровье системы | Средняя | Нет | Нет |
| 13 | E13 — Статистика работника | Средняя | Нет | Нет |
| 14 | B5 — Оптимистичное обновление | Высокая | Да | Нет |
| 15 | C7 — Экспорт по расписанию | Высокая | Да | node-cron |
