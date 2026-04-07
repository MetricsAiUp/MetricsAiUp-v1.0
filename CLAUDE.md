# MetricsAiUp — Система мониторинга СТО

## Среда
- Docker-контейнер, рабочая директория: `/project`
- **Домен:** `artisom.dev.metricsavto.com`
- Все порты контейнера (80-65535) проброшены 1:1 на VPS `artisom.dev.metricsavto.com`
- Node.js 20, Python 3.11, PHP 8.2, Go 1.22, git, curl, wget

## Публичные URL и доступ
- **Frontend:** `https://artisom.dev.metricsavto.com/` (Nginx на порту 8080 внутри → VPS проксирует)
- **Backend API:** `https://artisom.dev.metricsavto.com:3001/api/` (Express HTTP)
- **Backend HTTPS:** `https://artisom.dev.metricsavto.com:3444/api/` (Express HTTPS с SSL)
- **Любой порт:** `https://artisom.dev.metricsavto.com:{PORT}/`
- WebSocket проксируется. 

## ВАЖНО: Запуск серверов
- **Backend:** `cd /project/backend && node src/index.js` — слушает HTTP :3001 + HTTPS :3444
- **Frontend:** `cd /project/frontend && npm run build && cp -r dist/* /project/` — Nginx раздаёт статику
- **НЕ ИСПОЛЬЗОВАТЬ localStorage как fallback для сохранения данных** — всегда работать через бэкенд API
- При ошибках API — чинить бэкенд, а не обходить проблему

## Стек проекта
- **Frontend:** React 19 + Vite 8, Tailwind CSS 4, Recharts 3, react-konva 19, react-i18next (RU/EN)
- **Backend:** Express 4 + Prisma ORM + SQLite (HTTP :3001 + HTTPS :3444)
- **Роутинг:** HashRouter (React Router v7)
- **Иконки:** Lucide React (SVG), без emoji
- **Дизайн:** Glassmorphism, тёмная + светлая тема (CSS Variables)
- **Состояние:** React Context (Auth, Theme) + localStorage
- **Карта СТО:** react-konva (Canvas), 860x460px
- **Excel-парсинг:** xlsx (SheetJS) — загрузка файлов из 1С Альфа-Авто

## Архитектура
```
/project
├── frontend/src/
│   ├── App.jsx              # HashRouter, 13 маршрутов + ProtectedRoute
│   ├── main.jsx             # React.StrictMode + createRoot
│   ├── components/
│   │   ├── Layout.jsx       # Sidebar + Header (тема, язык, юзер) + Outlet
│   │   ├── Sidebar.jsx      # Навигация, фильтрация по user.pages
│   │   ├── STOMap.jsx        # Карта СТО (react-konva), 10 постов, 10 камер
│   │   └── HelpButton.jsx   # Контекстная справка (9 разделов)
│   ├── pages/
│   │   ├── Dashboard.jsx     # KPI-карточки, рекомендации, события (usePolling 5с)
│   │   ├── DashboardPosts.jsx # Gantt-таймлайн ЗН по постам (963 LOC)
│   │   ├── PostsDetail.jsx   # Аналитика по постам, master-detail (1169 LOC)
│   │   ├── MapView.jsx       # Карта СТО + модальные окна постов и камер
│   │   ├── Sessions.jsx      # Сессии авто с модалкой деталей
│   │   ├── WorkOrders.jsx    # Заказ-наряды из 1С
│   │   ├── Events.jsx        # Журнал событий с фильтрами
│   │   ├── Analytics.jsx     # 6 графиков Recharts (area, bar, pie)
│   │   ├── Data1C.jsx        # Данные 1С: Excel-импорт, 3 таба, пагинация, сортировка
│   │   ├── Cameras.jsx       # 10 камер, зоны покрытия
│   │   ├── CameraMapping.jsx # Маппинг камера↔зона, приоритеты
│   │   ├── Users.jsx         # CRUD пользователей, роли, доступ к страницам
│   │   └── Login.jsx         # Авторизация
│   ├── contexts/
│   │   ├── AuthContext.jsx   # Авторизация, API-клиент, permissions, updateCurrentUser
│   │   └── ThemeContext.jsx  # Тема dark/light → CSS class + localStorage
│   ├── hooks/useSocket.js    # usePolling(callback, interval) — интервальный опрос
│   ├── utils/translate.js    # translateZone(), translatePost() — перевод названий
│   └── i18n/                 # ru.json, en.json (~197 ключей каждый)
├── backend/
│   ├── src/
│   │   ├── index.js          # Express сервер (порт 3001)
│   │   ├── routes/           # auth, zones, posts, events, sessions, workOrders, recommendations, dashboard
│   │   ├── middleware/auth.js # JWT верификация
│   │   ├── services/         # eventProcessor, recommendationEngine
│   │   └── config/           # socket.js, database.js (Prisma)
│   └── prisma/               # schema.prisma, миграции, seed
├── data/                     # 25 JSON файлов (моки) ← FRONTEND ЧИТАЕТ ОТСЮДА
├── api/                      # 22 JSON файлов (копия data/, НЕ используется фронтом)
├── assets/                   # Vite билд-ассеты (JS ~1.56MB, CSS ~24KB)
├── server.js                 # HLS-стриминг камер (порт 8181, FFmpeg RTSP→HLS)
└── index.html                # Entry point
```

