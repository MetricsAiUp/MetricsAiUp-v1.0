# MetricsAiUp — Система мониторинга СТО

## Среда
- Docker-контейнер, рабочая директория: `/project`
- Nginx на порту 8080 раздаёт статику из `/project`
- Домен: `dev.metricsavto.com`
- Node.js 20, Python 3.11, PHP 8.2, Go 1.22, git, curl, wget

## Публичные URL
- **Основной:** `https://dev.metricsavto.com/p//`
- **Другой порт:** `https://dev.metricsavto.com/p//{PORT}/`
- WebSocket проксируется. Авторизация не нужна.

## Стек проекта
- **Frontend:** React 18 + Vite, Tailwind CSS, Recharts, react-konva, react-i18next (RU/EN)
- **Роутинг:** HashRouter (React Router v6)
- **Иконки:** Lucide React (SVG)
- **Дизайн:** Glassmorphism, тёмная + светлая тема (CSS Variables)
- **API:** Статичные JSON файлы в `/project/api/`, Nginx раздаёт
- **Состояние:** React Context (Auth, Theme) + localStorage
- **Карта СТО:** react-konva (Canvas)

## Архитектура
```
/project
├── frontend/src/
│   ├── App.jsx              # Роутинг
│   ├── components/
│   │   ├── Layout.jsx       # Sidebar + Header + Outlet
│   │   ├── Sidebar.jsx      # Навигация (permission-based)
│   │   ├── STOMap.jsx        # Карта СТО (react-konva)
│   │   └── HelpButton.jsx
│   ├── pages/
│   │   ├── Dashboard.jsx     # Главный дашборд (KPI, рекомендации, события)
│   │   ├── DashboardPosts.jsx # Дашборд постов (Gantt-таймлайн ЗН)
│   │   ├── PostsDetail.jsx   # Аналитика по постам (master-detail)
│   │   ├── MapView.jsx       # Карта СТО + модальное окно поста
│   │   ├── Sessions.jsx      # Сессии авто
│   │   ├── WorkOrders.jsx    # Заказ-наряды
│   │   ├── Events.jsx        # Журнал событий
│   │   ├── Analytics.jsx     # Аналитика (Recharts)
│   │   ├── Data1C.jsx        # Данные из 1С Альфа-Авто
│   │   ├── Cameras.jsx       # Камеры
│   │   └── CameraMapping.jsx # Разметка камер
│   ├── contexts/             # AuthContext, ThemeContext
│   ├── hooks/useSocket.js    # usePolling
│   └── i18n/                 # ru.json, en.json
├── api/                      # 20+ JSON файлов (моки)
├── assets/                   # Билд-ассеты
└── index.html                # Entry point (Vite build)
```

## Карта СТО (STOMap.jsx)
- Верхний ряд постов: 5, 6, 7, 8, 9
- Нижний ряд постов: 1, 2, 3, 4, 10
- Зона проезда между рядами
- Въезд/выезд слева напротив проезда
- Парковка по бокам от въезда (сверху и снизу)
- Камеры 10шт в зоне проезда и на стенах
- По клику на пост — модальное окно с инфой + кнопка перехода на страницу Посты

## API (моки в /project/api/)
- `auth-login.json`, `auth-me.json` — авторизация
- `posts.json`, `zones.json`, `sessions.json`, `events.json` — основные данные
- `work-orders.json` — заказ-наряды из 1С
- `dashboard-posts.json` — данные для Gantt-таймлайна
- `posts-analytics.json` — аналитика по постам
- `1c-planning.json`, `1c-workers.json`, `1c-stats.json` — данные Альфа-Авто
- `analytics-history.json`, `cameras.json`, `zones-cameras.json` и др.

## Билд и деплой
```bash
cd /project/frontend && npm run build
cp -r dist/* /project/
```
Nginx раздаёт из `/project/` автоматически.

## Правила
- **НЕ делай git commit и git push без прямой команды пользователя**
- Все файлы только в `/project`
- Dev server на `0.0.0.0`
- i18n: все тексты через `t('key')`, оба языка (ru.json + en.json)
- Иконки: только Lucide React, без emoji
- API: `fetchApi('name')` → fetch `api/name.json`
