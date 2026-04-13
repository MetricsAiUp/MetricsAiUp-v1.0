import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, Search, ChevronUp, BookOpen, Printer, Loader2 } from 'lucide-react';

const SECTIONS = [
  { id: 'overview', titleRu: '1. Обзор системы', titleEn: '1. System Overview' },
  { id: 'architecture', titleRu: '2. Архитектура', titleEn: '2. Architecture' },
  { id: 'infrastructure', titleRu: '3. Инфраструктура и деплой', titleEn: '3. Infrastructure & Deploy' },
  { id: 'database', titleRu: '4. База данных (22 модели)', titleEn: '4. Database (22 models)' },
  { id: 'api', titleRu: '5. Backend API (70+ эндпоинтов)', titleEn: '5. Backend API (70+ endpoints)' },
  { id: 'services', titleRu: '6. Backend Services', titleEn: '6. Backend Services' },
  { id: 'middleware', titleRu: '7. Middleware', titleEn: '7. Middleware' },
  { id: 'socketio', titleRu: '8. Socket.IO', titleEn: '8. Socket.IO' },
  { id: 'pages', titleRu: '9. Frontend — Страницы (20)', titleEn: '9. Frontend — Pages (20)' },
  { id: 'components', titleRu: '10. Frontend — Компоненты', titleEn: '10. Frontend — Components' },
  { id: 'contexts', titleRu: '11. Контексты (Auth, Theme, Toast)', titleEn: '11. Contexts (Auth, Theme, Toast)' },
  { id: 'hooks', titleRu: '12. Хуки', titleEn: '12. Hooks' },
  { id: 'utils', titleRu: '13. Утилиты', titleEn: '13. Utilities' },
  { id: 'rbac', titleRu: '14. RBAC — Система доступа', titleEn: '14. RBAC — Access Control' },
  { id: 'i18n', titleRu: '15. Интернационализация (i18n)', titleEn: '15. Internationalization (i18n)' },
  { id: 'pwa', titleRu: '16. PWA и Service Worker', titleEn: '16. PWA & Service Worker' },
  { id: 'hls', titleRu: '17. HLS Видеостриминг', titleEn: '17. HLS Video Streaming' },
  { id: 'integration1c', titleRu: '18. Интеграция с 1С', titleEn: '18. 1C Integration' },
  { id: 'testing', titleRu: '19. Тестирование', titleEn: '19. Testing' },
  { id: 'map', titleRu: '20. Физическая карта СТО', titleEn: '20. Physical STO Map' },
  { id: 'deps', titleRu: '21. Зависимости проекта', titleEn: '21. Project Dependencies' },
  { id: 'env', titleRu: '22. Переменные окружения', titleEn: '22. Environment Variables' },
  { id: 'seed', titleRu: '23. Seed-данные', titleEn: '23. Seed Data' },
];

function TocItem({ section, isRu, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left text-xs px-2 py-1 rounded transition-colors w-full truncate"
      style={{
        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
        background: isActive ? 'var(--accent-light)' : 'transparent',
        fontWeight: isActive ? 600 : 400,
      }}
    >
      {isRu ? section.titleRu : section.titleEn}
    </button>
  );
}

