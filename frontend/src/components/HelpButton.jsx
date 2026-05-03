import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HelpCircle, X, ChevronDown, ChevronRight,
  CheckCircle2, AlertTriangle, XCircle, Info, Lightbulb, ArrowRight, Zap, Eye, MousePointer2,
} from 'lucide-react';

// ═══════════════════════════════════════════════
// HELP CONTENT — Подробная справка по всем страницам
// ═══════════════════════════════════════════════

const HELP_CONTENT = {
  // ────────────────────────────
  // ДАШБОРД
  // ────────────────────────────
  dashboard: {
    ru: {
      title: 'Дашборд — Главный экран',
      intro: 'Стартовая страница системы. За 5 секунд даёт ответ на главный вопрос: «Всё ли в порядке на СТО прямо сейчас?». Сочетает KPI-карточки, живой обзор постов, ML-прогнозы и список рекомендаций. Обновляется каждые 5 секунд в демо и в реальном времени через Socket.IO в live.',
      sections: [
        {
          heading: 'Карта экрана (что и где)',
          items: [
            '**Верх** — 4 KPI-карточки в одну строку: активные сессии, свободные посты, занятые посты, рекомендации.',
            '**Под KPI слева** — виджет LiveSTOWidget с компактной сеткой всех 10 постов.',
            '**Под KPI справа** — PredictionWidget с ML-прогнозами (загрузка, длительность, освобождение).',
            '**Средняя зона** — список активных рекомендаций (сворачивается, если их нет).',
            '**Нижняя зона** — лента последних 10 событий с фильтром по категориям.',
            '**Правый верхний угол** — переключатель периода метрик (24ч / 7д / 30д) и индикатор соединения.',
          ],
        },
        {
          heading: 'KPI-карточки — как читать',
          items: [
            '**Активные сессии** — авто, находящиеся на территории СТО прямо сейчас (открытые VehicleSession без exitTime). Цвет зависит от загрузки.',
            '**Свободные посты** — посты со статусом **free**. [●green]{green:зелёный} — есть свободные, [●red]{red:красный} — все 10 заняты, нужен резерв.',
            '**Занятые посты** — посты в статусах **occupied** (авто стоит без работы) и **active_work** (идёт обслуживание). Высокое число = высокая загрузка.',
            '**Рекомендации** — количество необработанных уведомлений. [●orange]{orange:оранжевый} бейдж — требует внимания.',
            '[click] Любая карточка **кликабельна** — открывает соответствующую страницу детализации.',
            '**Дельта-бейдж** (треугольник вверх/вниз с %) показывает рост или падение по сравнению с предыдущим равным периодом. [●green]{green:Зелёный} — улучшение, [●red]{red:красный} — ухудшение.',
            'Цифра 0 без дельты — данных за прошлый период нет (например, начало учёта).',
          ],
        },
        {
          heading: 'Живой обзор постов (LiveSTOWidget)',
          items: [
            'Сетка из **10 постов** с цветовым статусом и ключевой информацией:',
            '[●green]{green:Зелёный} = free (свободен).',
            '[●purple]{purple:Фиолетовый} = active_work (идёт обслуживание, есть работник).',
            '[●red]{red:Красный} = occupied_no_work (авто стоит, но никто не работает — возможен простой).',
            '[●orange]{orange:Оранжевый} = occupied (предупреждение / переходное состояние).',
            '[●gray]{gray:Серый} = no_data (нет данных от CV — пост не репортится).',
            'Для занятых постов на карточке: **госномер** в виде плашки и **время на посту** (ЧЧ:ММ).',
            'Подходит для второго монитора — видно весь СТО без переключения экранов.',
            'Клик по посту — переход на детальный экран поста (PostHistory или PostsDetail).',
          ],
        },
        {
          heading: 'ML-прогнозы (PredictionWidget)',
          items: [
            '**Прогноз загрузки** на ближайшие 4 часа — линейный график с почасовой динамикой. Источник: **/api/predict/load**.',
            '**Прогноз освобождения постов** — таблица «Пост → ETA» (когда станет свободен). Источник: **/api/predict/free**.',
            '**Прогноз длительности** — оценка времени по типу работ (ТО / ремонт / диагностика). Источник: **/api/predict/duration**.',
            'В **демо-режиме** значения генерируются seeded random — для презентации.',
            'В **live-режиме** модель анализирует исторические паттерны (день недели, час, тип работ).',
            'Помогает мастеру-приёмщику принять заказ: «можно ли вписать машину в 14:30?»',
          ],
        },
        {
          heading: 'Рекомендации — 5 типов',
          items: [
            '[●red]**Неявка (no_show)** — клиент не приехал на scheduled-ЗН. Триггер: время начала прошло, статус не изменился.',
            '[●green]**Пост свободен (post_free)** — пост простаивает более 30 минут, есть нераспределённые ЗН. Можно загрузить.',
            '[●blue]**Есть мощности (capacity_available)** — более половины постов свободны. Можно принимать дополнительных клиентов.',
            '[●yellow]**Превышение времени (work_overtime)** — фактическое время > 120% нормочасов. Возможна сложная работа или потерянное время.',
            '[●yellow]**Простой авто (vehicle_idle)** — авто на посту > 15 минут без работника. Подскажите механику.',
            'Кнопка **«Принять»** — подтверждает обработку, рекомендация исчезает (acknowledgedAt записывается в БД).',
            'Если рекомендаций нет — секция не показывается (пустой экран = всё хорошо).',
          ],
        },
        {
          heading: 'Лента последних событий',
          items: [
            'Лента **10 последних** событий от системы компьютерного зрения (CV).',
            'Фильтр по категориям сверху: **Все** / **Авто** (въезд/выезд) / **Пост** (занят/свободен) / **Работник** (есть/нет) / **Работа** (активность/простой).',
            'Карточка события: **тип** + **зона/пост** + **источники-камеры** (CAM 01, CAM 02…) + **время** (HH:MM:SS).',
            'Цвет confidence-индикатора: [●green]{green:зелёный} ≥ 90%, [●yellow]{yellow:жёлтый} 70–89%, [●red]{red:красный} < 70%.',
            'Низкий confidence = возможна ложная сработка, требуется ручная проверка.',
            'Клик по событию — открывает модальное окно с данными о камере и raw-payload.',
          ],
        },
        {
          heading: 'Период метрик и сравнение',
          items: [
            'Переключатель **24 часа / 7 дней / 30 дней** в правом верхнем углу — определяет окно расчёта KPI.',
            'Дельта-бейджи всегда сравнивают текущий период с предыдущим равным (24ч ↔ предыдущие 24ч, и т.д.).',
            'Период **сохраняется** в URL (?period=24h|7d|30d) — можно делиться ссылкой.',
            'Смена периода **не перезагружает** страницу — данные подтягиваются inline.',
          ],
        },
        {
          heading: 'Обновление данных и соединение',
          items: [
            'В **демо-режиме** — polling каждые **5 секунд** (setInterval).',
            'В **live-режиме** — Socket.IO, обновление мгновенное при изменении.',
            'При потере соединения — **жёлтый индикатор** в шапке + замораживание данных (отображается «остаточное» состояние).',
            'При восстановлении соединения — автоматический re-sync, индикатор зелёный.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Утренний осмотр** — открыли страницу → проверили рекомендации (если есть — обработать) → перешли в Таймлайн постов для планирования смены.',
            '[ok] **Контроль в течение дня** — оставили на втором мониторе LiveSTOWidget → видите, какой пост зависает в occupied_no_work — отправили мастера.',
            '[ok] **Анализ всплеска** — заметили, что занято 9/10 постов → переключили период на 7д и сравнили с прошлой неделей через дельту.',
            '[ok] **Реакция на неявку** — рекомендация no_show появилась → кликнули на «Принять» → переоформили слот в Таймлайне постов.',
          ],
        },
      ],
    },
    en: {
      title: 'Dashboard — Main Screen',
      intro: 'Landing page of the system. Answers the main question in 5 seconds: "Is everything OK at the STO right now?". Combines KPI cards, live post overview, ML predictions, and recommendations. Auto-refreshes every 5 seconds in demo and in real-time via Socket.IO in live mode.',
      sections: [
        {
          heading: 'Screen Map (where things are)',
          items: [
            '**Top** — 4 KPI cards in a row: active sessions, free posts, occupied posts, recommendations.',
            '**Left under KPI** — LiveSTOWidget with compact grid of all 10 posts.',
            '**Right under KPI** — PredictionWidget with ML predictions (load, duration, availability).',
            '**Middle area** — list of active recommendations (collapses if empty).',
            '**Bottom area** — feed of last 10 events with category filter.',
            '**Top right corner** — metrics period switcher (24h / 7d / 30d) and connection indicator.',
          ],
        },
        {
          heading: 'KPI Cards — How to Read',
          items: [
            '**Active Sessions** — vehicles currently on STO premises (open VehicleSession without exitTime). Color depends on load.',
            '**Free Posts** — posts with **free** status. [●green]{green:Green} — there are free posts, [●red]{red:red} — all 10 are occupied, need to manage capacity.',
            '**Occupied Posts** — posts in **occupied** (car waiting, no work) and **active_work** (service in progress) statuses. High number = high load.',
            '**Recommendations** — count of unhandled notifications. [●orange]{orange:Orange} badge — needs attention.',
            '[click] Any card is **clickable** — opens the corresponding detail page.',
            '**Delta badge** (up/down triangle with %) shows growth or decline vs the previous equivalent period. [●green]{green:Green} — improvement, [●red]{red:red} — degradation.',
            'Number 0 without delta — no data for previous period (e.g., start of tracking).',
          ],
        },
        {
          heading: 'Live Posts Overview (LiveSTOWidget)',
          items: [
            'Grid of **10 posts** with color status and key info:',
            '[●green]{green:Green} = free.',
            '[●purple]{purple:Purple} = active_work (service in progress, worker present).',
            '[●red]{red:Red} = occupied_no_work (car parked, no one working — possible idle).',
            '[●orange]{orange:Orange} = occupied (warning / transitional state).',
            '[●gray]{gray:Gray} = no_data (CV not reporting this post).',
            'Occupied posts show: **plate** as badge and **time on post** (HH:MM).',
            'Great for a second monitor — see the entire STO without switching screens.',
            'Click a post — opens detailed post screen (PostHistory or PostsDetail).',
          ],
        },
        {
          heading: 'ML Predictions (PredictionWidget)',
          items: [
            '**Load forecast** for the next 4 hours — line chart with hourly dynamics. Source: **/api/predict/load**.',
            '**Post availability** — "Post → ETA" table (when becomes free). Source: **/api/predict/free**.',
            '**Duration prediction** — time estimate by work type (Maintenance / Repair / Diagnostics). Source: **/api/predict/duration**.',
            'In **demo mode** values are seeded random — for presentation.',
            'In **live mode** the model analyzes historical patterns (day of week, hour, work type).',
            'Helps service advisor decide: "Can I fit a car at 2:30 PM?"',
          ],
        },
        {
          heading: 'Recommendations — 5 Types',
          items: [
            '[●red]**No-show (no_show)** — client did not arrive for scheduled WO. Trigger: start time passed, status unchanged.',
            '[●green]**Post free (post_free)** — post idle 30+ min, unassigned WOs exist. Can be loaded.',
            '[●blue]**Capacity available (capacity_available)** — more than half of posts free. Can accept additional clients.',
            '[●yellow]**Work overtime (work_overtime)** — actual time > 120% norm hours. Complex job or lost time.',
            '[●yellow]**Vehicle idle (vehicle_idle)** — car on post > 15 min without worker. Notify the mechanic.',
            '**"Acknowledge"** button — confirms handling, recommendation disappears (acknowledgedAt stored in DB).',
            'No recommendations = section hidden (empty = everything good).',
          ],
        },
        {
          heading: 'Recent Events Feed',
          items: [
            'Feed of **10 latest** computer vision (CV) events.',
            'Category filter: **All** / **Vehicle** (entry/exit) / **Post** (occupied/vacated) / **Worker** (present/absent) / **Work** (activity/idle).',
            'Event card: **type** + **zone/post** + **source cameras** (CAM 01, CAM 02…) + **time** (HH:MM:SS).',
            'Confidence indicator color: [●green]{green:green} ≥ 90%, [●yellow]{yellow:yellow} 70–89%, [●red]{red:red} < 70%.',
            'Low confidence = possible false positive, manual check recommended.',
            'Click event — opens modal with camera info and raw payload.',
          ],
        },
        {
          heading: 'Metrics Period and Comparison',
          items: [
            '**24h / 7d / 30d** switcher in top right corner — defines KPI calculation window.',
            'Delta badges always compare current period to previous equivalent (24h ↔ previous 24h, etc.).',
            'Period **persists** in URL (?period=24h|7d|30d) — shareable link.',
            'Period change does **not reload** the page — data fetched inline.',
          ],
        },
        {
          heading: 'Data Refresh and Connection',
          items: [
            '**Demo mode** — polling every **5 seconds** (setInterval).',
            '**Live mode** — Socket.IO, instant updates on changes.',
            'On connection loss — **yellow indicator** in header + frozen data (shows last known state).',
            'On reconnect — automatic re-sync, indicator turns green.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Morning check** — open page → review recommendations (handle if any) → switch to Posts Timeline for shift planning.',
            '[ok] **Daytime monitoring** — keep LiveSTOWidget on second monitor → notice a post stuck in occupied_no_work — send a master.',
            '[ok] **Spike analysis** — noticed 9/10 posts occupied → switch period to 7d and compare via delta with last week.',
            '[ok] **No-show response** — no_show recommendation appeared → click "Acknowledge" → reschedule slot in Posts Timeline.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // ТАЙМЛАЙН ПОСТОВ (Gantt)
  // ────────────────────────────
  dashboardPosts: {
    ru: {
      title: 'Таймлайн постов — Gantt-диаграмма',
      intro: 'Главный инструмент мастера-приёмщика. Визуальное расписание всех заказ-нарядов на смене по 10 постам. Перетаскивание (drag-n-drop) для перепланирования, мгновенная подсветка конфликтов, статистика смены сверху, нераспределённые ЗН снизу.',
      sections: [
        {
          heading: 'Карта экрана (что и где)',
          items: [
            '**Самый верх** — KPI-полоса смены: занятые/свободные посты, завершённые ЗН, нормочасы, простой, просрочки, «турбо».',
            '**Шапка таймлайна** — горизонтальная шкала времени (часы 08:00–20:00 по умолчанию).',
            '**Тело таймлайна** — 10 строк (по одной на каждый пост) с прямоугольниками-ЗН.',
            '**Красная вертикальная линия** — текущее время. Двигается каждую минуту.',
            '**Иконка шестерёнки** (вверху справа) — настройки смены (часы, количество постов).',
            '**Кнопка «Текущая смена»** — прокрутить таймлайн к текущему времени.',
            '**Таблица под таймлайном** — нераспределённые ЗН, готовые к назначению.',
            '**Внизу страницы** — Легенда с расшифровкой цветов и паттернов.',
          ],
        },
        {
          heading: 'Как читать блоки ЗН',
          items: [
            'Каждая **строка** — один пост, от **Поста 1** до **Поста 10**.',
            '**Длина блока** = нормочасы (например, ТО 2ч → блок шириной 2 часа на шкале).',
            '**Левый край блока** = scheduledTime (планируемое начало).',
            '**Правый край** = scheduledTime + normHours.',
            'Блоки **обрезаются** границами смены — не выходят за shiftStart/shiftEnd.',
            'Наведение мыши — **тултип**: номер ЗН, госномер, тип работ, мастер.',
            'Клик по блоку — **WorkOrderModal** с полной информацией и действиями.',
          ],
        },
        {
          heading: 'Цвета и паттерны блоков ЗН',
          items: [
            '[●green]{green:Зелёный} — completed (работа завершена).',
            '[●purple]{purple:Фиолетовый} — in_progress (работа идёт прямо сейчас).',
            '[●gray]{gray:Серый} — scheduled (запланировано, ещё не начато).',
            '[●gray]**Бледный/полупрозрачный** — cancelled (ЗН отменён).',
            '[●red]{red:Красная обводка} — overdue (фактическое время превысило нормочасы).',
            '[warn] **Полосатый паттерн** — конфликт: два ЗН пересекаются по времени на одном посту.',
            '[bolt] **«Турбо»** — ЗН выполнен быстрее нормы (savedTime > 0).',
          ],
        },
        {
          heading: 'Индикатор точки поста (слева)',
          items: [
            'Использует **единую палитру карты СТО** — те же цвета, что на STOMap:',
            '[●green]{green:Зелёный} = free.',
            '[●purple]{purple:Фиолетовый} = active_work.',
            '[●red]{red:Красный} = occupied_no_work.',
            '[●orange]{orange:Оранжевый} = occupied.',
            '[●gray]{gray:Серый} = no_data.',
          ],
        },
        {
          heading: 'KPI-полоса смены — что считается',
          items: [
            '**Занято / Свободно** — мгновенный срез по статусу постов.',
            '**Завершённые ЗН** — количество ЗН со статусом completed за смену.',
            '**Нормочасы** — суммарные normHours всех ЗН смены (включая нераспределённые).',
            '**Время простоя (idleTime)** — сколько часов посты простаивали (без авто или без работника).',
            '**Просроченные (overdueTime)** — суммарное время превышения нормы по всем in_progress / completed ЗН.',
            '**«Турбо» (savedTime)** — суммарное сэкономленное время (где факт < нормы). Чем больше — тем эффективнее смена.',
          ],
        },
        {
          heading: 'Drag-and-drop — перепланирование',
          items: [
            '**По горизонтали** — изменить время начала. Snap = **15 минут** (блок «прилипает» к четвертям часа).',
            '**По вертикали** — перенести на другой пост. ЗН меняет postId.',
            'При наведении на конфликтный слот блок **подсвечивается красным с полосами**.',
            'Кнопка **«Сохранить»** в правом верхнем углу — отправить изменения на сервер.',
            'При сохранении бэкенд проверяет **version** (optimistic locking). Если кто-то изменил параллельно → **HTTP 409** → обновите страницу.',
            '**Двигать можно только scheduled** — in_progress и completed «приклеены» к своему слоту.',
            'Кнопка **«Сбросить»** — откатить локальные изменения до последней сохранённой версии.',
          ],
        },
        {
          heading: 'Нераспределённые ЗН (таблица внизу)',
          items: [
            'ЗН без назначенного поста — ждут распределения.',
            'Колонки: **№ ЗН**, **госномер**, **тип работ**, **нормочасы**, **scheduledTime**.',
            'Сортировка по scheduledTime — самые срочные сверху.',
            '**Перетащите строку из таблицы на таймлайн** — назначит на пост в выбранный момент.',
            'Когда таблица **пустая** — все ЗН распределены, можно начинать смену.',
          ],
        },
        {
          heading: 'WorkOrderModal — действия по клику',
          items: [
            'Карточка ЗН: номер, госномер, марка/модель, тип работ, нормочасы, факт.',
            'Видно работника, мастера и аудиторскую историю изменений.',
            'Кнопки управления статусом: **Start**, **Pause**, **Resume**, **Complete**, **Cancel**.',
            'Можно вручную сменить **post** или **scheduledTime** через поля формы (альтернатива drag-and-drop).',
            'При сохранении из модалки — те же правила версионирования (409 при конфликте).',
          ],
        },
        {
          heading: 'Настройки смены (иконка-шестерёнка)',
          items: [
            '**Время начала** (shiftStart) — от 00:00 до 23:00. Граница левого края шкалы.',
            '**Время окончания** (shiftEnd) — от 01:00 до 24:00. Граница правого края шкалы.',
            '**Количество отображаемых постов** — 1–10. Скроет лишние строки.',
            'Настройки сохраняются в **localStorage** (ключ `dashboardPostsSettings`) — у каждого пользователя свои.',
            'Сменили часы — таймлайн перерисовывается мгновенно, ЗН перепозиционируются.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Утреннее планирование** — открыли страницу → перетащили все нераспределённые ЗН на свободные посты → нажали «Сохранить».',
            '[ok] **Реакция на неявку** — ЗН в красной обводке + клиент не приехал → клик → Cancel → освободившийся слот заполнили из нераспределённых.',
            '[ok] **Перенос между постами** — мастер заболел → перетащили все его ЗН на другой пост → сохранили.',
            '[ok] **Экстренное окно** — клиент приехал без записи → перетащили его ЗН в свободный слот → выставили scheduledTime = сейчас → Start.',
          ],
        },
        {
          heading: 'Возможные проблемы',
          items: [
            '**Ошибка 409 при сохранении** — кто-то редактировал параллельно. Решение: обновите страницу (F5), внесите правки заново.',
            '**Блок не двигается** — статус не scheduled (in_progress / completed нельзя перемещать).',
            '**Блок «исчезает» при перетаскивании** — улетел за shiftEnd. Сначала расширьте смену через настройки.',
            '**Полосатый блок** — конфликт по времени. Перетащите один из ЗН в свободный слот.',
          ],
        },
      ],
    },
    en: {
      title: 'Posts Timeline — Gantt Chart',
      intro: 'Primary tool for the service advisor. Visual schedule of all WOs across 10 posts for the shift. Drag-and-drop for replanning, instant conflict highlighting, shift KPI strip on top, unassigned WOs below.',
      sections: [
        {
          heading: 'Screen Map (where things are)',
          items: [
            '**Very top** — shift KPI strip: occupied/free posts, completed WOs, norm hours, idle time, overdue, "turbo".',
            '**Timeline header** — horizontal time scale (default 08:00–20:00).',
            '**Timeline body** — 10 rows (one per post) with WO rectangles.',
            '**Red vertical line** — current time. Moves every minute.',
            '**Gear icon** (top right) — shift settings (hours, post count).',
            '**"Current shift"** button — scrolls timeline to current time.',
            '**Table below timeline** — unassigned WOs ready to be slotted.',
            '**Bottom of page** — Legend explaining colors and patterns.',
          ],
        },
        {
          heading: 'How to Read WO Blocks',
          items: [
            'Each **row** — one post, from **Post 1** to **Post 10**.',
            '**Block length** = norm hours (e.g., 2h Maintenance → 2-hour-wide block).',
            '**Block left edge** = scheduledTime (planned start).',
            '**Right edge** = scheduledTime + normHours.',
            'Blocks are **clamped** to shift boundaries — they do not overflow shiftStart/shiftEnd.',
            'Hover — **tooltip**: WO number, plate, work type, master.',
            'Click — **WorkOrderModal** with full info and actions.',
          ],
        },
        {
          heading: 'WO Block Colors and Patterns',
          items: [
            '[●green]{green:Green} — completed.',
            '[●purple]{purple:Purple} — in_progress (work happening now).',
            '[●gray]{gray:Gray} — scheduled (not started yet).',
            '[●gray]**Faded/transparent** — cancelled.',
            '[●red]{red:Red outline} — overdue (actual time exceeded norm hours).',
            '[warn] **Striped pattern** — conflict: two WOs overlap on same post.',
            '[bolt] **"Turbo"** — WO completed faster than norm (savedTime > 0).',
          ],
        },
        {
          heading: 'Post Dot Indicator (left)',
          items: [
            'Uses the **single STO map palette** — same colors as on STOMap:',
            '[●green]{green:Green} = free.',
            '[●purple]{purple:Purple} = active_work.',
            '[●red]{red:Red} = occupied_no_work.',
            '[●orange]{orange:Orange} = occupied.',
            '[●gray]{gray:Gray} = no_data.',
          ],
        },
        {
          heading: 'Shift KPI Strip — What Is Counted',
          items: [
            '**Occupied / Free** — instant snapshot of post statuses.',
            '**Completed WOs** — number of WOs in completed status this shift.',
            '**Norm Hours** — total normHours of all shift WOs (including unassigned).',
            '**Idle Time** — hours posts were idle (no car or no worker).',
            '**Overdue** — total norm-exceedance time across in_progress / completed WOs.',
            '**"Turbo" (savedTime)** — total time saved (actual < norm). Higher = more efficient shift.',
          ],
        },
        {
          heading: 'Drag-and-Drop — Replanning',
          items: [
            '**Horizontal** — change start time. Snap = **15 minutes** (sticks to quarter-hours).',
            '**Vertical** — move to another post. WO postId changes.',
            'On hover over conflicting slot, block **highlights red with stripes**.',
            '**"Save"** button (top right) — sends changes to server.',
            'On save, backend checks **version** (optimistic locking). If someone edited concurrently → **HTTP 409** → refresh.',
            '**Only scheduled WOs are draggable** — in_progress and completed are locked.',
            '**"Reset"** button — discard local changes back to last saved.',
          ],
        },
        {
          heading: 'Unassigned WOs (Bottom Table)',
          items: [
            'WOs without an assigned post — waiting for distribution.',
            'Columns: **WO #**, **plate**, **work type**, **norm hours**, **scheduledTime**.',
            'Sort by scheduledTime — most urgent at top.',
            '**Drag a row from the table onto the timeline** — assigns to that post and time.',
            'Empty table = all WOs distributed, ready to start the shift.',
          ],
        },
        {
          heading: 'WorkOrderModal — Click Actions',
          items: [
            'WO card: number, plate, brand/model, work type, norm hours, actual.',
            'Shows worker, master and audit history of changes.',
            'Status buttons: **Start**, **Pause**, **Resume**, **Complete**, **Cancel**.',
            'Can manually change **post** or **scheduledTime** via form fields (alternative to drag).',
            'Same versioning rules apply when saving from modal (409 on conflict).',
          ],
        },
        {
          heading: 'Shift Settings (Gear Icon)',
          items: [
            '**Start time** (shiftStart) — from 00:00 to 23:00. Left edge of scale.',
            '**End time** (shiftEnd) — from 01:00 to 24:00. Right edge of scale.',
            '**Visible post count** — 1–10. Hides extra rows.',
            'Settings saved to **localStorage** (`dashboardPostsSettings` key) — per user.',
            'Change hours — timeline redraws instantly, blocks reposition.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Morning planning** — open page → drag all unassigned WOs onto free posts → click "Save".',
            '[ok] **No-show response** — red-outlined WO + client absent → click → Cancel → fill freed slot from unassigned.',
            '[ok] **Move between posts** — master sick → drag all his WOs to another post → save.',
            '[ok] **Walk-in slot** — client arrived without appointment → drag WO into free slot → set scheduledTime = now → Start.',
          ],
        },
        {
          heading: 'Troubleshooting',
          items: [
            '**409 error on save** — someone edited concurrently. Solution: refresh (F5), redo your changes.',
            '**Block does not move** — status is not scheduled (in_progress / completed cannot be moved).',
            '**Block "disappears" while dragging** — went past shiftEnd. Extend shift in settings first.',
            '**Striped block** — time conflict. Drag one of the WOs to a free slot.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // ДЕТАЛИЗАЦИЯ ПО ПОСТАМ
  // ────────────────────────────
  postsDetail: {
    ru: {
      title: 'Детализация по постам',
      intro: 'Подробная аналитика по каждому посту: загрузка, эффективность, история ЗН, работники. Используйте для анализа производительности и выявления узких мест. Поддерживает периоды от одного дня до месяца, два режима просмотра и панель деталей с глубокой разбивкой.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх слева** — переключатель периода (Сегодня / Вчера / Неделя / Месяц / Произвольный).',
            '[eye] **Верх справа** — переключатель режима отображения (Карточки / Таблица).',
            '[eye] **Центр (основная зона)** — список 10 постов: либо сетка карточек, либо строки таблицы.',
            '[eye] **Правая панель** — открывается при клике на пост: углублённая аналитика и графики.',
            'При закрытой правой панели карточки занимают всю ширину; при открытой — сжимаются.',
          ],
        },
        {
          heading: 'Выбор периода',
          items: [
            'Кнопки быстрого выбора: **Сегодня**, **Вчера**, **Неделя**, **Месяц**.',
            '**Произвольный диапазон дат** — два поля для точного указания периода анализа.',
            'Все метрики, графики и таблицы пересчитываются при смене периода.',
            'По умолчанию выбрано **«Сегодня»** при открытии страницы.',
            'Период не сохраняется в URL — при перезагрузке страницы вернётся «Сегодня».',
          ],
        },
        {
          heading: 'Режимы отображения',
          items: [
            '**Карточки** — визуальная сетка 10 постов с ключевыми метриками. Удобно для быстрой оценки.',
            '**Таблица** — компактная таблица всех постов с сортировкой по любой колонке (клик по заголовку).',
            'Переключение кнопками в правом верхнем углу (иконки сетки и списка).',
            'Режим сохраняется при переключении периода.',
          ],
        },
        {
          heading: 'Карточка поста (режим «Карточки»)',
          items: [
            '**Загрузка (%)** — сколько рабочего времени пост был занят автомобилем.',
            '**Эффективность (%)** — соотношение фактического времени работы к нормативному. >100% = отлично.',
            '**Авто** — количество обслуженных автомобилей за период.',
            '**Среднее время** — средняя продолжительность обслуживания одного авто.',
            'Цвет индикатора: **зелёный** > 70%, **жёлтый** 40-70%, **красный** < 40%.',
            'Номер поста отображается в левом верхнем углу карточки.',
            'Бейдж типа поста (Грузовой / Легковой / Спец) — рядом с номером.',
          ],
        },
        {
          heading: 'Панель деталей (клик на пост)',
          items: [
            'Открывается **справа** от списка постов. Показывает углублённую аналитику.',
            '**Графики по дням**: загрузка, эффективность, присутствие работника — столбчатые диаграммы.',
            '**Работники** — кто работал на посту, сколько часов, количество ЗН.',
            '**Заказ-наряды** — список всех ЗН: номер, госномер, тип работ, нормочасы, статус.',
            '**Предупреждения** — отсутствие работника, простои, превышение нормы.',
            'Каждая секция сворачиваемая — кликните по заголовку для раскрытия/свёртывания.',
            'Кнопка **«X»** в правом верхнем углу панели — закрыть и вернуться к полному списку.',
          ],
        },
        {
          heading: 'Детали в панели: дополнительные разделы',
          items: [
            '**Журнал событий** — все CV-события на этом посту за период.',
            '**Статистика** — суммарные метрики: общее время работы, простоя, количество пауз.',
            '**Камеры** — привязанные к посту камеры с превью последнего кадра.',
            'Кнопка **«Показать все»** открывает модальное окно с полным списком (для ЗН и работников).',
          ],
        },
        {
          heading: 'Режим таблицы',
          items: [
            'Колонки: **Пост**, **Загрузка%**, **Эффективность%**, **Авто**, **Ср. время**, **Работник**.',
            'Клик по заголовку колонки — сортировка (по возрастанию/убыванию).',
            'Стрелка в заголовке показывает текущее направление сортировки.',
            'Клик по строке — открытие панели деталей для этого поста.',
            'Строки с низкой загрузкой подсвечиваются бледным фоном.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Поиск узких мест** — выбрали Неделю → отсортировали таблицу по загрузке (ASC) → нашли посты с < 40% → открыли детали → выяснили причину (нет работника / мало ЗН).',
            '[ok] **Анализ работника** — открыли пост → раздел «Работники» → увидели, кто меньше всего часов отработал.',
            '[ok] **Сравнение «вчера vs сегодня»** — Сегодня → запомнили цифры → Вчера → сравнили вручную.',
            '[ok] **Подготовка к митингу** — Месяц → таблица → отсортировали по эффективности → сделали screenshot топ-3 / худшие 3.',
          ],
        },
      ],
    },
    en: {
      title: 'Posts Detail',
      intro: 'Detailed analytics per post: occupancy, efficiency, WO history, workers. Use to analyze performance and identify bottlenecks. Supports periods from one day to a month, two view modes, and a deep-dive detail panel.',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Top left** — period switcher (Today / Yesterday / Week / Month / Custom).',
            '[eye] **Top right** — view mode switcher (Cards / Table).',
            '[eye] **Center (main area)** — list of 10 posts: either card grid or table rows.',
            '[eye] **Right panel** — opens on post click: deep analytics and charts.',
            'With panel closed, cards span full width; with panel open they shrink.',
          ],
        },
        {
          heading: 'Period Selection',
          items: [
            'Quick select buttons: **Today**, **Yesterday**, **Week**, **Month**.',
            '**Custom date range** — two fields for precise analysis period.',
            'All metrics, charts, and tables recalculate on period change.',
            'Default is **"Today"** when the page opens.',
            'Period is not persisted in URL — page reload returns to Today.',
          ],
        },
        {
          heading: 'Display Modes',
          items: [
            '**Cards** — visual grid of 10 posts with key metrics. Good for quick overview.',
            '**Table** — compact table with sorting by any column (click header).',
            'Toggle with buttons in top right corner (grid and list icons).',
            'Mode persists when switching periods.',
          ],
        },
        {
          heading: 'Post Card (Cards mode)',
          items: [
            '**Occupancy (%)** — how much work time the post had a vehicle.',
            '**Efficiency (%)** — ratio of actual work time to norm time. >100% = excellent.',
            '**Vehicles** — number of serviced vehicles in the period.',
            '**Avg Time** — average service duration per vehicle.',
            'Color indicator: **green** > 70%, **yellow** 40-70%, **red** < 40%.',
            'Post number displayed in top left corner of the card.',
            'Post type badge (Truck / Light / Special) — next to the number.',
          ],
        },
        {
          heading: 'Detail Panel (click a post)',
          items: [
            'Opens on the **right** side. Shows deep analytics.',
            '**Daily charts**: occupancy, efficiency, worker presence — bar charts.',
            '**Workers** — who worked on the post, hours, WO count.',
            '**Work Orders** — full list: number, plate, work type, norm hours, status.',
            '**Alerts** — worker absence, idle time, norm exceedance.',
            'Each section is collapsible — click heading to expand/collapse.',
            '**"X"** in panel top right corner — close and return to full list.',
          ],
        },
        {
          heading: 'Detail Panel: Additional Sections',
          items: [
            '**Event Log** — all CV events on this post for the period.',
            '**Statistics** — summary metrics: total work time, idle time, pause count.',
            '**Cameras** — cameras linked to the post with latest frame preview.',
            '**"Show All"** button opens modal with complete list (for WOs and workers).',
          ],
        },
        {
          heading: 'Table Mode',
          items: [
            'Columns: **Post**, **Occupancy%**, **Efficiency%**, **Vehicles**, **Avg Time**, **Worker**.',
            'Click column header — sort ascending/descending.',
            'Header arrow shows current sort direction.',
            'Click row — open detail panel for that post.',
            'Low-occupancy rows highlighted with faded background.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Bottleneck hunt** — pick Week → sort table by occupancy ASC → find posts < 40% → open details → identify cause (no worker / few WOs).',
            '[ok] **Worker analysis** — open post → "Workers" section → see who logged the fewest hours.',
            '[ok] **"Yesterday vs Today"** — Today → note numbers → Yesterday → manual compare.',
            '[ok] **Meeting prep** — Month → table → sort by efficiency → screenshot top-3 / worst-3.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // КАРТА СТО (MapViewer)
  // ────────────────────────────
  map: {
    ru: {
      title: 'Карта СТО — Живой обзор',
      intro: 'Интерактивная карта станции на базе Konva (Canvas). Реальные пропорции СТО (46540×30690 мм). Показывает все посты, зоны, камеры и автомобили в реальном времени, с цветовой индикацией статусов и кликабельными элементами. Поддерживает режим воспроизведения (replay) для просмотра истории.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Центр** — холст карты с зданиями, постами, зонами и камерами.',
            '[eye] **Правый верхний угол** — панель «Слои» (toggle для каждого типа элементов).',
            '[eye] **Левый нижний угол** — кнопки масштаба (+/−), сброс, полный экран.',
            '[eye] **Низ или боковая панель** — сводка по постам и счётчик авто.',
            '[eye] **Полоса replay** (если включена) — слайдер времени для просмотра истории.',
          ],
        },
        {
          heading: 'Элементы на карте',
          items: [
            '**Здания (building)** — контуры строений СТО.',
            '**Посты (post)** — рабочие места механиков. Цвет зависит от статуса: [●green]{green:зелёный} = свободен, [●purple]{purple:фиолетовый} = идёт работа, [●red]{red:красный} = занят без работы, [●orange]{orange:оранжевый} = занят/предупреждение, [●gray]{gray:серый} = нет данных.',
            '**Зоны (zone)** — области: ремонт, ожидание, въезд, парковка, свободная. Показывают количество авто.',
            '**Камеры (camera)** — позиции камер с направлением обзора (треугольный fov).',
            '**Двери (door)** — входы и выходы в здания.',
            '**Стены (wall)** — внутренние перегородки.',
            '**Проезды (driveway)** — пути движения автомобилей.',
            '**Метки (label)** — текстовые надписи на карте.',
            '**Инфозоны (infozone)** — области с дополнительной информацией.',
            '**Авто (vehicles)** — иконки машин с госномерами, появляются в активных сессиях.',
          ],
        },
        {
          heading: 'Цвет постов — расшифровка',
          items: [
            '[●green]{green:Зелёный} = free — пост свободен, готов к приёму.',
            '[●purple]{purple:Фиолетовый} = active_work — идёт обслуживание, есть работник.',
            '[●red]{red:Красный} = occupied_no_work — авто стоит, работа не ведётся.',
            '[●orange]{orange:Оранжевый} = occupied — занят (предупреждение, переходное состояние).',
            '[●gray]{gray:Серый} = no_data — пост есть в БД, но CV не присылает данные.',
            '[info] У каждого поста — номер и иконка типа (грузовой / легковой / спец).',
          ],
        },
        {
          heading: 'Панель «Слои» (видимость элементов)',
          items: [
            'Открывается в правом верхнем углу — переключатели по типам.',
            'Можно скрыть/показать: здания, проезды, посты, зоны, камеры, двери, стены, метки, инфозоны.',
            'Скрытие лишних слоёв уменьшает визуальный шум — удобно при показе клиенту.',
            'Состояние слоёв **сбрасывается** при перезагрузке страницы.',
          ],
        },
        {
          heading: 'Навигация и масштаб',
          items: [
            '**Колёсико мыши** — zoom in/out с центром на курсоре.',
            '**Зажатая левая кнопка** — перетаскивание карты (pan).',
            'Кнопки **«+» / «−»** — пошаговое масштабирование.',
            'Кнопка **«На весь экран»** — развернуть карту на всё окно (fullscreen).',
            'Кнопка **«Сбросить»** — вернуть начальный масштаб и позицию.',
            'Реальный размер: **46540×30690 мм** — соответствует пропорциям СТО.',
          ],
        },
        {
          heading: 'Интерактивность — клики',
          items: [
            '**Клик на пост** — модальное окно: номер, статус, госномер авто, работник, время на посту.',
            '**Клик на зону** — карточка зоны: тип, текущее количество авто, список госномеров.',
            '**Клик на камеру** — модальное окно с HLS-стримом (CameraStreamModal).',
            '**Клик на инфозону** — дополнительная информация (текст, статистика).',
            'Все модалки закрываются кликом вне или кнопкой X.',
          ],
        },
        {
          heading: 'Replay — режим воспроизведения',
          items: [
            'Кнопка **«Replay»** включает режим истории — карта отображает состояние за прошлый момент.',
            'Появляется **слайдер времени** — двигайте для перехода к нужному моменту.',
            'Кнопки **Play / Pause** — автоматическое воспроизведение с заданной скоростью.',
            'Полезно для разбора инцидентов: «что было в 14:23?»',
            'Чтобы вернуться в реальное время — кнопка **«Сейчас»** или выключите Replay.',
          ],
        },
        {
          heading: 'Обновление данных',
          items: [
            'В **live-режиме** — каждые **10 секунд** через polling monitoringProxy.',
            'В **демо-режиме** — каждые **5 секунд**.',
            'Статусы постов приходят из **/api/posts**, сессии из **/api/sessions/active**.',
            'Карта (геометрия) загружается из **/api/map-layout** (последняя сохранённая версия).',
            'Геометрия меняется только при пересохранении в редакторе — обычно стабильна.',
          ],
        },
        {
          heading: 'Сводная панель',
          items: [
            'Внизу или сбоку карты — счётчики: свободно/занято/в работе.',
            'Общее количество автомобилей на территории.',
            'Цветовые индикаторы дублируют статусы постов на карте.',
            'Помогает быстро увидеть нагрузку без подсчёта точек.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Контроль смены** — открыли карту на втором мониторе → видите все посты и движение авто в реальном времени.',
            '[ok] **Поиск авто** — клиент звонит «где моя машина?» → нашли её на карте по госномеру.',
            '[ok] **Проверка камеры** — заметили проблему на посту → клик на ближайшую камеру → смотрите видео.',
            '[ok] **Разбор инцидента** — Replay → переместили слайдер на нужный момент → разобрались, что произошло.',
          ],
        },
      ],
    },
    en: {
      title: 'STO Map — Live Overview',
      intro: 'Interactive STO map powered by Konva (Canvas). Real STO proportions (46540×30690 mm). Displays all posts, zones, cameras, and vehicles in real-time with color-coded statuses and clickable elements. Supports replay mode for browsing history.',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Center** — map canvas with buildings, posts, zones, and cameras.',
            '[eye] **Top right** — "Layers" panel (toggle per element type).',
            '[eye] **Bottom left** — zoom buttons (+/−), reset, fullscreen.',
            '[eye] **Bottom or side panel** — post summary and vehicle counter.',
            '[eye] **Replay strip** (when enabled) — time slider for browsing history.',
          ],
        },
        {
          heading: 'Map Elements',
          items: [
            '**Buildings (building)** — outlines of STO structures.',
            '**Posts (post)** — mechanic workstations. Color by status: [●green]{green:green} = free, [●purple]{purple:purple} = active work, [●red]{red:red} = occupied no work, [●orange]{orange:orange} = occupied/warning, [●gray]{gray:gray} = no data.',
            '**Zones (zone)** — areas: repair, waiting, entry, parking, free. Show vehicle count.',
            '**Cameras (camera)** — camera positions with viewing direction (triangular FOV).',
            '**Doors (door)** — building entrances and exits.',
            '**Walls (wall)** — interior partitions.',
            '**Driveways (driveway)** — vehicle movement paths.',
            '**Labels (label)** — text annotations on the map.',
            '**Infozones (infozone)** — areas with additional information.',
            '**Vehicles** — car icons with plates, appear in active sessions.',
          ],
        },
        {
          heading: 'Post Color Legend',
          items: [
            '[●green]{green:Green} = free — post available.',
            '[●purple]{purple:Purple} = active_work — service in progress, worker present.',
            '[●red]{red:Red} = occupied_no_work — car parked, no work happening.',
            '[●orange]{orange:Orange} = occupied — busy (warning, transitional state).',
            '[●gray]{gray:Gray} = no_data — post exists in DB but CV is not reporting.',
            '[info] Each post shows number and type icon (truck / light / special).',
          ],
        },
        {
          heading: '"Layers" Panel (Element Visibility)',
          items: [
            'Top right corner — toggles per type.',
            'Can hide/show: buildings, driveways, posts, zones, cameras, doors, walls, labels, infozones.',
            'Hiding noise layers helps focus on what matters — useful for client demos.',
            'Layer state **resets** on page reload.',
          ],
        },
        {
          heading: 'Navigation and Zoom',
          items: [
            '**Mouse wheel** — zoom in/out, centered on cursor.',
            '**Left button hold** — drag/pan the map.',
            '**"+" / "−"** buttons — step zoom.',
            '**"Fullscreen"** button — expand map to fill window.',
            '**"Reset"** button — return to initial zoom and position.',
            'Real size: **46540×30690 mm** — matches STO proportions.',
          ],
        },
        {
          heading: 'Interactivity — Clicks',
          items: [
            '**Click post** — modal: number, status, plate, worker, time on post.',
            '**Click zone** — zone card: type, current vehicle count, plate list.',
            '**Click camera** — modal with HLS stream (CameraStreamModal).',
            '**Click infozone** — additional information (text, stats).',
            'All modals close on outside click or X button.',
          ],
        },
        {
          heading: 'Replay Mode',
          items: [
            '**"Replay"** button enables history mode — map shows past state.',
            '**Time slider** appears — drag to jump to any moment.',
            '**Play / Pause** buttons — auto-replay at chosen speed.',
            'Useful for incident review: "what was the state at 14:23?"',
            'To return to real-time — **"Now"** button or disable Replay.',
          ],
        },
        {
          heading: 'Data Updates',
          items: [
            'In **live mode** — every **10 seconds** via monitoringProxy polling.',
            'In **demo mode** — every **5 seconds**.',
            'Post statuses from **/api/posts**, sessions from **/api/sessions/active**.',
            'Map (geometry) loaded from **/api/map-layout** (latest saved version).',
            'Geometry only changes when re-saved in editor — usually stable.',
          ],
        },
        {
          heading: 'Statistics Panel',
          items: [
            'Below or beside the map — counters: free/occupied/active work.',
            'Total vehicles on premises.',
            'Color indicators mirror map post statuses.',
            'Quick load assessment without counting points.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Shift monitoring** — open map on second monitor → watch all posts and vehicle movement live.',
            '[ok] **Find a vehicle** — client calls "where is my car?" → locate it on the map by plate.',
            '[ok] **Camera check** — spotted an issue at a post → click nearest camera → watch live feed.',
            '[ok] **Incident review** — Replay → move slider to the moment → understand what happened.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // РЕДАКТОР КАРТЫ (MapEditor)
  // ────────────────────────────
  mapEditor: {
    ru: {
      title: 'Редактор карты СТО',
      intro: 'Полнофункциональный визуальный редактор планировки СТО. 10 типов элементов, drag-n-drop, рисование полигонов, фоновое изображение для трассировки. Поддерживает отмену (Undo до 50 шагов), версионирование (история) и экспорт в JSON. Изменения становятся видны на странице «Карта» после сохранения.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Левая панель** — панель инструментов (10 типов элементов + Select).',
            '[eye] **Центр** — холст редактора (canvas Konva с реальными пропорциями СТО).',
            '[eye] **Правая панель** — свойства выделенного элемента (название, координаты, тип).',
            '[eye] **Верх** — кнопки: Сохранить, Сбросить, История, Экспорт/Импорт JSON, Загрузить фон.',
            '[eye] **Низ или угол** — управление масштабом (+, −, %), переключатель сетки.',
          ],
        },
        {
          heading: 'Панель инструментов',
          items: [
            '**Выделение (Select)** — выбор и перемещение элементов. Клик по элементу для выделения.',
            '**Здание (Building)** — рисование контура здания полигоном.',
            '**Пост (Post)** — размещение рабочего поста. Указывается номер и тип (heavy/light/special).',
            '**Зона (Zone)** — создание зоны полигоном. Типы: repair, waiting, entry, parking, free.',
            '**Камера (Camera)** — размещение камеры с направлением обзора.',
            '**Проезд (Driveway)** — рисование пути движения автомобилей.',
            '**Дверь (Door)** — обозначение входов/выходов.',
            '**Стена (Wall)** — рисование перегородок.',
            '**Метка (Label)** — текстовые надписи на карте.',
            '**Инфозона (Infozone)** — информационные области.',
          ],
        },
        {
          heading: 'Рисование полигонов',
          items: [
            'Выберите инструмент (здание, зона, проезд) и **кликайте** для добавления точек.',
            '**Двойной клик** — завершить полигон.',
            'Для стен, дверей и проездов действует **ограничение 90 градусов** — линии только горизонтальные или вертикальные.',
            'Минимум **3 точки** для создания замкнутого полигона.',
            'Нажмите **Escape** для отмены текущего рисования.',
          ],
        },
        {
          heading: 'Свойства элемента (правая панель)',
          items: [
            'Выберите элемент — справа откроется **панель свойств**.',
            'Можно изменить: название, тип, цвет, позицию (X, Y), размер.',
            'Для постов: номер поста, тип (тяжёлый/лёгкий/специальный).',
            'Для зон: тип зоны (ремонт/ожидание/въезд/парковка/свободная).',
            'Для камер: направление обзора (угол), название.',
            'Изменения применяются мгновенно на canvas.',
          ],
        },
        {
          heading: 'Горячие клавиши',
          items: [
            '**Ctrl+Z** — отменить последнее действие (Undo, до 50 шагов).',
            '**Ctrl+Shift+Z** — повторить отменённое действие (Redo).',
            '**Delete** — удалить выделенный элемент.',
            '**Escape** — снять выделение / отменить рисование.',
            '**Стрелки** — сдвинуть элемент на 10px. **Shift+стрелки** — сдвиг на 1px.',
            '**Ctrl+D** — дублировать выделенный элемент.',
          ],
        },
        {
          heading: 'Фоновое изображение',
          items: [
            'Кнопка **«Загрузить фон»** — загрузить изображение планировки (PNG, JPG).',
            'Поддержка **PDF** — автоматическая конвертация первой страницы в PNG.',
            'Фон отображается под всеми элементами — удобно для трассировки.',
            'Можно изменить прозрачность фона.',
          ],
        },
        {
          heading: 'Сетка и привязка',
          items: [
            '**Сетка** — включается/выключается кнопкой. Шаг 10px.',
            '**Snap-to-grid** — при перемещении элементы привязываются к сетке (шаг 10px).',
            'Помогает выравнивать элементы относительно друг друга.',
            'Размер холста: **46540x30690 мм** — реальные размеры СТО.',
          ],
        },
        {
          heading: 'Сохранение и версионирование',
          items: [
            'Кнопка **«Сохранить»** — сохраняет текущий макет на сервер (**/api/map-layout**).',
            'Каждое сохранение создаёт **новую версию** (MapLayoutVersion).',
            'Кнопка **«История»** — список всех версий с датой и автором.',
            'Можно **восстановить** любую предыдущую версию.',
            '**Экспорт/Импорт JSON** — для резервного копирования или переноса макетов.',
          ],
        },
        {
          heading: 'Масштабирование',
          items: [
            '**Колёсико мыши** — zoom in/out.',
            'Кнопки **+/-** в углу — пошаговое масштабирование.',
            'Процент масштаба отображается рядом с кнопками.',
            'При большом масштабе видны мелкие детали для точной расстановки.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Создание новой карты с нуля** — Загрузить фон (PDF/PNG плана) → нарисовать здания (Building tool) → добавить зоны (Zone) → расставить посты (Post) → разместить камеры (Camera) → Сохранить.',
            '[ok] **Корректировка существующей** — открыли редактор → нашли элемент → выделили → исправили координаты в правой панели → Сохранить.',
            '[ok] **Откат к старой версии** — История → выбрали нужную версию → Восстановить.',
            '[ok] **Перенос на другой сервер** — Экспорт JSON → загрузили на другом сервере → Импорт JSON → Сохранить.',
            '[ok] **Дублирование поста** — выделили пост → Ctrl+D → переместили клон → исправили номер в правой панели.',
          ],
        },
        {
          heading: 'Возможные проблемы',
          items: [
            '**Полигон не замыкается** — нужно минимум 3 точки и двойной клик в конце.',
            '**Стена идёт под углом** — для стен/дверей/проездов работает ограничение 90°. Нажмите Escape и нарисуйте заново.',
            '**Изменения не видны на «Карте»** — проверьте, нажали ли «Сохранить». Перезагрузите страницу карты.',
            '**Ctrl+Z не работает** — сначала кликните на холст, чтобы фокус перешёл к редактору.',
            '**Фон растянут** — при загрузке подгоняется под размер холста. Используйте план в правильных пропорциях.',
          ],
        },
      ],
    },
    en: {
      title: 'STO Map Editor',
      intro: 'Full-featured visual layout editor for the STO. 10 element types, drag-and-drop, polygon drawing, background image for tracing. Supports undo (up to 50 steps), versioning (history), and JSON export. Changes appear on the Map page after saving.',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Left panel** — toolbar (10 element types + Select).',
            '[eye] **Center** — editor canvas (Konva canvas with real STO proportions).',
            '[eye] **Right panel** — properties of selected element (name, coords, type).',
            '[eye] **Top** — buttons: Save, Reset, History, Export/Import JSON, Load Background.',
            '[eye] **Bottom or corner** — zoom controls (+, −, %), grid toggle.',
          ],
        },
        {
          heading: 'Toolbar',
          items: [
            '**Select** — select and move elements. Click element to select.',
            '**Building** — draw building outline as polygon.',
            '**Post** — place a work post. Specify number and type (heavy/light/special).',
            '**Zone** — create zone as polygon. Types: repair, waiting, entry, parking, free.',
            '**Camera** — place camera with viewing direction.',
            '**Driveway** — draw vehicle movement path.',
            '**Door** — mark entrances/exits.',
            '**Wall** — draw partitions.',
            '**Label** — text annotations on the map.',
            '**Infozone** — informational areas.',
          ],
        },
        {
          heading: 'Drawing Polygons',
          items: [
            'Select a tool (building, zone, driveway) and **click** to add points.',
            '**Double-click** — finish the polygon.',
            'Walls, doors, and driveways have **90-degree constraint** — lines are horizontal or vertical only.',
            'Minimum **3 points** for a closed polygon.',
            'Press **Escape** to cancel current drawing.',
          ],
        },
        {
          heading: 'Element Properties (right panel)',
          items: [
            'Select an element — **properties panel** opens on the right.',
            'Can edit: name, type, color, position (X, Y), size.',
            'For posts: post number, type (heavy/light/special).',
            'For zones: zone type (repair/waiting/entry/parking/free).',
            'For cameras: viewing direction (angle), name.',
            'Changes apply instantly on canvas.',
          ],
        },
        {
          heading: 'Keyboard Shortcuts',
          items: [
            '**Ctrl+Z** — undo last action (up to 50 steps).',
            '**Ctrl+Shift+Z** — redo undone action.',
            '**Delete** — remove selected element.',
            '**Escape** — deselect / cancel drawing.',
            '**Arrow keys** — move element by 10px. **Shift+arrows** — move by 1px.',
            '**Ctrl+D** — duplicate selected element.',
          ],
        },
        {
          heading: 'Background Image',
          items: [
            '**"Upload Background"** button — load a layout image (PNG, JPG).',
            '**PDF** support — automatic conversion of first page to PNG.',
            'Background displays below all elements — useful for tracing.',
            'Background opacity can be adjusted.',
          ],
        },
        {
          heading: 'Grid and Snapping',
          items: [
            '**Grid** — toggled on/off with button. Step size 10px.',
            '**Snap-to-grid** — elements snap to grid when moved (10px step).',
            'Helps align elements relative to each other.',
            'Canvas size: **46540x30690 mm** — real STO dimensions.',
          ],
        },
        {
          heading: 'Save and Versioning',
          items: [
            '**"Save"** button — saves current layout to server (**/api/map-layout**).',
            'Each save creates a **new version** (MapLayoutVersion).',
            '**"History"** button — list of all versions with date and author.',
            'Can **restore** any previous version.',
            '**Export/Import JSON** — for backup or transferring layouts.',
          ],
        },
        {
          heading: 'Zoom Controls',
          items: [
            '**Mouse wheel** — zoom in/out.',
            '**+/-** buttons in corner — step zoom.',
            'Zoom percentage displayed next to buttons.',
            'High zoom reveals fine details for precise placement.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Build a new map from scratch** — Load background (PDF/PNG plan) → draw buildings (Building tool) → add zones (Zone) → place posts (Post) → place cameras (Camera) → Save.',
            '[ok] **Adjust existing map** — open editor → find element → select → fix coordinates in right panel → Save.',
            '[ok] **Roll back to an old version** — History → pick a version → Restore.',
            '[ok] **Migrate to another server** — Export JSON → upload to other server → Import JSON → Save.',
            '[ok] **Duplicate a post** — select post → Ctrl+D → move the clone → change post number in right panel.',
          ],
        },
        {
          heading: 'Troubleshooting',
          items: [
            '**Polygon does not close** — need at least 3 points and a double-click to finish.',
            '**Wall is at an angle** — walls/doors/driveways have 90° constraint. Press Escape and redraw.',
            '**Changes not visible on Map page** — check that you clicked Save. Reload the map page.',
            '**Ctrl+Z does not work** — click on canvas first so focus moves to editor.',
            '**Background stretched** — fits to canvas size on load. Use a plan in correct proportions.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // СЕССИИ
  // ────────────────────────────
  sessions: {
    ru: {
      title: 'Сессии автомобилей',
      intro: 'Журнал визитов автомобилей на СТО. Сессия = одно посещение: открывается на въезде (CV-камера зафиксировала госномер) и закрывается на выезде. Внутри сессии — маршрут по зонам (ZoneStay) и пребывание на постах (PostStay). Отключена в live-режиме (там сессии управляются автоматически внешней системой).',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — две вкладки: Активные / Завершённые.',
            '[eye] **Над таблицей** — фильтр по посту, поиск по госномеру.',
            '[eye] **Центр** — таблица сессий с пагинацией.',
            '[eye] **Низ** — переключатель страниц (по 20 записей).',
            '[eye] **Модальное окно** (по клику на строку) — детали сессии: маршрут, посты, QR.',
          ],
        },
        {
          heading: 'Вкладки',
          items: [
            '**Активные** — автомобили, которые находятся на территории СТО прямо сейчас.',
            '**Завершённые** — автомобили, которые покинули СТО. Видно полное время пребывания.',
            'Переключение вкладок не сбрасывает фильтры.',
          ],
        },
        {
          heading: 'Таблица сессий',
          items: [
            '**Госномер** — отображается в виде визуальной плашки (как на автомобиле).',
            '**Время въезда** — когда авто было зафиксировано на въезде.',
            '**Зона** — текущая зона (для активных) или последняя зона (для завершённых).',
            '**Пост** — номер поста, если авто заехало на пост.',
            '**Статус** — active (на территории) или completed (выехал).',
            'Сортировка по любой колонке — клик по заголовку.',
          ],
        },
        {
          heading: 'Фильтрация',
          items: [
            '**Фильтр по посту** — показать сессии только для конкретного поста.',
            '**Поиск** — поиск по госномеру.',
            'Фильтры применяются мгновенно.',
          ],
        },
        {
          heading: 'Детали сессии (клик по строке)',
          items: [
            'Модальное окно с полной информацией о визите автомобиля.',
            '**Госномер** — крупным шрифтом с визуальной плашкой.',
            '**Маршрут по зонам** — через какие зоны проезжал автомобиль (ZoneStay) с временем в каждой.',
            '**Привязанный ЗН** — автоматически найденный заказ-наряд по совпадению госномера.',
            '**QR-код** — ссылка на сессию, можно отсканировать для быстрого доступа.',
            '**Пребывание на посту** (PostStay) — время на каждом посту, наличие работника, активное/простойное время.',
          ],
        },
        {
          heading: 'Пагинация',
          items: [
            'По **20 записей** на страницу.',
            'Навигация: первая, предыдущая, номер страницы, следующая, последняя.',
            'Общее количество записей отображается рядом.',
          ],
        },
        {
          heading: 'Ограничения',
          items: [
            'Страница **отключена в live-режиме** — в живом режиме сессии управляются автоматически.',
            'Данные в демо-режиме генерируются автоматически для демонстрации.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Поиск конкретного авто** — поле поиска → ввели госномер → увидели все его визиты (Активные + Завершённые).',
            '[ok] **Анализ задержек** — Завершённые → отсортировали по длительности → нашли «зависшие» сессии и причины.',
            '[ok] **Сверка с 1С** — открыли деталь сессии → нашли привязанный ЗН → проверили совпадение по госномеру и времени.',
            '[ok] **Поделиться QR** — деталь сессии → отсканировали QR → быстрый доступ с мобильного.',
          ],
        },
      ],
    },
    en: {
      title: 'Vehicle Sessions',
      intro: 'Log of vehicle visits to STO. A session = one visit: opens at entry (CV camera captures plate) and closes at exit. Inside a session — zone route (ZoneStay) and post stays (PostStay). Disabled in live mode (sessions are managed automatically by the external system).',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Top** — two tabs: Active / Completed.',
            '[eye] **Above table** — post filter, plate search.',
            '[eye] **Center** — sessions table with pagination.',
            '[eye] **Bottom** — page switcher (20 records per page).',
            '[eye] **Modal** (on row click) — session details: route, posts, QR.',
          ],
        },
        {
          heading: 'Tabs',
          items: [
            '**Active** — vehicles currently on STO premises.',
            '**Completed** — vehicles that have left. Full visit duration visible.',
            'Tab switching does not reset filters.',
          ],
        },
        {
          heading: 'Sessions Table',
          items: [
            '**Plate Number** — displayed as a visual badge (like on a car).',
            '**Entry Time** — when the vehicle was detected at entry.',
            '**Zone** — current zone (active) or last zone (completed).',
            '**Post** — post number if vehicle is/was on a post.',
            '**Status** — active (on premises) or completed (exited).',
            'Sort by any column — click header.',
          ],
        },
        {
          heading: 'Filtering',
          items: [
            '**Post filter** — show sessions for a specific post only.',
            '**Search** — search by plate number.',
            'Filters apply instantly.',
          ],
        },
        {
          heading: 'Session Details (click row)',
          items: [
            'Modal window with full vehicle visit information.',
            '**Plate** — large font with visual badge.',
            '**Zone Route** — which zones the vehicle visited (ZoneStay) with time in each.',
            '**Linked WO** — automatically found work order by plate number match.',
            '**QR Code** — session link for quick mobile access.',
            '**Post Stay** — time on each post, worker presence, active/idle time.',
          ],
        },
        {
          heading: 'Pagination',
          items: [
            '**20 records** per page.',
            'Navigation: first, previous, page number, next, last.',
            'Total record count displayed alongside.',
          ],
        },
        {
          heading: 'Limitations',
          items: [
            'Page is **disabled in live mode** — sessions are managed automatically in live.',
            'Demo mode data is auto-generated for demonstration.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Find a specific car** — search field → enter plate → see all visits (Active + Completed).',
            '[ok] **Analyze delays** — Completed → sort by duration → find "stuck" sessions and root causes.',
            '[ok] **Reconcile with 1C** — open session detail → find linked WO → verify plate and time match.',
            '[ok] **Share QR** — session detail → scan QR → quick mobile access.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // ЗАКАЗ-НАРЯДЫ
  // ────────────────────────────
  workOrders: {
    ru: {
      title: 'Заказ-наряды',
      intro: 'Реестр всех ЗН — основных документов работы СТО. Здесь можно создать, импортировать (CSV), отфильтровать и управлять жизненным циклом ЗН (start/pause/resume/complete/cancel). Версионирование защищает от параллельных правок (HTTP 409). Отключена в live-режиме (там ЗН управляются через 1С).',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верхняя строка** — поиск (по № ЗН, госномеру, типу работ) и DateRangePicker.',
            '[eye] **Под поиском** — кнопки-фильтры по статусу с счётчиками (например: «scheduled (12)»).',
            '[eye] **Кнопка «Импорт CSV»** — справа сверху.',
            '[eye] **Центр** — таблица ЗН со всеми колонками и сортировкой.',
            '[eye] **Низ** — пагинация.',
          ],
        },
        {
          heading: 'Статусы заказ-нарядов',
          items: [
            '**scheduled** (запланирован) — ЗН создан, ожидает начала работ. Серый бейдж.',
            '**in_progress** (в работе) — механик начал работу. Синий бейдж.',
            '**completed** (завершён) — работа выполнена. Зелёный бейдж.',
            '**cancelled** (отменён) — ЗН отменён. Красный бейдж.',
            '**no_show** (неявка) — клиент не приехал. Красный бейдж с полосой.',
            'Статус можно менять последовательно: scheduled → in_progress → completed.',
          ],
        },
        {
          heading: 'Поиск и фильтрация',
          items: [
            '**Поиск** — по номеру ЗН, госномеру или типу работ. Ищет по всем полям.',
            '**Кнопки статусов** — фильтр по статусу. На каждой кнопке отображается количество ЗН.',
            '**DateRangePicker** — фильтр по диапазону дат (scheduledTime).',
            'Фильтры комбинируются: можно искать "ТО" среди in_progress за последнюю неделю.',
          ],
        },
        {
          heading: 'Таблица заказ-нарядов',
          items: [
            '**Номер ЗН** (orderNumber) — уникальный номер заказ-наряда.',
            '**Время** (scheduledTime) — запланированное время начала работ.',
            '**Госномер** (plateNumber) — номер автомобиля.',
            '**Тип работ** (workType) — вид обслуживания (ТО, ремонт, диагностика и т.д.).',
            '**Нормочасы** (normHours) — нормативное время выполнения в часах.',
            '**Статус** — текущий статус с цветным бейджем.',
            'Сортировка по любой колонке.',
          ],
        },
        {
          heading: 'Действия с ЗН',
          items: [
            '**Start** — начать работу (scheduled → in_progress). Фиксирует startedAt.',
            '**Pause** — приостановить работу. Фиксирует время паузы.',
            '**Resume** — возобновить после паузы.',
            '**Complete** — завершить работу (in_progress → completed). Фиксирует completedAt.',
            '**Cancel** — отменить ЗН.',
            'Все действия записываются в **аудит-лог**.',
          ],
        },
        {
          heading: 'CSV-импорт',
          items: [
            'Кнопка **«Импорт CSV»** — загрузка ЗН из файла.',
            'Формат CSV: **номер, дата, госномер, тип работ, нормочасы**.',
            'Разделитель: запятая. Первая строка — заголовки (пропускается).',
            'При ошибке формата отображается строка с проблемой.',
            'Импортированные ЗН получают статус **scheduled**.',
          ],
        },
        {
          heading: 'Ограничения',
          items: [
            'Страница **отключена в live-режиме** — в живом режиме ЗН управляются через 1С.',
            'Нельзя удалить ЗН со статусом in_progress — сначала завершите или отмените.',
            'Версионирование: при конфликте (одновременное редактирование) — ошибка 409.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Массовый импорт расписания** — кнопка Импорт CSV → выбрали файл → проверили ошибки → ЗН созданы со статусом scheduled → перешли в Таймлайн постов для распределения.',
            '[ok] **Отмена неявки** — фильтр по scheduled → нашли клиента, который не приехал → клик → Cancel → статус no_show.',
            '[ok] **Поиск долгих ремонтов** — фильтр по in_progress + диапазон дат «вчера» → отсортировали по нормочасам → нашли затянувшиеся.',
            '[ok] **Закрытие смены** — фильтр completed + сегодня → проверили, что фактическое время заполнено для всех.',
          ],
        },
      ],
    },
    en: {
      title: 'Work Orders',
      intro: 'Registry of all WOs — the core STO work documents. Create, import (CSV), filter, and manage WO lifecycle (start/pause/resume/complete/cancel). Versioning protects against concurrent edits (HTTP 409). Disabled in live mode (WOs managed via 1C there).',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Top row** — search (by WO #, plate, work type) and DateRangePicker.',
            '[eye] **Under search** — status filter buttons with counts (e.g., "scheduled (12)").',
            '[eye] **"Import CSV"** button — top right.',
            '[eye] **Center** — WO table with all columns and sorting.',
            '[eye] **Bottom** — pagination.',
          ],
        },
        {
          heading: 'Work Order Statuses',
          items: [
            '**scheduled** — WO created, awaiting work start. Gray badge.',
            '**in_progress** — mechanic started work. Blue badge.',
            '**completed** — work finished. Green badge.',
            '**cancelled** — WO cancelled. Red badge.',
            '**no_show** — client did not arrive. Red striped badge.',
            'Status changes sequentially: scheduled → in_progress → completed.',
          ],
        },
        {
          heading: 'Search and Filtering',
          items: [
            '**Search** — by WO number, plate, or work type. Searches all fields.',
            '**Status buttons** — filter by status. Each button shows WO count.',
            '**DateRangePicker** — filter by date range (scheduledTime).',
            'Filters combine: search "Maintenance" among in_progress for last week.',
          ],
        },
        {
          heading: 'Work Orders Table',
          items: [
            '**WO Number** (orderNumber) — unique work order number.',
            '**Time** (scheduledTime) — planned work start time.',
            '**Plate** (plateNumber) — vehicle plate number.',
            '**Work Type** (workType) — service type (maintenance, repair, diagnostics, etc.).',
            '**Norm Hours** (normHours) — standard time in hours.',
            '**Status** — current status with colored badge.',
            'Sort by any column.',
          ],
        },
        {
          heading: 'WO Actions',
          items: [
            '**Start** — begin work (scheduled → in_progress). Records startedAt.',
            '**Pause** — pause work. Records pause time.',
            '**Resume** — resume after pause.',
            '**Complete** — finish work (in_progress → completed). Records completedAt.',
            '**Cancel** — cancel the WO.',
            'All actions recorded in **audit log**.',
          ],
        },
        {
          heading: 'CSV Import',
          items: [
            '**"Import CSV"** button — upload WOs from file.',
            'CSV format: **number, date, plate, work type, norm hours**.',
            'Delimiter: comma. First row is headers (skipped).',
            'Format errors show the problematic row.',
            'Imported WOs get **scheduled** status.',
          ],
        },
        {
          heading: 'Limitations',
          items: [
            'Page is **disabled in live mode** — WOs managed via 1C in live.',
            'Cannot delete in_progress WOs — complete or cancel first.',
            'Versioning: concurrent edit conflicts result in 409 error.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Bulk schedule import** — Import CSV button → choose file → check errors → WOs created with scheduled status → go to Posts Timeline to distribute.',
            '[ok] **Cancel a no-show** — filter by scheduled → find absent client → click → Cancel → status becomes no_show.',
            '[ok] **Find long repairs** — filter in_progress + date range "yesterday" → sort by norm hours → find dragging jobs.',
            '[ok] **Shift close-out** — filter completed + today → verify actual time is filled for every WO.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // ЖУРНАЛ СОБЫТИЙ
  // ────────────────────────────
  events: {
    ru: {
      title: 'Журнал событий',
      intro: 'Лента всех событий от системы компьютерного зрения (CV). 10 типов, 4 группы. Каждое событие — снимок состояния, зафиксированный одной или несколькими камерами с уровнем уверенности (confidence). Поддерживает фильтры, текстовый поиск и автообновление.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — фильтры в один ряд: Группа, Тип, Зона, Пост, Поиск.',
            '[eye] **Правый верхний угол** — переключатель автообновления и сортировки.',
            '[eye] **Центр** — таблица событий с цветными индикаторами и тегами камер.',
            '[eye] **Низ** — пагинация (25 / 50 / 100 на страницу).',
            '[eye] **Модальное окно** (клик по событию) — raw-данные и информация о камере.',
          ],
        },
        {
          heading: 'Типы событий (10 типов)',
          items: [
            '**vehicle_entered_zone** — автомобиль въехал в зону.',
            '**vehicle_left_zone** — автомобиль покинул зону.',
            '**post_occupied** — пост занят автомобилем.',
            '**post_vacated** — пост освободился.',
            '**worker_present** — работник появился на посту.',
            '**worker_absent** — работник покинул пост.',
            '**work_activity** — зафиксирована активная работа на посту.',
            '**work_idle** — простой — нет активности на посту.',
            '**vehicle_moving** — автомобиль перемещается по территории.',
            '**vehicle_waiting** — автомобиль стоит в зоне ожидания.',
          ],
        },
        {
          heading: 'Группы событий (4 группы)',
          items: [
            '**Авто (vehicle)** — въезд, выезд, перемещение, ожидание.',
            '**Пост (post)** — занятие и освобождение поста.',
            '**Работник (worker)** — появление и уход с поста.',
            '**Работа (work)** — активность и простой на посту.',
            'Фильтрация по группе скрывает все остальные типы.',
          ],
        },
        {
          heading: 'Фильтры',
          items: [
            '**Группа** — выпадающий список: все, авто, пост, работник, работа.',
            '**Тип** — конкретный тип события из 10 вариантов.',
            '**Зона** — события только из указанной зоны.',
            '**Пост** — события только с указанного поста.',
            '**Текстовый поиск** — поиск по описанию, госномеру, зоне.',
            'Все фильтры комбинируются для точного поиска.',
          ],
        },
        {
          heading: 'Уровень уверенности (Confidence)',
          items: [
            '**Высокий (>= 90%)** — зелёный индикатор. CV-система уверена в распознавании.',
            '**Средний (70-89%)** — жёлтый индикатор. Возможны неточности.',
            '**Низкий (< 70%)** — красный индикатор. Требуется ручная проверка.',
            'Confidence отображается процентом рядом с каждым событием.',
            'Влияет на автоматическое создание сессий — низкий confidence может быть проигнорирован.',
          ],
        },
        {
          heading: 'Камеры-источники',
          items: [
            'Каждое событие содержит поле **cameraSources** — список камер, которые зафиксировали событие.',
            'Формат: CAM 01, CAM 02 и т.д.',
            'Если событие подтверждено несколькими камерами — confidence выше.',
            'Клик на камеру открывает стрим в модальном окне.',
          ],
        },
        {
          heading: 'Автообновление и пагинация',
          items: [
            '**Автообновление** — переключатель в правом верхнем углу. Polling каждые 5 секунд.',
            'Сортировка: по времени (новые сверху/снизу).',
            'Пагинация: **25**, **50** или **100** записей на страницу.',
            'При включённом автообновлении новые события появляются вверху списка.',
            'Если включить автообновление и уйти со страницы — оно остановится при возврате его нужно включить заново.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Расследование инцидента** — выбрали зону + диапазон времени → нашли цепочку событий → проверили confidence → восстановили хронологию.',
            '[ok] **Калибровка камеры** — фильтр по конкретной зоне → много событий с confidence < 70% → проверьте угол и освещённость камеры.',
            '[ok] **Поиск конкретного авто** — поиск по госномеру → видите весь маршрут авто внутри СТО.',
            '[ok] **Контроль работника** — фильтр Тип = worker_absent + Пост = X → нашли периоды отсутствия работника.',
          ],
        },
      ],
    },
    en: {
      title: 'Event Log',
      intro: 'Feed of all computer vision (CV) events. 10 types, 4 groups. Each event = snapshot of state captured by one or more cameras with confidence. Supports filters, text search, and auto-refresh.',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Top** — filters in a row: Group, Type, Zone, Post, Search.',
            '[eye] **Top right corner** — auto-refresh and sort toggles.',
            '[eye] **Center** — event table with color indicators and camera tags.',
            '[eye] **Bottom** — pagination (25 / 50 / 100 per page).',
            '[eye] **Modal** (on event click) — raw data and camera info.',
          ],
        },
        {
          heading: 'Event Types (10 types)',
          items: [
            '**vehicle_entered_zone** — vehicle entered a zone.',
            '**vehicle_left_zone** — vehicle left a zone.',
            '**post_occupied** — post occupied by a vehicle.',
            '**post_vacated** — post vacated.',
            '**worker_present** — worker appeared at post.',
            '**worker_absent** — worker left the post.',
            '**work_activity** — active work detected on post.',
            '**work_idle** — idle — no activity on post.',
            '**vehicle_moving** — vehicle moving on premises.',
            '**vehicle_waiting** — vehicle waiting in waiting zone.',
          ],
        },
        {
          heading: 'Event Groups (4 groups)',
          items: [
            '**Vehicle** — entry, exit, movement, waiting.',
            '**Post** — post occupied and vacated.',
            '**Worker** — worker present and absent.',
            '**Work** — activity and idle on post.',
            'Group filter hides all other event types.',
          ],
        },
        {
          heading: 'Filters',
          items: [
            '**Group** — dropdown: all, vehicle, post, worker, work.',
            '**Type** — specific event type from 10 options.',
            '**Zone** — events from specified zone only.',
            '**Post** — events from specified post only.',
            '**Text search** — search by description, plate, zone.',
            'All filters combine for precise searching.',
          ],
        },
        {
          heading: 'Confidence Level',
          items: [
            '**High (>= 90%)** — green indicator. CV system is confident in recognition.',
            '**Medium (70-89%)** — yellow indicator. Possible inaccuracies.',
            '**Low (< 70%)** — red indicator. Manual verification needed.',
            'Confidence shown as percentage next to each event.',
            'Affects automatic session creation — low confidence may be ignored.',
          ],
        },
        {
          heading: 'Camera Sources',
          items: [
            'Each event has **cameraSources** field — list of cameras that detected the event.',
            'Format: CAM 01, CAM 02, etc.',
            'Events confirmed by multiple cameras have higher confidence.',
            'Click camera to open stream in modal.',
          ],
        },
        {
          heading: 'Auto-refresh and Pagination',
          items: [
            '**Auto-refresh** — toggle in top right. Polling every 5 seconds.',
            'Sort: by time (newest first / oldest first).',
            'Pagination: **25**, **50**, or **100** records per page.',
            'With auto-refresh on, new events appear at top of list.',
            'If you enable auto-refresh and leave the page — it stops; re-enable on return.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Incident investigation** — pick zone + time range → find event chain → check confidence → reconstruct timeline.',
            '[ok] **Camera calibration** — filter by a specific zone → many events with confidence < 70% → check camera angle and lighting.',
            '[ok] **Find a specific car** — plate search → see the entire vehicle path inside the STO.',
            '[ok] **Worker oversight** — filter Type = worker_absent + Post = X → find absence periods.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // АНАЛИТИКА
  // ────────────────────────────
  analytics: {
    ru: {
      title: 'Аналитика',
      intro: 'Комплексная аналитика СТО: 6 KPI-карточек, 8 типов графиков и таблица постов. Поддерживает сравнение с прошлым равным периодом (DeltaBadge) и экспорт всего в XLSX, PDF или отдельных графиков в PNG. Главный инструмент для отчётов руководству.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — переключатель периода (Сегодня / 7д / 30д) и переключатель режима сравнения.',
            '[eye] **Под переключателями** — 6 KPI-карточек с дельтами.',
            '[eye] **Дальше вниз** — 8 графиков (Recharts): pie, bar, line, scatter, heatmap.',
            '[eye] **Внизу страницы** — сводная таблица по 10 постам.',
            '[eye] **Кнопки экспорта** (правый верхний угол) — XLSX, PDF, PNG (контекстное меню по графику).',
          ],
        },
        {
          heading: 'Период и сравнение',
          items: [
            'Три периода: **Сегодня** (последние 24 часа), **7 дней**, **30 дней**.',
            '**Режим сравнения** — включает DeltaBadge, показывающий разницу с предыдущим аналогичным периодом.',
            'Дельта отображается стрелкой вверх (рост, зелёный) или вниз (падение, красный).',
            'Сравнение помогает отслеживать тренды: загрузка растёт или падает.',
          ],
        },
        {
          heading: 'Карточки-сводка',
          items: [
            '**Средняя загрузка** — процент времени, когда посты были заняты.',
            '**Средняя эффективность** — соотношение фактического времени к нормативному.',
            '**Всего автомобилей** — количество обслуженных авто за период.',
            '**Активные часы** — суммарное время активной работы всех постов.',
            '**Часы простоя** — суммарное время, когда посты простаивали.',
            '**Неявки** — количество клиентов, не приехавших на запись.',
          ],
        },
        {
          heading: 'Типы графиков',
          items: [
            '**Круговая диаграмма загрузки** — распределение: активная работа, занят без работы, свободен.',
            '**Рейтинг постов** — горизонтальные столбцы, ранжированные по загрузке. Показывает лучшие/худшие посты.',
            '**Дневной тренд** — линейный график загрузки по дням за период.',
            '**Автомобили по дням** — столбчатый график количества авто по дням.',
            '**Эффективность vs Загрузка** — точечный график для выявления аномалий.',
            '**План vs Факт** — сравнение нормочасов и фактического времени.',
            '**Почасовая нагрузка** — тепловая карта (heatmap): часы 8-19 по оси X, 10 постов по Y. Цвет = загрузка.',
            '**Недельная нагрузка** — тепловая карта по дням недели.',
          ],
        },
        {
          heading: 'Таблица по постам',
          items: [
            'Внизу страницы — таблица с метриками каждого поста.',
            'Колонки: пост, загрузка%, эффективность%, автомобили, ср. время, работник.',
            'Сортировка по любой колонке — клик по заголовку.',
            'Помогает выявить посты с низкой производительностью.',
          ],
        },
        {
          heading: 'Экспорт данных',
          items: [
            '**XLSX** — многостраничная книга Excel с данными по всем графикам и таблицам.',
            '**PDF** — полностраничный отчёт с графиками и таблицами.',
            '**PNG** — экспорт отдельного графика как изображения (правый клик → контекстное меню).',
            'Экспорт использует утилиты из **utils/export.js**: exportToXlsx(), exportToPdf(), downloadChartAsPng().',
          ],
        },
        {
          heading: 'Источники данных',
          items: [
            'Данные из **/api/analytics-history** и **/api/posts-analytics**.',
            'Агрегация: по постам, по дням, по часам.',
            'При отсутствии данных за период — графики показывают нулевые значения.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Месячный отчёт руководству** — 30 дней + Сравнение → проверили все KPI → Экспорт PDF → отправили директору.',
            '[ok] **Поиск часов перегрузки** — Heatmap «Почасовая нагрузка» → нашли часы 100% → решили о доп. постах или переносе ЗН.',
            '[ok] **Сравнение недель** — 7д с включённым Сравнением → дельта показала рост или падение.',
            '[ok] **График в презентацию** — правый клик на график → «Сохранить как PNG» → вставили в слайд.',
          ],
        },
      ],
    },
    en: {
      title: 'Analytics',
      intro: 'Comprehensive STO analytics: 6 KPI cards, 8 chart types, and per-post table. Supports comparison with previous equivalent period (DeltaBadge) and export to XLSX, PDF, or individual charts as PNG. Main tool for management reporting.',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Top** — period switcher (Today / 7d / 30d) and Compare mode toggle.',
            '[eye] **Under switches** — 6 KPI cards with deltas.',
            '[eye] **Further down** — 8 charts (Recharts): pie, bar, line, scatter, heatmap.',
            '[eye] **Bottom of page** — per-post summary table.',
            '[eye] **Export buttons** (top right) — XLSX, PDF, PNG (chart context menu).',
          ],
        },
        {
          heading: 'Period and Comparison',
          items: [
            'Three periods: **Today** (last 24 hours), **7 days**, **30 days**.',
            '**Compare mode** — enables DeltaBadge showing difference with previous equivalent period.',
            'Delta shown as up arrow (growth, green) or down arrow (decline, red).',
            'Comparison helps track trends: is occupancy growing or declining.',
          ],
        },
        {
          heading: 'Summary Cards',
          items: [
            '**Average Occupancy** — percent of time posts were occupied.',
            '**Average Efficiency** — ratio of actual time to norm time.',
            '**Total Vehicles** — vehicles serviced in the period.',
            '**Active Hours** — total active work time across all posts.',
            '**Idle Hours** — total time posts were idle.',
            '**No-shows** — clients who did not arrive for appointments.',
          ],
        },
        {
          heading: 'Chart Types',
          items: [
            '**Occupancy Pie** — distribution: active work, occupied no work, free.',
            '**Post Ranking** — horizontal bars ranked by occupancy. Shows best/worst posts.',
            '**Daily Trend** — line chart of occupancy by day.',
            '**Daily Vehicles** — bar chart of vehicle count by day.',
            '**Efficiency vs Occupancy** — scatter plot for anomaly detection.',
            '**Plan vs Fact** — norm hours vs actual time comparison.',
            '**Hourly Heatmap** — heatmap: hours 8-19 on X-axis, 10 posts on Y. Color = occupancy.',
            '**Weekly Heatmap** — heatmap by days of the week.',
          ],
        },
        {
          heading: 'Per-Post Table',
          items: [
            'Below charts — table with metrics for each post.',
            'Columns: post, occupancy%, efficiency%, vehicles, avg time, worker.',
            'Sort by any column — click header.',
            'Helps identify underperforming posts.',
          ],
        },
        {
          heading: 'Data Export',
          items: [
            '**XLSX** — multi-sheet Excel workbook with all chart and table data.',
            '**PDF** — full-page report with charts and tables.',
            '**PNG** — export individual chart as image (right-click → context menu).',
            'Export uses utilities from **utils/export.js**: exportToXlsx(), exportToPdf(), downloadChartAsPng().',
          ],
        },
        {
          heading: 'Data Sources',
          items: [
            'Data from **/api/analytics-history** and **/api/posts-analytics**.',
            'Aggregation: by post, by day, by hour.',
            'If no data for period — charts show zero values.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Monthly management report** — 30 days + Compare → review all KPIs → Export PDF → send to director.',
            '[ok] **Find overload hours** — Hourly Heatmap → spot 100% hours → decide about extra posts or rescheduling.',
            '[ok] **Week-over-week comparison** — 7d with Compare on → delta shows growth or decline.',
            '[ok] **Chart for presentation** — right-click chart → "Save as PNG" → paste into slide.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // КАМЕРЫ
  // ────────────────────────────
  cameras: {
    ru: {
      title: 'Камеры видеонаблюдения',
      intro: 'Управление и просмотр камер СТО. 16 камер (CAM 00–15), HLS-стриминг через :8181 (FFmpeg конвертирует RTSP → HLS). Группировка по зонам, статусы online/offline, превью кадров. Отключена в live-режиме (стримы отдаёт внешняя система).',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — вкладки: «Камеры по зонам» / «Все камеры».',
            '[eye] **Под вкладками** — фильтр по зонам (Все, Въезд/Выезд, Подъёмники, Парковка, Склад).',
            '[eye] **Центр** — сетка карточек камер (превью, статус, приоритет).',
            '[eye] **Модальное окно** (CameraStreamModal) — открывается по клику для просмотра HLS-потока.',
          ],
        },
        {
          heading: 'Режимы просмотра',
          items: [
            '**Камеры по зонам** — камеры сгруппированы по зонам покрытия: въезд/выезд, подъёмники, парковка, склад.',
            '**Все камеры** — плоская сетка всех 16 камер без группировки.',
            'Переключение вкладками в верхней части страницы.',
          ],
        },
        {
          heading: 'Карточка камеры',
          items: [
            'Название камеры (CAM 00 — CAM 15).',
            '**Статус** — зелёный кружок (online) или красный (offline). Обновляется через **useCameraStatus** hook.',
            '**Приоритет** — бейдж P3-P10 показывает приоритет камеры в зоне.',
            '**Зона покрытия** — какие зоны видит камера.',
            'Превью последнего кадра (если доступно).',
          ],
        },
        {
          heading: 'Фильтр по зонам',
          items: [
            '**Все** — показать все 16 камер.',
            '**Въезд/Выезд** — камеры на входных/выходных воротах.',
            '**Подъёмники** — камеры над рабочими постами.',
            '**Парковка** — камеры зоны парковки.',
            '**Склад** — камеры складской зоны.',
            'Фильтр работает мгновенно.',
          ],
        },
        {
          heading: 'Просмотр стрима (CameraStreamModal)',
          items: [
            'Клик по камере открывает **модальное окно** с HLS-видеопотоком.',
            'Используется **HLS.js** для воспроизведения потока.',
            'Стрим идёт через HLS-сервер на порту **8181** (RTSP → HLS конвертация через FFmpeg).',
            'URL формат: **/cam-api/stream/{cameraId}**.',
            'При offline-камере отображается заглушка.',
            'Закрытие модального окна останавливает стрим для экономии трафика.',
          ],
        },
        {
          heading: 'Статус камер',
          items: [
            'Проверка через **cameraHealthCheck** сервис каждые 30 секунд.',
            'Статус приходит по **Socket.IO** (событие camera:status).',
            'Hook **useCameraStatus** кэширует статусы и обновляет компоненты.',
            'Если камера offline > 5 минут — генерируется рекомендация.',
          ],
        },
        {
          heading: 'Ограничения',
          items: [
            'Страница **отключена в live-режиме** — стримы доступны только в демо.',
            'Качество стрима зависит от сетевого подключения.',
            'Максимум 4 одновременных стрима для снижения нагрузки на сервер.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Проверка камер утром** — открыли страницу → пробежались по сетке → красные кружки = надо срочно чинить.',
            '[ok] **Просмотр инцидента** — знаете зону → фильтр по зоне → клик на нужную камеру → стрим в модалке.',
            '[ok] **Проверка приоритетов** — переключились в «Все камеры» → проверили P-бейджи → если важная зона на P3 → перейти в «Маппинг камер по зонам» и поднять.',
          ],
        },
      ],
    },
    en: {
      title: 'Surveillance Cameras',
      intro: 'Manage and view STO cameras. 16 cameras (CAM 00–15), HLS streaming via :8181 (FFmpeg converts RTSP → HLS). Zone grouping, online/offline status, frame previews. Disabled in live mode (streams provided by external system).',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Top** — tabs: "Cameras by Zone" / "All Cameras".',
            '[eye] **Under tabs** — zone filter (All, Entry/Exit, Lifts, Parking, Warehouse).',
            '[eye] **Center** — grid of camera cards (preview, status, priority).',
            '[eye] **Modal** (CameraStreamModal) — opens on click to view HLS stream.',
          ],
        },
        {
          heading: 'View Modes',
          items: [
            '**Cameras by Zone** — cameras grouped by coverage zone: entry/exit, lifts, parking, warehouse.',
            '**All Cameras** — flat grid of all 16 cameras without grouping.',
            'Switch via tabs at top of page.',
          ],
        },
        {
          heading: 'Camera Card',
          items: [
            'Camera name (CAM 00 — CAM 15).',
            '**Status** — green dot (online) or red (offline). Updated via **useCameraStatus** hook.',
            '**Priority** — P3-P10 badge showing camera priority in zone.',
            '**Coverage zone** — which zones the camera covers.',
            'Latest frame preview (if available).',
          ],
        },
        {
          heading: 'Zone Filter',
          items: [
            '**All** — show all 16 cameras.',
            '**Entry/Exit** — cameras at entry/exit gates.',
            '**Lifts** — cameras above work posts.',
            '**Parking** — parking zone cameras.',
            '**Warehouse** — warehouse zone cameras.',
            'Filter applies instantly.',
          ],
        },
        {
          heading: 'Stream Viewer (CameraStreamModal)',
          items: [
            'Click a camera to open **modal** with HLS video stream.',
            'Uses **HLS.js** for stream playback.',
            'Stream via HLS server on port **8181** (RTSP → HLS via FFmpeg).',
            'URL format: **/cam-api/stream/{cameraId}**.',
            'Offline cameras show a placeholder.',
            'Closing modal stops the stream to save bandwidth.',
          ],
        },
        {
          heading: 'Camera Status',
          items: [
            'Checked via **cameraHealthCheck** service every 30 seconds.',
            'Status arrives via **Socket.IO** (camera:status event).',
            '**useCameraStatus** hook caches statuses and updates components.',
            'Camera offline > 5 minutes generates a recommendation.',
          ],
        },
        {
          heading: 'Limitations',
          items: [
            'Page is **disabled in live mode** — streams available in demo only.',
            'Stream quality depends on network connection.',
            'Maximum 4 simultaneous streams to reduce server load.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Morning camera check** — open page → scan the grid → red dots = needs immediate fix.',
            '[ok] **Incident review** — know the zone → filter by zone → click camera → stream in modal.',
            '[ok] **Priority audit** — switch to "All Cameras" → check P badges → if a critical zone shows P3 → go to "Camera Zone Mapping" and raise it.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // ДАННЫЕ 1С
  // ────────────────────────────
  data1c: {
    ru: {
      title: 'Данные 1С — Импорт и аналитика',
      intro: 'Интеграция с 1С через Excel/CSV. Автодетекция типа файла по заголовкам столбцов. Три вкладки: Статистика (KPI и графики), Планирование (16 колонок реестра), Работники (15 колонок). Автоматический watcher следит за папкой /data/1c-import/ и подхватывает новые файлы каждые 5 минут.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Сверху** — три вкладки: Статистика / Планирование / Работники.',
            '[eye] **Над контентом каждой вкладки** — область drag-and-drop для загрузки файла.',
            '[eye] **Центр** — содержимое вкладки (графики или таблицы с фильтрами).',
            '[eye] **Снизу страницы** — лог истории синхронизации (SyncLog).',
          ],
        },
        {
          heading: 'Загрузка файлов',
          items: [
            '**Drag-and-drop** — перетащите файл в область загрузки.',
            'Кнопка **«Выбрать файл»** — открытие диалога выбора.',
            'Поддерживаемые форматы: **XLSX**, **XLS**, **CSV**.',
            'Система **автоматически определяет** тип данных по заголовкам столбцов.',
            'При ошибке формата отображается подробное сообщение с указанием проблемы.',
            'После загрузки файл парсится и данные сохраняются в JSON (**/data/1c-*.json**).',
          ],
        },
        {
          heading: 'Вкладка «Статистика»',
          items: [
            '**KPI-бейджи** — ключевые метрики из 1С: выручка, количество ЗН, средний чек, загрузка.',
            '**Нагрузка по постам** — столбчатый график распределения работ.',
            '**Топ работников** — рейтинг по количеству выполненных ЗН.',
            '**Марки авто** — распределение по брендам автомобилей.',
            '**Типы ремонта** — распределение по видам работ (ТО, кузовной, двигатель и т.д.).',
            'Все графики обновляются при новом импорте.',
          ],
        },
        {
          heading: 'Вкладка «Планирование»',
          items: [
            'Таблица из **16 колонок** регистра планирования 1С.',
            'Колонки: документ, мастер, автор, автомобиль, длительность, начало, окончание, статус и др.',
            'Поиск по любому полю.',
            'Сортировка по любой колонке.',
            'Пагинация: **25**, **50** или **100** записей.',
          ],
        },
        {
          heading: 'Вкладка «Работники»',
          items: [
            'Таблица из **15 колонок** данных по работникам.',
            'Колонки: тип ремонта, VIN, марка, модель, работник, статус, нормочасы и др.',
            'Фильтрация и поиск.',
            'Сортировка по любой колонке.',
            'Пагинация: **25**, **50** или **100** записей.',
          ],
        },
        {
          heading: 'История синхронизации',
          items: [
            'Внизу страницы — лог всех операций импорта/синхронизации.',
            'Каждая запись: дата, тип операции, количество записей, статус (успех/ошибка).',
            'Помогает отслеживать регулярность обновления данных из 1С.',
            'Данные хранятся в таблице **SyncLog** в базе данных.',
          ],
        },
        {
          heading: 'Автоматический импорт',
          items: [
            'Сервис **sync1C.js** следит за папкой **/data/1c-import/**.',
            'При появлении нового файла — автоматический парсинг и импорт.',
            'Результат сохраняется в JSON-файлы: **1c-planning.json**, **1c-workers.json**, **1c-stats.json**.',
            'Поддержка формата: стандартные выгрузки из 1С:Предприятие.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Утренняя загрузка плана** — выгрузили из 1С → drag-and-drop в область → проверили вкладку Планирование → ЗН видны на странице Заказ-наряды.',
            '[ok] **Поиск работника по VIN** — Работники → поиск по VIN или госномеру → нашли все ЗН.',
            '[ok] **Сверка с системой** — Статистика → сравнили выручку 1С и количество ЗН в системе → расхождение видно в SyncLog.',
            '[ok] **Восстановление при сбое** — посмотрели SyncLog → нашли ошибки → перезагрузили проблемный файл.',
          ],
        },
      ],
    },
    en: {
      title: '1C Data — Import and Analytics',
      intro: 'Integration with 1C via Excel/CSV. File type auto-detected from column headers. Three tabs: Statistics (KPIs and charts), Planning (16-column register), Workers (15 columns). Automatic watcher watches /data/1c-import/ and picks up new files every 5 minutes.',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Top** — three tabs: Statistics / Planning / Workers.',
            '[eye] **Above each tab content** — drag-and-drop area for file upload.',
            '[eye] **Center** — tab content (charts or tables with filters).',
            '[eye] **Bottom of page** — sync history log (SyncLog).',
          ],
        },
        {
          heading: 'File Upload',
          items: [
            '**Drag-and-drop** — drop file into the upload area.',
            '**"Choose File"** button — opens file selection dialog.',
            'Supported formats: **XLSX**, **XLS**, **CSV**.',
            'System **auto-detects** data type by column headers.',
            'Format errors display detailed message with the issue.',
            'After upload, file is parsed and data saved to JSON (**/data/1c-*.json**).',
          ],
        },
        {
          heading: 'Statistics Tab',
          items: [
            '**KPI badges** — key metrics from 1C: revenue, WO count, average check, occupancy.',
            '**Load by Post** — bar chart of work distribution.',
            '**Top Workers** — ranking by completed WO count.',
            '**Car Brands** — distribution by vehicle brands.',
            '**Repair Types** — distribution by work type (maintenance, body, engine, etc.).',
            'All charts update on new import.',
          ],
        },
        {
          heading: 'Planning Tab',
          items: [
            'Table with **16 columns** from 1C planning register.',
            'Columns: document, master, author, vehicle, duration, start, end, status, etc.',
            'Search by any field.',
            'Sort by any column.',
            'Pagination: **25**, **50**, or **100** records.',
          ],
        },
        {
          heading: 'Workers Tab',
          items: [
            'Table with **15 columns** of worker data.',
            'Columns: repair type, VIN, brand, model, worker, status, norm hours, etc.',
            'Filtering and search.',
            'Sort by any column.',
            'Pagination: **25**, **50**, or **100** records.',
          ],
        },
        {
          heading: 'Sync History',
          items: [
            'At page bottom — log of all import/sync operations.',
            'Each entry: date, operation type, record count, status (success/error).',
            'Helps track regularity of 1C data updates.',
            'Data stored in **SyncLog** table in database.',
          ],
        },
        {
          heading: 'Automatic Import',
          items: [
            '**sync1C.js** service watches the **/data/1c-import/** folder.',
            'On new file — automatic parsing and import.',
            'Result saved to JSON files: **1c-planning.json**, **1c-workers.json**, **1c-stats.json**.',
            'Format support: standard 1C:Enterprise exports.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Morning plan upload** — export from 1C → drag-and-drop into the upload area → check Planning tab → WOs appear on Work Orders page.',
            '[ok] **Find worker by VIN** — Workers → search by VIN or plate → see all WOs.',
            '[ok] **System reconciliation** — Statistics → compare 1C revenue with system WO count → discrepancies visible in SyncLog.',
            '[ok] **Recovery from failure** — review SyncLog → find errors → re-upload the problematic file.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // ПОЛЬЗОВАТЕЛИ
  // ────────────────────────────
  users: {
    ru: {
      title: 'Управление пользователями',
      intro: 'Полное управление учётными записями: CRUD, роли (5 типов), доступ к страницам (21 страница), точечное скрытие элементов интерфейса. Все мутации записываются в Аудит-лог. Доступно только пользователям с ролью admin (защита от случайного блокирования системы).',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — поле поиска и кнопка «Добавить».',
            '[eye] **Центр** — таблица пользователей: имя, email, роль (бейдж), активность, кол-во страниц.',
            '[eye] **Модальное окно редактирования** — открывается по клику на строку: вкладки «Основное», «Страницы», «Элементы».',
            '[eye] **Нижняя строка модалки** — кнопки «Сохранить» / «Отмена» / «Удалить».',
          ],
        },
        {
          heading: 'Роли пользователей',
          items: [
            '**admin** (фиолетовый) — полный доступ ко всем функциям и страницам.',
            '**manager** (синий) — дашборд, ЗН, аналитика, посты, смены.',
            '**director** (серый) — только просмотр: дашборд, аналитика, отчёты.',
            '**mechanic** (зелёный) — доступ к своему посту (MyPost), ЗН.',
            '**viewer** (серый) — только дашборд, минимальные права.',
            'Роль определяет набор **permissions** (15 видов) через таблицы Role → RolePermission → Permission.',
          ],
        },
        {
          heading: 'Создание пользователя',
          items: [
            'Кнопка **«Добавить»** открывает форму создания.',
            'Обязательные поля: **email**, **имя**, **фамилия**, **роль**.',
            'Пароль по умолчанию: **demo123** (можно изменить).',
            '**isActive** — переключатель активности учётной записи.',
            'Неактивные пользователи не могут войти в систему.',
          ],
        },
        {
          heading: 'Доступ к страницам',
          items: [
            'Для каждого пользователя — набор **чекбоксов страниц** (до 20 штук).',
            'Страницы: dashboard, dashboardPosts, postsDetail, map, sessions, workOrders, events, analytics, cameras, data1c, users, shifts, audit, myPost, mapEditor, health, reportSchedule, workerStats, liveDebug, techDocs.',
            'Кнопка **«Выбрать все»** — включить все страницы.',
            'Кнопка **«Сбросить»** — снять все галочки.',
            'Пользователь видит в **Sidebar** только страницы из своего массива pages.',
          ],
        },
        {
          heading: 'Видимость элементов',
          items: [
            '**Дерево элементов** — для каждой страницы можно скрыть отдельные элементы интерфейса.',
            'Пример: на странице Dashboard можно скрыть виджет «Прогнозы» или «Рекомендации».',
            'Настройка тонкозернистая — контролирует каждый блок на странице.',
            'Скрытые элементы не рендерятся на клиенте (проверка через hasPermission).',
          ],
        },
        {
          heading: 'Редактирование и удаление',
          items: [
            'Клик по строке пользователя — открытие формы редактирования.',
            'Можно изменить: имя, фамилию, email, роль, пароль, активность, страницы.',
            '**Нельзя удалить администратора** — защита от блокировки системы.',
            'При редактировании **себя** — изменения применяются немедленно (перезагрузка не нужна).',
            'Все изменения записываются в **аудит-лог**.',
          ],
        },
        {
          heading: 'Таблица пользователей',
          items: [
            'Колонки: имя, email, роль (цветной бейдж), активность, количество страниц.',
            'Поиск по имени или email.',
            'Неактивные пользователи отображаются бледным цветом.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Создать менеджера** — Добавить → email, имя, роль = manager → выбрать страницы (Dashboard, Posts, WO, Shifts) → Сохранить.',
            '[ok] **Перевести в директора** — клик по строке → роль = director → автоматически сменился набор разрешений.',
            '[ok] **Скрыть пункт меню** — открыли пользователя → вкладка «Страницы» → сняли галку → пункт пропал из его сайдбара.',
            '[ok] **Деактивация на отпуск** — клик → toggle isActive = off → пользователь не сможет войти, но данные сохранены.',
          ],
        },
      ],
    },
    en: {
      title: 'User Management',
      intro: 'Full account management: CRUD, roles (5 types), page access (21 pages), fine-grained UI element hiding. All mutations are recorded in Audit Log. Available only to users with admin role (protects against accidental system lockout).',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Top** — search field and "Add" button.',
            '[eye] **Center** — users table: name, email, role (badge), active, page count.',
            '[eye] **Edit modal** — opens on row click: tabs "General", "Pages", "Elements".',
            '[eye] **Modal bottom row** — "Save" / "Cancel" / "Delete" buttons.',
          ],
        },
        {
          heading: 'User Roles',
          items: [
            '**admin** (purple) — full access to all features and pages.',
            '**manager** (blue) — dashboard, WOs, analytics, posts, shifts.',
            '**director** (gray) — view only: dashboard, analytics, reports.',
            '**mechanic** (green) — own post access (MyPost), WOs.',
            '**viewer** (gray) — dashboard only, minimal permissions.',
            'Role defines **permissions** (15 types) via Role → RolePermission → Permission tables.',
          ],
        },
        {
          heading: 'Create User',
          items: [
            '**"Add"** button opens creation form.',
            'Required fields: **email**, **first name**, **last name**, **role**.',
            'Default password: **demo123** (can be changed).',
            '**isActive** — account activity toggle.',
            'Inactive users cannot log in.',
          ],
        },
        {
          heading: 'Page Access',
          items: [
            'For each user — set of **page checkboxes** (up to 20).',
            'Pages: dashboard, dashboardPosts, postsDetail, map, sessions, workOrders, events, analytics, cameras, data1c, users, shifts, audit, myPost, mapEditor, health, reportSchedule, workerStats, liveDebug, techDocs.',
            '**"Select All"** button — enable all pages.',
            '**"Reset"** button — uncheck all.',
            'User sees only pages from their pages array in **Sidebar**.',
          ],
        },
        {
          heading: 'Element Visibility',
          items: [
            '**Element tree** — for each page, individual UI elements can be hidden.',
            'Example: on Dashboard page, hide "Predictions" or "Recommendations" widget.',
            'Fine-grained control — manages each block on the page.',
            'Hidden elements are not rendered on client (checked via hasPermission).',
          ],
        },
        {
          heading: 'Edit and Delete',
          items: [
            'Click user row — opens edit form.',
            'Can change: name, email, role, password, active status, pages.',
            '**Cannot delete admins** — prevents system lockout.',
            'Editing **yourself** — changes apply immediately (no reload needed).',
            'All changes recorded in **audit log**.',
          ],
        },
        {
          heading: 'Users Table',
          items: [
            'Columns: name, email, role (colored badge), active, page count.',
            'Search by name or email.',
            'Inactive users displayed with faded color.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Create a manager** — Add → email, name, role = manager → pick pages (Dashboard, Posts, WO, Shifts) → Save.',
            '[ok] **Promote to director** — click row → role = director → permission set updates automatically.',
            '[ok] **Hide a menu item** — open user → "Pages" tab → uncheck → item disappears from their sidebar.',
            '[ok] **Vacation deactivation** — click → toggle isActive = off → user cannot log in but data is preserved.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // СМЕНЫ
  // ────────────────────────────
  shifts: {
    ru: {
      title: 'Управление сменами',
      intro: 'Календарь рабочих смен. 7-дневный обзор с цветной индикацией статусов (planned/active/completed). Назначение работников трёх ролей (mechanic / master / diagnostician) на посты. Автоматическая проверка конфликтов: один работник не может быть в двух сменах одновременно. Завершение смены формирует акт приёма-передачи.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — заголовок текущей недели и стрелки навигации (← Предыдущая / Следующая →).',
            '[eye] **Центр** — 7 колонок (по дням недели), внутри каждой — карточки смен.',
            '[eye] **На каждой карточке** — название смены, время, цвет статуса, кнопки.',
            '[eye] **Кнопка «+»** — на каждой колонке для быстрого добавления смены в этот день.',
            '[eye] **Модальная форма** — открывается для создания/редактирования с разделом «Работники».',
          ],
        },
        {
          heading: 'Недельный календарь',
          items: [
            'Отображает **7 дней** с навигацией (стрелки влево/вправо).',
            'Каждый день — колонка с карточками смен.',
            'Навигация: кнопки **«Предыдущая неделя»** / **«Следующая неделя»**.',
            'Текущий день выделен акцентным цветом.',
          ],
        },
        {
          heading: 'Цвета карточек смен',
          items: [
            '[●blue]{blue:Синий} — запланированная смена (planned).',
            '[●green]{green:Зелёный} — активная смена (active) — идёт прямо сейчас.',
            '[●gray]{gray:Серый} — завершённая смена (completed).',
            'Цвет помогает быстро оценить состояние смен на неделю.',
          ],
        },
        {
          heading: 'Создание смены',
          items: [
            'Кнопка **«+»** или **«Добавить смену»** открывает форму.',
            'Поля: **название**, **дата**, **время начала**, **время окончания**.',
            'Раздел **«Работники»** — добавление сотрудников в смену.',
            'Для каждого работника: **имя**, **роль** (механик, мастер, диагност), **пост**.',
            'Можно добавить несколько работников в одну смену.',
          ],
        },
        {
          heading: 'Роли работников в смене',
          items: [
            '**Механик (mechanic)** — выполняет работы на посту.',
            '**Мастер (master)** — контролирует работу, принимает авто.',
            '**Диагност (diagnostician)** — проводит диагностику.',
            'Каждый работник привязывается к конкретному **посту (postId)**.',
          ],
        },
        {
          heading: 'Конфликты',
          items: [
            'Система **автоматически проверяет** конфликты при создании/редактировании.',
            'Конфликт: **один работник** назначен в **две смены** одновременно.',
            'Конфликтные смены подсвечиваются красной обводкой.',
            'Нельзя сохранить смену с неразрешённым конфликтом.',
          ],
        },
        {
          heading: 'Завершение смены',
          items: [
            'Кнопка **«Завершить»** — переводит смену в статус completed.',
            'Формируется **акт приёма-передачи** (handover act).',
            'Акт содержит: список работников, выполненные ЗН, статусы постов.',
            'Завершённую смену нельзя редактировать.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Планирование недели** — стрелка вперёд → нажали «+» на каждом дне → добавили смены и работников → сохранили.',
            '[ok] **Замена работника** — открыли смену → удалили заболевшего → добавили замену → проверили, что нет конфликта.',
            '[ok] **Закрытие смены вечером** — нашли активную (зелёную) → «Завершить» → акт сохранён.',
            '[ok] **Копирование расписания** — переключились на следующую неделю → пока надо вручную, копирования между неделями нет.',
          ],
        },
      ],
    },
    en: {
      title: 'Shift Management',
      intro: 'Work shift calendar. 7-day view with color-coded statuses (planned/active/completed). Assign workers of three roles (mechanic / master / diagnostician) to posts. Automatic conflict detection: one worker cannot be in two shifts simultaneously. Shift completion generates a handover act.',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Top** — current week heading and navigation arrows (← Previous / Next →).',
            '[eye] **Center** — 7 columns (days of week), each with shift cards.',
            '[eye] **Each card** — shift name, time, status color, buttons.',
            '[eye] **"+" button** — on each column for quick adding a shift to that day.',
            '[eye] **Modal form** — opens for create/edit with "Workers" section.',
          ],
        },
        {
          heading: 'Weekly Calendar',
          items: [
            'Shows **7 days** with navigation (left/right arrows).',
            'Each day — column with shift cards.',
            'Navigation: **"Previous Week"** / **"Next Week"** buttons.',
            'Current day highlighted with accent color.',
          ],
        },
        {
          heading: 'Shift Card Colors',
          items: [
            '[●blue]{blue:Blue} — planned shift.',
            '[●green]{green:Green} — active shift — happening right now.',
            '[●gray]{gray:Gray} — completed shift.',
            'Color helps quickly assess week shift status.',
          ],
        },
        {
          heading: 'Create Shift',
          items: [
            '**"+"** or **"Add Shift"** button opens form.',
            'Fields: **name**, **date**, **start time**, **end time**.',
            '**"Workers"** section — add employees to shift.',
            'For each worker: **name**, **role** (mechanic, master, diagnostician), **post**.',
            'Can add multiple workers to one shift.',
          ],
        },
        {
          heading: 'Worker Roles in Shift',
          items: [
            '**Mechanic** — performs work on post.',
            '**Master** — supervises work, receives vehicles.',
            '**Diagnostician** — performs diagnostics.',
            'Each worker is assigned to a specific **post (postId)**.',
          ],
        },
        {
          heading: 'Conflicts',
          items: [
            'System **automatically checks** conflicts on create/edit.',
            'Conflict: **one worker** assigned to **two shifts** simultaneously.',
            'Conflicting shifts highlighted with red outline.',
            'Cannot save shift with unresolved conflict.',
          ],
        },
        {
          heading: 'Complete Shift',
          items: [
            '**"Complete"** button — moves shift to completed status.',
            'Generates **handover act**.',
            'Act contains: worker list, completed WOs, post statuses.',
            'Completed shifts cannot be edited.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Week planning** — arrow forward → click "+" on each day → add shifts and workers → save.',
            '[ok] **Worker swap** — open shift → remove sick worker → add replacement → check there is no conflict.',
            '[ok] **Evening shift close** — find active (green) shift → "Complete" → act is saved.',
            '[ok] **Schedule copy** — switch to next week → manual entry only for now (no week-to-week copy).',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // АУДИТ
  // ────────────────────────────
  audit: {
    ru: {
      title: 'Аудит-лог',
      intro: 'Полный журнал всех мутаций (POST/PUT/PATCH/DELETE) в системе. Каждая запись хранит автора, IP, тип объекта, действие и diff между «до» и «после». Хранение бессрочное. Поддержка фильтров и CSV-экспорта для отчётов и расследований. Только для администраторов.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — фильтры: текстовый поиск, действие, сущность, диапазон дат + кнопка «Экспорт CSV».',
            '[eye] **Центр** — таблица записей с цветными бейджами действий.',
            '[eye] **Развёртываемая строка** (клик на запись) — показывает JSON-diff: «до» vs «после».',
            '[eye] **Низ** — пагинация (25 / 50 / 100 на страницу).',
          ],
        },
        {
          heading: 'Фильтры',
          items: [
            '**Текстовый поиск** — поиск по имени пользователя, действию, сущности, IP-адресу.',
            '**Действие (action)** — create, update, delete.',
            '**Сущность (entity)** — user, zone, post, workOrder, session, shift, camera, mapLayout.',
            '**Диапазон дат** — фильтр по времени действия.',
            'Фильтры комбинируются для точного поиска.',
            'Фильтры сохраняются при переключении страниц пагинации.',
          ],
        },
        {
          heading: 'Таблица записей',
          items: [
            '**Время** — точное время действия (формат: дата + ЧЧ:ММ:СС).',
            '**Пользователь** — кто выполнил действие (имя + фамилия).',
            '**Действие** — цветной бейдж: зелёный (create), синий (update), красный (delete).',
            '**Сущность** — тип объекта (user, zone, post и т.д.).',
            '**ID сущности** — идентификатор конкретного объекта.',
            '**IP-адрес** — откуда было выполнено действие.',
          ],
        },
        {
          heading: 'Детали изменения (развёртываемая строка)',
          items: [
            'Клик по строке — раскрывает **JSON-diff**: значения «до» и «после» изменения.',
            'Для create — показывает все созданные поля.',
            'Для update — показывает только **изменённые** поля с предыдущими значениями.',
            'Для delete — показывает данные удалённого объекта.',
            'Форматирование: JSON с подсветкой изменений.',
          ],
        },
        {
          heading: 'CSV-экспорт',
          items: [
            'Кнопка **«Экспорт CSV»** — скачивает отфильтрованные записи в CSV-файл.',
            'Экспорт учитывает текущие фильтры — скачивается только то, что на экране.',
            'Полезно для отчётов и расследований.',
            'Файл содержит все колонки таблицы.',
          ],
        },
        {
          heading: 'Пагинация',
          items: [
            'Размер страницы: **25**, **50** или **100** записей.',
            'Серверная пагинация — загружается только текущая страница.',
            'Общее количество записей отображается рядом с навигацией.',
          ],
        },
        {
          heading: 'Что записывается',
          items: [
            'Все **мутации** через API: POST, PUT, PATCH, DELETE запросы.',
            'Middleware **auditLog.js** автоматически перехватывает и записывает.',
            'Не записываются GET-запросы (чтение) и login/refresh.',
            'Хранение бессрочное — старые записи не удаляются.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Кто удалил пользователя?** — фильтр Действие = delete + Сущность = user → нашли запись → видно автора и IP.',
            '[ok] **Что менялось вчера?** — диапазон дат «вчера» → CSV-экспорт → передали в отчёт.',
            '[ok] **Расследование инцидента** — поиск по конкретному ID → нашли все правки и хронологию.',
            '[ok] **Контроль администраторов** — фильтр по имени admin-пользователя → проверка корректности действий.',
          ],
        },
      ],
    },
    en: {
      title: 'Audit Log',
      intro: 'Complete log of all mutations (POST/PUT/PATCH/DELETE) in the system. Each record stores actor, IP, entity type, action, and diff between "before" and "after". Indefinite storage. Filters and CSV export for reports and investigations. Admin only.',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Top** — filters: text search, action, entity, date range + "Export CSV" button.',
            '[eye] **Center** — records table with colored action badges.',
            '[eye] **Expandable row** (click on record) — shows JSON diff: "before" vs "after".',
            '[eye] **Bottom** — pagination (25 / 50 / 100 per page).',
          ],
        },
        {
          heading: 'Filters',
          items: [
            '**Text search** — search by username, action, entity, IP address.',
            '**Action** — create, update, delete.',
            '**Entity** — user, zone, post, workOrder, session, shift, camera, mapLayout.',
            '**Date range** — filter by action time.',
            'Filters combine for precise searching.',
            'Filters persist when switching pagination pages.',
          ],
        },
        {
          heading: 'Records Table',
          items: [
            '**Time** — exact action time (format: date + HH:MM:SS).',
            '**User** — who performed the action (first + last name).',
            '**Action** — colored badge: green (create), blue (update), red (delete).',
            '**Entity** — object type (user, zone, post, etc.).',
            '**Entity ID** — specific object identifier.',
            '**IP Address** — where the action was performed from.',
          ],
        },
        {
          heading: 'Change Details (expandable row)',
          items: [
            'Click row — expands **JSON diff**: "before" and "after" values.',
            'For create — shows all created fields.',
            'For update — shows only **changed** fields with previous values.',
            'For delete — shows deleted object data.',
            'Formatting: JSON with change highlighting.',
          ],
        },
        {
          heading: 'CSV Export',
          items: [
            '**"Export CSV"** button — downloads filtered records as CSV file.',
            'Export respects current filters — only downloads what is on screen.',
            'Useful for reports and investigations.',
            'File contains all table columns.',
          ],
        },
        {
          heading: 'Pagination',
          items: [
            'Page size: **25**, **50**, or **100** records.',
            'Server-side pagination — only current page is loaded.',
            'Total record count displayed next to navigation.',
          ],
        },
        {
          heading: 'What Gets Recorded',
          items: [
            'All **mutations** via API: POST, PUT, PATCH, DELETE requests.',
            '**auditLog.js** middleware automatically intercepts and records.',
            'GET requests (reads) and login/refresh are not recorded.',
            'Stored indefinitely — old records are not deleted.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Who deleted a user?** — filter Action = delete + Entity = user → find the record → see actor and IP.',
            '[ok] **What changed yesterday?** — date range "yesterday" → CSV export → attach to report.',
            '[ok] **Incident investigation** — search by specific ID → find all edits and timeline.',
            '[ok] **Admin oversight** — filter by an admin user name → verify their actions.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // МОЙ ПОСТ (Механик)
  // ────────────────────────────
  myPost: {
    ru: {
      title: 'Мой пост — Рабочий экран механика',
      intro: 'Простой и понятный экран для механика. Видно текущий ЗН, крупный таймер с прогресс-баром, обратный отсчёт до дедлайна и большие сенсорные кнопки управления (Start / Pause / Resume / Finish). Цвет таймера меняется по мере приближения и превышения нормы. Отключён в live-режиме (там механик использует внешние терминалы).',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — заголовок: «Пост N» и имя механика.',
            '[eye] **Центр** — карточка ЗН: номер, госномер крупно, марка/модель, тип работ, нормочасы.',
            '[eye] **Под карточкой** — большой таймер ЧЧ:ММ:СС и прогресс-бар.',
            '[eye] **Под таймером** — обратный отсчёт «Осталось / Просрочено».',
            '[eye] **Внизу** — крупные сенсорные кнопки управления (одна-две активны в зависимости от статуса).',
          ],
        },
        {
          heading: 'Информация о заказ-наряде',
          items: [
            '**Номер ЗН** — уникальный номер текущего заказ-наряда.',
            '**Госномер** — номер автомобиля крупным шрифтом.',
            '**Марка/Модель** — бренд и модель автомобиля.',
            '**Тип работ** — вид обслуживания (ТО, ремонт, диагностика).',
            '**Нормочасы** — сколько времени отведено на работу по нормативу.',
            'Если ЗН не назначен — отображается сообщение «Нет активного ЗН».',
          ],
        },
        {
          heading: 'Таймер работы',
          items: [
            'Крупный таймер в формате **ЧЧ:ММ:СС** — прошедшее время работы.',
            '**Прогресс-бар** — визуальное заполнение от 0% до 100%+ относительно нормочасов.',
            'Цвет прогресс-бара меняется по уровням предупреждения.',
            '**Без предупреждения** (0-79%) — зелёный/синий прогресс.',
            '**Warning** (80-94%) — жёлтый. Работа скоро должна быть завершена.',
            '**Critical** (95-99%) — оранжевый. Почти превышение нормы.',
            '**Overtime** (100%+) — красный. Работа идёт дольше нормы!',
          ],
        },
        {
          heading: 'Обратный отсчёт до дедлайна',
          items: [
            'Показывает сколько времени **осталось** до завершения по нормочасам.',
            'Формат: «Осталось: ХХ мин» или «Просрочено на: ХХ мин».',
            'При overtime — текст становится красным.',
            'Учитывает время пауз — дедлайн сдвигается.',
          ],
        },
        {
          heading: 'Кнопки управления',
          items: [
            '**Начать (Start)** — запустить работу по ЗН. Доступна для scheduled ЗН.',
            '**Пауза (Pause)** — приостановить работу. Таймер останавливается, время паузы записывается.',
            '**Продолжить (Resume)** — возобновить работу после паузы.',
            '**Завершить (Finish)** — закончить работу. ЗН переходит в completed.',
            'Кнопки **крупные** — оптимизированы для **сенсорного управления**.',
            'Одновременно доступна только одна кнопка (зависит от текущего статуса).',
          ],
        },
        {
          heading: 'Учёт пауз',
          items: [
            'Время пауз отслеживается отдельно (**totalPausedMs**).',
            'Пауза не влияет на общее прошедшее время, но учитывается в отчётах.',
            'Количество пауз записывается.',
            'Паузы видны в детализации ЗН.',
          ],
        },
        {
          heading: 'Ограничения',
          items: [
            'Страница **отключена в live-режиме**.',
            'Работает только если механику назначен пост через смену (Shifts).',
            'Один механик — один пост — один ЗН одновременно.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Начало рабочего дня** — открыли страницу → видим ЗН → нажали «Начать» → таймер пошёл.',
            '[ok] **Перерыв** — «Пауза» → таймер замер → после возврата «Продолжить».',
            '[ok] **Завершение работы** — кнопка «Завершить» → ЗН перешёл в completed → автоматически подгружается следующий ЗН (если есть).',
            '[ok] **Сложная работа** — таймер стал жёлтым (80%) → если не успеваете, оповестите мастера → продолжайте, при overtime цвет станет красным.',
          ],
        },
      ],
    },
    en: {
      title: 'My Post — Mechanic Screen',
      intro: 'Simple and clear screen for mechanics. Shows current WO, large timer with progress bar, deadline countdown, and big touch-friendly control buttons (Start / Pause / Resume / Finish). Timer color changes as deadline approaches and is exceeded. Disabled in live mode (mechanics use external terminals there).',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Top** — heading: "Post N" and mechanic name.',
            '[eye] **Center** — WO card: number, plate (large), brand/model, work type, norm hours.',
            '[eye] **Below card** — large HH:MM:SS timer and progress bar.',
            '[eye] **Below timer** — countdown "Remaining / Overdue".',
            '[eye] **Bottom** — large touch buttons (one or two active depending on status).',
          ],
        },
        {
          heading: 'Work Order Information',
          items: [
            '**WO Number** — unique current work order number.',
            '**Plate** — vehicle plate number in large font.',
            '**Brand/Model** — vehicle brand and model.',
            '**Work Type** — service type (maintenance, repair, diagnostics).',
            '**Norm Hours** — time allocated for work per standard.',
            'If no WO assigned — shows "No active WO" message.',
          ],
        },
        {
          heading: 'Work Timer',
          items: [
            'Large timer in **HH:MM:SS** format — elapsed work time.',
            '**Progress bar** — visual fill from 0% to 100%+ relative to norm hours.',
            'Progress bar color changes by warning level.',
            '**No warning** (0-79%) — green/blue progress.',
            '**Warning** (80-94%) — yellow. Work should be finished soon.',
            '**Critical** (95-99%) — orange. Almost exceeding norm.',
            '**Overtime** (100%+) — red. Work exceeds norm time!',
          ],
        },
        {
          heading: 'Deadline Countdown',
          items: [
            'Shows time **remaining** until norm hours deadline.',
            'Format: "Remaining: XX min" or "Overdue by: XX min".',
            'On overtime — text turns red.',
            'Accounts for pause time — deadline shifts accordingly.',
          ],
        },
        {
          heading: 'Control Buttons',
          items: [
            '**Start** — begin work on WO. Available for scheduled WOs.',
            '**Pause** — pause work. Timer stops, pause time recorded.',
            '**Resume** — continue work after pause.',
            '**Finish** — complete work. WO moves to completed.',
            'Buttons are **large** — optimized for **touch control**.',
            'Only one button available at a time (depends on current status).',
          ],
        },
        {
          heading: 'Pause Tracking',
          items: [
            'Pause time tracked separately (**totalPausedMs**).',
            'Pause does not affect total elapsed time, but is counted in reports.',
            'Number of pauses is recorded.',
            'Pauses visible in WO detail view.',
          ],
        },
        {
          heading: 'Limitations',
          items: [
            'Page is **disabled in live mode**.',
            'Only works if mechanic is assigned a post via Shifts.',
            'One mechanic — one post — one WO at a time.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Start of workday** — open page → see WO → click "Start" → timer starts.',
            '[ok] **Break** — "Pause" → timer freezes → on return "Resume".',
            '[ok] **Finishing work** — "Finish" button → WO moves to completed → next WO auto-loads (if any).',
            '[ok] **Tough job** — timer turns yellow (80%) → if you cannot make it, notify master → continue; on overtime color turns red.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // ЗДОРОВЬЕ СИСТЕМЫ
  // ────────────────────────────
  health: {
    ru: {
      title: 'Здоровье системы',
      intro: 'Технический мониторинг всех компонентов: Node.js-сервер, SQLite, синхронизация 1С, дисковое пространство, статус камер. Зелёный/жёлтый/красный индикатор для каждого блока. Автообновление каждые 30 секунд. Только для администраторов.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — крупный общий статус системы (зелёный/жёлтый/красный) и uptime.',
            '[eye] **6 секций-карточек**: Сервер, База данных, Синхронизация 1С, Диск, Камеры, Дополнительно.',
            'Каждая секция со своим цветным индикатором.',
            '[eye] **Автообновление** работает в фоне, индикатор обновления — в углу.',
          ],
        },
        {
          heading: 'Общий статус',
          items: [
            '[●green]{green:Зелёный} — все компоненты работают нормально.',
            '[●red]{red:Красный} — есть проблемы в одном или нескольких компонентах.',
            '[●yellow]{yellow:Жёлтый} — предупреждения (например, мало места на диске).',
            'Общий статус — наихудший из всех компонентов.',
          ],
        },
        {
          heading: 'Сервер',
          items: [
            '**Uptime** — время непрерывной работы сервера.',
            '**Node.js версия** — текущая версия Node.js runtime.',
            '**Heap Usage** — процент использования кучи JavaScript (heapUsed / heapTotal).',
            '**RSS** — физическая память процесса в мегабайтах.',
            'Если heap > 85% — потенциальная утечка памяти.',
          ],
        },
        {
          heading: 'База данных',
          items: [
            '**Ping** — время отклика базы данных в миллисекундах.',
            '**Размер** — размер файла SQLite на диске.',
            'Нормальный ping: < 10ms для SQLite.',
            'Если ping > 100ms — возможны проблемы с диском.',
          ],
        },
        {
          heading: 'Синхронизация 1С',
          items: [
            '**Статус** — active (работает) или inactive.',
            '**Последняя синхронизация** — дата и время последнего успешного импорта.',
            '**Количество записей** — сколько записей было импортировано.',
            'Если последняя синхронизация > 24 часов — предупреждение.',
          ],
        },
        {
          heading: 'Диск',
          items: [
            '**Использование (%)** — процент занятого дискового пространства.',
            '**Использовано / Всего / Свободно** — в гигабайтах.',
            'Предупреждение при использовании > 80%.',
            'Критично при > 95% — база данных может перестать записывать.',
          ],
        },
        {
          heading: 'Камеры',
          items: [
            'Сетка из **10 камер** со статусами.',
            '[●green]{green:Зелёный} — камера online, стрим доступен.',
            '[●red]{red:Красный} — камера offline.',
            'Проверка каждые **30 секунд** через cameraHealthCheck.',
            'При offline > 5 минут — рекомендация администратору.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Утренний чек-ап** — открыли страницу → пробежались по 6 блокам → все зелёные = можно работать.',
            '[ok] **Реакция на проблему** — Heap > 85% → перезапустить сервер; Disk > 80% — почистить логи и старые файлы.',
            '[ok] **1С отвалилась** — последняя синхронизация > 24ч → проверьте папку /data/1c-import/ и логи sync1C.',
            '[ok] **Камеры оффлайн** — посмотрели на этой странице сводку → перешли на «Камеры» для деталей.',
          ],
        },
      ],
    },
    en: {
      title: 'System Health',
      intro: 'Technical monitoring of all components: Node.js server, SQLite, 1C sync, disk space, camera status. Green/yellow/red indicator per block. Auto-refresh every 30 seconds. Admin only.',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Top** — large overall system status (green/yellow/red) and uptime.',
            '[eye] **6 section cards**: Server, Database, 1C Sync, Disk, Cameras, Extras.',
            'Each section has its own color indicator.',
            '[eye] **Auto-refresh** runs in background, refresh indicator in corner.',
          ],
        },
        {
          heading: 'Overall Status',
          items: [
            '[●green]{green:Green} — all components running normally.',
            '[●red]{red:Red} — issues in one or more components.',
            '[●yellow]{yellow:Yellow} — warnings (e.g., low disk space).',
            'Overall status = worst of all components.',
          ],
        },
        {
          heading: 'Server',
          items: [
            '**Uptime** — continuous server run time.',
            '**Node.js version** — current Node.js runtime version.',
            '**Heap Usage** — JavaScript heap percentage (heapUsed / heapTotal).',
            '**RSS** — process physical memory in megabytes.',
            'If heap > 85% — potential memory leak.',
          ],
        },
        {
          heading: 'Database',
          items: [
            '**Ping** — database response time in milliseconds.',
            '**Size** — SQLite file size on disk.',
            'Normal ping: < 10ms for SQLite.',
            'If ping > 100ms — possible disk issues.',
          ],
        },
        {
          heading: '1C Sync',
          items: [
            '**Status** — active (running) or inactive.',
            '**Last Sync** — date/time of last successful import.',
            '**Record Count** — how many records were imported.',
            'Warning if last sync > 24 hours ago.',
          ],
        },
        {
          heading: 'Disk',
          items: [
            '**Usage (%)** — percent of disk space used.',
            '**Used / Total / Free** — in gigabytes.',
            'Warning at > 80% usage.',
            'Critical at > 95% — database may stop writing.',
          ],
        },
        {
          heading: 'Cameras',
          items: [
            'Grid of **10 cameras** with statuses.',
            '[●green]{green:Green} — camera online, stream available.',
            '[●red]{red:Red} — camera offline.',
            'Checked every **30 seconds** via cameraHealthCheck.',
            'Offline > 5 minutes — recommendation to admin.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // РАСПИСАНИЕ ОТЧЁТОВ
  // ────────────────────────────
  reportSchedule: {
    ru: {
      title: 'Расписание автоотчётов',
      intro: 'Автоматическая генерация и отправка отчётов по расписанию. Отчёты формируются ежедневно/еженедельно, экспортируются в XLSX и доставляются в Telegram-чат — руководителю, в группу или в канал. Один раз настроили — каждое утро отчёт лежит у вас в чате.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Шапка** — кнопка **«Добавить расписание»** (сверху справа).',
            '[eye] **Список расписаний** — карточки с названием, частотой, временем, статусом (активно/выключено), Chat ID и временем последнего запуска.',
            '[eye] **На каждой карточке:** кнопки **«Запустить сейчас»**, **«Редактировать»**, **«Удалить»** и переключатель активности.',
            '[eye] **Форма создания/редактирования** — модальное окно с полями: название, частота, день недели (для weekly), час, минуты, Chat ID.',
          ],
        },
        {
          heading: 'Создание расписания',
          items: [
            'Кнопка **«Добавить»** открывает форму создания.',
            '**Название** — произвольное имя для расписания.',
            '**Частота** — **daily** (ежедневно) или **weekly** (еженедельно).',
            'Для weekly: выбор **дня недели** (понедельник-воскресенье).',
            '**Час** (0-23) и **минуты** (0, 15, 30, 45) — время генерации.',
            '**Формат** — XLSX (единственный поддерживаемый).',
          ],
        },
        {
          heading: 'Telegram-доставка',
          items: [
            '**Chat ID** — ID чата Telegram для отправки отчёта (опционально).',
            'Если Chat ID указан — отчёт автоматически отправляется в Telegram.',
            'Используется Telegram Bot API через **node-telegram-bot-api**.',
            'Бот должен быть добавлен в чат и иметь права на отправку файлов.',
          ],
        },
        {
          heading: 'Управление расписаниями',
          items: [
            '**isActive** — переключатель: включить/выключить расписание.',
            '**Редактирование** — клик по расписанию открывает форму.',
            '**Удаление** — кнопка удалить с подтверждением.',
            '**Последний запуск** — timestamp последней успешной генерации.',
          ],
        },
        {
          heading: 'Запуск вручную',
          items: [
            'Кнопка **«Запустить сейчас»** — немедленная генерация отчёта.',
            'Отчёт скачивается в браузер как XLSX-файл.',
            'Не влияет на расписание — следующий автозапуск по плану.',
          ],
        },
        {
          heading: 'Содержимое отчёта',
          items: [
            '**Заказ-наряды** — сгруппированы по статусу, работнику и марке авто.',
            '**Метрики** — загрузка, эффективность, количество авто за период.',
            '**Работники** — статистика по каждому механику.',
            'Формат: многостраничная книга XLSX с форматированием.',
          ],
        },
        {
          heading: 'Техническая реализация',
          items: [
            'Сервис **reportScheduler.js** использует **node-cron** для планирования.',
            'XLSX генерируется через **serverExport.js**.',
            'Расписания хранятся в таблице **ReportSchedule** в БД.',
            'Cron-выражения формируются автоматически из настроек.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Ежедневный отчёт директору:** Добавить → daily → 08:00 → Chat ID директора → Сохранить. Каждое утро отчёт за вчера приходит в Telegram.',
            '[ok] **Еженедельная сводка в группу:** weekly → понедельник → 09:00 → Chat ID группы → отчёт за неделю каждый понедельник.',
            '[ok] **Проверить настройки перед запуском по плану:** «Запустить сейчас» → проверить XLSX в браузере → если ок, оставить расписание включённым.',
            '[ok] **Временно отключить отчёты (отпуск, переезд):** переключатель **isActive** → off. Расписание сохранится, авто-запуск остановится.',
            '[ok] **Узнать ID чата для бота:** добавить бота в чат → отправить любое сообщение → посмотреть ID через @userinfobot или API getUpdates.',
          ],
        },
      ],
    },
    en: {
      title: 'Report Schedule',
      intro: 'Automatic report generation and delivery on schedule. Reports built daily/weekly, exported to XLSX, and delivered to a Telegram chat — to a manager, group, or channel. Set it up once — every morning the report is waiting in your chat.',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Header** — **"Add schedule"** button (top right).',
            '[eye] **Schedules list** — cards with name, frequency, time, status (active/disabled), Chat ID, and last-run timestamp.',
            '[eye] **On each card:** **"Run now"**, **"Edit"**, **"Delete"** buttons and active toggle.',
            '[eye] **Create/Edit form** — modal with fields: name, frequency, day of week (for weekly), hour, minutes, Chat ID.',
          ],
        },
        {
          heading: 'Create Schedule',
          items: [
            '**"Add"** button opens creation form.',
            '**Name** — custom name for the schedule.',
            '**Frequency** — **daily** or **weekly**.',
            'For weekly: select **day of week** (Monday-Sunday).',
            '**Hour** (0-23) and **minutes** (0, 15, 30, 45) — generation time.',
            '**Format** — XLSX (only supported format).',
          ],
        },
        {
          heading: 'Telegram Delivery',
          items: [
            '**Chat ID** — Telegram chat ID for report delivery (optional).',
            'If Chat ID set — report auto-sent to Telegram.',
            'Uses Telegram Bot API via **node-telegram-bot-api**.',
            'Bot must be added to chat with file sending permissions.',
          ],
        },
        {
          heading: 'Schedule Management',
          items: [
            '**isActive** — toggle: enable/disable schedule.',
            '**Edit** — click schedule to open edit form.',
            '**Delete** — delete button with confirmation.',
            '**Last Run** — timestamp of last successful generation.',
          ],
        },
        {
          heading: 'Manual Run',
          items: [
            '**"Run Now"** button — immediate report generation.',
            'Report downloads in browser as XLSX file.',
            'Does not affect schedule — next auto-run as planned.',
          ],
        },
        {
          heading: 'Report Content',
          items: [
            '**Work Orders** — grouped by status, worker, and car brand.',
            '**Metrics** — occupancy, efficiency, vehicle count for period.',
            '**Workers** — statistics per mechanic.',
            'Format: multi-sheet XLSX workbook with formatting.',
          ],
        },
        {
          heading: 'Technical Implementation',
          items: [
            '**reportScheduler.js** service uses **node-cron** for scheduling.',
            'XLSX generated via **serverExport.js**.',
            'Schedules stored in **ReportSchedule** table in DB.',
            'Cron expressions generated automatically from settings.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Daily report to director:** Add → daily → 08:00 → director\'s Chat ID → Save. Every morning yesterday\'s report arrives on Telegram.',
            '[ok] **Weekly summary to group:** weekly → Monday → 09:00 → group Chat ID → weekly report every Monday.',
            '[ok] **Verify settings before scheduled run:** "Run now" → check XLSX in browser → if ok, keep schedule enabled.',
            '[ok] **Temporarily disable reports (vacation, move):** **isActive** toggle → off. Schedule preserved, auto-run stops.',
            '[ok] **Find chat ID for the bot:** add bot to chat → send any message → check ID via @userinfobot or getUpdates API.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // СТАТИСТИКА РАБОТНИКА
  // ────────────────────────────
  workerStats: {
    ru: {
      title: 'Статистика работника',
      intro: 'Персональная аналитика по конкретному механику: сколько работал, что делал, насколько эффективен. Используется руководителем для оценки персонала, начисления премий, разбора нагрузки. Открывается из списка работников или дашборда — URL с параметром workerName.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Шапка** — имя работника, кнопка возврата, выбор периода (две даты).',
            '[eye] **KPI-полоса (4 карточки):** Всего ЗН | Нормочасы | Эффективность | Завершено.',
            '[eye] **Левый блок графиков:** Дневная выработка (столбцы план vs факт по дням).',
            '[eye] **Правый блок графиков:** Типы ремонта (pie) + Топ марок авто (bars).',
            '[eye] **Низ страницы:** таблица последних ЗН со статусами и временем.',
          ],
        },
        {
          heading: 'Выбор периода',
          items: [
            'Два поля: **дата начала** и **дата окончания** периода анализа.',
            'По умолчанию: **текущий месяц** (1-е число — сегодня).',
            'Все метрики пересчитываются при изменении периода.',
            'Данные запрашиваются из **/api/workers/:name/stats**.',
          ],
        },
        {
          heading: 'KPI-карточки (4 штуки)',
          items: [
            '**Всего ЗН** — общее количество заказ-нарядов за период.',
            '**Нормочасы** — суммарные нормочасы всех ЗН работника.',
            '**Средняя эффективность (%)** — соотношение фактического времени к нормативному.',
            '**Завершено** — количество ЗН со статусом completed.',
            'Каждая карточка с иконкой и подсветкой.',
          ],
        },
        {
          heading: 'Графики',
          items: [
            '**Дневная выработка** — столбчатый график: нормочасы (план) vs фактическое время за каждый день.',
            '**Типы ремонта** — круговая диаграмма распределения ЗН по видам работ.',
            '**Топ марок** — столбчатый график самых частых марок автомобилей.',
            'Графики используют библиотеку **Recharts**.',
          ],
        },
        {
          heading: 'Таблица последних ЗН',
          items: [
            'Список последних заказ-нарядов работника.',
            'Колонки: номер ЗН, госномер, тип работ, нормочасы, факт, статус.',
            'Цветные бейджи статусов: зелёный (completed), синий (in_progress), серый (scheduled).',
            'Сортировка по дате — новые сверху.',
          ],
        },
        {
          heading: 'Интеграция с 1С',
          items: [
            'Данные объединяются с данными из **1С** (1c-workers.json).',
            'Если работник есть в 1С — дополнительные метрики: выручка, средний чек.',
            'Совпадение по имени работника.',
          ],
        },
        {
          heading: 'Доступ',
          items: [
            'Доступна менеджерам, директорам и администраторам.',
            'Ссылка на страницу обычно из списка работников или дашборда.',
            'URL формат: **#/worker-stats?worker=ИмяФамилия**.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Оценить эффективность за месяц:** период = текущий месяц → смотреть карточку «Эффективность» → если ниже 70% — разбираться (мало ЗН? медленный ремонт?).',
            '[ok] **Найти специализацию:** круговая диаграмма «Типы ремонта» → понять, на чём механик быстрее всего работает.',
            '[ok] **Сверить выручку с 1С:** если интеграция 1С активна — карточка «Выручка» показывает реальную сумму по ЗН за период.',
            '[ok] **Разбор инцидента:** период = неделя инцидента → таблица последних ЗН → найти конкретные ЗН и их фактическое время.',
            '[ok] **Сравнить двух механиков:** открыть страницу для каждого в отдельной вкладке → визуально сравнить KPI и графики.',
          ],
        },
      ],
    },
    en: {
      title: 'Worker Statistics',
      intro: 'Personal analytics for a specific mechanic: how much they worked, what they did, how efficient they are. Used by managers to evaluate staff, calculate bonuses, analyze workload. Opened from worker list or dashboard — URL with workerName param.',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Header** — worker name, back button, period selector (two dates).',
            '[eye] **KPI strip (4 cards):** Total WOs | Norm Hours | Efficiency | Completed.',
            '[eye] **Left chart block:** Daily Output (bars: plan vs actual per day).',
            '[eye] **Right chart block:** Repair Types (pie) + Top Car Brands (bars).',
            '[eye] **Bottom of page:** recent WOs table with statuses and times.',
          ],
        },
        {
          heading: 'Period Selection',
          items: [
            'Two fields: **start date** and **end date** for analysis period.',
            'Default: **current month** (1st — today).',
            'All metrics recalculate on period change.',
            'Data from **/api/workers/:name/stats**.',
          ],
        },
        {
          heading: 'KPI Cards (4 cards)',
          items: [
            '**Total WOs** — total work orders in period.',
            '**Norm Hours** — total norm hours of all worker WOs.',
            '**Average Efficiency (%)** — actual vs norm time ratio.',
            '**Completed** — WOs with completed status.',
            'Each card with icon and highlighting.',
          ],
        },
        {
          heading: 'Charts',
          items: [
            '**Daily Output** — bar chart: norm hours (plan) vs actual time per day.',
            '**Repair Types** — pie chart of WO distribution by work type.',
            '**Top Brands** — bar chart of most frequent car brands.',
            'Charts use **Recharts** library.',
          ],
        },
        {
          heading: 'Recent WOs Table',
          items: [
            'List of worker recent work orders.',
            'Columns: WO number, plate, work type, norm hours, actual, status.',
            'Colored status badges: green (completed), blue (in_progress), gray (scheduled).',
            'Sorted by date — newest first.',
          ],
        },
        {
          heading: '1C Integration',
          items: [
            'Data merged with **1C** data (1c-workers.json).',
            'If worker exists in 1C — additional metrics: revenue, average check.',
            'Matched by worker name.',
          ],
        },
        {
          heading: 'Access',
          items: [
            'Available to managers, directors, and admins.',
            'Link usually from worker list or dashboard.',
            'URL format: **#/worker-stats?worker=FirstLastName**.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Evaluate monthly efficiency:** period = current month → look at "Efficiency" card → if below 70% — investigate (few WOs? slow repairs?).',
            '[ok] **Find specialization:** "Repair Types" pie chart → understand what the mechanic does fastest.',
            '[ok] **Reconcile revenue with 1C:** if 1C integration is active — "Revenue" card shows real WO revenue for the period.',
            '[ok] **Incident debrief:** period = incident week → recent WOs table → find specific WOs and their actual time.',
            '[ok] **Compare two mechanics:** open page for each in separate tab → visually compare KPIs and charts.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // LIVE DEBUG
  // ────────────────────────────
  liveDebug: {
    ru: {
      title: 'Live Debug — Отладка мониторинга',
      intro: 'Окно «под капот» live-режима для админов и интеграторов. Видны сырые данные от CV-системы без обработки — что именно прислало распознавание, в каком порядке и с какими задержками. Используется при настройке камер, калибровке зон, разборе расхождений между дашбордом и реальностью. Только в live-режиме (красный пункт в сайдбаре).',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Шапка** — индикатор подключения к CV-сервису (зелёный/красный) + ping в мс.',
            '[eye] **Левая колонка:** raw-состояния постов (JSON) + состояния зон (JSON).',
            '[eye] **Правая колонка:** список камер с их статусами и HLS-ссылками.',
            '[eye] **Низ страницы:** прокручивающийся лог событий с миллисекундными timestamp.',
          ],
        },
        {
          heading: 'Назначение',
          items: [
            'Страница для **диагностики** и **отладки** подключения к внешнему CV-сервису.',
            'Показывает **сырые данные** (raw data) без обработки и агрегации.',
            'Помогает понять, что именно видит система мониторинга в реальном времени.',
            'Используется при настройке и калибровке CV-системы.',
            'Видна в сайдбаре **только в live-режиме** — с красным акцентом.',
          ],
        },
        {
          heading: 'Данные мониторинга',
          items: [
            'Сырые данные от **monitoringProxy** — прокси к внешнему CV API.',
            '**Состояния постов** — текущий статус каждого поста от CV-системы (не из БД).',
            '**Состояния зон** — количество авто, список госномеров от CV.',
            'Данные обновляются в реальном времени через polling.',
            'Формат: JSON с подсветкой синтаксиса.',
          ],
        },
        {
          heading: 'Статусы камер',
          items: [
            'Список всех камер с их **текущим статусом** (online/offline).',
            '**Ссылки на стримы** — прямые URL HLS-потоков.',
            'Время последнего ответа от камеры.',
            'Помогает быстро определить нерабочие камеры.',
          ],
        },
        {
          heading: 'История событий',
          items: [
            '**Полная история** с точными **timestamps** (миллисекунды).',
            'Каждое событие: тип, зона, пост, камера, confidence, plate.',
            'Данные не агрегированы — каждый «тик» CV-системы.',
            'Лог прокручивается автоматически к новым записям.',
            'Полезно для отладки: видно порядок и задержки событий.',
          ],
        },
        {
          heading: 'Health Check внешнего сервиса',
          items: [
            'Проверка доступности **внешнего CV API**.',
            '**Время отклика** (ping) в миллисекундах.',
            '**Статус** — connected / disconnected / error.',
            'При ошибке подключения — красный индикатор с описанием ошибки.',
          ],
        },
        {
          heading: 'Доступ и ограничения',
          items: [
            'Доступна **только в live-режиме** — при переключении в демо-режим страница скрывается.',
            'Рекомендуется для **администраторов** и **разработчиков**.',
            'Данные на этой странице могут отличаться от дашборда — это нормально (разные уровни обработки).',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **На дашборде «не то» состояние поста:** сравнить статус в БД (Dashboard) с raw-данными CV здесь → если в CV статус правильный, проблема в eventProcessor; если в CV неверно — проблема в распознавании/камере.',
            '[ok] **Камера «не видит» машину:** найти камеру в списке → проверить, что online → открыть HLS-ссылку → визуально сверить ракурс/перекрытия.',
            '[ok] **Машина зашла в зону, но не привязалась к посту:** в логе событий найти timestamp въезда → проверить ZoneStay/PostStay в этот момент → если CV не прислало post:occupied — проблема CV.',
            '[ok] **Внешний CV отвалился:** красный индикатор в шапке → проверить ping → известить интегратора → temporarily переключиться в demo-режим, чтобы пользователи продолжали работать.',
            '[ok] **Калибровка границ зон:** сравнить координаты события (камера, confidence) с реальной разметкой → передать данные команде CV.',
          ],
        },
      ],
    },
    en: {
      title: 'Live Debug — Monitoring Debug',
      intro: 'An "under the hood" view of live mode for admins and integrators. Shows raw data from the CV system without processing — exactly what recognition sent, in what order, with what delays. Used when configuring cameras, calibrating zones, debugging discrepancies between dashboard and reality. Live mode only (red sidebar item).',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Header** — CV connection indicator (green/red) + ping in ms.',
            '[eye] **Left column:** raw post states (JSON) + zone states (JSON).',
            '[eye] **Right column:** camera list with statuses and HLS links.',
            '[eye] **Bottom of page:** scrolling event log with millisecond timestamps.',
          ],
        },
        {
          heading: 'Purpose',
          items: [
            'Page for **diagnosing** and **debugging** external CV service connection.',
            'Shows **raw data** without processing or aggregation.',
            'Helps understand what the monitoring system sees in real-time.',
            'Used during CV system setup and calibration.',
            'Visible in sidebar **only in live mode** — with red accent.',
          ],
        },
        {
          heading: 'Monitoring Data',
          items: [
            'Raw data from **monitoringProxy** — proxy to external CV API.',
            '**Post States** — current status of each post from CV system (not from DB).',
            '**Zone States** — vehicle count, plate list from CV.',
            'Data updates in real-time via polling.',
            'Format: JSON with syntax highlighting.',
          ],
        },
        {
          heading: 'Camera Statuses',
          items: [
            'List of all cameras with their **current status** (online/offline).',
            '**Stream links** — direct HLS stream URLs.',
            'Last response time from camera.',
            'Helps quickly identify non-working cameras.',
          ],
        },
        {
          heading: 'Event History',
          items: [
            '**Full history** with precise **timestamps** (milliseconds).',
            'Each event: type, zone, post, camera, confidence, plate.',
            'Data not aggregated — every CV system "tick".',
            'Log auto-scrolls to new entries.',
            'Useful for debugging: shows event order and delays.',
          ],
        },
        {
          heading: 'External Service Health Check',
          items: [
            'Availability check for **external CV API**.',
            '**Response time** (ping) in milliseconds.',
            '**Status** — connected / disconnected / error.',
            'On connection error — red indicator with error description.',
          ],
        },
        {
          heading: 'Access and Limitations',
          items: [
            'Available **only in live mode** — page hides when switching to demo mode.',
            'Recommended for **admins** and **developers**.',
            'Data on this page may differ from dashboard — this is normal (different processing levels).',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Dashboard shows "wrong" post state:** compare DB status (Dashboard) with raw CV data here → if CV is correct, the issue is in eventProcessor; if CV is wrong — issue is in recognition/camera.',
            '[ok] **Camera "does not see" a car:** find camera in list → check online → open HLS link → visually verify angle/occlusions.',
            '[ok] **Car entered zone but didn\'t bind to post:** find entry timestamp in event log → check ZoneStay/PostStay at that moment → if CV didn\'t send post:occupied — CV issue.',
            '[ok] **External CV down:** red indicator in header → check ping → notify integrator → temporarily switch to demo mode so users can keep working.',
            '[ok] **Calibrate zone boundaries:** compare event coordinates (camera, confidence) with real layout → pass data to CV team.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // ТЕХНИЧЕСКАЯ ДОКУМЕНТАЦИЯ
  // ────────────────────────────
  techDocs: {
    ru: {
      title: 'Техническая документация',
      intro: 'Полное техническое описание системы MetricsAiUp в одном месте: архитектура, API, БД, RBAC, фоновые сервисы, описание страниц. Используйте для онбординга разработчиков, передачи знаний интегратору, как референс при настройке. 23 раздела, поиск, экспорт PDF, печать, RU/EN.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Шапка** — переключатель языка RU/EN, кнопки **«PDF»** и **«Печать»**.',
            '[eye] **Левая панель (sticky)** — оглавление со всеми 23 разделами и поле поиска сверху.',
            '[eye] **Центральная область** — содержимое разделов, прокручиваемое последовательно.',
            '[eye] **Sticky-индикатор** — активный раздел подсвечивается в оглавлении при скролле.',
          ],
        },
        {
          heading: 'Навигация',
          items: [
            '**Оглавление** — боковая панель со списком всех 23 разделов.',
            '**Поиск** — текстовое поле для быстрого поиска по заголовкам разделов.',
            '**Scroll tracking** — текущий раздел подсвечивается в оглавлении при прокрутке.',
            'Клик по разделу в оглавлении — плавная прокрутка к нему.',
          ],
        },
        {
          heading: 'Разделы документации',
          items: [
            'Архитектура системы, стек технологий, база данных.',
            'API-документация по всем 22 модулям маршрутов.',
            'RBAC — система ролей и разрешений.',
            'Socket.IO — события реального времени.',
            'CV-интеграция — работа с компьютерным зрением.',
            'Подробное описание каждой страницы интерфейса.',
          ],
        },
        {
          heading: 'Экспорт',
          items: [
            '**PDF** — кнопка экспорта всей документации в PDF-файл.',
            '**Печать** — кнопка печати текущей страницы.',
            'PDF использует библиотеку **jsPDF**.',
            'Экспорт сохраняет форматирование и структуру разделов.',
          ],
        },
        {
          heading: 'Язык',
          items: [
            'Переключение **RU/EN** — вся документация на двух языках.',
            'Язык определяется из общих настроек системы (i18n).',
            'Каждый раздел полностью переведён.',
          ],
        },
        {
          heading: 'Содержимое',
          items: [
            'Технические спецификации для **разработчиков** и **администраторов**.',
            'Описания API endpoints с параметрами и примерами ответов.',
            'Схемы базы данных с типами полей и связями.',
            'Инструкции по настройке и деплою.',
            'Описание фоновых сервисов и их конфигурации.',
          ],
        },
        {
          heading: 'Доступ',
          items: [
            'Доступна пользователям, у которых страница **techDocs** в массиве pages.',
            'Рекомендуется для **администраторов** и **разработчиков**.',
            'Не содержит чувствительных данных (пароли, ключи).',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Онбординг нового разработчика:** дать ссылку на techDocs → пусть пройдёт по разделам сверху вниз → вопросы — потом.',
            '[ok] **Найти эндпоинт API:** поиск → ввести часть пути (`/work-orders`) → перейти к разделу с описанием.',
            '[ok] **Передать документацию интегратору:** **«PDF»** → отправить файл → у внешней команды офлайн-копия.',
            '[ok] **Сверить схему БД:** раздел «База данных» → найти модель → проверить поля и связи перед миграцией.',
            '[ok] **Понять, как работает страница:** раздел «Страницы интерфейса» → найти нужную → прочитать описание её состояний и потоков данных.',
          ],
        },
      ],
    },
    en: {
      title: 'Technical Documentation',
      intro: 'Complete technical description of MetricsAiUp in one place: architecture, API, DB, RBAC, background services, page descriptions. Use it for onboarding developers, knowledge transfer to integrators, as reference during setup. 23 sections, search, PDF export, print, RU/EN.',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Header** — RU/EN language toggle, **"PDF"** and **"Print"** buttons.',
            '[eye] **Left panel (sticky)** — table of contents with all 23 sections and search field on top.',
            '[eye] **Central area** — section contents, scrolled sequentially.',
            '[eye] **Sticky indicator** — active section highlighted in TOC while scrolling.',
          ],
        },
        {
          heading: 'Navigation',
          items: [
            '**Table of Contents** — sidebar with all 23 sections listed.',
            '**Search** — text field for quick search by section headings.',
            '**Scroll tracking** — current section is highlighted in TOC while scrolling.',
            'Click section in TOC — smooth scroll to it.',
          ],
        },
        {
          heading: 'Documentation Sections',
          items: [
            'System architecture, tech stack, database.',
            'API documentation for all 22 route modules.',
            'RBAC — roles and permissions system.',
            'Socket.IO — real-time events.',
            'CV integration — computer vision workflow.',
            'Detailed description of each UI page.',
          ],
        },
        {
          heading: 'Export',
          items: [
            '**PDF** — export entire documentation to PDF file.',
            '**Print** — print current page.',
            'PDF uses **jsPDF** library.',
            'Export preserves formatting and section structure.',
          ],
        },
        {
          heading: 'Language',
          items: [
            '**RU/EN** toggle — all documentation in both languages.',
            'Language determined from system settings (i18n).',
            'Every section fully translated.',
          ],
        },
        {
          heading: 'Content',
          items: [
            'Technical specifications for **developers** and **admins**.',
            'API endpoint descriptions with parameters and response examples.',
            'Database schemas with field types and relations.',
            'Setup and deployment instructions.',
            'Background service descriptions and configuration.',
          ],
        },
        {
          heading: 'Access',
          items: [
            'Available to users with **techDocs** in their pages array.',
            'Recommended for **admins** and **developers**.',
            'Does not contain sensitive data (passwords, keys).',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Onboard a new developer:** send the techDocs link → walk through sections top to bottom → questions later.',
            '[ok] **Find an API endpoint:** search → type part of the path (`/work-orders`) → jump to its description.',
            '[ok] **Hand off documentation to an integrator:** **"PDF"** → send the file → external team has offline copy.',
            '[ok] **Verify DB schema:** "Database" section → find model → check fields and relations before migration.',
            '[ok] **Understand how a page works:** "UI Pages" section → find the page → read its states and data flows.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // ИСТОРИЯ ПОСТА
  // ────────────────────────────
  postHistory: {
    ru: {
      title: 'История поста',
      intro: 'Подробная хронология одного поста: каждый въезд, выезд, работа, простой, человек на посту — с временем до секунды. Используется для разбора инцидентов, проверки заявленных часов работы, аудита и обучения новых работников. Период от «сегодня» до «всё время».',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Шапка** — название поста и быстрые пресеты периода (Сегодня/Вчера/3д/7д/30д/Всё/Произвольный).',
            '[eye] **KPI-полоса (5 карточек):** Всего | Свободен | Занят | В работе | Авто.',
            '[eye] **Панель фильтров:** статус (Все/Свободен/Занят/В работе) + поисковая строка по госномерам и описаниям.',
            '[eye] **Таблица событий** — Время, Статус (цветной), Госномер, Детали, Люди, Точность CV. Заголовки сортируемы.',
            '[eye] **Модалка с карты** — компактная версия таблицы с кнопкой «Полная страница».',
          ],
        },
        {
          heading: 'Выбор периода',
          items: [
            '**Сегодня / Вчера / 3 дня / 7 дней / 30 дней** — быстрый выбор временного диапазона.',
            '**Произвольный период** — введите даты «от» и «до» вручную.',
            '**Все** — показать всю доступную историю.',
            'Все карточки статистики и таблица пересчитываются при смене периода.',
          ],
        },
        {
          heading: 'Карточки статистики',
          items: [
            '**Всего** — общее количество событий за выбранный период.',
            '**Свободен** — сколько раз пост был зафиксирован как свободный.',
            '**Занят** — автомобиль на посту (с работой или без).',
            '**В работе** — активная работа подтверждена системой CV.',
            '**Авто** — количество уникальных госномеров за период.',
          ],
        },
        {
          heading: 'Фильтры и поиск',
          items: [
            'Фильтр по статусу: Все, Свободен, Занят, В работе.',
            'Текстовый поиск: ищет по госномеру, марке авто, описанию работ.',
            'Фильтры комбинируются с выбранным периодом.',
          ],
        },
        {
          heading: 'Таблица событий',
          items: [
            '**Время** — точное время фиксации события (дата, часы, минуты, секунды).',
            '**Статус** — цветной индикатор (единая палитра карты СТО): [●green]{green:зелёный} (свободен), [●orange]{orange:оранжевый} (занят), [●purple]{purple:фиолетовый} (активная работа), [●red]{red:красный} (занят без работы), [●gray]{gray:серый} (нет данных).',
            '**Госномер** — номер автомобиля (если есть), с подсветкой.',
            '**Детали** — описание работ или открытые детали (капот, двери и т.д.).',
            '**Люди** — количество людей, зафиксированных на посту.',
            '**Точность** — уверенность системы CV: HIGH (зелёный), MEDIUM (жёлтый), LOW (красный).',
          ],
        },
        {
          heading: 'Сортировка',
          items: [
            'Клик на заголовок колонки — сортировка по этому полю.',
            'Повторный клик — переключение ASC/DESC.',
            'Иконка стрелки показывает текущее направление сортировки.',
          ],
        },
        {
          heading: 'Модальное окно (на карте)',
          items: [
            'Открывается по кнопке истории в карточке поста на карте.',
            'Компактный вид: список событий с сортировкой и фильтрацией.',
            'Кнопка «Полная страница» — переход на отдельную страницу с полным функционалом.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Спор по фактическим часам:** период = день инцидента → фильтр «В работе» → найти все интервалы → сложить продолжительность.',
            '[ok] **Найти, когда машина уехала:** поиск по госномеру → отсортировать по времени → последняя запись со статусом «Занят» → дальше «Свободен» = время выезда.',
            '[ok] **Проверить простой:** статус-фильтр → если есть длинные «Занят» без «В работе» → возможно простой → разбираться с механиком.',
            '[ok] **Низкая точность CV (LOW):** колонка «Точность» → если много LOW — проблемы с камерой/освещением → передать интегратору.',
            '[ok] **Открыть из карты быстро:** клик на пост → кнопка «История» → модалка → если нужно глубже, нажать «Полная страница».',
          ],
        },
      ],
    },
    en: {
      title: 'Post History',
      intro: 'Detailed timeline for a single post: every entry, exit, work episode, idle moment, person present — accurate to the second. Used for incident debriefs, verifying claimed hours, audit, and training new staff. Period from "today" to "all time".',
      sections: [
        {
          heading: 'Screen Map',
          items: [
            '[eye] **Header** — post name and quick period presets (Today/Yesterday/3d/7d/30d/All/Custom).',
            '[eye] **KPI strip (5 cards):** Total | Free | Occupied | Active | Vehicles.',
            '[eye] **Filter bar:** status (All/Free/Occupied/Active) + text search by plate and details.',
            '[eye] **Events table** — Time, Status (color), Plate, Details, People, CV Confidence. Headers sortable.',
            '[eye] **Modal from map** — compact version of the table with "Full page" button.',
          ],
        },
        {
          heading: 'Period Selection',
          items: [
            '**Today / Yesterday / 3 days / 7 days / 30 days** — quick time range selection.',
            '**Custom period** — enter from/to dates manually.',
            '**All** — show all available history.',
            'All stat cards and table recalculate on period change.',
          ],
        },
        {
          heading: 'Statistics Cards',
          items: [
            '**Total** — total event count for selected period.',
            '**Free** — times the post was recorded as free.',
            '**Occupied** — vehicle on post (with or without work).',
            '**Active** — active work confirmed by CV system.',
            '**Vehicles** — unique plate numbers in the period.',
          ],
        },
        {
          heading: 'Filters and Search',
          items: [
            'Status filter: All, Free, Occupied, Active work.',
            'Text search: searches by plate, car brand, work description.',
            'Filters combine with the selected period.',
          ],
        },
        {
          heading: 'Events Table',
          items: [
            '**Time** — exact event timestamp (date, hours, minutes, seconds).',
            '**Status** — color indicator (single STO map palette): [●green]{green:green} (free), [●orange]{orange:orange} (occupied), [●purple]{purple:purple} (active work), [●red]{red:red} (occupied_no_work), [●gray]{gray:gray} (no_data).',
            '**Plate** — vehicle plate number (if available), highlighted.',
            '**Details** — work description or open parts (hood, doors, etc.).',
            '**People** — number of people detected on post.',
            '**Confidence** — CV system confidence: HIGH (green), MEDIUM (yellow), LOW (red).',
          ],
        },
        {
          heading: 'Sorting',
          items: [
            'Click column header — sort by that field.',
            'Click again — toggle ASC/DESC.',
            'Arrow icon shows current sort direction.',
          ],
        },
        {
          heading: 'Modal View (on map)',
          items: [
            'Opens from the history button on post card on the map.',
            'Compact view: event list with sorting and filtering.',
            '"Full page" button — navigate to dedicated page with full features.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Dispute over actual hours:** period = incident day → filter "Active" → find all intervals → sum the duration.',
            '[ok] **Find when a car left:** search by plate → sort by time → last "Occupied" row → next "Free" = exit time.',
            '[ok] **Investigate idle:** status filter → if there are long "Occupied" without "Active" → possibly idle → discuss with mechanic.',
            '[ok] **Low CV confidence (LOW):** "Confidence" column → many LOW rows → camera/lighting issue → notify integrator.',
            '[ok] **Quick open from the map:** click post → "History" button → modal → if you need more, press "Full page".',
          ],
        },
      ],
    },
  },
};

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════

