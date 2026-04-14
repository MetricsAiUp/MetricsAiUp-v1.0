import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, X, ChevronDown, ChevronRight } from 'lucide-react';

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
      intro: 'Центральная панель мониторинга СТО. Отображает ключевые показатели в реальном времени. Данные обновляются автоматически каждые 5 секунд в демо-режиме и через Socket.IO в live-режиме.',
      sections: [
        {
          heading: 'Карточки KPI (верхняя полоса)',
          items: [
            '**Активные сессии** — количество автомобилей, находящихся на территории СТО прямо сейчас. Считается по открытым VehicleSession без exitTime.',
            '**Свободные посты** — посты со статусом **free**, готовые к приёму автомобиля. Зелёный цвет — всё хорошо, красный — все посты заняты.',
            '**Занятые посты** — посты со статусом **occupied** (машина есть, работа не ведётся) или **active_work** (идёт обслуживание). Синий цвет.',
            '**Рекомендации** — активные уведомления от системы, требующие внимания менеджера. Оранжевый бейдж с числом.',
            'Каждая карточка кликабельна — переход на соответствующую страницу детализации.',
            'Дельта-бейдж (треугольник вверх/вниз) показывает изменение по сравнению с прошлым периодом.',
          ],
        },
        {
          heading: 'Виджет реального времени (LiveSTOWidget)',
          items: [
            'Показывает все **10 постов** с текущим статусом: свободен (зелёный), в работе (синий), занят без работы (серый), простой (жёлтый).',
            'Для занятых постов отображается **госномер** автомобиля в формате плашки и **время на посту** (ЧЧ:ММ).',
            'Статус **occupied_no_work** означает: авто стоит, но работа не ведётся — возможен простой.',
            'Статус **active_work** означает: работник на месте, идёт обслуживание.',
            'Обновляется автоматически — позволяет следить за СТО не переключаясь между экранами.',
            'Виджет компактный — можно держать открытым на втором мониторе.',
          ],
        },
        {
          heading: 'Прогнозы загрузки (ML)',
          items: [
            '**PredictionWidget** показывает ML-прогноз загрузки СТО на ближайшие 4 часа.',
            'Данные запрашиваются из **/api/predict/load** — модель анализирует исторические паттерны.',
            'Прогноз освобождения постов (**/api/predict/free**) — когда какой пост станет свободным.',
            'Прогноз длительности (**/api/predict/duration**) — оценка времени для типа работ.',
            'В демо-режиме отображаются синтетические данные для демонстрации.',
            'Помогает планировать приём автомобилей и распределение работников заранее.',
          ],
        },
        {
          heading: 'Рекомендации системы',
          items: [
            '**Неявка (no_show)** — клиент не приехал на запланированное время. Красный бейдж. Триггер: ЗН со статусом scheduled, время прошло.',
            '**Пост свободен (post_free)** — пост не используется более 30 минут, хотя есть незакреплённые ЗН. Зелёный.',
            '**Есть мощности (capacity_available)** — на СТО есть свободные посты для дополнительных заказов. Синий.',
            '**Превышение времени (work_overtime)** — работа идёт дольше 120% от нормочасов. Жёлтый.',
            '**Простой авто (vehicle_idle)** — машина на посту более 15 минут, но работник отсутствует. Жёлтый.',
            'Нажмите кнопку **«Принять»** чтобы подтвердить обработку рекомендации — она исчезнет из списка.',
            'Подтверждённые рекомендации сохраняются в базе с отметкой acknowledgedAt.',
          ],
        },
        {
          heading: 'Последние события',
          items: [
            'Лента **10 последних** событий от системы компьютерного зрения (CV).',
            'Фильтр по категориям: **Все**, **Авто** (въезд/выезд), **Пост** (занят/свободен), **Работник** (есть/нет), **Работа** (активность/простой).',
            'Каждое событие показывает тип, зону/пост, камеру-источник и время.',
            'Уровень уверенности CV: зелёный >= 90%, жёлтый 70-89%, красный < 70%.',
            'Клик на событие открывает подробности с данными о камере.',
            'Данные приходят из **/api/events** с сортировкой по createdAt desc.',
          ],
        },
        {
          heading: 'Обновление данных',
          items: [
            'В демо-режиме данные обновляются каждые **5 секунд** через polling (setInterval).',
            'В live-режиме обновления приходят через **Socket.IO** в реальном времени.',
            'При потере соединения отображается жёлтый индикатор в шапке.',
            'Период метрик настраивается: **24 часа**, **7 дней**, **30 дней** через параметр ?period.',
          ],
        },
      ],
    },
    en: {
      title: 'Dashboard — Main Screen',
      intro: 'Central STO monitoring panel. Displays key metrics in real-time. Data refreshes automatically every 5 seconds in demo mode and via Socket.IO in live mode.',
      sections: [
        {
          heading: 'KPI Cards (top bar)',
          items: [
            '**Active Sessions** — vehicles currently on STO premises. Counted by open VehicleSession records without exitTime.',
            '**Free Posts** — posts with **free** status ready for new vehicles. Green = good, red = all posts occupied.',
            '**Occupied Posts** — posts with **occupied** (car present, no work) or **active_work** (service in progress) status. Blue color.',
            '**Recommendations** — active system notifications requiring manager attention. Orange badge with count.',
            'Each card is clickable — navigates to the corresponding detail page.',
            'Delta badge (up/down triangle) shows change compared to previous period.',
          ],
        },
        {
          heading: 'Live Widget (LiveSTOWidget)',
          items: [
            'Shows all **10 posts** with current status: free (green), active work (blue), occupied no work (gray), idle (yellow).',
            'Occupied posts display vehicle **plate number** as a badge and **time on post** (HH:MM).',
            'Status **occupied_no_work** means: car is there but no work is being done — potential idle.',
            'Status **active_work** means: worker present, service in progress.',
            'Auto-refreshes — monitor STO without switching screens.',
            'Compact widget — can be kept open on a second monitor.',
          ],
        },
        {
          heading: 'Load Predictions (ML)',
          items: [
            '**PredictionWidget** shows ML load forecast for the next 4 hours.',
            'Data from **/api/predict/load** — model analyzes historical patterns.',
            'Post availability prediction (**/api/predict/free**) — when each post becomes free.',
            'Duration prediction (**/api/predict/duration**) — estimated time for work type.',
            'In demo mode, synthetic data is displayed for demonstration purposes.',
            'Helps plan vehicle intake and worker allocation in advance.',
          ],
        },
        {
          heading: 'System Recommendations',
          items: [
            '**No-show (no_show)** — client did not arrive for scheduled time. Red badge. Trigger: WO with scheduled status, time passed.',
            '**Post free (post_free)** — post unused for 30+ minutes while unassigned WOs exist. Green.',
            '**Capacity available (capacity_available)** — free posts for additional orders. Blue.',
            '**Work overtime (work_overtime)** — work exceeds 120% of norm hours. Yellow.',
            '**Vehicle idle (vehicle_idle)** — car on post 15+ minutes but worker absent. Yellow.',
            'Click **"Acknowledge"** to confirm the recommendation was handled — it will disappear.',
            'Acknowledged recommendations are saved in database with acknowledgedAt timestamp.',
          ],
        },
        {
          heading: 'Recent Events',
          items: [
            'Feed of **10 latest** computer vision (CV) system events.',
            'Filter by category: **All**, **Vehicle** (entry/exit), **Post** (occupied/vacated), **Worker** (present/absent), **Work** (activity/idle).',
            'Each event shows type, zone/post, source camera, and timestamp.',
            'CV confidence level: green >= 90%, yellow 70-89%, red < 70%.',
            'Click event to open details with camera data.',
            'Data from **/api/events** sorted by createdAt desc.',
          ],
        },
        {
          heading: 'Data Refresh',
          items: [
            'In demo mode, data updates every **5 seconds** via polling (setInterval).',
            'In live mode, updates arrive via **Socket.IO** in real-time.',
            'Connection loss shows yellow indicator in header.',
            'Metrics period configurable: **24 hours**, **7 days**, **30 days** via ?period parameter.',
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
      intro: 'Визуальное расписание заказ-нарядов по постам за текущую смену. Главный инструмент мастера-приёмщика для управления загрузкой СТО. Поддерживает drag-n-drop, конфликт-детекцию и версионирование.',
      sections: [
        {
          heading: 'Как читать таймлайн',
          items: [
            'Горизонтальная ось — время смены (по умолчанию **08:00–20:00**, настраивается).',
            'Каждая строка — один пост (от **Поста 1** до **Поста 10**).',
            'Цветные блоки — заказ-наряды. **Длина блока = нормочасы** работы.',
            '**Красная вертикальная линия** — текущее время. Обновляется каждые 60 секунд.',
            'Блоки слева от красной линии — уже выполненные или текущие работы.',
            'Блоки обрезаются по границам смены — не выходят за **shiftStart/shiftEnd**.',
            'При наведении на блок появляется подсказка с номером ЗН, госномером и типом работ.',
          ],
        },
        {
          heading: 'Цвета блоков',
          items: [
            '**Зелёный** — работа завершена (status: completed).',
            '**Синий** — работа идёт прямо сейчас (status: in_progress).',
            '**Жёлтый/серый** — запланировано, но ещё не начато (status: scheduled).',
            '**Красная обводка** — работа просрочена: фактическое время превысило нормочасы.',
            '**Полосатый** — конфликт: два ЗН пересекаются по времени на одном посту.',
            '**Бледный/прозрачный** — отменённый заказ-наряд (status: cancelled).',
          ],
        },
        {
          heading: 'Статистика смены (панель сверху)',
          items: [
            '**Занято/Свободно** — текущее соотношение постов.',
            '**Завершённые ЗН** — количество выполненных заказ-нарядов за смену.',
            '**Нормочасы** — суммарные нормочасы всех ЗН на сегодня.',
            '**Время простоя** — сколько часов посты стояли пустыми (idleTime).',
            '**Просроченные** — количество ЗН, вышедших за нормативное время (overdueTime).',
            '**«Турбо»** — ЗН, завершённые быстрее нормы (savedTime). Хороший показатель эффективности.',
          ],
        },
        {
          heading: 'Перетаскивание (drag-n-drop)',
          items: [
            'Перетащите блок ЗН **горизонтально** — изменить время начала (шаг **15 минут**).',
            'Перетащите **вертикально** — перенести на другой пост.',
            'При конфликте блок подсвечивается красным с полосатым паттерном.',
            'Нажмите **«Сохранить»** чтобы зафиксировать изменения на сервере.',
            'Конфликты версий (ошибка **409**) — кто-то изменил расписание одновременно с вами. Обновите страницу.',
            'Перетаскивание возможно только для ЗН со статусом **scheduled** — запущенные и завершённые нельзя двигать.',
          ],
        },
        {
          heading: 'Нераспределённые ЗН (таблица внизу)',
          items: [
            'Список заказ-нарядов, которые **не назначены** на пост.',
            'Отображает: номер ЗН, госномер, тип работ, нормочасы.',
            'Перетащите из таблицы на таймлайн — назначит на конкретный пост и время.',
            'ЗН сортируются по scheduledTime — самые срочные сверху.',
            'Если таблица пуста — все ЗН распределены по постам.',
          ],
        },
        {
          heading: 'Клик на блок (WorkOrderModal)',
          items: [
            'Открывает карточку ЗН: номер, госномер, марка/модель, тип работ.',
            'Показывает работника, мастера, нормочасы, фактическое время.',
            'Можно изменить статус: **Start**, **Pause**, **Resume**, **Complete**.',
            'Можно переназначить на другой пост.',
            'Видно историю изменений и версию документа.',
          ],
        },
        {
          heading: 'Настройки смены (ShiftSettings)',
          items: [
            'Открывается по иконке **шестерёнки** в правом верхнем углу.',
            'Время начала смены (shiftStart) — от 00:00 до 23:00.',
            'Время окончания смены (shiftEnd) — от 01:00 до 24:00.',
            'Количество отображаемых постов (1-10).',
            'Настройки сохраняются в **localStorage** (dashboardPostsSettings).',
          ],
        },
        {
          heading: 'Легенда',
          items: [
            'Расположена внизу таймлайна — объясняет значение каждого цвета.',
            'Также показывает значение полосатой заливки и красной обводки.',
            'Ссылка **«Текущая смена»** прокручивает таймлайн к текущему времени.',
          ],
        },
      ],
    },
    en: {
      title: 'Posts Timeline — Gantt Chart',
      intro: 'Visual work order schedule per post for the current shift. Primary tool for service advisors to manage STO workload. Supports drag-n-drop, conflict detection, and versioning.',
      sections: [
        {
          heading: 'How to read the timeline',
          items: [
            'Horizontal axis — shift time (default **08:00–20:00**, configurable).',
            'Each row — one post (**Post 1** through **Post 10**).',
            'Colored blocks — work orders. **Block length = norm hours**.',
            '**Red vertical line** — current time. Updates every 60 seconds.',
            'Blocks left of red line — completed or ongoing work.',
            'Blocks are clamped to shift boundaries — cannot overflow past **shiftStart/shiftEnd**.',
            'Hover over a block to see tooltip with WO number, plate, and work type.',
          ],
        },
        {
          heading: 'Block colors',
          items: [
            '**Green** — work completed (status: completed).',
            '**Blue** — work in progress right now (status: in_progress).',
            '**Yellow/gray** — scheduled but not yet started (status: scheduled).',
            '**Red outline** — overdue: actual time exceeded norm hours.',
            '**Striped** — conflict: two WOs overlap in time on same post.',
            '**Faded/transparent** — cancelled work order (status: cancelled).',
          ],
        },
        {
          heading: 'Shift statistics (top panel)',
          items: [
            '**Occupied/Free** — current ratio of posts.',
            '**Completed WOs** — number of finished work orders this shift.',
            '**Norm Hours** — total norm hours of all WOs for today.',
            '**Idle Time** — hours posts stood empty (idleTime).',
            '**Overdue** — WOs exceeding norm time (overdueTime).',
            '**"Turbo"** — WOs completed faster than norm (savedTime). Good efficiency indicator.',
          ],
        },
        {
          heading: 'Drag-and-drop',
          items: [
            'Drag WO block **horizontally** — change start time (**15 min** snap).',
            'Drag **vertically** — move to different post.',
            'Conflicts highlighted in red with striped pattern.',
            'Click **"Save"** to persist changes to server.',
            'Version conflicts (error **409**) — someone changed the schedule simultaneously. Refresh the page.',
            'Only **scheduled** WOs can be dragged — in-progress and completed are locked.',
          ],
        },
        {
          heading: 'Unassigned WOs (bottom table)',
          items: [
            'Work orders **not assigned** to any post.',
            'Shows: WO number, plate, work type, norm hours.',
            'Drag from table onto timeline to assign to specific post and time.',
            'WOs sorted by scheduledTime — most urgent at top.',
            'If table is empty — all WOs are distributed across posts.',
          ],
        },
        {
          heading: 'Click a block (WorkOrderModal)',
          items: [
            'Opens WO card: number, plate, brand/model, work type.',
            'Shows worker, master, norm hours, actual time.',
            'Can change status: **Start**, **Pause**, **Resume**, **Complete**.',
            'Can reassign to a different post.',
            'Shows change history and document version.',
          ],
        },
        {
          heading: 'Shift Settings (ShiftSettings)',
          items: [
            'Opens via **gear icon** in the top right corner.',
            'Shift start time (shiftStart) — from 00:00 to 23:00.',
            'Shift end time (shiftEnd) — from 01:00 to 24:00.',
            'Number of visible posts (1-10).',
            'Settings saved to **localStorage** (dashboardPostsSettings).',
          ],
        },
        {
          heading: 'Legend',
          items: [
            'Located below the timeline — explains what each color means.',
            'Also shows meaning of striped fill and red outline.',
            '**"Current shift"** link scrolls timeline to current time.',
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
      intro: 'Подробная аналитика по каждому посту: загрузка, эффективность, история ЗН, работники. Используйте для анализа производительности и выявления узких мест.',
      sections: [
        {
          heading: 'Выбор периода',
          items: [
            'Кнопки быстрого выбора: **Сегодня**, **Вчера**, **Неделя**, **Месяц**.',
            '**Произвольный диапазон дат** — два поля для точного указания периода анализа.',
            'Все метрики, графики и таблицы пересчитываются при смене периода.',
            'По умолчанию выбрано **«Сегодня»** при открытии страницы.',
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
            'Клик по строке — открытие панели деталей для этого поста.',
            'Строки с низкой загрузкой подсвечиваются бледным фоном.',
          ],
        },
      ],
    },
    en: {
      title: 'Posts Detail',
      intro: 'Detailed analytics per post: occupancy, efficiency, WO history, workers. Use to analyze performance and identify bottlenecks.',
      sections: [
        {
          heading: 'Period Selection',
          items: [
            'Quick select buttons: **Today**, **Yesterday**, **Week**, **Month**.',
            '**Custom date range** — two fields for precise analysis period.',
            'All metrics, charts, and tables recalculate on period change.',
            'Default is **"Today"** when the page opens.',
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
            'Click row — open detail panel for that post.',
            'Low-occupancy rows highlighted with faded background.',
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
      intro: 'Интерактивная карта станции техобслуживания на базе Konva (Canvas). Отображает все посты, зоны, камеры и автомобили в реальном времени.',
      sections: [
        {
          heading: 'Элементы на карте',
          items: [
            '**Здания (building)** — контуры строений СТО.',
            '**Посты (post)** — рабочие места механиков. Цвет зависит от статуса: зелёный=свободен, синий=в работе, серый=занят, жёлтый=простой.',
            '**Зоны (zone)** — области: ремонт, ожидание, въезд, парковка, свободная. Показывают количество авто.',
            '**Камеры (camera)** — позиции камер с направлением обзора.',
            '**Двери (door)** — входы и выходы в здания.',
            '**Стены (wall)** — внутренние перегородки.',
            '**Проезды (driveway)** — пути движения автомобилей.',
            '**Метки (label)** — текстовые надписи на карте.',
            '**Инфозоны (infozone)** — области с дополнительной информацией.',
          ],
        },
        {
          heading: 'Управление видимостью слоёв',
          items: [
            'Панель **«Слои»** в правом верхнем углу — переключатели для каждого типа элементов.',
            'Можно скрыть/показать: здания, проезды, посты, зоны, камеры, двери, стены, метки, инфозоны.',
            'Скрытие слоёв помогает уменьшить визуальный шум и сфокусироваться на нужном.',
            'Состояние слоёв сбрасывается при перезагрузке страницы.',
          ],
        },
        {
          heading: 'Навигация по карте',
          items: [
            '**Колёсико мыши** — масштабирование (zoom in/out).',
            '**Зажатая левая кнопка** — перетаскивание карты (pan).',
            'Кнопки **+/-** — пошаговое масштабирование.',
            'Кнопка **«На весь экран»** — развернуть карту на всё окно.',
            'Кнопка **«Сбросить»** — вернуть начальный масштаб и позицию.',
            'Карта имеет размер **46540x30690 мм** — реальные пропорции СТО.',
          ],
        },
        {
          heading: 'Интерактивность',
          items: [
            '**Клик на пост** — модальное окно с деталями: номер, статус, госномер авто, работник, время.',
            '**Клик на зону** — информация о зоне: тип, количество авто, список госномеров.',
            '**Клик на камеру** — открытие HLS-стрима в модальном окне (CameraStreamModal).',
            'Все модальные окна закрываются по клику вне области или кнопке X.',
          ],
        },
        {
          heading: 'Обновление данных',
          items: [
            'В **live-режиме** данные обновляются каждые **10 секунд** через polling.',
            'В **демо-режиме** обновление каждые **5 секунд**.',
            'Статусы постов приходят из **/api/posts**, сессии из **/api/sessions/active**.',
            'Карта загружается из **/api/map-layout** (последняя сохранённая версия).',
          ],
        },
        {
          heading: 'Панель статистики',
          items: [
            'Внизу или сбоку карты — сводка по постам: свободных, занятых, в работе.',
            'Общее количество автомобилей на территории.',
            'Цветовые индикаторы дублируют статусы на карте.',
          ],
        },
      ],
    },
    en: {
      title: 'STO Map — Live Overview',
      intro: 'Interactive service station map powered by Konva (Canvas). Displays all posts, zones, cameras, and vehicles in real-time.',
      sections: [
        {
          heading: 'Map Elements',
          items: [
            '**Buildings (building)** — outlines of STO structures.',
            '**Posts (post)** — mechanic workstations. Color by status: green=free, blue=active work, gray=occupied, yellow=idle.',
            '**Zones (zone)** — areas: repair, waiting, entry, parking, free. Show vehicle count.',
            '**Cameras (camera)** — camera positions with viewing direction.',
            '**Doors (door)** — building entrances and exits.',
            '**Walls (wall)** — interior partitions.',
            '**Driveways (driveway)** — vehicle movement paths.',
            '**Labels (label)** — text annotations on the map.',
            '**Infozones (infozone)** — areas with additional information.',
          ],
        },
        {
          heading: 'Layer Visibility Controls',
          items: [
            '**"Layers"** panel in top right — toggles for each element type.',
            'Can hide/show: buildings, driveways, posts, zones, cameras, doors, walls, labels, infozones.',
            'Hiding layers reduces visual clutter and helps focus on what matters.',
            'Layer state resets on page reload.',
          ],
        },
        {
          heading: 'Map Navigation',
          items: [
            '**Mouse wheel** — zoom in/out.',
            '**Left button hold** — drag/pan the map.',
            '**+/-** buttons — step zoom.',
            '**"Fullscreen"** button — expand map to fill window.',
            '**"Reset"** button — return to initial zoom and position.',
            'Map size is **46540x30690 mm** — real STO proportions.',
          ],
        },
        {
          heading: 'Interactivity',
          items: [
            '**Click post** — modal with details: number, status, plate, worker, time.',
            '**Click zone** — zone info: type, vehicle count, plate list.',
            '**Click camera** — opens HLS stream in modal (CameraStreamModal).',
            'All modals close on outside click or X button.',
          ],
        },
        {
          heading: 'Data Updates',
          items: [
            'In **live mode**, data updates every **10 seconds** via polling.',
            'In **demo mode**, updates every **5 seconds**.',
            'Post statuses from **/api/posts**, sessions from **/api/sessions/active**.',
            'Map layout loaded from **/api/map-layout** (latest saved version).',
          ],
        },
        {
          heading: 'Statistics Panel',
          items: [
            'Below or beside the map — post summary: free, occupied, active work.',
            'Total vehicles on premises.',
            'Color indicators mirror map post statuses.',
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
      intro: 'Полнофункциональный визуальный редактор планировки СТО. Позволяет размещать здания, посты, зоны, камеры и другие элементы с помощью drag-n-drop. Поддерживает отмену, версионирование и экспорт.',
      sections: [
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
      ],
    },
    en: {
      title: 'STO Map Editor',
      intro: 'Full-featured visual layout editor for the STO. Place buildings, posts, zones, cameras and other elements via drag-n-drop. Supports undo, versioning, and export.',
      sections: [
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
      ],
    },
  },

  // ────────────────────────────
  // СЕССИИ
  // ────────────────────────────
  sessions: {
    ru: {
      title: 'Сессии автомобилей',
      intro: 'Управление сессиями автомобилей на территории СТО. Сессия начинается при въезде авто (камера фиксирует госномер) и завершается при выезде. Отключена в live-режиме.',
      sections: [
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
      ],
    },
    en: {
      title: 'Vehicle Sessions',
      intro: 'Manage vehicle sessions on STO premises. A session starts when a car enters (camera captures plate) and ends when it exits. Disabled in live mode.',
      sections: [
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
      ],
    },
  },

  // ────────────────────────────
  // ЗАКАЗ-НАРЯДЫ
  // ────────────────────────────
  workOrders: {
    ru: {
      title: 'Заказ-наряды',
      intro: 'Управление заказ-нарядами (ЗН) — основными документами работы СТО. Поддерживает поиск, фильтрацию, CSV-импорт и управление жизненным циклом. Отключена в live-режиме.',
      sections: [
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
      ],
    },
    en: {
      title: 'Work Orders',
      intro: 'Manage work orders (WOs) — the core STO work documents. Supports search, filtering, CSV import, and lifecycle management. Disabled in live mode.',
      sections: [
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
      ],
    },
  },

  // ────────────────────────────
  // ЖУРНАЛ СОБЫТИЙ
  // ────────────────────────────
  events: {
    ru: {
      title: 'Журнал событий',
      intro: 'Лента всех событий от системы компьютерного зрения (CV). Камеры фиксируют движение автомобилей, присутствие работников и активность на постах. Каждое событие имеет уровень уверенности (confidence).',
      sections: [
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
          ],
        },
      ],
    },
    en: {
      title: 'Event Log',
      intro: 'Feed of all computer vision (CV) system events. Cameras track vehicle movement, worker presence, and post activity. Each event has a confidence level.',
      sections: [
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
      intro: 'Комплексная аналитика работы СТО с 8 типами графиков, сравнением периодов и экспортом в XLSX/PDF/PNG. Период анализа: сегодня, 7 дней или 30 дней.',
      sections: [
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
      ],
    },
    en: {
      title: 'Analytics',
      intro: 'Comprehensive STO analytics with 8 chart types, period comparison, and XLSX/PDF/PNG export. Analysis period: today, 7 days, or 30 days.',
      sections: [
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
      ],
    },
  },

  // ────────────────────────────
  // КАМЕРЫ
  // ────────────────────────────
  cameras: {
    ru: {
      title: 'Камеры видеонаблюдения',
      intro: 'Управление и просмотр камер видеонаблюдения СТО. 16 камер (CAM 00-15) с HLS-стримингом, группировкой по зонам и отслеживанием статуса online/offline. Отключена в live-режиме.',
      sections: [
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
      ],
    },
    en: {
      title: 'Surveillance Cameras',
      intro: 'Manage and view STO surveillance cameras. 16 cameras (CAM 00-15) with HLS streaming, zone grouping, and online/offline status tracking. Disabled in live mode.',
      sections: [
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
      ],
    },
  },

  // ────────────────────────────
  // МАППИНГ КАМЕР
  // ────────────────────────────
  cameraMapping: {
    ru: {
      title: 'Маппинг камер по зонам',
      intro: 'Настройка привязки камер к зонам с указанием приоритетов. Определяет, какие камеры мониторят какие зоны и в каком порядке. 21 зона, 16 камер.',
      sections: [
        {
          heading: 'Список зон (левая панель)',
          items: [
            'Перечень всех **21 зоны** СТО.',
            'Рядом с каждой зоной — **счётчик** привязанных камер.',
            'Клик по зоне — открывает редактор камер справа.',
            'Зоны отсортированы по типу: ремонт, ожидание, въезд, парковка, свободная.',
          ],
        },
        {
          heading: 'Редактор камер (правая панель)',
          items: [
            'Для выбранной зоны — список всех **16 камер**.',
            '**Переключатель** — включить/выключить камеру для этой зоны.',
            '**Приоритет (P1-P10)** — чем выше приоритет, тем больше «вес» данных с этой камеры.',
            'P1 = минимальный приоритет, P10 = максимальный.',
            'Камера может быть привязана к нескольким зонам с разными приоритетами.',
          ],
        },
        {
          heading: 'Матрица покрытия',
          items: [
            'Таблица **зоны × камеры** — визуальная матрица привязок.',
            'Цвет ячейки зависит от приоритета: тёмный = высокий, светлый = низкий, пустой = нет привязки.',
            'Помогает увидеть общую картину покрытия: какие зоны хорошо покрыты, какие нет.',
            'Выявляет «слепые зоны» — зоны без камер.',
          ],
        },
        {
          heading: 'Сохранение',
          items: [
            'Кнопка **«Сохранить»** — сохраняет текущую конфигурацию.',
            'Кнопка **«Сбросить»** — откатить к последней сохранённой версии.',
            'Данные сохраняются в **localStorage** (cameraMappingData) и на сервер.',
            'Изменения вступают в силу немедленно после сохранения.',
          ],
        },
        {
          heading: 'Влияние на систему',
          items: [
            'Маппинг определяет, какие камеры используются для распознавания в каждой зоне.',
            'Высокий приоритет = камера используется первой для подтверждения событий.',
            'Корректная настройка повышает точность (confidence) событий CV.',
            'При добавлении новой камеры — не забудьте обновить маппинг.',
          ],
        },
      ],
    },
    en: {
      title: 'Camera Zone Mapping',
      intro: 'Configure camera-to-zone assignments with priorities. Determines which cameras monitor which zones and in what order. 21 zones, 16 cameras.',
      sections: [
        {
          heading: 'Zone List (left panel)',
          items: [
            'List of all **21 STO zones**.',
            'Next to each zone — **counter** of assigned cameras.',
            'Click a zone — opens camera editor on the right.',
            'Zones sorted by type: repair, waiting, entry, parking, free.',
          ],
        },
        {
          heading: 'Camera Editor (right panel)',
          items: [
            'For selected zone — list of all **16 cameras**.',
            '**Toggle** — enable/disable camera for this zone.',
            '**Priority (P1-P10)** — higher priority = more weight for data from this camera.',
            'P1 = minimum priority, P10 = maximum.',
            'A camera can be assigned to multiple zones with different priorities.',
          ],
        },
        {
          heading: 'Coverage Matrix',
          items: [
            '**Zones x Cameras** table — visual assignment matrix.',
            'Cell color depends on priority: dark = high, light = low, empty = no assignment.',
            'Helps see overall coverage: which zones are well-covered, which are not.',
            'Reveals "blind spots" — zones without cameras.',
          ],
        },
        {
          heading: 'Saving',
          items: [
            '**"Save"** button — saves current configuration.',
            '**"Reset"** button — revert to last saved version.',
            'Data saved to **localStorage** (cameraMappingData) and server.',
            'Changes take effect immediately after saving.',
          ],
        },
        {
          heading: 'System Impact',
          items: [
            'Mapping determines which cameras are used for recognition in each zone.',
            'High priority = camera used first for event confirmation.',
            'Correct setup improves CV event confidence.',
            'When adding a new camera — remember to update the mapping.',
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
      intro: 'Интеграция с системой 1С через импорт Excel-файлов. Три раздела: статистика, планирование, работники. Автоматическое определение типа данных по заголовкам. Поддержка форматов XLSX, XLS, CSV.',
      sections: [
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
      ],
    },
    en: {
      title: '1C Data — Import and Analytics',
      intro: 'Integration with 1C system via Excel file import. Three sections: statistics, planning, workers. Auto-detection of data type by column headers. Supports XLSX, XLS, CSV formats.',
      sections: [
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
      ],
    },
  },

  // ────────────────────────────
  // ПОЛЬЗОВАТЕЛИ
  // ────────────────────────────
  users: {
    ru: {
      title: 'Управление пользователями',
      intro: 'CRUD-управление пользователями системы. Назначение ролей, настройка доступа к страницам и элементам интерфейса. Только для администраторов.',
      sections: [
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
            'Страницы: dashboard, dashboardPosts, postsDetail, map, sessions, workOrders, events, analytics, cameras, cameraMapping, data1c, users, shifts, audit, myPost, mapEditor, health, reportSchedule, workerStats, liveDebug, techDocs.',
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
      ],
    },
    en: {
      title: 'User Management',
      intro: 'CRUD user management. Role assignment, page access, and UI element visibility configuration. Admin only.',
      sections: [
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
            'Pages: dashboard, dashboardPosts, postsDetail, map, sessions, workOrders, events, analytics, cameras, cameraMapping, data1c, users, shifts, audit, myPost, mapEditor, health, reportSchedule, workerStats, liveDebug, techDocs.',
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
      ],
    },
  },

  // ────────────────────────────
  // СМЕНЫ
  // ────────────────────────────
  shifts: {
    ru: {
      title: 'Управление сменами',
      intro: 'Планирование и управление рабочими сменами. Недельный календарь с назначением работников на посты. Контроль конфликтов и формирование актов приёма-передачи.',
      sections: [
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
            '**Синий** — запланированная смена (planned).',
            '**Зелёный** — активная смена (active) — идёт прямо сейчас.',
            '**Серый** — завершённая смена (completed).',
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
      ],
    },
    en: {
      title: 'Shift Management',
      intro: 'Plan and manage work shifts. Weekly calendar with worker-to-post assignment. Conflict detection and handover act generation.',
      sections: [
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
            '**Blue** — planned shift.',
            '**Green** — active shift — happening right now.',
            '**Gray** — completed shift.',
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
      ],
    },
  },

  // ────────────────────────────
  // АУДИТ
  // ────────────────────────────
  audit: {
    ru: {
      title: 'Аудит-лог',
      intro: 'Журнал всех действий пользователей в системе: создание, изменение и удаление записей. Хранит «до» и «после» для каждого изменения. Только для администраторов.',
      sections: [
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
      ],
    },
    en: {
      title: 'Audit Log',
      intro: 'Log of all user actions in the system: creates, updates, and deletes. Stores "before" and "after" for each change. Admin only.',
      sections: [
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
      ],
    },
  },

  // ────────────────────────────
  // МОЙ ПОСТ (Механик)
  // ────────────────────────────
  myPost: {
    ru: {
      title: 'Мой пост — Рабочий экран механика',
      intro: 'Персональный экран для механика. Показывает назначенный пост, текущий заказ-наряд, таймер работы и крупные кнопки управления. Оптимизирован для сенсорных экранов. Отключён в live-режиме.',
      sections: [
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
      ],
    },
    en: {
      title: 'My Post — Mechanic Screen',
      intro: 'Personal screen for mechanics. Shows assigned post, current work order, work timer, and large control buttons. Optimized for touch screens. Disabled in live mode.',
      sections: [
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
      ],
    },
  },

  // ────────────────────────────
  // ЗДОРОВЬЕ СИСТЕМЫ
  // ────────────────────────────
  health: {
    ru: {
      title: 'Здоровье системы',
      intro: 'Мониторинг состояния всех компонентов системы: сервер, база данных, синхронизация 1С, диск, камеры. Автообновление каждые 30 секунд. Только для администраторов.',
      sections: [
        {
          heading: 'Общий статус',
          items: [
            '**Зелёный** — все компоненты работают нормально.',
            '**Красный** — есть проблемы в одном или нескольких компонентах.',
            '**Жёлтый** — предупреждения (например, мало места на диске).',
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
            '**Зелёный** — камера online, стрим доступен.',
            '**Красный** — камера offline.',
            'Проверка каждые **30 секунд** через cameraHealthCheck.',
            'При offline > 5 минут — рекомендация администратору.',
          ],
        },
      ],
    },
    en: {
      title: 'System Health',
      intro: 'Monitor all system component status: server, database, 1C sync, disk, cameras. Auto-refresh every 30 seconds. Admin only.',
      sections: [
        {
          heading: 'Overall Status',
          items: [
            '**Green** — all components running normally.',
            '**Red** — issues in one or more components.',
            '**Yellow** — warnings (e.g., low disk space).',
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
            '**Green** — camera online, stream available.',
            '**Red** — camera offline.',
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
      intro: 'Настройка автоматической генерации и отправки отчётов. Отчёты формируются по расписанию (ежедневно/еженедельно), экспортируются в XLSX и отправляются в Telegram.',
      sections: [
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
      ],
    },
    en: {
      title: 'Report Schedule',
      intro: 'Configure automatic report generation and delivery. Reports generated on schedule (daily/weekly), exported as XLSX, and sent to Telegram.',
      sections: [
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
      ],
    },
  },

  // ────────────────────────────
  // СТАТИСТИКА РАБОТНИКА
  // ────────────────────────────
  workerStats: {
    ru: {
      title: 'Статистика работника',
      intro: 'Персональная аналитика по конкретному работнику. Доступ через URL с параметром workerName. Показывает KPI, графики выработки, распределение по видам работ и последние ЗН.',
      sections: [
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
      ],
    },
    en: {
      title: 'Worker Statistics',
      intro: 'Personal analytics for a specific worker. Accessed via URL with workerName parameter. Shows KPI, output charts, work type distribution, and recent WOs.',
      sections: [
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
      ],
    },
  },

  // ────────────────────────────
  // LIVE DEBUG
  // ────────────────────────────
  liveDebug: {
    ru: {
      title: 'Live Debug — Отладка мониторинга',
      intro: 'Отладочная страница для live-режима. Показывает сырые данные от внешней CV-системы, состояния постов и зон, статусы камер и полную историю событий. Доступна только в live-режиме (красный стиль в сайдбаре).',
      sections: [
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
      ],
    },
    en: {
      title: 'Live Debug — Monitoring Debug',
      intro: 'Debug page for live mode. Shows raw data from external CV system, post/zone states, camera statuses, and full event history. Available only in live mode (red style in sidebar).',
      sections: [
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
      ],
    },
  },

  // ────────────────────────────
  // ТЕХНИЧЕСКАЯ ДОКУМЕНТАЦИЯ
  // ────────────────────────────
  techDocs: {
    ru: {
      title: 'Техническая документация',
      intro: 'Встроенная документация системы MetricsAiUp. 23 раздела технических описаний с оглавлением, поиском, экспортом в PDF и печатью. Двуязычная (RU/EN).',
      sections: [
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
      ],
    },
    en: {
      title: 'Technical Documentation',
      intro: 'Built-in MetricsAiUp system documentation. 23 technical sections with table of contents, search, PDF export, and printing. Bilingual (RU/EN).',
      sections: [
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
              <span dangerouslySetInnerHTML={{ __html: formatBold(item) }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Format **bold** text
function formatBold(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>');
}