function Table({ headers, rows }) {
  return (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-2 py-1.5 font-semibold border-b" style={{ borderColor: 'var(--border-glass)', color: 'var(--text-primary)', background: 'var(--bg-secondary)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-2 py-1 border-b" style={{ borderColor: 'var(--border-glass)', color: 'var(--text-secondary)' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Code({ children }) {
  return (
    <pre className="text-xs p-3 rounded overflow-x-auto my-2" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
      <code>{children}</code>
    </pre>
  );
}

function SectionTitle({ id, children }) {
  return <h2 id={id} className="text-base font-bold mt-6 mb-3 pb-1 border-b scroll-mt-4" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-glass)' }}>{children}</h2>;
}

function Sub({ children }) {
  return <h3 className="text-sm font-semibold mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>{children}</h3>;
}

function P({ children }) {
  return <p className="text-xs mb-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{children}</p>;
}

function Badge({ children, color = 'var(--accent)' }) {
  return <span className="inline-block text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: color + '22', color, border: `1px solid ${color}44` }}>{children}</span>;
}

export default function TechDocs() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const contentRef = useRef(null);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [exporting, setExporting] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const generatedDate = '2026-04-13';

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > 300);
      const sectionEls = container.querySelectorAll('[id]');
      let current = 'overview';
      sectionEls.forEach(el => {
        if (el.getBoundingClientRect().top < 150) current = el.id;
      });
      if (SECTIONS.find(s => s.id === current)) setActiveSection(current);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const content = contentRef.current;
      if (!content) return;

      // Clone content into an unconstrained off-screen container
      // This avoids the parent flex container height clipping issue
      const clone = content.cloneNode(true);
      clone.style.cssText = `
        position: absolute; left: -9999px; top: 0;
        width: ${content.offsetWidth}px;
        overflow: visible; height: auto; max-height: none;
        padding: 24px; background: #0f172a; color: #e2e8f0;
      `;
      document.body.appendChild(clone);
      await new Promise(r => setTimeout(r, 200));

      const fullH = clone.scrollHeight;
      const fullW = clone.offsetWidth;

      // Render in vertical chunks of 2500px to stay within browser canvas limits
      const CHUNK = 2500;
      const chunks = [];
      for (let y = 0; y < fullH; y += CHUNK) {
        const h = Math.min(CHUNK, fullH - y);
        const c = await html2canvas(clone, {
          scale: 1.5,
          useCORS: true,
          logging: false,
          x: 0, y, width: fullW, height: h,
          windowWidth: fullW,
          windowHeight: fullH,
          scrollX: 0, scrollY: 0,
          backgroundColor: '#0f172a',
        });
        chunks.push(c);
      }

      document.body.removeChild(clone);

      // Build PDF page-by-page from chunks
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const m = 8;
      const usableW = pdfW - m * 2;
      const usableH = pdfH - m * 2;
      const cW = chunks[0].width;
      const scl = usableW / cW;
      const sliceH = Math.floor(usableH / scl);

      let pageNum = 0;
      for (const chunk of chunks) {
        let srcY = 0;
        while (srcY < chunk.height) {
          if (pageNum > 0) pdf.addPage();
          const h = Math.min(sliceH, chunk.height - srcY);
          const pg = document.createElement('canvas');
          pg.width = cW;
          pg.height = h;
          const ctx = pg.getContext('2d');
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, cW, h);
          ctx.drawImage(chunk, 0, srcY, cW, h, 0, 0, cW, h);
          pdf.addImage(pg.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, usableW, h * scl);
          srcY += h;
          pageNum++;
        }
      }

      pdf.save(`MetricsAiUp-TechDocs-${generatedDate}.pdf`);
    } catch (e) {
      console.error('PDF export error:', e);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => window.print();

  const filteredSections = search
    ? SECTIONS.filter(s =>
        (isRu ? s.titleRu : s.titleEn).toLowerCase().includes(search.toLowerCase())
      )
    : SECTIONS;

  return (
    <div className="flex gap-0 h-[calc(100vh-56px)]">
      {/* TOC Sidebar */}
      <div className="w-56 min-w-56 max-w-56 flex-shrink-0 glass-static p-3 flex flex-col gap-1 overflow-y-auto print:hidden" style={{ borderRight: '1px solid var(--border-glass)' }}>
        <div className="flex items-center gap-1.5 mb-2">
          <BookOpen size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
            {isRu ? 'Содержание' : 'Contents'}
          </span>
        </div>

        <div className="relative mb-2">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isRu ? 'Поиск...' : 'Search...'}
            className="w-full pl-6 pr-2 py-1 text-xs rounded"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
          />
        </div>

        <div className="flex flex-col gap-0.5">
          {filteredSections.map(s => (
            <TocItem
              key={s.id}
              section={s}
              isRu={isRu}
              isActive={activeSection === s.id}
              onClick={() => scrollToSection(s.id)}
            />
          ))}
        </div>

        <div className="mt-auto pt-3 flex flex-col gap-1.5">
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded font-medium transition-colors w-full"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
            {exporting
              ? (isRu ? 'Экспорт...' : 'Exporting...')
              : (isRu ? 'Скачать PDF' : 'Download PDF')}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded font-medium transition-colors w-full"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
          >
            <Printer size={12} />
            {isRu ? 'Печать' : 'Print'}
          </button>
          <div className="text-center mt-1" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            {isRu ? 'Создана' : 'Created'}: {generatedDate}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-6 print:p-2" style={{ background: 'var(--bg-primary)' }}>
        {/* Header */}
        <div className="mb-6 pb-4 border-b" style={{ borderColor: 'var(--border-glass)' }}>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            MetricsAiUp — {isRu ? 'Техническая документация' : 'Technical Documentation'}
          </h1>
          <div className="flex gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{isRu ? 'Версия' : 'Version'}: 1.0</span>
            <span>{isRu ? 'Дата' : 'Date'}: {generatedDate}</span>
            <span>{isRu ? 'Система мониторинга автосервиса' : 'Auto Service Monitoring System'}</span>
          </div>
        </div>

        {/* Section 1 — Overview */}
        <SectionTitle id="overview">{isRu ? '1. Обзор системы' : '1. System Overview'}</SectionTitle>
        <P>{isRu
          ? 'MetricsAiUp — полнофункциональная система мониторинга автосервиса (СТО), обеспечивающая real-time отслеживание автомобилей по 5 зонам и 10 постам, управление заказ-нарядами с полным жизненным циклом, интеграцию с 1С ERP, видеонаблюдение через 10 RTSP-камер с HLS-стримингом, AI-рекомендации, Telegram-бот, и PWA с push-уведомлениями.'
          : 'MetricsAiUp is a full-featured auto service (STO) monitoring system providing real-time vehicle tracking across 5 zones and 10 posts, work order lifecycle management, 1C ERP integration, video surveillance through 10 RTSP cameras with HLS streaming, AI recommendations, Telegram bot, and PWA with push notifications.'
        }</P>
        <P>{isRu
          ? 'Система спроектирована для трёх основных ролей пользователей: механиков (управление заказ-нарядами на постах, таймеры работ), менеджеров (планирование через Gantt-таймлайн, контроль загрузки, распределение ресурсов), и директоров (аналитика, KPI, стратегические отчёты). Администраторы имеют полный доступ ко всем функциям, включая управление пользователями, ролями и настройками видимости элементов интерфейса.'
          : 'The system is designed for three primary user roles: mechanics (managing work orders at posts, work timers), managers (planning via Gantt timeline, load monitoring, resource allocation), and directors (analytics, KPIs, strategic reports). Administrators have full access to all features, including user management, roles, and UI element visibility settings.'
        }</P>
        <P>{isRu
          ? 'Данные поступают из нескольких источников: система компьютерного зрения (CV) отправляет события через POST /api/events без авторизации, ERP 1С экспортирует XLSX-файлы с планированием и выработкой, камеры передают RTSP-потоки, а пользователи взаимодействуют через веб-интерфейс. Все данные агрегируются в единую SQLite базу через Prisma ORM и распространяются в real-time через Socket.IO.'
          : 'Data flows from multiple sources: the computer vision (CV) system sends events via POST /api/events without authentication, 1C ERP exports XLSX files with planning and production data, cameras transmit RTSP streams, and users interact through the web interface. All data is aggregated into a single SQLite database via Prisma ORM and distributed in real-time through Socket.IO.'
        }</P>
        <P>{isRu
          ? 'Фронтенд построен как SPA на React 19 с Vite 8, использует HashRouter для маршрутизации (20 lazy-loaded страниц), Tailwind CSS 4 для стилизации с поддержкой тёмной и светлой темы (glassmorphism-дизайн), Recharts для аналитических графиков, и Konva для интерактивной карты СТО. Бэкенд работает на Express 4 с двойным прослушиванием (HTTP :3001 + HTTPS :3444), 23 модулями маршрутов (70+ эндпоинтов), и 7 фоновыми сервисами.'
          : 'The frontend is built as an SPA on React 19 with Vite 8, uses HashRouter for routing (20 lazy-loaded pages), Tailwind CSS 4 for styling with dark and light theme support (glassmorphism design), Recharts for analytical charts, and Konva for the interactive STO map. The backend runs on Express 4 with dual listeners (HTTP :3001 + HTTPS :3444), 23 route modules (70+ endpoints), and 7 background services.'
        }</P>
        <Table
          headers={[isRu ? 'Слой' : 'Layer', isRu ? 'Технологии' : 'Technologies', isRu ? 'Назначение' : 'Purpose']}
          rows={[
            ['Frontend', 'React 19.2, Vite 8, Tailwind CSS 4, Recharts 3, Konva 10, react-i18next, Socket.IO Client, HLS.js, jsPDF, xlsx', isRu ? 'SPA с 20 страницами, real-time обновления, PWA' : 'SPA with 20 pages, real-time updates, PWA'],
            ['Backend', 'Express 4, Prisma ORM, SQLite, Socket.IO 4, Zod, node-cron, web-push, node-telegram-bot-api', isRu ? '23 модуля API, 7 фоновых сервисов, JWT auth' : '23 API modules, 7 background services, JWT auth'],
            [isRu ? 'Стриминг' : 'Streaming', 'FFmpeg (RTSP \u2192 HLS), Node.js HTTPS :8181', isRu ? '10 камер, сегменты 2с, автоперезапуск' : '10 cameras, 2s segments, auto-restart'],
            [isRu ? 'Инфраструктура' : 'Infrastructure', 'Nginx :8080, Let\'s Encrypt SSL, WireGuard VPN', isRu ? 'Reverse proxy, SSL termination, порты 1:1' : 'Reverse proxy, SSL termination, 1:1 port mapping'],
            [isRu ? 'Тестирование' : 'Testing', 'Vitest, React Testing Library, jsdom', isRu ? 'Юнит и интеграционные тесты фронтенда' : 'Frontend unit and integration tests'],
          ]}
        />

        {/* Section 2 — Architecture */}
        <SectionTitle id="architecture">{isRu ? '2. Архитектура' : '2. Architecture'}</SectionTitle>
        <P>{isRu
          ? 'Архитектура проекта следует классической клиент-серверной модели с чётким разделением ответственности. Фронтенд и бэкенд живут в одном репозитории (монорепо), но собираются и деплоятся отдельно. Фронтенд билдится через Vite в статические файлы и раздаётся Nginx, а бэкенд работает как долгоживущий Node.js-процесс.'
          : 'The project architecture follows a classic client-server model with clear separation of concerns. Frontend and backend live in a single repository (monorepo) but are built and deployed separately. The frontend is built via Vite into static files served by Nginx, while the backend runs as a long-lived Node.js process.'
        }</P>
        <Code>{`/project
\u251c\u2500\u2500 frontend/src/       # React 19, 20 pages, 19+ components, 3 contexts, 4 hooks
\u2502   \u251c\u2500\u2500 pages/          # 20 lazy-loaded pages (Dashboard, Analytics, MapEditor, etc.)
\u2502   \u251c\u2500\u2500 components/     # 19 shared + dashboardPosts/ (8) + postsDetail/ (4)
\u2502   \u251c\u2500\u2500 contexts/       # AuthContext, ThemeContext, ToastContext
\u2502   \u251c\u2500\u2500 hooks/          # useSocket, useWorkOrderTimer, useCameraStatus, useAsync
\u2502   \u251c\u2500\u2500 utils/          # translate.js, export.js
\u2502   \u2514\u2500\u2500 i18n/           # ru.json, en.json (~512 keys)
\u251c\u2500\u2500 backend/src/        # Express 4, 23 route modules, 7 background services
\u2502   \u251c\u2500\u2500 routes/         # 23 modules: auth, dashboard, posts, zones, events, etc.
\u2502   \u251c\u2500\u2500 services/       # EventProcessor, RecommendationEngine, Sync1C, etc.
\u2502   \u251c\u2500\u2500 middleware/     # auth, auditLog, validate, asyncHandler
\u2502   \u2514\u2500\u2500 config/         # socket.js, database.js, logger.js, authCache.js
\u251c\u2500\u2500 backend/prisma/     # schema.prisma (22+ models), migrations, seed.js
\u251c\u2500\u2500 data/               # 29 JSON mock files (fallback data)
\u251c\u2500\u2500 server.js           # HLS streaming server :8181 (FFmpeg RTSP\u2192HLS)
\u251c\u2500\u2500 sw.js               # Service Worker (network-first, push notifications)
\u251c\u2500\u2500 manifest.json       # PWA manifest
\u2514\u2500\u2500 index.html          # SPA entry point (served by Nginx)`}</Code>

        <Sub>{isRu ? 'Иерархия React-контекстов' : 'React Context Hierarchy'}</Sub>
        <P>{isRu
          ? 'Приложение оборачивается в три вложенных провайдера в строгом порядке: ThemeProvider (CSS-переменные для тёмной/светлой темы) -> ToastProvider (глобальные уведомления) -> AuthProvider (авторизация, API-клиент, permissions). Такой порядок гарантирует, что AuthProvider может использовать toast для показа ошибок авторизации, а все компоненты ниже имеют доступ к теме и уведомлениям.'
          : 'The application wraps in three nested providers in strict order: ThemeProvider (CSS variables for dark/light theme) -> ToastProvider (global notifications) -> AuthProvider (auth, API client, permissions). This order ensures AuthProvider can use toast for auth errors, and all components below have access to theme and notifications.'
        }</P>
        <Code>{`ThemeProvider          // dark/light CSS variables
  \u2514\u2500 ToastProvider        // success/error/warning/info notifications
      \u2514\u2500 AuthProvider       // user state, JWT, api client, permissions
          \u2514\u2500 HashRouter       // client-side routing (20 routes)
              \u2514\u2500 Layout         // Header + Sidebar + Outlet
                  \u2514\u2500 Pages        // lazy-loaded via React.lazy + Suspense`}</Code>

        <Sub>{isRu ? 'Поток данных (Data Flow)' : 'Data Flow'}</Sub>
        <P>{isRu
          ? 'Основной поток данных в системе начинается с внешних источников. CV-система (компьютерное зрение) распознаёт номерные знаки автомобилей и их позиции, отправляя события через POST /api/events без авторизации. EventProcessor обрабатывает эти события, создавая или обновляя VehicleSession, ZoneStay и PostStay записи, а затем обновляет статусы постов. Каждое изменение статуса немедленно транслируется через Socket.IO всем подключённым клиентам.'
          : 'The main data flow begins with external sources. The CV (computer vision) system recognizes license plates and vehicle positions, sending events via POST /api/events without authentication. EventProcessor processes these events, creating or updating VehicleSession, ZoneStay and PostStay records, then updating post statuses. Every status change is immediately broadcast via Socket.IO to all connected clients.'
        }</P>
        <P>{isRu
          ? 'RecommendationEngine периодически анализирует текущее состояние СТО и генерирует 5 типов рекомендаций: свободный пост более 30 минут, превышение нормативного времени более 120%, простой работника более 15 минут, достижение максимальной загрузки, и неявка запланированного автомобиля. Рекомендации также транслируются через Socket.IO и отображаются на Dashboard.'
          : 'RecommendationEngine periodically analyzes current STO state and generates 5 recommendation types: post free for over 30 minutes, norm time exceeded over 120%, worker idle over 15 minutes, capacity reached, and scheduled vehicle no-show. Recommendations are also broadcast via Socket.IO and displayed on Dashboard.'
        }</P>
        <Code>{`CV System \u2500\u2500 POST /api/events (no auth) \u2500\u2500\u25b6 EventProcessor (308 LOC)
    \u2502                                            \u2502
    \u2502                                    \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
    \u2502                                    \u2502 VehicleSession  \u2502
    \u2502                                    \u2502 ZoneStay        \u2502
    \u2502                                    \u2502 PostStay        \u2502
    \u2502                                    \u2502 Post.status     \u2502
    \u2502                                    \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
    \u2502                                            \u2502
    \u2502                                    Socket.IO broadcast
    \u2502                                            \u2502
Frontend (React) \u2500\u2500 api.get/post \u2500\u2500\u25b6 Express \u2500\u2500 Prisma \u2500\u2500\u25b6 SQLite
    \u2502                                            \u2502
    \u2514\u2500\u2500 HLS.js :8181 \u2500\u2500\u2500\u2500\u25b6 FFmpeg \u25c0\u2500\u2500\u2500\u2500\u2500\u2500 RTSP cameras (10)

1C ERP \u2500\u2500 XLSX files \u2500\u2500\u25b6 Sync1C (file watcher) \u2500\u2500\u25b6 JSON + DB`}</Code>

        <P>{isRu
          ? 'Fallback-цепочка при недоступности данных: Backend API (основной источник) -> JSON-моки в /data/ (29 файлов, используются как seed/fallback) -> localStorage (только для token, currentUser, theme, language). Система спроектирована так, чтобы все данные хранились в БД через Prisma; localStorage используется исключительно для клиентских настроек.'
          : 'Fallback chain when data is unavailable: Backend API (primary source) -> JSON mocks in /data/ (29 files, used as seed/fallback) -> localStorage (only for token, currentUser, theme, language). The system is designed so all data is stored in DB via Prisma; localStorage is used exclusively for client-side settings.'
        }</P>

        {/* Section 3 — Infrastructure */}
        <SectionTitle id="infrastructure">{isRu ? '3. Инфраструктура и деплой' : '3. Infrastructure & Deploy'}</SectionTitle>
        <P>{isRu
          ? 'Проект развёрнут в Docker-контейнере с рабочей директорией /project. Контейнер подключён к VPS через WireGuard VPN, при этом все порты 80-65535 проброшены 1:1 на VPS. Это означает, что любой сервис внутри контейнера доступен извне по его реальному порту через домен artisom.dev.metricsavto.com.'
          : 'The project is deployed in a Docker container with working directory /project. The container is connected to a VPS via WireGuard VPN, with all ports 80-65535 mapped 1:1 to the VPS. This means any service inside the container is accessible externally on its actual port via the domain artisom.dev.metricsavto.com.'
        }</P>
        <P>{isRu
          ? 'Nginx работает на порту 8080 как reverse proxy и раздаёт статические файлы фронтенда. Конфигурация Nginx принадлежит root и не может быть изменена из контейнера. Express слушает на двух портах: HTTP :3001 (основной) и HTTPS :3444 (с SSL-сертификатом). HLS-сервер работает на :8181 и конвертирует RTSP-потоки камер в HLS через FFmpeg.'
          : 'Nginx runs on port 8080 as a reverse proxy and serves frontend static files. Nginx configuration is owned by root and cannot be modified from the container. Express listens on two ports: HTTP :3001 (primary) and HTTPS :3444 (with SSL certificate). The HLS server runs on :8181 and converts RTSP camera streams to HLS via FFmpeg.'
        }</P>
        <Table
          headers={[isRu ? 'Сервер' : 'Server', isRu ? 'Порт' : 'Port', isRu ? 'Протокол' : 'Protocol', isRu ? 'Назначение' : 'Purpose']}
          rows={[
            ['Nginx', '8080', 'HTTP', isRu ? 'Reverse proxy, статика фронтенда, SPA fallback' : 'Reverse proxy, frontend static files, SPA fallback'],
            ['Express', '3001', 'HTTP', isRu ? 'REST API + Socket.IO (основной)' : 'REST API + Socket.IO (primary)'],
            ['Express', '3444', 'HTTPS', isRu ? 'REST API + Socket.IO (SSL, те же роуты)' : 'REST API + Socket.IO (SSL, same routes)'],
            ['HLS Server', '8181', 'HTTPS', isRu ? 'RTSP->HLS конвертация, раздача .m3u8/.ts' : 'RTSP->HLS conversion, serving .m3u8/.ts'],
            ['VPS Proxy', '443', 'HTTPS', isRu ? 'Внешний HTTPS через VPS' : 'External HTTPS via VPS'],
          ]}
        />
        <Sub>{isRu ? 'SSL-сертификат' : 'SSL Certificate'}</Sub>
        <P>{isRu
          ? 'Домен: artisom.dev.metricsavto.com. Сертификат Let\'s Encrypt расположен в /project/.ssl/fullchain.pem, приватный ключ в /project/.ssl/privkey.pem. Срок действия до 2026-07-05. Сертификат используется Express (HTTPS :3444) и HLS-сервером (:8181). Nginx на VPS имеет свой сертификат для проксирования на порт 443.'
          : 'Domain: artisom.dev.metricsavto.com. Let\'s Encrypt certificate located at /project/.ssl/fullchain.pem, private key at /project/.ssl/privkey.pem. Valid until 2026-07-05. The certificate is used by Express (HTTPS :3444) and the HLS server (:8181). Nginx on the VPS has its own certificate for proxying on port 443.'
        }</P>
        <Sub>{isRu ? 'Конфигурация Nginx' : 'Nginx Configuration'}</Sub>
        <P>{isRu
          ? 'Nginx слушает на порту 8080 как default_server. Все запросы /api/* проксируются на Express с каскадным fallback (3001 -> 3000 -> 3002). WebSocket-подключения /socket.io/* проксируются с поддержкой upgrade. Камерный API /cam-api/* перенаправляется на HLS-сервер :8181. HLS-файлы /hls/* раздаются статически из /project/hls/ с CORS-заголовками. Все остальные запросы обрабатываются как SPA (try_files -> index.html).'
          : 'Nginx listens on port 8080 as default_server. All /api/* requests are proxied to Express with cascade fallback (3001 -> 3000 -> 3002). WebSocket connections /socket.io/* are proxied with upgrade support. Camera API /cam-api/* is redirected to HLS server :8181. HLS files /hls/* are served statically from /project/hls/ with CORS headers. All other requests are handled as SPA (try_files -> index.html).'
        }</P>
        <Code>{`Port 8080 (default_server)
  /api/*       \u2192 proxy http://127.0.0.1:3001 (fallback: 3000, 3002)
  /socket.io/* \u2192 proxy + WebSocket upgrade (Connection: upgrade)
  /cam-api/*   \u2192 proxy http://127.0.0.1:8181/api/
  /hls/*       \u2192 static /project/hls/ + CORS (Access-Control-Allow-Origin: *)
  /*           \u2192 SPA fallback (try_files $uri $uri/ /index.html)`}</Code>
        <Sub>{isRu ? 'Билд и деплой' : 'Build & Deploy'}</Sub>
        <P>{isRu
          ? 'Процесс деплоя фронтенда состоит из трёх шагов: (1) сборка React-приложения через Vite, (2) копирование собранных файлов в корень /project/ откуда их раздаёт Nginx, (3) обновление CACHE_NAME в sw.js для инвалидации кеша Service Worker. Бэкенд перезапускается простым рестартом Node.js-процесса.'
          : 'The frontend deploy process consists of three steps: (1) building the React app via Vite, (2) copying built files to /project/ root where Nginx serves them, (3) updating CACHE_NAME in sw.js to invalidate the Service Worker cache. The backend is restarted by simply restarting the Node.js process.'
        }</P>
        <Code>{`# Frontend build & deploy
cd /project/frontend && npm run build && cp -r dist/* /project/
# ${isRu ? 'prebuild скрипт автоматически очищает старые assets перед сборкой' : 'prebuild script automatically cleans old assets before building'}
# ${isRu ? 'После билда — обязательно бампить CACHE_NAME в sw.js' : 'After build — must bump CACHE_NAME in sw.js'}

# Backend start
cd /project/backend && node src/index.js
# ${isRu ? 'Запускает HTTP :3001 + HTTPS :3444 + Socket.IO + фоновые сервисы' : 'Starts HTTP :3001 + HTTPS :3444 + Socket.IO + background services'}
# ${isRu ? 'Swagger UI доступен на /api-docs (OpenAPI 3.0)' : 'Swagger UI available at /api-docs (OpenAPI 3.0)'}

# HLS streaming
cd /project && node server.js
# ${isRu ? 'RTSP->HLS конвертация на порту 8181' : 'RTSP->HLS conversion on port 8181'}`}</Code>

        {/* Section 4 — Database */}
        <SectionTitle id="database">{isRu ? '4. База данных (Prisma + SQLite, 22 модели)' : '4. Database (Prisma + SQLite, 22 models)'}</SectionTitle>
        <P>{isRu
          ? 'Система использует Prisma 5.20 как ORM с SQLite в качестве базы данных. Файл БД расположен в backend/prisma/dev.db. SQLite выбран за простоту развёртывания (один файл, без отдельного сервера), достаточную производительность для single-node установки, и отличную совместимость с Prisma. Миграции управляются через prisma migrate, seed-данные загружаются через prisma db seed.'
          : 'The system uses Prisma 5.20 as ORM with SQLite as the database. The DB file is located at backend/prisma/dev.db. SQLite was chosen for its deployment simplicity (single file, no separate server), sufficient performance for single-node installations, and excellent compatibility with Prisma. Migrations are managed via prisma migrate, seed data is loaded via prisma db seed.'
        }</P>
        <P>{isRu
          ? 'Схема содержит 22+ моделей, охватывающих все аспекты системы: RBAC (пользователи, роли, разрешения), физическую структуру СТО (зоны, посты, камеры), отслеживание автомобилей (сессии, пребывание в зонах/на постах), производственные процессы (заказ-наряды, смены), и системные функции (аудит, пуш-уведомления, Telegram, отчёты).'
          : 'The schema contains 22+ models covering all system aspects: RBAC (users, roles, permissions), physical STO structure (zones, posts, cameras), vehicle tracking (sessions, zone/post stays), production processes (work orders, shifts), and system functions (audit, push notifications, Telegram, reports).'
        }</P>

        <Sub>{isRu ? 'RBAC — модель доступа' : 'RBAC — Access Model'}</Sub>
        <P>{isRu
          ? 'Система доступа построена на пятиуровневой цепочке: User -> UserRole -> Role -> RolePermission -> Permission. Каждый пользователь может иметь одну роль через связь UserRole. Роль содержит набор разрешений (permissions) через RolePermission. Помимо этого, у пользователя есть JSON-поле hiddenElements, позволяющее администратору скрывать конкретные виджеты и секции на страницах для каждого пользователя индивидуально.'
          : 'The access system is built on a five-level chain: User -> UserRole -> Role -> RolePermission -> Permission. Each user can have one role via UserRole relation. A role contains a set of permissions via RolePermission. Additionally, users have a hiddenElements JSON field, allowing administrators to hide specific widgets and sections on pages for each user individually.'
        }</P>
        <Table
          headers={[isRu ? 'Роль' : 'Role', isRu ? 'Разрешения' : 'Permissions', isRu ? 'Описание' : 'Description']}
          rows={[
            ['admin', isRu ? 'Все 15 + manage_roles, manage_settings' : 'All 15 + manage_roles, manage_settings', isRu ? 'Полный доступ ко всем функциям' : 'Full access to all features'],
            ['director', 'view_dashboard, view_analytics, view_zones, view_posts, view_sessions, view_events, view_work_orders, view_recommendations, view_cameras', isRu ? 'Только просмотр, без редактирования' : 'View only, no editing'],
            ['manager', 'view_dashboard, view_zones, view_posts, view_sessions, view_events, manage_work_orders, view_recommendations', isRu ? 'Управление заказ-нарядами + просмотр' : 'Work order management + viewing'],
            ['mechanic', 'view_dashboard, view_posts, view_sessions', isRu ? 'Работа на постах, просмотр базовой информации' : 'Post work, basic info viewing'],
            ['viewer', 'view_dashboard, view_zones, view_posts', isRu ? 'Минимальный доступ только для просмотра' : 'Minimal view-only access'],
          ]}
        />

        <Sub>{isRu ? 'Основные модели' : 'Core Models'}</Sub>
        <P>{isRu
          ? 'Зоны (Zone) описывают физические области СТО с 5 типами: repair (ремонтная), waiting (ожидания), entry (въезд), parking (парковка), free (свободная). Каждая зона имеет координаты для отображения на карте и связана с постами и камерами.'
          : 'Zones describe physical STO areas with 5 types: repair, waiting, entry, parking, free. Each zone has coordinates for map display and is related to posts and cameras.'
        }</P>
        <P>{isRu
          ? 'Посты (Post) — рабочие места механиков. 3 типа: heavy (грузовые, посты 1-4), light (легковые, посты 5-8), special (специальные, посты 9-10). 4 статуса: free (свободен), occupied (занят автомобилем), occupied_no_work (занят без активной работы), active_work (активная работа). Статусы обновляются автоматически через EventProcessor при поступлении CV-событий.'
          : 'Posts are mechanic workstations. 3 types: heavy (trucks, posts 1-4), light (cars, posts 5-8), special (specialized, posts 9-10). 4 statuses: free, occupied (vehicle present), occupied_no_work (occupied without active work), active_work (work in progress). Statuses are updated automatically via EventProcessor when CV events arrive.'
        }</P>
        <Table
          headers={[isRu ? 'Модель' : 'Model', isRu ? 'Ключевые поля' : 'Key Fields', isRu ? 'Связи' : 'Relations']}
          rows={[
            ['Zone', 'name, type (repair/waiting/entry/parking/free), coordinates', '\u2192 Post[], CameraZone[], ZoneStay[]'],
            ['Post', 'name, type (light/heavy/special), status (free/occupied/occupied_no_work/active_work)', '\u2192 Zone, PostStay[], WorkOrderLink[]'],
            ['Camera', 'name, rtspUrl, isActive, hlsUrl', '\u2192 CameraZone[], Event[]'],
            ['VehicleSession', 'plateNumber, entryTime, exitTime, status (active/completed), trackId', '\u2192 ZoneStay[], PostStay[], Event[]'],
            ['ZoneStay', 'entryTime, exitTime, duration', '\u2192 VehicleSession, Zone'],
            ['PostStay', 'entryTime, exitTime, hasWorker, isActive, activeTime, idleTime', '\u2192 VehicleSession, Post'],
            ['WorkOrder', 'orderNumber, externalId, status, normHours, version, pausedAt, totalPausedMs', '\u2192 WorkOrderLink[]'],
            ['Event', 'type (10 types), confidence, cameraSources, plateNumber', '\u2192 Zone, Post, VehicleSession, Camera'],
            ['Shift', 'name, date, startTime, endTime, status (active/completed)', '\u2192 ShiftWorker[]'],
            ['ShiftWorker', 'name, role, postId', '\u2192 Shift, Post'],
            ['Recommendation', 'type (5 types), message, messageEn, status (active/acknowledged)', '\u2192 Zone?, Post?'],
            ['AuditLog', 'action, entity, entityId, oldData (JSON), newData (JSON), ip, userAgent', isRu ? 'Индексы: userId, action, entity, createdAt' : 'Indexes: userId, action, entity, createdAt'],
            ['MapLayout', 'name, width (46540mm), height (30690mm), elements (JSON)', '\u2192 MapLayoutVersion[]'],
          ]}
        />
        <Sub>{isRu ? 'WorkOrder — жизненный цикл и оптимистичная блокировка' : 'WorkOrder — Lifecycle & Optimistic Locking'}</Sub>
        <P>{isRu
          ? 'WorkOrder имеет поле version для оптимистичной блокировки. При batch-обновлении через POST /api/work-orders/schedule бэкенд проверяет version каждого заказ-наряда. Если версия не совпадает (другой пользователь уже обновил), возвращается HTTP 409 с массивом conflicts[]. Поля pausedAt и totalPausedMs реализуют корректный учёт времени паузы: при паузе записывается pausedAt, при возобновлении накопленное время паузы добавляется в totalPausedMs.'
          : 'WorkOrder has a version field for optimistic locking. During batch updates via POST /api/work-orders/schedule, the backend checks each work order\'s version. If versions mismatch (another user already updated), HTTP 409 is returned with a conflicts[] array. Fields pausedAt and totalPausedMs implement correct pause time tracking: on pause, pausedAt is recorded; on resume, accumulated pause time is added to totalPausedMs.'
        }</P>
        <Sub>{isRu ? 'Прочие модели' : 'Other Models'}</Sub>
        <P>{isRu
          ? 'SyncLog (история синхронизации с 1С), Photo (фото постов с base64 хранением), PushSubscription (Web Push подписки с endpoint/keys), Location (мультитенантность для нескольких СТО), TelegramLink (связь Telegram chatId с пользователем), ReportSchedule (расписание автоматических XLSX-отчётов с cron-выражениями), WorkOrderLink (связь заказ-нарядов с постами/сессиями), CameraZone (маппинг камер на зоны с приоритетами 0-10), UserRole, RolePermission, MapLayoutVersion (версии карты с автором и временной меткой).'
          : 'SyncLog (1C sync history), Photo (post photos with base64 storage), PushSubscription (Web Push subscriptions with endpoint/keys), Location (multi-tenancy for multiple STOs), TelegramLink (Telegram chatId to user mapping), ReportSchedule (automatic XLSX report schedules with cron expressions), WorkOrderLink (work order to post/session mapping), CameraZone (camera to zone mapping with priorities 0-10), UserRole, RolePermission, MapLayoutVersion (map versions with author and timestamp).'
        }</P>

        {/* Section 5 — API */}
        <SectionTitle id="api">{isRu ? '5. Backend API (23 модуля, 70+ эндпоинтов)' : '5. Backend API (23 modules, 70+ endpoints)'}</SectionTitle>
        <P>{isRu
          ? 'Бэкенд реализован на Express 4 с 23 модулями маршрутов, организованными по доменным областям. Каждый модуль — отдельный файл в backend/src/routes/, экспортирующий Express Router. Все маршруты монтируются в index.js с префиксом /api/. Большинство эндпоинтов защищены JWT-аутентификацией, за исключением POST /api/events (для CV-системы) и POST /api/auth/login.'
          : 'The backend is implemented on Express 4 with 23 route modules organized by domain areas. Each module is a separate file in backend/src/routes/, exporting an Express Router. All routes are mounted in index.js with /api/ prefix. Most endpoints are protected by JWT authentication, except POST /api/events (for CV system) and POST /api/auth/login.'
        }</P>
        <Table
          headers={[isRu ? 'Модуль' : 'Module', isRu ? 'Путь' : 'Path', isRu ? 'Ключевые операции' : 'Key Operations']}
          rows={[
            ['auth', '/api/auth', 'login (rate limit 20/min/IP), refresh, logout, me, register'],
            ['dashboard', '/api/dashboard', 'overview, metrics(?period=24h|7d|30d), trends, live'],
            ['zones', '/api/zones', isRu ? 'CRUD с soft delete, типы: repair/waiting/entry/parking/free' : 'CRUD with soft delete, types: repair/waiting/entry/parking/free'],
            ['posts', '/api/posts', isRu ? 'CRUD, статусы: free/occupied/occupied_no_work/active_work' : 'CRUD, statuses: free/occupied/occupied_no_work/active_work'],
            ['cameras', '/api/cameras', isRu ? 'CRUD, health-проверка, маппинг зон с приоритетами' : 'CRUD, health check, zone mapping with priorities'],
            ['events', '/api/events', isRu ? 'POST от CV (без auth!), GET с фильтрами по типу/зоне/посту/дате' : 'POST from CV (no auth!), GET with type/zone/post/date filters'],
            ['sessions', '/api/sessions', isRu ? 'active/completed, включает ZoneStay/PostStay/Events' : 'active/completed, includes ZoneStay/PostStay/Events'],
            ['workOrders', '/api/work-orders', isRu ? 'CSV-импорт, schedule (optimistic locking), start/pause/resume/complete' : 'CSV import, schedule (optimistic locking), start/pause/resume/complete'],
            ['recommendations', '/api/recommendations', isRu ? 'GET активные, PUT acknowledge (подтвердить)' : 'GET active, PUT acknowledge'],
            ['users', '/api/users', isRu ? 'CRUD, role assignment, pages[], hiddenElements[]' : 'CRUD, role assignment, pages[], hiddenElements[]'],
            ['shifts', '/api/shifts', isRu ? 'CRUD, назначение работников, обнаружение конфликтов (смена + кросс-смена)' : 'CRUD, worker assignment, conflict detection (shift + cross-shift)'],
            ['data1c', '/api/1c', isRu ? 'import XLSX, export XLSX, sync-history, planning/workers/stats' : 'import XLSX, export XLSX, sync-history, planning/workers/stats'],
            ['mapLayout', '/api/map-layout', isRu ? 'CRUD с версионированием, restore к предыдущей версии' : 'CRUD with versioning, restore to previous version'],
            ['auditLog', '/api/audit-log', isRu ? 'GET с фильтрами (user, action, entity, date), CSV export' : 'GET with filters (user, action, entity, date), CSV export'],
            ['predict', '/api/predict', isRu ? 'load, load/week, duration, free, health (детерминированный seed для демо)' : 'load, load/week, duration, free, health (deterministic seed for demo)'],
            ['postsData', '/api/posts-analytics, /api/dashboard-posts, /api/analytics-history', isRu ? 'Аналитика постов с агрегациями, дневными разбивками' : 'Post analytics with aggregations, daily breakdowns'],
            ['workers', '/api/workers', isRu ? 'Список работников, stats с daily breakdown по заказ-нарядам' : 'Worker list, stats with daily breakdown by work orders'],
            ['health', '/api/system-health', isRu ? 'Статус backend, database, cameras, disk (admin only)' : 'Backend, database, cameras, disk status (admin only)'],
            ['push', '/api/push', isRu ? 'VAPID public key, subscribe endpoint, send уведомление' : 'VAPID public key, subscribe endpoint, send notification'],
            ['photos', '/api/photos', isRu ? 'Upload base64, gallery по посту, delete' : 'Upload base64, gallery by post, delete'],
            ['locations', '/api/locations', isRu ? 'CRUD локаций (мультитенантность)' : 'CRUD locations (multi-tenancy)'],
            ['reportSchedule', '/api/report-schedules', isRu ? 'CRUD расписаний, run (генерация XLSX + отправка в Telegram)' : 'CRUD schedules, run (generate XLSX + send to Telegram)'],
          ]}
        />

        <Sub>{isRu ? 'Аутентификация и авторизация' : 'Authentication & Authorization'}</Sub>
        <P>{isRu
          ? 'Авторизация реализована через JWT с двумя токенами. Access token (срок жизни 24 часа) передаётся в заголовке Authorization: Bearer. Refresh token (7 дней) хранится в httpOnly cookie, недоступном из JavaScript, что защищает от XSS-атак. При истечении access token клиент автоматически обновляет его через POST /api/auth/refresh.'
          : 'Authorization is implemented via JWT with two tokens. The access token (24h lifetime) is sent in the Authorization: Bearer header. The refresh token (7 days) is stored in an httpOnly cookie, inaccessible from JavaScript, protecting against XSS attacks. When the access token expires, the client automatically refreshes it via POST /api/auth/refresh.'
        }</P>
        <P>{isRu
          ? 'Логин (POST /api/auth/login) защищён rate limiting: 20 попыток в минуту на IP. При успешном входе бэкенд возвращает access token, устанавливает refresh cookie, и включает полный объект пользователя с permissions, pages (доступные страницы) и hiddenElements (скрытые элементы UI). GET /api/auth/me возвращает текущего пользователя с полной информацией о роли и разрешениях.'
          : 'Login (POST /api/auth/login) is protected by rate limiting: 20 attempts per minute per IP. On successful login, the backend returns an access token, sets a refresh cookie, and includes the full user object with permissions, pages (accessible pages) and hiddenElements (hidden UI elements). GET /api/auth/me returns the current user with full role and permission information.'
        }</P>

        <Sub>{isRu ? 'Optimistic Locking (заказ-наряды)' : 'Optimistic Locking (Work Orders)'}</Sub>
        <P>{isRu
          ? 'POST /api/work-orders/schedule реализует batch-обновление расписания заказ-нарядов с оптимистичной блокировкой. Каждый заказ-наряд имеет поле version (целое число). Клиент отправляет массив обновлений, каждое с ожидаемой version. Бэкенд проверяет version каждого заказ-наряда в транзакции. При совпадении — обновляет и инкрементирует version. При несовпадении — добавляет в массив conflicts[] и возвращает HTTP 409. Клиент показывает ConflictModal с деталями конфликта и позволяет пользователю принять решение: перезаписать чужие изменения или обновить свои данные.'
          : 'POST /api/work-orders/schedule implements batch schedule updates with optimistic locking. Each work order has a version field (integer). The client sends an array of updates, each with an expected version. The backend checks each work order\'s version in a transaction. On match — updates and increments version. On mismatch — adds to conflicts[] array and returns HTTP 409. The client shows ConflictModal with conflict details, allowing the user to decide: overwrite others\' changes or refresh their data.'
        }</P>

        <Sub>{isRu ? 'Жизненный цикл заказ-наряда' : 'Work Order Lifecycle'}</Sub>
        <P>{isRu
          ? 'Заказ-наряд проходит через состояния: pending (создан/импортирован) -> scheduled (назначен на пост/время) -> in_progress (механик начал работу) -> paused (пауза, например обед) -> in_progress (возобновлён) -> completed (завершён). Каждый переход состояния фиксируется во времени. При паузе записывается pausedAt, при возобновлении totalPausedMs увеличивается на разницу. Это позволяет точно считать реальное рабочее время, исключая паузы.'
          : 'A work order goes through states: pending (created/imported) -> scheduled (assigned to post/time) -> in_progress (mechanic started work) -> paused (break, e.g., lunch) -> in_progress (resumed) -> completed (finished). Each state transition is timestamped. On pause, pausedAt is recorded; on resume, totalPausedMs increases by the difference. This allows accurate real work time calculation, excluding pauses.'
        }</P>

        {/* Section 6 — Services */}
        <SectionTitle id="services">{isRu ? '6. Backend Services (фоновые)' : '6. Backend Services (background)'}</SectionTitle>
        <P>{isRu
          ? 'Семь фоновых сервисов запускаются при старте бэкенда и работают параллельно с Express. Каждый сервис отвечает за свою область: обработка CV-событий, генерация рекомендаций, мониторинг камер, синхронизация с 1С, Telegram-бот, планировщик отчётов и утилиты экспорта.'
          : 'Seven background services start with the backend and run in parallel with Express. Each service handles its domain: CV event processing, recommendation generation, camera monitoring, 1C sync, Telegram bot, report scheduler, and export utilities.'
        }</P>
        <Table
          headers={[isRu ? 'Сервис' : 'Service', isRu ? 'Файл' : 'File', 'LOC', isRu ? 'Что делает' : 'What it does']}
          rows={[
            ['EventProcessor', 'eventProcessor.js', '308', isRu ? 'Обработка 8 типов CV-событий -> сессии, статусы постов, Socket.IO emit' : 'Processes 8 CV event types -> sessions, post statuses, Socket.IO emit'],
            ['RecommendationEngine', 'recommendationEngine.js', '~200', isRu ? '5 проверок: post_free (>30м), overtime (>120%), idle (>15м), capacity, no_show' : '5 checks: post_free (>30m), overtime (>120%), idle (>15m), capacity, no_show'],
            ['CameraHealthCheck', 'cameraHealthCheck.js', '~80', isRu ? 'Пинг камер каждые 30с, обновление статуса, Socket.IO emit' : 'Camera ping every 30s, status update, Socket.IO emit'],
            ['Sync1C', 'sync1C.js', '~250', isRu ? 'File watcher /data/1c-import/, парсинг XLSX, дедупликация, JSON-генерация' : 'File watcher /data/1c-import/, XLSX parsing, deduplication, JSON generation'],
            ['TelegramBot', 'telegramBot.js', '~150', isRu ? '5 команд: /start, /status, /post N, /free, /report' : '5 commands: /start, /status, /post N, /free, /report'],
            ['ReportScheduler', 'reportScheduler.js', '~120', isRu ? 'node-cron каждую минуту, генерация XLSX, доставка через Telegram' : 'node-cron every minute, XLSX generation, Telegram delivery'],
            ['ServerExport', 'serverExport.js', '~100', isRu ? 'Утилиты генерации XLSX на стороне сервера' : 'Server-side XLSX generation utilities'],
          ]}
        />

        <Sub>EventProcessor</Sub>
        <P>{isRu
          ? 'EventProcessor (308 строк) — ключевой сервис, связывающий внешнюю CV-систему с внутренней логикой. Когда камера распознаёт номерной знак или движение автомобиля, CV-система отправляет POST /api/events. EventProcessor обрабатывает 8 типов событий: vehicle_enter (въезд на СТО), vehicle_exit (выезд), zone_enter/zone_exit (вход/выход из зоны), post_enter/post_exit (заезд/съезд с поста), work_start (начало работы), work_end (завершение).'
          : 'EventProcessor (308 LOC) is the key service connecting the external CV system with internal logic. When a camera recognizes a license plate or vehicle movement, the CV system sends POST /api/events. EventProcessor handles 8 event types: vehicle_enter (STO entry), vehicle_exit (exit), zone_enter/zone_exit (zone entry/exit), post_enter/post_exit (post entry/exit), work_start (work begins), work_end (work complete).'
        }</P>
        <P>{isRu
          ? 'При vehicle_enter создаётся VehicleSession с plateNumber и trackId. При zone_enter/zone_exit создаются/завершаются ZoneStay записи с расчётом duration. При post_enter обновляется статус поста на occupied, создаётся PostStay. При work_start статус меняется на active_work, а PostStay помечается как isActive=true, hasWorker=true. Все изменения статусов транслируются через Socket.IO в реальном времени.'
          : 'On vehicle_enter, a VehicleSession is created with plateNumber and trackId. On zone_enter/zone_exit, ZoneStay records are created/completed with duration calculation. On post_enter, the post status updates to occupied and PostStay is created. On work_start, status changes to active_work, and PostStay is marked isActive=true, hasWorker=true. All status changes are broadcast via Socket.IO in real-time.'
        }</P>

        <Sub>RecommendationEngine</Sub>
        <P>{isRu
          ? 'Движок рекомендаций периодически сканирует состояние всех постов и генерирует 5 типов алертов: (1) post_free — пост свободен более 30 минут при наличии автомобилей в очереди, (2) overtime — работа на посту превышает 120% нормативного времени, (3) idle — работник простаивает более 15 минут (пост занят, но нет активной работы), (4) capacity — достигнута максимальная загрузка зоны, (5) no_show — запланированный автомобиль не прибыл в назначенное время. Каждая рекомендация содержит тексты на двух языках (message/messageEn) и может быть подтверждена (acknowledged) через API.'
          : 'The recommendation engine periodically scans all post states and generates 5 alert types: (1) post_free — post free for over 30 minutes while vehicles are queued, (2) overtime — post work exceeds 120% of norm time, (3) idle — worker idle over 15 minutes (post occupied but no active work), (4) capacity — zone maximum capacity reached, (5) no_show — scheduled vehicle did not arrive at the appointed time. Each recommendation contains bilingual texts (message/messageEn) and can be acknowledged via API.'
        }</P>

        <Sub>Sync1C</Sub>
        <P>{isRu
          ? 'Сервис синхронизации с 1С работает в двух режимах: автоматический (file watcher отслеживает /data/1c-import/) и ручной (drag-n-drop XLSX через UI). Поддерживаются два типа данных: Planning (мастера, расписание, плановые работы) и Workers (заказ-наряды, нормо-часы, выработка). При импорте выполняется дедупликация по уникальным идентификаторам. Результат сохраняется в три JSON-файла (/data/1c-planning.json, /data/1c-workers.json, /data/1c-stats.json) и в БД через SyncLog.'
          : 'The 1C sync service works in two modes: automatic (file watcher monitors /data/1c-import/) and manual (drag-n-drop XLSX via UI). Two data types are supported: Planning (masters, schedules, planned work) and Workers (work orders, norm-hours, production). Import performs deduplication by unique identifiers. Results are saved to three JSON files (/data/1c-planning.json, /data/1c-workers.json, /data/1c-stats.json) and to DB via SyncLog.'
        }</P>

        <Sub>TelegramBot</Sub>
        <P>{isRu
          ? 'Telegram-бот предоставляет 5 команд: /start (привязка Telegram аккаунта к пользователю системы через TelegramLink), /status (текущее состояние СТО — занятые/свободные посты, активные сессии), /post N (детальная информация о конкретном посте), /free (список свободных постов), /report (генерация и отправка XLSX-отчёта за текущий день). Бот также используется ReportScheduler для автоматической доставки отчётов по расписанию.'
          : 'The Telegram bot provides 5 commands: /start (link Telegram account to system user via TelegramLink), /status (current STO state — occupied/free posts, active sessions), /post N (detailed info about specific post), /free (list of free posts), /report (generate and send XLSX report for current day). The bot is also used by ReportScheduler for automated scheduled report delivery.'
        }</P>

        {/* Section 7 — Middleware */}
        <SectionTitle id="middleware">{isRu ? '7. Middleware' : '7. Middleware'}</SectionTitle>
        <P>{isRu
          ? 'Express middleware обеспечивают безопасность, валидацию, аудит и обработку ошибок. Порядок глобальных middleware в Express pipeline критически важен и определяет последовательность обработки запроса.'
          : 'Express middleware provides security, validation, auditing, and error handling. The order of global middleware in the Express pipeline is critical and determines the request processing sequence.'
        }</P>
        <Table
          headers={[isRu ? 'Файл' : 'File', isRu ? 'Назначение' : 'Purpose', isRu ? 'Детали' : 'Details']}
          rows={[
            ['auth.js', isRu ? 'JWT верификация и авторизация' : 'JWT verification and authorization', isRu ? 'Декодирует Bearer token, загружает пользователя из Prisma с ролями/permissions (кэшируется через authCache.js с TTL 15 мин), устанавливает req.user с полями pages, hiddenElements, permissions. requirePermission(...keys) проверяет наличие нужных разрешений.' : 'Decodes Bearer token, loads user from Prisma with roles/permissions (cached via authCache.js with 15min TTL), sets req.user with pages, hiddenElements, permissions fields. requirePermission(...keys) checks for required permissions.'],
            ['auditLog.js', isRu ? 'Логирование мутаций' : 'Mutation logging', isRu ? 'Перехватывает ответы с кодом 2xx на мутирующие запросы (POST/PUT/PATCH/DELETE). Записывает action, entity, entityId, oldData, newData, userId, ip, userAgent в AuditLog.' : 'Intercepts 2xx responses on mutating requests (POST/PUT/PATCH/DELETE). Records action, entity, entityId, oldData, newData, userId, ip, userAgent to AuditLog.'],
            ['validate.js', isRu ? 'Zod-валидация' : 'Zod validation', isRu ? 'Принимает Zod-схему, парсит request.body. При ошибке возвращает 400 с детальным описанием невалидных полей.' : 'Takes a Zod schema, parses request.body. On error returns 400 with detailed description of invalid fields.'],
            ['asyncHandler.js', isRu ? 'Обёртка async + Prisma ошибки' : 'Async wrapper + Prisma errors', isRu ? 'Оборачивает async route handlers для ловли отклонённых промисов. Преобразует Prisma P2025 (Record not found) в HTTP 404.' : 'Wraps async route handlers to catch rejected promises. Converts Prisma P2025 (Record not found) to HTTP 404.'],
          ]}
        />
        <Sub>{isRu ? 'Конфигурация (config/)' : 'Configuration (config/)'}</Sub>
        <Table
          headers={[isRu ? 'Файл' : 'File', isRu ? 'Назначение' : 'Purpose', isRu ? 'Детали' : 'Details']}
          rows={[
            ['logger.js', isRu ? 'Структурированное логирование (Winston)' : 'Structured logging (Winston)', isRu ? 'JSON-формат в production, colorize в dev. Ротация файлов: error.log (5MB x3), combined.log (10MB x5). Уровень настраивается через LOG_LEVEL.' : 'JSON format in production, colorize in dev. File rotation: error.log (5MB x3), combined.log (10MB x5). Level configurable via LOG_LEVEL.'],
            ['authCache.js', isRu ? 'In-Memory кэш авторизации' : 'In-memory auth cache', isRu ? 'Map с TTL 15 мин. Кэширует результат 4-уровневого Prisma include (User→Roles→Permissions). Инвалидируется при update/delete пользователя.' : 'Map with 15min TTL. Caches result of 4-level Prisma include (User→Roles→Permissions). Invalidated on user update/delete.'],
            ['socket.js', isRu ? 'Socket.IO инициализация' : 'Socket.IO initialization', isRu ? 'JWT auth middleware, подписки на каналы zone:/post:/all_events.' : 'JWT auth middleware, subscriptions to zone:/post:/all_events channels.'],
            ['database.js', isRu ? 'Prisma клиент' : 'Prisma client', isRu ? 'Singleton PrismaClient с настройками логирования.' : 'Singleton PrismaClient with logging settings.'],
          ]}
        />
        <Sub>{isRu ? 'Порядок глобальных Express middleware' : 'Global Express Middleware Order'}</Sub>
        <P>{isRu
          ? 'При каждом запросе middleware выполняются в следующем порядке: (1) helmet() — устанавливает заголовки безопасности (CSP, HSTS, X-Frame-Options), (2) cors(origin: true) — разрешает кросс-доменные запросы с любого origin, (3) morgan(\'dev\') — логирует HTTP-запросы в консоль, (4) express.json(limit: \'50mb\') — парсит JSON body с увеличенным лимитом для фото и XLSX, (5) cookieParser() — парсит cookies для refresh token.'
          : 'On each request, middleware executes in this order: (1) helmet() — sets security headers (CSP, HSTS, X-Frame-Options), (2) cors(origin: true) — allows cross-origin requests from any origin, (3) morgan(\'dev\') — logs HTTP requests to console, (4) express.json(limit: \'50mb\') — parses JSON body with increased limit for photos and XLSX, (5) cookieParser() — parses cookies for refresh token.'
        }</P>
        <Code>{`1. helmet()                    // ${isRu ? 'Заголовки безопасности' : 'Security headers'}
2. cors({ origin: true })      // ${isRu ? 'Кросс-доменные запросы' : 'Cross-origin requests'}
3. morgan('dev')               // ${isRu ? 'HTTP логирование' : 'HTTP logging'}
4. express.json({ limit:'50mb' }) // ${isRu ? 'Парсинг JSON (50MB для фото)' : 'JSON parsing (50MB for photos)'}
5. cookieParser()              // ${isRu ? 'Парсинг cookies (refresh token)' : 'Cookie parsing (refresh token)'}`}</Code>

        {/* Section 8 — Socket.IO */}
        <SectionTitle id="socketio">8. Socket.IO</SectionTitle>
        <P>{isRu
          ? 'Socket.IO обеспечивает двунаправленную real-time коммуникацию между сервером и клиентами. Подключение защищено JWT-аутентификацией: при connect клиент передаёт token, сервер верифицирует его и ассоциирует сокет с пользователем. Socket.IO интегрирован с обоими Express-серверами (HTTP :3001 и HTTPS :3444).'
          : 'Socket.IO provides bidirectional real-time communication between server and clients. The connection is protected by JWT authentication: on connect, the client passes a token, the server verifies it and associates the socket with the user. Socket.IO is integrated with both Express servers (HTTP :3001 and HTTPS :3444).'
        }</P>
        <P>{isRu
          ? 'Система использует room-based подписки для оптимизации трафика. Клиент может подписаться на конкретную зону (zone:{id}), пост (post:{id}), или на все события (all_events). Сервер отправляет события только в релевантные rooms, минимизируя нагрузку на сеть. Фронтенд использует хук useSubscribe для декларативной подписки с автоматической отпиской при unmount.'
          : 'The system uses room-based subscriptions for traffic optimization. A client can subscribe to a specific zone (zone:{id}), post (post:{id}), or all events (all_events). The server sends events only to relevant rooms, minimizing network load. The frontend uses the useSubscribe hook for declarative subscription with automatic unsubscription on unmount.'
        }</P>
        <Sub>{isRu ? 'Подписки (клиент -> сервер)' : 'Subscriptions (client -> server)'}</Sub>
        <P>{isRu
          ? 'Клиент отправляет три типа подписок: subscribe:zone (подписка на обновления конкретной зоны), subscribe:post (подписка на конкретный пост), subscribe:all (подписка на все события, используется Dashboard и Events). При подписке сокет добавляется в соответствующий room.'
          : 'The client sends three subscription types: subscribe:zone (subscribe to specific zone updates), subscribe:post (subscribe to specific post), subscribe:all (subscribe to all events, used by Dashboard and Events). On subscription, the socket is added to the corresponding room.'
        }</P>
        <Sub>{isRu ? 'События (сервер -> клиент)' : 'Events (server -> client)'}</Sub>
        <Table
          headers={[isRu ? 'Событие' : 'Event', isRu ? 'Данные' : 'Data', isRu ? 'Когда генерируется' : 'When emitted']}
          rows={[
            ['post:status_changed', '{ postId, postNumber, status, plateNumber, workerName, timestamp }', isRu ? 'EventProcessor обновил статус поста' : 'EventProcessor updated post status'],
            ['schedule:updated', '{ count }', isRu ? 'Расписание заказ-нарядов изменено' : 'Work order schedule modified'],
            ['workOrder:started', '{ workOrderId, postNumber, startTime }', isRu ? 'Механик начал работу' : 'Mechanic started work'],
            ['workOrder:completed', '{ workOrderId }', isRu ? 'Работа завершена' : 'Work completed'],
            ['camera:status', '{ camId, online, lastCheck }', isRu ? 'CameraHealthCheck обновил статус камеры' : 'CameraHealthCheck updated camera status'],
            ['recommendation', 'Recommendation object', isRu ? 'RecommendationEngine создал новую рекомендацию' : 'RecommendationEngine created new recommendation'],
            ['event', 'Event object', isRu ? 'Новое CV-событие (в room all_events)' : 'New CV event (to room all_events)'],
            ['zone:update', '{ zoneId, ...data }', isRu ? 'Обновление данных зоны' : 'Zone data update'],
            ['post:update', '{ postId, ...data }', isRu ? 'Обновление данных поста' : 'Post data update'],
            ['settings:changed', '{ type, ...data }', isRu ? 'Изменение настроек (тема, смена и т.д.)' : 'Settings change (theme, shift, etc.)'],
          ]}
        />

        {/* Section 9 — Pages */}
        <SectionTitle id="pages">{isRu ? '9. Frontend — Страницы (20)' : '9. Frontend — Pages (20)'}</SectionTitle>
        <P>{isRu
          ? 'Все 20 страниц загружаются через React.lazy() с Suspense, что минимизирует размер начального бандла. Маршрутизация реализована на HashRouter (React Router v7) — выбран hash-routing вместо browser history для совместимости с Nginx SPA fallback без дополнительной конфигурации. Каждая страница обёрнута в ProtectedRoute, проверяющий наличие JWT-токена и доступа к странице (user.pages).'
          : 'All 20 pages are loaded via React.lazy() with Suspense, minimizing initial bundle size. Routing is implemented with HashRouter (React Router v7) — hash routing was chosen over browser history for compatibility with Nginx SPA fallback without additional configuration. Each page is wrapped in ProtectedRoute, which checks for JWT token and page access (user.pages).'
        }</P>
        <Table
          headers={[isRu ? 'Страница' : 'Page', isRu ? 'Маршрут' : 'Route', 'LOC', isRu ? 'Назначение' : 'Purpose']}
          rows={[
            ['Dashboard', '/', '~300', isRu ? 'KPI-карточки (загрузка, завершённые, среднее время), LiveSTOWidget, PredictionWidget, рекомендации, события. Polling 5с.' : 'KPI cards (load, completed, avg time), LiveSTOWidget, PredictionWidget, recommendations, events. 5s polling.'],
            ['DashboardPosts', '/dashboard-posts', '521', isRu ? 'Gantt-таймлайн ЗН с drag-n-drop, индикатор текущей смены, conflict detection, optimistic locking (version), ConflictModal, ShiftSettings.' : 'Gantt timeline with drag-n-drop, current shift indicator, conflict detection, optimistic locking (version), ConflictModal, ShiftSettings.'],
            ['PostsDetail', '/posts-detail', '226', isRu ? 'Master-detail layout: список постов (карточки/таблица) + детальная панель с 9 секциями (timeline, summary, work orders, workers, alerts, event log, statistics, cameras, calendar). Все секции collapsible.' : 'Master-detail layout: post list (cards/table) + detail panel with 9 collapsible sections (timeline, summary, work orders, workers, alerts, event log, statistics, cameras, calendar).'],
            ['MapViewer', '/map-view', '~400', isRu ? 'Konva live-карта СТО с реальными позициями автомобилей, статусами постов, камерами. Обновляется через polling/Socket.IO.' : 'Konva live STO map with real vehicle positions, post statuses, cameras. Updated via polling/Socket.IO.'],
            ['MapEditor', '/map-editor', '1244', isRu ? 'Drag-drop редактор карты. 8 типов элементов: building, post, zone, camera, door, wall, label, infozone. Snap-to-grid 10px. Версионирование в БД с restore.' : 'Drag-drop map editor. 8 element types: building, post, zone, camera, door, wall, label, infozone. Snap-to-grid 10px. DB versioning with restore.'],
            ['Sessions', '/sessions', '~350', isRu ? 'Активные/завершённые сессии авто. QR-коды для идентификации. Привязка заказ-нарядов. Детали: ZoneStay, PostStay, Events.' : 'Active/completed vehicle sessions. QR codes for identification. Work order linking. Details: ZoneStay, PostStay, Events.'],
            ['WorkOrders', '/work-orders', '~200', isRu ? 'Список заказ-нарядов с фильтрами по статусу. CSV-импорт. Кнопки start/pause/resume/complete для управления жизненным циклом.' : 'Work order list with status filters. CSV import. Start/pause/resume/complete buttons for lifecycle management.'],
            ['Events', '/events', '~400', isRu ? '10 типов событий с фильтрами: group, type, zone, post, date range. Auto-refresh, пагинация. Цветовое кодирование по типу.' : '10 event types with filters: group, type, zone, post, date range. Auto-refresh, pagination. Color coding by type.'],
            ['Analytics', '/analytics', '655', isRu ? '6 типов графиков Recharts + тепловые карты + таблица сравнения + детали по постам. Экспорт: XLSX (4 листа), PDF (A4 landscape), PNG.' : '6 Recharts chart types + heatmaps + comparison table + post detail. Export: XLSX (4 sheets), PDF (A4 landscape), PNG.'],
            ['Data1C', '/data-1c', '926', isRu ? 'Drag-n-drop импорт XLSX, 3 вкладки (Planning, Workers, Stats), sync log, экспорт XLSX с фильтрами.' : 'Drag-n-drop XLSX import, 3 tabs (Planning, Workers, Stats), sync log, XLSX export with filters.'],
            ['Cameras', '/cameras', '~250', isRu ? '10 камер: вид по зонам + общий вид. HLS-стримы через CameraStreamModal. Статус online/offline.' : '10 cameras: zone view + all view. HLS streams via CameraStreamModal. Online/offline status.'],
            ['CameraMapping', '/camera-mapping', '312', isRu ? 'Маппинг камер на зоны с приоритетами (0-10). Drag-n-drop назначение. Сохранение через API.' : 'Camera to zone mapping with priorities (0-10). Drag-n-drop assignment. API persistence.'],
            ['Users', '/users', '~300', isRu ? 'CRUD пользователей. Назначение ролей. Выбор доступных страниц (pages[]). Настройка видимости элементов (hiddenElements[]).' : 'User CRUD. Role assignment. Page access selection (pages[]). Element visibility settings (hiddenElements[]).'],
            ['Shifts', '/shifts', '~400', isRu ? 'Недельный календарь смен. Назначение работников на посты. Обнаружение конфликтов (один работник на двух постах, пересечение смен). Акты приёма-передачи.' : 'Weekly shift calendar. Worker assignment to posts. Conflict detection (worker on two posts, shift overlap). Handover acts.'],
            ['Audit', '/audit', '~300', isRu ? 'Аудит-лог всех мутаций (admin only). Фильтры: user, action, entity, date. CSV-экспорт. Показ old/new data.' : 'Audit log of all mutations (admin only). Filters: user, action, entity, date. CSV export. Old/new data display.'],
            ['MyPost', '/my-post', '~200', isRu ? 'Личная страница механика. Текущий ЗН, таймер работы, кнопки play/pause/complete. Индикатор warningLevel.' : 'Mechanic personal page. Current WO, work timer, play/pause/complete buttons. WarningLevel indicator.'],
            ['Health', '/health', '~200', isRu ? 'Системный статус (admin only): backend uptime, database size/status, камеры online/offline, disk usage.' : 'System status (admin only): backend uptime, database size/status, cameras online/offline, disk usage.'],
            ['WorkerStats', '/worker-stats/:name', '~300', isRu ? 'Аналитика по конкретному работнику: графики выработки, заказ-наряды, среднее время, эффективность.' : 'Per-worker analytics: production charts, work orders, average time, efficiency.'],
            ['ReportSchedule', '/report-schedule', '~250', isRu ? 'CRUD расписаний автоотчётов. Cron-выражения. Доставка XLSX через Telegram. Кнопка "запустить сейчас".' : 'Auto-report schedule CRUD. Cron expressions. XLSX delivery via Telegram. "Run now" button.'],
            ['Login', '/login', '~150', isRu ? 'Форма логина (email + пароль). Rate limiting 20/мин. Mock login при недоступности backend.' : 'Login form (email + password). Rate limiting 20/min. Mock login when backend unavailable.'],
          ]}
        />

        <Sub>{isRu ? 'Dashboard — подробнее' : 'Dashboard — Details'}</Sub>
        <P>{isRu
          ? 'Главная страница отображает 5 виджетов (каждый можно скрыть для конкретного пользователя через element visibility): KPI-карточки (загрузка СТО, завершённые ЗН, среднее время обслуживания с DeltaBadge), LiveSTOWidget (мини-карта с текущими статусами постов), PredictionWidget (AI-прогнозы загрузки из /api/predict), список активных рекомендаций, и лента последних событий. Данные обновляются через usePolling с интервалом 5 секунд.'
          : 'The main page displays 5 widgets (each can be hidden per user via element visibility): KPI cards (STO load, completed WOs, average service time with DeltaBadge), LiveSTOWidget (mini map with current post statuses), PredictionWidget (AI load predictions from /api/predict), active recommendations list, and recent events feed. Data updates via usePolling with 5-second interval.'
        }</P>

        <Sub>{isRu ? 'DashboardPosts — Gantt-таймлайн' : 'DashboardPosts — Gantt Timeline'}</Sub>
        <P>{isRu
          ? 'Страница планирования отображает заказ-наряды в виде Gantt-таймлайна по постам. Пользователь может перетаскивать заказ-наряды между постами и во времени (drag-n-drop). При сохранении используется optimistic locking: если другой пользователь уже изменил расписание (version mismatch), показывается ConflictModal с деталями конфликта. Индикатор текущей смены отображает активную смену и назначенных работников. Свободные заказ-наряды отображаются в отдельной таблице FreeWorkOrdersTable.'
          : 'The planning page displays work orders as a Gantt timeline by posts. Users can drag work orders between posts and in time (drag-n-drop). Saving uses optimistic locking: if another user already changed the schedule (version mismatch), ConflictModal shows conflict details. The current shift indicator displays the active shift and assigned workers. Free work orders are shown in a separate FreeWorkOrdersTable.'
        }</P>

        <Sub>{isRu ? 'Analytics — экспорт данных' : 'Analytics — Data Export'}</Sub>
        <P>{isRu
          ? 'Страница аналитики предлагает 6 типов графиков: тренды загрузки (LineChart), рейтинг постов (BarChart), план-факт (AreaChart), распределение по зонам (PieChart), тепловая карта по дням/часам (WeeklyHeatmap), и детали по посту. Поддерживается экспорт в три формата: XLSX (4 листа: сводка, посты, дневные данные, детали), PDF (A4 landscape, многостраничный через чанки), PNG (скриншот конкретного графика через html2canvas).'
          : 'The analytics page offers 6 chart types: load trends (LineChart), post ranking (BarChart), plan vs actual (AreaChart), zone distribution (PieChart), day/hour heatmap (WeeklyHeatmap), and per-post details. Export is supported in three formats: XLSX (4 sheets: summary, posts, daily data, details), PDF (A4 landscape, multi-page via chunks), PNG (screenshot of specific chart via html2canvas).'
        }</P>

        {/* Section 10 — Components */}
        <SectionTitle id="components">{isRu ? '10. Frontend — Компоненты (17+)' : '10. Frontend — Components (17+)'}</SectionTitle>
        <P>{isRu
          ? 'Компоненты организованы в трёх уровнях: корневые общие компоненты (Layout, Sidebar, HelpButton и т.д.), доменные подпапки (dashboardPosts/ — 8 файлов для Gantt-таймлайна, postsDetail/ — 4 файла для master-detail), и виджеты (LiveSTOWidget, PredictionWidget, SparkLine и т.д.). Все компоненты используют CSS-переменные для поддержки тёмной/светлой темы и Lucide React для иконок.'
          : 'Components are organized in three levels: root shared components (Layout, Sidebar, HelpButton, etc.), domain subfolders (dashboardPosts/ — 8 files for Gantt timeline, postsDetail/ — 4 files for master-detail), and widgets (LiveSTOWidget, PredictionWidget, SparkLine, etc.). All components use CSS variables for dark/light theme support and Lucide React for icons.'
        }</P>
        <Table
          headers={[isRu ? 'Компонент' : 'Component', isRu ? 'Назначение' : 'Purpose', isRu ? 'Ключевые возможности' : 'Key Features']}
          rows={[
            ['Layout', isRu ? 'Каркас приложения' : 'App shell', isRu ? 'Header (язык, тема, уведомления, пользователь) + Sidebar + Outlet для страниц' : 'Header (language, theme, notifications, user) + Sidebar + Outlet for pages'],
            ['Sidebar', isRu ? 'Боковая навигация' : 'Side navigation', isRu ? 'Фильтрация по user.pages (admin видит всё), иконки Lucide, активный маршрут' : 'Filtered by user.pages (admin sees all), Lucide icons, active route'],
            ['HelpButton', isRu ? 'Контекстная справка' : 'Context help', isRu ? 'Кнопка "?" с модалкой, текст зависит от текущей страницы (pageKey)' : '"?" button with modal, text depends on current page (pageKey)'],
            ['DateRangePicker', isRu ? 'Выбор диапазона дат' : 'Date range picker', isRu ? 'Компактный picker с пресетами (24ч, 7д, 30д, произвольный)' : 'Compact picker with presets (24h, 7d, 30d, custom)'],
            ['DeltaBadge', isRu ? 'Бейдж изменения' : 'Change badge', isRu ? 'Стрелка вверх/вниз + процент изменения, цвет: зелёный (рост), красный (падение)' : 'Up/down arrow + change percentage, color: green (growth), red (decline)'],
            ['PostTimer', isRu ? 'Таймер заказ-наряда' : 'WO timer', isRu ? 'Реальное время работы, warning levels: none, warning (80%), critical (95%), overtime (100%+)' : 'Real work time, warning levels: none, warning (80%), critical (95%), overtime (100%+)'],
            ['QRBadge', isRu ? 'QR-код сессии' : 'Session QR code', isRu ? 'Генерация QR-кода с номером сессии для быстрой идентификации автомобиля' : 'QR code generation with session number for quick vehicle identification'],
            ['LiveSTOWidget', isRu ? 'Виджет живого состояния' : 'Live state widget', isRu ? 'Мини-карта с цветовой индикацией статусов постов в реальном времени' : 'Mini map with color-coded post statuses in real-time'],
            ['PredictionWidget', isRu ? 'ML-предсказания' : 'ML predictions', isRu ? 'Прогноз загрузки (данные из /api/predict, детерминированный seed для демо)' : 'Load prediction (data from /api/predict, deterministic seed for demo)'],
            ['SparkLine', isRu ? 'Мини-график тренда' : 'Mini trend chart', isRu ? 'Компактный LineChart (Recharts) для KPI-карточек, без осей' : 'Compact LineChart (Recharts) for KPI cards, no axes'],
            ['WeeklyHeatmap', isRu ? 'Тепловая карта 7 дней' : '7-day heatmap', isRu ? 'Матрица дни x часы с цветовой интенсивностью по загрузке' : 'Days x hours matrix with color intensity by load'],
            ['PhotoGallery', isRu ? 'Галерея фото' : 'Photo gallery', isRu ? 'Превью + полноэкранный просмотр с zoom, загрузка через /api/photos' : 'Preview + fullscreen view with zoom, loaded via /api/photos'],
            ['CameraStreamModal', isRu ? 'Модалка HLS-стрима' : 'HLS stream modal', isRu ? 'Полноэкранный HLS-стрим камеры через HLS.js' : 'Fullscreen camera HLS stream via HLS.js'],
            ['LocationSwitcher', isRu ? 'Переключатель локаций' : 'Location switcher', isRu ? 'Dropdown для выбора активной локации (мультитенантность)' : 'Dropdown for selecting active location (multi-tenancy)'],
            ['NotificationCenter', isRu ? 'Центр уведомлений' : 'Notification center', isRu ? 'Bell icon + dropdown с последними уведомлениями и рекомендациями' : 'Bell icon + dropdown with recent notifications and recommendations'],
            ['Skeleton', isRu ? 'Placeholder загрузки' : 'Loading placeholder', isRu ? 'Анимированные placeholder блоки пока данные загружаются' : 'Animated placeholder blocks while data loads'],
            ['STOMap', isRu ? 'Карта СТО (Konva)' : 'STO Map (Konva)', isRu ? 'Konva canvas с зонами, постами, камерами для MapViewer' : 'Konva canvas with zones, posts, cameras for MapViewer'],
            ['ErrorBoundary', isRu ? 'Обработчик ошибок React' : 'React error boundary', isRu ? 'Ловит ошибки рендера в дочерних компонентах, показывает fallback UI с кнопкой «Повторить»' : 'Catches render errors in child components, shows fallback UI with Retry button'],
            ['Pagination', isRu ? 'Универсальная пагинация' : 'Universal pagination', isRu ? 'Поддерживает compact/full режимы, perPage селектор, ellipsis, клиентскую и серверную пагинацию. Используется в 7 страницах.' : 'Supports compact/full modes, perPage selector, ellipsis, client and server-side pagination. Used in 7 pages.'],
          ]}
        />

        <Sub>dashboardPosts/</Sub>
        <P>{isRu
          ? '8 компонентов для страницы планирования: GanttTimeline (основной Gantt-таймлайн с постами по вертикали и временем по горизонтали), TimelineRow (строка одного поста с заказ-нарядами), TimelineHeader (шкала времени с часовыми делениями), FreeWorkOrdersTable (таблица нераспределённых ЗН), WorkOrderModal (модалка создания/редактирования ЗН), ShiftSettings (настройки текущей смены), ConflictModal (модалка при конфликте версий), Legend (легенда цветов и статусов).'
          : '8 components for the planning page: GanttTimeline (main Gantt timeline with posts vertically and time horizontally), TimelineRow (single post row with work orders), TimelineHeader (time scale with hourly divisions), FreeWorkOrdersTable (unassigned WO table), WorkOrderModal (WO create/edit modal), ShiftSettings (current shift settings), ConflictModal (version conflict modal), Legend (color and status legend).'
        }</P>

        <Sub>postsDetail/</Sub>
        <P>{isRu
          ? '4 компонента для страницы аналитики постов: PostCardsView (карточный вид списка постов с мини-статистикой), PostTableView (табличный вид с сортировкой), PostDetailPanel (правая панель с 9 collapsible-секциями: timeline, summary, work orders, workers, alerts, event log, statistics, cameras, calendar), CollapsibleSection (переиспользуемый компонент сворачиваемой секции с анимацией).'
          : '4 components for post analytics page: PostCardsView (card view of post list with mini stats), PostTableView (table view with sorting), PostDetailPanel (right panel with 9 collapsible sections: timeline, summary, work orders, workers, alerts, event log, statistics, cameras, calendar), CollapsibleSection (reusable collapsible section component with animation).'
        }</P>

        {/* Section 11 — Contexts */}
        <SectionTitle id="contexts">{isRu ? '11. Контексты' : '11. Contexts'}</SectionTitle>
        <P>{isRu
          ? 'Три React Context обеспечивают глобальное состояние приложения. Они вложены в строгом порядке (Theme -> Toast -> Auth), что позволяет более глубоким контекстам использовать функции внешних.'
          : 'Three React Contexts provide global application state. They are nested in strict order (Theme -> Toast -> Auth), allowing deeper contexts to use outer context functions.'
        }</P>

        <Sub>AuthContext</Sub>
        <P>{isRu
          ? 'Главный контекст приложения, управляющий всем циклом авторизации и предоставляющий API-клиент. Экспортирует: user (текущий пользователь с ролями, permissions, pages, hiddenElements), loading (состояние загрузки), login(email, password) — авторизация через /api/auth/login с fallback на mock при недоступности backend, logout() — очистка токенов и редирект.'
          : 'The main application context, managing the entire auth lifecycle and providing an API client. Exports: user (current user with roles, permissions, pages, hiddenElements), loading (loading state), login(email, password) — auth via /api/auth/login with mock fallback when backend unavailable, logout() — token cleanup and redirect.'
        }</P>
        <P>{isRu
          ? 'hasPermission(key) проверяет наличие конкретного разрешения у текущего пользователя. isElementVisible(pageId, elementId) проверяет, виден ли конкретный виджет/секция для пользователя — сверяет с массивом hiddenElements, загруженным из БД через /api/auth/me. updateCurrentUser(data) обновляет локальное состояние пользователя без повторного запроса на сервер.'
          : 'hasPermission(key) checks if the current user has a specific permission. isElementVisible(pageId, elementId) checks if a specific widget/section is visible for the user — cross-references with hiddenElements array loaded from DB via /api/auth/me. updateCurrentUser(data) updates local user state without re-fetching from server.'
        }</P>
        <P>{isRu
          ? 'API-клиент (api) — fetch-обёртка с автоматическим добавлением Authorization: Bearer заголовка и базового URL. Предоставляет методы get, post, put, delete. При получении 401 автоматически пытается обновить access token через refresh endpoint.'
          : 'The API client (api) is a fetch wrapper with automatic Authorization: Bearer header and base URL injection. Provides get, post, put, delete methods. On 401, automatically attempts to refresh the access token via the refresh endpoint.'
        }</P>

        <Sub>PAGE_ELEMENTS</Sub>
        <P>{isRu
          ? 'Реестр PAGE_ELEMENTS определяет крупные элементы на каждой странице, которые администратор может скрывать для конкретных пользователей. 4 поддерживаемые страницы: Dashboard (5 элементов: kpiCards, liveSto, predictions, recommendations, recentEvents), DashboardPosts (4: shiftStats, currentShift, ganttTimeline, freeWorkOrders), PostsDetail (11: postsList, detailPanel, timeline, summary, workOrders, workers, alerts, eventLog, statistics, cameras, calendar), Analytics (7: summaryStats, trendsCharts, rankingCharts, planFactChart, comparisonTable, heatmaps, postDetail).'
          : 'The PAGE_ELEMENTS registry defines major elements on each page that administrators can hide for specific users. 4 supported pages: Dashboard (5 elements: kpiCards, liveSto, predictions, recommendations, recentEvents), DashboardPosts (4: shiftStats, currentShift, ganttTimeline, freeWorkOrders), PostsDetail (11: postsList, detailPanel, timeline, summary, workOrders, workers, alerts, eventLog, statistics, cameras, calendar), Analytics (7: summaryStats, trendsCharts, rankingCharts, planFactChart, comparisonTable, heatmaps, postDetail).'
        }</P>

        <Sub>ThemeContext</Sub>
        <P>{isRu
          ? 'Управляет темой оформления (dark/light). При переключении устанавливает CSS-переменные на элемент :root: --bg-primary, --bg-secondary, --text-primary, --text-secondary, --text-muted, --accent, --border-glass и другие. Тема сохраняется в localStorage[\'theme\'] и восстанавливается при загрузке. По умолчанию используется тёмная тема. Glassmorphism-дизайн реализован через CSS-переменные: полупрозрачные фоны, размытие (backdrop-filter: blur), стеклянные границы.'
          : 'Manages the visual theme (dark/light). On toggle, sets CSS variables on :root element: --bg-primary, --bg-secondary, --text-primary, --text-secondary, --text-muted, --accent, --border-glass and others. Theme is saved to localStorage[\'theme\'] and restored on load. Dark theme is the default. Glassmorphism design is achieved through CSS variables: semi-transparent backgrounds, blur (backdrop-filter: blur), glass borders.'
        }</P>

        <Sub>ToastContext</Sub>
        <P>{isRu
          ? 'Глобальная система уведомлений с 4 типами: success (зелёный), error (красный), warning (жёлтый), info (синий). Максимум 3 тоста одновременно — при добавлении четвёртого самый старый удаляется. Auto-dismiss через настраиваемый таймер. Тосты используются по всему приложению для обратной связи: успешное сохранение, ошибки API, предупреждения о конфликтах, информационные сообщения.'
          : 'Global notification system with 4 types: success (green), error (red), warning (yellow), info (blue). Maximum 3 toasts simultaneously — when a 4th is added, the oldest is removed. Auto-dismiss via configurable timer. Toasts are used throughout the app for feedback: successful save, API errors, conflict warnings, informational messages.'
        }</P>

        {/* Section 12 — Hooks */}
        <SectionTitle id="hooks">{isRu ? '12. Хуки' : '12. Hooks'}</SectionTitle>
        <P>{isRu
          ? 'Четыре кастомных хука инкапсулируют сложную логику взаимодействия с Socket.IO, таймеры заказ-нарядов, мониторинг камер и универсальные API-запросы.'
          : 'Four custom hooks encapsulate complex logic for Socket.IO interaction, work order timers, camera monitoring, and universal API requests.'
        }</P>

        <Sub>useSocket</Sub>
        <P>{isRu
          ? 'Основной хук для real-time коммуникации. Содержит singleton-экземпляр Socket.IO подключения (один на приложение). connectSocket(token) устанавливает подключение с JWT-аутентификацией, disconnectSocket() разрывает. usePolling(callback, interval) — декларативный polling через setInterval с автоматической очисткой. useSubscribe(event, handler) — подписка на Socket.IO события с автоматической отпиской при unmount. useSocketStatus() — текущий статус подключения (connected/disconnected/reconnecting).'
          : 'Main hook for real-time communication. Contains a singleton Socket.IO connection instance (one per app). connectSocket(token) establishes connection with JWT authentication, disconnectSocket() tears down. usePolling(callback, interval) — declarative polling via setInterval with automatic cleanup. useSubscribe(event, handler) — Socket.IO event subscription with automatic unsubscription on unmount. useSocketStatus() — current connection status (connected/disconnected/reconnecting).'
        }</P>

        <Sub>useWorkOrderTimer</Sub>
        <P>{isRu
          ? 'Хук для управления таймером заказ-наряда на посту. Принимает workOrder (с normHours, startedAt, pausedAt, totalPausedMs) и возвращает: elapsedMs (реальное рабочее время без пауз), percentUsed (процент от нормо-часов), warningLevel (none при <80%, warning при 80-95%, critical при 95-100%, overtime при >100%), и функции start/pause/resume/complete. Таймер использует requestAnimationFrame для плавного обновления каждую секунду. При паузе таймер останавливается, при возобновлении — продолжает с учётом накопленного totalPausedMs.'
          : 'Hook for managing work order timer at a post. Takes workOrder (with normHours, startedAt, pausedAt, totalPausedMs) and returns: elapsedMs (real work time without pauses), percentUsed (percentage of norm hours), warningLevel (none at <80%, warning at 80-95%, critical at 95-100%, overtime at >100%), and start/pause/resume/complete functions. Timer uses requestAnimationFrame for smooth per-second updates. On pause, timer stops; on resume, continues accounting for accumulated totalPausedMs.'
        }</P>

        <Sub>useCameraStatus</Sub>
        <P>{isRu
          ? 'Хук для отслеживания статуса камер через Socket.IO. Подписывается на событие camera:status и поддерживает Map<camId, { online, lastCheck }>. CameraHealthCheck на бэкенде пингует каждую камеру каждые 30 секунд и эмитит результат. Хук позволяет любому компоненту узнать текущий статус конкретной камеры без дополнительных API-запросов.'
          : 'Hook for tracking camera status via Socket.IO. Subscribes to camera:status event and maintains Map<camId, { online, lastCheck }>. Backend CameraHealthCheck pings each camera every 30 seconds and emits the result. The hook allows any component to know the current status of a specific camera without additional API requests.'
        }</P>

        <Sub>useAsync</Sub>
        <P>{isRu
          ? 'Универсальный хук для API-запросов. Принимает URL и опции (enabled, deps, transform, initialData). Возвращает { data, loading, error, refetch }. Автоматически выполняет запрос через api.get() при монтировании и при изменении deps. mountedRef предотвращает setState на размонтированных компонентах. transform позволяет преобразовать ответ API перед сохранением в state.'
          : 'Universal hook for API requests. Takes URL and options (enabled, deps, transform, initialData). Returns { data, loading, error, refetch }. Automatically fetches via api.get() on mount and when deps change. mountedRef prevents setState on unmounted components. transform allows transforming API response before storing in state.'
        }</P>

        <Table
          headers={[isRu ? 'Хук' : 'Hook', isRu ? 'Входные данные' : 'Input', isRu ? 'Выходные данные' : 'Output']}
          rows={[
            ['useSocket', isRu ? 'JWT token при connect' : 'JWT token on connect', 'connectSocket, disconnectSocket, usePolling, useSubscribe, useSocketStatus'],
            ['useWorkOrderTimer', isRu ? 'WorkOrder объект' : 'WorkOrder object', 'elapsedMs, percentUsed, warningLevel, start, pause, resume, complete'],
            ['useCameraStatus', isRu ? 'Нет (авто-подписка)' : 'None (auto-subscribe)', 'Map<camId, { online, lastCheck }>'],
            ['useAsync', isRu ? 'URL, { enabled, deps, transform, initialData }' : 'URL, { enabled, deps, transform, initialData }', '{ data, loading, error, refetch }'],
          ]}
        />

        {/* Section 13 — Utils */}
        <SectionTitle id="utils">{isRu ? '13. Утилиты' : '13. Utilities'}</SectionTitle>
        <P>{isRu
          ? 'Утилиты разделены на два модуля: translate.js для локализации названий зон и постов, и export.js для экспорта данных в различные форматы.'
          : 'Utilities are split into two modules: translate.js for zone and post name localization, and export.js for data export in various formats.'
        }</P>

        <Sub>translate.js</Sub>
        <P>{isRu
          ? 'translateZone(name, isRu) и translatePost(name, isRu) — функции перевода названий зон и постов между русским и английским языками. Используются повсеместно в таблицах, графиках и на карте. Названия зон: "Зона ремонта" <-> "Repair Zone", "Зона ожидания" <-> "Waiting Zone" и т.д. Названия постов: "Пост 1 (грузовой)" <-> "Post 1 (heavy)" и т.д.'
          : 'translateZone(name, isRu) and translatePost(name, isRu) — functions for translating zone and post names between Russian and English. Used throughout tables, charts, and on the map. Zone names: "Repair Zone" <-> "Зона ремонта", "Waiting Zone" <-> "Зона ожидания", etc. Post names: "Post 1 (heavy)" <-> "Пост 1 (грузовой)", etc.'
        }</P>

        <Sub>export.js</Sub>
        <P>{isRu
          ? 'exportToXlsx(data, options) — генерация XLSX-файла с 4 листами: Summary (общая статистика за период), Posts (данные по каждому посту), Daily (дневная разбивка), Details (детальные записи). Использует библиотеку xlsx (SheetJS). Файл автоматически скачивается через programmatic click на <a> элемент.'
          : 'exportToXlsx(data, options) — XLSX file generation with 4 sheets: Summary (overall stats for period), Posts (per-post data), Daily (daily breakdown), Details (detailed records). Uses the xlsx library (SheetJS). File automatically downloads via programmatic click on <a> element.'
        }</P>
        <P>{isRu
          ? 'exportToPdf(element, filename) — экспорт DOM-элемента в PDF формат A4 landscape. Для больших элементов контент разбивается на чанки (2500px каждый) чтобы не превышать лимиты canvas браузера. Каждый чанк рендерится через html2canvas и нарезается на A4-страницы. Фон принудительно устанавливается в #0f172a для корректного рендера тёмной темы.'
          : 'exportToPdf(element, filename) — exports DOM element to PDF in A4 landscape format. For large elements, content is split into chunks (2500px each) to stay within browser canvas limits. Each chunk is rendered via html2canvas and sliced into A4 pages. Background is forced to #0f172a for correct dark theme rendering.'
        }</P>
        <P>{isRu
          ? 'downloadChartAsPng(chartRef, filename) — скачивание конкретного графика Recharts как PNG-изображение. Использует html2canvas для рендеринга SVG-графика в canvas, затем конвертирует в data URL и инициирует скачивание.'
          : 'downloadChartAsPng(chartRef, filename) — downloads a specific Recharts chart as a PNG image. Uses html2canvas to render the SVG chart to canvas, then converts to data URL and initiates download.'
        }</P>

        {/* Section 14 — RBAC */}
        <SectionTitle id="rbac">{isRu ? '14. RBAC — Система доступа' : '14. RBAC — Access Control'}</SectionTitle>
        <P>{isRu
          ? 'Система контроля доступа работает на трёх уровнях: роли (определяют базовый набор разрешений), страницы (определяют доступные маршруты), и видимость элементов (определяют видимые виджеты/секции на страницах). Каждый уровень настраивается независимо через админ-панель.'
          : 'The access control system operates on three levels: roles (define base permission set), pages (define accessible routes), and element visibility (define visible widgets/sections on pages). Each level is configured independently through the admin panel.'
        }</P>

        <Sub>{isRu ? 'Роли и разрешения' : 'Roles & Permissions'}</Sub>
        <P>{isRu
          ? '5 ролей с 15 разрешениями. На бэкенде ROLE_PAGES маппинг определяет, какие страницы доступны каждой роли по умолчанию. Администратор может расширить или ограничить доступ к страницам для конкретного пользователя через массив pages[]. Sidebar на фронтенде фильтрует навигацию: user.pages.includes(pageId) показывает только доступные пункты меню; admin видит все пункты безусловно.'
          : '5 roles with 15 permissions. On the backend, ROLE_PAGES mapping defines which pages are accessible to each role by default. An administrator can expand or restrict page access for a specific user via the pages[] array. Sidebar on the frontend filters navigation: user.pages.includes(pageId) shows only accessible menu items; admin sees all items unconditionally.'
        }</P>
        <Table
          headers={[isRu ? 'Роль' : 'Role', isRu ? 'Разрешения' : 'Permissions', isRu ? 'Типичные страницы' : 'Typical Pages']}
          rows={[
            ['admin', isRu ? 'Все 15 + manage_roles, manage_settings' : 'All 15 + manage_roles, manage_settings', isRu ? 'Все 20 страниц' : 'All 20 pages'],
            ['director', 'view_dashboard, view_analytics, view_zones, view_posts, view_sessions, view_events, view_work_orders, view_recommendations, view_cameras', isRu ? 'Dashboard, Analytics, Sessions, Events, Cameras' : 'Dashboard, Analytics, Sessions, Events, Cameras'],
            ['manager', 'view_dashboard, view_zones, view_posts, view_sessions, view_events, manage_work_orders, view_recommendations', isRu ? 'Dashboard, DashboardPosts, WorkOrders, Sessions, Events' : 'Dashboard, DashboardPosts, WorkOrders, Sessions, Events'],
            ['mechanic', 'view_dashboard, view_posts, view_sessions', isRu ? 'Dashboard, MyPost' : 'Dashboard, MyPost'],
            ['viewer', 'view_dashboard, view_zones, view_posts', isRu ? 'Dashboard' : 'Dashboard'],
          ]}
        />
        <P>{isRu
          ? 'Backend-авторизация реализована через middleware requirePermission(...keys). Этот middleware проверяет, что у req.user есть все указанные разрешения. При отсутствии любого из них возвращается HTTP 403. Middleware authenticate() обязателен для всех защищённых маршрутов — он декодирует JWT, загружает пользователя из Prisma и устанавливает req.user.'
          : 'Backend authorization is implemented via requirePermission(...keys) middleware. This middleware checks that req.user has all specified permissions. If any is missing, HTTP 403 is returned. The authenticate() middleware is required for all protected routes — it decodes JWT, loads user from Prisma, and sets req.user.'
        }</P>

        <Sub>{isRu ? 'Видимость элементов (Element Visibility)' : 'Element Visibility'}</Sub>
        <P>{isRu
          ? 'Помимо доступа к страницам, администратор может скрывать крупные элементы (виджеты, секции, графики) на страницах для каждого пользователя индивидуально. Настройки хранятся в БД в поле user.hiddenElements (JSON-массив строк формата "pageId:elementId"). При логине и через GET /api/auth/me hiddenElements загружаются в AuthContext.'
          : 'Beyond page access, administrators can hide major elements (widgets, sections, charts) on pages for each user individually. Settings are stored in DB in user.hiddenElements field (JSON array of strings in "pageId:elementId" format). On login and via GET /api/auth/me, hiddenElements are loaded into AuthContext.'
        }</P>
        <P>{isRu
          ? 'На фронтенде isElementVisible(pageId, elementId) из AuthContext проверяет, должен ли элемент быть видимым. Каждая страница оборачивает свои виджеты в проверку: если элемент скрыт — компонент не рендерится. Админ настраивает видимость на странице Users при редактировании пользователя — чекбоксы для каждого элемента по каждой странице.'
          : 'On the frontend, isElementVisible(pageId, elementId) from AuthContext checks if an element should be visible. Each page wraps its widgets in this check: if the element is hidden, the component is not rendered. Admin configures visibility on the Users page when editing a user — checkboxes for each element on each page.'
        }</P>
        <Table
          headers={[isRu ? 'Страница' : 'Page', isRu ? 'Элементы' : 'Elements', isRu ? 'Кол-во' : 'Count']}
          rows={[
            ['Dashboard', 'kpiCards, liveSto, predictions, recommendations, recentEvents', '5'],
            ['DashboardPosts', 'shiftStats, currentShift, ganttTimeline, freeWorkOrders', '4'],
            ['PostsDetail', 'postsList, detailPanel, timeline, summary, workOrders, workers, alerts, eventLog, statistics, cameras, calendar', '11'],
            ['Analytics', 'summaryStats, trendsCharts, rankingCharts, planFactChart, comparisonTable, heatmaps, postDetail', '7'],
          ]}
        />
        <P>{isRu
          ? 'Backend: PUT /api/users/:id принимает hiddenElements[] в теле запроса и сохраняет в БД. GET /api/auth/me возвращает hiddenElements в объекте пользователя. Всего 27 настраиваемых элементов на 4 страницах.'
          : 'Backend: PUT /api/users/:id accepts hiddenElements[] in the request body and saves to DB. GET /api/auth/me returns hiddenElements in the user object. Total: 27 configurable elements across 4 pages.'
        }</P>

        {/* Section 15 — i18n */}
        <SectionTitle id="i18n">{isRu ? '15. Интернационализация' : '15. Internationalization'}</SectionTitle>
        <P>{isRu
          ? 'Интернационализация реализована через react-i18next с двумя языками: русский (RU, по умолчанию) и английский (EN). Файлы переводов расположены в frontend/src/i18n/ru.json и frontend/src/i18n/en.json, каждый содержит ~512 ключей, организованных в 37 секций.'
          : 'Internationalization is implemented via react-i18next with two languages: Russian (RU, default) and English (EN). Translation files are located at frontend/src/i18n/ru.json and frontend/src/i18n/en.json, each containing ~512 keys organized in 37 sections.'
        }</P>
        <P>{isRu
          ? 'Все тексты интерфейса используют t(\'key\') для перевода. Например: t(\'nav.dashboard\'), t(\'workOrders.status.completed\'), t(\'analytics.export.xlsx\'). Языки поддерживают 100% паритет — каждый ключ существует в обоих файлах. Текущий язык сохраняется в localStorage[\'language\'] и восстанавливается при загрузке.'
          : 'All UI texts use t(\'key\') for translation. For example: t(\'nav.dashboard\'), t(\'workOrders.status.completed\'), t(\'analytics.export.xlsx\'). Languages maintain 100% parity — every key exists in both files. Current language is saved to localStorage[\'language\'] and restored on load.'
        }</P>
        <P>{isRu
          ? 'Переключение языка выполняется через i18n.changeLanguage(\'en\') или i18n.changeLanguage(\'ru\') и мгновенно обновляет весь интерфейс без перезагрузки страницы. Некоторые динамические данные (названия зон, постов) переводятся через утилиту translate.js, а не через i18n — так как эти данные приходят с бэкенда на русском языке.'
          : 'Language switching is done via i18n.changeLanguage(\'en\') or i18n.changeLanguage(\'ru\') and instantly updates the entire UI without page reload. Some dynamic data (zone names, post names) is translated via the translate.js utility rather than i18n — since this data comes from the backend in Russian.'
        }</P>
        <Code>{`// ${isRu ? 'Использование в компонентах' : 'Usage in components'}
const { t, i18n } = useTranslation();
const isRu = i18n.language === 'ru';

// ${isRu ? 'Статические тексты через t()' : 'Static texts via t()'}
<h1>{t('nav.dashboard')}</h1>
<span>{t('workOrders.status.completed')}</span>

// ${isRu ? 'Динамические данные через translate.js' : 'Dynamic data via translate.js'}
translateZone(zone.name, isRu)
translatePost(post.name, isRu)

// ${isRu ? 'Переключение языка' : 'Language switching'}
i18n.changeLanguage('en')`}</Code>

        {/* Section 16 — PWA */}
        <SectionTitle id="pwa">{isRu ? '16. PWA и Service Worker' : '16. PWA & Service Worker'}</SectionTitle>
        <P>{isRu
          ? 'Приложение реализовано как Progressive Web App (PWA) с Service Worker и Web Push уведомлениями. Service Worker (sw.js) использует стратегию Network-first: сначала пытается получить ресурс из сети, при неудаче — из кеша. Это обеспечивает актуальность данных при наличии сети и работоспособность при временной потере связи.'
          : 'The application is implemented as a Progressive Web App (PWA) with Service Worker and Web Push notifications. Service Worker (sw.js) uses a Network-first strategy: first attempts to fetch the resource from the network, on failure — from cache. This ensures data freshness when online and functionality during temporary connection loss.'
        }</P>
        <P>{isRu
          ? 'Service Worker исключает из кеширования динамические ресурсы: /api/* (запросы к бэкенду), /socket.io/* (WebSocket). CACHE_NAME (текущий: metricsaiup-v11) должен обновляться при каждом билде фронтенда — это единственный способ гарантировать, что пользователи получат новую версию приложения, а не закешированную старую.'
          : 'Service Worker excludes dynamic resources from caching: /api/* (backend requests), /socket.io/* (WebSocket). CACHE_NAME (current: metricsaiup-v11) must be updated on every frontend build — this is the only way to guarantee users receive the new app version rather than a cached old one.'
        }</P>
        <P>{isRu
          ? 'Push-уведомления реализованы через протокол Web Push с VAPID-ключами. Фронтенд подписывается через POST /api/push/subscribe (отправляет endpoint и ключи), бэкенд сохраняет подписку в PushSubscription модели. При отправке уведомления (POST /api/push/send) используется библиотека web-push. manifest.json описывает PWA: имя, иконки, цвета, start_url.'
          : 'Push notifications are implemented via the Web Push protocol with VAPID keys. The frontend subscribes via POST /api/push/subscribe (sends endpoint and keys), the backend saves the subscription in the PushSubscription model. When sending a notification (POST /api/push/send), the web-push library is used. manifest.json describes the PWA: name, icons, colors, start_url.'
        }</P>
        <Code>{`// ${isRu ? 'Жизненный цикл Service Worker' : 'Service Worker lifecycle'}
// sw.js - CACHE_NAME ${isRu ? 'нужно бампить при каждом билде' : 'must be bumped on each build'}
const CACHE_NAME = 'metricsaiup-v11';

// ${isRu ? 'Стратегия: Network-first' : 'Strategy: Network-first'}
// 1. fetch(request) ${isRu ? 'из сети' : 'from network'}
// 2. ${isRu ? 'При ошибке — cache.match(request)' : 'On error — cache.match(request)'}
// 3. ${isRu ? 'Исключения: /api/*, /socket.io/*' : 'Exclusions: /api/*, /socket.io/*'}

// Push ${isRu ? 'уведомления' : 'notifications'}
// POST /api/push/subscribe — ${isRu ? 'подписка' : 'subscribe'}
// POST /api/push/send — ${isRu ? 'отправка' : 'send'}`}</Code>

        {/* Section 17 — HLS */}
        <SectionTitle id="hls">{isRu ? '17. HLS Видеостриминг' : '17. HLS Video Streaming'}</SectionTitle>
        <P>{isRu
          ? 'Система видеонаблюдения обеспечивает просмотр 10 RTSP-камер через веб-интерфейс. Камеры передают RTSP-потоки, которые конвертируются в HLS (HTTP Live Streaming) через FFmpeg на стороне сервера. HLS-сервер (server.js) работает на порту 8181 с HTTPS.'
          : 'The video surveillance system provides viewing of 10 RTSP cameras through the web interface. Cameras transmit RTSP streams, which are converted to HLS (HTTP Live Streaming) via FFmpeg on the server side. The HLS server (server.js) runs on port 8181 with HTTPS.'
        }</P>
        <P>{isRu
          ? 'FFmpeg запускается для каждой камеры как отдельный процесс. Параметры конвертации: сегменты по 2 секунды, 6 сегментов в плейлисте (итого ~12 секунд задержки). При падении FFmpeg-процесса он автоматически перезапускается через 3 секунды. Выходные файлы (.m3u8 плейлист + .ts сегменты) сохраняются в /project/hls/ и раздаются как через HLS-сервер (:8181), так и через Nginx (/hls/*).'
          : 'FFmpeg runs for each camera as a separate process. Conversion parameters: 2-second segments, 6 segments in playlist (total ~12 seconds delay). If an FFmpeg process crashes, it automatically restarts after 3 seconds. Output files (.m3u8 playlist + .ts segments) are saved to /project/hls/ and served both via HLS server (:8181) and Nginx (/hls/*).'
        }</P>
        <P>{isRu
          ? 'На фронтенде HLS-потоки воспроизводятся через библиотеку HLS.js в компоненте CameraStreamModal. HLS.js автоматически адаптирует качество к пропускной способности сети. Камеры отображаются на двух страницах: Cameras (вид по зонам и общий вид) и MapViewer (позиции на карте СТО). Статус камер (online/offline) мониторится через CameraHealthCheck каждые 30 секунд.'
          : 'On the frontend, HLS streams are played via the HLS.js library in the CameraStreamModal component. HLS.js automatically adapts quality to network bandwidth. Cameras are displayed on two pages: Cameras (zone view and all view) and MapViewer (positions on STO map). Camera status (online/offline) is monitored via CameraHealthCheck every 30 seconds.'
        }</P>
        <Code>{`RTSP Camera (10x)
  \u2502  rtsp://86.57.249.76:1732/stream1
  \u2502  rtsp://86.57.249.76:1832/stream2
  \u2502  ...
  \u25bc
FFmpeg (${isRu ? 'отдельный процесс на камеру' : 'separate process per camera'})
  -i rtsp://... -c:v copy -f hls
  -hls_time 2              # ${isRu ? '2-секундные сегменты' : '2-second segments'}
  -hls_list_size 6         # ${isRu ? '6 сегментов в плейлисте' : '6 segments in playlist'}
  -hls_flags delete_segments
  \u25bc
/project/hls/
  cam1.m3u8 + cam1-000001.ts, cam1-000002.ts, ...
  \u25bc
HLS Server (:8181 HTTPS) + Nginx (/hls/*)
  \u25bc
HLS.js (${isRu ? 'браузер' : 'browser'}) \u2192 CameraStreamModal`}</Code>

        {/* Section 18 — 1C */}
        <SectionTitle id="integration1c">{isRu ? '18. Интеграция с 1С' : '18. 1C Integration'}</SectionTitle>
        <P>{isRu
          ? 'Интеграция с ERP-системой 1С реализована через обмен XLSX-файлами. Поддерживаются два режима импорта: ручной (drag-n-drop XLSX через веб-интерфейс на странице Data1C) и автоматический (file watcher отслеживает директорию /data/1c-import/ и автоматически обрабатывает появляющиеся файлы).'
          : '1C ERP integration is implemented via XLSX file exchange. Two import modes are supported: manual (drag-n-drop XLSX via web interface on Data1C page) and automatic (file watcher monitors /data/1c-import/ directory and automatically processes appearing files).'
        }</P>
        <P>{isRu
          ? 'Поддерживаются два типа данных: Planning (планирование — мастера, расписание работ, плановые заказ-наряды с датами и нормо-часами) и Workers (выработка — выполненные заказ-наряды, фактические нормо-часы, привязка к работникам). При импорте выполняется дедупликация по уникальным идентификаторам (номер заказ-наряда, дата, работник), чтобы повторный импорт того же файла не создавал дублей.'
          : 'Two data types are supported: Planning (planning — masters, work schedules, planned work orders with dates and norm hours) and Workers (production — completed work orders, actual norm hours, worker assignments). Import performs deduplication by unique identifiers (work order number, date, worker), so re-importing the same file does not create duplicates.'
        }</P>
        <P>{isRu
          ? 'Результат импорта сохраняется в три JSON-файла: /data/1c-planning.json (данные планирования), /data/1c-workers.json (данные выработки), /data/1c-stats.json (агрегированная статистика). Эти файлы используются страницей Data1C для отображения данных. Каждая операция импорта/экспорта записывается в SyncLog в БД с полями: type, direction (import/export), status (success/error), fileName, recordCount, error.'
          : 'Import results are saved to three JSON files: /data/1c-planning.json (planning data), /data/1c-workers.json (production data), /data/1c-stats.json (aggregated statistics). These files are used by the Data1C page for display. Each import/export operation is recorded in SyncLog in DB with fields: type, direction (import/export), status (success/error), fileName, recordCount, error.'
        }</P>
        <P>{isRu
          ? 'Экспорт из системы также доступен в формате XLSX: страница Data1C позволяет выбрать фильтры (период, тип данных, работники) и скачать отформатированный XLSX-файл для импорта обратно в 1С или для анализа в Excel.'
          : 'Export from the system is also available in XLSX format: the Data1C page allows selecting filters (period, data type, workers) and downloading a formatted XLSX file for importing back to 1C or for analysis in Excel.'
        }</P>

        {/* Section 19 — Testing */}
        <SectionTitle id="testing">{isRu ? '19. Тестирование' : '19. Testing'}</SectionTitle>
        <P>{isRu
          ? 'Тестирование фронтенда реализовано через Vitest (быстрый test runner, совместимый с Vite) + React Testing Library (тестирование компонентов с точки зрения пользователя) + jsdom (эмуляция DOM в Node.js). Конфигурация тестов находится в vite.config.js (секция test).'
          : 'Frontend testing is implemented via Vitest (fast test runner compatible with Vite) + React Testing Library (component testing from user perspective) + jsdom (DOM emulation in Node.js). Test configuration is in vite.config.js (test section).'
        }</P>
        <P>{isRu
          ? 'Тесты расположены рядом с тестируемыми файлами (*.test.jsx). Запуск: npm test (из frontend/). Vitest поддерживает watch mode для разработки, coverage reports, и параллельное выполнение. React Testing Library используется для рендеринга компонентов и проверки поведения: render(), screen.getByText(), fireEvent.click(), waitFor().'
          : 'Tests are co-located with tested files (*.test.jsx). Run: npm test (from frontend/). Vitest supports watch mode for development, coverage reports, and parallel execution. React Testing Library is used for rendering components and verifying behavior: render(), screen.getByText(), fireEvent.click(), waitFor().'
        }</P>
        <Code>{`# ${isRu ? 'Запуск тестов' : 'Run tests'}
cd /project/frontend && npm test

# ${isRu ? 'Стек тестирования' : 'Testing stack'}
# Vitest — ${isRu ? 'test runner (совместим с Vite)' : 'test runner (Vite-compatible)'}
# React Testing Library — ${isRu ? 'рендеринг и проверка компонентов' : 'component rendering and assertions'}
# jsdom — ${isRu ? 'эмуляция DOM для Node.js' : 'DOM emulation for Node.js'}`}</Code>

        {/* Section 20 — Map */}
        <SectionTitle id="map">{isRu ? '20. Физическая карта СТО' : '20. Physical STO Map'}</SectionTitle>
        <P>{isRu
          ? 'Интерактивная карта СТО реализована на Konva (2D canvas framework для React через react-konva). Карта отображает реальный план здания автосервиса размером 46540x30690 мм с точным расположением всех объектов: 5 зон, 10 постов, 10 камер, стены, двери, информационные зоны.'
          : 'The interactive STO map is built on Konva (2D canvas framework for React via react-konva). The map displays the real auto service building plan measuring 46540x30690mm with precise placement of all objects: 5 zones, 10 posts, 10 cameras, walls, doors, information zones.'
        }</P>
        <P>{isRu
          ? 'MapViewer — страница просмотра карты в реальном времени. Посты окрашиваются по текущему статусу (зелёный — свободен, жёлтый — занят без работы, красный — активная работа). Данные обновляются через polling и Socket.IO. Клик по посту показывает детальную информацию: номер авто, текущий ЗН, работник, время.'
          : 'MapViewer — real-time map viewing page. Posts are colored by current status (green — free, yellow — occupied without work, red — active work). Data updates via polling and Socket.IO. Clicking a post shows detailed info: plate number, current WO, worker, time.'
        }</P>
        <P>{isRu
          ? 'MapEditor (1244 строк) — полнофункциональный drag-drop редактор карты. Поддерживает 8 типов элементов: building (здание/стены), post (рабочий пост), zone (зона), camera (камера с углом обзора), door (дверь/ворота), wall (отдельная стена), label (текстовая подпись), infozone (информационная зона). Snap-to-grid 10px обеспечивает аккуратное выравнивание. Элементы можно перемещать, изменять размер, поворачивать и удалять.'
          : 'MapEditor (1244 LOC) — full-featured drag-drop map editor. Supports 8 element types: building (building/walls), post (work post), zone (zone), camera (camera with viewing angle), door (door/gate), wall (separate wall), label (text label), infozone (information zone). Snap-to-grid 10px ensures neat alignment. Elements can be moved, resized, rotated, and deleted.'
        }</P>
        <P>{isRu
          ? 'Карта сохраняется в БД через модель MapLayout с версионированием. Каждое сохранение создаёт новую MapLayoutVersion с автором и временной меткой. Предыдущие версии можно восстановить через API (restore). Данные элементов хранятся в JSON-поле elements массивом объектов с type, x, y, width, height, rotation и специфичными для типа свойствами.'
          : 'The map is saved to DB via the MapLayout model with versioning. Each save creates a new MapLayoutVersion with author and timestamp. Previous versions can be restored via API (restore). Element data is stored in the elements JSON field as an array of objects with type, x, y, width, height, rotation, and type-specific properties.'
        }</P>
        <Table
          headers={[isRu ? 'Тип элемента' : 'Element Type', isRu ? 'Описание' : 'Description', isRu ? 'Свойства' : 'Properties']}
          rows={[
            ['building', isRu ? 'Здание, стены корпуса' : 'Building, walls', 'x, y, width, height, fill, stroke'],
            ['post', isRu ? 'Рабочий пост механика' : 'Mechanic work post', 'x, y, width, height, postNumber, postType'],
            ['zone', isRu ? 'Зона (ремонт, ожидание и т.д.)' : 'Zone (repair, waiting, etc.)', 'x, y, width, height, zoneType, zoneName'],
            ['camera', isRu ? 'Камера с углом обзора' : 'Camera with viewing angle', 'x, y, rotation, fov, cameraId'],
            ['door', isRu ? 'Дверь или ворота' : 'Door or gate', 'x, y, width, doorType'],
            ['wall', isRu ? 'Отдельная стена' : 'Separate wall', 'x1, y1, x2, y2, thickness'],
            ['label', isRu ? 'Текстовая подпись' : 'Text label', 'x, y, text, fontSize, color'],
            ['infozone', isRu ? 'Информационная зона' : 'Information zone', 'x, y, width, height, text, color'],
          ]}
        />

        {/* Section 21 — Dependencies */}
        <SectionTitle id="deps">{isRu ? '21. Зависимости' : '21. Dependencies'}</SectionTitle>
        <P>{isRu
          ? 'Проект использует современные стабильные версии всех зависимостей. Фронтенд-зависимости устанавливаются через npm в frontend/, бэкенд-зависимости — в backend/.'
          : 'The project uses modern stable versions of all dependencies. Frontend dependencies are installed via npm in frontend/, backend dependencies in backend/.'
        }</P>

        <Sub>{isRu ? 'Frontend зависимости' : 'Frontend Dependencies'}</Sub>
        <Table
          headers={[isRu ? 'Пакет' : 'Package', isRu ? 'Версия' : 'Version', isRu ? 'Назначение' : 'Purpose']}
          rows={[
            ['react', '19.2.4', isRu ? 'UI framework' : 'UI framework'],
            ['react-router-dom', '7.13.1', isRu ? 'Маршрутизация (HashRouter)' : 'Routing (HashRouter)'],
            ['tailwindcss', '4.2.2', isRu ? 'Utility-first CSS framework' : 'Utility-first CSS framework'],
            ['vite', '8.0.1', isRu ? 'Сборщик и dev-сервер' : 'Bundler and dev server'],
            ['recharts', '3.8.0', isRu ? 'Графики и визуализация' : 'Charts and visualization'],
            ['konva + react-konva', '10.2.3 / 19.x', isRu ? 'Konva canvas для карты СТО' : 'Konva canvas for STO map'],
            ['i18next + react-i18next', '25.9.0', isRu ? 'Интернационализация (RU/EN)' : 'Internationalization (RU/EN)'],
            ['socket.io-client', '4.8.3', isRu ? 'Real-time коммуникация' : 'Real-time communication'],
            ['hls.js', '1.6.15', isRu ? 'HLS-видеоплеер в браузере' : 'HLS video player in browser'],
            ['jspdf + html2canvas', '4.2.1', isRu ? 'Экспорт в PDF' : 'PDF export'],
            ['xlsx', '0.18.5', isRu ? 'Экспорт/импорт XLSX (SheetJS)' : 'XLSX export/import (SheetJS)'],
            ['lucide-react', '0.577.0', isRu ? 'SVG-иконки (единственный источник иконок)' : 'SVG icons (sole icon source)'],
          ]}
        />

        <Sub>{isRu ? 'Backend зависимости' : 'Backend Dependencies'}</Sub>
        <Table
          headers={[isRu ? 'Пакет' : 'Package', isRu ? 'Версия' : 'Version', isRu ? 'Назначение' : 'Purpose']}
          rows={[
            ['express', '4.21.0', isRu ? 'HTTP-сервер и API framework' : 'HTTP server and API framework'],
            ['@prisma/client', '5.20.0', isRu ? 'ORM для SQLite' : 'ORM for SQLite'],
            ['jsonwebtoken', '9.0.2', isRu ? 'Генерация и проверка JWT' : 'JWT generation and verification'],
            ['bcryptjs', '2.4.3', isRu ? 'Хеширование паролей' : 'Password hashing'],
            ['socket.io', '4.8.0', isRu ? 'WebSocket-сервер' : 'WebSocket server'],
            ['helmet', '7.1.0', isRu ? 'Заголовки безопасности' : 'Security headers'],
            ['zod', '4.3.6', isRu ? 'Валидация данных на бэкенде' : 'Backend data validation'],
            ['node-cron', '4.2.1', isRu ? 'Планировщик задач (cron)' : 'Task scheduler (cron)'],
            ['xlsx', '0.18.5', isRu ? 'Генерация/парсинг XLSX файлов' : 'XLSX file generation/parsing'],
            ['web-push', '3.6.7', isRu ? 'Web Push уведомления (VAPID)' : 'Web Push notifications (VAPID)'],
            ['node-telegram-bot-api', '0.67.0', isRu ? 'Telegram Bot API клиент' : 'Telegram Bot API client'],
            ['winston', '3.x', isRu ? 'Структурированное логирование с ротацией файлов' : 'Structured logging with file rotation'],
            ['swagger-jsdoc', '6.x', isRu ? 'Генерация OpenAPI спецификации из JSDoc' : 'OpenAPI spec generation from JSDoc'],
            ['swagger-ui-express', '5.x', isRu ? 'Swagger UI на /api-docs' : 'Swagger UI at /api-docs'],
          ]}
        />

        {/* Section 22 — Env */}
        <SectionTitle id="env">{isRu ? '22. Переменные окружения' : '22. Environment Variables'}</SectionTitle>
        <P>{isRu
          ? 'Переменные окружения настраиваются в файле backend/.env. Они определяют подключение к БД, секреты JWT, порты серверов и опциональные интеграции (Telegram, Web Push). При отсутствии .env файла используются значения по умолчанию.'
          : 'Environment variables are configured in the backend/.env file. They define DB connection, JWT secrets, server ports, and optional integrations (Telegram, Web Push). When the .env file is missing, default values are used.'
        }</P>
        <Table
          headers={[isRu ? 'Переменная' : 'Variable', isRu ? 'Значение по умолчанию' : 'Default Value', isRu ? 'Описание' : 'Description']}
          rows={[
            ['DATABASE_URL', 'file:./dev.db', isRu ? 'Путь к файлу SQLite базы данных (относительно prisma/)' : 'Path to SQLite database file (relative to prisma/)'],
            ['JWT_SECRET', 'change-me-in-production', isRu ? 'Секретный ключ для подписи JWT токенов. ОБЯЗАТЕЛЬНО сменить в продакшене!' : 'Secret key for signing JWT tokens. MUST be changed in production!'],
            ['PORT', '3001', isRu ? 'HTTP-порт Express сервера' : 'Express server HTTP port'],
            ['NODE_ENV', 'development', isRu ? 'Окружение: development/production. Влияет на morgan, helmet, CORS' : 'Environment: development/production. Affects morgan, helmet, CORS'],
            ['TELEGRAM_BOT_TOKEN', isRu ? '(опционально)' : '(optional)', isRu ? 'Токен Telegram-бота для команд и доставки отчётов. Если не задан — бот не запускается' : 'Telegram bot token for commands and report delivery. If not set — bot does not start'],
            ['VAPID_PUBLIC_KEY', isRu ? '(опционально)' : '(optional)', isRu ? 'Публичный VAPID-ключ для Web Push уведомлений' : 'Public VAPID key for Web Push notifications'],
            ['VAPID_PRIVATE_KEY', isRu ? '(опционально)' : '(optional)', isRu ? 'Приватный VAPID-ключ для подписи push-запросов' : 'Private VAPID key for signing push requests'],
          ]}
        />
        <Sub>localStorage</Sub>
        <P>{isRu
          ? 'Фронтенд использует localStorage только для клиентских настроек, НЕ для данных. Все данные приходят из бэкенда через API.'
          : 'The frontend uses localStorage only for client-side settings, NOT for data. All data comes from the backend via API.'
        }</P>
        <Table
          headers={[isRu ? 'Ключ' : 'Key', isRu ? 'Описание' : 'Description', isRu ? 'Используется в' : 'Used in']}
          rows={[
            ['token', isRu ? 'JWT access token (24ч)' : 'JWT access token (24h)', 'AuthContext'],
            ['currentUser', isRu ? 'Объект текущего пользователя (кеш для быстрого старта)' : 'Current user object (cache for fast start)', 'AuthContext'],
            ['language', 'ru / en', 'i18n'],
            ['theme', 'dark / light', 'ThemeContext'],
            ['dashboardPostsSettings', isRu ? 'Настройки Gantt-таймлайна (масштаб, фильтры)' : 'Gantt timeline settings (scale, filters)', 'DashboardPosts'],
            ['dashboardPostsSchedule', isRu ? 'Локальный кеш расписания ЗН' : 'Local WO schedule cache', 'DashboardPosts'],
            ['cameraMappingData', isRu ? 'Маппинг камер по зонам (кеш)' : 'Camera zone mapping (cache)', 'CameraMapping'],
          ]}
        />

        {/* Section 23 — Seed */}
        <SectionTitle id="seed">{isRu ? '23. Seed-данные' : '23. Seed Data'}</SectionTitle>
        <P>{isRu
          ? 'Seed-данные загружаются при первой инициализации базы через prisma db seed (файл backend/prisma/seed.js). Они создают начальных пользователей с ролями, зоны, посты, камеры и базовые настройки. Seed можно перезапустить для восстановления начального состояния.'
          : 'Seed data is loaded on first database initialization via prisma db seed (file backend/prisma/seed.js). It creates initial users with roles, zones, posts, cameras, and base settings. Seed can be re-run to restore initial state.'
        }</P>
        <P>{isRu
          ? 'Seed создаёт 5 ролей (admin, director, manager, mechanic, viewer) с соответствующими разрешениями, 15 permissions, 5 зон, 10 постов, 10 камер, и 4 пользователей. Каждому пользователю назначается роль через UserRole, и определяется набор доступных страниц (pages[]).'
          : 'Seed creates 5 roles (admin, director, manager, mechanic, viewer) with corresponding permissions, 15 permissions, 5 zones, 10 posts, 10 cameras, and 4 users. Each user is assigned a role via UserRole, and a set of accessible pages (pages[]) is defined.'
        }</P>
        <Table
          headers={['Email', isRu ? 'Пароль' : 'Password', isRu ? 'Роль' : 'Role', isRu ? 'Имя' : 'Name', isRu ? 'Активен' : 'Active', isRu ? 'Описание' : 'Description']}
          rows={[
            ['admin@metricsai.up', 'admin123', 'admin', 'Admin MetricsAI', isRu ? 'Да' : 'Yes', isRu ? 'Полный доступ ко всем функциям системы' : 'Full access to all system features'],
            ['demo@metricsai.up', 'demo12345', 'manager', isRu ? 'Генри Форд' : 'Henry Ford', isRu ? 'Да' : 'Yes', isRu ? 'Демо-аккаунт менеджера для презентаций' : 'Demo manager account for presentations'],
            ['manager@metricsai.up', 'demo123', 'manager', isRu ? 'Сергей Петров' : 'Sergey Petrov', isRu ? 'Да' : 'Yes', isRu ? 'Рабочий аккаунт менеджера' : 'Working manager account'],
            ['mechanic@metricsai.up', 'demo123', 'mechanic', isRu ? 'Иван Козлов' : 'Ivan Kozlov', isRu ? 'Нет' : 'No', isRu ? 'Неактивный аккаунт механика (для тестов)' : 'Inactive mechanic account (for testing)'],
          ]}
        />

        {/* Footer */}
        <div className="mt-10 pt-4 border-t text-center" style={{ borderColor: 'var(--border-glass)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            MetricsAiUp — {isRu ? 'Техническая документация v1.0 | ' : 'Technical Documentation v1.0 | '}{generatedDate}
          </p>
        </div>
      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 p-2 rounded-full shadow-lg print:hidden"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <ChevronUp size={18} />
        </button>
      )}
    </div>
  );
}
