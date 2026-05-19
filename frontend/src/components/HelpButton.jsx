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
      intro: 'Стартовая страница системы. За 5 секунд даёт ответ на главный вопрос: «Всё ли в порядке на СТО прямо сейчас?». Сочетает KPI-карточки, живой обзор постов, ML-прогнозы и список рекомендаций. Обновляется каждые 5 секунд в демо-режиме и в реальном времени в рабочем режиме.',
      sections: [
        {
          heading: 'Карта экрана (что и где)',
          items: [
            '**Верх** — 4 KPI-карточки в одну строку: активные сессии, свободные посты, занятые посты, рекомендации.',
            '**Под KPI слева** — живой обзор постов: компактная сетка всех 10 постов.',
            '**Под KPI справа** — виджет ML-прогнозов (загрузка, длительность, освобождение).',
            '**Средняя зона** — список активных рекомендаций (сворачивается, если их нет).',
            '**Нижняя зона** — лента последних 10 событий с фильтром по категориям.',
            '**Правый верхний угол** — переключатель периода метрик (24ч / 7д / 30д) и индикатор соединения.',
          ],
        },
        {
          heading: 'KPI-карточки — как читать',
          items: [
            '**Активные сессии** — авто, находящиеся на территории СТО прямо сейчас (открытые записи о визитах без времени выезда). Цвет зависит от загрузки.',
            '**Свободные посты** — посты в статусе «Свободен». [●green]{green:зелёный} — есть свободные, [●red]{red:красный} — все 10 заняты, нужен резерв.',
            '**Занятые посты** — посты в статусах «Занят без работ» и «Активная работа». Высокое число = высокая загрузка.',
            '**Рекомендации** — количество необработанных уведомлений. [●orange]{orange:оранжевый} значок — требует внимания.',
            '[click] Любая карточка **кликабельна** — открывает соответствующую страницу детализации.',
            '**Дельта-значок** (треугольник вверх/вниз с %) показывает рост или падение по сравнению с предыдущим равным периодом. [●green]{green:Зелёный} — улучшение, [●red]{red:красный} — ухудшение.',
            'Цифра 0 без дельты — данных за прошлый период нет (например, начало учёта).',
          ],
        },
        {
          heading: 'Живой обзор постов',
          items: [
            'Сетка из **10 постов** с цветовым статусом и ключевой информацией:',
            '[●green]{green:Зелёный} — свободен.',
            '[●purple]{purple:Фиолетовый} — активная работа (идёт обслуживание, есть работник).',
            '[●red]{red:Красный} — занят без работ (авто стоит, но никто не работает — возможен простой).',
            '[●orange]{orange:Оранжевый} — занят (предупреждение или переходное состояние).',
            '[●gray]{gray:Серый} — нет данных (CV не отчитывается по этому посту).',
            'Для занятых постов на карточке: **госномер** в виде плашки и **время на посту** (ЧЧ:ММ).',
            'Подходит для второго монитора — видно весь СТО без переключения экранов.',
            'Клик по посту — переход на детальный экран поста («История поста» или «Посты»).',
          ],
        },
        {
          heading: 'ML-прогнозы',
          items: [
            '**Прогноз загрузки** на ближайшие 4 часа — линейный график с почасовой динамикой.',
            '**Прогноз освобождения постов** — таблица «Пост → когда освободится».',
            '**Прогноз длительности** — оценка времени по типу работ (ТО / ремонт / диагностика).',
            'В **демо-режиме** значения генерируются псевдослучайно — для презентации.',
            'В **рабочем режиме** модель анализирует исторические паттерны (день недели, час, тип работ).',
            'Помогает мастеру-приёмщику принять заказ: «можно ли вписать машину в 14:30?»',
          ],
        },
        {
          heading: 'Рекомендации — 5 типов',
          items: [
            '[●red]**Неявка** — клиент не приехал на запланированный ЗН. Триггер: время начала прошло, статус не изменился.',
            '[●green]**Пост свободен** — пост простаивает более 30 минут, есть нераспределённые ЗН. Можно загрузить.',
            '[●blue]**Есть мощности** — более половины постов свободны. Можно принимать дополнительных клиентов.',
            '[●yellow]**Превышение времени** — фактическое время превышает 120% нормочасов. Возможна сложная работа или потерянное время.',
            '[●yellow]**Простой авто** — авто на посту больше 15 минут без работника. Подскажите механику.',
            'Кнопка **«Принять»** — подтверждает обработку, рекомендация исчезает (фиксируется время принятия в БД).',
            'Если рекомендаций нет — секция не показывается (пустой экран = всё хорошо).',
          ],
        },
        {
          heading: 'Лента последних событий',
          items: [
            'Лента **10 последних** событий от системы компьютерного зрения (CV).',
            'Фильтр по категориям сверху: **Все** / **Авто** (въезд/выезд) / **Пост** (занят/свободен) / **Работник** (есть/нет) / **Работа** (активность/простой).',
            'Карточка события: **тип** + **зона/пост** + **источники-камеры** (CAM 01, CAM 02…) + **время** (ЧЧ:ММ:СС).',
            'Цвет индикатора уверенности: [●green]{green:зелёный} ≥ 90%, [●yellow]{yellow:жёлтый} 70–89%, [●red]{red:красный} < 70%.',
            'Низкая уверенность — возможна ложная сработка, требуется ручная проверка.',
            'Клик по событию — открывает модальное окно с данными о камере и исходным сообщением.',
          ],
        },
        {
          heading: 'Период метрик и сравнение',
          items: [
            'Переключатель **24 часа / 7 дней / 30 дней** в правом верхнем углу — определяет окно расчёта KPI.',
            'Дельта-значки всегда сравнивают текущий период с предыдущим равным (24ч ↔ предыдущие 24ч, и т.д.).',
            'Период **сохраняется** в URL (?period=24h|7d|30d) — можно делиться ссылкой.',
            'Смена периода **не перезагружает** страницу — данные подтягиваются inline.',
          ],
        },
        {
          heading: 'Обновление данных и соединение',
          items: [
            'В **демо-режиме** — опрос каждые **5 секунд**.',
            'В **рабочем режиме** — обновление мгновенное при любом изменении.',
            'При потере соединения — **жёлтый индикатор** в шапке + замораживание данных (отображается «остаточное» состояние).',
            'При восстановлении соединения — автоматическая досинхронизация, индикатор зелёный.',
          ],
        },
        {
          heading: 'Устаревшие данные (stale)',
          items: [
            '[●red]{red:Красный} баннер появляется, если последнее обновление от внешнего CV старше **1 часа**. KPI и графики продолжают отображаться, но снабжены пометкой «данные устарели Xч Yмин назад».',
            '[warn] Появление баннера — **сигнал инженеру**: проверить статус прокси-мониторинга на странице «Live-отладка».',
            '[●orange]{orange:Оранжевый} **разрыв ≥ 5 минут** в таймлайне поста закрывает текущий «визит» — пустые часы не дорисовываются как продолжение последнего состояния.',
            '[●green]{green:Зелёный} — свежие данные (< 5 минут с последнего обновления) — досинхронизация активна, текущий визит виден до момента «сейчас».',
            'Подробнее — раздел 24 «Мониторинг и Live-режим» в технической документации.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Утренний осмотр** — открыли страницу → проверили рекомендации (если есть — обработать) → перешли в Таймлайн постов для планирования смены.',
            '[ok] **Контроль в течение дня** — оставили на втором мониторе живой обзор постов → видите, какой пост зависает в статусе «Занят без работ» — отправили мастера.',
            '[ok] **Анализ всплеска** — заметили, что занято 9/10 постов → переключили период на 7 дней и сравнили с прошлой неделей через дельту.',
            '[ok] **Реакция на неявку** — появилась рекомендация о неявке → кликнули на «Принять» → переоформили слот в таймлайне постов.',
          ],
        },
      ],
    },
    en: {
      title: 'Dashboard — Main Screen',
      intro: 'The system\'s landing page. Answers the main question in 5 seconds: "Is everything OK at the STO right now?" Combines KPI cards, a live post overview, ML predictions, and recommendations. Auto-refreshes every 5 seconds in demo mode and in real time via Socket.IO in live mode.',
      sections: [
        {
          heading: 'Screen Map (where things are)',
          items: [
            '**Top** — 4 KPI cards in a row: active sessions, free posts, occupied posts, recommendations.',
            '**Left under KPIs** — LiveSTOWidget with a compact grid of all 10 posts.',
            '**Right under KPIs** — PredictionWidget with ML predictions (load, duration, availability).',
            '**Middle area** — list of active recommendations (collapses when empty).',
            '**Bottom area** — feed of the last 10 events with a category filter.',
            '**Top-right corner** — metrics period switcher (24h / 7d / 30d) and connection indicator.',
          ],
        },
        {
          heading: 'KPI Cards — How to Read',
          items: [
            '**Active Sessions** — vehicles currently on the STO premises (open VehicleSession without exitTime). Color depends on load.',
            '**Free Posts** — posts with **free** status. [●green]{green:Green} — there are free posts; [●red]{red:red} — all 10 are occupied, capacity needs to be managed.',
            '**Occupied Posts** — posts in **occupied** (car waiting, no work) or **active_work** (service in progress) status. A higher number = higher load.',
            '**Recommendations** — count of unhandled notifications. An [●orange]{orange:orange} badge means attention is needed.',
            '[click] Any card is **clickable** — opens the corresponding detail page.',
            '**Delta badge** (up/down triangle with %) shows growth or decline vs the previous equivalent period. [●green]{green:Green} — improvement; [●red]{red:red} — degradation.',
            'A 0 without a delta means there is no data for the previous period (e.g., the start of tracking).',
          ],
        },
        {
          heading: 'Live Posts Overview (LiveSTOWidget)',
          items: [
            'A grid of **10 posts** with color status and key info:',
            '[●green]{green:Green} = free.',
            '[●purple]{purple:Purple} = active_work (service in progress, worker present).',
            '[●red]{red:Red} = occupied_no_work (car parked, no one working — possible idle).',
            '[●orange]{orange:Orange} = occupied (warning / transitional state).',
            '[●gray]{gray:Gray} = no_data (CV is not reporting this post).',
            'Occupied posts show the **plate** as a badge and the **time on post** (HH:MM).',
            'Great for a second monitor — see the entire STO without switching screens.',
            'Click a post to open its detail screen (PostHistory or PostsDetail).',
          ],
        },
        {
          heading: 'ML Predictions (PredictionWidget)',
          items: [
            '**Load forecast** for the next 4 hours — a line chart with hourly dynamics. Source: **/api/predict/load**.',
            '**Post availability** — "Post → ETA" table (when each post becomes free). Source: **/api/predict/free**.',
            '**Duration prediction** — time estimate by work type (Maintenance / Repair / Diagnostics). Source: **/api/predict/duration**.',
            'In **demo mode** values are seeded random — for presentations.',
            'In **live mode** the model analyzes historical patterns (day of week, hour, work type).',
            'Helps the service advisor decide: "Can I fit a car in at 2:30 PM?"',
          ],
        },
        {
          heading: 'Recommendations — 5 Types',
          items: [
            '[●red]**No-show (no_show)** — the client did not arrive for a scheduled WO. Trigger: start time has passed, status unchanged.',
            '[●green]**Post free (post_free)** — post idle for 30+ min and unassigned WOs exist. Can be loaded.',
            '[●blue]**Capacity available (capacity_available)** — more than half of the posts are free. Can accept additional clients.',
            '[●yellow]**Work overtime (work_overtime)** — actual time > 120% of norm hours. A complex job or lost time.',
            '[●yellow]**Vehicle idle (vehicle_idle)** — car on the post for > 15 min without a worker. Notify the mechanic.',
            'The **"Acknowledge"** button confirms handling and removes the recommendation (acknowledgedAt is stored in the DB).',
            'No recommendations = section hidden (empty = everything is good).',
          ],
        },
        {
          heading: 'Recent Events Feed',
          items: [
            'Feed of the **10 latest** computer vision (CV) events.',
            'Category filter: **All** / **Vehicle** (entry/exit) / **Post** (occupied/vacated) / **Worker** (present/absent) / **Work** (activity/idle).',
            'Event card: **type** + **zone/post** + **source cameras** (CAM 01, CAM 02…) + **time** (HH:MM:SS).',
            'Confidence indicator color: [●green]{green:green} ≥ 90%, [●yellow]{yellow:yellow} 70–89%, [●red]{red:red} < 70%.',
            'Low confidence = possible false positive; manual verification recommended.',
            'Click an event to open a modal with camera info and the raw payload.',
          ],
        },
        {
          heading: 'Metrics Period and Comparison',
          items: [
            '**24h / 7d / 30d** switcher in the top-right corner — defines the KPI calculation window.',
            'Delta badges always compare the current period to the previous equivalent (24h ↔ previous 24h, etc.).',
            'The period **persists** in the URL (?period=24h|7d|30d) — shareable link.',
            'Changing the period does **not reload** the page — data is fetched inline.',
          ],
        },
        {
          heading: 'Data Refresh and Connection',
          items: [
            '**Demo mode** — polls every **5 seconds** (setInterval).',
            '**Live mode** — Socket.IO, instant updates on every change.',
            'On connection loss — a **yellow indicator** appears in the header and data freezes (shows the last known state).',
            'On reconnect — automatic re-sync; indicator turns green.',
          ],
        },
        {
          heading: 'Stale Data',
          items: [
            '[●red]{red:Red} **StaleDataBanner** appears when the last external CV update is older than **1 hour**. KPIs and charts keep rendering but are tagged "data is stale Xh Ymin ago".',
            '[warn] Banner shown = **signal to the engineer**: check MonitoringProxy status on the LiveDebug page.',
            '[●orange]{orange:Orange} **gap ≥ 5 min** in a post timeline closes the current "visit" — empty hours are NOT extended as a continuation of the last state.',
            '[●green]{green:Green} = fresh data (< 5 min since lastUpdate) — sync-fallback drawing is active; the current visit is visible up to "now".',
            'See section 24 "Monitoring & Live Mode" in TechDocs for details.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Morning check** — open the page → review recommendations (handle any) → switch to Posts Timeline for shift planning.',
            '[ok] **Daytime monitoring** — keep LiveSTOWidget on a second monitor → notice a post stuck in occupied_no_work → send a master.',
            '[ok] **Spike analysis** — noticed 9/10 posts occupied → switch the period to 7d and compare via delta with last week.',
            '[ok] **No-show response** — a no_show recommendation appeared → click "Acknowledge" → reschedule the slot in Posts Timeline.',
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
      intro: 'Главный инструмент мастера-приёмщика. Визуальное расписание всех заказ-нарядов на смене по 10 постам. Перетаскивание для перепланирования, мгновенная подсветка конфликтов, статистика смены сверху, нераспределённые ЗН снизу.',
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
            '**Левый край блока** = планируемое начало.',
            '**Правый край** = планируемое начало + нормочасы.',
            'Блоки **обрезаются** границами смены — не выходят за начало и конец смены.',
            'Наведение мыши — **всплывающая подсказка**: номер ЗН, госномер, тип работ, мастер.',
            'Клик по блоку — **карточка ЗН** с полной информацией и действиями.',
          ],
        },
        {
          heading: 'Цвета и паттерны блоков ЗН',
          items: [
            '[●green]{green:Зелёный} — работа завершена.',
            '[●purple]{purple:Фиолетовый} — работа идёт прямо сейчас.',
            '[●gray]{gray:Серый} — запланировано, ещё не начато.',
            '[●gray]**Бледный/полупрозрачный** — ЗН отменён.',
            '[●red]{red:Красная обводка} — фактическое время превысило нормочасы.',
            '[warn] **Полосатый паттерн** — конфликт: два ЗН пересекаются по времени на одном посту.',
            '[bolt] **«Турбо»** — ЗН выполнен быстрее нормы (есть сэкономленное время).',
          ],
        },
        {
          heading: 'Индикатор точки поста (слева)',
          items: [
            'Использует **единую палитру карты СТО** — те же цвета, что на карте:',
            '[●green]{green:Зелёный} = свободен.',
            '[●purple]{purple:Фиолетовый} = активная работа.',
            '[●red]{red:Красный} = занят без работ.',
            '[●orange]{orange:Оранжевый} = занят.',
            '[●gray]{gray:Серый} = нет данных.',
          ],
        },
        {
          heading: 'KPI-полоса смены — что считается',
          items: [
            '**Занято / Свободно** — мгновенный срез по статусу постов.',
            '**Завершённые ЗН** — количество завершённых ЗН за смену.',
            '**Нормочасы** — суммарные нормочасы всех ЗН смены (включая нераспределённые).',
            '**Время простоя** — сколько часов посты простаивали (без авто или без работника).',
            '**Просроченные** — суммарное время превышения нормы по всем активным и завершённым ЗН.',
            '**«Турбо»** — суммарное сэкономленное время (где факт < нормы). Чем больше — тем эффективнее смена.',
          ],
        },
        {
          heading: 'Перетаскивание — перепланирование',
          items: [
            '**По горизонтали** — изменить время начала. Шаг **15 минут** (блок «прилипает» к четвертям часа).',
            '**По вертикали** — перенести на другой пост. ЗН меняет назначенный пост.',
            'При наведении на конфликтный слот блок **подсвечивается красным с полосами**.',
            'Кнопка **«Сохранить»** в правом верхнем углу — отправить изменения на сервер.',
            'При сохранении бэкенд проверяет **версию** (защита от одновременного редактирования). Если кто-то изменил параллельно — ошибка 409 — обновите страницу.',
            '**Двигать можно только запланированные ЗН** — «В работе» и «Завершён» закреплены за своим слотом.',
            'Кнопка **«Сбросить»** — откатить локальные изменения до последней сохранённой версии.',
          ],
        },
        {
          heading: 'Нераспределённые ЗН (таблица внизу)',
          items: [
            'ЗН без назначенного поста — ждут распределения.',
            'Колонки: **№ ЗН**, **госномер**, **тип работ**, **нормочасы**, **запланированное время**.',
            'Сортировка по запланированному времени — самые срочные сверху.',
            '**Перетащите строку из таблицы на таймлайн** — назначит на пост в выбранный момент.',
            'Когда таблица **пустая** — все ЗН распределены, можно начинать смену.',
          ],
        },
        {
          heading: 'Карточка ЗН — действия по клику',
          items: [
            'Карточка ЗН: номер, госномер, марка/модель, тип работ, нормочасы, факт.',
            'Видно работника, мастера и аудиторскую историю изменений.',
            'Кнопки управления статусом: **Начать**, **Пауза**, **Продолжить**, **Завершить**, **Отменить**.',
            'Можно вручную сменить **пост** или **запланированное время** через поля формы (альтернатива перетаскиванию).',
            'При сохранении из карточки — те же правила версионирования (ошибка 409 при конфликте).',
          ],
        },
        {
          heading: 'Настройки смены (иконка-шестерёнка)',
          items: [
            '**Время начала** — от 00:00 до 23:00. Граница левого края шкалы.',
            '**Время окончания** — от 01:00 до 24:00. Граница правого края шкалы.',
            '**Количество отображаемых постов** — 1–10. Скроет лишние строки.',
            'Настройки сохраняются локально в браузере — у каждого пользователя свои.',
            'Сменили часы — таймлайн перерисовывается мгновенно, ЗН перепозиционируются.',
          ],
        },
        {
          heading: 'Свежесть данных и баннер устаревания',
          items: [
            '[●red]{red:Красный} баннер сверху — последнее обновление от камер старше **1 часа**. Таймлайн отображается, но цифры могут отставать.',
            '[●orange]{orange:Оранжевый} **разрыв ≥ 5 мин** в сегменте — текущий «визит» закрывается. Без свежих обновлений не дорисовывается «фантомная» полоса до конца смены.',
            '[●green]{green:Зелёный} — досинхронизация активна (последнее обновление в пределах смены и менее 5 минут назад) — сегмент дотягивается до момента «сейчас».',
            '[info] Тип поста (легковой / грузовой / специальный) и его цветовой ярлычок берутся из имени зоны во внешней системе камер — это гарантирует, что подпись зоны и цвет всегда совпадают.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Утреннее планирование** — открыли страницу → перетащили все нераспределённые ЗН на свободные посты → нажали «Сохранить».',
            '[ok] **Реакция на неявку** — ЗН в красной обводке, клиент не приехал → клик → «Отменить» → освободившийся слот заполнили из нераспределённых.',
            '[ok] **Перенос между постами** — мастер заболел → перетащили все его ЗН на другой пост → сохранили.',
            '[ok] **Экстренное окно** — клиент приехал без записи → перетащили его ЗН в свободный слот → выставили запланированное время «сейчас» → «Начать».',
          ],
        },
        {
          heading: 'Возможные проблемы',
          items: [
            '**Ошибка 409 при сохранении** — кто-то редактировал параллельно. Решение: обновите страницу (F5), внесите правки заново.',
            '**Блок не двигается** — статус не «Запланирован» («В работе» и «Завершён» нельзя перемещать).',
            '**Блок «исчезает» при перетаскивании** — улетел за конец смены. Сначала расширьте смену через настройки.',
            '**Полосатый блок** — конфликт по времени. Перетащите один из ЗН в свободный слот.',
          ],
        },
      ],
    },
    en: {
      title: 'Posts Timeline — Gantt Chart',
      intro: 'The primary tool for the service advisor. A visual schedule of all WOs across the 10 posts for the shift. Drag-and-drop for replanning, instant conflict highlighting, a shift KPI strip on top, and unassigned WOs below.',
      sections: [
        {
          heading: 'Screen Map (where things are)',
          items: [
            '**Very top** — shift KPI strip: occupied/free posts, completed WOs, norm hours, idle time, overdue, "turbo".',
            '**Timeline header** — horizontal time scale (default 08:00–20:00).',
            '**Timeline body** — 10 rows (one per post) with WO rectangles.',
            '**Red vertical line** — current time. Moves every minute.',
            '**Gear icon** (top-right) — shift settings (hours, post count).',
            '**"Current shift"** button — scrolls the timeline to the current time.',
            '**Table below the timeline** — unassigned WOs ready to be slotted in.',
            '**Bottom of the page** — legend explaining colors and patterns.',
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
          heading: 'Live Data Freshness and Stale Banner',
          items: [
            '[●red]{red:Red} top banner — last CV update older than **1 hour** (STALE_DATA_MS threshold). Timeline still renders but numbers may lag.',
            '[●orange]{orange:Orange} **gap ≥ 5 min** in a segment — current "visit" is closed. Without fresh updates, no "ghost" bar is drawn until end of shift.',
            '[●green]{green:Green} = sync-fallback active (lastUpdate within shift bounds and < 5 min ago) — the segment extends up to "now".',
            '[info] Post type (light / heavy / special) and its color badge come from the external CV zone name (deriveTypeFromZoneName) — guarantees that zone label and color always match.',
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
            'Цвет индикатора: [●green]{green:зелёный} > 70%, [●yellow]{yellow:жёлтый} 40-70%, [●red]{red:красный} < 40%.',
            'Номер поста отображается в левом верхнем углу карточки.',
            'Метка типа поста — [●blue]{blue:Легковой} / [●orange]{orange:Грузовой} / [●purple]{purple:Спец} — берётся из имени зоны во внешней системе камер. Если зона не передана — берётся тип из настроек поста.',
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
            '**Журнал событий** — все события от камер на этом посту за период.',
            '**Статистика** — суммарные метрики: общее время работы, простоя, количество пауз.',
            '**Камеры** — привязанные к посту камеры с миниатюрой последнего кадра.',
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
          heading: 'Свежесть данных и баннер устаревания',
          items: [
            '[●red]{red:Красный} баннер сверху — последнее обновление от камер старше **1 часа**. Метрики могут отражать «застывшее» состояние.',
            '[●orange]{orange:Оранжевый} **разрыв ≥ 5 мин** между событиями = закрытие текущего «визита». Простой не докручивается до конца смены искусственно.',
            '[warn] Если на временной шкале поста виден большой пустой хвост — это НЕ ошибка отображения, это разрыв в потоке данных от камер.',
            '[info] Карточка поста и панель деталей не дорисовывают «синтетический» простой, если последнее обновление от камер вышло за границы смены — этим устранена длинная фантомная полоса на посту после конца смены.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Поиск узких мест** — выбрали Неделю → отсортировали таблицу по загрузке (по возрастанию) → нашли посты с < 40% → открыли детали → выяснили причину (нет работника / мало ЗН).',
            '[ok] **Анализ работника** — открыли пост → раздел «Работники» → увидели, кто меньше всего часов отработал.',
            '[ok] **Сравнение «вчера vs сегодня»** — Сегодня → запомнили цифры → Вчера → сравнили вручную.',
            '[ok] **Подготовка к совещанию** — Месяц → таблица → отсортировали по эффективности → сделали скриншот топ-3 / худшие 3.',
          ],
        },
      ],
    },
    en: {
      title: 'Posts Detail',
      intro: 'Detailed per-post analytics: occupancy, efficiency, WO history, workers. Use it to analyze performance and identify bottlenecks. Supports periods from one day to a month, two view modes, and a deep-dive detail panel.',
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
            'Color indicator: [●green]{green:green} > 70%, [●yellow]{yellow:yellow} 40-70%, [●red]{red:red} < 40%.',
            'Post number displayed in top left corner of the card.',
            'Post type badge — [●blue]{blue:Light} / [●orange]{orange:Truck} / [●purple]{purple:Special} — comes from the external CV zone name (deriveTypeFromZoneName), not DB seeds. If CV does not provide zone name, falls back to Post.type.',
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
          heading: 'Live Data Freshness and Stale Banner',
          items: [
            '[●red]{red:Red} top banner — last CV update older than **1 hour**. Metrics may reflect a "frozen" state.',
            '[●orange]{orange:Orange} **gap ≥ 5 min** between events = closure of the current "visit". Idle time is not artificially extended to the end of shift.',
            '[warn] If a long empty tail is visible in a post timeline — this is NOT a render bug, this is a gap in the CV data stream.',
            '[info] Card and detail panel skip "sync-fallback" drawing when lastUpdate is outside shift bounds — this fixes the long ghost bar on a post after end of shift.',
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
      intro: 'Интерактивная карта станции. Реальные пропорции СТО (46540×30690 мм). Показывает все посты, зоны, камеры и автомобили в реальном времени, с цветовой индикацией статусов и кликабельными элементами. Поддерживает режим воспроизведения для просмотра истории.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Центр** — холст карты с зданиями, постами, зонами и камерами.',
            '[eye] **Правый верхний угол** — панель «Слои» (переключатель для каждого типа элементов).',
            '[eye] **Левый нижний угол** — кнопки масштаба (+/−), сброс, полный экран.',
            '[eye] **Низ или боковая панель** — сводка по постам и счётчик авто.',
            '[eye] **Полоса воспроизведения** (если включена) — ползунок времени для просмотра истории.',
          ],
        },
        {
          heading: 'Элементы на карте',
          items: [
            '**Здания** — контуры строений СТО.',
            '**Посты** — рабочие места механиков. Цвет зависит от статуса: [●green]{green:зелёный} = свободен, [●purple]{purple:фиолетовый} = идёт работа, [●red]{red:красный} = занят без работы, [●orange]{orange:оранжевый} = занят/предупреждение, [●gray]{gray:серый} = нет данных.',
            '**Зоны** — области: ремонт, ожидание, въезд, парковка, свободная. Показывают количество авто.',
            '**Камеры** — позиции камер с направлением обзора (треугольный сектор).',
            '**Двери** — входы и выходы в здания.',
            '**Стены** — внутренние перегородки.',
            '**Проезды** — пути движения автомобилей.',
            '**Метки** — текстовые надписи на карте.',
            '**Инфозоны** — области с дополнительной информацией.',
            '**Авто** — иконки машин с госномерами, появляются в активных сессиях.',
          ],
        },
        {
          heading: 'Цвет постов — расшифровка',
          items: [
            '[●green]{green:Зелёный} — пост свободен, готов к приёму.',
            '[●purple]{purple:Фиолетовый} — идёт обслуживание, есть работник.',
            '[●red]{red:Красный} — авто стоит, работа не ведётся.',
            '[●orange]{orange:Оранжевый} — занят (предупреждение, переходное состояние).',
            '[●gray]{gray:Серый} — пост есть в системе, но камеры не присылают данные.',
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
            '**Колёсико мыши** — приближение/отдаление с центром на курсоре.',
            '**Зажатая левая кнопка** — перетаскивание карты.',
            'Кнопки **«+» / «−»** — пошаговое масштабирование.',
            'Кнопка **«На весь экран»** — развернуть карту на всё окно.',
            'Кнопка **«Сбросить»** — вернуть начальный масштаб и позицию.',
            'Реальный размер: **46540×30690 мм** — соответствует пропорциям СТО.',
          ],
        },
        {
          heading: 'Интерактивность — клики',
          items: [
            '**Клик на пост** — модальное окно: номер, статус, госномер авто, работник, время на посту.',
            '**Клик на зону** — карточка зоны: тип, текущее количество авто, список госномеров.',
            '**Клик на камеру** — модальное окно с видеотрансляцией камеры.',
            '**Клик на инфозону** — дополнительная информация (текст, статистика).',
            'Все модальные окна закрываются кликом вне или кнопкой X.',
          ],
        },
        {
          heading: 'Воспроизведение — просмотр истории',
          items: [
            'Кнопка **«Воспроизведение»** включает режим истории — карта отображает состояние за прошлый момент.',
            'Появляется **ползунок времени** — двигайте для перехода к нужному моменту.',
            'Кнопки **«Старт» / «Пауза»** — автоматическое воспроизведение с заданной скоростью.',
            'Полезно для разбора инцидентов: «что было в 14:23?»',
            'Чтобы вернуться в реальное время — кнопка **«Сейчас»** или выключите режим воспроизведения.',
          ],
        },
        {
          heading: 'Обновление данных',
          items: [
            'В **рабочем режиме** — каждые **10 секунд** опрашивается внешний сервис камер.',
            'В **демо-режиме** — каждые **5 секунд**.',
            'Статусы постов и активные сессии приходят с бэкенда системы.',
            'Геометрия карты подгружается из последней сохранённой версии.',
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
            '[ok] **Разбор инцидента** — включили воспроизведение → переместили ползунок на нужный момент → разобрались, что произошло.',
          ],
        },
      ],
    },
    en: {
      title: 'STO Map — Live Overview',
      intro: 'Interactive STO map powered by Konva (Canvas). Real STO proportions (46540×30690 mm). Displays all posts, zones, cameras, and vehicles in real time with color-coded statuses and clickable elements. Supports replay mode for browsing history.',
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
      intro: 'Полнофункциональный визуальный редактор планировки СТО. 10 типов элементов, перетаскивание мышью, рисование полигонов, фоновое изображение для обводки. Поддерживает отмену действий (до 50 шагов), версионирование (история) и экспорт в файл. Изменения становятся видны на странице «Карта» после сохранения.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Левая панель** — панель инструментов (10 типов элементов + «Выделение»).',
            '[eye] **Центр** — холст редактора с реальными пропорциями СТО.',
            '[eye] **Правая панель** — свойства выделенного элемента (название, координаты, тип).',
            '[eye] **Верх** — кнопки: Сохранить, Сбросить, История, Экспорт/Импорт, Загрузить фон.',
            '[eye] **Низ или угол** — управление масштабом (+, −, %), переключатель сетки.',
          ],
        },
        {
          heading: 'Панель инструментов',
          items: [
            '**Выделение** — выбор и перемещение элементов. Клик по элементу для выделения.',
            '**Здание** — рисование контура здания полигоном.',
            '**Пост** — размещение рабочего поста. Указывается номер и тип (тяжёлый / лёгкий / специальный).',
            '**Зона** — создание зоны полигоном. Типы: ремонт, ожидание, въезд, парковка, свободная.',
            '**Камера** — размещение камеры с направлением обзора.',
            '**Проезд** — рисование пути движения автомобилей.',
            '**Дверь** — обозначение входов/выходов.',
            '**Стена** — рисование перегородок.',
            '**Метка** — текстовые надписи на карте.',
            '**Инфозона** — информационные области.',
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
            'Изменения применяются мгновенно на холсте.',
          ],
        },
        {
          heading: 'Горячие клавиши',
          items: [
            '**Ctrl+Z** — отменить последнее действие (до 50 шагов).',
            '**Ctrl+Shift+Z** — повторить отменённое действие.',
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
            '**Привязка к сетке** — при перемещении элементы прилипают к узлам сетки (шаг 10px).',
            'Помогает выравнивать элементы относительно друг друга.',
            'Размер холста: **46540x30690 мм** — реальные размеры СТО.',
          ],
        },
        {
          heading: 'Сохранение и версионирование',
          items: [
            'Кнопка **«Сохранить»** — сохраняет текущий макет на сервер.',
            'Каждое сохранение создаёт **новую версию**.',
            'Кнопка **«История»** — список всех версий с датой и автором.',
            'Можно **восстановить** любую предыдущую версию.',
            '**Экспорт/Импорт** — для резервного копирования или переноса макетов между серверами.',
          ],
        },
        {
          heading: 'Масштабирование',
          items: [
            '**Колёсико мыши** — приближение и отдаление.',
            'Кнопки **+/-** в углу — пошаговое масштабирование.',
            'Процент масштаба отображается рядом с кнопками.',
            'При большом масштабе видны мелкие детали для точной расстановки.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Создание новой карты с нуля** — Загрузить фон (план в PDF или PNG) → нарисовать здания → добавить зоны → расставить посты → разместить камеры → Сохранить.',
            '[ok] **Корректировка существующей** — открыли редактор → нашли элемент → выделили → исправили координаты в правой панели → Сохранить.',
            '[ok] **Откат к старой версии** — История → выбрали нужную версию → Восстановить.',
            '[ok] **Перенос на другой сервер** — Экспорт → загрузили файл на другом сервере → Импорт → Сохранить.',
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
      intro: 'Журнал визитов автомобилей на СТО. Сессия = одно посещение: открывается на въезде (камера зафиксировала госномер) и закрывается на выезде. Внутри сессии — маршрут по зонам и пребывание на постах. Отключена в рабочем режиме (там сессии управляются автоматически внешней системой).',
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
            '**Статус** — «На территории» или «Выехал».',
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
            '**Маршрут по зонам** — через какие зоны проезжал автомобиль, с временем в каждой.',
            '**Привязанный ЗН** — автоматически найденный заказ-наряд по совпадению госномера.',
            '**QR-код** — ссылка на сессию, можно отсканировать для быстрого доступа.',
            '**Пребывание на посту** — время на каждом посту, наличие работника, активное/простойное время.',
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
            'Страница **отключена в рабочем режиме** — в рабочем режиме сессии управляются автоматически.',
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
      intro: 'A log of vehicle visits to the STO. A session = one visit: opens at entry (when a CV camera captures the plate) and closes at exit. Inside a session — zone route (ZoneStay) and post stays (PostStay). Disabled in live mode (sessions are managed automatically by the external system).',
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
      intro: 'Реестр всех ЗН — основных документов работы СТО. Здесь можно создать, импортировать из CSV, отфильтровать и управлять жизненным циклом ЗН: начать, поставить на паузу, возобновить, завершить, отменить. Версионирование защищает от параллельных правок. Отключена в рабочем режиме (там ЗН управляются через 1С).',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верхняя строка** — поиск (по № ЗН, госномеру, типу работ) и выбор диапазона дат.',
            '[eye] **Под поиском** — кнопки-фильтры по статусу с счётчиками (например: «Запланирован (12)»).',
            '[eye] **Кнопка «Импорт CSV»** — справа сверху.',
            '[eye] **Центр** — таблица ЗН со всеми колонками и сортировкой.',
            '[eye] **Низ** — пагинация.',
          ],
        },
        {
          heading: 'Статусы заказ-нарядов',
          items: [
            '**Запланирован** — ЗН создан, ожидает начала работ. Серая метка.',
            '**В работе** — механик начал работу. Синяя метка.',
            '**Завершён** — работа выполнена. Зелёная метка.',
            '**Отменён** — ЗН отменён. Красная метка.',
            '**Неявка** — клиент не приехал. Красная метка с полосой.',
            'Статус меняется последовательно: «Запланирован» → «В работе» → «Завершён».',
          ],
        },
        {
          heading: 'Поиск и фильтрация',
          items: [
            '**Поиск** — по номеру ЗН, госномеру или типу работ. Ищет по всем полям.',
            '**Кнопки статусов** — фильтр по статусу. На каждой кнопке отображается количество ЗН.',
            '**Период** — фильтр по диапазону запланированных дат.',
            'Фильтры комбинируются: можно искать «ТО» среди ЗН в работе за последнюю неделю.',
          ],
        },
        {
          heading: 'Таблица заказ-нарядов',
          items: [
            '**Номер ЗН** — уникальный номер заказ-наряда.',
            '**Время** — запланированное время начала работ.',
            '**Госномер** — номер автомобиля.',
            '**Тип работ** — вид обслуживания (ТО, ремонт, диагностика и т.д.).',
            '**Нормочасы** — нормативное время выполнения в часах.',
            '**Статус** — текущий статус с цветной меткой.',
            'Сортировка по любой колонке.',
          ],
        },
        {
          heading: 'Действия с ЗН',
          items: [
            '**Начать** — запустить работу (статус меняется на «В работе»). Фиксируется время старта.',
            '**Пауза** — приостановить работу. Фиксируется время паузы.',
            '**Возобновить** — продолжить работу после паузы.',
            '**Завершить** — закрыть работу (статус меняется на «Завершён»). Фиксируется время завершения.',
            '**Отменить** — отменить ЗН.',
            'Все действия записываются в **журнал аудита**.',
          ],
        },
        {
          heading: 'CSV-импорт',
          items: [
            'Кнопка **«Импорт CSV»** — загрузка ЗН из файла.',
            'Формат CSV: **номер, дата, госномер, тип работ, нормочасы**.',
            'Разделитель: запятая. Первая строка — заголовки (пропускается).',
            'При ошибке формата отображается строка с проблемой.',
            'Импортированные ЗН получают статус «Запланирован».',
          ],
        },
        {
          heading: 'Ограничения',
          items: [
            'Страница **отключена в рабочем режиме** — в рабочем режиме ЗН управляются через 1С.',
            'Нельзя удалить ЗН в статусе «В работе» — сначала завершите или отмените.',
            'Версионирование: при конфликте (одновременное редактирование) — система покажет предупреждение и попросит перезагрузить страницу.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Массовый импорт расписания** — кнопка «Импорт CSV» → выбрали файл → проверили ошибки → ЗН созданы со статусом «Запланирован» → перешли в таймлайн постов для распределения.',
            '[ok] **Отмена неявки** — фильтр «Запланирован» → нашли клиента, который не приехал → клик → «Отменить» → статус «Неявка».',
            '[ok] **Поиск долгих ремонтов** — фильтр «В работе» + диапазон дат «вчера» → отсортировали по нормочасам → нашли затянувшиеся.',
            '[ok] **Закрытие смены** — фильтр «Завершён» + сегодня → проверили, что фактическое время заполнено для всех.',
          ],
        },
      ],
    },
    en: {
      title: 'Work Orders',
      intro: 'Registry of all WOs — the core STO work documents. Create, import (CSV), filter, and manage the WO lifecycle (start/pause/resume/complete/cancel). Versioning protects against concurrent edits (HTTP 409). Disabled in live mode (WOs are managed via 1C there).',
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
      intro: 'Лента всех событий от системы компьютерного зрения. 10 типов, 4 группы. Каждое событие — снимок состояния, зафиксированный одной или несколькими камерами с уровнем уверенности. Поддерживает фильтры, текстовый поиск и автообновление.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — фильтры в один ряд: Группа, Тип, Зона, Пост, Поиск.',
            '[eye] **Правый верхний угол** — переключатель автообновления и сортировки.',
            '[eye] **Центр** — таблица событий с цветными индикаторами и тегами камер.',
            '[eye] **Низ** — пагинация (25 / 50 / 100 на страницу).',
            '[eye] **Модальное окно** (клик по событию) — исходные данные и информация о камере.',
          ],
        },
        {
          heading: 'Типы событий (10 типов)',
          items: [
            '**Въезд в зону** — автомобиль въехал в зону.',
            '**Выезд из зоны** — автомобиль покинул зону.',
            '**Пост занят** — пост занят автомобилем.',
            '**Пост освобождён** — пост освободился.',
            '**Работник пришёл** — работник появился на посту.',
            '**Работник ушёл** — работник покинул пост.',
            '**Активная работа** — зафиксирована активная работа на посту.',
            '**Простой на посту** — нет активности на посту.',
            '**Авто в движении** — автомобиль перемещается по территории.',
            '**Авто ожидает** — автомобиль стоит в зоне ожидания.',
          ],
        },
        {
          heading: 'Группы событий (4 группы)',
          items: [
            '**Авто** — въезд, выезд, перемещение, ожидание.',
            '**Пост** — занятие и освобождение поста.',
            '**Работник** — появление и уход с поста.',
            '**Работа** — активность и простой на посту.',
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
          heading: 'Уровень уверенности',
          items: [
            '**Высокий (≥ 90%)** — зелёный индикатор. Система камер уверена в распознавании.',
            '**Средний (70-89%)** — жёлтый индикатор. Возможны неточности.',
            '**Низкий (< 70%)** — красный индикатор. Требуется ручная проверка.',
            'Уверенность отображается процентом рядом с каждым событием.',
            'Влияет на автоматическое создание сессий — низкая уверенность может быть проигнорирована.',
          ],
        },
        {
          heading: 'Камеры-источники',
          items: [
            'Каждое событие содержит **список камер**, которые зафиксировали его.',
            'Формат: CAM 01, CAM 02 и т.д.',
            'Если событие подтверждено несколькими камерами — уверенность выше.',
            'Клик на камеру открывает видеотрансляцию в модальном окне.',
          ],
        },
        {
          heading: 'Автообновление и пагинация',
          items: [
            '**Автообновление** — переключатель в правом верхнем углу. Опрос каждые 5 секунд.',
            'Сортировка: по времени (новые сверху/снизу).',
            'Пагинация: **25**, **50** или **100** записей на страницу.',
            'При включённом автообновлении новые события появляются вверху списка.',
            'Если включить автообновление и уйти со страницы — оно остановится: при возврате его нужно включить заново.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Расследование инцидента** — выбрали зону и диапазон времени → нашли цепочку событий → проверили уровень уверенности → восстановили хронологию.',
            '[ok] **Калибровка камеры** — фильтр по конкретной зоне → много событий с низкой уверенностью → проверьте угол и освещённость камеры.',
            '[ok] **Поиск конкретного авто** — поиск по госномеру → видите весь маршрут авто внутри СТО.',
            '[ok] **Контроль работника** — фильтр «Тип = Работник ушёл» + конкретный пост → нашли периоды отсутствия работника.',
          ],
        },
      ],
    },
    en: {
      title: 'Event Log',
      intro: 'A feed of all computer vision (CV) events. 10 types in 4 groups. Each event is a state snapshot captured by one or more cameras with a confidence score. Supports filters, text search, and auto-refresh.',
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
      intro: 'Комплексная аналитика СТО: 6 KPI-карточек, 8 типов графиков и таблица постов. Поддерживает сравнение с прошлым равным периодом (со значком дельты) и экспорт всего в XLSX, PDF или отдельных графиков в PNG. Главный инструмент для отчётов руководству.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — переключатель периода (Сегодня / 7д / 30д) и переключатель режима сравнения.',
            '[eye] **Под переключателями** — 6 KPI-карточек с дельтами.',
            '[eye] **Дальше вниз** — 8 графиков: круговые, столбчатые, линейные, точечные, тепловые карты.',
            '[eye] **Внизу страницы** — сводная таблица по 10 постам.',
            '[eye] **Кнопки экспорта** (правый верхний угол) — XLSX, PDF, PNG (контекстное меню по графику).',
          ],
        },
        {
          heading: 'Период и сравнение',
          items: [
            'Три периода: **Сегодня** (последние 24 часа), **7 дней**, **30 дней**.',
            '**Режим сравнения** — включает значок дельты, показывающий разницу с предыдущим аналогичным периодом.',
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
            '**Почасовая нагрузка** — тепловая карта: часы 8–19 по горизонтали, 10 постов по вертикали. Цвет = загрузка.',
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
            'Все экспортируемые данные включают значения, отображаемые на странице: KPI, графики, таблицу.',
          ],
        },
        {
          heading: 'Источники данных',
          items: [
            'Данные приходят с бэкенда системы.',
            'Агрегация: по постам, по дням, по часам.',
            'При отсутствии данных за период — графики показывают нулевые значения.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Месячный отчёт руководству** — 30 дней + Сравнение → проверили все KPI → Экспорт PDF → отправили директору.',
            '[ok] **Поиск часов перегрузки** — тепловая карта «Почасовая нагрузка» → нашли часы 100% → решили о доп. постах или переносе ЗН.',
            '[ok] **Сравнение недель** — 7д с включённым Сравнением → дельта показала рост или падение.',
            '[ok] **График в презентацию** — правый клик на график → «Сохранить как PNG» → вставили в слайд.',
          ],
        },
      ],
    },
    en: {
      title: 'Analytics',
      intro: 'Comprehensive STO analytics: 6 KPI cards, 8 chart types, and a per-post table. Supports comparison with the previous equivalent period (DeltaBadge) and export to XLSX, PDF, or individual charts as PNG. The main tool for management reporting.',
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
      intro: 'Управление и просмотр камер СТО. 16 камер (CAM 00–15), видеотрансляция через выделенный порт. Группировка по зонам, статусы «онлайн / офлайн», миниатюры кадров. Отключена в рабочем режиме (видеопотоки отдаёт внешняя система).',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — вкладки: «Камеры по зонам» / «Все камеры».',
            '[eye] **Под вкладками** — фильтр по зонам (Все, Въезд/Выезд, Подъёмники, Парковка, Склад).',
            '[eye] **Центр** — сетка карточек камер (миниатюра, статус, приоритет).',
            '[eye] **Модальное окно** — открывается по клику для просмотра видеопотока.',
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
            '**Статус** — зелёный кружок («онлайн») или красный («офлайн»). Обновляется автоматически.',
            '**Приоритет** — метка P3–P10 показывает приоритет камеры в зоне.',
            '**Зона покрытия** — какие зоны видит камера.',
            'Миниатюра последнего кадра (если доступно).',
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
          heading: 'Просмотр видеопотока',
          items: [
            'Клик по камере открывает **модальное окно** с живым видео.',
            'Используется потоковая трансляция в браузере без установки плагинов.',
            'Видеопоток идёт через выделенный сервер на порту **8181** (преобразование исходного потока в формат, понятный браузеру).',
            'При камере в офлайне отображается заглушка.',
            'Закрытие модального окна останавливает поток для экономии трафика.',
          ],
        },
        {
          heading: 'Статус камер',
          items: [
            'Фоновая проверка доступности камер каждые 30 секунд.',
            'Изменение статуса мгновенно приходит в браузер по веб-сокету.',
            'Карточки камер обновляются автоматически.',
            'Если камера в офлайне дольше 5 минут — формируется рекомендация.',
          ],
        },
        {
          heading: 'Ограничения',
          items: [
            'Страница **отключена в рабочем режиме** — видеотрансляции доступны только в демо.',
            'Качество трансляции зависит от сетевого подключения.',
            'Максимум 4 одновременных видеотрансляции для снижения нагрузки на сервер.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Проверка камер утром** — открыли страницу → пробежались по сетке → красные кружки = надо срочно чинить.',
            '[ok] **Просмотр инцидента** — знаете зону → фильтр по зоне → клик на нужную камеру → видеотрансляция в модальном окне.',
            '[ok] **Проверка приоритетов** — переключились в «Все камеры» → проверили метки приоритета → если важная зона на P3 → перейти в «Сопоставление камер по зонам» и поднять.',
          ],
        },
      ],
    },
    en: {
      title: 'Surveillance Cameras',
      intro: 'Manage and view STO cameras. 16 cameras (CAM 00–15), HLS streaming via port :8181 (FFmpeg converts RTSP → HLS). Zone grouping, online/offline status, and frame previews. Disabled in live mode (streams are provided by the external system).',
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
  // НЕСТЫКОВКИ 1С↔CV
  // ────────────────────────────
  discrepancies: {
    ru: {
      title: 'Нестыковки 1С↔CV — журнал расхождений',
      intro: 'Сводная страница расхождений между планом 1С и реальностью с камер. Фоновая служба применяет 6 правил к актуальным заказ-нарядам и данным с камер и записывает каждое расхождение в журнал нестыковок (статусы: открыто, принято, решено, отклонено). Уведомления: Telegram (критичные — немедленно, плюс дайджест) и мгновенное обновление в браузере.',
      sections: [
        {
          heading: '6 типов нестыковок',
          items: [
            '[●red] **Авто не приехало по камерам** — заказ-наряд закрыт в 1С, но камеры не видели авто на территории. Возможен фиктивный наряд или сбой интеграции.',
            '[●yellow] **Авто на посту без оформления в 1С** — авто стояло на посту дольше N минут с работником, но в 1С нет соответствующего ЗН. Возможна серая работа.',
            '[●yellow] **Не тот пост** — 1С говорит «пост 3», камеры видят на «посту 7».',
            '[●yellow] **Завышены нормочасы** — нормочасы превышают фактическое время на посту в **разы**.',
            '[●blue] **Заниженное фактическое время** — фактическое время на посту заметно превышает норму (занижение в 1С).',
            '[●blue] **Расхождение времени закрытия** — закрытие в 1С и выезд по камерам отличаются больше окна сопоставления.',
          ],
        },
        {
          heading: 'KPI и фильтры',
          items: [
            'Верх страницы — 5 карточек: Всего, Открыто, За 24 часа, Критичные, Предупреждения.',
            'Ниже — 6 карточек по типам нестыковок: клик переключает фильтр по типу.',
            'Фильтры: статус, важность, номер заказа. По умолчанию показаны только нестыковки со статусом «Открыто».',
            'Значок в боковом меню (рядом с пунктом «Нестыковки») — счётчик открытых плюс критичных за 24 часа, обновляется каждые 30 секунд.',
          ],
        },
        {
          heading: 'Жизненный цикл',
          items: [
            '[●yellow] **Открыто** — система только что нашла расхождение.',
            '[●blue] **Принято** — нестыковка взята в работу (фиксируются автор и время).',
            '[●green] **Решено** — поправили (в 1С, в камерах или в обоих); фиксируются автор, время, причина и комментарий.',
            '[●gray] **Отклонено** — отметили как ложную (например, ручная сверка показала, что всё в порядке).',
            'Для возврата в статус «Открыто» — кнопка «Открыть» в правой колонке (сбрасывает поля принятия и решения).',
            'Дубликаты схлопываются по уникальному ключу (тип, номер заказа, пост, сессия авто) — повторное обнаружение того же не создаёт новую запись.',
          ],
        },
        {
          heading: 'Раскрытая строка (детали)',
          items: [
            'Клик по шеврону слева — раскрывает двухпанельный режим: 1С слева, камеры справа.',
            'Слева: номер, состояние, госномер, VIN, план, закрыт, норма, исполнитель — из актуальной версии заказ-наряда в 1С.',
            'Справа: госномер, въезд, выезд из записи о визите.',
            'Если у нестыковки сохранены сырые значения из 1С и камер — они показываются в исходном виде для диагностики.',
          ],
        },
        {
          heading: 'Уведомления',
          items: [
            '[zap] **Критичные** — Telegram-сообщение немедленно (рассылка в чат).',
            '[zap] **Дайджест** — раз в N часов (по умолчанию 4 часа): сводка с тройкой худших постов и разбивкой по важности. Можно отключить через переменную окружения.',
            '[zap] **В реальном времени** — событие новой нестыковки отправляется в браузер; счётчик в боковом меню обновляется без перезагрузки.',
            '[zap] **Переключатель «Нестыковки» в шапке** Дашборда / Карты / Детализации постов / Моего поста / Таймлайна постов включает красные точки на постах с открытыми нестыковками — состояние сохраняется в профиле пользователя.',
          ],
        },
        {
          heading: 'Кнопки «Обновить» и «Пересчитать»',
          items: [
            '**Обновить** (внутри блока фильтров) — перезагружает данные с сервера без запуска проверки. Просто свежий снимок текущего содержимого журнала нестыковок.',
            '**Пересчитать** (синяя кнопка в шапке) — запускает проверку в фоне: применяет 6 правил по всем заказам и непривязанным стоянкам на постах за выбранное окно (по умолчанию 7 дней), создаёт новые и обновляет существующие записи. Операция небыстрая (на 1500+ заказах — десятки секунд), поэтому выполняется асинхронно: индикатор крутится, по завершении приходит уведомление с числом обработанных и новых.',
            '**Авто-пересчёт** — рядом с кнопкой шестерёнка: расписание (по умолчанию 08:00 Europe/Minsk, ежедневно), часовой пояс и окно анализа. Можно временно отключить.',
            'Время последнего пересчёта показано слева от кнопки («2 ч назад · 18с · +12»). Цвет: зелёный — норма, красный — ошибка, синий с индикатором загрузки — выполняется.',
          ],
        },
        {
          heading: 'Права доступа',
          items: [
            '**Просмотр данных 1С** — читать список, детали, статистику, видеть расписание автозапуска.',
            '**Управление нестыковками** — менять статус (принять, решить, отклонить, открыть заново), нажимать «Пересчитать», изменять расписание автозапуска.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Утренний разбор** — открыть страницу, отфильтровать по критичным открытым, по каждой строке решить: принять и разобраться либо отклонить.',
            '[ok] **Серая работа** — нашли нестыковку «Авто на посту без оформления в 1С» → подняли запись в 1С → отметили как «Решено» с комментарием «оформлено постфактум».',
            '[ok] **Ложное срабатывание** — критичная нестыковка «Авто не приехало по CV» → проверили: клиент действительно не приехал, но мастер забыл отменить ЗН → отметили как «Решено» с указанием причины.',
            '[ok] **После правки 1С** — нажать «Пересчитать»: нестыковка автоматически закрывается (правило больше не срабатывает), либо остаётся — значит правка не помогла.',
          ],
        },
      ],
    },
    en: {
      title: 'Discrepancies 1C↔CV — Mismatch Journal',
      intro: 'Aggregate page for mismatches between the 1C plan and what the cameras actually see. The detector runs 6 rules over **OneCWorkOrderMerged** + **VehicleSession** + **PostStay** and writes each mismatch into **Discrepancy** (open/acknowledged/resolved/dismissed). Notifications: Telegram (critical immediately + digest) and Socket.IO to the browser.',
      sections: [
        {
          heading: '6 Discrepancy Types',
          items: [
            '[●red] **no_show_in_cv** — order closed in 1C, but CV never saw the vehicle on site. Possible fake order or integration outage.',
            '[●yellow] **no_show_in_1c** — vehicle stayed on a post > N minutes with a worker, but no matching 1C order. Off-the-books work?',
            '[●yellow] **wrong_post** — 1C says "post 3", CV sees the vehicle on "post 7".',
            '[●yellow] **overstated_norm_hours** — norm hours **multiple times** more than actual on-post time (overstated).',
            '[●blue] **understated_actual_time** — actual on-post time noticeably exceeds norm (understated in 1C).',
            '[●blue] **time_mismatch** — 1C closing vs CV exit differ by more than the match window.',
          ],
        },
        {
          heading: 'KPIs and Filters',
          items: [
            'Top of the page — 5 KPI cards: Total, Open, Last 24h, Critical, Warning.',
            'Below KPIs — 6 type cards: clicking switches the **type=...** filter.',
            'Filters: status, severity, order number. **open** is the default.',
            'Sidebar badge (next to "Discrepancies") — **open** count + critical-in-24h, refreshed every 30 seconds.',
          ],
        },
        {
          heading: 'Lifecycle',
          items: [
            '[●yellow] **open** — detector just found the mismatch.',
            '[●blue] **acknowledged** — picked up for investigation (acknowledgedBy/At set).',
            '[●green] **resolved** — fixed (in 1C/CV/both); resolvedBy/At + closeReason/Comment.',
            '[●gray] **dismissed** — rejected as a false positive (e.g. manual reconciliation said OK).',
            'To return to **open** — "Reopen" button on the right (clears all ack/resolved fields).',
            'Duplicates collapse on the unique key `(type, orderNumber, postId, vehicleSessionId)` — re-detecting the same does not create a new row.',
          ],
        },
        {
          heading: 'Expanded Row (details)',
          items: [
            'Click the chevron on the left — opens a **two-pane**: 1C on the left, CV on the right.',
            'Left: number, state, plate, VIN, plan, closed, norm, executor — from the latest **OneCWorkOrderMerged** version.',
            'Right: plate, entry, exit from **VehicleSession**.',
            'If the discrepancy has a JSON in `oneCValue` / `cvValue` — it is shown raw for diagnostics.',
          ],
        },
        {
          heading: 'Notifications',
          items: [
            '[zap] **Critical** — Telegram message immediately (broadcast to the chat).',
            '[zap] **Digest** — every N hours (default 4h): summary with top-3 posts and severity breakdown. Controlled by env **DISCREPANCY_DIGEST_DISABLED=1**.',
            '[zap] **Socket.IO** — `discrepancy:new` event is pushed to the browser; sidebar badge updates without reload.',
            '[zap] **"Discrepancies" toggle in headers** of Dashboard/MapViewer/PostsDetail/MyPost/DashboardPosts adds red dots on posts with open discrepancies — state is stored in `User.uiState.showDiscrepancies`.',
          ],
        },
        {
          heading: '"Refresh" vs "Recompute"',
          items: [
            '**Refresh** (inside the filter bar) — re-fetches the table from the server WITHOUT running the detector. Just a fresh snapshot of the existing Discrepancy rows.',
            '**Recompute** (blue button in the header) — runs **discrepancyDetector** in background: 6 rules across all merged orders + orphan PostStay for the chosen window (7 days by default), upserts Discrepancy rows. Heavy on 1500+ orders, so it is async: spinner spins, a toast arrives on completion with processed/new counts.',
            '**Auto-recompute** — gear icon next to the button: schedule (default **08:00 Europe/Minsk**, daily), timezone, analysis window. Can be temporarily disabled.',
            'The last-run timestamp is shown left of the button ("2 h ago · 18s · +12"). Colour: green = ok, red = error, blue spinner = running.',
          ],
        },
        {
          heading: 'Permissions',
          items: [
            '**view_1c** — read list, details, stats, see the auto-run schedule.',
            '**manage_discrepancies** — change status (acknowledge/resolve/dismiss/reopen), click "Recompute", edit the auto-run schedule.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Morning review** — open the page, filter by **critical+open**, for each row decide: ack → investigate, or dismiss.',
            '[ok] **Off-the-books work** — spotted **no_show_in_1c** → registered an order in 1C → resolve with the comment "filed post-hoc".',
            '[ok] **False alarm** — critical **no_show_in_cv** → checked: customer indeed did not show, but the master forgot to cancel the order → resolve with reason `wrong_state_in_1c`.',
            '[ok] **After fixing 1C** — click "Recompute" → the discrepancy auto-closes (rule no longer fires) or stays — meaning the fix did not help.',
          ],
        },
      ],
    },
  },

  // ────────────────────────────
  // СОПОСТАВЛЕНИЯ (ЗН ↔ Заявки 1С и др.)
  // ────────────────────────────
  orderMatching: {
    ru: {
      title: 'Сопоставления',
      tabOrder: ['overview', 'zn_plan', 'closed_zn_orders', 'closed_zn_cv', 'payroll'],
      tabs: {
        overview: {
          label: 'Страница в целом',
          intro: 'Страница «Сопоставления» — единая точка входа для разных типов сопоставлений в данных 1С. Внутри неё 4 вкладки, каждая решает свою задачу. Источники данных у всех вкладок — обработанные таблицы для интерфейса (планы, заказ-наряды и закрытые ЗН с устранёнными дубликатами), а не сырые письма из 1С. Это гарантирует, что сводки совпадают с тем, что видно во вкладках «Данные 1С → Планы / Заказ-наряды / Закрытые ЗН».',
          sections: [
            {
              heading: '4 вкладки (типы сопоставлений)',
              items: [
                '[●purple] **ЗН ↔ Заявки** — основное актуальное сопоставление: для каждого заказ-наряда из 1С (последняя версия) ищется заявка/план, чей текст документа совпадает с основанием ЗН. Показывает связь и рассинхрон фактических/плановых моментов времени.',
                '[●purple] **Закр. ЗН ↔ Заказ-наряды и Заявки** — берём закрытые ЗН (последняя версия из «выполнено») и сравниваем 4 длительности: Δплан, Δуточн, Δфакт и Δзакр.−факт против нормочасов. Цель — поймать переработки и недоработки.',
                '[●gray] **Закр. ЗН ↔ Камеры** *(скоро)* — закрытые ЗН против записей о визитах и стоянок на постах: было ли авто действительно на посту в нужное время.',
                '[●gray] **Выработка** *(скоро)* — сводка по нормочасам и фактическому времени за период с разбивкой по исполнителям.',
                'Заглушки помечены значком «скоро» и приглушены — клик переключает вкладку, но внутри пока заготовка.',
              ],
            },
            {
              heading: 'Общая раскладка экрана',
              items: [
                '[eye] **Шапка** — название «Сопоставления» + горизонтальная панель вкладок (4 штуки) + кнопка «Помощь» справа.',
                '[eye] **Полоса KPI-меток** — счётчики и одновременно фильтры (клик включает/выключает критерий). Активный — фиолетовый с лёгким свечением.',
                '[eye] **Полоса фильтров** — стеклянная панель: поиск, тематические переключатели, кнопка «Сбросить».',
                '[eye] **Таблица** — главная область, сразу под фильтрами. У каждой вкладки своя структура колонок.',
                '[eye] **Подвал таблицы** — счётчик строк + пагинация с выбором размера страницы (25 / 50 / 100, по умолчанию 50).',
              ],
            },
            {
              heading: 'Связи между вкладками',
              items: [
                '[click] **№ ЗН** в «Закр. ЗН ↔ Заказ-наряды и Заявки» кликабельный (синий, подчёркивается при наведении) — клик переключает на «ЗН ↔ Заявки», подставляет номер в поиск и подсвечивает нужную строку фиолетовым фоном на 2.5 секунды.',
                '[ok] Можно вернуться обратно (Сбросить → нажать кнопку «Закр. ЗН»). Состояние фильтров каждой вкладки независимо.',
              ],
            },
            {
              heading: 'Дизайн и поведение',
              items: [
                '[eye] Все панели (KPI, фильтры, таблица, заглушки) — стилистика «стекло»: полупрозрачный фон, размытие, мягкая тень.',
                '[eye] Иконки единого стиля, без эмодзи.',
                '[eye] Заглушка «н/д» подставляется на месте пустых значений серым с пониженной прозрачностью, чтобы не сливаться с типографским минусом «−» в Δ-подсказках.',
                '[ok] Право доступа: «Просмотр данных 1С». Управления здесь нет — только чтение.',
              ],
            },
          ],
        },
        zn_plan: {
          label: 'ЗН ↔ Заявки',
          intro: 'Основное актуальное сопоставление: заказ-наряды 1С (с устранёнными дубликатами) связываются с актуальными заявками/планами через строгое равенство основания ЗН и текста документа заявки. Дальше всё (метка связи, важность моментов и Δ длительностей) — производные метрики.',
          sections: [
            {
              heading: 'KPI-метки — счётчик + фильтр',
              items: [
                '[●gray] **Всего ЗН** — общее число ЗН без дубликатов. Клик сбрасывает KPI-фильтры (но не поиск/состояние/важность).',
                '[●green] **Сопоставлено** — основание нашло соответствующий текст документа в заявке. Клик добавляет фильтр «сопоставлено».',
                '[●gray] **Без основания** — поле основания пустое. Клик включает фильтр «без основания».',
                '[●red] **Основание не найдено** — основание заполнено, но среди актуальных заявок ничего похожего. **Критичный** случай.',
                '[●orange] **Существенные расхождения** — ЗН, у которых хотя бы одно отклонение времени попадает в оранжевый или красный диапазон.',
              ],
            },
            {
              heading: 'Метки связи (колонка «Связь»)',
              items: [
                '[●green] **Совпадает** — основание найдено в заявках, VIN/госномер тоже сходятся (либо у заявки нет авто).',
                '[●yellow] **Авто не совпадает** — основание найдено, но авто в заявке не совпадает с авто в ЗН.',
                '[●gray] **Без основания** — поле основания пустое в данных 1С.',
                '[●red] **Основание не найдено** — основание заполнено, но среди заявок ничего похожего нет.',
              ],
            },
            {
              heading: 'Колонки «Начало» и «Окончание» — три уровня времени',
              items: [
                'Каждая ячейка показывает три горизонтальные строки одного момента (старта работ или их окончания):',
                '**ПЛАН** — изначально запланированное в плане/заявке 1С. Базовая линия, подсветки нет.',
                '**УТОЧН.** — уточнение основания (начало/окончание по основанию). Подсветка по разнице с ПЛАНом.',
                '**ФАКТ** — фактическое время из заказ-наряда. Подсветка по разнице с УТОЧН.',
                '[●gray] «н/д» — данных нет (например, ЗН ещё открыт — нет факта окончания).',
              ],
            },
            {
              heading: 'Шкала важности (моменты времени)',
              items: [
                'Подсветка строки УТОЧН/ФАКТ отражает абсолютную разницу относительно базовой линии:',
                '[●gray] **Серый** — <15м или сравнивать не с чем.',
                '[●yellow] **Жёлтый** — 15м … 1ч.',
                '[●orange] **Оранжевый** — 1ч … 4ч.',
                '[●red] **Красный** — >4ч.',
                'Фильтр «Мин. отклонение» отсекает строки слабее выбранного порога.',
              ],
            },
            {
              heading: 'Колонки «Δ план» и «Δ уточн.» — длительности',
              items: [
                'Δ план = (факт. длительность ЗН) − (плановая длительность из заявки).',
                'Δ уточн. = (факт. длительность ЗН) − (уточнённая длительность).',
                'Знак: «+» дольше плана, «−» короче, «±0» — точно. Минус — типографский «−», чтобы не путать с «н/д».',
                'Под цифрой — подсказка «факт Xч Yм − план Aч Bм».',
                'Цвет фона — та же шкала важности, но применяется к разнице длительностей.',
              ],
            },
            {
              heading: 'Сортировка по столбцам',
              items: [
                '[click] Заголовок столбца с иконкой ↕ — кликабельный. Активное направление: ↑ (по возрастанию) или ↓ (по убыванию), фиолетовый цвет.',
                'Сортируемые: **№ ЗН**, **Состояние**, **Связь**, **Начало**, **Окончание**, **Δ план**, **Δ уточн.**, **Мастер**, **Диспетчер**.',
                '**По умолчанию: Окончание ↓** — самая новая дата окончания сверху, с каскадом **факт → уточн → план**.',
                'Колонки «Начало» / «Окончание» используют тот же каскад.',
                'Смена сортировки автоматически сбрасывает страницу на 1.',
              ],
            },
            {
              heading: 'Раскрытие строки (история версий)',
              items: [
                'Шеврон ▶ слева есть только у ЗН, у которых **больше одной версии**. Развёрнутая панель показывает таблицу версий: только те колонки, у которых значения различаются.',
                'Последняя версия подсвечена фиолетовым с меткой «АКТУАЛЬНАЯ».',
                '[ok] Зачем смотреть — отследить, в какой версии появилось/исчезло поле основания, изменился пост, переписали госномер.',
              ],
            },
            {
              heading: 'Фильтры и пагинация',
              items: [
                '**Поиск** — подстрочный по ВИН, госномеру, № ЗН, тексту основания, мастеру. Регистр игнорируется.',
                '**Мин. отклонение** — отсекает строки слабее выбранного порога.',
                '**Состояние** — мульти-чипы из реальных состояний в текущей выборке.',
                '**Сбросить** — очищает все фильтры.',
                '**Пагинация** внизу: 25 / 50 / 100 строк на странице (по умолчанию 50).',
              ],
            },
            {
              heading: 'Источник данных',
              items: [
                '**Источник:** актуальные строки заказ-нарядов и заявок из 1С (с устранёнными дубликатами).',
                '**Алгоритм:** строгое равенство основания ЗН и текста документа заявки. Никакого нечёткого сопоставления.',
                '**Важность** считается на сервере. Пороги моментов: ≤15м зелёный, ≤1ч жёлтый, ≤4ч оранжевый, >4ч красный.',
                '**Право доступа:** «Просмотр данных 1С».',
              ],
            },
            {
              heading: 'Подводные камни',
              items: [
                '[warn] Сопоставление строго по строковому равенству. Один лишний неразрывный пробел в 1С → «основание не найдено».',
                '[warn] Авто в заявке и в ЗН сравниваются эвристически — возможна ложная пометка «авто не совпадает».',
                '[warn] «Актуальной» версией считается строка с самой свежей датой получения письма, а не датой начала работ. При задержке писем порядок может прыгнуть.',
                '[warn] Страница не подписана на мгновенные обновления — данные обновляются при смене фильтра/перезаходе.',
              ],
            },
          ],
        },
        closed_zn_orders: {
          label: 'Закр. ЗН ↔ Заказ-наряды и Заявки',
          intro: 'База — закрытые ЗН (последняя версия из «выполнено»). По номеру ЗН подтягиваются: из заказ-нарядов 1С — фактические метки начала/окончания работ; из заявок (через основание) — план и уточнение. Цель — сравнить 4 длительности (план / уточн / факт / закр.−старт) с нормочасами и поймать переработки/недоработки.',
          sections: [
            {
              heading: 'KPI-метки',
              items: [
                '[●gray] **Всего закрытых ЗН** — общее число строк после устранения дубликатов «выполнено».',
                '[●red] **Расхождение >30%** — кликабельный фильтр. Включает только строки, где |Δфакт − нормочасы| / нормочасы > 30%.',
                '[●orange] **Превышение нормы** — переработка (Δфакт > нормочасы·1.3).',
                '[●green] **Экономия нормы** — недоработка (Δфакт < нормочасы·0.7).',
                '[●gray] **Без нормочасов** — нормочасы не указаны, для таких строк подсветка отключена.',
              ],
            },
            {
              heading: '7 колонок (в порядке слева направо)',
              items: [
                '**№ ЗН** — номер закрытого ЗН (формат КОЛ…). [click] **Кликабельный**: переход на вкладку «ЗН ↔ Заявки» с автофильтрацией по этому номеру и подсветкой строки. Синий цвет, подчёркивается при наведении.',
                '**Закрыт** — время закрытия из «выполнено».',
                '[●purple] **Нормочасы** *(фиолетовый фон)* — из «выполнено», эталон для сравнения. Отображаются в часах с десятыми (например, 3.5ч).',
                '[●blue] **Δ план** *(голубой фон)* — окончание плана минус начало плана (длительность плана). Берётся через основание ЗН в актуальных заявках.',
                '[●yellow] **Δ уточн.** *(янтарный фон)* — окончание по основанию минус начало по основанию (уточнённая длительность из ЗН).',
                '[●green] **Δ факт** *(зелёный фон)* — времени окончания работ минус времени начала. Это основа для сравнения с нормочасами.',
                '[●pink] **Δ закр.−факт** *(розовый фон)* — времени закрытия минус времени окончания работ. Лаг между «закончил работать» и «закрыл наряд» — время оформления документов в 1С.',
              ],
            },
            {
              heading: 'Подсветка строк (расхождение с нормой)',
              items: [
                'Логика: если |Δфакт − нормочасы| / нормочасы > 30% — строка подсвечивается.',
                '[●red] **Левая красная полоса + бледно-красный фон** — расхождение есть.',
                'В ячейке Δфакт значение становится **красным жирным**, под ним появляется мини-метка с процентом и направлением:',
                '[●red] **↑ +NN%** — переработка (Δфакт > нормы).',
                '[●green] **↓ −NN%** — экономия (Δфакт < нормы).',
                'Подсветка отключена, если нормочасы пустые или ноль — для таких строк метки нет.',
                'Порог 30% задан на сервере и возвращается клиенту в ответе.',
              ],
            },
            {
              heading: 'Фильтры и пагинация',
              items: [
                '**Поиск** — подстрочный по № ЗН, ВИН, госномеру, мастеру, исполнителю, описанию причины. Регистр игнорируется.',
                '**Только расхождение >30%** — переключатель и одновременно KPI-метка «Расхождение >30%». Это один и тот же фильтр.',
                '**Сбросить** — очищает поиск и переключатель.',
                '**Пагинация** внизу: 25 / 50 / 100 строк (по умолчанию 50).',
              ],
            },
            {
              heading: 'Цветовая семантика колонок',
              items: [
                'Фон у Δ-колонок и нормочасов — **жёсткие цвета**, НЕ зависят от важности:',
                '[●purple] **Фиолетовый** — нормочасы (эталон).',
                '[●blue] **Голубой** — Δплан.',
                '[●yellow] **Янтарный** — Δуточн.',
                '[●green] **Зелёный** — Δфакт.',
                '[●pink] **Розовый** — Δзакр.−факт.',
                'Цвет помогает мгновенно отличить семантику числа: рядом стоящие «5.2ч» в разных колонках читаются по-разному.',
              ],
            },
            {
              heading: 'Источник данных',
              items: [
                '**Источник:** актуальные строки «выполнено» (база) плюс заказ-наряды (фактические начало/окончание, основание) и заявки (длительность плана через основание).',
                'Сначала строится карта последних версий «выполнено» по номеру заказа. К каждой подтягивается последняя версия заказ-наряда и группа строк плана по основанию.',
                'Длительности считаются как (конец − начало) в секундах, в интерфейсе преобразуются в часы.',
                '**Право доступа:** «Просмотр данных 1С».',
              ],
            },
            {
              heading: 'Подводные камни',
              items: [
                '[warn] Если у ЗН нет снимка заказ-наряда (бывает, если письмо ещё не пришло) — Δплан/Δуточн/Δфакт будут «н/д». В строке отображается только нормочасы и Δзакр (закрытие у «выполнено» своё).',
                '[warn] Δфакт считается по времени начала и окончания работ из снимка заказ-наряда, не из «выполнено». Они могут отличаться (1С иногда пишет в одно поле, иногда в другое).',
                '[warn] Если факт окончание пустое или нулевое, расчёт расхождения не выполняется и строка не подсвечивается, даже если переработка реальна.',
                '[warn] Порог 30% — единое значение для всех. Маленькие ЗН на 0.5ч с расхождением 0.2ч (40%) подсветятся; крупные на 8ч с расхождением 2ч (25%) — нет. При необходимости можно вынести в настройки.',
              ],
            },
          ],
        },
        closed_zn_cv: {
          label: 'Закр. ЗН ↔ Камеры',
          intro: 'Вкладка в разработке. Планируемый сценарий: для каждого закрытого ЗН проверять, было ли авто действительно на нужном посту в окне «начало работ … закрытие», опираясь на данные компьютерного зрения (запись о визите и стоянки на постах).',
          sections: [
            {
              heading: 'Что будет показано',
              items: [
                '**№ ЗН** + **авто** + **пост** (заявленный мастером) — слева как идентификация.',
                '**Окно работ из 1С** (от времени начала работ до закрытия) — серая полоска.',
                '**Окно по камерам** (запись о визите этого авто) — цветная полоска поверх: зелёная если попало в нужный пост, оранжевая если в другой, красная если авто вообще не наблюдалось.',
                '**Совпадение по пост-минутам** — доля времени из заявленного окна, когда камеры видели авто на нужном посту.',
              ],
            },
            {
              heading: 'Зачем это нужно',
              items: [
                '[ok] Поймать «бумажные» закрытия — мастер закрыл ЗН, но авто на посту не было.',
                '[ok] Поймать перенос работ с поста на пост, не отражённый в 1С.',
                '[ok] Найти разрывы (авто уехало в середине работ) — возможный знак, что работы не проводились в полном объёме.',
              ],
            },
            {
              heading: 'Зависимости (что нужно для запуска)',
              items: [
                '[warn] Связь авто из 1С (текст авто, номер, VIN) с данными камер (номер из записи о визите). Сейчас связь делается эвристически — нужно перевести на данные без дубликатов.',
                '[warn] Назначение поста ЗН — пока в 1С пост хранится текстом, требуется справочник постов.',
                '[warn] История от камер по дате — уже есть, но индексация по дате нуждается в кэше для быстрых запросов.',
              ],
            },
          ],
        },
        payroll: {
          label: 'Выработка',
          intro: 'Вкладка в разработке. Планируемая сводка по нормочасам и фактическому времени за период с разбивкой по исполнителям. Сейчас аналогичная информация частично доступна в вкладке «Данные 1С → Выработка».',
          sections: [
            {
              heading: 'Что будет показано',
              items: [
                '**Исполнитель** — ФИО исполнителя из «выполнено».',
                '**Закрытых ЗН** за период.',
                '**Сумма нормочасов** — сумма нормочасов.',
                '**Сумма Δфакт** — сумма факт-длительностей.',
                '**Эффективность** = норма / факт (≈100% — точно по норме, >100% — переработка, <100% — экономия).',
                'Разбивка по типам работ (ТО / Ремонт / Диагностика) — гистограмма внутри строки.',
              ],
            },
            {
              heading: 'Период и фильтры',
              items: [
                '**Период** — диапазон дат закрытия (день / неделя / месяц / произвольный).',
                '**Поиск** — по ФИО исполнителя.',
                '**Сортировка** по нормочасам / эффективности / числу ЗН.',
                'Экспорт XLSX/PDF — как на странице «Аналитика».',
              ],
            },
            {
              heading: 'Зачем нужно',
              items: [
                '[ok] Расчёт зарплаты сдельщикам по нормочасам.',
                '[ok] Выявление систематической переработки (риск выгорания) или экономии (риск завышенных норм).',
                '[ok] Сравнение исполнителей за равный период.',
              ],
            },
          ],
        },
      },
    },
    en: {
      title: 'Matching',
      tabOrder: ['overview', 'zn_plan', 'closed_zn_orders', 'closed_zn_cv', 'payroll'],
      tabs: {
        overview: {
          label: 'Page overview',
          intro: 'The "Matching" page is a single entry point for several kinds of 1C-data matching. It hosts 4 tabs, each solving a specific task. The data sources are the deduplicated UI-grade tables (`OneCPlanRow`, `OneCRepairSnapshot`, `OneCWorkPerformed`), not raw emails — so the summaries always match what is shown under "1C Data → Plans / Work Orders / Closed WOs".',
          sections: [
            {
              heading: '4 tabs (matching kinds)',
              items: [
                '[●purple] **WO ↔ Plans** — main current matching: for every 1C work order (latest version) find a plan/request whose `documentText` equals the WO `basis`. Shows the link and time drift.',
                '[●purple] **Closed WO ↔ Orders & Plans** — take closed WOs (latest `OneCWorkPerformed`) and compare 4 durations (Δplan, Δrefined, Δfact, Δclosed−start) against norm-hours.',
                '[●gray] **Closed WO ↔ CV** *(soon)* — closed WOs vs `VehicleSession` / `PostStay`: was the car actually at the claimed post at the claimed time?',
                '[●gray] **Payroll** *(soon)* — norm-hours vs actual time per worker over a period.',
                'Stub tabs carry a "soon" badge and are dimmed — clicking switches the tab, but the body is a placeholder.',
              ],
            },
            {
              heading: 'Screen layout (common)',
              items: [
                '[eye] **Header** — "Matching" title + horizontal tab bar (4 tabs) + Help button.',
                '[eye] **KPI chip row** — both counters and filters (click toggles the criterion). Active chip — purple glow.',
                '[eye] **Filter bar** — glass panel: search, topic-specific toggles, Reset button.',
                '[eye] **Table** — main area; each tab has its own column layout.',
                '[eye] **Table footer** — row counter + pagination with page-size selector (25 / 50 / 100, default 50).',
              ],
            },
            {
              heading: 'Cross-tab links',
              items: [
                '[click] **WO #** in "Closed WO ↔ Orders & Plans" is clickable (blue, underlined on hover) — opens "WO ↔ Plans", populates the search field with the number and highlights the row with a purple background for 2.5s.',
                '[ok] Use the Reset button to come back. Each tab keeps its own filter state.',
              ],
            },
            {
              heading: 'Design & behaviour',
              items: [
                '[eye] All panels (KPI, filters, table, placeholders) are styled as "glass": translucent background (`--bg-glass`), `backdrop-blur`, soft shadow.',
                '[eye] Lucide React icons only, no emoji.',
                '[eye] "n/a" placeholder for empty values — muted grey with reduced opacity to avoid blending with the typographic minus "−" in Δ-hints.',
                '[ok] Permission: `view_1c`. No management actions here — read only.',
              ],
            },
          ],
        },
        zn_plan: {
          label: 'WO ↔ Plans',
          intro: 'The main current matching: deduplicated 1C work orders are linked to current plans/requests via strict equality `repair.basis === plan.documentText`. Everything else (link badge, moment severity, duration deltas) is derived.',
          sections: [
            {
              heading: 'KPI chips — counters + filters',
              items: [
                '[●gray] **Total WOs** — total deduplicated WOs. Click resets KPI filters.',
                '[●green] **Matched** — basis found a corresponding documentText. Toggles `matchStatus=matched`.',
                '[●gray] **No basis** — empty basis. Toggles `no_basis`.',
                '[●red] **Basis not found** — basis is set, no current plan matches. **Critical** case.',
                '[●orange] **Significant deltas** — WOs with at least one time delta in `orange` or `red`.',
              ],
            },
            {
              heading: 'Link badges ("Link" column)',
              items: [
                '[●green] **matched** — basis found, plate/VIN also align (or plan has no vehicle).',
                '[●yellow] **vehicle mismatch** — basis found, but the plan vehicle differs from the WO vehicle.',
                '[●gray] **no basis** — basis field is empty in 1C.',
                '[●red] **basis not found** — basis is set but no current plan has it.',
              ],
            },
            {
              heading: '"Start" / "End" columns — three time levels',
              items: [
                'Each cell shows three rows of the same moment:',
                '**PLAN** — original planned time. Baseline, no highlight.',
                '**REFINED** — basis refinement (`basisStart` / `basisEnd`). Highlighted vs PLAN.',
                '**ACTUAL** — actual from the work order. Highlighted vs REFINED.',
                '[●gray] "n/a" — data missing (e.g. WO is still in progress, no actual end yet).',
              ],
            },
            {
              heading: 'Severity scale (moments)',
              items: [
                '[●gray] **Grey** — <15min or nothing to compare.',
                '[●yellow] **Yellow** — 15min … 1h.',
                '[●orange] **Orange** — 1h … 4h.',
                '[●red] **Red** — >4h.',
                'The "Min severity" filter removes rows weaker than the threshold.',
              ],
            },
            {
              heading: '"Δ plan" / "Δ refined" — durations',
              items: [
                'Δ plan = (actual WO duration) − (plan duration).',
                'Δ refined = (actual WO duration) − (refined duration).',
                'Sign: "+" longer, "−" shorter, "±0" exact. Typographic minus "−" — never to be confused with "n/a".',
                'Tiny hint below: "fact Xh Ym − plan Ah Bm".',
                'Background — same severity scale, applied to the duration delta.',
              ],
            },
            {
              heading: 'Column sorting',
              items: [
                '[click] Column headers with the ↕ icon are clickable. Active direction: ↑ (asc) / ↓ (desc), purple colour.',
                'Sortable: **WO #**, **State**, **Link**, **Start**, **End**, **Δ plan**, **Δ refined**, **Master**, **Dispatcher**.',
                '**Default: End ↓** — newest end-date first, with the cascade **fact → refined → plan**.',
                '"Start" / "End" columns use the same cascade (sortBy=startAny / endAny on the backend).',
                'Changing sort resets to page 1.',
              ],
            },
            {
              heading: 'Row expansion (version history)',
              items: [
                'A chevron ▶ appears only when the WO has more than one version. The expanded panel shows a version table — only columns whose values differ are visible.',
                'Latest version — purple background + "LATEST" tag.',
                '[ok] Why look — to track in which 1C version the basis appeared/disappeared, the post changed, or the plate was rewritten.',
              ],
            },
            {
              heading: 'Filters & pagination',
              items: [
                '**Search** — substring across VIN, plate, WO #, basis, master. Case-insensitive.',
                '**Min severity** — drops rows weaker than the chosen threshold.',
                '**State** — multi-select chips from the actual WO states in the current selection.',
                '**Reset** — clears all filters.',
                '**Pagination** at the bottom: 25 / 50 / 100 rows per page (default 50).',
              ],
            },
            {
              heading: 'Data source & API',
              items: [
                '**Request:** `GET /api/oneC/matching?take=...&skip=...&q=...&matchStatus=...&minSeverity=...&state=...&sortBy=...&sortDir=...`',
                '**Backend:** `routes/oneCMatching.js` → deduplicated rows via `oneCDeduped.getDedupedRepairRows()` + `getDedupedPlanRows()`.',
                '**Algorithm:** strict equality `repair.basis === plan.documentText`. No fuzzy.',
                '**Moment severity** thresholds: ≤15m green, ≤1h yellow, ≤4h orange, >4h red.',
                '**Permission:** `view_1c`.',
              ],
            },
            {
              heading: 'Caveats',
              items: [
                '[warn] Strict string equality. A stray non-breaking space in 1C → `basis_not_found`.',
                '[warn] Plan vs WO vehicle is compared heuristically — false `vehicle mismatch` is possible.',
                '[warn] "Latest" = max `receivedAt`, not max `workStartedAt`. Out-of-order mail can flip the order.',
                '[warn] No Socket.IO subscription — refresh on filter change or reload only.',
              ],
            },
          ],
        },
        closed_zn_orders: {
          label: 'Closed WO ↔ Orders & Plans',
          intro: 'Base: closed WOs (the latest `OneCWorkPerformed` version). For each WO number we pull actual start/end work marks from repair snapshots and plan/refined intervals (via `basis`) from plan rows. The goal: compare 4 durations (plan / refined / fact / closed−start) against norm hours and catch overruns and underruns.',
          sections: [
            {
              heading: 'KPI chips',
              items: [
                '[●gray] **Closed WOs** — total rows after performed dedupe.',
                '[●red] **Mismatch >30%** — clickable filter. Shows rows where `|Δfact − norm·3600| / norm·3600 > 30%`.',
                '[●orange] **Over norm** — overrun (Δfact > norm·1.3).',
                '[●green] **Under norm** — saved (Δfact < norm·0.7).',
                '[●gray] **No norm hours** — `norm_hours` is empty; row highlighting is disabled for them.',
              ],
            },
            {
              heading: '7 columns (left to right)',
              items: [
                '**WO #** — closed WO number (e.g. `КОЛ…`). [click] **Clickable**: opens "WO ↔ Plans" with auto-filter by this number and 2.5s row highlight. Blue colour, underlined on hover.',
                '**Closed** — `closedAt` from performed.',
                '[●purple] **Norm hours** *(violet bg)* — from performed (`norm_hours`), the reference for comparison. Shown in hours with decimals (`3.5ч`).',
                '[●blue] **Δ plan** *(sky bg)* — planEnd − planStart (plan duration). Looked up by the WO `basis`.',
                '[●yellow] **Δ refined** *(amber bg)* — basisEnd − basisStart (refined duration from the repair snapshot).',
                '[●green] **Δ fact** *(emerald bg)* — workFinishedAt − workStartedAt. This is the value compared against norm.',
                '[●pink] **Δ closed−start** *(pink bg)* — closedAt − workStartedAt. Usually longer than Δfact — paperwork between "stopped working" and "closed the WO".',
              ],
            },
            {
              heading: 'Row highlight (mismatch vs norm)',
              items: [
                'Rule: if `|Δfact − norm·3600| / norm·3600 > 30%` — the row is highlighted.',
                '[●red] **Left red bar 3px + pale red row background** — mismatch.',
                'In the Δfact cell the value becomes **red and bold**, with a small badge underneath:',
                '[●red] **↑ +NN%** — overrun (Δfact > norm).',
                '[●green] **↓ −NN%** — saved (Δfact < norm).',
                'Highlight is disabled when `norm_hours` is empty or zero.',
                'Threshold 30% lives on the backend as `NORM_MISMATCH_THRESHOLD = 0.3` and is returned to the client (`threshold`).',
              ],
            },
            {
              heading: 'Filters & pagination',
              items: [
                '**Search** — substring across WO #, VIN, plate, master, executor, cause description.',
                '**Mismatch >30% only** — both the ChipToggle and the KPI chip drive the same filter.',
                '**Reset** — clears the search and toggle.',
                '**Pagination**: 25 / 50 / 100 (default 50).',
              ],
            },
            {
              heading: 'Column colour semantics',
              items: [
                'Δ-columns and norm hours use **hard colours**, NOT severity-driven:',
                '[●purple] **Violet** — norm hours (reference).',
                '[●blue] **Sky** — Δ plan.',
                '[●yellow] **Amber** — Δ refined.',
                '[●green] **Emerald** — Δ fact.',
                '[●pink] **Pink** — Δ closed−start.',
                'Colour helps distinguish meaning instantly: "5.2h" reads differently in different columns.',
              ],
            },
            {
              heading: 'Data source & API',
              items: [
                '**Request:** `GET /api/oneC/matching/closed?take=...&skip=...&q=...&onlyMismatch=1`',
                '**Backend:** `routes/oneCMatching.js` → `getDedupedPerformedRows()` (base) + `getDedupedRepairRows()` (factStart/End, basis) + `getDedupedPlanRows()` (planSpan via basis).',
                'A latest-version map of performed by `orderNumber` is built first. Each row pulls the latest repair snapshot and a group of plan rows by basis.',
                'Durations = `(end − start)` in seconds, converted to hours on the UI.',
                '**Permission:** `view_1c`.',
              ],
            },
            {
              heading: 'Caveats',
              items: [
                '[warn] If a WO has no repair snapshot (e-mail not yet delivered) — Δplan/Δrefined/Δfact are "n/a". Only norm hours and Δclosed are shown.',
                '[warn] Δfact uses `workStartedAt` / `workFinishedAt` from the repair snapshot, not from performed. They may differ.',
                '[warn] If actual end is empty/zero, the ratio = (Δfact − norm)/norm cannot be computed and the row is not highlighted even if overrun is real.',
                '[warn] Threshold 30% is uniform. Small WOs of 0.5h with 0.2h delta (40%) are highlighted; large WOs of 8h with 2h delta (25%) are not. Could be moved into settings.',
              ],
            },
          ],
        },
        closed_zn_cv: {
          label: 'Closed WO ↔ CV',
          intro: 'Tab under development. Planned scenario: for every closed WO verify that the car was actually at the claimed post within `workStartedAt … closedAt`, using computer vision data (`VehicleSession` + `PostStay`).',
          sections: [
            {
              heading: 'What will be shown',
              items: [
                '**WO #** + **vehicle** + **post** (claimed by master) — left-hand identification.',
                '**Work window from 1C** (`workStartedAt … closedAt`) — grey bar.',
                '**CV window** (`VehicleSession` for this vehicle) — coloured bar over: green if it landed on the right post, orange if on a different one, red if not observed at all.',
                '**Post-minute overlap** — share of the claimed window where CV saw the car on the claimed post.',
              ],
            },
            {
              heading: 'Why needed',
              items: [
                '[ok] Catch "paper" closes — the master closed the WO but the car was never there.',
                '[ok] Catch unrecorded post-to-post moves.',
                '[ok] Find gaps (the car left mid-work) — possible sign that the work was not fully done.',
              ],
            },
            {
              heading: 'Dependencies',
              items: [
                '[warn] Linking 1C vehicles (`vehicleText`, `plate`, `vin`) to CV entities (`VehicleSession.plateNumber`). Currently heuristic in `oneCCvMatcher` — needs to switch to deduplicated data.',
                '[warn] Post assignment for the WO — post is stored as text in 1C, requires `PostNameMapping`.',
                '[warn] Date-indexed CV history — already available via `monitoringProxy` + `PostStay`, but needs caching for fast lookups.',
              ],
            },
          ],
        },
        payroll: {
          label: 'Payroll',
          intro: 'Tab under development. Planned summary of norm-hours vs actual time per worker over a period. Similar data is partially available via `/api/oneC/payroll` and the "1C Data → Payroll" tab.',
          sections: [
            {
              heading: 'What will be shown',
              items: [
                '**Worker** — name from performed (`executor`).',
                '**Closed WOs** for the period.',
                '**Total norm hours** — sum(`norm_hours`).',
                '**Total Δfact** — sum of fact durations.',
                '**Efficiency** = norm / fact (≈100% — on target, >100% — overrun, <100% — saved).',
                'Breakdown by work kind (Maintenance / Repair / Diagnostics) — inline histogram.',
              ],
            },
            {
              heading: 'Period and filters',
              items: [
                '**Period** — closedAt range (day / week / month / custom).',
                '**Search** by worker name.',
                '**Sort** by norm hours / efficiency / WO count.',
                'XLSX/PDF export — like on the "Analytics" page.',
              ],
            },
            {
              heading: 'Why needed',
              items: [
                '[ok] Piece-rate payroll calculation.',
                '[ok] Spot systematic overruns (burnout risk) or under-runs (over-set norms).',
                '[ok] Compare workers over an equal period.',
              ],
            },
          ],
        },
      },
    },
  },

  // ────────────────────────────
  // ПОЛЬЗОВАТЕЛИ
  // ────────────────────────────
  users: {
    ru: {
      title: 'Управление пользователями',
      intro: 'Полное управление учётными записями: создание/изменение/удаление, роли (5 типов), доступ к страницам (21 страница), точечное скрытие элементов интерфейса. Все изменения записываются в журнал аудита. Доступно только администраторам (защита от случайного блокирования системы).',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — поле поиска и кнопка «Добавить».',
            '[eye] **Центр** — таблица пользователей: имя, email, роль (метка), активность, количество страниц.',
            '[eye] **Модальное окно редактирования** — открывается по клику на строку: вкладки «Основное», «Страницы», «Элементы».',
            '[eye] **Нижняя строка модального окна** — кнопки «Сохранить» / «Отмена» / «Удалить».',
          ],
        },
        {
          heading: 'Роли пользователей',
          items: [
            '**Администратор** (фиолетовый) — полный доступ ко всем функциям и страницам.',
            '**Менеджер** (синий) — дашборд, ЗН, аналитика, посты, смены.',
            '**Директор** (серый) — только просмотр: дашборд, аналитика, отчёты.',
            '**Механик** (зелёный) — доступ к своему посту, ЗН.',
            '**Наблюдатель** (серый) — только дашборд, минимальные права.',
            'Роль определяет набор прав (15 видов) через связь «Роль → Право».',
          ],
        },
        {
          heading: 'Создание пользователя',
          items: [
            'Кнопка **«Добавить»** открывает форму создания.',
            'Обязательные поля: **email**, **имя**, **фамилия**, **роль**.',
            'Пароль по умолчанию: **demo123** (можно изменить).',
            '**Активен** — переключатель активности учётной записи.',
            'Неактивные пользователи не могут войти в систему.',
          ],
        },
        {
          heading: 'Доступ к страницам',
          items: [
            'Для каждого пользователя — набор **флажков страниц** (до 20 штук).',
            'Доступные разделы: Дашборд, Дашборд постов, Посты, Карта, Сессии, Заказ-наряды, События, Аналитика, Камеры, Данные 1С, Пользователи, Смены, Журнал аудита, Мой пост, Редактор карты, Здоровье, Расписание отчётов, Статистика работника, Live-отладка, Техническая документация.',
            'Кнопка **«Выбрать все»** — включить все страницы.',
            'Кнопка **«Сбросить»** — снять все галочки.',
            'Пользователь видит в боковом меню только разрешённые страницы.',
          ],
        },
        {
          heading: 'Видимость элементов',
          items: [
            '**Дерево элементов** — для каждой страницы можно скрыть отдельные элементы интерфейса.',
            'Пример: на странице Дашборд можно скрыть виджет «Прогнозы» или «Рекомендации».',
            'Настройка тонкозернистая — контролирует каждый блок на странице.',
            'Скрытые элементы не отрисовываются на клиенте (проверка прав на стороне фронтенда).',
          ],
        },
        {
          heading: 'Редактирование и удаление',
          items: [
            'Клик по строке пользователя — открытие формы редактирования.',
            'Можно изменить: имя, фамилию, email, роль, пароль, активность, страницы.',
            '**Нельзя удалить администратора** — защита от блокировки системы.',
            'При редактировании **себя** — изменения применяются немедленно (перезагрузка не нужна).',
            'Все изменения записываются в **журнал аудита**.',
          ],
        },
        {
          heading: 'Таблица пользователей',
          items: [
            'Колонки: имя, email, роль (цветная метка), активность, количество страниц.',
            'Поиск по имени или email.',
            'Неактивные пользователи отображаются бледным цветом.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Создать менеджера** — «Добавить» → email, имя, роль «Менеджер» → выбрать страницы (Дашборд, Посты, ЗН, Смены) → «Сохранить».',
            '[ok] **Перевести в директора** — клик по строке → роль «Директор» → автоматически сменился набор разрешений.',
            '[ok] **Скрыть пункт меню** — открыли пользователя → вкладка «Страницы» → сняли галку → пункт пропал из его меню.',
            '[ok] **Деактивация на отпуск** — клик → выключить «Активен» → пользователь не сможет войти, но данные сохранены.',
          ],
        },
      ],
    },
    en: {
      title: 'User Management',
      intro: 'Full account management: CRUD, roles (5 types), page access (21 pages), and fine-grained UI element hiding. All mutations are recorded in the Audit Log. Available only to users with the admin role (this protects against accidental system lockout).',
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
      intro: 'Календарь рабочих смен. 7-дневный обзор с цветной индикацией статусов («Запланирована», «Активна», «Завершена»). Назначение работников трёх ролей (механик / мастер / диагност) на посты. Автоматическая проверка конфликтов: один работник не может быть в двух сменах одновременно. Завершение смены формирует акт приёма-передачи.',
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
            '[●blue]{blue:Синий} — «Запланирована».',
            '[●green]{green:Зелёный} — «Активна» (идёт прямо сейчас).',
            '[●gray]{gray:Серый} — «Завершена».',
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
            '**Механик** — выполняет работы на посту.',
            '**Мастер** — контролирует работу, принимает авто.',
            '**Диагност** — проводит диагностику.',
            'Каждый работник привязывается к конкретному **посту**.',
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
            'Кнопка **«Завершить»** — переводит смену в статус «Завершена».',
            'Формируется **акт приёма-передачи**.',
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
      intro: 'Work shift calendar. A 7-day view with color-coded statuses (planned/active/completed). Assign workers in three roles (mechanic / master / diagnostician) to posts. Automatic conflict detection: one worker cannot be in two shifts simultaneously. Completing a shift generates a handover act.',
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
            '**Mechanic** — performs work at the post.',
            '**Master** — supervises the work and receives vehicles.',
            '**Diagnostician** — runs diagnostics.',
            'Each worker is assigned to a specific **post**.',
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
      title: 'Журнал аудита',
      intro: 'Полный журнал всех изменений данных в системе. Каждая запись хранит автора, IP, тип объекта, действие и сравнение «до» / «после». Хранение бессрочное. Фильтры и экспорт в CSV для отчётов и расследований. Только для администраторов.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — фильтры: текстовый поиск, действие, сущность, диапазон дат + кнопка «Экспорт CSV».',
            '[eye] **Центр** — таблица записей с цветными метками действий.',
            '[eye] **Развёртываемая строка** (клик на запись) — показывает сравнение значений «до» и «после».',
            '[eye] **Низ** — пагинация (25 / 50 / 100 на страницу).',
          ],
        },
        {
          heading: 'Фильтры',
          items: [
            '**Текстовый поиск** — поиск по имени пользователя, действию, сущности, IP-адресу.',
            '**Действие** — Создание / Изменение / Удаление.',
            '**Сущность** — пользователь, зона, пост, заказ-наряд, сессия, смена, камера, макет карты.',
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
            '**Действие** — цветная метка: зелёный (Создание), синий (Изменение), красный (Удаление).',
            '**Сущность** — тип объекта (пользователь, зона, пост и т.д.).',
            '**ID сущности** — идентификатор конкретного объекта.',
            '**IP-адрес** — откуда было выполнено действие.',
          ],
        },
        {
          heading: 'Детали изменения (развёртываемая строка)',
          items: [
            'Клик по строке — раскрывает **сравнение** значений «до» и «после» изменения.',
            'Для создания — показывает все созданные поля.',
            'Для изменения — показывает только **изменённые** поля с предыдущими значениями.',
            'Для удаления — показывает данные удалённого объекта.',
            'Изменённые поля визуально выделены.',
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
            'Все **изменения данных** в системе: создание, обновление и удаление записей.',
            'Запись делается автоматически и фоном — пользователь не видит задержки.',
            'Не записываются: чтение данных, вход в систему и обновление сессии.',
            'Хранение бессрочное — старые записи не удаляются.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Кто удалил пользователя?** — фильтр Действие = «Удаление» + Сущность = «пользователь» → нашли запись → видно автора и IP.',
            '[ok] **Что менялось вчера?** — диапазон дат «вчера» → «Экспорт CSV» → передали в отчёт.',
            '[ok] **Расследование инцидента** — поиск по конкретному ID → нашли все правки и хронологию.',
            '[ok] **Контроль администраторов** — фильтр по имени учётной записи администратора → проверка корректности действий.',
          ],
        },
      ],
    },
    en: {
      title: 'Audit Log',
      intro: 'A complete log of all mutations (POST/PUT/PATCH/DELETE) in the system. Each record stores the actor, IP, entity type, action, and a diff between "before" and "after". Stored indefinitely. Filters and CSV export for reports and investigations. Admin only.',
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
      intro: 'Простой и понятный экран для механика. Видно текущий ЗН, крупный таймер с полосой прогресса, обратный отсчёт до крайнего срока и большие сенсорные кнопки управления (Начать / Пауза / Продолжить / Завершить). Цвет таймера меняется по мере приближения и превышения нормы. Отключён в рабочем режиме (там механик использует внешние терминалы).',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — заголовок: «Пост N» и имя механика.',
            '[eye] **Центр** — карточка ЗН: номер, госномер крупно, марка/модель, тип работ, нормочасы.',
            '[eye] **Под карточкой** — большой таймер ЧЧ:ММ:СС и полоса прогресса.',
            '[eye] **Под таймером** — обратный отсчёт «Осталось / Просрочено».',
            '[eye] **Внизу** — крупные сенсорные кнопки управления (одна-две активны в зависимости от статуса).',
          ],
        },
        {
          heading: 'Информация о заказ-наряде',
          items: [
            '**Номер ЗН** — уникальный номер текущего заказ-наряда.',
            '**Госномер** — номер автомобиля крупным шрифтом.',
            '**Марка/Модель** — марка и модель автомобиля.',
            '**Тип работ** — вид обслуживания (ТО, ремонт, диагностика).',
            '**Нормочасы** — сколько времени отведено на работу по нормативу.',
            'Если ЗН не назначен — отображается сообщение «Нет активного ЗН».',
          ],
        },
        {
          heading: 'Таймер работы',
          items: [
            'Крупный таймер в формате **ЧЧ:ММ:СС** — прошедшее время работы.',
            '**Полоса прогресса** — визуальное заполнение от 0% до 100%+ относительно нормочасов.',
            'Цвет полосы прогресса меняется по уровням предупреждения.',
            '**Без предупреждения** (0-79%) — зелёный/синий прогресс.',
            '**Предупреждение** (80-94%) — жёлтый. Работа скоро должна быть завершена.',
            '**Критично** (95-99%) — оранжевый. Почти превышение нормы.',
            '**Превышение** (100%+) — красный. Работа идёт дольше нормы!',
          ],
        },
        {
          heading: 'Обратный отсчёт до дедлайна',
          items: [
            'Показывает сколько времени **осталось** до завершения по нормочасам.',
            'Формат: «Осталось: ХХ мин» или «Просрочено на: ХХ мин».',
            'При превышении нормы — текст становится красным.',
            'Учитывает время пауз — крайний срок сдвигается.',
          ],
        },
        {
          heading: 'Кнопки управления',
          items: [
            '**Начать** — запустить работу по ЗН. Доступна для запланированных ЗН.',
            '**Пауза** — приостановить работу. Таймер останавливается, время паузы записывается.',
            '**Продолжить** — возобновить работу после паузы.',
            '**Завершить** — закончить работу. ЗН переходит в статус «Завершён».',
            'Кнопки **крупные** — оптимизированы для **сенсорного управления**.',
            'Одновременно доступна только одна кнопка (зависит от текущего статуса).',
          ],
        },
        {
          heading: 'Учёт пауз',
          items: [
            'Время пауз отслеживается отдельно.',
            'Пауза не влияет на общее прошедшее время, но учитывается в отчётах.',
            'Количество пауз записывается.',
            'Паузы видны в детализации ЗН.',
          ],
        },
        {
          heading: 'Ограничения',
          items: [
            'Страница **отключена в рабочем режиме**.',
            'Работает только если механику назначен пост через смену.',
            'Один механик — один пост — один ЗН одновременно.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Начало рабочего дня** — открыли страницу → видим ЗН → нажали «Начать» → таймер пошёл.',
            '[ok] **Перерыв** — «Пауза» → таймер замер → после возврата «Продолжить».',
            '[ok] **Завершение работы** — кнопка «Завершить» → ЗН перешёл в «Завершён» → автоматически подгружается следующий ЗН (если есть).',
            '[ok] **Сложная работа** — таймер стал жёлтым (80%) → если не успеваете, оповестите мастера → продолжайте, при превышении нормы цвет станет красным.',
          ],
        },
      ],
    },
    en: {
      title: 'My Post — Mechanic Screen',
      intro: 'A simple, clear screen for mechanics. Shows the current WO, a large timer with progress bar, a deadline countdown, and big touch-friendly control buttons (Start / Pause / Resume / Finish). The timer color changes as the deadline approaches and is exceeded. Disabled in live mode (mechanics use external terminals there).',
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
      intro: 'Технический мониторинг всех компонентов: сервер, база данных, синхронизация 1С, дисковое пространство, статус камер. Зелёный/жёлтый/красный индикатор для каждого блока. Автоматическое обновление каждые 30 секунд. Только для администраторов.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Верх** — крупный общий статус системы (зелёный/жёлтый/красный) и время непрерывной работы.',
            '[eye] **6 секций-карточек**: Сервер, База данных, Синхронизация 1С, Диск, Камеры, Дополнительно.',
            'Каждая секция со своим цветным индикатором.',
            '[eye] **Автоматическое обновление** работает в фоне, индикатор обновления — в углу.',
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
            '**Время работы** — продолжительность непрерывной работы сервера.',
            '**Версия среды выполнения** — текущая версия серверной платформы.',
            '**Использование памяти движка** — процент занятой оперативной памяти исполнителя кода.',
            '**Память процесса** — суммарная физическая память сервера в мегабайтах.',
            'Если использование памяти > 85% — возможна утечка, рекомендуется перезапуск.',
          ],
        },
        {
          heading: 'База данных',
          items: [
            '**Время отклика** — задержка ответа базы данных, миллисекунд.',
            '**Размер** — размер файла базы данных на диске.',
            'Нормальное время отклика — менее 10 мс.',
            'Если выше 100 мс — возможны проблемы с диском.',
          ],
        },
        {
          heading: 'Синхронизация 1С',
          items: [
            '**Статус** — «Активна» или «Не активна».',
            '**Последняя синхронизация** — дата и время последнего успешного импорта.',
            '**Количество записей** — сколько записей было импортировано.',
            'Если последняя синхронизация старше 24 часов — предупреждение.',
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
            '[●green]{green:Зелёный} — камера в сети, видеопоток доступен.',
            '[●red]{red:Красный} — камера в офлайне.',
            'Проверка статуса камер каждые **30 секунд**.',
            'Если камера в офлайне дольше 5 минут — формируется рекомендация администратору.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Утренняя проверка** — открыли страницу → пробежались по 6 блокам → все зелёные = можно работать.',
            '[ok] **Реакция на проблему** — память сервера > 85% → перезапустить сервер; диск > 80% — почистить журналы и старые файлы.',
            '[ok] **1С отвалилась** — последняя синхронизация старше 24 часов → проверьте настройки IMAP на странице «Данные 1С» и журнал импортов.',
            '[ok] **Камеры в офлайне** — посмотрели на этой странице сводку → перешли на «Камеры» для деталей.',
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
            '[eye] **Список расписаний** — карточки с названием, частотой, временем, статусом (активно/выключено), идентификатором чата и временем последнего запуска.',
            '[eye] **На каждой карточке:** кнопки **«Запустить сейчас»**, **«Редактировать»**, **«Удалить»** и переключатель активности.',
            '[eye] **Форма создания/редактирования** — модальное окно с полями: название, частота, день недели (для еженедельной), час, минуты, идентификатор чата.',
          ],
        },
        {
          heading: 'Создание расписания',
          items: [
            'Кнопка **«Добавить»** открывает форму создания.',
            '**Название** — произвольное имя для расписания.',
            '**Частота** — **ежедневно** или **еженедельно**.',
            'Для еженедельной: выбор **дня недели** (понедельник-воскресенье).',
            '**Час** (0-23) и **минуты** (0, 15, 30, 45) — время генерации.',
            '**Формат** — XLSX (единственный поддерживаемый).',
          ],
        },
        {
          heading: 'Telegram-доставка',
          items: [
            '**Идентификатор чата** — ID чата Telegram для отправки отчёта (необязательно).',
            'Если идентификатор чата указан — отчёт автоматически отправляется в Telegram.',
            'Используется Telegram Bot API.',
            'Бот должен быть добавлен в чат и иметь права на отправку файлов.',
          ],
        },
        {
          heading: 'Управление расписаниями',
          items: [
            '**Активно** — переключатель: включить/выключить расписание.',
            '**Редактирование** — клик по расписанию открывает форму.',
            '**Удаление** — кнопка удалить с подтверждением.',
            '**Последний запуск** — отметка времени последней успешной генерации.',
          ],
        },
        {
          heading: 'Запуск вручную',
          items: [
            'Кнопка **«Запустить сейчас»** — немедленная генерация отчёта.',
            'Отчёт скачивается в браузер как XLSX-файл.',
            'Не влияет на расписание — следующий автоматический запуск по плану.',
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
            'Планировщик отчётов работает по расписанию (внутренний планировщик).',
            'XLSX формируется серверным экспортом.',
            'Расписания хранятся в таблице расписаний в БД.',
            'Расписания формируются автоматически из настроек.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Ежедневный отчёт директору:** Добавить → ежедневно → 08:00 → идентификатор чата директора → Сохранить. Каждое утро отчёт за вчера приходит в Telegram.',
            '[ok] **Еженедельная сводка в группу:** еженедельно → понедельник → 09:00 → идентификатор чата группы → отчёт за неделю каждый понедельник.',
            '[ok] **Проверить настройки перед запуском по плану:** «Запустить сейчас» → проверить XLSX в браузере → если всё в порядке, оставить расписание включённым.',
            '[ok] **Временно отключить отчёты (отпуск, переезд):** переключатель **Активно** → выключить. Расписание сохранится, автоматический запуск остановится.',
            '[ok] **Узнать идентификатор чата для бота:** добавить бота в чат → отправить любое сообщение → посмотреть ID через @userinfobot.',
          ],
        },
      ],
    },
    en: {
      title: 'Report Schedule',
      intro: 'Automatic report generation and delivery on a schedule. Reports are built daily or weekly, exported to XLSX, and delivered to a Telegram chat — to a manager, group, or channel. Set it up once and every morning the report is waiting in your chat.',
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
      intro: 'Персональная аналитика по конкретному механику: сколько работал, что делал, насколько эффективен. Используется руководителем для оценки персонала, начисления премий, разбора нагрузки. Открывается из списка работников или главной страницы — в адресной строке имя выбранного работника.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Шапка** — имя работника, кнопка возврата, выбор периода (две даты).',
            '[eye] **KPI-полоса (4 карточки):** Всего ЗН | Нормочасы | Эффективность | Завершено.',
            '[eye] **Левый блок графиков:** Дневная выработка (столбцы «план» против «факт» по дням).',
            '[eye] **Правый блок графиков:** Типы ремонта (круговая) + Топ марок авто (столбчатая).',
            '[eye] **Низ страницы:** таблица последних ЗН со статусами и временем.',
          ],
        },
        {
          heading: 'Выбор периода',
          items: [
            'Два поля: **дата начала** и **дата окончания** периода анализа.',
            'По умолчанию: **текущий месяц** (с 1-го числа по сегодня).',
            'Все метрики пересчитываются при изменении периода.',
            'Данные подтягиваются с бэкенда системы.',
          ],
        },
        {
          heading: 'KPI-карточки (4 штуки)',
          items: [
            '**Всего ЗН** — общее количество заказ-нарядов за период.',
            '**Нормочасы** — суммарные нормочасы всех ЗН работника.',
            '**Средняя эффективность (%)** — соотношение фактического времени к нормативному.',
            '**Завершено** — количество ЗН в статусе «Завершён».',
            'Каждая карточка с иконкой и подсветкой.',
          ],
        },
        {
          heading: 'Графики',
          items: [
            '**Дневная выработка** — столбчатый график: нормочасы (план) против фактического времени за каждый день.',
            '**Типы ремонта** — круговая диаграмма распределения ЗН по видам работ.',
            '**Самые частые марки** — столбчатый график марок автомобилей.',
          ],
        },
        {
          heading: 'Таблица последних ЗН',
          items: [
            'Список последних заказ-нарядов работника.',
            'Колонки: номер ЗН, госномер, тип работ, нормочасы, факт, статус.',
            'Цветные метки статусов: зелёный (Завершён), синий (В работе), серый (Запланирован).',
            'Сортировка по дате — новые сверху.',
          ],
        },
        {
          heading: 'Интеграция с 1С',
          items: [
            'Данные дополняются информацией из 1С (если интеграция настроена).',
            'Если работник есть в 1С — дополнительные метрики: выручка, средний чек.',
            'Совпадение по имени работника.',
          ],
        },
        {
          heading: 'Доступ',
          items: [
            'Доступна менеджерам, директорам и администраторам.',
            'Ссылка на страницу обычно из списка работников или главной.',
            'Имя работника передаётся в адресной строке — позволяет делиться ссылкой на конкретного механика.',
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
      intro: 'Personal analytics for a specific mechanic: how much they worked, what they did, and how efficient they are. Used by managers to evaluate staff, calculate bonuses, and analyze workload. Opened from the worker list or dashboard — the URL carries a workerName param.',
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
            'List of the worker\'s recent work orders.',
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
      title: 'Отладка мониторинга',
      intro: 'Окно «под капот» рабочего режима для администраторов и интеграторов. Видны сырые данные от системы камер без обработки — что именно прислало распознавание, в каком порядке и с какими задержками. Используется при настройке камер, калибровке зон, разборе расхождений между главным экраном и реальностью. Доступно только в рабочем режиме (красный пункт в боковом меню).',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Шапка** — индикатор подключения к сервису камер (зелёный/красный) + время отклика в миллисекундах.',
            '[eye] **Левая колонка:** сырые состояния постов и зон (структурированный текст).',
            '[eye] **Правая колонка:** список камер с их статусами и ссылками на видеопотоки.',
            '[eye] **Низ страницы:** прокручивающийся журнал событий с точностью до миллисекунд.',
          ],
        },
        {
          heading: 'Назначение',
          items: [
            'Страница для **диагностики** и **отладки** подключения к внешнему сервису камер.',
            'Показывает **сырые данные** без обработки и агрегации.',
            'Помогает понять, что именно видит система мониторинга в реальном времени.',
            'Используется при настройке и калибровке системы камер.',
            'Видна в боковом меню **только в рабочем режиме** — с красным акцентом.',
          ],
        },
        {
          heading: 'Данные мониторинга',
          items: [
            'Сырые данные от службы мониторинга, опрашивающей внешний сервис камер.',
            '**Состояния постов** — текущий статус каждого поста от системы камер (не из БД).',
            '**Состояния зон** — количество авто, список госномеров от камер.',
            'Данные обновляются в реальном времени, опрашивая внешний сервис.',
            'Формат: структурированный текст с подсветкой синтаксиса.',
          ],
        },
        {
          heading: 'Статусы камер',
          items: [
            'Список всех камер с их **текущим статусом** («онлайн» / «офлайн»).',
            '**Ссылки на трансляции** — прямые адреса видеопотоков.',
            'Время последнего ответа от камеры.',
            'Помогает быстро определить нерабочие камеры.',
          ],
        },
        {
          heading: 'История событий',
          items: [
            '**Полная история** с точными метками времени (с точностью до миллисекунд).',
            'Каждое событие: тип, зона, пост, камера, уверенность распознавания, госномер.',
            'Данные не агрегированы — каждый «тик» системы камер.',
            'Журнал прокручивается автоматически к новым записям.',
            'Полезно для отладки: видны порядок и задержки событий.',
          ],
        },
        {
          heading: 'Доступность внешнего сервиса',
          items: [
            'Проверка доступности **внешнего сервиса камер**.',
            '**Время отклика** в миллисекундах.',
            '**Статус** — «Подключён», «Отключён», «Ошибка».',
            'При ошибке подключения — красный индикатор с описанием ошибки.',
          ],
        },
        {
          heading: 'Доступ и ограничения',
          items: [
            'Доступна **только в рабочем режиме** — при переключении в демо-режим страница скрывается.',
            'Рекомендуется для **администраторов** и **интеграторов**.',
            'Данные на этой странице могут отличаться от главного экрана — это нормально (разные уровни обработки).',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **На главной «не то» состояние поста:** сравнить статус в системе (Дашборд) с сырыми данными от камер здесь → если статус от камер правильный, проблема в обработчике событий; если от камер неверно — проблема в распознавании/камере.',
            '[ok] **Камера «не видит» машину:** найти камеру в списке → проверить, что в сети → открыть видеопоток → визуально сверить ракурс/перекрытия.',
            '[ok] **Машина зашла в зону, но не привязалась к посту:** в журнале событий найти момент въезда → проверить пребывание в зоне и на посту в это время → если событие занятия поста не пришло — проблема в распознавании.',
            '[ok] **Внешний сервис камер недоступен:** красный индикатор в шапке → проверить время отклика → известить интегратора → временно переключиться в демо-режим, чтобы пользователи продолжали работать.',
            '[ok] **Калибровка границ зон:** сравнить координаты события (камера, уверенность распознавания) с реальной разметкой → передать данные команде, отвечающей за камеры.',
          ],
        },
      ],
    },
    en: {
      title: 'Live Debug — Monitoring Diagnostics',
      intro: 'An "under the hood" view of live mode for admins and integrators. Shows raw data from the CV system without processing — exactly what recognition sent, in what order, and with what delays. Used when configuring cameras, calibrating zones, and debugging discrepancies between the dashboard and reality. Live mode only (red sidebar item).',
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
            'Last response time from each camera.',
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
      intro: 'Полное техническое описание системы MetricsAiUp в одном месте: архитектура, API, БД, разграничение прав, фоновые сервисы, описание страниц. Используйте для введения в курс дела новых разработчиков, передачи знаний интегратору, как справочник при настройке. 23 раздела, поиск, экспорт в PDF, печать, два языка.',
      sections: [
        {
          heading: 'Карта экрана',
          items: [
            '[eye] **Шапка** — переключатель языка (русский / английский), кнопки **«PDF»** и **«Печать»**.',
            '[eye] **Левая панель** — оглавление со всеми 23 разделами и поле поиска сверху, прилипает к экрану при прокрутке.',
            '[eye] **Центральная область** — содержимое разделов, прокручиваемое последовательно.',
            '[eye] Активный раздел подсвечивается в оглавлении при прокрутке страницы.',
          ],
        },
        {
          heading: 'Навигация',
          items: [
            '**Оглавление** — боковая панель со списком всех 23 разделов.',
            '**Поиск** — текстовое поле для быстрого поиска по заголовкам разделов.',
            'Текущий раздел автоматически подсвечивается в оглавлении при прокрутке.',
            'Клик по разделу в оглавлении — плавная прокрутка к нему.',
          ],
        },
        {
          heading: 'Разделы документации',
          items: [
            'Архитектура системы, стек технологий, база данных.',
            'Описание серверных маршрутов по всем 22 модулям.',
            'Разграничение прав — система ролей и разрешений.',
            'События реального времени между сервером и браузером.',
            'Интеграция с системой компьютерного зрения.',
            'Подробное описание каждой страницы интерфейса.',
          ],
        },
        {
          heading: 'Экспорт',
          items: [
            '**PDF** — кнопка экспорта всей документации в PDF-файл.',
            '**Печать** — кнопка печати текущей страницы.',
            'Экспорт сохраняет форматирование и структуру разделов.',
          ],
        },
        {
          heading: 'Язык',
          items: [
            'Переключение между русским и английским — вся документация на двух языках.',
            'Язык определяется из общих настроек системы.',
            'Каждый раздел полностью переведён.',
          ],
        },
        {
          heading: 'Содержимое',
          items: [
            'Технические спецификации для **разработчиков** и **администраторов**.',
            'Описание серверных маршрутов с параметрами и примерами ответов.',
            'Схемы базы данных с типами полей и связями.',
            'Инструкции по настройке и развёртыванию.',
            'Описание фоновых сервисов и их конфигурации.',
          ],
        },
        {
          heading: 'Доступ',
          items: [
            'Доступна пользователям, у которых страница «Техническая документация» включена в список разрешённых страниц.',
            'Рекомендуется для **администраторов** и **разработчиков**.',
            'Не содержит чувствительных данных (пароли, ключи).',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Введение нового разработчика в курс дела:** дать ссылку на эту страницу → пусть пройдёт по разделам сверху вниз → вопросы — потом.',
            '[ok] **Найти серверный маршрут:** поиск → ввести часть пути → перейти к разделу с описанием.',
            '[ok] **Передать документацию интегратору:** **«PDF»** → отправить файл → у внешней команды автономная копия.',
            '[ok] **Сверить схему БД:** раздел «База данных» → найти модель → проверить поля и связи перед миграцией.',
            '[ok] **Понять, как работает страница:** раздел «Страницы интерфейса» → найти нужную → прочитать описание её состояний и потоков данных.',
          ],
        },
      ],
    },
    en: {
      title: 'Technical Documentation',
      intro: 'A complete technical description of MetricsAiUp in one place: architecture, API, DB, RBAC, background services, and page descriptions. Use it to onboard developers, hand off knowledge to integrators, or as a reference during setup. 23 sections, search, PDF export, print, RU/EN.',
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
            '[eye] **Шапка** — название поста и быстрые шаблоны периода (Сегодня/Вчера/3д/7д/30д/Всё/Произвольный).',
            '[eye] **KPI-полоса (5 карточек):** Всего | Свободен | Занят | В работе | Авто.',
            '[eye] **Панель фильтров:** статус (Все/Свободен/Занят/В работе) + поисковая строка по госномерам и описаниям.',
            '[eye] **Таблица событий** — Время, Статус (цветной), Госномер, Детали, Люди, Точность распознавания. Заголовки сортируемы.',
            '[eye] **Модальное окно с карты** — компактная версия таблицы с кнопкой «Полная страница».',
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
            '**В работе** — активная работа подтверждена системой камер.',
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
            '**Точность** — уверенность системы камер: «высокая» (зелёный), «средняя» (жёлтый), «низкая» (красный).',
          ],
        },
        {
          heading: 'Сортировка',
          items: [
            'Клик на заголовок колонки — сортировка по этому полю.',
            'Повторный клик — переключение направления (по возрастанию / по убыванию).',
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
            '[ok] **Низкая точность распознавания:** колонка «Точность» → если много значений «низкая» — проблемы с камерой/освещением → передать интегратору.',
            '[ok] **Открыть из карты быстро:** клик на пост → кнопка «История» → модальное окно → если нужно глубже, нажать «Полная страница».',
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
  // ────────────────────────────
  // ОТЧЁТ «ЗАНЯТОСТЬ И ЗАГРУЗКА»
  // ────────────────────────────
  utilization: {
    ru: {
      title: 'Отчёт «Занятость и загрузка»',
      intro: 'Сводный отчёт по эффективности использования СТО за выбранный период: фактическое рабочее время постов и зон, простой, загрузка в процентах, потенциальная и фактическая выручка, потери. Поддерживает сравнение с предыдущим периодом, два разреза (по постам и по зонам), тепловую карту по дням/часам и три формата экспорта.',
      sections: [
        {
          heading: 'Зачем этот отчёт',
          items: [
            'Главный вопрос: **насколько эффективно** используется ресурс СТО (посты и зоны) за период.',
            'Сравнивает фактическую занятость со **сменным фондом** (рабочее время × количество постов/зон).',
            'Считает **потенциал** в рублях (фонд × ставка ₽/ч), фактически **заработано** (занятость × ставка) и **потери** (потенциал − заработано).',
            '[●green]{green:Зелёный} индикатор загрузки = выше нормы (для большинства СТО хорошо ≥ 60%).',
            '[●orange]{orange:Оранжевый}/{red:красный} — низкая загрузка, потенциал теряется.',
            'Используйте отчёт для разговора с собственником, планирования смен и аргументации найма работников.',
          ],
        },
        {
          heading: 'Карта экрана',
          items: [
            '**Шапка** — заголовок, кнопки: «Ставка / ±%» (открывает настройки), обновить, экспорт XLSX/PDF/PNG.',
            '**Фильтры** — период (Сегодня / Вчера / 7д / 30д / свой), флажок «Сравнить с предыдущим», переключатель «По постам / По зонам».',
            '**Полоса KPI** — 5-7 карточек: рабочий фонд, занятость, простой, загрузка %, и для постов — потенциал/заработано/потери.',
            '**Тренд** (комбинированный график) — столбцы занятости + линия загрузки % по дням периода.',
            '**Тепловая карта** — двухмерная карта «день недели × час» — где провалы и пики загрузки.',
            '**Таблица «По сущностям»** — построчно посты или зоны: фонд, занятость, простой, загрузка %, для постов — заработано/потери.',
            '**Тройка постов с наибольшими потерями** (только для постов) — кто больше всего простаивает в деньгах.',
          ],
        },
        {
          heading: 'KPI-карточки — как читать',
          items: [
            '**Раб. фонд, ч** — теоретическое рабочее время за период: (часов в смену) × (рабочих дней) × (количество постов/зон).',
            '**Занятость, ч** — суммарное время, когда пост был в статусе «Активная работа» или «Занят без работ».',
            '**Простой, ч** = фонд − занятость. Логически это «потерянное» время в рабочие часы.',
            '**Загрузка, %** = занятость / фонд × 100. [●green]≥ 60% — хорошо, [●orange] 30-60% — средне, [●red] < 30% — низко.',
            '**Потенциал, ₽** = фонд × ставка ₽/ч. Сколько могли бы заработать, если бы пост был занят 100% рабочего времени.',
            '**Заработано, ₽** = занятость × ставка. Фактическая выручка по этим постам (грубая оценка).',
            '**Потери, ₽** = потенциал − заработано. Сколько недозаработали из-за простоев.',
            '**Дельта-значок** появляется при включённом «Сравнить» — показывает рост/падение по сравнению с предыдущим равным периодом.',
            '**Погрешность ±%** — рядом с цифрами в скобках диапазон (низ — верх). Учитывает ошибки системы камер.',
          ],
        },
        {
          heading: 'Период и сравнение',
          items: [
            '**Сегодня** — с 00:00 до 23:59 сегодня.',
            '**Вчера** — полный вчерашний день.',
            '**7 дней** — последние 7 календарных дней включая сегодня.',
            '**30 дней** — последние 30 календарных дней включая сегодня.',
            '**Свой** — два поля для выбора даты, любой диапазон. Параметры сохраняются в адресной строке.',
            '**Сравнить с предыдущим** — флажок справа от фильтров. Подтягивает данные за предыдущий равный период (для 7д — −7 дней, для 30д — −30 дней). На KPI появляются дельты с %.',
          ],
        },
        {
          heading: 'Посты vs Зоны',
          items: [
            '**Посты** — основной разрез: 10 рабочих позиций с механиком и оборудованием. Считаются деньги (потенциал/заработано/потери) — только посты приносят выручку.',
            '**Зоны** — служебный разрез: ремонт, ожидание, въезд, парковка, свободная. Денежных метрик нет — зоны не создают выручку, но показывают логистическую загрузку территории.',
            '[tip] **Совет:** начните с «По постам» для финансовой картины, затем перейдите на «По зонам» для оценки потоков машин.',
          ],
        },
        {
          heading: 'Настройки расчёта',
          items: [
            'Открыть: кнопка с иконкой шестерёнки в шапке (показывает текущую ставку и погрешность).',
            '**Рабочее время** — начало и конец рабочего дня (по умолчанию 09:00–18:00). Определяет смену.',
            '**Рабочие дни** — массив [пн, вт, …, вс] флажками. Выходные исключаются из фонда.',
            '**Ставка ₽/ч** — базовая ставка для расчёта потенциала и потерь. Только для постов.',
            '**Валюта** — символ (₽, $, €) или код. Влияет только на отображение.',
            '**Погрешность ±%** — учитывает ошибки камер (например, 5% значит, что цифры округлены ±5%). Отображается в скобках под каждой KPI-карточкой.',
            '**Примечание к погрешности** — свободный текст, например «Без камеры на посту 5 в апреле».',
            'Все настройки хранятся в общих настройках системы и применяются ко всем пользователям СТО.',
            'Право редактирования — «Управление настройками» (администратор/директор).',
          ],
        },
        {
          heading: 'Тепловая карта «день × час»',
          items: [
            'Двумерная сетка: **строки** — дни недели (пн–вс), **столбцы** — часы суток (0–23).',
            'Цвет ячейки = средняя загрузка % в эту комбинацию (дн+час) по всему выбранному периоду.',
            '[●green]{green:зелёный} насыщенный = высокая загрузка, [●gray] серый = низкая или нет данных.',
            'Видно пики (например, утро понедельника) и провалы (вечер пятницы, выходные).',
            'Используется для перепланировки смен — если по понедельникам с 9 до 11 пик, имеет смысл вывести больше механиков.',
          ],
        },
        {
          heading: 'Тренд по дням',
          items: [
            'Комбинированный график: **столбцы** — занятость, ч; **линия** — загрузка %.',
            'При включённом «Сравнить» — вторая полупрозрачная серия для предыдущего периода.',
            'Подсказка над точкой — точные значения и дельта.',
            'Кнопка PNG в шапке — экспорт именно этого графика в виде картинки удвоенного разрешения.',
          ],
        },
        {
          heading: 'Таблица «По сущностям»',
          items: [
            'Сортируется по умолчанию по загрузке (от большей к меньшей).',
            'Клик по заголовку столбца — пересортировка по этому полю.',
            'Кликабельный номер поста/зоны — переход на детальную страницу «Посты» или «Зоны».',
            'Подсветка [●red] строки — загрузка ниже порога (по умолчанию < 30%).',
            'В конце таблицы — итоги (фонд, занятость, заработано, потери).',
          ],
        },
        {
          heading: 'Тройка постов с наибольшими потерями (только посты)',
          items: [
            'Три поста с наибольшими потерями в рублях за период.',
            'Помогает мастеру сразу увидеть «болевые точки» — куда направить внимание.',
            'Клик по карточке — переход в «История поста» с тем же периодом → анализ причин.',
          ],
        },
        {
          heading: 'Экспорт',
          items: [
            '**XLSX** — три листа: «Сводка» (KPI), «По постам/зонам» (детали по строкам), «По дням» (агрегированный тренд).',
            '**PDF** — многостраничный отчёт: обложка, KPI, таблица, графики. Подходит для отправки собственнику.',
            '**PNG** — только график-тренд в высоком разрешении (для презентаций, отчётов в Word).',
            'Имя файла включает разрез (по постам или по зонам) и даты периода.',
            'Все экспорты учитывают текущие фильтры и язык интерфейса.',
          ],
        },
        {
          heading: 'Источник данных',
          items: [
            'Источник: серверный отчёт «Утилизация» за выбранный период (с разрезом по постам или зонам, опционально со сравнением).',
            'Сервер собирает данные из снимков мониторинга (рабочий режим) или пребываний на постах и в зонах (демо-режим).',
            'Учитываются только периоды в **рабочие часы** согласно настройкам.',
            'Статусы «Занят», «Активная работа», «Занят без работ» считаются занятостью; «Свободен» и «Нет данных» — простоем.',
            '[●orange] Авто на посту вне рабочих часов (например, оставили на ночь) — **не учитывается** как занятость.',
          ],
        },
        {
          heading: 'Типичные сценарии',
          items: [
            '[ok] **Месячный отчёт собственнику:** период «30 дней» → «Сравнить» → экспорт PDF → отправить.',
            '[ok] **Поиск провалов:** период «7 дней» → тепловая карта → найти ячейки с низкой загрузкой → обсудить причины.',
            '[ok] **Аргументация повышения ставки:** «Загрузка 75%, потери 80к ₽/мес — нужно повысить ставку или взять второго механика».',
            '[ok] **Спор с механиком о ставке:** тройка постов с наибольшими потерями → исследовать конкретный пост в «История поста» → конкретные пробелы.',
            '[ok] **Планирование смен:** тепловая карта → выявить пиковые часы → перестроить расписание в «Смены».',
          ],
        },
        {
          heading: 'Доступ и роли',
          items: [
            'Просмотр: «Просмотр дашборда» или «Просмотр аналитики» (менеджер, директор, администратор).',
            'Изменение настроек (ставка, погрешность, рабочее время): «Управление настройками» (администратор, директор).',
            'В боковом меню — пункт «Утилизация» в разделе «Аналитика».',
          ],
        },
      ],
    },
    en: {
      title: 'Utilization & Load Report',
      intro: 'Aggregated STO efficiency report for a selected period: actual busy time of posts and zones, idle time, load %, potential and earned revenue, losses. Supports comparison with previous period, two views (posts/zones), heatmap, and three export formats.',
      sections: [
        {
          heading: 'Why this report',
          items: [
            'Main question: **how efficiently** is the STO resource (posts and zones) used in the period.',
            'Compares actual busy time with **shift fund** (work hours × number of posts/zones).',
            'Calculates **potential** in money (fund × hourly rate), actual **earned** (busy × rate), and **lost** (potential − earned).',
            '[●green]{green:Green} load indicator = above norm (≥ 60% is good for most STOs).',
            '[●orange]/{red:red} — low load, potential is lost.',
            'Use this report for talks with the owner, shift planning, and arguing hiring of additional workers.',
          ],
        },
        {
          heading: 'Screen Map',
          items: [
            '**Header** — title, buttons: "Rate / ±%" (opens settings), refresh, XLSX/PDF/PNG export.',
            '**Filters** — period (Today / Yesterday / 7d / 30d / Custom), "Compare with previous" checkbox, "Posts / Zones" switcher.',
            '**KPI strip** — 5-7 cards: shift fund, busy, idle, load %, and for posts — potential/earned/lost.',
            '**Trend** (ComposedChart) — busy bars + load % line per day.',
            '**Heatmap** — 2D map "day × hour" — load gaps and peaks.',
            '**Per-entity table** — posts or zones row-by-row: fund, busy, idle, load %, earned/lost (posts only).',
            '**Top-3 losses** (posts only) — biggest idle in money.',
          ],
        },
        {
          heading: 'KPI Cards — How to Read',
          items: [
            '**Fund, h** — theoretical work time: (shift hours) × (work days) × (number of posts/zones).',
            '**Busy, h** — total time when post was in **active_work** or **occupied_no_work**.',
            '**Idle, h** = fund − busy. Effectively "lost" time during work hours.',
            '**Load, %** = busy / fund × 100. [●green]≥ 60% — good, [●orange] 30-60% — average, [●red] < 30% — low.',
            '**Potential, ₽** = fund × hourly rate. What could be earned at 100% occupancy.',
            '**Earned, ₽** = busy × rate. Approximate actual revenue from these posts.',
            '**Lost, ₽** = potential − earned. Under-earned due to idle time.',
            '**Delta badge** appears with "Compare" — growth/decline vs previous equal period.',
            '**Margin ±%** — bracketed range under each KPI. Accounts for CV system errors.',
          ],
        },
        {
          heading: 'Period and Compare',
          items: [
            '**Today** — 00:00 to 23:59 today.',
            '**Yesterday** — full previous day.',
            '**7 days** — last 7 days including today.',
            '**30 days** — last 30 days including today.',
            '**Custom** — two date inputs. Persisted in URL (`?from=...&to=...`).',
            '**Compare with previous** — checkbox on the right. Fetches data for the previous equal period (7d → −7d, 30d → −30d). KPI cards show % deltas.',
          ],
        },
        {
          heading: 'Posts vs Zones',
          items: [
            '**Posts** — main view: 10 work bays with mechanic and equipment. Money metrics (potential/earned/lost) — only posts produce revenue.',
            '**Zones** — service view: repair, waiting, entry, parking, free. No money metrics — zones don\'t make money, but show logistic load.',
            '[tip] **Tip:** start with "Posts" for financial view, then switch to "Zones" for vehicle flow analysis.',
          ],
        },
        {
          heading: 'Calculation Settings',
          items: [
            'Open: gear icon in header (shows current rate and margin).',
            '**Work hours** — `workStart` / `workEnd` (default 09:00–18:00).',
            '**Work days** — [Mon, Tue, …, Sun] checkboxes. Weekends excluded from fund.',
            '**Rate ₽/h** — `hourlyRate`. Base rate for potential and losses. Posts only.',
            '**Currency** — symbol (₽, $, €) or code. Display only.',
            '**Margin ±%** — `errorMarginPct`. Accounts for CV errors (e.g., 5% means values rounded ±5%). Shown under each KPI.',
            '**Margin note** — free text, e.g., "No camera on post 5 in April".',
            'All settings stored in `app_settings.weekSchedule` server-side and apply to all STO users.',
            'Edit permission: `manage_settings` (admin/director).',
          ],
        },
        {
          heading: 'Heatmap (day × hour)',
          items: [
            '2D grid: **rows** — days of week (Mon–Sun), **columns** — hours (0–23).',
            'Cell color = average load % for that (day+hour) combo over the period.',
            '[●green]{green:Saturated green} = high load, [●gray] gray = low or no data.',
            'See peaks (e.g., Monday morning) and gaps (Friday evening, weekends).',
            'Use for shift replanning — if Monday 9-11 is a peak, schedule more mechanics.',
          ],
        },
        {
          heading: 'Trend by Day',
          items: [
            'ComposedChart: **bars** — busy, h; **line** — load %.',
            'With "Compare" on — a second translucent series for the previous period.',
            'Hover tooltip — exact values and delta.',
            'PNG button in header — exports just this chart at 2× resolution.',
          ],
        },
        {
          heading: 'Per-Entity Table',
          items: [
            'Sorted by load (descending) by default.',
            'Click column header — sort by that field.',
            'Clickable post/zone number — jump to detail page.',
            '[●red] highlighted row — load below threshold (default < 30%).',
            'End of table — totals (fund, busy, earned, lost).',
          ],
        },
        {
          heading: 'Top-3 Losses (Posts only)',
          items: [
            'Three posts with the biggest losses in money for the period.',
            'Helps owner see "pain points" — where to focus.',
            'Click card — jump to PostHistory with the same period → root cause.',
          ],
        },
        {
          heading: 'Export',
          items: [
            '**XLSX** — three sheets: Summary (KPI), Per posts/zones (row details), Per day (aggregated trend).',
            '**PDF** — multi-page report via `exportUtilizationPdf` — cover, KPI, table, charts. Good for owner.',
            '**PNG** — just the trend chart at 2× resolution (for presentations).',
            'Filename: `utilization-{entity}-{from}-{to}.xlsx` (entity = posts or zones).',
            'All exports respect current filters and UI language.',
          ],
        },
        {
          heading: 'Data Source',
          items: [
            'API: **GET /api/utilization?from=...&to=...&entity=posts|zones&compare=1**.',
            'Backend pulls from **MonitoringSnapshot** (live) or **PostStay** + **ZoneStay** (demo).',
            'Only **work hours** per `app_settings.weekSchedule` are counted.',
            'Statuses **occupied** + **active_work** + **occupied_no_work** count as busy; **free** + **no_data** as idle.',
            '[●orange] Vehicle on post outside work hours (e.g., parked overnight) is **not** counted as busy.',
          ],
        },
        {
          heading: 'Common Workflows',
          items: [
            '[ok] **Monthly owner report:** "30d" → "Compare" → export PDF → send.',
            '[ok] **Find gaps:** "7d" → heatmap → spot low-load cells → discuss causes.',
            '[ok] **Argue rate increase:** "Load 75%, losses 80k ₽/mo — raise rate or hire second mechanic".',
            '[ok] **Mechanic rate dispute:** Top-3 losses → drill into PostHistory → identify gaps.',
            '[ok] **Shift planning:** heatmap → identify peak hours → adjust schedule in Shifts.',
          ],
        },
        {
          heading: 'Access and Roles',
          items: [
            'View: `view_dashboard` or `view_analytics` (manager, director, admin).',
            'Edit settings (rate, margin, work hours): `manage_settings` (admin, director).',
            'Sidebar: "Utilization" in "Analytics" section.',
          ],
        },
      ],
    },
  },
  // ────────────────────────────
  // ДАННЫЕ 1С (5 ТАБОВ)
  // ────────────────────────────
  data1c: {
    ru: {
      title: 'Данные 1С',
      tabOrder: ['current', 'imports', 'raw', 'settings'],
      tabs: {
        current: {
          label: 'Сейчас',
          intro: 'Текущая сводка по заказам и этапам из 1С на «здесь и сейчас». Источник — сводки заказ-нарядов и этапов (актуальная версия каждого заказа). Это **обработанные** данные, не сырые: дубли из писем уже устранены, постам присвоены реальные идентификаторы через справочник постов.',
          sections: [
            {
              heading: 'Что видно на экране',
              items: [
                '[●blue]**Список открытых заказов 1С** — номер заказа, дата, авто, мастер, нормо-часы, статус.',
                '[●green]**Этапы** — для каждого заказа: дата этапа, имя этапа, привязанный пост, работник, факт/норма часов.',
                '[●orange]**Метка сопоставления с камерами** — если найдена связь (тип совпадения: по VIN / по точному номеру / по похожему номеру; уверенность 0.5–1.0).',
                '[tip] Все даты в Минске (+3). Сортировка по умолчанию — по дате заказа, новые сверху.',
              ],
            },
            {
              heading: 'Связь с другими страницами',
              items: [
                '[click]**Клик по номеру заказа** → открывает страницу «Сопоставления» с подсветкой нужной строки.',
                '[click]**Клик по госномеру/VIN** → открывает «Сессии» с фильтром по номеру.',
                '[●violet]**Нестыковки** — кнопка «Перейти к нестыковкам» открывает страницу нестыковок с фильтром по номеру заказа.',
              ],
            },
            {
              heading: 'Доступ',
              items: [
                '**Просмотр**: «Просмотр данных 1С» (администратор / директор / менеджер).',
                'Редактирование данных на этой вкладке невозможно — только из 1С через почту.',
              ],
            },
          ],
        },
        imports: {
          label: 'Импорты',
          intro: 'Журнал писем с XLSX-вложениями, поступивших по IMAP от 1С. Каждое письмо — отдельный импорт с уникальной контрольной суммой содержимого (для устранения дубликатов). Статусы: «распарсено» (успешно) или «ошибка» (см. текст ошибки). Здесь же — ручная загрузка XLSX перетаскиванием и кнопка принудительной выборки писем.',
          sections: [
            {
              heading: 'Колонки таблицы',
              items: [
                '**Дата получения**, **От**, **Тема**.',
                '**Файл** — имя XLSX-вложения + размер в КБ.',
                '[●green]**Статус** — «распарсено» зелёный, «ошибка» красный (см. текст ошибки при наведении).',
                '**Тип документа** — план / заявка / выполненные работы (определяется автоматически).',
                '**Кол-во строк** — сколько строк извлечено в таблицы планов / заказ-нарядов / этапов.',
              ],
            },
            {
              heading: 'Действия',
              items: [
                '[click]**Перетаскивание XLSX** — ручная загрузка минуя IMAP. Файл проходит через тот же парсер 1С.',
                '[click]**Принудительная выборка** — кнопка «Запустить IMAP сейчас» — внеочередной опрос ящика без ожидания заданного интервала.',
                '[click]**Подтвердить** — пометить ошибку как просмотренную (убирает её из счётчика-метки вкладки).',
                '[tip] Устранение дубликатов: одинаковые письма (по контрольной сумме содержимого) пропускаются автоматически.',
              ],
            },
            {
              heading: 'Метка-счётчик',
              items: [
                '[●red]**Красный счётчик** на вкладке «Импорты» — количество **ошибок** за последние 7 дней (непросмотренных).',
                'Обнуляется по мере пометки ошибок как просмотренных.',
              ],
            },
            {
              heading: 'Доступ',
              items: [
                '**Просмотр**: «Просмотр данных 1С». **Загрузка/Принудительная выборка**: «Управление импортом 1С».',
              ],
            },
          ],
        },
        raw: {
          label: 'Сырые данные',
          intro: 'Развёрнутый вид трёх таблиц сырых строк из XLSX: **планы**, **заказ-наряды (КОЛ…)** и **этапы**. Каждая запись — одна строка одного письма. Дубликаты тут **остаются** — для отладки разбора. Сводки (без дублей) — во вкладке «Сейчас».',
          sections: [
            {
              heading: 'Три номерных пространства 1С',
              items: [
                '[●blue]**Строка плана** — план/заявка. Идентичность = композит (номер заказа + дата заказа + госномер авто). Номер повторяется в каждой выгрузке.',
                '[●green]**Строка заказ-наряда** — заказ-наряд (КОЛ…). Отдельная сущность, уникальный номер.',
                '[●orange]**Строка этапа** — этап работы. Идентичность = (номер заказа + дата этапа + имя этапа).',
                '[tip] Поэтому ни одну из таблиц нельзя «дедупить по номеру заказа» — нужны композитные ключи. Сводки строятся отдельно (см. вкладку «Сейчас»).',
              ],
            },
            {
              heading: 'Фильтры',
              items: [
                '**По типу документа** (вкладки внутри страницы).',
                '**По диапазону дат** (дата заказа / дата этапа).',
                '**По идентификатору импорта** — посмотреть все строки из конкретного письма.',
                '**Поиск** — по номеру заказа, госномеру, VIN, имени клиента.',
              ],
            },
            {
              heading: 'Зачем эта вкладка',
              items: [
                '[ok] Отладка: при неправильном разборе XLSX → видно тут.',
                '[ok] История: что именно пришло из 1С в конкретное письмо.',
                '[ok] Сравнение с обработанной сводкой («Сейчас») — найти, какие записи отфильтрованы при устранении дубликатов.',
              ],
            },
            {
              heading: 'Доступ',
              items: ['**Просмотр**: «Просмотр данных 1С». Это вкладка только для чтения.'],
            },
          ],
        },
        settings: {
          label: 'Настройки',
          intro: 'Настройки опроса IMAP-ящика 1С. Пароль шифруется на сервере по протоколу AES-GCM с ключом из переменной окружения (32 байта). При запросе данных пароль никогда не возвращается в открытом виде.',
          sections: [
            {
              heading: 'Поля',
              items: [
                '**Хост** — IMAP-сервер (например, `imap.yandex.ru`, `imap.gmail.com`).',
                '**Порт** — обычно 993 (SSL) или 143 (STARTTLS).',
                '**Использовать SSL** — флажок для шифрованного подключения.',
                '**Логин** — полный e-mail (например, `1c@company.ru`).',
                '**Пароль** — пароль приложения (не основной пароль аккаунта!). Шифруется по протоколу AES-GCM.',
                '**Папка** — папка ящика (обычно `INBOX`, можно конкретную подпапку).',
                '**Интервал опроса (сек)** — частота опроса (по умолчанию 300с = 5 минут).',
                '[●green]**Активен** — флажок включения/выключения фонового опроса.',
              ],
            },
            {
              heading: 'Кнопка «Тест соединения»',
              items: [
                '[click]Делает реальный IMAP-вход с введёнными настройками и закрывает соединение **без забора писем**.',
                '[ok]**Успех** — зелёное уведомление «Соединение установлено».',
                '[●red]**Ошибка** — красное уведомление с текстом ошибки (неверный логин/пароль, нет сети, проблема с SSL и т.д.).',
                '[tip]Если использовать Gmail/Yandex — нужно создать **пароль приложения** в настройках аккаунта, обычный пароль не сработает (двухфакторная аутентификация блокирует IMAP).',
              ],
            },
            {
              heading: 'Статус опроса',
              items: [
                '**Время последнего успеха** — время последнего успешного захода в ящик.',
                '[●red]**Последняя ошибка** — текст последней ошибки опроса (если есть).',
                '[tip]Если время последнего успеха старше суток, а флажок «Активен» включён — что-то сломалось (см. последнюю ошибку).',
              ],
            },
            {
              heading: 'Доступ',
              items: ['**Просмотр + редактирование**: «Настройка IMAP 1С» (только администратор). У других — вкладка скрыта.'],
            },
          ],
        },
      },
    },
    en: {
      title: '1C Data',
      tabOrder: ['current', 'imports', 'raw', 'settings'],
      tabs: {
        current: {
          label: 'Current',
          intro: 'A current snapshot of orders and stages from 1C as of "right now". Source: the summary tables OneCWorkOrderMerged + OneCStageMerged (latest version of each order via ROW_NUMBER OVER). This data is **processed**, not raw: email duplicates are removed and posts are mapped to real `Post.id` values via `PostNameMapping`.',
          sections: [
            {
              heading: 'What is on the screen',
              items: [
                '[●blue]**List of open 1C orders** — orderNumber, date, vehicle, master, norm hours, status.',
                '[●green]**Stages** — for each order: stage date, stage name, mapped post, worker, actual/norm hours.',
                '[●orange]**CV match badge** — if WorkOrderLink exists (matchType: vin / exact_plate / fuzzy_plate, confidence 0.5–1.0).',
                '[tip]All dates in Minsk (+3). Default sort: orderDate DESC.',
              ],
            },
            {
              heading: 'Links to other pages',
              items: [
                '[click]**Click order number** → opens OrderMatching with the row highlighted.',
                '[click]**Click plate/VIN** → opens Sessions filtered by plateNumber.',
                '[●violet]**Discrepancies** — "Go to discrepancies" button opens Discrepancies filtered by orderNumber.',
              ],
            },
            {
              heading: 'Access',
              items: [
                '**View**: `view_1c` (admin / director / manager).',
                'Editing data in this tab is not possible — only via 1C through IMAP.',
              ],
            },
          ],
        },
        imports: {
          label: 'Imports',
          intro: 'A journal of emails with XLSX attachments received from 1C via IMAP. Each email = one `OneCImport` record with a unique `contentHash` (used for dedup). Statuses: `parsed` (success) or `error` (see errorMessage). Also available here: manual XLSX upload (drag-drop) and an IMAP force-fetch button.',
          sections: [
            {
              heading: 'Table columns',
              items: [
                '**Received at** (`receivedAt`), **From** (`fromEmail`), **Subject** (`subject`).',
                '**File** — XLSX attachment name + size in KB.',
                '[●green]**Status** — `parsed` green, `error` red (see errorMessage tooltip on hover).',
                '**Document type** — plan / repair-order / performed (parser determines).',
                '**Row count** — how many rows extracted into OneCPlanRow / OneCRepairOrderRow / OneCStageRow.',
              ],
            },
            {
              heading: 'Actions',
              items: [
                '[click]**Drag-drop XLSX** — manual upload bypassing IMAP. The file goes through the same `OneCParser`.',
                '[click]**Force-fetch** — "Run IMAP now" button — out-of-schedule mailbox poll without waiting pollIntervalSec.',
                '[click]**Acknowledge** — mark an error as seen (removes it from the tab badge counter).',
                '[tip] Dedup: identical emails (by contentHash) are skipped automatically.',
              ],
            },
            {
              heading: 'Badge counter',
              items: [
                '[●red]**Red counter** on "Imports" tab — number of **errors** in the last 7 days (acknowledged=false).',
                'Resets as errors are marked as seen.',
              ],
            },
            {
              heading: 'Access',
              items: ['**View**: `view_1c`. **Upload/Force-fetch**: `manage_1c_import`.'],
            },
          ],
        },
        raw: {
          label: 'Raw data',
          intro: 'An expanded view of three raw-row tables from XLSX: **plans** (`OneCPlanRow`), **repair orders (КОЛ…)** (`OneCRepairOrderRow`), and **stages** (`OneCStageRow`). Each record = one row from one email. Duplicates **remain** — for parser debugging. Deduplicated summaries live on the "Current" tab.',
          sections: [
            {
              heading: 'Three 1C number spaces',
              items: [
                '[●blue]**OneCPlanRow** — plan/request. Identity = composite (orderNumber + orderDate + vehiclePlate). Number repeats in each export.',
                '[●green]**OneCRepairOrderRow** — repair order (КОЛ…). Separate entity, unique orderNumber.',
                '[●orange]**OneCStageRow** — work stage. Identity = (orderNumber + stageDate + stageName).',
                '[tip] So no table can be "deduped by orderNumber" — composite keys are required. Summaries are built via ROW_NUMBER OVER (see "Current" tab).',
              ],
            },
            {
              heading: 'Filters',
              items: [
                '**By document type** (inner tabs).',
                '**By date range** (orderDate / stageDate).',
                '**By importId** — see all rows from a specific email.',
                '**Search** — by orderNumber, vehiclePlate, VIN, customerName.',
              ],
            },
            {
              heading: 'Purpose',
              items: [
                '[ok] Debug: parser misread XLSX → visible here.',
                '[ok] History: what exactly came from 1C in a specific email.',
                '[ok] Compare with processed summary ("Current") — find which records were filtered during dedup.',
              ],
            },
            {
              heading: 'Access',
              items: ['**View**: `view_1c`. This tab is read-only.'],
            },
          ],
        },
        settings: {
          label: 'Settings',
          intro: 'IMAP mailbox poll settings for 1C. The password is encrypted server-side via AES-GCM with the key from the `IMAP1C_KEY` env var (32 bytes). The password is never returned by the API in plaintext.',
          sections: [
            {
              heading: 'Fields',
              items: [
                '**Host** — IMAP server (e.g., `imap.yandex.ru`, `imap.gmail.com`).',
                '**Port** — usually 993 (SSL) or 143 (STARTTLS).',
                '**Use SSL** — checkbox for encrypted connection.',
                '**Login** — full e-mail (e.g., `1c@company.ru`).',
                '**Password** — app password (not main account password!). Encrypted with AES-GCM.',
                '**Mailbox** — mailbox folder (usually `INBOX`, can be a specific subfolder).',
                '**Poll interval (sec)** — poll frequency (default 300s = 5 minutes).',
                '[●green]**Active** — flag to enable/disable background polling.',
              ],
            },
            {
              heading: '"Test connection" button',
              items: [
                '[click]Performs a real IMAP login with the entered settings and closes the connection **without fetching emails**.',
                '[ok]**Success** — green toast "Connection established".',
                '[●red]**Error** — red toast with exception text (AUTHENTICATIONFAILED, NETWORK, SSL, etc.).',
                '[tip]If using Gmail/Yandex — create an **app password** in account settings, regular password will not work (2FA blocks IMAP).',
              ],
            },
            {
              heading: 'Poll status',
              items: [
                '**Last success at** — time of last successful mailbox visit.',
                '[●red]**Last error** — text of last poll error (if any).',
                '[tip]If `lastSuccessAt` is older than a day, but Active is on — something broke (see `lastError`).',
              ],
            },
            {
              heading: 'Access',
              items: ['**View + edit**: `manage_1c_config` (admin only). Others — the tab is hidden.'],
            },
          ],
        },
      },
    },
  },
  // ────────────────────────────
  // ВХОД
  // ────────────────────────────
  login: {
    ru: {
      title: 'Вход в MetricsAiUp',
      intro: 'Страница авторизации. Введите рабочий e-mail и пароль, которые выдал администратор СТО. После входа вы попадёте на главный экран или на первую доступную вам страницу.',
      sections: [
        {
          heading: 'Как войти',
          items: [
            '[●blue]**E-mail** — полностью, регистр не важен (`Ivan@metricsai.up` = `ivan@metricsai.up`).',
            '[●blue]**Пароль** — чувствителен к регистру. Точки/тире/спецсимволы — как выдали.',
            '[click]Нажмите **«Войти»** или Enter в поле пароля.',
            '[ok]При успехе появится зелёное уведомление «Добро пожаловать, …» и произойдёт переход на главную.',
          ],
        },
        {
          heading: 'Типичные ошибки',
          items: [
            '[●red]**«Неверный email или пароль»** — проверьте раскладку, Caps Lock, лишние пробелы. Это общее сообщение специально, чтобы не подсказывать, что именно неверно (защита от перебора).',
            '[●orange]**«Пользователь отключён»** — учётная запись деактивирована. Обратитесь к администратору, чтобы её активировать.',
            '[●yellow]**«Слишком много попыток. Подождите минуту»** — сработало ограничение частоты (20 попыток в минуту с одного IP). Подождите 60 секунд.',
            '[●red]**«Ошибка входа»** — сервер недоступен или нет сети. Проверьте интернет / обратитесь к администратору.',
          ],
        },
        {
          heading: 'Кнопки внизу',
          items: [
            '[click]**🌙 / ☀** — тема (тёмная / светлая). Сохраняется между сессиями.',
            '[click]**RU / EN** — язык интерфейса. Сохраняется между сессиями.',
            '[●red]**«Сброс»** — очищает всё локальное хранилище браузера (токен, тема, язык, кэш) и перезагружает страницу. Используется, если что-то перестало работать — например, после крупного обновления.',
          ],
        },
        {
          heading: 'Безопасность',
          items: [
            '[tip]Передача пароля идёт **только по HTTPS**.',
            'На сервере пароли хранятся в виде криптографического хеша — исходный пароль не известен даже администратору.',
            'JWT-токен сохраняется в локальном хранилище браузера и автоматически прикрепляется к каждому запросу к API.',
            '[●yellow]**Не сохраняйте пароль в общедоступных браузерах** — пользуйтесь «Сбросом» при выходе с чужого устройства.',
          ],
        },
        {
          heading: 'Если забыли пароль',
          items: [
            'Самостоятельного восстановления пока нет — обратитесь к администратору СТО.',
            'Администратор перезапишет пароль через страницу **«Пользователи»**.',
            'Новый пароль придёт от него — установите свой при первой возможности.',
          ],
        },
        {
          heading: 'Тестовые / начальные учётные записи',
          items: [
            '[●blue]`admin@metricsai.up` — администратор (полный доступ), для интеграторов и тестирования.',
            '[●blue]`demo@metricsai.up` — менеджер (Генри Форд), для презентаций и демо.',
            '[●blue]`manager@metricsai.up` — менеджер (Сергей Петров).',
            '[●gray]`mechanic@metricsai.up` — механик (Иван Козлов), **деактивирован** — войти не получится.',
            '[tip]Эти учётные записи существуют **только в демо-сборке**. На рабочем сервере учётные записи создаёт администратор.',
          ],
        },
      ],
    },
    en: {
      title: 'Sign in to MetricsAiUp',
      intro: 'Authentication page. Enter the work email and password issued by your STO admin. After signing in, you will land on the Dashboard — or on the first page you have access to.',
      sections: [
        {
          heading: 'How to sign in',
          items: [
            '[●blue]**Email** — full address, case-insensitive (`Ivan@metricsai.up` = `ivan@metricsai.up`).',
            '[●blue]**Password** — case-sensitive. Dots, dashes, and special characters — exactly as issued.',
            '[click]Press **"Sign in"** or Enter in the password field.',
            '[ok]On success you will see a green toast "Welcome, …" and be redirected to the home page.',
          ],
        },
        {
          heading: 'Common errors',
          items: [
            '[●red]**"Invalid email or password"** — check keyboard layout, Caps Lock, extra spaces. The generic message is intentional, so as not to leak which one is wrong (anti-bruteforce).',
            '[●orange]**"User is disabled"** — account is deactivated. Ask the admin to enable `isActive`.',
            '[●yellow]**"Too many attempts. Wait a minute"** — rate-limit triggered (20 attempts per minute per IP). Wait 60 seconds.',
            '[●red]**"Login error"** — backend is unavailable or network down. Check internet / contact the admin.',
          ],
        },
        {
          heading: 'Bottom buttons',
          items: [
            '[click]**🌙 / ☀** — theme (dark / light). Persists across sessions.',
            '[click]**RU / EN** — UI language. Persists across sessions.',
            '[●red]**"Reset"** — clears the entire `localStorage` (token, theme, language, cache) and reloads the page. Useful if something is "broken" — e.g., after a major update.',
          ],
        },
        {
          heading: 'Security',
          items: [
            '[tip]Password is transmitted **only over HTTPS** (`artisom.dev.metricsavto.com:443`).',
            'Backend stores passwords as bcrypt hashes — even the admin does not see the original.',
            'JWT token is saved in `localStorage` and automatically attached as `Authorization: Bearer` for all API calls.',
            '[●yellow]**Do not save the password in public browsers** — use "Reset" when leaving someone else’s device.',
          ],
        },
        {
          heading: 'Forgot the password',
          items: [
            'Self-service password reset is not implemented yet — ask your STO admin.',
            'Admin re-writes the password via the **"Users"** page (`/users`).',
            'You will get the new password from them — set your own at the first opportunity.',
          ],
        },
        {
          heading: 'Test / seed accounts',
          items: [
            '[●blue]`admin@metricsai.up` — admin (full access), for integrators and testing.',
            '[●blue]`demo@metricsai.up` — manager (Henry Ford), for presentations and demos.',
            '[●blue]`manager@metricsai.up` — manager (Sergey Petrov).',
            '[●gray]`mechanic@metricsai.up` — mechanic (Ivan Kozlov), **disabled** — login will fail.',
            '[tip]These accounts exist **only in the demo install**. In production, the admin creates accounts.',
          ],
        },
      ],
    },
  },
};

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════

// Если у data есть поле `tabs` — это объект { tabKey: { label, intro, sections } },
// порядок задаётся `tabOrder` (массив ключей). Тогда в попапе появляется горизонтальный
// мини-таб-бар. Активный таб по умолчанию = пропс `tabId` (если он есть и валиден),
// иначе первый ключ из `tabOrder`. Обычная (без табов) справка работает как раньше.
export default function HelpButton({ pageKey, tabId }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const isRu = i18n.language === 'ru';
  const content = HELP_CONTENT[pageKey];
  const data = content ? content[isRu ? 'ru' : 'en'] : null;

  const hasTabs = !!(data && data.tabs && data.tabOrder && data.tabOrder.length);
  const initialTab = hasTabs ? ((tabId && data.tabs[tabId]) ? tabId : data.tabOrder[0]) : null;
  const [activeTab, setActiveTab] = useState(initialTab);

  // Если вкладка страницы сменилась после открытия попапа — синхронизируем выделение.
  // При новом открытии — стартуем с актуального tabId.
  function handleOpen() {
    if (hasTabs) {
      setActiveTab((tabId && data.tabs[tabId]) ? tabId : data.tabOrder[0]);
    }
    setOpen(true);
  }

  if (!content || !data) return null;

  const view = hasTabs ? data.tabs[activeTab] : data;

  return (
    <>
      <button
        onClick={handleOpen}
        className="p-1 rounded-lg transition-all hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
        title={isRu ? 'Справка' : 'Help'}
      >
        <HelpCircle size={16} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15, 23, 42, 0.55)' }}
          onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-lg"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4"
              style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>
                  {isRu ? 'Справка' : 'Help'}
                </span>
                <h3 className="text-lg font-semibold tracking-tight mt-0.5" style={{ color: 'var(--text-primary)' }}>
                  {data.title}
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md transition-colors hover:bg-[var(--border-glass)]"
                aria-label={isRu ? 'Закрыть' : 'Close'}
              >
                <X size={18} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            <div className="px-6 py-5">
              {/* Tab bar (если поддержано) */}
              {hasTabs && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 mb-5"
                  style={{ borderBottom: '1px solid var(--border-glass)' }}>
                  {data.tabOrder.map((key) => {
                    const tab = data.tabs[key];
                    if (!tab) return null;
                    const active = key === activeTab;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className="pb-2 -mb-px text-xs transition-colors"
                        style={{
                          color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                          borderBottom: '2px solid ' + (active ? 'var(--accent)' : 'transparent'),
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Intro */}
              {view && view.intro && (
                <p className="text-[13px] leading-relaxed mb-6 pl-4"
                  style={{ color: 'var(--text-secondary)', borderLeft: '2px solid var(--accent)' }}>
                  {view.intro}
                </p>
              )}

              {/* Sections */}
              <div className="space-y-5">
                {(view && view.sections ? view.sections : []).map((s, i) => (
                  <HelpSection key={i} section={s} />
                ))}
              </div>
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
  // Legacy support: если у секции есть `text` вместо `items`.
  if (section.text && items.length === 0) {
    return (
      <div>
        <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-2"
          style={{ color: 'var(--text-muted)' }}>{section.heading}</h4>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{section.text}</p>
      </div>
    );
  }

  return (
    <div>
      <button
        className="flex items-center gap-2 w-full text-left group"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
        <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold transition-colors group-hover:text-[color:var(--text-primary)]"
          style={{ color: 'var(--text-muted)' }}>
          {section.heading}
        </h4>
      </button>
      {expanded && (
        <ul className="mt-2 ml-1 space-y-1.5">
          {items.map((item, j) => (
            <li key={j} className="text-[13px] leading-relaxed flex gap-2.5"
              style={{ color: 'var(--text-secondary)' }}>
              <span className="mt-[7px] w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--text-muted)' }} />
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
  zap: { Cmp: Zap, color: '#a855f7' },
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
  pink: '#ec4899',
  violet: '#8b5cf6',
};

const INLINE_RE = /\*\*([^*]+)\*\*|\[(ok|check|warn|err|no|info|tip|arrow|bolt|eye|click|zap)\]|\[●(green|yellow|red|blue|gray|purple|orange|pink|violet)\]|\{(green|yellow|red|blue|gray|purple|orange|pink|violet):([^}]+)\}/g;

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