export default function HelpButton({ pageKey }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const isRu = i18n.language === 'ru';
  const content = HELP_CONTENT[pageKey];
  if (!content) return null;
  const data = content[isRu ? 'ru' : 'en'];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1 rounded-lg transition-all hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
        title={isRu ? 'Справка' : 'Help'}
      >
        <HelpCircle size={16} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}>
          <div className="p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-glass)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} style={{ color: 'var(--accent)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{data.title}</h3>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:opacity-60">
                <X size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Intro */}
            {data.intro && (
              <p className="text-xs leading-relaxed mb-4 px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-glass)', color: 'var(--text-secondary)' }}>
                {data.intro}
              </p>
            )}

            {/* Sections */}
            <div className="space-y-3">
              {data.sections.map((s, i) => (
                <HelpSection key={i} section={s} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HelpSection({ section }) {
  const [expanded, setExpanded] = useState(true);
  const items = section.items || [];
  // Legacy support: if section has 'text' instead of 'items'
  if (section.text && items.length === 0) {
    return (
      <div>
        <h4 className="text-xs font-semibold mb-1" style={{ color: 'var(--accent)' }}>{section.heading}</h4>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{section.text}</p>
      </div>
    );
  }

  return (
    <div>
      <button className="flex items-center gap-1.5 w-full text-left" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={12} style={{ color: 'var(--accent)' }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
        <h4 className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{section.heading}</h4>
      </button>
      {expanded && (
        <ul className="mt-1 ml-5 space-y-0.5">
          {items.map((item, j) => (
            <li key={j} className="text-xs leading-relaxed flex gap-1.5"
              style={{ color: 'var(--text-secondary)' }}>
              <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--text-muted)' }} />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// INLINE RENDERER — supports **bold**, [icon], [●color], {color:text}
// ═══════════════════════════════════════════════

const ICON_TOKENS = {
  ok: { Cmp: CheckCircle2, color: '#10b981' },
  check: { Cmp: CheckCircle2, color: '#10b981' },
  warn: { Cmp: AlertTriangle, color: '#f59e0b' },
  err: { Cmp: XCircle, color: '#ef4444' },
  no: { Cmp: XCircle, color: '#ef4444' },
  info: { Cmp: Info, color: '#3b82f6' },
  tip: { Cmp: Lightbulb, color: '#facc15' },
  arrow: { Cmp: ArrowRight, color: 'currentColor' },
  bolt: { Cmp: Zap, color: '#a855f7' },
  eye: { Cmp: Eye, color: '#3b82f6' },
  click: { Cmp: MousePointer2, color: '#3b82f6' },
};

// Палитра соответствует карте СТО (см. constants/index.js):
// purple = active_work (#6366f1), orange = occupied (#f59e0b), gray = no_data (#64748b)
const SWATCH_COLORS = {
  green: '#10b981',
  yellow: '#facc15',
  red: '#ef4444',
  blue: '#3b82f6',
  gray: '#64748b',
  purple: '#6366f1',
  orange: '#f59e0b',
};

const INLINE_RE = /\*\*([^*]+)\*\*|\[(ok|check|warn|err|no|info|tip|arrow|bolt|eye|click)\]|\[●(green|yellow|red|blue|gray|purple|orange)\]|\{(green|yellow|red|blue|gray|purple|orange):([^}]+)\}/g;

function renderInline(text) {
  if (!text) return null;
  const nodes = [];
  let lastIdx = 0;
  let key = 0;
  let m;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > lastIdx) nodes.push(text.slice(lastIdx, m.index));
    if (m[1]) {
      nodes.push(<strong key={key++} style={{ color: 'var(--text-primary)' }}>{m[1]}</strong>);
    } else if (m[2]) {
      const cfg = ICON_TOKENS[m[2]];
      const Ic = cfg.Cmp;
      nodes.push(
        <Ic key={key++} size={12} style={{
          color: cfg.color, display: 'inline-block',
          verticalAlign: '-2px', marginRight: 2, marginLeft: 1,
        }} />
      );
    } else if (m[3]) {
      nodes.push(
        <span key={key++} style={{
          display: 'inline-block', width: 8, height: 8,
          borderRadius: '50%', background: SWATCH_COLORS[m[3]],
          marginRight: 4, verticalAlign: 'middle',
          boxShadow: `0 0 0 1px ${SWATCH_COLORS[m[3]]}40`,
        }} />
      );
    } else if (m[4] && m[5]) {
      nodes.push(
        <span key={key++} style={{ color: SWATCH_COLORS[m[4]], fontWeight: 600 }}>{m[5]}</span>
      );
    }
    lastIdx = INLINE_RE.lastIndex;
  }
  if (lastIdx < text.length) nodes.push(text.slice(lastIdx));
  return nodes;
}
