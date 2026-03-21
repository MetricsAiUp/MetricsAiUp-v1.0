# Project Configuration

## Environment
- You are running inside a Docker container as part of the Metrics Companion platform
- Your working directory is /project — ALL files must be created here
- NEVER write files outside /project (e.g. /home/developer/)
- The project directory is served via Nginx on port 8080 inside this container
- Domain: dev.metricsavto.com

## Available Runtimes
- Node.js 20 (npm, npx available)
- Python 3.11 (python command)
- PHP 8.2 (php command)
- Go 1.22 (go command)
- git, curl, wget, build-essential

## Public URLs (ВАЖНО!)
Результаты работы доступны публично по следующим ссылкам:

- **Порт 8080 (Nginx, по умолчанию):**
  https://dev.metricsavto.com/p//
  https://dev.metricsavto.com/api/projects//preview/

- **Любой другой порт (Express, Vite, и т.д.):**
  https://dev.metricsavto.com/p//{PORT}/
  Пример: https://dev.metricsavto.com/p//3001/

- **API на другом порту:**
  https://dev.metricsavto.com/p//{PORT}/api/endpoint
  Пример: https://dev.metricsavto.com/p//3001/api/health

Где {PORT} — любой порт, который слушает сервер внутри контейнера.

WebSocket (Socket.IO) тоже проксируется автоматически.

Авторизация НЕ требуется — ссылки публичные, доступны кому угодно.

Когда пользователь просит ссылку или спрашивает как посмотреть результат — давай ему эти URL.

## Web Preview
- Static files in /project are served automatically at port 8080 (Nginx)
- For dev servers, можно использовать ЛЮБОЙ порт (3000, 3001, 5173, 8080, и т.д.)
- Dev server должен слушать на 0.0.0.0 (не localhost/127.0.0.1), иначе не будет доступен извне
- Пользователь видит результат через iframe или по прямой ссылке

## Autostart
- Если нужно автоматически запускать сервер при старте контейнера — создай файл /project/.autostart.sh
- Он будет выполнен от имени developer при каждом запуске контейнера
- Пример:
  ```bash
  #!/bin/bash
  cd /project && node server.js > /tmp/server.log 2>&1 &
  ```

## Git & SSH
- SSH-ключ для git push уже настроен в /home/developer/.ssh/
- Публичный ключ: cat /home/developer/.ssh/id_ed25519.pub
- Добавь его в GitHub → Settings → Deploy keys для доступа к репозиторию
- Git user и branch настраиваются автоматически платформой

## Guidelines
- Always create files in /project directory
- When building web apps, create index.html as the entry point
- If you create a dev server, bind to 0.0.0.0 (NOT localhost)
- Commit meaningful changes with git when appropriate
- Давай пользователю публичные ссылки когда он спрашивает как посмотреть результат
