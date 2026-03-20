# MetricsAiUp v1.0

**Система мониторинга камер и оценки трудозатрат для СТО (автосервисов)**

Веб-приложение для просмотра live-видеопотоков с IP-камер наблюдения. Часть платформы MetricsApp для анализа производственных процессов и оценки трудозатрат.

---

## Стек технологий

| Компонент | Технология |
|-----------|-----------|
| Фронтенд | HTML/CSS/JS, [hls.js](https://github.com/video-dev/hls.js) |
| Бэкенд (API) | Node.js 20 (без фреймворков, чистый `http`) |
| Видеотранскодирование | FFmpeg (через `ffmpeg-static`) |
| Протокол камер | RTSP → HLS |
| Веб-сервер | Nginx (статика + reverse proxy) |
| Инфраструктура | Docker-контейнер на платформе Echelon |

## Архитектура

```
Браузер пользователя
    │
    ├── /cam-api/*  ──► Nginx (внешний) ──► Node.js :8181 ──► FFmpeg ──► RTSP-камера
    │                                          │
    ├── /hls/*      ──► Nginx (внешний) ──► Nginx :8080 ──► HLS-файлы на диске
    │                                                        (генерирует FFmpeg)
    └── /*          ──► Nginx (внешний) ──► Nginx :8080 ──► index.html (SPA)
```

**Как работает стрим:**
1. Пользователь нажимает "Старт" на карточке камеры
2. Фронтенд отправляет `POST /cam-api/stream/start/{camId}`
3. Node.js запускает FFmpeg-процесс: `RTSP → HLS` (copy codec, без перекодирования)
4. FFmpeg пишет `.m3u8` плейлист и `.ts` сегменты в `/project/hls/{camId}/`
5. Nginx раздаёт HLS-файлы, hls.js на фронте подхватывает поток
6. При нажатии "Стоп" — FFmpeg убивается, сегменты удаляются

## Быстрый старт

### Внутри контейнера

```bash
# Установить зависимости (ffmpeg-static)
npm install

# Запустить API-сервер камер
node server.js &

# Сервер слушает на порту 8181
# Статика раздаётся Nginx на порту 8080
```

### Настройка внешнего Nginx

В конфиг `dev.metricsavto.com` добавить **перед** общим `location /`:

```nginx
# API управления камерами
location /cam-api/ {
    proxy_pass http://<контейнер>:8181/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;
}

# HLS видеопоток
location /hls/ {
    proxy_pass http://<контейнер>:8080/hls/;
    proxy_set_header Host $host;
    proxy_buffering off;
    proxy_cache off;
    add_header Cache-Control "no-cache, no-store";
}
```

## API

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `POST` | `/api/stream/start/{camId}` | Запустить стрим камеры (запускает FFmpeg) |
| `POST` | `/api/stream/stop/{camId}` | Остановить стрим (убивает FFmpeg, чистит сегменты) |
| `GET`  | `/api/stream/status` | Статус всех камер `{ camId: { name, streaming } }` |

Через внешний Nginx API доступно по `/cam-api/...` (путь `/api/` занят основным бэкендом Metrics Companion).

## Добавление новой камеры

### 1. Добавить камеру в `server.js`

В объект `cameras` добавить новую запись:

```js
const cameras = {
    cam06: {
        name: 'CAM 06 — 3.6 СТО',
        rtspUrl: 'rtsp://user:password@IP:PORT/path/',
        ffmpeg: null,
        streaming: false,
        restartTimer: null
    },
    // Новая камера:
    cam07: {
        name: 'Камера 07 — Мойка',
        rtspUrl: 'rtsp://user:password@192.168.1.100:554/stream1',
        ffmpeg: null,
        streaming: false,
        restartTimer: null
    }
};
```

### 2. Добавить карточку в `index.html`

Скопировать блок `<div class="camera-card">` и заменить:
- `data-cam="cam07"` — ID камеры (должен совпадать с ключом в `cameras`)
- Название и зону в `.camera-name` и `.camera-zone`
- `onclick="streamStart('cam07')"` / `streamStop('cam07')`

### 3. Перезапустить сервер

```bash
pkill -f "node server.js"
node server.js &
```

## Формат RTSP URL

```
rtsp://логин:пароль@IP-адрес:порт/путь_к_потоку/
```

Спецсимволы в пароле нужно URL-кодировать: `@` → `%40`, `#` → `%23`, и т.д.

## Возможные проблемы и решения

### Стрим не запускается (кнопка "Старт" → ошибка)

**Проверить что Node-сервер запущен:**
```bash
ps aux | grep "node server" | grep -v grep
# Если пусто — запустить: node server.js &
```

**Проверить доступность камеры из контейнера:**
```bash
timeout 5 ffmpeg -rtsp_transport tcp -i "rtsp://..." -t 1 -f null - 2>&1 | tail -5
```
Если `No route to host` — камера недоступна из сети контейнера. Нужно настроить маршрутизацию (VPN, docker network, проброс портов).

### HLS возвращает HTML вместо видео

Внешний Nginx перехватывает `/hls/` и отдаёт SPA. Убедиться что `location /hls/` настроен в конфиге внешнего Nginx и стоит перед `location /`.

### FFmpeg падает в цикле перезапусков

Посмотреть логи:
```bash
tail -50 /tmp/server.log
```
Частые причины:
- **"No route to host"** — сеть, камера недоступна
- **"Invalid data / no frame"** — битый поток. Убедиться что используется `-c:v copy` (без перекодирования) и `-err_detect ignore_err`
- **"Connection refused"** — неверный порт RTSP или камера выключена

### CORS-ошибки в браузере

Фронтенд должен обращаться к API через **относительные пути** (`/cam-api/...`), а не напрямую на порт 8181. Прямое обращение на другой порт блокируется браузером.

### После пересоздания контейнера всё сломалось

1. Перезапустить `node server.js`
2. Проверить что внешний Nginx проксирует `/cam-api/` и `/hls/`
3. Проверить сетевую доступность камер

## Структура проекта

```
/project/
├── index.html          # Фронтенд — страница камер
├── server.js           # API-сервер (Node.js) — управление FFmpeg
├── package.json        # Зависимости (ffmpeg-static)
├── .gitignore          # node_modules, hls/, core.*
├── hls/                # HLS-сегменты (генерируются FFmpeg, не в git)
│   └── cam06/
│       ├── stream.m3u8
│       └── seg_*.ts
└── README.md
```

## Git-воркфлоу

- `main` — основная ветка, стабильный код
- Каждый пользователь работает в своей ветке (например `admin`)
- Мерж в `main` по готовности

## Лицензия

MetricsApp (c) 2026. Внутренний проект.