## КРИТИЧНО: Загрузка данных (data flow)

### Два способа загрузки JSON:
1. **Через AuthContext `api.get()`** — трансформирует URL:
   - `/api/dashboard/overview` → `data/dashboard-overview.json`
   - `/api/sessions?status=completed` → `data/sessions-completed.json`
   - `/api/dashboard/metrics?period=7d` → `data/dashboard-metrics-7d.json`
2. **Через локальный `fetchApi()`** — прямой fetch:
   - `fetchApi('dashboard-posts')` → `data/dashboard-posts.json`
   - Используется в: DashboardPosts, PostsDetail, MapView, Users, Sidebar

### Кто как загружает:
| Страница | Источник данных |
|----------|----------------|
| Dashboard | `api.get('/api/dashboard/overview')`, `api.get('/api/recommendations')`, `api.get('/api/events')` |
| DashboardPosts | `fetchApi('dashboard-posts')` |
| PostsDetail | `fetchApi('posts-analytics')`, `fetchApi('dashboard-posts')` |
| MapView | `fetchApi('dashboard-posts')`, `fetchApi('posts')` |
| Sessions | `api.get('/api/sessions?status=...')`, `api.get('/api/work-orders')` |
| WorkOrders | `api.get('/api/work-orders')` |
| Analytics | `api.get('/api/analytics-history')` |
| Events | `api.get('/api/events?limit=50')` |
| Data1C | `api.get('/api/1c-stats')`, `api.get('/api/1c-planning')`, `api.get('/api/1c-workers')` + localStorage |
| Users | `fetchApi('users')` с fallback на localStorage |
| CameraMapping | Только localStorage (`cameraMappingData`) |
| Sidebar | `fetch('data/posts-analytics.json')` |

### ВАЖНО: JSON моки в `/project/data/`, НЕ в `/project/api/`!
- Nginx проксирует `/api/*` на backend (порты 3001→3000→3002)
- Backend не запущен → `/api/` возвращает ошибку
- Frontend читает из `/data/*.json` через `fetchJson()` с `BASE = './'`
- **При добавлении нового JSON мока — класть в `/project/data/`**

## localStorage ключи
| Ключ | Что хранит | Где используется |
|------|------------|------------------|
| `token` | JWT-токен (fake, base64) | AuthContext |
| `currentUser` | Объект текущего пользователя (pages, permissions) | AuthContext |
| `usersData` | Отредактированные пользователи (перезаписывает мок) | Users.jsx, AuthContext.login |
| `language` | `ru` / `en` | i18n, Login, Header |
| `theme` | `dark` / `light` | ThemeContext |
| `1c-imported-planning` | Импортированные данные планирования | Data1C.jsx |
| `1c-imported-workers` | Импортированные данные выработки | Data1C.jsx |
| `cameraMappingData` | Маппинг камер по зонам | CameraMapping.jsx |
| `dashboardPostsSettings` | Настройки таймлайна (смена, кол-во постов) | DashboardPosts.jsx |

**Приоритет:** localStorage > JSON мок (для users, 1C data). При сохранении пользователя через UI — обновляется и `usersData`, и `currentUser` (если это текущий юзер).

## Система доступа (RBAC)
- **Роли:** admin, manager, viewer, mechanic
- **Доступ к страницам:** массив `pages` у каждого пользователя
- **Sidebar** фильтрует по `user.pages.includes(pageId)` (admin видит всё)
- **При редактировании пользователя:** `updateCurrentUser()` обновляет сессию без перелогина
- **Маппинг pages → permissions:** `PAGE_PERMISSIONS` в AuthContext (для hasPermission)

