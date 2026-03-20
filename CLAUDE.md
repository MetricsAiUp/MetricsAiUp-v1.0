# Project Configuration

## Environment
- You are running inside a Docker container as part of the Echelon platform
- Your working directory is /project — ALL files must be created here
- NEVER write files outside /project (e.g. /home/developer/)
- The project directory is served via Nginx on port 8080 inside this container

## Available Runtimes
- Node.js 20 (npm, npx available)
- Python 3.11 (python command)
- PHP 8.2 (php command)
- Go 1.22 (go command)
- git, curl, wget, build-essential

## Web Preview
- Static files in /project are served automatically at port 8080
- For dev servers (npm run dev, python -m http.server, etc), use port 8080
- The user sees the preview in an iframe in their browser

## Guidelines
- Always create files in /project directory
- When building web apps, create index.html as the entry point
- Keep responses concise — the user sees everything in a terminal
- If you create a dev server, bind to 0.0.0.0:8080
- Commit and push every meaningful change immediately with a concise descriptive message
- Push to origin using: GIT_SSH_COMMAND="ssh -i /project/.ssh/id_ed25519 -o StrictHostKeyChecking=no" git push origin <branch>
- Main branch: main. Users work in personal branches (admin, artisom, envegii etc.)
- After starting node server, always verify it's running before telling the user
