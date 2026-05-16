import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// После деплоя у пользователя может быть открыт старый index-XXX.js, который
// ссылается на удалённые lazy-чанки (PostHistory-C5dzgAyV.js → 404 → text/html
// от SPA-fallback → "MIME type text/html"). Vite эмитит `vite:preloadError`
// при таком сбое — перезагружаем страницу, чтобы подтянуть актуальный
// index.html с новыми хэшами. Флаг защищает от цикла, если перезагрузка не
// помогла (например, чанк реально сломан).
window.addEventListener('vite:preloadError', () => {
  const KEY = '__vitePreloadReloadedAt';
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Unregister any previously installed Service Worker (caused stale cache issues)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}