## Карта СТО (STOMap.jsx)
- Верхний ряд постов: 5, 6, 7, 8, 9
- Нижний ряд постов: 1, 2, 3, 4, 10
- Зона проезда между рядами
- Въезд/выезд слева напротив проезда
- Парковка по бокам от въезда (сверху и снизу)
- Камеры 10шт в зоне проезда и на стенах
- По клику на пост — модальное окно с инфой + кнопка перехода на страницу Посты

## Данные 1С (Data1C.jsx)
- **3 таба:** Статистика, Планирование (60 записей, 16 колонок), Выработка (866 записей, 15 колонок)
- **Excel-импорт:** загрузка .xlsx через drag-n-drop, парсинг xlsx, проверка дублей, кнопка "Сохранить"
- **Дедупликация:** планирование по (номер + рабочее место + начало), выработка по (номер + сотрудник + дата начала)
- **Пагинация:** 25/50/100 строк на страницу, сортировка по всем колонкам

## Билд и деплой
```bash
cd /project/frontend && npm run build
cp -r dist/* /project/
```
Nginx раздаёт из `/project/` автоматически. Новый билд — новые хеши в assets/.

## Правила
- **НЕ делай git commit и git push без прямой команды пользователя**
- Все файлы только в `/project`
- Dev server на `0.0.0.0`
- i18n: все тексты через `t('key')`, оба языка (ru.json + en.json, ~197 ключей)
- Иконки: только Lucide React, без emoji
- JSON моки: класть в `/project/data/`, НЕ в `/project/api/`
- fetchJson: `${BASE}data/${path}.json` (BASE = './')
- При создании нового `fetchApi()` в компоненте — использовать путь `data/`, не `api/`

## Nginx конфигурация (/etc/nginx/sites-enabled/default)
- **Нет прав записи** (owner: root) — редактировать нельзя
- `/api/*` → proxy на backend (3001 → 3000 → 3002 fallback)
- `/socket.io/` → WebSocket proxy (тот же каскад портов)
- `/` → SPA fallback (`try_files $uri $uri/ /index.html`)
- `*.php` → PHP-FPM
- **Статические JSON в `/data/` не конфликтуют с proxy** (только `/api/` проксируется)

## Backend (запущен)
- Express 4 + Prisma ORM + SQLite (`backend/.env: DATABASE_URL=file:./dev.db`)
- JWT авторизация (bcryptjs, jsonwebtoken)
- Socket.IO для real-time
- 8 модулей маршрутов: auth, zones, posts, events, sessions, workOrders, recommendations, dashboard
- Порт: 3001 (настраивается через `.env`)
- Запуск: `cd /project/backend && npm run dev`

## Крупные файлы (кандидаты на рефакторинг)
- `PostsDetail.jsx` — 1169 LOC
- `DashboardPosts.jsx` — 963 LOC
- `Data1C.jsx` — 585 LOC
- `CameraMapping.jsx` — 458 LOC
- `STOMap.jsx` — 455 LOC

## SSL/HTTPS Сертификаты
SSL-сертификат для домена `artisom.dev.metricsavto.com` (Let's Encrypt) доступен в контейнере:
- **Сертификат (fullchain):** `/project/.ssl/fullchain.pem`
- **Приватный ключ:** `/project/.ssl/privkey.pem`
- **Домен:** `artisom.dev.metricsavto.com`
- **Истекает:** 2026-07-05

Используй эти файлы для настройки HTTPS в Express, nginx или любом другом сервере.

Пример для Express (Node.js):
```js
const https = require("https");
const fs = require("fs");
const app = require("./app"); // Express app

https.createServer({
  cert: fs.readFileSync("/project/.ssl/fullchain.pem"),
  key: fs.readFileSync("/project/.ssl/privkey.pem"),
}, app).listen(3001, "0.0.0.0");
```

Пример для nginx:
```nginx
server {
    listen 443 ssl;
    ssl_certificate /project/.ssl/fullchain.pem;
    ssl_certificate_key /project/.ssl/privkey.pem;
    ...
}
```

**ВАЖНО:** Все порты контейнера (80-65535) проброшены 1:1 на VPS `artisom.dev.metricsavto.com`. Если ты слушаешь на порту 3001 — он доступен как `https://artisom.dev.metricsavto.com:3001/`.
