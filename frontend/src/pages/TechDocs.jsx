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
  const generatedDate = '2026-04-09';

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
          ? 'MetricsAiUp — система мониторинга автосервиса (СТО), обеспечивающая real-time отслеживание автомобилей, управление заказ-нарядами, аналитику, интеграцию с 1С, видеонаблюдение (10 RTSP-камер) и AI-рекомендации.'
          : 'MetricsAiUp is an auto service (STO) monitoring system providing real-time vehicle tracking, work order management, analytics, 1C integration, video surveillance (10 RTSP cameras), and AI recommendations.'
        }</P>
        <Table
          headers={[isRu ? 'Слой' : 'Layer', isRu ? 'Технологии' : 'Technologies']}
          rows={[
            ['Frontend', 'React 19.2, Vite 8, Tailwind CSS 4, Recharts 3, Konva 10, react-i18next, Socket.IO Client, HLS.js, jsPDF, xlsx'],
            ['Backend', 'Express 4, Prisma ORM, SQLite, Socket.IO 4, Zod, node-cron, web-push, node-telegram-bot-api'],
            [isRu ? 'Стриминг' : 'Streaming', 'FFmpeg (RTSP \u2192 HLS), Node.js HTTPS'],
            [isRu ? 'Инфраструктура' : 'Infrastructure', 'Nginx, Let\'s Encrypt SSL, Docker'],
            [isRu ? 'Тестирование' : 'Testing', 'Vitest, React Testing Library, jsdom'],
          ]}
        />

        {/* Section 2 — Architecture */}
        <SectionTitle id="architecture">{isRu ? '2. Архитектура' : '2. Architecture'}</SectionTitle>
        <Code>{`/project
\u251c\u2500\u2500 frontend/src/       # React 19, 20 \u0441\u0442\u0440\u0430\u043d\u0438\u0446, 17 \u043a\u043e\u043c\u043f\u043e\u043d\u0435\u043d\u0442\u043e\u0432, 3 \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442\u0430, 3 \u0445\u0443\u043a\u0430
\u251c\u2500\u2500 backend/src/        # Express 4, 22 \u043c\u043e\u0434\u0443\u043b\u044f \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u043e\u0432, 7 \u0441\u0435\u0440\u0432\u0438\u0441\u043e\u0432
\u251c\u2500\u2500 backend/prisma/     # 22 \u043c\u043e\u0434\u0435\u043b\u0438 SQLite
\u251c\u2500\u2500 data/               # 29 JSON-\u043c\u043e\u043a\u043e\u0432 (fallback)
\u251c\u2500\u2500 server.js           # HLS-\u0441\u0442\u0440\u0438\u043c\u0438\u043d\u0433 :8181
\u251c\u2500\u2500 sw.js               # Service Worker v11
\u2514\u2500\u2500 index.html          # Entry point`}</Code>

        <Sub>{isRu ? 'Data Flow' : 'Data Flow'}</Sub>
        <Code>{`Frontend (React) \u2500\u2500 HTTP/WS :3001 \u2500\u2500\u25b6 Backend (Express) \u2500\u2500 Prisma \u2500\u2500\u25b6 SQLite
      \u2502                              \u2502
      \u2502 Socket.IO                    \u2502 CV Events (POST /api/events)
      \u2502                              \u2502
      \u2514\u2500\u2500 HLS.js :8181 \u2500\u2500\u25b6 FFmpeg \u25c0\u2500\u2500 RTSP \u043a\u0430\u043c\u0435\u0440\u044b`}</Code>

        <P>{isRu
          ? 'Fallback-\u0446\u0435\u043f\u043e\u0447\u043a\u0430: Backend API \u2192 JSON-\u043c\u043e\u043a\u0438 /data/ \u2192 localStorage (users, camera mapping).'
          : 'Fallback chain: Backend API \u2192 JSON mocks /data/ \u2192 localStorage (users, camera mapping).'
        }</P>

        {/* Section 3 — Infrastructure */}
        <SectionTitle id="infrastructure">{isRu ? '3. Инфраструктура и деплой' : '3. Infrastructure & Deploy'}</SectionTitle>
        <Table
          headers={[isRu ? 'Сервер' : 'Server', isRu ? 'Порт' : 'Port', isRu ? 'Протокол' : 'Protocol', isRu ? 'Назначение' : 'Purpose']}
          rows={[
            ['Nginx', '8080', 'HTTP', isRu ? 'Reverse proxy, статика' : 'Reverse proxy, static files'],
            ['Express', '3001', 'HTTP', 'REST API + Socket.IO'],
            ['Express', '3444', 'HTTPS', 'REST API + Socket.IO (SSL)'],
            ['HLS Server', '8181', 'HTTPS', isRu ? 'RTSP\u2192HLS камеры' : 'RTSP\u2192HLS cameras'],
            ['Frontend', '443', 'HTTPS', isRu ? 'HTTPS-прокси' : 'HTTPS proxy'],
          ]}
        />
        <Sub>{isRu ? 'SSL' : 'SSL'}</Sub>
        <P>{isRu
          ? 'Домен: artisom.dev.metricsavto.com. Сертификат: /project/.ssl/fullchain.pem. Ключ: /project/.ssl/privkey.pem. Истекает: 2026-07-05.'
          : 'Domain: artisom.dev.metricsavto.com. Cert: /project/.ssl/fullchain.pem. Key: /project/.ssl/privkey.pem. Expires: 2026-07-05.'
        }</P>
        <Sub>Nginx</Sub>
        <Code>{`Port 8080 (default_server)
  /api/*       \u2192 proxy http://127.0.0.1:3001 (fallback: 3000, 3002)
  /socket.io/* \u2192 proxy + WebSocket upgrade
  /cam-api/*   \u2192 proxy http://127.0.0.1:8181/api/
  /hls/*       \u2192 static /project/hls/ + CORS
  /*           \u2192 SPA fallback (try_files \u2192 index.html)`}</Code>
        <Sub>{isRu ? 'Билд и деплой' : 'Build & Deploy'}</Sub>
        <Code>{`cd /project/frontend && npm run build && cp -r dist/* /project/
# ${isRu ? '\u041f\u043e\u0441\u043b\u0435 \u0431\u0438\u043b\u0434\u0430 \u2014 \u0431\u0430\u043c\u043f\u0438\u0442\u044c CACHE_NAME \u0432 sw.js' : 'After build \u2014 bump CACHE_NAME in sw.js'}`}</Code>

        {/* Section 4 — Database */}
        <SectionTitle id="database">{isRu ? '4. База данных (Prisma + SQLite, 22 модели)' : '4. Database (Prisma + SQLite, 22 models)'}</SectionTitle>
        <P>{isRu
          ? 'ORM: Prisma 5.20. БД: SQLite (~57 MB). Файл: backend/prisma/dev.db.'
          : 'ORM: Prisma 5.20. DB: SQLite (~57 MB). File: backend/prisma/dev.db.'
        }</P>
        <Sub>RBAC</Sub>
        <P>User (+ hiddenElements JSON) → UserRole → Role → RolePermission → Permission</P>
        <Table
          headers={[isRu ? '\u0420\u043e\u043b\u044c' : 'Role', 'Permissions']}
          rows={[
            ['admin', isRu ? '\u0412\u0441\u0435 15 + manage_roles, manage_settings' : 'All 15 + manage_roles, manage_settings'],
            ['director', 'view_dashboard, view_analytics, view_zones, view_posts, view_sessions, view_events, view_work_orders, view_recommendations, view_cameras'],
            ['manager', 'view_dashboard, view_zones, view_posts, view_sessions, view_events, manage_work_orders, view_recommendations'],
            ['mechanic', 'view_dashboard, view_posts, view_sessions'],
            ['viewer', 'view_dashboard, view_zones, view_posts'],
          ]}
        />
        <Sub>{isRu ? '\u041e\u0441\u043d\u043e\u0432\u043d\u044b\u0435 \u043c\u043e\u0434\u0435\u043b\u0438' : 'Core Models'}</Sub>
        <Table
          headers={[isRu ? '\u041c\u043e\u0434\u0435\u043b\u044c' : 'Model', isRu ? '\u041a\u043b\u044e\u0447\u0435\u0432\u044b\u0435 \u043f\u043e\u043b\u044f' : 'Key Fields', isRu ? '\u0421\u0432\u044f\u0437\u0438' : 'Relations']}
          rows={[
            ['Zone', 'name, type (repair/waiting/entry/parking/free), coordinates', '\u2192 Post[], CameraZone[], ZoneStay[]'],
            ['Post', 'name, type (light/heavy/special), status (free/occupied/occupied_no_work/active_work)', '\u2192 Zone, PostStay[]'],
            ['Camera', 'name, rtspUrl, isActive', '\u2192 CameraZone[], Event[]'],
            ['VehicleSession', 'plateNumber, entryTime, status (active/completed), trackId', '\u2192 ZoneStay[], PostStay[], Event[]'],
            ['WorkOrder', 'orderNumber, status, normHours, version, pausedAt, totalPausedMs', '\u2192 WorkOrderLink[]'],
            ['Event', 'type (10 \u0442\u0438\u043f\u043e\u0432), confidence, cameraSources', '\u2192 Zone, Post, VehicleSession, Camera'],
            ['Shift', 'name, date, startTime, endTime, status', '\u2192 ShiftWorker[]'],
            ['Recommendation', 'type (5 \u0442\u0438\u043f\u043e\u0432), message, messageEn, status', '\u2192 Zone?, Post?'],
            ['AuditLog', 'action, entity, oldData, newData, ip', isRu ? '\u0418\u043d\u0434\u0435\u043a\u0441\u044b: userId, action, entity, createdAt' : 'Indexes: userId, action, entity, createdAt'],
            ['MapLayout', 'name, width (46540mm), height (30690mm), elements (JSON)', '\u2192 MapLayoutVersion[]'],
          ]}
        />
        <Sub>{isRu ? '\u041f\u0440\u043e\u0447\u0438\u0435 \u043c\u043e\u0434\u0435\u043b\u0438' : 'Other Models'}</Sub>
        <P>SyncLog, Photo, PushSubscription, Location, TelegramLink, ReportSchedule, ZoneStay, PostStay, WorkOrderLink, CameraZone, UserRole, RolePermission, ShiftWorker, MapLayoutVersion</P>

        {/* Section 5 — API */}
        <SectionTitle id="api">{isRu ? '5. Backend API (22 модуля, 70+ эндпоинтов)' : '5. Backend API (22 modules, 70+ endpoints)'}</SectionTitle>
        <Table
          headers={[isRu ? '\u041c\u043e\u0434\u0443\u043b\u044c' : 'Module', isRu ? '\u041f\u0443\u0442\u044c' : 'Path', isRu ? '\u041a\u043b\u044e\u0447\u0435\u0432\u044b\u0435 \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0438' : 'Key Operations']}
          rows={[
            ['auth', '/api/auth', 'login, refresh, logout, me, register'],
            ['dashboard', '/api/dashboard', 'overview, metrics(?period=24h|7d|30d), trends, live'],
            ['zones', '/api/zones', 'CRUD, types: repair/waiting/entry/parking/free'],
            ['posts', '/api/posts', 'CRUD, statuses: free/occupied/occupied_no_work/active_work'],
            ['cameras', '/api/cameras', 'CRUD, health, zone mapping + priorities'],
            ['events', '/api/events', isRu ? 'POST \u043e\u0442 CV-\u0441\u0438\u0441\u0442\u0435\u043c\u044b, GET \u0441 \u0444\u0438\u043b\u044c\u0442\u0440\u0430\u043c\u0438' : 'POST from CV system, GET with filters'],
            ['sessions', '/api/sessions', 'active/completed, ZoneStay/PostStay'],
            ['workOrders', '/api/work-orders', 'CSV-import, schedule (versioning), start/pause/resume/complete'],
            ['recommendations', '/api/recommendations', 'GET active, PUT acknowledge'],
            ['users', '/api/users', 'CRUD, role assignment, page access'],
            ['shifts', '/api/shifts', 'CRUD, worker assignment, conflict detection'],
            ['data1c', '/api/1c', 'import XLSX, export XLSX, sync-history'],
            ['mapLayout', '/api/map-layout', isRu ? 'CRUD \u0441 \u0432\u0435\u0440\u0441\u0438\u043e\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435\u043c' : 'CRUD with versioning'],
            ['auditLog', '/api/audit-log', isRu ? 'GET \u0441 \u0444\u0438\u043b\u044c\u0442\u0440\u0430\u043c\u0438, CSV export' : 'GET with filters, CSV export'],
            ['predict', '/api/predict', 'load, load/week, duration, free, health'],
            ['postsData', '/api/posts-analytics, /api/dashboard-posts', isRu ? '\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430 \u043f\u043e\u0441\u0442\u043e\u0432' : 'Post analytics'],
            ['workers', '/api/workers', isRu ? '\u0421\u043f\u0438\u0441\u043e\u043a, stats \u0441 daily breakdown' : 'List, stats with daily breakdown'],
            ['health', '/api/system-health', 'backend, database, cameras, disk'],
            ['push', '/api/push', 'VAPID key, subscribe, send'],
            ['photos', '/api/photos', 'upload base64, gallery, delete'],
            ['locations', '/api/locations', 'CRUD (multi-tenancy)'],
            ['reportSchedule', '/api/report-schedules', 'CRUD, run (generate XLSX)'],
          ]}
        />

        <Sub>{isRu ? '\u0410\u0443\u0442\u0435\u043d\u0442\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u044f' : 'Authentication'}</Sub>
        <P>{isRu
          ? 'JWT: access token 24\u0447, refresh token 7\u0434 (httpOnly cookie). Rate limit: 20 \u043f\u043e\u043f\u044b\u0442\u043e\u043a/\u043c\u0438\u043d \u043d\u0430 IP. Middleware: authenticate() + requirePermission(...keys).'
          : 'JWT: access token 24h, refresh token 7d (httpOnly cookie). Rate limit: 20 attempts/min per IP. Middleware: authenticate() + requirePermission(...keys).'
        }</P>

        <Sub>{isRu ? 'Optimistic Locking (\u0437\u0430\u043a\u0430\u0437-\u043d\u0430\u0440\u044f\u0434\u044b)' : 'Optimistic Locking (work orders)'}</Sub>
        <P>{isRu
          ? 'POST /api/work-orders/schedule \u2014 batch-\u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u0441 \u043f\u043e\u043b\u0435\u043c version. \u041f\u0440\u0438 \u043d\u0435\u0441\u043e\u0432\u043f\u0430\u0434\u0435\u043d\u0438\u0438 \u0432\u0435\u0440\u0441\u0438\u0438 \u2192 HTTP 409 \u0441 \u043c\u0430\u0441\u0441\u0438\u0432\u043e\u043c conflicts[].'
          : 'POST /api/work-orders/schedule \u2014 batch update with version field. On version mismatch \u2192 HTTP 409 with conflicts[] array.'
        }</P>

        {/* Section 6 — Services */}
        <SectionTitle id="services">{isRu ? '6. Backend Services (\u0444\u043e\u043d\u043e\u0432\u044b\u0435)' : '6. Backend Services (background)'}</SectionTitle>
        <Table
          headers={[isRu ? '\u0421\u0435\u0440\u0432\u0438\u0441' : 'Service', isRu ? '\u0427\u0442\u043e \u0434\u0435\u043b\u0430\u0435\u0442' : 'What it does']}
          rows={[
            ['EventProcessor', isRu ? '\u041e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0430 CV-\u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u2192 \u0441\u0435\u0441\u0441\u0438\u0438, \u0441\u0442\u0430\u0442\u0443\u0441\u044b \u043f\u043e\u0441\u0442\u043e\u0432, Socket.IO' : 'CV event processing \u2192 sessions, post statuses, Socket.IO'],
            ['RecommendationEngine', isRu ? '5 \u043f\u0440\u043e\u0432\u0435\u0440\u043e\u043a: post_free (>30\u043c), overtime (>120%), idle (>15\u043c), capacity, no_show' : '5 checks: post_free (>30m), overtime (>120%), idle (>15m), capacity, no_show'],
            ['1C Sync', isRu ? 'File watcher /data/1c-import/, \u043f\u0430\u0440\u0441\u0438\u043d\u0433 XLSX' : 'File watcher /data/1c-import/, XLSX parsing'],
            ['Camera Health', isRu ? '\u041f\u0438\u043d\u0433 \u043a\u0430\u0436\u0434\u044b\u0435 30\u0441, Socket.IO emit' : 'Ping every 30s, Socket.IO emit'],
            ['Telegram Bot', '/start, /status, /post N, /free, /report'],
            ['Report Scheduler', isRu ? 'node-cron, XLSX \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f, Telegram delivery' : 'node-cron, XLSX generation, Telegram delivery'],
            ['Server Export', isRu ? 'XLSX export \u0443\u0442\u0438\u043b\u0438\u0442\u044b' : 'XLSX export utilities'],
          ]}
        />

        {/* Section 7 — Middleware */}
        <SectionTitle id="middleware">{isRu ? '7. Middleware' : '7. Middleware'}</SectionTitle>
        <Table
          headers={[isRu ? '\u0424\u0430\u0439\u043b' : 'File', isRu ? '\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435' : 'Purpose']}
          rows={[
            ['auth.js', isRu ? 'JWT \u0432\u0435\u0440\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u044f (Bearer), requirePermission(...keys)' : 'JWT verification (Bearer), requirePermission(...keys)'],
            ['auditLog.js', isRu ? '\u041b\u043e\u0433\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u043c\u0443\u0442\u0430\u0446\u0438\u0439 (create/update/delete) \u0441 old/new data' : 'Mutation logging (create/update/delete) with old/new data'],
            ['validate.js', isRu ? 'Zod-\u0432\u0430\u043b\u0438\u0434\u0430\u0446\u0438\u044f request body' : 'Zod validation of request body'],
            ['asyncHandler.js', isRu ? '\u041e\u0431\u0451\u0440\u0442\u043a\u0430 async, Prisma P2025 \u2192 404' : 'Async wrapper, Prisma P2025 \u2192 404'],
          ]}
        />
        <Sub>{isRu ? '\u041f\u043e\u0440\u044f\u0434\u043e\u043a Express middleware' : 'Express Middleware Order'}</Sub>
        <P>1. helmet() &mdash; 2. cors(origin: true) &mdash; 3. morgan('dev') &mdash; 4. express.json(limit: '50mb') &mdash; 5. cookieParser()</P>

        {/* Section 8 — Socket.IO */}
        <SectionTitle id="socketio">8. Socket.IO</SectionTitle>
        <Sub>{isRu ? '\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0438 (\u043a\u043b\u0438\u0435\u043d\u0442 \u2192 \u0441\u0435\u0440\u0432\u0435\u0440)' : 'Subscriptions (client \u2192 server)'}</Sub>
        <P>subscribe:zone, subscribe:post, subscribe:all</P>
        <Sub>{isRu ? '\u0421\u043e\u0431\u044b\u0442\u0438\u044f (\u0441\u0435\u0440\u0432\u0435\u0440 \u2192 \u043a\u043b\u0438\u0435\u043d\u0442)' : 'Events (server \u2192 client)'}</Sub>
        <Table
          headers={[isRu ? '\u0421\u043e\u0431\u044b\u0442\u0438\u0435' : 'Event', isRu ? '\u0414\u0430\u043d\u043d\u044b\u0435' : 'Data']}
          rows={[
            ['post:status_changed', '{ postId, postNumber, status, plateNumber, workerName, timestamp }'],
            ['schedule:updated', '{ count }'],
            ['workOrder:started', '{ workOrderId, postNumber, startTime }'],
            ['workOrder:completed', '{ workOrderId }'],
            ['camera:status', '{ camId, online, lastCheck }'],
            ['recommendation', 'Recommendation object'],
            ['event', 'Event object \u2192 all_events room'],
          ]}
        />

        {/* Section 9 — Pages */}
        <SectionTitle id="pages">{isRu ? '9. Frontend \u2014 \u0421\u0442\u0440\u0430\u043d\u0438\u0446\u044b (20)' : '9. Frontend \u2014 Pages (20)'}</SectionTitle>
        <Table
          headers={[isRu ? '\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430' : 'Page', isRu ? '\u041c\u0430\u0440\u0448\u0440\u0443\u0442' : 'Route', 'LOC', isRu ? '\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435' : 'Purpose']}
          rows={[
            ['Dashboard', '/', '~300', isRu ? 'KPI-\u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438, \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438, \u0441\u043e\u0431\u044b\u0442\u0438\u044f, polling 5\u0441' : 'KPI cards, recommendations, events, 5s polling'],
            ['DashboardPosts', '/dashboard-posts', '521', isRu ? 'Gantt-\u0442\u0430\u0439\u043c\u043b\u0430\u0439\u043d, drag-n-drop, \u0432\u0435\u0440\u0441\u0438\u043e\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435' : 'Gantt timeline, drag-n-drop, versioning'],
            ['PostsDetail', '/posts-detail', '226', isRu ? '\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430 \u043f\u043e\u0441\u0442\u043e\u0432, master-detail' : 'Post analytics, master-detail'],
            ['MapViewer', '/map-view', '~400', isRu ? 'Konva live-\u043a\u0430\u0440\u0442\u0430' : 'Konva live map'],
            ['MapEditor', '/map-editor', '1244', isRu ? 'Drag-drop \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440, 8 \u0442\u0438\u043f\u043e\u0432 \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u043e\u0432' : 'Drag-drop editor, 8 element types'],
            ['Sessions', '/sessions', '~350', isRu ? '\u0421\u0435\u0441\u0441\u0438\u0438 \u0430\u0432\u0442\u043e, QR, \u043f\u0440\u0438\u0432\u044f\u0437\u043a\u0430 \u0417\u041d' : 'Vehicle sessions, QR, WO linking'],
            ['WorkOrders', '/work-orders', '~200', isRu ? 'CSV-\u0438\u043c\u043f\u043e\u0440\u0442, \u0444\u0438\u043b\u044c\u0442\u0440\u044b, start/pause/complete' : 'CSV import, filters, start/pause/complete'],
            ['Events', '/events', '~400', isRu ? '10 \u0442\u0438\u043f\u043e\u0432, \u0444\u0438\u043b\u044c\u0442\u0440\u044b, auto-refresh, \u043f\u0430\u0433\u0438\u043d\u0430\u0446\u0438\u044f' : '10 types, filters, auto-refresh, pagination'],
            ['Analytics', '/analytics', '655', isRu ? '\u0413\u0440\u0430\u0444\u0438\u043a\u0438 Recharts, \u044d\u043a\u0441\u043f\u043e\u0440\u0442 XLSX/PDF/PNG' : 'Recharts charts, XLSX/PDF/PNG export'],
            ['Data1C', '/data-1c', '926', isRu ? 'Excel-\u0438\u043c\u043f\u043e\u0440\u0442, sync, export' : 'Excel import, sync, export'],
            ['Cameras', '/cameras', '~250', isRu ? '10 \u043a\u0430\u043c\u0435\u0440, HLS \u0441\u0442\u0440\u0438\u043c\u044b' : '10 cameras, HLS streams'],
            ['CameraMapping', '/camera-mapping', '312', isRu ? '\u041c\u0430\u043f\u043f\u0438\u043d\u0433 \u043a\u0430\u043c\u0435\u0440\u0430\u2194\u0437\u043e\u043d\u0430' : 'Camera\u2194zone mapping'],
            ['Users', '/users', '~300', isRu ? 'CRUD, \u0440\u043e\u043b\u0438, \u0434\u043e\u0441\u0442\u0443\u043f' : 'CRUD, roles, access'],
            ['Shifts', '/shifts', '~400', isRu ? '\u041d\u0435\u0434\u0435\u043b\u044c\u043d\u043e\u0435 \u0440\u0430\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0435, \u043a\u043e\u043d\u0444\u043b\u0438\u043a\u0442\u044b' : 'Weekly schedule, conflicts'],
            ['Audit', '/audit', '~300', isRu ? '\u0410\u0443\u0434\u0438\u0442-\u043b\u043e\u0433, CSV-\u044d\u043a\u0441\u043f\u043e\u0440\u0442 (admin)' : 'Audit log, CSV export (admin)'],
            ['MyPost', '/my-post', '~200', isRu ? '\u0422\u0430\u0439\u043c\u0435\u0440 \u0417\u041d, play/pause/complete' : 'WO timer, play/pause/complete'],
            ['Health', '/health', '~200', isRu ? '\u0421\u0438\u0441\u0442\u0435\u043c\u043d\u044b\u0439 \u0441\u0442\u0430\u0442\u0443\u0441 (admin)' : 'System status (admin)'],
            ['WorkerStats', '/worker-stats/:name', '~300', isRu ? '\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430 \u0440\u0430\u0431\u043e\u0442\u043d\u0438\u043a\u0430' : 'Worker analytics'],
            ['ReportSchedule', '/report-schedule', '~250', isRu ? '\u0410\u0432\u0442\u043e\u043e\u0442\u0447\u0451\u0442\u044b, Telegram' : 'Auto-reports, Telegram'],
            ['Login', '/login', '~150', isRu ? '\u0410\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u044f' : 'Authentication'],
          ]}
        />

        {/* Section 10 — Components */}
        <SectionTitle id="components">{isRu ? '10. Frontend \u2014 \u041a\u043e\u043c\u043f\u043e\u043d\u0435\u043d\u0442\u044b (17+)' : '10. Frontend \u2014 Components (17+)'}</SectionTitle>
        <Table
          headers={[isRu ? '\u041a\u043e\u043c\u043f\u043e\u043d\u0435\u043d\u0442' : 'Component', isRu ? '\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435' : 'Purpose']}
          rows={[
            ['Layout', isRu ? 'Header + Sidebar + Outlet' : 'Header + Sidebar + Outlet'],
            ['Sidebar', isRu ? '\u041d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f, \u0444\u0438\u043b\u044c\u0442\u0440 \u043f\u043e user.pages' : 'Navigation, filter by user.pages'],
            ['HelpButton', isRu ? '\u041a\u043e\u043d\u0442\u0435\u043a\u0441\u0442\u043d\u0430\u044f \u0441\u043f\u0440\u0430\u0432\u043a\u0430 \u043f\u043e pageKey' : 'Context help by pageKey'],
            ['DateRangePicker', isRu ? '\u0412\u044b\u0431\u043e\u0440 \u0434\u0438\u0430\u043f\u0430\u0437\u043e\u043d\u0430 \u0434\u0430\u0442' : 'Date range picker'],
            ['DeltaBadge', isRu ? '\u0411\u0435\u0439\u0434\u0436 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f (\u0441\u0442\u0440\u0435\u043b\u043a\u0430 + %)' : 'Change badge (arrow + %)'],
            ['PostTimer', isRu ? '\u0422\u0430\u0439\u043c\u0435\u0440 \u0417\u041d \u0441 warning levels' : 'WO timer with warning levels'],
            ['QRBadge', isRu ? 'QR-\u043a\u043e\u0434 \u0441\u0435\u0441\u0441\u0438\u0438' : 'Session QR code'],
            ['LiveSTOWidget', isRu ? '\u0412\u0438\u0434\u0436\u0435\u0442 \u0442\u0435\u043a\u0443\u0449\u0435\u0433\u043e \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u044f' : 'Current state widget'],
            ['PredictionWidget', isRu ? 'ML-\u043f\u0440\u0435\u0434\u0441\u043a\u0430\u0437\u0430\u043d\u0438\u044f' : 'ML predictions'],
            ['SparkLine', isRu ? '\u041c\u0438\u043d\u0438-\u0433\u0440\u0430\u0444\u0438\u043a \u0442\u0440\u0435\u043d\u0434\u0430' : 'Mini trend chart'],
            ['WeeklyHeatmap', isRu ? '\u0422\u0435\u043f\u043b\u043e\u0432\u0430\u044f \u043a\u0430\u0440\u0442\u0430 7\u0434\u043d\u0435\u0439' : '7-day heatmap'],
            ['PhotoGallery', isRu ? '\u0413\u0430\u043b\u0435\u0440\u0435\u044f \u0441 zoom' : 'Gallery with zoom'],
            ['CameraStreamModal', isRu ? 'HLS-\u0441\u0442\u0440\u0438\u043c \u043a\u0430\u043c\u0435\u0440\u044b' : 'Camera HLS stream'],
            ['LocationSwitcher', isRu ? '\u041f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0430\u0442\u0435\u043b\u044c \u043b\u043e\u043a\u0430\u0446\u0438\u0439' : 'Location switcher'],
            ['NotificationCenter', isRu ? '\u0426\u0435\u043d\u0442\u0440 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439' : 'Notification center'],
            ['Skeleton', isRu ? 'Placeholder \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438' : 'Loading placeholder'],
            ['STOMap', isRu ? '\u041a\u0430\u0440\u0442\u0430 \u0421\u0422\u041e (Konva)' : 'STO Map (Konva)'],
          ]}
        />
        <Sub>dashboardPosts/</Sub>
        <P>GanttTimeline, TimelineRow, TimelineHeader, FreeWorkOrdersTable, WorkOrderModal, ShiftSettings, ConflictModal, Legend</P>
        <Sub>postsDetail/</Sub>
        <P>PostCardsView, PostTableView, PostDetailPanel</P>

        {/* Section 11 — Contexts */}
        <SectionTitle id="contexts">{isRu ? '11. \u041a\u043e\u043d\u0442\u0435\u043a\u0441\u0442\u044b' : '11. Contexts'}</SectionTitle>
        <Sub>AuthContext</Sub>
        <P>{isRu
          ? 'user, loading, login(), logout(), hasPermission(), isElementVisible(pageId, elementId), updateCurrentUser(), api {get, post, put, delete}. JWT 24ч + refresh 7д. Mock login при недоступности backend.'
          : 'user, loading, login(), logout(), hasPermission(), isElementVisible(pageId, elementId), updateCurrentUser(), api {get, post, put, delete}. JWT 24h + refresh 7d. Mock login when backend unavailable.'
        }</P>
        <P>{isRu
          ? 'PAGE_ELEMENTS — реестр крупных элементов по страницам (виджеты, секции). user.hiddenElements[] хранится в БД, загружается через /api/auth/me.'
          : 'PAGE_ELEMENTS — registry of major page elements (widgets, sections). user.hiddenElements[] stored in DB, loaded via /api/auth/me.'
        }</P>
        <Sub>ThemeContext</Sub>
        <P>{isRu ? 'theme (dark/light), toggleTheme(). \u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u0442\u0441\u044f \u0432 localStorage.' : 'theme (dark/light), toggleTheme(). Saved to localStorage.'}</P>
        <Sub>ToastContext</Sub>
        <P>{isRu ? 'toast.success/error/warning/info(). Max 3 toast. Auto-dismiss.' : 'toast.success/error/warning/info(). Max 3 toasts. Auto-dismiss.'}</P>

        {/* Section 12 — Hooks */}
        <SectionTitle id="hooks">{isRu ? '12. \u0425\u0443\u043a\u0438' : '12. Hooks'}</SectionTitle>
        <Table
          headers={[isRu ? '\u0425\u0443\u043a' : 'Hook', isRu ? '\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435' : 'Purpose']}
          rows={[
            ['useSocket', isRu ? 'connectSocket, disconnectSocket, usePolling, useSubscribe, useSocketStatus' : 'connectSocket, disconnectSocket, usePolling, useSubscribe, useSocketStatus'],
            ['useWorkOrderTimer', isRu ? '\u0422\u0430\u0439\u043c\u0435\u0440 \u0417\u041d: elapsedMs, percentUsed, warningLevel, start/pause/resume/complete' : 'WO timer: elapsedMs, percentUsed, warningLevel, start/pause/resume/complete'],
            ['useCameraStatus', isRu ? '\u0421\u0442\u0430\u0442\u0443\u0441\u044b \u043a\u0430\u043c\u0435\u0440 \u0447\u0435\u0440\u0435\u0437 Socket.IO' : 'Camera statuses via Socket.IO'],
          ]}
        />

        {/* Section 13 — Utils */}
        <SectionTitle id="utils">{isRu ? '13. \u0423\u0442\u0438\u043b\u0438\u0442\u044b' : '13. Utilities'}</SectionTitle>
        <P><strong>translate.js:</strong> translateZone(name, isRu), translatePost(name, isRu)</P>
        <P><strong>export.js:</strong> exportToXlsx() (4 {isRu ? '\u043b\u0438\u0441\u0442\u0430' : 'sheets'}), exportToPdf() (A4 landscape), downloadChartAsPng()</P>

        {/* Section 14 — RBAC */}
        <SectionTitle id="rbac">{isRu ? '14. RBAC \u2014 \u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u0430' : '14. RBAC \u2014 Access Control'}</SectionTitle>
        <P>{isRu
          ? '5 ролей: admin, director, manager, mechanic, viewer. 15 permissions. Каждый пользователь имеет массив pages[] для доступа к страницам.'
          : '5 roles: admin, director, manager, mechanic, viewer. 15 permissions. Each user has pages[] array for page access.'
        }</P>
        <P>{isRu
          ? 'Backend: requirePermission() middleware. Frontend: hasPermission() + Sidebar фильтрация по user.pages.'
          : 'Backend: requirePermission() middleware. Frontend: hasPermission() + Sidebar filters by user.pages.'
        }</P>
        <Sub>{isRu ? 'Видимость элементов' : 'Element Visibility'}</Sub>
        <P>{isRu
          ? 'Помимо доступа к страницам, администратор может скрывать крупные элементы (виджеты, секции, графики) на страницах для каждого пользователя. Настройки хранятся в БД (user.hiddenElements). Поддерживаемые страницы: Dashboard (5 элементов), Дашборд постов (4), Посты-детали (11 включая секции панели), Аналитика (7).'
          : 'Beyond page access, admin can hide major elements (widgets, sections, charts) per user. Settings stored in DB (user.hiddenElements). Supported pages: Dashboard (5 elements), Dashboard Posts (4), Posts Detail (11 incl. panel sections), Analytics (7).'
        }</P>
        <P>{isRu
          ? 'Frontend: isElementVisible(pageId, elementId) из AuthContext. Backend: PUT /api/users/:id принимает hiddenElements[], GET /api/auth/me отдаёт.'
          : 'Frontend: isElementVisible(pageId, elementId) from AuthContext. Backend: PUT /api/users/:id accepts hiddenElements[], GET /api/auth/me returns it.'
        }</P>

        {/* Section 15 — i18n */}
        <SectionTitle id="i18n">{isRu ? '15. \u0418\u043d\u0442\u0435\u0440\u043d\u0430\u0446\u0438\u043e\u043d\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f' : '15. Internationalization'}</SectionTitle>
        <P>{isRu
          ? 'react-i18next. 2 \u044f\u0437\u044b\u043a\u0430: RU (default) + EN. ~512 \u043a\u043b\u044e\u0447\u0435\u0439 \u0432 36 \u0441\u0435\u043a\u0446\u0438\u044f\u0445. 100% \u043f\u0430\u0440\u0438\u0442\u0435\u0442.'
          : 'react-i18next. 2 languages: RU (default) + EN. ~512 keys in 36 sections. 100% parity.'
        }</P>
        <P>{isRu ? '\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0435: t(\'nav.dashboard\'), i18n.changeLanguage(\'en\'). \u0425\u0440\u0430\u043d\u0438\u0442\u0441\u044f \u0432 localStorage.' : 'Usage: t(\'nav.dashboard\'), i18n.changeLanguage(\'en\'). Stored in localStorage.'}</P>

        {/* Section 16 — PWA */}
        <SectionTitle id="pwa">{isRu ? '16. PWA \u0438 Service Worker' : '16. PWA & Service Worker'}</SectionTitle>
        <P>{isRu
          ? 'Service Worker v11 (metricsaiup-v11). \u0421\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044f: Network-first. \u0418\u0441\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f: /api/*, /socket.io/*. Push-\u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u0447\u0435\u0440\u0435\u0437 web-push + VAPID.'
          : 'Service Worker v11 (metricsaiup-v11). Strategy: Network-first. Excludes: /api/*, /socket.io/*. Push notifications via web-push + VAPID.'
        }</P>

        {/* Section 17 — HLS */}
        <SectionTitle id="hls">{isRu ? '17. HLS \u0412\u0438\u0434\u0435\u043e\u0441\u0442\u0440\u0438\u043c\u0438\u043d\u0433' : '17. HLS Video Streaming'}</SectionTitle>
        <P>{isRu
          ? '10 RTSP-\u043a\u0430\u043c\u0435\u0440 (IP: 86.57.249.76, \u043f\u043e\u0440\u0442\u044b 1732/1832) \u2192 FFmpeg \u2192 HLS (.m3u8 + .ts) \u2192 HTTPS :8181 \u2192 HLS.js \u043d\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0435.'
          : '10 RTSP cameras (IP: 86.57.249.76, ports 1732/1832) \u2192 FFmpeg \u2192 HLS (.m3u8 + .ts) \u2192 HTTPS :8181 \u2192 HLS.js on client.'
        }</P>
        <P>{isRu ? '\u0421\u0435\u0433\u043c\u0435\u043d\u0442\u044b: 2\u0441, \u043f\u043b\u0435\u0439\u043b\u0438\u0441\u0442: 6 \u0441\u0435\u0433\u043c\u0435\u043d\u0442\u043e\u0432. \u0410\u0432\u0442\u043e-\u0440\u0435\u0441\u0442\u0430\u0440\u0442 \u0447\u0435\u0440\u0435\u0437 3\u0441.' : 'Segments: 2s, playlist: 6 segments. Auto-restart after 3s.'}</P>

        {/* Section 18 — 1C */}
        <SectionTitle id="integration1c">{isRu ? '18. \u0418\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044f \u0441 1\u0421' : '18. 1C Integration'}</SectionTitle>
        <P>{isRu
          ? '\u0420\u0443\u0447\u043d\u043e\u0439 \u0438\u043c\u043f\u043e\u0440\u0442: drag-n-drop XLSX. \u0410\u0432\u0442\u043e: file watcher /data/1c-import/. \u0422\u0438\u043f\u044b: Planning (\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435), Workers (\u0432\u044b\u0440\u0430\u0431\u043e\u0442\u043a\u0430). \u0414\u0435\u0434\u0443\u043f\u043b\u0438\u043a\u0430\u0446\u0438\u044f \u043f\u0440\u0438 \u0438\u043c\u043f\u043e\u0440\u0442\u0435.'
          : 'Manual import: drag-n-drop XLSX. Auto: file watcher /data/1c-import/. Types: Planning, Workers. Deduplication on import.'
        }</P>
        <P>{isRu ? '\u0412\u044b\u0445\u043e\u0434\u043d\u044b\u0435 \u0444\u0430\u0439\u043b\u044b: /data/1c-planning.json, /data/1c-workers.json, /data/1c-stats.json.' : 'Output: /data/1c-planning.json, /data/1c-workers.json, /data/1c-stats.json.'}</P>

        {/* Section 19 — Testing */}
        <SectionTitle id="testing">{isRu ? '19. \u0422\u0435\u0441\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435' : '19. Testing'}</SectionTitle>
        <P>{isRu
          ? 'Vitest + React Testing Library + jsdom. 18 \u0442\u0435\u0441\u0442\u043e\u0432\u044b\u0445 \u0444\u0430\u0439\u043b\u043e\u0432 (frontend). \u0417\u0430\u043f\u0443\u0441\u043a: npm test.'
          : 'Vitest + React Testing Library + jsdom. 18 test files (frontend). Run: npm test.'
        }</P>

        {/* Section 20 — Map */}
        <SectionTitle id="map">{isRu ? '20. \u0424\u0438\u0437\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043a\u0430\u0440\u0442\u0430 \u0421\u0422\u041e' : '20. Physical STO Map'}</SectionTitle>
        <P>{isRu
          ? '\u0410\u0434\u0440\u0435\u0441: \u0443\u043b. \u041a\u043e\u043b\u0435\u0441\u043d\u0438\u043a\u043e\u0432\u0430, 38. \u0420\u0430\u0437\u043c\u0435\u0440: 46540\u00d730690 \u043c\u043c. 5 \u0437\u043e\u043d, 10 \u043f\u043e\u0441\u0442\u043e\u0432 (heavy 1-4, light 5-8, special 9-10), 10 \u043a\u0430\u043c\u0435\u0440.'
          : 'Address: Kolesnikova St, 38. Size: 46540\u00d730690 mm. 5 zones, 10 posts (heavy 1-4, light 5-8, special 9-10), 10 cameras.'
        }</P>

        {/* Section 21 — Dependencies */}
        <SectionTitle id="deps">{isRu ? '21. \u0417\u0430\u0432\u0438\u0441\u0438\u043c\u043e\u0441\u0442\u0438' : '21. Dependencies'}</SectionTitle>
        <Sub>Frontend</Sub>
        <P>react 19.2.4, react-router-dom 7.13.1, tailwindcss 4.2.2, vite 8.0.1, recharts 3.8.0, konva 10.2.3, i18next 25.9.0, socket.io-client 4.8.3, hls.js 1.6.15, jspdf 4.2.1, xlsx 0.18.5, lucide-react 0.577.0</P>
        <Sub>Backend</Sub>
        <P>express 4.21.0, @prisma/client 5.20.0, jsonwebtoken 9.0.2, bcryptjs 2.4.3, socket.io 4.8.0, helmet 7.1.0, zod 4.3.6, node-cron 4.2.1, xlsx 0.18.5, web-push 3.6.7, node-telegram-bot-api 0.67.0</P>

        {/* Section 22 — Env */}
        <SectionTitle id="env">{isRu ? '22. \u041f\u0435\u0440\u0435\u043c\u0435\u043d\u043d\u044b\u0435 \u043e\u043a\u0440\u0443\u0436\u0435\u043d\u0438\u044f' : '22. Environment Variables'}</SectionTitle>
        <Table
          headers={[isRu ? '\u041f\u0435\u0440\u0435\u043c\u0435\u043d\u043d\u0430\u044f' : 'Variable', isRu ? '\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435' : 'Value', isRu ? '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435' : 'Description']}
          rows={[
            ['DATABASE_URL', 'file:./dev.db', isRu ? '\u041f\u0443\u0442\u044c \u043a SQLite' : 'SQLite path'],
            ['JWT_SECRET', 'change-me-in-production', isRu ? '\u0421\u0435\u043a\u0440\u0435\u0442 JWT' : 'JWT secret'],
            ['PORT', '3001', isRu ? 'HTTP-\u043f\u043e\u0440\u0442 Express' : 'Express HTTP port'],
            ['NODE_ENV', 'development', isRu ? '\u041e\u043a\u0440\u0443\u0436\u0435\u043d\u0438\u0435' : 'Environment'],
            ['TELEGRAM_BOT_TOKEN', '(\u043e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e)', isRu ? '\u0422\u043e\u043a\u0435\u043d Telegram-\u0431\u043e\u0442\u0430' : 'Telegram bot token'],
            ['VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY', '(\u043e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e)', isRu ? 'VAPID \u043a\u043b\u044e\u0447\u0438 \u0434\u043b\u044f Web Push' : 'VAPID keys for Web Push'],
          ]}
        />
        <Sub>localStorage</Sub>
        <Table
          headers={[isRu ? '\u041a\u043b\u044e\u0447' : 'Key', isRu ? '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435' : 'Description']}
          rows={[
            ['token', 'JWT access token'],
            ['currentUser', isRu ? '\u041e\u0431\u044a\u0435\u043a\u0442 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f' : 'User object'],
            ['language', 'ru / en'],
            ['theme', 'dark / light'],
            ['dashboardPostsSettings', isRu ? '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 Gantt' : 'Gantt settings'],
            ['cameraMappingData', isRu ? '\u041c\u0430\u043f\u043f\u0438\u043d\u0433 \u043a\u0430\u043c\u0435\u0440' : 'Camera mapping'],
          ]}
        />

        {/* Section 23 — Seed */}
        <SectionTitle id="seed">{isRu ? '23. Seed-\u0434\u0430\u043d\u043d\u044b\u0435' : '23. Seed Data'}</SectionTitle>
        <Table
          headers={['Email', isRu ? '\u041f\u0430\u0440\u043e\u043b\u044c' : 'Password', isRu ? '\u0420\u043e\u043b\u044c' : 'Role', isRu ? '\u0418\u043c\u044f' : 'Name', isRu ? '\u0410\u043a\u0442\u0438\u0432\u0435\u043d' : 'Active']}
          rows={[
            ['admin@metricsai.up', 'admin123', 'admin', 'Admin MetricsAI', isRu ? '\u0414\u0430' : 'Yes'],
            ['demo@metricsai.up', 'demo12345', 'manager', isRu ? '\u0413\u0435\u043d\u0440\u0438 \u0424\u043e\u0440\u0434' : 'Henry Ford', isRu ? '\u0414\u0430' : 'Yes'],
            ['manager@metricsai.up', 'demo123', 'manager', isRu ? '\u0421\u0435\u0440\u0433\u0435\u0439 \u041f\u0435\u0442\u0440\u043e\u0432' : 'Sergey Petrov', isRu ? '\u0414\u0430' : 'Yes'],
            ['mechanic@metricsai.up', 'demo123', 'mechanic', isRu ? '\u0418\u0432\u0430\u043d \u041a\u043e\u0437\u043b\u043e\u0432' : 'Ivan Kozlov', isRu ? '\u041d\u0435\u0442' : 'No'],
          ]}
        />

        {/* Footer */}
        <div className="mt-10 pt-4 border-t text-center" style={{ borderColor: 'var(--border-glass)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            MetricsAiUp — {isRu ? '\u0422\u0435\u0445\u043d\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430\u0446\u0438\u044f v1.0 | {generatedDate}' : `Technical Documentation v1.0 | ${generatedDate}`}
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
