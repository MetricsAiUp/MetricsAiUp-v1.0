import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, Search, ChevronUp, BookOpen, Printer, Loader2 } from 'lucide-react';

const SECTIONS = [
  { id: 'overview', titleRu: '1. Обзор системы', titleEn: '1. System Overview' },
  { id: 'architecture', titleRu: '2. Архитектура', titleEn: '2. Architecture' },
  { id: 'infrastructure', titleRu: '3. Инфраструктура и деплой', titleEn: '3. Infrastructure & Deploy' },
  { id: 'database', titleRu: '4. База данных (29 моделей)', titleEn: '4. Database (29 models)' },
  { id: 'api', titleRu: '5. Backend API (27 модулей, 80+ эндпоинтов)', titleEn: '5. Backend API (27 modules, 80+ endpoints)' },
  { id: 'services', titleRu: '6. Backend Services (11 сервисов)', titleEn: '6. Backend Services (11 services)' },
  { id: 'middleware', titleRu: '7. Middleware', titleEn: '7. Middleware' },
  { id: 'socketio', titleRu: '8. Socket.IO', titleEn: '8. Socket.IO' },
  { id: 'pages', titleRu: '9. Frontend — Страницы (23)', titleEn: '9. Frontend — Pages (23)' },
  { id: 'components', titleRu: '10. Frontend — Компоненты (33)', titleEn: '10. Frontend — Components (33)' },
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
  { id: 'monitoring', titleRu: '24. Мониторинг и Live-режим', titleEn: '24. Monitoring & Live Mode' },
  { id: 'telegram', titleRu: '25. Telegram-бот', titleEn: '25. Telegram Bot' },
  { id: 'audit', titleRu: '26. Система аудита', titleEn: '26. Audit System' },
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
  const generatedDate = '2026-05-01';

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
            <span>{isRu ? 'Версия' : 'Version'}: 3.0</span>
            <span>{isRu ? 'Дата' : 'Date'}: {generatedDate}</span>
            <span>{isRu ? 'Система мониторинга автосервиса' : 'Auto Service Monitoring System'}</span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* Section 1 — System Overview */}
        {/* ============================================================ */}
        <SectionTitle id="overview">{isRu ? '1. Обзор системы' : '1. System Overview'}</SectionTitle>
        <P>{isRu
          ? 'MetricsAiUp -- полнофункциональная система мониторинга автосервиса (СТО), обеспечивающая real-time отслеживание автомобилей по 5 зонам и 10 постам, управление заказ-нарядами с полным жизненным циклом, интеграцию с 1С ERP, видеонаблюдение через 10 RTSP-камер с HLS-стримингом, AI-рекомендации, Telegram-бот для оперативного доступа, PWA с push-уведомлениями, и расширенную аналитику с экспортом в XLSX/PDF.'
          : 'MetricsAiUp is a full-featured auto service (STO) monitoring system providing real-time vehicle tracking across 5 zones and 10 posts, work order lifecycle management, 1C ERP integration, video surveillance through 10 RTSP cameras with HLS streaming, AI-powered recommendations, a Telegram bot for quick access, PWA with push notifications, and advanced analytics with XLSX/PDF export.'
        }</P>

        <Sub>{isRu ? 'Целевая аудитория' : 'Target Audience'}</Sub>
        <P>{isRu
          ? 'Система спроектирована для четырёх основных ролей пользователей, каждая со своим набором инструментов и уровнем доступа:'
          : 'The system is designed for four primary user roles, each with its own set of tools and access level:'
        }</P>
        <Table
          headers={[isRu ? 'Роль' : 'Role', isRu ? 'Основные задачи' : 'Primary Tasks', isRu ? 'Ключевые страницы' : 'Key Pages']}
          rows={[
            [isRu ? 'Механик' : 'Mechanic', isRu ? 'Управление заказ-нарядами на своём посту, таймеры работ, play/pause/complete, просмотр текущей загрузки' : 'Managing work orders at own post, work timers, play/pause/complete, viewing current load', 'MyPost, Dashboard'],
            [isRu ? 'Менеджер' : 'Manager', isRu ? 'Планирование через Gantt-таймлайн, контроль загрузки постов, распределение ЗН, управление сменами, импорт данных 1С' : 'Planning via Gantt timeline, post load monitoring, WO assignment, shift management, 1C data import', 'DashboardPosts, WorkOrders, Shifts, Sessions, Data1C'],
            [isRu ? 'Директор' : 'Director', isRu ? 'Аналитика и KPI, стратегические отчёты, мониторинг общей эффективности, просмотр событий и рекомендаций' : 'Analytics and KPIs, strategic reports, overall efficiency monitoring, viewing events and recommendations', 'Dashboard, Analytics, PostsDetail, Events, Cameras'],
            [isRu ? 'Администратор' : 'Admin', isRu ? 'Полный доступ: управление пользователями и ролями, настройка видимости элементов UI, аудит-лог, системный мониторинг, редактор карты, бэкапы БД, replay-режим' : 'Full access: user and role management, UI element visibility configuration, audit log, system monitoring, map editor, DB backups, replay mode', isRu ? 'Все 23 страницы' : 'All 23 pages'],
          ]}
        />

        <Sub>{isRu ? 'Источники данных' : 'Data Sources'}</Sub>
        <P>{isRu
          ? 'Данные поступают из нескольких независимых источников, каждый из которых подключается к системе своим способом:'
          : 'Data flows from multiple independent sources, each connecting to the system in its own way:'
        }</P>
        <Table
          headers={[isRu ? 'Источник' : 'Source', isRu ? 'Протокол' : 'Protocol', isRu ? 'Частота' : 'Frequency', isRu ? 'Описание' : 'Description']}
          rows={[
            [isRu ? 'CV-система (компьютерное зрение)' : 'CV System (computer vision)', 'POST /api/events (no auth)', isRu ? 'По событию (real-time)' : 'Event-driven (real-time)', isRu ? 'Распознавание номерных знаков, отслеживание движения авто по зонам и постам, 10 типов событий' : 'License plate recognition, vehicle movement tracking across zones and posts, 10 event types'],
            ['1C ERP', isRu ? 'XLSX-файлы (drag-drop или file watcher)' : 'XLSX files (drag-drop or file watcher)', isRu ? 'По расписанию / вручную' : 'Scheduled / manual', isRu ? 'Планирование работ, выработка, данные по работникам (16+ колонок на файл)' : 'Work planning, production data, worker data (16+ columns per file)'],
            [isRu ? 'RTSP-камеры (10 шт.)' : 'RTSP Cameras (10)', 'RTSP -> FFmpeg -> HLS', isRu ? 'Непрерывный поток' : 'Continuous stream', isRu ? 'Видеопотоки конвертируются в HLS (2с сегменты), доступны через веб-интерфейс' : 'Video streams converted to HLS (2s segments), accessible via web interface'],
            [isRu ? 'Внешний CV API (live-режим)' : 'External CV API (live mode)', 'GET polling (10s)', isRu ? 'Каждые 10 секунд' : 'Every 10 seconds', isRu ? 'MonitoringProxy получает состояние зон/постов от внешней CV-системы для live-мониторинга' : 'MonitoringProxy fetches zone/post state from external CV system for live monitoring'],
            [isRu ? 'Пользовательский ввод' : 'User Input', 'REST API + WebSocket', isRu ? 'По действию' : 'On action', isRu ? 'Создание/редактирование ЗН, управление сменами, настройки камер, карта СТО' : 'WO creation/editing, shift management, camera settings, STO map'],
          ]}
        />

        <Sub>{isRu ? 'Ключевые возможности' : 'Key Features'}</Sub>
        <Table
          headers={[isRu ? 'Функция' : 'Feature', isRu ? 'Описание' : 'Description']}
          rows={[
            [isRu ? 'Real-time мониторинг' : 'Real-time monitoring', isRu ? 'Отслеживание автомобилей по 5 зонам и 10 постам, обновление через Socket.IO + polling 5с' : 'Vehicle tracking across 5 zones and 10 posts, updates via Socket.IO + 5s polling'],
            [isRu ? 'Gantt-таймлайн' : 'Gantt timeline', isRu ? 'Визуальное планирование ЗН с drag-n-drop, обнаружение конфликтов, оптимистичная блокировка' : 'Visual WO planning with drag-n-drop, conflict detection, optimistic locking'],
            [isRu ? 'Интерактивная карта' : 'Interactive map', isRu ? 'Konva canvas 46540x30690мм, 8 типов элементов, live-режим с цветовой индикацией статусов' : 'Konva canvas 46540x30690mm, 8 element types, live mode with status color indicators'],
            [isRu ? 'Видеонаблюдение' : 'Video surveillance', isRu ? '10 RTSP-камер, HLS-стриминг, мониторинг здоровья камер каждые 30с' : '10 RTSP cameras, HLS streaming, camera health monitoring every 30s'],
            [isRu ? 'AI-рекомендации' : 'AI recommendations', isRu ? '5 типов алертов: свободный пост, превышение времени, простой, перегрузка, неявка' : '5 alert types: free post, overtime, idle, overload, no-show'],
            [isRu ? 'Интеграция 1С' : '1C integration', isRu ? 'Импорт/экспорт XLSX, автоматический file watcher, дедупликация, sync log' : 'XLSX import/export, automatic file watcher, deduplication, sync log'],
            [isRu ? 'RBAC' : 'RBAC', isRu ? '5 ролей, 15+ разрешений, настройка страниц и элементов UI для каждого пользователя' : '5 roles, 15+ permissions, per-user page and UI element configuration'],
            [isRu ? 'Аналитика и экспорт' : 'Analytics & export', isRu ? 'Recharts графики, экспорт XLSX (4 листа), PDF, PNG, автоотчёты по расписанию' : 'Recharts charts, XLSX export (4 sheets), PDF, PNG, scheduled auto-reports'],
            [isRu ? 'PWA' : 'PWA', isRu ? 'Service Worker (network-first), Web Push уведомления, оффлайн-режим для статики' : 'Service Worker (network-first), Web Push notifications, offline mode for static files'],
            [isRu ? 'Telegram-бот' : 'Telegram bot', isRu ? '5 команд, привязка к аккаунту, доставка автоотчётов в формате XLSX' : '5 commands, account binding, auto-report delivery in XLSX format'],
            [isRu ? 'Двуязычность' : 'Bilingual', isRu ? 'Полная поддержка RU/EN через i18next (613 строк, ~512 ключей в каждом файле)' : 'Full RU/EN support via i18next (613 lines, ~512 keys per file)'],
            [isRu ? 'Replay-режим карты' : 'Map replay mode', isRu ? 'Перемотка истории состояния зон/постов: GET /api/replay/range, /api/replay/window, /api/monitoring/history. Снапшоты в MonitoringSnapshot, текущее состояние в MonitoringCurrent' : 'History scrubbing for zones/posts: GET /api/replay/range, /api/replay/window, /api/monitoring/history. Snapshots in MonitoringSnapshot, current state in MonitoringCurrent'],
            [isRu ? 'Бэкапы и ретеншн БД' : 'DB backups & retention', isRu ? 'BackupScheduler делает регулярные снимки SQLite, RetentionCleaner удаляет старые записи MonitoringSnapshot и Event. SQLite в WAL-режиме для конкурентного чтения' : 'BackupScheduler takes regular SQLite snapshots, RetentionCleaner deletes old MonitoringSnapshot/Event records. SQLite in WAL mode for concurrent reads'],
            [isRu ? 'Гидратация постов' : 'Post hydration', isRu ? 'При старте бэкенда состояние постов восстанавливается из MonitoringCurrent (hydrate), что обеспечивает целостность после рестарта' : 'On backend start, post state is restored from MonitoringCurrent (hydrate), ensuring consistency after restart'],
          ]}
        />

        <Sub>{isRu ? 'Технологический стек' : 'Technology Stack'}</Sub>
        <Table
          headers={[isRu ? 'Слой' : 'Layer', isRu ? 'Технологии' : 'Technologies', isRu ? 'Назначение' : 'Purpose']}
          rows={[
            ['Frontend', 'React 19.2, Vite 8, Tailwind CSS 4, Recharts 3, Konva 10, react-konva 19, react-i18next, Socket.IO Client 4.8, HLS.js 1.6, jsPDF 4.2, xlsx 0.18, Lucide React 0.577', isRu ? 'SPA с 23 страницами, 33 компонентами, real-time обновления, PWA' : 'SPA with 23 pages, 33 components, real-time updates, PWA'],
            ['Backend', 'Express 4.21, Prisma 5.20, SQLite (WAL), Socket.IO 4.8, Zod 4.3, node-cron 4.2, web-push 3.6, node-telegram-bot-api 0.67, Winston 3.x, Helmet 7.1', isRu ? '27 модулей API (80+ эндпоинтов), 11 фоновых сервисов, JWT auth, бэкапы БД, ретеншн, Swagger UI' : '27 API modules (80+ endpoints), 11 background services, JWT auth, DB backups, retention, Swagger UI'],
            [isRu ? 'Стриминг' : 'Streaming', 'FFmpeg (RTSP -> HLS), Node.js HTTPS :8181', isRu ? '10 камер, 2с сегменты, 6 в плейлисте (~12с задержка), автоперезапуск' : '10 cameras, 2s segments, 6 in playlist (~12s delay), auto-restart'],
            [isRu ? 'Инфраструктура' : 'Infrastructure', 'Docker, Express HTTPS :443 (Let\'s Encrypt), WireGuard VPN', isRu ? 'Express раздаёт фронт+API напрямую, БЕЗ reverse proxy. Порты 80-65535 1:1 на VPS' : 'Express serves frontend+API directly, NO reverse proxy. Ports 80-65535 1:1 to VPS'],
            [isRu ? 'Тестирование' : 'Testing', 'Vitest, React Testing Library, jsdom', isRu ? 'Backend: 35 файлов, 506 тестов. Frontend: 45 файлов, 361 тест' : 'Backend: 35 files, 506 tests. Frontend: 45 files, 361 tests'],
          ]}
        />


        {/* ============================================================ */}
        {/* Section 2 — Architecture */}
        {/* ============================================================ */}
        <SectionTitle id="architecture">{isRu ? '2. Архитектура' : '2. Architecture'}</SectionTitle>
        <P>{isRu
          ? 'Архитектура проекта следует классической клиент-серверной модели с чётким разделением ответственности. Фронтенд и бэкенд живут в одном репозитории (монорепо), но собираются и деплоятся отдельно. Фронтенд билдится через Vite в статические файлы и раздаётся Nginx, а бэкенд работает как долгоживущий Node.js-процесс с 8 фоновыми сервисами.'
          : 'The project architecture follows a classic client-server model with clear separation of concerns. Frontend and backend live in a single repository (monorepo) but are built and deployed separately. The frontend is built via Vite into static files served by Nginx, while the backend runs as a long-lived Node.js process with 8 background services.'
        }</P>

        <Sub>{isRu ? 'Структура файлов' : 'File Structure'}</Sub>
        <Code>{`/project
\u251c\u2500\u2500 frontend/src/           # React 19, 23 pages, 33 components, 3 contexts, 4 hooks
\u2502   \u251c\u2500\u2500 pages/              # 23 lazy-loaded pages (Dashboard, Analytics, MapEditor, TechDocs, PostHistory, etc.)
\u2502   \u251c\u2500\u2500 components/         # 20 shared + dashboardPosts/ (9 files) + postsDetail/ (4 files) + __tests__/
\u2502   \u2502   \u251c\u2500\u2500 dashboardPosts/ # GanttTimeline, TimelineRow, TimelineHeader, WorkOrderModal, ConflictModal,
\u2502   \u2502   \u2502                   # FreeWorkOrdersTable, ShiftSettings, Legend, constants.js
\u2502   \u2502   \u2514\u2500\u2500 postsDetail/    # PostDetailPanel, PostCardsView, PostTableView, CollapsibleSection
\u2502   \u251c\u2500\u2500 contexts/           # AuthContext (338 LOC), ThemeContext, ToastContext
\u2502   \u251c\u2500\u2500 hooks/              # useSocket, useWorkOrderTimer, useCameraStatus, useAsync
\u2502   \u251c\u2500\u2500 utils/              # translate.js, export.js
\u2502   \u2514\u2500\u2500 i18n/               # ru.json (613 lines), en.json (613 lines), ~512 keys
\u251c\u2500\u2500 backend/src/            # Express 4, 27 route modules, 11 background services
\u2502   \u251c\u2500\u2500 routes/             # 27 modules: auth, dashboard, posts, zones, events, cameras, sessions,
\u2502   \u2502                       # workOrders, recommendations, users, shifts, data1c, mapLayout, auditLog,
\u2502   \u2502                       # predict, postsData, workers, health, push, photos, locations,
\u2502   \u2502                       # reportSchedule, monitoring, settings, backup, replay
\u2502   \u251c\u2500\u2500 services/           # eventProcessor, recommendationEngine, monitoringProxy, cameraHealthCheck,
\u2502   \u2502                       # sync1C, telegramBot, reportScheduler, serverExport,
\u2502   \u2502                       # backupScheduler, mapSyncService, retentionCleaner
\u2502   \u251c\u2500\u2500 middleware/         # auth.js, auditLog.js, validate.js, asyncHandler.js
\u2502   \u2514\u2500\u2500 config/             # socket.js, database.js, logger.js, authCache.js
\u251c\u2500\u2500 backend/prisma/         # schema.prisma (29 models, WAL mode), migrations/, seed.js, backups/
\u251c\u2500\u2500 data/                   # JSON mock/fallback files + 1c-import/ (file watcher target)
\u251c\u2500\u2500 .ssl/                   # fullchain.pem, privkey.pem (Let's Encrypt, expires 2026-07-05)
\u251c\u2500\u2500 server.js               # HLS streaming server :8181 (FFmpeg RTSP\u2192HLS, 10 cameras)
\u251c\u2500\u2500 sw.js                   # Service Worker v53 (network-first, push)
\u251c\u2500\u2500 manifest.json           # PWA manifest
\u2514\u2500\u2500 index.html              # SPA entry point (served directly by Express)`}</Code>

        <Sub>{isRu ? 'Иерархия React-контекстов' : 'React Context Hierarchy'}</Sub>
        <P>{isRu
          ? 'Приложение оборачивается в три вложенных провайдера в строгом порядке. ThemeProvider должен быть внешним, так как устанавливает CSS-переменные для всех дочерних компонентов. ToastProvider следующий, чтобы AuthProvider мог показывать toast-ошибки. AuthProvider последний перед роутером, чтобы все страницы имели доступ к авторизации и API-клиенту.'
          : 'The application wraps in three nested providers in strict order. ThemeProvider must be outermost as it sets CSS variables for all child components. ToastProvider is next so AuthProvider can show toast errors. AuthProvider is last before the router so all pages have access to auth and API client.'
        }</P>
        <Code>{`ThemeProvider              // dark/light CSS variables (:root)
  \u2514\u2500 ToastProvider            // success/error/warning/info (max 3 simultaneous)
      \u2514\u2500 AuthProvider           // user state, JWT, api client, permissions, Socket.IO connect
          \u2514\u2500 HashRouter           // client-side routing (22 routes)
              \u251c\u2500 /login             // Login page (public)
              \u2514\u2500 ProtectedRoute     // JWT check, redirect to /login if no token
                  \u2514\u2500 Layout           // Header (theme toggle, lang, notifications) + Sidebar + Outlet
                      \u2514\u2500 Suspense       // loading fallback (Skeleton)
                          \u2514\u2500 Pages        // 23 lazy-loaded via React.lazy()`}</Code>

        <Sub>{isRu ? 'Основной поток данных (Data Flow)' : 'Primary Data Flow'}</Sub>
        <P>{isRu
          ? 'Основной поток начинается с внешних источников. CV-система отправляет события через POST /api/events без авторизации. EventProcessor (308 строк) обрабатывает каждое событие, создавая/обновляя VehicleSession, ZoneStay и PostStay, а затем обновляет статус поста. Каждое изменение транслируется через Socket.IO. Клиенты получают обновления мгновенно через подписки или с минимальной задержкой через polling.'
          : 'The main data flow begins with external sources. The CV system sends events via POST /api/events without authentication. EventProcessor (308 LOC) processes each event, creating/updating VehicleSession, ZoneStay and PostStay, then updates post status. Every change is broadcast via Socket.IO. Clients receive updates instantly via subscriptions or with minimal delay via polling.'
        }</P>
        <Code>{`CV System \u2500\u2500 POST /api/events (no auth) \u2500\u2500\u25b6 EventProcessor (308 LOC)
    \u2502                                            \u2502
    \u2502                                    \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
    \u2502                                    \u2502 VehicleSession  \u2502
    \u2502                                    \u2502 ZoneStay        \u2502\u2500\u2500\u25b6 Prisma \u2500\u25b6 SQLite (dev.db)
    \u2502                                    \u2502 PostStay        \u2502
    \u2502                                    \u2502 Post.status     \u2502
    \u2502                                    \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
    \u2502                                            \u2502
    \u2502                                    Socket.IO broadcast
    \u2502                                   (post:status_changed, event, zone:update)
    \u2502                                            \u2502
Frontend (React) \u2500\u2500 api.get/post \u2500\u2500\u25b6 Express \u2500\u2500 Prisma \u2500\u2500\u25b6 SQLite
    \u2502                                            \u2502
    \u2514\u2500\u2500 HLS.js :8181 \u2500\u2500\u2500\u2500\u25b6 FFmpeg \u25c0\u2500\u2500\u2500\u2500\u2500\u2500 RTSP cameras (10)

1C ERP \u2500\u2500 XLSX files \u2500\u2500\u25b6 Sync1C (file watcher /data/1c-import/) \u2500\u2500\u25b6 JSON + DB

MonitoringProxy \u2500\u2500 GET external CV API (10s) \u2500\u2500\u25b6 /api/monitoring/* \u2500\u2500\u25b6 Frontend
                                                                   (live mode)`}</Code>

        <Sub>{isRu ? 'Fallback-цепочка' : 'Fallback Chain'}</Sub>
        <P>{isRu
          ? 'При недоступности данных система использует fallback-цепочку: (1) Backend API -- основной источник данных из Prisma/SQLite; (2) JSON-моки в /data/ (29 файлов) -- используются как seed и fallback при пустой БД; (3) localStorage -- ТОЛЬКО для клиентских настроек (token, currentUser, theme, language). Система спроектирована так, чтобы все данные хранились в БД; localStorage НЕ используется как замена API.'
          : 'When data is unavailable, the system uses a fallback chain: (1) Backend API -- primary data source from Prisma/SQLite; (2) JSON mocks in /data/ (29 files) -- used as seed and fallback for empty DB; (3) localStorage -- ONLY for client settings (token, currentUser, theme, language). The system is designed so all data is stored in DB; localStorage is NOT used as API replacement.'
        }</P>


        {/* ============================================================ */}
        {/* Section 3 — Infrastructure & Deploy */}
        {/* ============================================================ */}
        <SectionTitle id="infrastructure">{isRu ? '3. Инфраструктура и деплой' : '3. Infrastructure & Deploy'}</SectionTitle>
        <P>{isRu
          ? 'Проект развёрнут в Docker-контейнере (Node.js 20, Python 3.11) с рабочей директорией /project. Контейнер подключён к VPS через WireGuard VPN, при этом все порты 80-65535 проброшены 1:1 на VPS. Это означает, что любой сервис внутри контейнера доступен извне по его реальному порту через домен artisom.dev.metricsavto.com. Reverse proxy НЕ используется -- Express раздаёт фронтенд и API напрямую, HLS-сервер также работает напрямую.'
          : 'The project is deployed in a Docker container (Node.js 20, Python 3.11) with working directory /project. The container is connected to a VPS via WireGuard VPN, with all ports 80-65535 mapped 1:1 to the VPS. Any service inside the container is accessible externally on its actual port via the domain artisom.dev.metricsavto.com. Reverse proxy is NOT used -- Express serves frontend and API directly, the HLS server also runs directly.'
        }</P>

        <Sub>{isRu ? 'Карта портов' : 'Port Map'}</Sub>
        <Table
          headers={[isRu ? 'Сервер' : 'Server', isRu ? 'Порт' : 'Port', isRu ? 'Протокол' : 'Protocol', isRu ? 'Назначение' : 'Purpose', isRu ? 'Публичный URL' : 'Public URL']}
          rows={[
            ['Express', '443', 'HTTPS', isRu ? 'Основной: фронтенд (SPA) + REST API + Socket.IO (Let\'s Encrypt SSL)' : 'Primary: frontend (SPA) + REST API + Socket.IO (Let\'s Encrypt SSL)', 'https://artisom.dev.metricsavto.com/'],
            ['Express', '3001', 'HTTP', isRu ? 'Тот же Express без SSL: фронт + API + Socket.IO' : 'Same Express without SSL: frontend + API + Socket.IO', 'http://artisom.dev.metricsavto.com:3001/'],
            ['HLS Server', '8181', 'HTTPS', isRu ? 'Отдельный Node.js процесс (server.js): RTSP->HLS конвертация, .m3u8/.ts раздача' : 'Separate Node.js process (server.js): RTSP->HLS conversion, .m3u8/.ts serving', 'https://artisom.dev.metricsavto.com:8181/'],
            ['ML API', '8282', 'HTTP', isRu ? 'FastAPI (predict_api.py): scikit-learn модели для /api/predict/*' : 'FastAPI (predict_api.py): scikit-learn models for /api/predict/*', isRu ? 'Внутренний (через Express)' : 'Internal (via Express)'],
          ]}
        />

        <Sub>{isRu ? 'Почему НЕТ прокси-сервера' : 'Why NO Proxy Server'}</Sub>
        <P>{isRu
          ? 'В контейнере сознательно не используются Nginx, Apache, traefik или какой-либо reverse proxy. Express создаёт два сервера в одном процессе: http.createServer на :3001 и https.createServer на :443 (используя сертификат из /project/.ssl/). Оба обслуживают одни и те же роуты: /api/* -- API, /socket.io/* -- WebSocket, /* -- статика SPA из /project/ и SPA fallback (catchAll -> index.html). Это упрощает деплой (нет конфигов nginx), исключает дублирование TLS termination и убирает целый слой потенциальных ошибок проксирования WebSocket.'
          : 'The container deliberately does not use Nginx, Apache, traefik or any reverse proxy. Express creates two servers in one process: http.createServer on :3001 and https.createServer on :443 (using certificate from /project/.ssl/). Both serve the same routes: /api/* -- API, /socket.io/* -- WebSocket, /* -- SPA static from /project/ and SPA fallback (catchAll -> index.html). This simplifies deployment (no nginx configs), eliminates duplicate TLS termination and removes a whole layer of potential WebSocket proxying errors.'
        }</P>

        <Sub>{isRu ? 'SSL-сертификат' : 'SSL Certificate'}</Sub>
        <P>{isRu
          ? 'Домен: artisom.dev.metricsavto.com. Сертификат Let\'s Encrypt расположен в /project/.ssl/fullchain.pem, приватный ключ в /project/.ssl/privkey.pem. Срок действия до 2026-07-05. Используется Express HTTPS :443 (фронт + API) и HLS-сервером :8181.'
          : 'Domain: artisom.dev.metricsavto.com. Let\'s Encrypt certificate at /project/.ssl/fullchain.pem, private key at /project/.ssl/privkey.pem. Valid until 2026-07-05. Used by Express HTTPS :443 (frontend + API) and HLS server :8181.'
        }</P>

        <Sub>{isRu ? 'Маршрутизация Express' : 'Express Routing'}</Sub>
        <Code>{`# ${isRu ? 'Express обрабатывает запросы в одном процессе на двух портах' : 'Express handles requests in one process on two ports'}
  /api/*       \u2192 ${isRu ? '27 роутеров (auth, dashboard, posts, ...)' : '27 routers (auth, dashboard, posts, ...)'}
  /socket.io/* \u2192 Socket.IO ${isRu ? 'attached к обоим серверам (HTTP+HTTPS)' : 'attached to both servers (HTTP+HTTPS)'}
  /api-docs    \u2192 Swagger UI (OpenAPI 3.0)
  /assets/*    \u2192 ${isRu ? 'статика билда Vite (хешированные имена)' : 'Vite build static (hashed names)'}
  /sw.js, /manifest.json, /favicon.svg \u2192 ${isRu ? 'PWA-файлы из корня /project/' : 'PWA files from /project/ root'}
  /*           \u2192 ${isRu ? 'SPA fallback: index.html (catchAll для HashRouter)' : 'SPA fallback: index.html (catchAll for HashRouter)'}

# ${isRu ? 'HLS-сервер -- отдельный процесс на :8181 с собственным CORS (Access-Control-Allow-Origin: *)' : 'HLS server is a separate process on :8181 with its own CORS (Access-Control-Allow-Origin: *)'}`}</Code>

        <Sub>{isRu ? 'Билд и деплой' : 'Build & Deploy'}</Sub>
        <P>{isRu
          ? 'Процесс деплоя фронтенда состоит из трёх обязательных шагов. Prebuild-скрипт в package.json автоматически очищает старые assets перед сборкой, чтобы избежать конфликтов хешей. После копирования файлов необходимо обновить CACHE_NAME в sw.js -- это единственный способ заставить Service Worker обновить кеш у всех клиентов.'
          : 'The frontend deploy process consists of three mandatory steps. The prebuild script in package.json automatically cleans old assets before building to avoid hash conflicts. After copying files, CACHE_NAME in sw.js must be updated -- this is the only way to force Service Worker to refresh cache for all clients.'
        }</P>
        <Code>{`# Frontend build & deploy
cd /project/frontend && npm run build && cp -r dist/* /project/
# ${isRu ? 'prebuild: автоочистка старых assets' : 'prebuild: auto-clean old assets'}
# ${isRu ? 'ОБЯЗАТЕЛЬНО: бампить CACHE_NAME в sw.js (текущий: metricsaiup-v54)' : 'REQUIRED: bump CACHE_NAME in sw.js (current: metricsaiup-v54)'}

# Backend start
cd /project/backend && node src/index.js
# ${isRu ? 'HTTP :3001 + HTTPS :443 (фронт+API+Socket.IO) + 11 фоновых сервисов' : 'HTTP :3001 + HTTPS :443 (frontend+API+Socket.IO) + 11 background services'}
# ${isRu ? 'Swagger UI: /api-docs (OpenAPI 3.0)' : 'Swagger UI: /api-docs (OpenAPI 3.0)'}

# HLS streaming
cd /project && node server.js
# ${isRu ? 'RTSP->HLS конвертация на порту 8181 (HTTPS, отдельный процесс)' : 'RTSP->HLS conversion on port 8181 (HTTPS, separate process)'}

# Database
cd /project/backend && npx prisma migrate deploy  # ${isRu ? 'применить миграции' : 'apply migrations'}
cd /project/backend && npx prisma db seed          # ${isRu ? 'загрузить seed-данные' : 'load seed data'}
# ${isRu ? 'SQLite запускается в WAL-режиме (pragma journal_mode=WAL) для конкурентного чтения' : 'SQLite runs in WAL mode (pragma journal_mode=WAL) for concurrent reads'}`}</Code>


        {/* ============================================================ */}
        {/* Section 4 — Database */}
        {/* ============================================================ */}
        <SectionTitle id="database">{isRu ? '4. База данных (Prisma + SQLite, 29 моделей)' : '4. Database (Prisma + SQLite, 29 models)'}</SectionTitle>
        <P>{isRu
          ? 'Система использует Prisma 5.20 как ORM с SQLite. Файл БД: backend/prisma/dev.db. SQLite выбран за простоту (один файл, без сервера), достаточную производительность для single-node установки, и совместимость с Prisma. Миграции через prisma migrate, seed-данные через prisma db seed (backend/prisma/seed.js). При старте бэкенда выставляется PRAGMA journal_mode=WAL для конкурентного чтения и записи -- это важно для одновременной работы EventProcessor, MonitoringProxy и пользовательских запросов через API.'
          : 'The system uses Prisma 5.20 as ORM with SQLite. DB file: backend/prisma/dev.db. SQLite was chosen for simplicity (single file, no server), sufficient performance for single-node installations, and Prisma compatibility. Migrations via prisma migrate, seed data via prisma db seed (backend/prisma/seed.js). On backend start, PRAGMA journal_mode=WAL is set for concurrent reads/writes -- important for simultaneous work of EventProcessor, MonitoringProxy and user API requests.'
        }</P>

        <Sub>{isRu ? 'WAL, бэкапы, ретеншн и hydrate' : 'WAL, Backups, Retention & Hydrate'}</Sub>
        <P>{isRu
          ? 'Четыре свойства БД, важные для надёжности: (1) WAL (Write-Ahead Logging) -- читатели не блокируют писателей и наоборот, что критично для real-time событий от CV-системы; (2) BackupScheduler сервис делает периодические снимки БД через VACUUM INTO в /project/backend/prisma/backups/; (3) RetentionCleaner периодически удаляет старые записи MonitoringSnapshot и Event по настраиваемому окну (по умолчанию недели); (4) при старте Express бэкенд "гидрирует" текущее состояние постов из таблицы MonitoringCurrent, что обеспечивает целостность после рестарта без потери последнего известного состояния.'
          : 'Four DB properties critical for reliability: (1) WAL (Write-Ahead Logging) -- readers do not block writers and vice versa, critical for real-time CV events; (2) BackupScheduler service takes periodic DB snapshots via VACUUM INTO into /project/backend/prisma/backups/; (3) RetentionCleaner periodically deletes old MonitoringSnapshot and Event records by configurable window (default: weeks); (4) on Express backend start, current post state is "hydrated" from MonitoringCurrent table, ensuring consistency after restart without losing the last known state.'
        }</P>

        <Sub>{isRu ? 'RBAC -- цепочка доступа (5 уровней)' : 'RBAC -- Access Chain (5 levels)'}</Sub>
        <P>{isRu
          ? 'Система доступа построена на пятиуровневой цепочке: User -> UserRole -> Role -> RolePermission -> Permission. Каждый пользователь имеет одну роль через UserRole. Роль содержит набор разрешений через RolePermission. Дополнительно у пользователя есть: pages[] (доступные страницы), hiddenElements[] (скрытые виджеты UI), isActive (можно деактивировать аккаунт).'
          : 'The access system is built on a five-level chain: User -> UserRole -> Role -> RolePermission -> Permission. Each user has one role via UserRole. A role contains permissions via RolePermission. Additionally, users have: pages[] (accessible pages), hiddenElements[] (hidden UI widgets), isActive (account can be deactivated).'
        }</P>
        <Table
          headers={[isRu ? 'Роль' : 'Role', isRu ? 'Разрешения' : 'Permissions', isRu ? 'Описание' : 'Description']}
          rows={[
            ['admin', isRu ? 'Все 15 + manage_roles, manage_settings' : 'All 15 + manage_roles, manage_settings', isRu ? 'Полный доступ ко всем функциям и страницам' : 'Full access to all features and pages'],
            ['director', 'view_dashboard, view_analytics, view_zones, view_posts, view_sessions, view_events, view_work_orders, view_recommendations, view_cameras', isRu ? 'Только просмотр, без редактирования данных' : 'View only, no data editing'],
            ['manager', 'view_dashboard, view_zones, view_posts, view_sessions, view_events, manage_work_orders, view_recommendations', isRu ? 'Управление заказ-нарядами + полный просмотр' : 'Work order management + full viewing'],
            ['mechanic', 'view_dashboard, view_posts, view_sessions', isRu ? 'Работа на своём посту, базовая информация' : 'Work at own post, basic info'],
            ['viewer', 'view_dashboard, view_zones, view_posts', isRu ? 'Минимальный read-only доступ' : 'Minimal read-only access'],
          ]}
        />

        <Sub>{isRu ? 'Все 29 моделей' : 'All 29 Models'}</Sub>
        <Table
          headers={[isRu ? 'Модель' : 'Model', isRu ? 'Ключевые поля' : 'Key Fields', isRu ? 'Связи' : 'Relations', isRu ? 'Назначение' : 'Purpose']}
          rows={[
            ['User', 'email, password (bcrypt), name, isActive, pages (JSON), hiddenElements (JSON)', '\u2192 UserRole, AuditLog[], TelegramLink, Photo[]', isRu ? 'Учётная запись пользователя с настройками доступа' : 'User account with access settings'],
            ['UserRole', 'userId, roleId', '\u2192 User, Role', isRu ? 'Связь пользователь-роль (1:1)' : 'User-role link (1:1)'],
            ['Role', 'name (unique), description', '\u2192 UserRole[], RolePermission[]', isRu ? '5 предустановленных ролей' : '5 preset roles'],
            ['Permission', 'key (unique), description', '\u2192 RolePermission[]', isRu ? '15+ разрешений (view_*, manage_*)' : '15+ permissions (view_*, manage_*)'],
            ['RolePermission', 'roleId, permissionId', '\u2192 Role, Permission', isRu ? 'Связь роль-разрешение (M:N)' : 'Role-permission link (M:N)'],
            ['Zone', 'name, type (repair/waiting/entry/parking/free), coordinates (JSON)', '\u2192 Post[], CameraZone[], ZoneStay[]', isRu ? '5 физических зон СТО' : '5 physical STO zones'],
            ['Post', 'name, number, type (light/heavy/special), status (free/occupied/occupied_no_work/active_work), zoneId', '\u2192 Zone, PostStay[], WorkOrderLink[], ShiftWorker[]', isRu ? '10 рабочих постов механиков' : '10 mechanic work posts'],
            ['Camera', 'name, rtspUrl, isActive, hlsUrl, order', '\u2192 CameraZone[], Event[]', isRu ? '10 RTSP-камер видеонаблюдения' : '10 RTSP surveillance cameras'],
            ['CameraZone', 'cameraId, zoneId, priority (0-10)', '\u2192 Camera, Zone', isRu ? 'Маппинг камер на зоны с приоритетами' : 'Camera-zone mapping with priorities'],
            ['VehicleSession', 'plateNumber, entryTime, exitTime, status (active/completed), trackId', '\u2192 ZoneStay[], PostStay[], Event[]', isRu ? 'Сессия пребывания автомобиля на СТО' : 'Vehicle stay session at STO'],
            ['ZoneStay', 'entryTime, exitTime, duration (seconds), vehicleSessionId, zoneId', '\u2192 VehicleSession, Zone', isRu ? 'Пребывание авто в конкретной зоне' : 'Vehicle stay in a specific zone'],
            ['PostStay', 'entryTime, exitTime, hasWorker, isActive, activeTime, idleTime, vehicleSessionId, postId', '\u2192 VehicleSession, Post', isRu ? 'Пребывание авто на конкретном посту (с метриками работы)' : 'Vehicle stay at a specific post (with work metrics)'],
            ['WorkOrder', 'orderNumber, externalId, description, status (pending/scheduled/in_progress/paused/completed), normHours, startedAt, completedAt, pausedAt, totalPausedMs, version, postId, priority', '\u2192 WorkOrderLink[]', isRu ? 'Заказ-наряд с полным жизненным циклом и оптимистичной блокировкой' : 'Work order with full lifecycle and optimistic locking'],
            ['WorkOrderLink', 'workOrderId, postId, vehicleSessionId, startTime, endTime', '\u2192 WorkOrder, Post, VehicleSession?', isRu ? 'Привязка ЗН к посту/сессии на определённое время' : 'WO binding to post/session at specific time'],
            ['Event', 'type (10 types), confidence, cameraSources (JSON), plateNumber, description, zoneId, postId, vehicleSessionId, cameraId', '\u2192 Zone?, Post?, VehicleSession?, Camera?', isRu ? 'CV-событие с привязкой к зоне/посту/камере' : 'CV event linked to zone/post/camera'],
            ['Shift', 'name, date, startTime, endTime, status (active/completed)', '\u2192 ShiftWorker[]', isRu ? 'Рабочая смена с временным окном' : 'Work shift with time window'],
            ['ShiftWorker', 'name, role, postId, shiftId', '\u2192 Shift, Post?', isRu ? 'Работник назначенный на смену и пост' : 'Worker assigned to shift and post'],
            ['Recommendation', 'type (5 types), message, messageEn, status (active/acknowledged), zoneId?, postId?', '\u2192 Zone?, Post?', isRu ? 'AI-рекомендация с двуязычным текстом' : 'AI recommendation with bilingual text'],
            ['AuditLog', 'action, entity, entityId, oldData (JSON), newData (JSON), ip, userAgent, userId', isRu ? 'Индексы: userId, action, entity, createdAt' : 'Indexes: userId, action, entity, createdAt', isRu ? 'Лог всех мутаций с детализацией' : 'Log of all mutations with details'],
            ['MapLayout', 'name, width (46540), height (30690), elements (JSON)', '\u2192 MapLayoutVersion[]', isRu ? 'Карта СТО с элементами (здания, посты, зоны, камеры)' : 'STO map with elements (buildings, posts, zones, cameras)'],
            ['MapLayoutVersion', 'layoutId, elements (JSON), authorId, createdAt', '\u2192 MapLayout', isRu ? 'Версия карты для отката' : 'Map version for rollback'],
            ['SyncLog', 'type, direction (import/export), status (success/error), fileName, recordCount, error', isRu ? 'Нет связей' : 'No relations', isRu ? 'Журнал операций синхронизации с 1С' : '1C sync operations log'],
            ['Photo', 'postId, userId, data (base64), mimeType, description', '\u2192 User', isRu ? 'Фото постов (base64 в БД)' : 'Post photos (base64 in DB)'],
            ['PushSubscription', 'endpoint, keys (JSON: p256dh, auth), userId', '\u2192 User?', isRu ? 'Web Push подписка браузера' : 'Browser Web Push subscription'],
            ['TelegramLink', 'chatId, userId', '\u2192 User', isRu ? 'Связь Telegram chatId с пользователем' : 'Telegram chatId to user mapping'],
            ['ReportSchedule', 'name, cron, type, filters (JSON), telegramChatId, isActive', isRu ? 'Нет связей' : 'No relations', isRu ? 'Расписание автоматических XLSX-отчётов' : 'Automatic XLSX report schedule'],
            ['Location', 'name, address, isActive, timezone', '\u2192 Zone[]?', isRu ? 'Локация (мультитенантность для нескольких СТО)' : 'Location (multi-tenancy for multiple STOs)'],
            ['MonitoringSnapshot', 'capturedAt, source (live/replay/db), payload (JSON), zoneState, postState', isRu ? 'Нет связей' : 'No relations', isRu ? 'История состояния зон/постов от MonitoringProxy. Используется replay-режимом и историей карты' : 'Historical zone/post state from MonitoringProxy. Used by replay mode and map history'],
            ['MonitoringCurrent', 'updatedAt, source, payload (JSON), zoneState, postState', isRu ? 'Нет связей' : 'No relations', isRu ? 'Последнее известное состояние мониторинга (one-row table). Используется при гидратации после рестарта бэкенда' : 'Last known monitoring state (one-row table). Used for hydration after backend restart'],
          ]}
        />

        <Sub>{isRu ? 'WorkOrder -- жизненный цикл и оптимистичная блокировка' : 'WorkOrder -- Lifecycle & Optimistic Locking'}</Sub>
        <P>{isRu
          ? 'Заказ-наряд проходит через состояния: pending (создан/импортирован) -> scheduled (назначен на пост/время через Gantt) -> in_progress (механик начал) -> paused (пауза) -> in_progress (возобновлён) -> completed. Поле version обеспечивает оптимистичную блокировку: при batch-обновлении через POST /api/work-orders/schedule бэкенд проверяет version каждого ЗН в транзакции. При несовпадении -- HTTP 409 с массивом conflicts[]. pausedAt + totalPausedMs обеспечивают точный учёт рабочего времени без пауз.'
          : 'Work order transitions: pending (created/imported) -> scheduled (assigned via Gantt) -> in_progress (mechanic started) -> paused (break) -> in_progress (resumed) -> completed. The version field provides optimistic locking: during batch updates via POST /api/work-orders/schedule, the backend checks each WO version in a transaction. On mismatch -- HTTP 409 with conflicts[]. pausedAt + totalPausedMs ensure accurate work time tracking excluding pauses.'
        }</P>

        <Sub>{isRu ? '10 типов событий (Event.type)' : '10 Event Types (Event.type)'}</Sub>
        <Table
          headers={[isRu ? 'Тип' : 'Type', isRu ? 'Описание' : 'Description', isRu ? 'Действие EventProcessor' : 'EventProcessor Action']}
          rows={[
            ['vehicle_enter', isRu ? 'Автомобиль въехал на СТО' : 'Vehicle entered STO', isRu ? 'Создаёт VehicleSession (plateNumber, trackId)' : 'Creates VehicleSession (plateNumber, trackId)'],
            ['vehicle_exit', isRu ? 'Автомобиль покинул СТО' : 'Vehicle left STO', isRu ? 'Завершает VehicleSession (exitTime, status=completed)' : 'Completes VehicleSession (exitTime, status=completed)'],
            ['zone_enter', isRu ? 'Авто вошло в зону' : 'Vehicle entered zone', isRu ? 'Создаёт ZoneStay (entryTime, zoneId)' : 'Creates ZoneStay (entryTime, zoneId)'],
            ['zone_exit', isRu ? 'Авто покинуло зону' : 'Vehicle left zone', isRu ? 'Завершает ZoneStay (exitTime, duration)' : 'Completes ZoneStay (exitTime, duration)'],
            ['post_enter', isRu ? 'Авто заехало на пост' : 'Vehicle entered post', isRu ? 'Создаёт PostStay, статус поста -> occupied' : 'Creates PostStay, post status -> occupied'],
            ['post_exit', isRu ? 'Авто съехало с поста' : 'Vehicle left post', isRu ? 'Завершает PostStay, статус поста -> free' : 'Completes PostStay, post status -> free'],
            ['work_start', isRu ? 'Начало работы на посту' : 'Work started at post', isRu ? 'PostStay.isActive=true, hasWorker=true, статус -> active_work' : 'PostStay.isActive=true, hasWorker=true, status -> active_work'],
            ['work_end', isRu ? 'Конец работы на посту' : 'Work ended at post', isRu ? 'PostStay.isActive=false, статус -> occupied_no_work' : 'PostStay.isActive=false, status -> occupied_no_work'],
            ['plate_recognized', isRu ? 'Распознан номерной знак' : 'License plate recognized', isRu ? 'Обновляет plateNumber в сессии' : 'Updates plateNumber in session'],
            ['anomaly', isRu ? 'Аномальное событие (нетипичное движение)' : 'Anomaly event (atypical movement)', isRu ? 'Логирование, возможная рекомендация' : 'Logging, possible recommendation'],
          ]}
        />


        {/* ============================================================ */}
        {/* Section 5 — Backend API */}
        {/* ============================================================ */}
        <SectionTitle id="api">{isRu ? '5. Backend API (27 модулей, 80+ эндпоинтов)' : '5. Backend API (27 modules, 80+ endpoints)'}</SectionTitle>
        <P>{isRu
          ? 'Бэкенд реализован на Express 4.21 с 27 модулями маршрутов, организованными по доменным областям. Каждый модуль -- отдельный файл в backend/src/routes/, экспортирующий Express Router. Все маршруты монтируются в index.js с префиксом /api/. Swagger UI доступен на /api-docs (OpenAPI 3.0 спецификация генерируется из JSDoc). Полный список модулей: auth, dashboard, posts, zones, events, sessions, workOrders, recommendations, cameras, users, shifts, data1c, mapLayout, auditLog, predict, postsData, workers, health, push, photos, locations, reportSchedule, monitoring, settings, backup, replay.'
          : 'The backend is implemented on Express 4.21 with 27 route modules organized by domain areas. Each module is a separate file in backend/src/routes/, exporting an Express Router. All routes are mounted in index.js with /api/ prefix. Swagger UI available at /api-docs (OpenAPI 3.0 spec generated from JSDoc). Full module list: auth, dashboard, posts, zones, events, sessions, workOrders, recommendations, cameras, users, shifts, data1c, mapLayout, auditLog, predict, postsData, workers, health, push, photos, locations, reportSchedule, monitoring, settings, backup, replay.'
        }</P>

        <Sub>auth.js -- /api/auth</Sub>
        <Table
          headers={[isRu ? 'Метод' : 'Method', isRu ? 'Путь' : 'Path', 'Auth', isRu ? 'Описание' : 'Description']}
          rows={[
            ['POST', '/api/auth/login', isRu ? 'Нет' : 'No', isRu ? 'Логин: email + password. Rate limit 20/min/IP. Возвращает access token (24ч) + refresh httpOnly cookie (7д) + user object с permissions, pages[], hiddenElements[]' : 'Login: email + password. Rate limit 20/min/IP. Returns access token (24h) + refresh httpOnly cookie (7d) + user object with permissions, pages[], hiddenElements[]'],
            ['POST', '/api/auth/refresh', isRu ? 'Cookie' : 'Cookie', isRu ? 'Обновление access token по refresh cookie. Возвращает новый access token' : 'Refresh access token via refresh cookie. Returns new access token'],
            ['POST', '/api/auth/logout', isRu ? 'Да' : 'Yes', isRu ? 'Выход: очистка refresh cookie' : 'Logout: clears refresh cookie'],
            ['GET', '/api/auth/me', isRu ? 'Да' : 'Yes', isRu ? 'Текущий пользователь с полной информацией о роли, permissions, pages, hiddenElements' : 'Current user with full role info, permissions, pages, hiddenElements'],
            ['POST', '/api/auth/register', isRu ? 'Да (admin)' : 'Yes (admin)', isRu ? 'Регистрация нового пользователя (только admin)' : 'Register new user (admin only)'],
          ]}
        />

        <Sub>dashboard.js -- /api/dashboard</Sub>
        <Table
          headers={[isRu ? 'Метод' : 'Method', isRu ? 'Путь' : 'Path', 'Auth', isRu ? 'Описание' : 'Description']}
          rows={[
            ['GET', '/api/dashboard/overview', isRu ? 'Да' : 'Yes', isRu ? 'Общая статистика: количество авто на СТО, занятые/свободные посты, активные ЗН' : 'Overview stats: vehicles at STO, occupied/free posts, active WOs'],
            ['GET', '/api/dashboard/metrics?period=24h|7d|30d', isRu ? 'Да' : 'Yes', isRu ? 'Метрики за период: среднее время ремонта, загрузка, throughput' : 'Period metrics: avg repair time, utilization, throughput'],
            ['GET', '/api/dashboard/trends', isRu ? 'Да' : 'Yes', isRu ? 'Тренды: графики загрузки и активности по часам/дням' : 'Trends: utilization and activity charts by hours/days'],
            ['GET', '/api/dashboard/live', isRu ? 'Да' : 'Yes', isRu ? 'Live-данные: текущее состояние всех постов и зон для Dashboard' : 'Live data: current state of all posts and zones for Dashboard'],
          ]}
        />

        <Sub>posts.js -- /api/posts</Sub>
        <Table
          headers={[isRu ? 'Метод' : 'Method', isRu ? 'Путь' : 'Path', 'Auth', isRu ? 'Описание' : 'Description']}
          rows={[
            ['GET', '/api/posts', isRu ? 'Да' : 'Yes', isRu ? 'Все посты с текущим статусом, зоной и связями' : 'All posts with current status, zone and relations'],
            ['GET', '/api/posts/:id', isRu ? 'Да' : 'Yes', isRu ? 'Конкретный пост с детальной информацией' : 'Specific post with detailed info'],
            ['POST', '/api/posts', isRu ? 'Да (manage_zones)' : 'Yes (manage_zones)', isRu ? 'Создание поста (name, type, zoneId)' : 'Create post (name, type, zoneId)'],
            ['PUT', '/api/posts/:id', isRu ? 'Да (manage_zones)' : 'Yes (manage_zones)', isRu ? 'Обновление поста (name, type, status, zoneId)' : 'Update post (name, type, status, zoneId)'],
            ['DELETE', '/api/posts/:id', isRu ? 'Да (manage_zones)' : 'Yes (manage_zones)', isRu ? 'Удаление поста' : 'Delete post'],
          ]}
        />

        <Sub>zones.js -- /api/zones</Sub>
        <Table
          headers={[isRu ? 'Метод' : 'Method', isRu ? 'Путь' : 'Path', 'Auth', isRu ? 'Описание' : 'Description']}
          rows={[
            ['GET', '/api/zones', isRu ? 'Да' : 'Yes', isRu ? 'Все зоны (5 типов: repair, waiting, entry, parking, free)' : 'All zones (5 types: repair, waiting, entry, parking, free)'],
            ['GET', '/api/zones/:id', isRu ? 'Да' : 'Yes', isRu ? 'Конкретная зона с постами и камерами' : 'Specific zone with posts and cameras'],
            ['POST', '/api/zones', isRu ? 'Да (manage_zones)' : 'Yes (manage_zones)', isRu ? 'Создание зоны' : 'Create zone'],
            ['PUT', '/api/zones/:id', isRu ? 'Да (manage_zones)' : 'Yes (manage_zones)', isRu ? 'Обновление зоны' : 'Update zone'],
            ['DELETE', '/api/zones/:id', isRu ? 'Да (manage_zones)' : 'Yes (manage_zones)', isRu ? 'Удаление зоны (soft delete)' : 'Delete zone (soft delete)'],
          ]}
        />

        <Sub>events.js -- /api/events</Sub>
        <Table
          headers={[isRu ? 'Метод' : 'Method', isRu ? 'Путь' : 'Path', 'Auth', isRu ? 'Описание' : 'Description']}
          rows={[
            ['POST', '/api/events', isRu ? 'НЕТ (для CV)' : 'NO (for CV)', isRu ? 'Приём CV-событий. Без авторизации! Тело: { type, plateNumber?, zoneId?, postId?, confidence, cameraSources }. Передаётся в EventProcessor' : 'Receive CV events. No auth! Body: { type, plateNumber?, zoneId?, postId?, confidence, cameraSources }. Passed to EventProcessor'],
            ['GET', '/api/events', isRu ? 'Да' : 'Yes', isRu ? 'Журнал событий с фильтрами: ?type=, ?zoneId=, ?postId=, ?from=, ?to=, ?page=, ?limit=' : 'Event log with filters: ?type=, ?zoneId=, ?postId=, ?from=, ?to=, ?page=, ?limit='],
            ['GET', '/api/events/:id', isRu ? 'Да' : 'Yes', isRu ? 'Конкретное событие с деталями' : 'Specific event with details'],
          ]}
        />

        <Sub>sessions.js -- /api/sessions</Sub>
        <Table
          headers={[isRu ? 'Метод' : 'Method', isRu ? 'Путь' : 'Path', 'Auth', isRu ? 'Описание' : 'Description']}
          rows={[
            ['GET', '/api/sessions/active', isRu ? 'Да' : 'Yes', isRu ? 'Активные сессии (status=active) с ZoneStay, PostStay, Events' : 'Active sessions (status=active) with ZoneStay, PostStay, Events'],
            ['GET', '/api/sessions/completed', isRu ? 'Да' : 'Yes', isRu ? 'Завершённые сессии с фильтрами по дате и номеру' : 'Completed sessions with date and plate filters'],
            ['GET', '/api/sessions/:id', isRu ? 'Да' : 'Yes', isRu ? 'Детали сессии с полной историей перемещений' : 'Session details with full movement history'],
          ]}
        />

        <Sub>workOrders.js -- /api/work-orders</Sub>
        <Table
          headers={[isRu ? 'Метод' : 'Method', isRu ? 'Путь' : 'Path', 'Auth', isRu ? 'Описание' : 'Description']}
          rows={[
            ['GET', '/api/work-orders', isRu ? 'Да' : 'Yes', isRu ? 'Все ЗН с фильтрами: ?status=, ?postId=, ?from=, ?to=' : 'All WOs with filters: ?status=, ?postId=, ?from=, ?to='],
            ['GET', '/api/work-orders/:id', isRu ? 'Да' : 'Yes', isRu ? 'Детали ЗН с WorkOrderLink' : 'WO details with WorkOrderLink'],
            ['POST', '/api/work-orders', isRu ? 'Да (manage_work_orders)' : 'Yes (manage_work_orders)', isRu ? 'Создание ЗН (orderNumber, description, normHours, postId)' : 'Create WO (orderNumber, description, normHours, postId)'],
            ['POST', '/api/work-orders/import', isRu ? 'Да (manage_work_orders)' : 'Yes (manage_work_orders)', isRu ? 'CSV-импорт массива ЗН' : 'CSV import of WO array'],
            ['POST', '/api/work-orders/schedule', isRu ? 'Да (manage_work_orders)' : 'Yes (manage_work_orders)', isRu ? 'Batch-обновление расписания с оптимистичной блокировкой (version). HTTP 409 при конфликте' : 'Batch schedule update with optimistic locking (version). HTTP 409 on conflict'],
            ['PUT', '/api/work-orders/:id', isRu ? 'Да (manage_work_orders)' : 'Yes (manage_work_orders)', isRu ? 'Обновление ЗН' : 'Update WO'],
            ['POST', '/api/work-orders/:id/start', isRu ? 'Да' : 'Yes', isRu ? 'Начать работу (status -> in_progress, startedAt = now)' : 'Start work (status -> in_progress, startedAt = now)'],
            ['POST', '/api/work-orders/:id/pause', isRu ? 'Да' : 'Yes', isRu ? 'Пауза (status -> paused, pausedAt = now)' : 'Pause (status -> paused, pausedAt = now)'],
            ['POST', '/api/work-orders/:id/resume', isRu ? 'Да' : 'Yes', isRu ? 'Возобновить (status -> in_progress, totalPausedMs += diff)' : 'Resume (status -> in_progress, totalPausedMs += diff)'],
            ['POST', '/api/work-orders/:id/complete', isRu ? 'Да' : 'Yes', isRu ? 'Завершить (status -> completed, completedAt = now)' : 'Complete (status -> completed, completedAt = now)'],
            ['DELETE', '/api/work-orders/:id', isRu ? 'Да (manage_work_orders)' : 'Yes (manage_work_orders)', isRu ? 'Удаление ЗН' : 'Delete WO'],
          ]}
        />

        <Sub>cameras.js -- /api/cameras</Sub>
        <Table
          headers={[isRu ? 'Метод' : 'Method', isRu ? 'Путь' : 'Path', 'Auth', isRu ? 'Описание' : 'Description']}
          rows={[
            ['GET', '/api/cameras', isRu ? 'Да' : 'Yes', isRu ? 'Все камеры (10) с зонами и статусом здоровья' : 'All cameras (10) with zones and health status'],
            ['GET', '/api/cameras/:id', isRu ? 'Да' : 'Yes', isRu ? 'Конкретная камера с CameraZone маппингом' : 'Specific camera with CameraZone mapping'],
            ['POST', '/api/cameras', isRu ? 'Да (manage_cameras)' : 'Yes (manage_cameras)', isRu ? 'Создание камеры (name, rtspUrl)' : 'Create camera (name, rtspUrl)'],
            ['PUT', '/api/cameras/:id', isRu ? 'Да (manage_cameras)' : 'Yes (manage_cameras)', isRu ? 'Обновление камеры' : 'Update camera'],
            ['DELETE', '/api/cameras/:id', isRu ? 'Да (manage_cameras)' : 'Yes (manage_cameras)', isRu ? 'Удаление камеры' : 'Delete camera'],
            ['GET', '/api/cameras/health', isRu ? 'Да' : 'Yes', isRu ? 'Статус здоровья всех камер (online/offline)' : 'Health status of all cameras (online/offline)'],
            ['PUT', '/api/cameras/:id/zones', isRu ? 'Да (manage_cameras)' : 'Yes (manage_cameras)', isRu ? 'Обновление маппинга зон для камеры с приоритетами (0-10)' : 'Update zone mapping for camera with priorities (0-10)'],
          ]}
        />

        <Sub>{isRu ? 'Остальные модули' : 'Remaining Modules'}</Sub>
        <Table
          headers={[isRu ? 'Модуль' : 'Module', isRu ? 'Путь' : 'Path', isRu ? 'Ключевые эндпоинты' : 'Key Endpoints']}
          rows={[
            ['recommendations', '/api/recommendations', 'GET / (active), PUT /:id/acknowledge'],
            ['users', '/api/users', isRu ? 'GET / (список), GET /:id, POST / (create), PUT /:id (update + pages + hiddenElements), DELETE /:id, PUT /:id/role' : 'GET / (list), GET /:id, POST / (create), PUT /:id (update + pages + hiddenElements), DELETE /:id, PUT /:id/role'],
            ['shifts', '/api/shifts', isRu ? 'GET /, POST / (create + conflict detection), PUT /:id, DELETE /:id, POST /:id/workers (assign), POST /:id/complete' : 'GET /, POST / (create + conflict detection), PUT /:id, DELETE /:id, POST /:id/workers (assign), POST /:id/complete'],
            ['data1c', '/api/1c', isRu ? 'POST /import (XLSX upload), GET /planning, GET /workers, GET /stats, GET /sync-history, POST /export (XLSX download)' : 'POST /import (XLSX upload), GET /planning, GET /workers, GET /stats, GET /sync-history, POST /export (XLSX download)'],
            ['mapLayout', '/api/map-layout', isRu ? 'GET / (current), POST / (save + version), GET /versions, POST /restore/:versionId' : 'GET / (current), POST / (save + version), GET /versions, POST /restore/:versionId'],
            ['auditLog', '/api/audit-log', isRu ? 'GET / (фильтры: user, action, entity, date, page, limit), GET /export/csv' : 'GET / (filters: user, action, entity, date, page, limit), GET /export/csv'],
            ['predict', '/api/predict', isRu ? 'GET /load, GET /load/week, GET /duration, GET /free, GET /health (детерминированный seed)' : 'GET /load, GET /load/week, GET /duration, GET /free, GET /health (deterministic seed)'],
            ['postsData', '/api/posts-analytics, /api/dashboard-posts, /api/analytics-history', isRu ? 'Аналитика постов, агрегации, дневные разбивки, история' : 'Post analytics, aggregations, daily breakdowns, history'],
            ['workers', '/api/workers', isRu ? 'GET / (список работников), GET /:id/stats (daily breakdown по ЗН)' : 'GET / (worker list), GET /:id/stats (daily breakdown by WOs)'],
            ['health', '/api/system-health', isRu ? 'GET / (admin only): backend, database, cameras, disk status, uptime, memory' : 'GET / (admin only): backend, database, cameras, disk status, uptime, memory'],
            ['push', '/api/push', isRu ? 'GET /vapid-key, POST /subscribe (endpoint + keys), POST /send (title + body + target)' : 'GET /vapid-key, POST /subscribe (endpoint + keys), POST /send (title + body + target)'],
            ['photos', '/api/photos', isRu ? 'POST / (base64 upload), GET /?postId= (gallery), DELETE /:id' : 'POST / (base64 upload), GET /?postId= (gallery), DELETE /:id'],
            ['locations', '/api/locations', isRu ? 'CRUD: GET /, POST /, PUT /:id, DELETE /:id (мультитенантность)' : 'CRUD: GET /, POST /, PUT /:id, DELETE /:id (multi-tenancy)'],
            ['reportSchedule', '/api/report-schedules', isRu ? 'CRUD + POST /:id/run (генерация XLSX + отправка в Telegram)' : 'CRUD + POST /:id/run (generate XLSX + send to Telegram)'],
            ['monitoring', '/api/monitoring', isRu ? 'GET /state, GET /cameras, GET /state/:zoneName, GET /raw, GET /history (диапазон), GET /zone-history/:zoneName, GET /post-history/:postNumber, GET /full-history, GET /db-stats, GET /db-current (hydrate state), GET /health' : 'GET /state, GET /cameras, GET /state/:zoneName, GET /raw, GET /history (range), GET /zone-history/:zoneName, GET /post-history/:postNumber, GET /full-history, GET /db-stats, GET /db-current (hydrate state), GET /health'],
            ['settings', '/api/settings', isRu ? 'GET /mode, PUT /mode { mode: "demo" | "live" }. Триггерит/останавливает demo-генератор и MonitoringProxy. Эмитит settings:changed' : 'GET /mode, PUT /mode { mode: "demo" | "live" }. Triggers/stops demo generator and MonitoringProxy. Emits settings:changed'],
            ['backup', '/api/backup', isRu ? 'GET / (список снимков БД), POST / (создать снимок вручную через VACUUM INTO). Только admin' : 'GET / (DB snapshot list), POST / (manual snapshot via VACUUM INTO). Admin only'],
            ['replay', '/api/replay', isRu ? 'GET /range (доступный диапазон истории: minTime, maxTime), GET /window?from=&to=&step= (агрегированные снапшоты для воспроизведения)' : 'GET /range (available history range: minTime, maxTime), GET /window?from=&to=&step= (aggregated snapshots for playback)'],
          ]}
        />


        {/* ============================================================ */}
        {/* Section 6 — Backend Services */}
        {/* ============================================================ */}
        <SectionTitle id="services">{isRu ? '6. Backend Services (11 фоновых сервисов)' : '6. Backend Services (11 background services)'}</SectionTitle>
        <P>{isRu
          ? 'Одиннадцать фоновых сервисов запускаются при старте бэкенда (index.js) и работают параллельно с Express. Каждый сервис работает автономно со своим интервалом или триггером. Запуск некоторых сервисов условный: TelegramBot стартует только при наличии TELEGRAM_BOT_TOKEN, MonitoringProxy -- при заданном MONITORING_API_URL, ReportScheduler -- при наличии активных ReportSchedule.'
          : 'Eleven background services start with the backend (index.js) and run in parallel with Express. Each service operates autonomously with its own interval or trigger. Some services start conditionally: TelegramBot only when TELEGRAM_BOT_TOKEN is set, MonitoringProxy when MONITORING_API_URL is configured, ReportScheduler when active ReportSchedules exist.'
        }</P>
        <Table
          headers={[isRu ? 'Сервис' : 'Service', isRu ? 'Файл' : 'File', 'LOC', isRu ? 'Триггер' : 'Trigger', isRu ? 'Что делает' : 'What it does']}
          rows={[
            ['EventProcessor', 'eventProcessor.js', '308', 'POST /api/events', isRu ? 'Обработка 10 типов CV-событий -> сессии, статусы постов, Socket.IO broadcast' : 'Processes 10 CV event types -> sessions, post statuses, Socket.IO broadcast'],
            ['RecommendationEngine', 'recommendationEngine.js', '~200', isRu ? 'Периодический (30с)' : 'Periodic (30s)', isRu ? '5 проверок: post_free (>30м), overtime (>120%), idle (>15м), capacity, no_show' : '5 checks: post_free (>30m), overtime (>120%), idle (>15m), capacity, no_show'],
            ['MonitoringProxy', 'monitoringProxy.js', '340', isRu ? 'Polling (10с)' : 'Polling (10s)', isRu ? 'Получает состояние зон/постов от внешнего CV API для live-мониторинга' : 'Fetches zone/post state from external CV API for live monitoring'],
            ['CameraHealthCheck', 'cameraHealthCheck.js', '~80', isRu ? 'Каждые 30с' : 'Every 30s', isRu ? 'Пинг RTSP-камер, обновление isActive, Socket.IO camera:status' : 'Pings RTSP cameras, updates isActive, Socket.IO camera:status'],
            ['Sync1C', 'sync1C.js', '~250', isRu ? 'File watcher' : 'File watcher', isRu ? 'Мониторинг /data/1c-import/, парсинг XLSX, дедупликация, JSON-генерация, SyncLog' : 'Monitors /data/1c-import/, XLSX parsing, deduplication, JSON generation, SyncLog'],
            ['TelegramBot', 'telegramBot.js', '~150', isRu ? 'Команды бота' : 'Bot commands', isRu ? '5 команд: /start, /status, /post, /free, /report. Доставка автоотчётов' : '5 commands: /start, /status, /post, /free, /report. Auto-report delivery'],
            ['ReportScheduler', 'reportScheduler.js', '~120', isRu ? 'node-cron (каждую минуту)' : 'node-cron (every minute)', isRu ? 'Проверяет ReportSchedule, генерирует XLSX, отправляет в Telegram' : 'Checks ReportSchedule, generates XLSX, sends to Telegram'],
            ['ServerExport', 'serverExport.js', '~100', isRu ? 'Вызов из routes' : 'Called from routes', isRu ? 'Утилиты серверной генерации XLSX (используется ReportScheduler и routes)' : 'Server-side XLSX generation utilities (used by ReportScheduler and routes)'],
            ['BackupScheduler', 'backupScheduler.js', '~120', isRu ? 'node-cron (по расписанию)' : 'node-cron (scheduled)', isRu ? 'Регулярные снимки SQLite через VACUUM INTO в /project/backend/prisma/backups/. Ротация старых файлов по количеству и размеру' : 'Regular SQLite snapshots via VACUUM INTO into /project/backend/prisma/backups/. Old file rotation by count and size'],
            ['MapSyncService', 'mapSyncService.js', '~100', isRu ? 'Socket.IO + сохранение' : 'Socket.IO + persist', isRu ? 'Синхронизация карты СТО между клиентами в реальном времени: при сохранении в одном MapEditor другие клиенты получают обновление через Socket.IO' : 'Real-time STO map sync between clients: when saved in one MapEditor, other clients receive update via Socket.IO'],
            ['RetentionCleaner', 'retentionCleaner.js', '~80', isRu ? 'Периодически (часы)' : 'Periodic (hours)', isRu ? 'Удаление старых записей MonitoringSnapshot и Event по retention-окну. Защита от бесконечного роста БД при работе в live-режиме' : 'Deletion of old MonitoringSnapshot and Event records by retention window. Protection against infinite DB growth in live mode'],
          ]}
        />

        <Sub>EventProcessor ({isRu ? 'детально' : 'detailed'})</Sub>
        <P>{isRu
          ? 'EventProcessor (308 строк) -- ключевой сервис. При получении события из CV-системы через POST /api/events, он: (1) создаёт запись Event в БД с привязкой к зоне/посту/камере; (2) находит или создаёт VehicleSession по plateNumber/trackId; (3) создаёт/завершает ZoneStay или PostStay в зависимости от типа события; (4) обновляет status поста (free -> occupied -> active_work -> occupied_no_work); (5) эмитит Socket.IO события: post:status_changed, event, zone:update, post:update. Все операции выполняются в одной Prisma-транзакции для атомарности.'
          : 'EventProcessor (308 LOC) is the key service. On receiving an event from CV via POST /api/events, it: (1) creates an Event record in DB linked to zone/post/camera; (2) finds or creates VehicleSession by plateNumber/trackId; (3) creates/completes ZoneStay or PostStay based on event type; (4) updates post status (free -> occupied -> active_work -> occupied_no_work); (5) emits Socket.IO events: post:status_changed, event, zone:update, post:update. All operations run in a single Prisma transaction for atomicity.'
        }</P>

        <Sub>RecommendationEngine ({isRu ? 'детально' : 'detailed'})</Sub>
        <P>{isRu
          ? 'Движок рекомендаций периодически (каждые 30 секунд) сканирует состояние всех постов и генерирует 5 типов алертов:'
          : 'The recommendation engine periodically (every 30 seconds) scans all post states and generates 5 alert types:'
        }</P>
        <Table
          headers={[isRu ? 'Тип' : 'Type', isRu ? 'Условие' : 'Condition', isRu ? 'Действие' : 'Action']}
          rows={[
            ['post_free', isRu ? 'Пост свободен > 30 минут при наличии авто в очереди' : 'Post free > 30 min while vehicles are queued', isRu ? 'Рекомендация направить авто на свободный пост' : 'Recommend directing vehicle to free post'],
            ['overtime', isRu ? 'Работа на посту > 120% нормативного времени' : 'Post work > 120% of norm time', isRu ? 'Предупреждение о превышении нормо-часов' : 'Warning about norm hours exceeded'],
            ['idle', isRu ? 'Работник простаивает > 15 минут (пост occupied, но нет active_work)' : 'Worker idle > 15 min (post occupied, no active_work)', isRu ? 'Рекомендация проверить ситуацию на посту' : 'Recommend checking post situation'],
            ['capacity', isRu ? 'Зона достигла максимальной загрузки' : 'Zone reached maximum capacity', isRu ? 'Предупреждение о перегрузке зоны' : 'Zone overload warning'],
            ['no_show', isRu ? 'Запланированный автомобиль не прибыл в назначенное время' : 'Scheduled vehicle did not arrive at appointed time', isRu ? 'Рекомендация перераспределить пост' : 'Recommend reassigning post'],
          ]}
        />
        <P>{isRu
          ? 'Каждая рекомендация создаётся с двуязычным текстом (message / messageEn) и статусом active. Рекомендации транслируются через Socket.IO (событие recommendation) и отображаются на Dashboard. Пользователь может подтвердить рекомендацию через PUT /api/recommendations/:id/acknowledge, после чего статус меняется на acknowledged.'
          : 'Each recommendation is created with bilingual text (message / messageEn) and active status. Recommendations are broadcast via Socket.IO (recommendation event) and displayed on Dashboard. User can acknowledge via PUT /api/recommendations/:id/acknowledge, changing status to acknowledged.'
        }</P>

        <Sub>MonitoringProxy ({isRu ? 'детально' : 'detailed'})</Sub>
        <P>{isRu
          ? 'MonitoringProxy (340 строк) обеспечивает live-режим мониторинга. Каждые 10 секунд он опрашивает внешний CV API, получая текущее состояние зон и постов (номерные знаки, статусы, время пребывания). Полученные данные: (1) маппятся на внутреннюю модель системы; (2) сохраняются в MonitoringCurrent (текущее состояние, one-row table) -- используется при гидратации после рестарта; (3) сохраняются в MonitoringSnapshot (история) -- используется replay-режимом и историческими эндпоинтами /api/monitoring/history*; (4) транслируются через Socket.IO. Доступны через эндпоинты /api/monitoring/* и /api/replay/*. Переключение между demo и live режимами осуществляется через PUT /api/settings/mode.'
          : 'MonitoringProxy (340 LOC) provides live monitoring mode. Every 10 seconds it polls an external CV API, getting current zone and post state (license plates, statuses, stay durations). The received data is: (1) mapped to the internal system model; (2) stored in MonitoringCurrent (current state, one-row table) -- used for hydration after restart; (3) stored in MonitoringSnapshot (history) -- used by replay mode and historical /api/monitoring/history* endpoints; (4) broadcast via Socket.IO. Available via /api/monitoring/* and /api/replay/* endpoints. Switching between demo and live modes is done via PUT /api/settings/mode.'
        }</P>

        <Sub>BackupScheduler & RetentionCleaner ({isRu ? 'детально' : 'detailed'})</Sub>
        <P>{isRu
          ? 'BackupScheduler по cron-расписанию выполняет SQLite-команду VACUUM INTO, создавая консистентный снимок БД даже под нагрузкой (без блокировки писателей благодаря WAL). Снимки сохраняются в /project/backend/prisma/backups/ с timestamp в имени файла. Ротация: при превышении лимита по количеству или общему размеру старые файлы удаляются. RetentionCleaner работает синхронно с этим: периодически удаляет записи MonitoringSnapshot старше N дней (зависит от настроек) и старые записи Event, чтобы БД не разрасталась бесконечно. Эти два сервиса работают независимо и обеспечивают долговечность системы при непрерывной работе в live-режиме.'
          : 'BackupScheduler runs SQLite VACUUM INTO on cron schedule, creating a consistent DB snapshot even under load (without blocking writers thanks to WAL). Snapshots are stored in /project/backend/prisma/backups/ with timestamp in filename. Rotation: when exceeding count or total size limit, old files are deleted. RetentionCleaner works in tandem: periodically deletes MonitoringSnapshot records older than N days (config-dependent) and old Event records, so the DB does not grow infinitely. These two services work independently and ensure system longevity in continuous live mode operation.'
        }</P>


        {/* ============================================================ */}
        {/* Section 7 — Middleware */}
        {/* ============================================================ */}
        <SectionTitle id="middleware">{isRu ? '7. Middleware' : '7. Middleware'}</SectionTitle>
        <P>{isRu
          ? 'Четыре middleware модуля обеспечивают авторизацию, аудит, валидацию и обработку ошибок для всех API-маршрутов.'
          : 'Four middleware modules provide authorization, auditing, validation, and error handling for all API routes.'
        }</P>

        <Sub>auth.js -- {isRu ? 'JWT аутентификация' : 'JWT Authentication'}</Sub>
        <P>{isRu
          ? 'authenticate() -- основной middleware. Извлекает JWT из заголовка Authorization: Bearer <token>, верифицирует подпись (jwt.verify с JWT_SECRET), загружает пользователя из Prisma с ролью и разрешениями. Результат кешируется на 15 минут (authCache.js) чтобы избежать повторных запросов к БД при каждом API-вызове. При истечении или невалидном токене -- HTTP 401. requirePermission(...keys) -- обёртка вокруг authenticate(), дополнительно проверяет наличие всех указанных разрешений у пользователя. При отсутствии любого -- HTTP 403.'
          : 'authenticate() -- main middleware. Extracts JWT from Authorization: Bearer <token> header, verifies signature (jwt.verify with JWT_SECRET), loads user from Prisma with role and permissions. Result is cached for 15 minutes (authCache.js) to avoid repeated DB queries on each API call. On expired or invalid token -- HTTP 401. requirePermission(...keys) -- wrapper around authenticate(), additionally checks that user has all specified permissions. If any missing -- HTTP 403.'
        }</P>
        <Code>{`// ${isRu ? 'Использование в маршрутах' : 'Usage in routes'}
router.get('/api/users', authenticate, requirePermission('manage_users'), handler);
router.post('/api/events', handler);  // ${isRu ? 'БЕЗ auth -- для CV-системы' : 'NO auth -- for CV system'}

// ${isRu ? 'Кеширование: authCache (Map<token, { user, expires }>)' : 'Caching: authCache (Map<token, { user, expires }>)'}
// TTL: 15 ${isRu ? 'минут. Сброс при logout или изменении пользователя' : 'minutes. Reset on logout or user change'}`}</Code>

        <Sub>auditLog.js -- {isRu ? 'Аудит мутаций' : 'Mutation Audit'}</Sub>
        <P>{isRu
          ? 'Middleware перехватывает ответ (res.json) на мутирующих маршрутах (POST, PUT, DELETE). Сравнивает oldData (состояние до операции) с newData (после) и записывает AuditLog в БД: action (create/update/delete), entity (тип сущности: user, post, workOrder...), entityId, oldData (JSON), newData (JSON), userId, ip, userAgent. Индексируется по userId, action, entity, createdAt для быстрого поиска. Доступен через GET /api/audit-log с фильтрами и CSV-экспортом.'
          : 'Middleware intercepts response (res.json) on mutating routes (POST, PUT, DELETE). Compares oldData (state before operation) with newData (after) and writes AuditLog to DB: action (create/update/delete), entity (entity type: user, post, workOrder...), entityId, oldData (JSON), newData (JSON), userId, ip, userAgent. Indexed by userId, action, entity, createdAt for fast lookups. Available via GET /api/audit-log with filters and CSV export.'
        }</P>

        <Sub>validate.js -- Zod {isRu ? 'валидация' : 'validation'}</Sub>
        <P>{isRu
          ? 'validate(schema) принимает Zod-схему и возвращает middleware, который валидирует req.body. При невалидных данных -- HTTP 400 с подробными ошибками (path, message для каждого поля). Zod 4.3 используется для строгой типизации на бэкенде: строки, числа, enum, optional, default, массивы. Пример: z.object({ email: z.string().email(), password: z.string().min(6) }).'
          : 'validate(schema) takes a Zod schema and returns middleware that validates req.body. On invalid data -- HTTP 400 with detailed errors (path, message for each field). Zod 4.3 is used for strict backend typing: strings, numbers, enums, optional, defaults, arrays. Example: z.object({ email: z.string().email(), password: z.string().min(6) }).'
        }</P>

        <Sub>asyncHandler.js -- {isRu ? 'Обработка ошибок' : 'Error Handling'}</Sub>
        <P>{isRu
          ? 'asyncHandler(fn) оборачивает async route handlers в try/catch. Ловит все ошибки, включая Prisma-специфичные: P2025 (Record not found) автоматически конвертируется в HTTP 404 с понятным сообщением. Все остальные ошибки -- HTTP 500. Это устраняет необходимость писать try/catch в каждом handler и обеспечивает единообразную обработку ошибок.'
          : 'asyncHandler(fn) wraps async route handlers in try/catch. Catches all errors, including Prisma-specific: P2025 (Record not found) is automatically converted to HTTP 404 with a clear message. All other errors become HTTP 500. This eliminates the need for try/catch in every handler and ensures uniform error handling.'
        }</P>


        {/* ============================================================ */}
        {/* Section 8 — Socket.IO */}
        {/* ============================================================ */}
        <SectionTitle id="socketio">{isRu ? '8. Socket.IO' : '8. Socket.IO'}</SectionTitle>
        <P>{isRu
          ? 'Socket.IO обеспечивает real-time коммуникацию между бэкендом и фронтендом. Подключение инициализируется на фронтенде через connectSocket(token) из useSocket hook. Токен передаётся как auth параметр для аутентификации подключения. Socket.IO настроен на обоих серверах Express (HTTP :3001 и HTTPS :443), путь /socket.io/* обслуживается тем же Express-процессом БЕЗ reverse proxy. Это исключает классическую проблему проксирования WebSocket через Nginx (заголовки Upgrade, Connection, version 1.1).'
          : 'Socket.IO provides real-time communication between backend and frontend. Connection is initialized on the frontend via connectSocket(token) from useSocket hook. Token is passed as auth parameter for connection authentication. Socket.IO is configured on both Express servers (HTTP :3001 and HTTPS :443), path /socket.io/* is served by the same Express process WITHOUT reverse proxy. This avoids the classic WebSocket-through-Nginx proxying problem (Upgrade, Connection, version 1.1 headers).'
        }</P>

        <Sub>{isRu ? 'Клиент -> Сервер' : 'Client -> Server'}</Sub>
        <Table
          headers={[isRu ? 'Событие' : 'Event', isRu ? 'Данные' : 'Data', isRu ? 'Описание' : 'Description']}
          rows={[
            ['subscribe:zone', '{ zoneId }', isRu ? 'Подписка на обновления конкретной зоны (MapViewer, Dashboard)' : 'Subscribe to specific zone updates (MapViewer, Dashboard)'],
            ['subscribe:post', '{ postId }', isRu ? 'Подписка на обновления конкретного поста (MyPost, PostsDetail)' : 'Subscribe to specific post updates (MyPost, PostsDetail)'],
            ['subscribe:all', isRu ? 'Нет данных' : 'No data', isRu ? 'Подписка на все обновления (Dashboard, DashboardPosts)' : 'Subscribe to all updates (Dashboard, DashboardPosts)'],
          ]}
        />

        <Sub>{isRu ? 'Сервер -> Клиент' : 'Server -> Client'}</Sub>
        <Table
          headers={[isRu ? 'Событие' : 'Event', isRu ? 'Данные' : 'Data', isRu ? 'Источник' : 'Source', isRu ? 'Описание' : 'Description']}
          rows={[
            ['post:status_changed', '{ postId, status, plateNumber?, workOrderId? }', 'EventProcessor', isRu ? 'Изменение статуса поста (free/occupied/occupied_no_work/active_work)' : 'Post status change (free/occupied/occupied_no_work/active_work)'],
            ['post:update', '{ post }', 'EventProcessor', isRu ? 'Полное обновление данных поста' : 'Full post data update'],
            ['zone:update', '{ zone }', 'EventProcessor', isRu ? 'Обновление данных зоны (количество авто, статус)' : 'Zone data update (vehicle count, status)'],
            ['event', '{ event }', 'EventProcessor', isRu ? 'Новое CV-событие (для журнала Events)' : 'New CV event (for Events log)'],
            ['schedule:updated', '{ workOrders }', 'workOrders route', isRu ? 'Обновление расписания ЗН (DashboardPosts Gantt)' : 'WO schedule update (DashboardPosts Gantt)'],
            ['workOrder:started', '{ workOrder }', 'workOrders route', isRu ? 'Механик начал работу над ЗН' : 'Mechanic started WO work'],
            ['workOrder:completed', '{ workOrder }', 'workOrders route', isRu ? 'ЗН завершён' : 'WO completed'],
            ['camera:status', '{ cameraId, online, lastCheck }', 'CameraHealthCheck', isRu ? 'Изменение статуса камеры (online/offline)' : 'Camera status change (online/offline)'],
            ['recommendation', '{ recommendation }', 'RecommendationEngine', isRu ? 'Новая AI-рекомендация' : 'New AI recommendation'],
            ['settings:changed', '{ settings }', 'settings route', isRu ? 'Изменение системных настроек (demo/live mode)' : 'System settings change (demo/live mode)'],
          ]}
        />

        <Sub>{isRu ? 'Конфигурация подключения' : 'Connection Configuration'}</Sub>
        <Code>{`// ${isRu ? 'Фронтенд: подключение' : 'Frontend: connection'}
import { io } from 'socket.io-client';
const socket = io(API_BASE_URL, {
  auth: { token: jwtToken },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
});

// ${isRu ? 'Бэкенд: настройка (config/socket.js)' : 'Backend: setup (config/socket.js)'}
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/socket.io/',
});
// ${isRu ? 'Тот же Socket.IO attach на HTTPS :443 (один процесс, два сервера)' : 'Same Socket.IO attach on HTTPS :443 (single process, two servers)'}`}</Code>


        {/* ============================================================ */}
        {/* Section 9 — Frontend Pages */}
        {/* ============================================================ */}
        <SectionTitle id="pages">{isRu ? '9. Frontend -- Страницы (23)' : '9. Frontend -- Pages (23)'}</SectionTitle>
        <P>{isRu
          ? 'Все 23 страницы загружаются лениво через React.lazy() и Suspense. Каждая страница -- отдельный файл в frontend/src/pages/. Маршрутизация через HashRouter (React Router v7). Доступ к страницам определяется массивом user.pages[] и проверяется через ProtectedRoute. Файл PostHistory.jsx экспортирует две страницы (default = PostHistory, именованный экспорт ZoneHistory) -- удобный приём чтобы переиспользовать общую логику истории между ракурсами "по посту" и "по зоне" без дублирования кода.'
          : 'All 23 pages are lazy-loaded via React.lazy() and Suspense. Each page is a separate file in frontend/src/pages/. Routing via HashRouter (React Router v7). Page access is determined by user.pages[] array and checked via ProtectedRoute. PostHistory.jsx exports two pages (default = PostHistory, named export ZoneHistory) -- a convenient pattern to reuse common history logic between "by-post" and "by-zone" perspectives without duplicating code.'
        }</P>
        <Table
          headers={[isRu ? 'Страница' : 'Page', isRu ? 'Файл' : 'File', 'LOC', isRu ? 'Маршрут' : 'Route', isRu ? 'Описание' : 'Description', isRu ? 'Источники данных' : 'Data Sources']}
          rows={[
            ['Dashboard', 'Dashboard.jsx', '~400', '/', isRu ? 'KPI-карточки (загрузка, throughput, среднее время), рекомендации, последние события, live-виджет СТО, предсказания' : 'KPI cards (utilization, throughput, avg time), recommendations, recent events, live STO widget, predictions', '/api/dashboard/*, /api/recommendations, Socket.IO polling 5s'],
            ['DashboardPosts', 'DashboardPosts.jsx', '521', '/dashboard-posts', isRu ? 'Gantt-таймлайн ЗН на 10 постах, drag-n-drop перемещение блоков, детекция конфликтов, оптимистичная блокировка, свободные ЗН, настройки смен' : 'Gantt timeline for 10 posts, drag-n-drop block movement, conflict detection, optimistic locking, free WOs, shift settings', '/api/dashboard-posts, /api/work-orders/schedule, Socket.IO schedule:updated'],
            ['PostsDetail', 'PostsDetail.jsx', '226', '/posts-detail', isRu ? 'Master-detail аналитика по постам: список постов (карточки/таблица), детальная панель с 11 виджетами (таймлайн, работники, события, статистика, ЗН, камеры, календарь)' : 'Master-detail post analytics: post list (cards/table), detail panel with 11 widgets (timeline, workers, events, statistics, WOs, cameras, calendar)', '/api/posts-analytics, /api/posts'],
            ['MapViewer', 'MapViewer.jsx', '1442', '/map-view', isRu ? 'Konva live-карта с постами (цвет по статусу), камерами, зонами, счётчиками авто. Клик по элементу показывает popup с деталями. Поддерживает replay-режим (перемотка истории через ReplayPanel) и единую типографику с дашбордом' : 'Konva live map with posts (color by status), cameras, zones, vehicle counters. Click on element shows detail popup. Supports replay mode (history scrubbing via ReplayPanel) and unified typography with dashboard', '/api/map-layout, /api/posts, /api/monitoring/state, /api/replay/*, Socket.IO post:status_changed'],
            ['MapEditor', 'MapEditor.jsx', '1244', '/map-editor', isRu ? 'Полнофункциональный drag-drop редактор: 8 типов элементов, snap-to-grid 10px, resize, rotate, delete, версионирование, undo/redo' : 'Full-featured drag-drop editor: 8 element types, snap-to-grid 10px, resize, rotate, delete, versioning, undo/redo', '/api/map-layout, /api/map-layout/versions'],
            ['Sessions', 'Sessions.jsx', '~250', '/sessions', isRu ? 'Активные и завершённые сессии, QR-код по номеру авто, фильтры по дате/номеру, привязка к ЗН' : 'Active and completed sessions, QR code by plate number, date/plate filters, WO binding', '/api/sessions/active, /api/sessions/completed'],
            ['WorkOrders', 'WorkOrders.jsx', '~350', '/work-orders', isRu ? 'Список ЗН с фильтрами, CSV-импорт, создание/редактирование, start/pause/resume/complete, таймеры' : 'WO list with filters, CSV import, create/edit, start/pause/resume/complete, timers', '/api/work-orders'],
            ['Events', 'Events.jsx', '~300', '/events', isRu ? 'Журнал CV-событий: 10 типов, фильтры (тип, зона, пост, период), автообновление 5с, пагинация' : 'CV event log: 10 types, filters (type, zone, post, period), auto-refresh 5s, pagination', '/api/events'],
            ['Analytics', 'Analytics.jsx', '655', '/analytics', isRu ? 'Grafики Recharts: тренды, рейтинги, план/факт, heatmaps. Экспорт: XLSX (4 листа), PDF, PNG. Фильтры по периоду и постам' : 'Recharts charts: trends, rankings, plan/fact, heatmaps. Export: XLSX (4 sheets), PDF, PNG. Period and post filters', '/api/analytics-history, /api/posts-analytics'],
            ['Data1C', 'Data1C.jsx', '926', '/data-1c', isRu ? 'Импорт XLSX из 1С (drag-drop), просмотр планирования/выработки/статистики, экспорт XLSX, история синхронизации' : '1C XLSX import (drag-drop), view planning/production/stats, XLSX export, sync history', '/api/1c/*'],
            ['Cameras', 'Cameras.jsx', '~250', '/cameras', isRu ? '10 камер, вид по зонам и общий, HLS-стримы через CameraStreamModal, зоны покрытия, статус online/offline' : '10 cameras, zone and all views, HLS streams via CameraStreamModal, coverage zones, online/offline status', '/api/cameras, Socket.IO camera:status'],
            ['Users', 'Users.jsx', '~300', '/users', isRu ? 'CRUD пользователей: создание, редактирование, role assignment, настройка pages[], настройка hiddenElements[], активация/деактивация' : 'User CRUD: create, edit, role assignment, pages[] config, hiddenElements[] config, activation/deactivation', '/api/users'],
            ['Shifts', 'Shifts.jsx', '~250', '/shifts', isRu ? 'Недельное расписание смен: создание, назначение работников на посты, обнаружение конфликтов (перекрытие смен), завершение' : 'Weekly shift schedule: create, assign workers to posts, conflict detection (shift overlap), completion', '/api/shifts'],
            ['Audit', 'Audit.jsx', '~200', '/audit', isRu ? 'Аудит-лог: все мутации (create/update/delete) с old/new data, фильтры по пользователю/действию/сущности/дате, CSV-экспорт' : 'Audit log: all mutations (create/update/delete) with old/new data, filters by user/action/entity/date, CSV export', '/api/audit-log'],
            ['MyPost', 'MyPost.jsx', '~200', '/my-post', isRu ? 'Интерфейс механика: текущий ЗН на посту, таймер (play/pause/complete), история работ, информация о посту' : 'Mechanic interface: current WO at post, timer (play/pause/complete), work history, post info', '/api/work-orders, /api/posts'],
            ['Health', 'Health.jsx', '~150', '/health', isRu ? 'Системный мониторинг (admin only): статус backend, database, cameras, disk usage, uptime, memory' : 'System monitoring (admin only): backend, database, cameras, disk usage, uptime, memory status', '/api/system-health'],
            ['WorkerStats', 'WorkerStats.jsx', '~200', '/worker-stats', isRu ? 'Аналитика по конкретному работнику: daily breakdown по ЗН, графики производительности, сравнение с нормой' : 'Per-worker analytics: daily WO breakdown, performance charts, comparison with norm', '/api/workers/*/stats'],
            ['ReportSchedule', 'ReportSchedule.jsx', '~200', '/report-schedule', isRu ? 'Расписание автоотчётов: CRUD, cron-выражения, тип отчёта, фильтры, Telegram-доставка, ручной запуск' : 'Auto-report schedule: CRUD, cron expressions, report type, filters, Telegram delivery, manual run', '/api/report-schedules'],
            ['Login', 'Login.jsx', '~150', '/login', isRu ? 'Страница авторизации: email + password, ошибки валидации, перенаправление на Dashboard после входа' : 'Auth page: email + password, validation errors, redirect to Dashboard after login', '/api/auth/login'],
            ['LiveDebug', 'LiveDebug.jsx', '~150', '/live-debug', isRu ? 'Отладка live-режима: состояние MonitoringProxy, ответы от внешнего CV API, маппинг статусов, таймстемпы, статистика БД (db-stats)' : 'Live mode debug: MonitoringProxy state, external CV API responses, status mapping, timestamps, DB stats', '/api/monitoring/*'],
            ['PostHistory', 'PostHistory.jsx', '~250', '/post-history/:postNumber, /zone-history/:zoneName', isRu ? 'История поста или зоны: timeline событий, периоды занятости/свободы, агрегаты за период. Один файл, два маршрута через именованный экспорт ZoneHistory' : 'History of a post or zone: events timeline, occupied/free periods, period aggregates. One file, two routes via named export ZoneHistory', '/api/monitoring/post-history/*, /api/monitoring/zone-history/*'],
            ['TechDocs', 'TechDocs.jsx', '~1700', '/tech-docs', isRu ? 'Техническая документация: 26 секций, TOC sidebar, поиск, PDF-экспорт (jsPDF + html2canvas, чанки по 2500px), печать, скролл-трекинг' : 'Technical documentation: 26 sections, TOC sidebar, search, PDF export (jsPDF + html2canvas, 2500px chunks), print, scroll tracking', isRu ? 'Нет API (статический контент)' : 'No API (static content)'],
          ]}
        />


        {/* ============================================================ */}
        {/* Section 10 — Frontend Components */}
        {/* ============================================================ */}
        <SectionTitle id="components">{isRu ? '10. Frontend -- Компоненты (33)' : '10. Frontend -- Components (33)'}</SectionTitle>
        <P>{isRu
          ? '33 компонента разделены на три группы: 20 общих компонентов в components/, 9 файлов в dashboardPosts/ (специфичны для Gantt-таймлайна), и 4 файла в postsDetail/ (специфичны для аналитики постов).'
          : '33 components are split into three groups: 20 shared components in components/, 9 files in dashboardPosts/ (specific to Gantt timeline), and 4 files in postsDetail/ (specific to post analytics).'
        }</P>

        <Sub>{isRu ? 'Общие компоненты (20)' : 'Shared Components (20)'}</Sub>
        <Table
          headers={[isRu ? 'Компонент' : 'Component', 'LOC', isRu ? 'Описание' : 'Description', isRu ? 'Используется в' : 'Used In']}
          rows={[
            ['Layout.jsx', '~100', isRu ? 'Каркас приложения: Header (тема, язык, уведомления, пользователь) + Sidebar + Outlet (дочерний маршрут)' : 'App shell: Header (theme, lang, notifications, user) + Sidebar + Outlet (child route)', isRu ? 'App.jsx (обёртка всех страниц)' : 'App.jsx (wraps all pages)'],
            ['Sidebar.jsx', '~200', isRu ? 'Боковая навигация: фильтрация пунктов по user.pages.includes(pageId), иконки Lucide, active state, collapsible' : 'Side navigation: items filtered by user.pages.includes(pageId), Lucide icons, active state, collapsible', 'Layout.jsx'],
            ['STOMap.jsx', '510', isRu ? 'Konva-карта СТО (read-only): рендерит здания, зоны, посты (цвет по статусу), камеры (FOV), стены, двери, подписи. Слои: buildings, zones, posts, cameras, labels' : 'Konva STO map (read-only): renders buildings, zones, posts (color by status), cameras (FOV), walls, doors, labels. Layers: buildings, zones, posts, cameras, labels', 'MapViewer, LiveSTOWidget'],
            ['HelpButton.jsx', '~80', isRu ? 'Контекстная справка: показывает tooltip/modal с описанием текущей страницы (key из i18n)' : 'Contextual help: shows tooltip/modal with current page description (key from i18n)', isRu ? 'Все страницы' : 'All pages'],
            ['LiveSTOWidget.jsx', '~150', isRu ? 'Мини-карта СТО для Dashboard: упрощённый вид STOMap с текущими статусами постов, авто-обновление' : 'Mini STO map for Dashboard: simplified STOMap view with current post statuses, auto-update', 'Dashboard'],
            ['NotificationCenter.jsx', '~120', isRu ? 'Центр уведомлений в Header: список рекомендаций и алертов, badge с количеством, mark as read' : 'Notification center in Header: recommendations and alerts list, count badge, mark as read', 'Layout (Header)'],
            ['CameraStreamModal.jsx', '~150', isRu ? 'Модальное окно HLS-стрима: HLS.js плеер, выбор камеры, полноэкранный режим, статус online/offline' : 'HLS stream modal: HLS.js player, camera selection, fullscreen, online/offline status', 'Cameras, MapViewer'],
            ['DateRangePicker.jsx', '~100', isRu ? 'Выбор диапазона дат: пресеты (24ч, 7д, 30д, произвольный), иконка Lucide Calendar' : 'Date range picker: presets (24h, 7d, 30d, custom), Lucide Calendar icon', 'Analytics, Events, Audit, WorkOrders'],
            ['DeltaBadge.jsx', '~30', isRu ? 'Бейдж изменения: +12% (зелёный) / -5% (красный) со стрелкой вверх/вниз' : 'Change badge: +12% (green) / -5% (red) with up/down arrow', 'Dashboard, Analytics'],
            ['ErrorBoundary.jsx', '~50', isRu ? 'React Error Boundary: ловит ошибки рендеринга, показывает fallback UI вместо белого экрана' : 'React Error Boundary: catches render errors, shows fallback UI instead of white screen', 'App.jsx'],
            ['LocationSwitcher.jsx', '~80', isRu ? 'Переключатель локаций (мультитенантность): dropdown с списком СТО, текущая локация в Header' : 'Location switcher (multi-tenancy): dropdown with STO list, current location in Header', 'Layout (Header)'],
            ['Pagination.jsx', '~60', isRu ? 'Пагинация: страницы, prev/next, total count, items per page' : 'Pagination: pages, prev/next, total count, items per page', 'Events, Audit, Sessions, WorkOrders'],
            ['PhotoGallery.jsx', '~100', isRu ? 'Галерея фото постов: grid-вид, lightbox, upload (base64), delete' : 'Post photo gallery: grid view, lightbox, upload (base64), delete', 'PostsDetail'],
            ['PostTimer.jsx', '~80', isRu ? 'Визуальный таймер ЗН: круговой прогресс, цвет по warningLevel (green/yellow/red/purple), elapsed time' : 'Visual WO timer: circular progress, color by warningLevel (green/yellow/red/purple), elapsed time', 'MyPost, DashboardPosts'],
            ['PredictionWidget.jsx', '~100', isRu ? 'Виджет предсказаний: загрузка, свободные посты, длительность ремонта (данные из /api/predict)' : 'Prediction widget: load, free posts, repair duration (data from /api/predict)', 'Dashboard'],
            ['QRBadge.jsx', '~50', isRu ? 'QR-код: генерирует QR по номеру авто для быстрого поиска сессии' : 'QR code: generates QR by plate number for quick session lookup', 'Sessions'],
            ['Skeleton.jsx', '~30', isRu ? 'Скелетон-лоадер: анимированные плейсхолдеры при загрузке данных' : 'Skeleton loader: animated placeholders during data loading', isRu ? 'Все страницы (Suspense fallback)' : 'All pages (Suspense fallback)'],
            ['SparkLine.jsx', '~40', isRu ? 'Мини-график (sparkline): маленький line chart без осей для KPI-карточек' : 'Mini chart (sparkline): small line chart without axes for KPI cards', 'Dashboard'],
            ['WeeklyHeatmap.jsx', '~80', isRu ? 'Недельная тепловая карта: загрузка по часам/дням, цветовая шкала (green -> red)' : 'Weekly heatmap: load by hours/days, color scale (green -> red)', 'Analytics'],
            ['ReplayPanel.jsx', '~200', isRu ? 'Панель управления replay-режимом: ползунок времени, кнопки play/pause/step, выбор шага агрегации, диапазона времени. Запрашивает /api/replay/range и /api/replay/window. Используется на MapViewer для перемотки исторического состояния зон/постов' : 'Replay mode control panel: time slider, play/pause/step buttons, aggregation step and time range selectors. Queries /api/replay/range and /api/replay/window. Used on MapViewer for scrubbing historical zone/post state', 'MapViewer'],
          ]}
        />

        <Sub>{isRu ? 'dashboardPosts/ (9 файлов)' : 'dashboardPosts/ (9 files)'}</Sub>
        <Table
          headers={[isRu ? 'Файл' : 'File', isRu ? 'Описание' : 'Description']}
          rows={[
            ['GanttTimeline.jsx', isRu ? 'Основной Gantt-таймлайн: горизонтальная временная шкала с блоками ЗН на 10 постах, drag-n-drop для перемещения/ресайза, зум (1ч/2ч/4ч/8ч), скролл' : 'Main Gantt timeline: horizontal time scale with WO blocks on 10 posts, drag-n-drop for move/resize, zoom (1h/2h/4h/8h), scroll'],
            ['TimelineRow.jsx', isRu ? 'Строка поста в Gantt: отображает блоки ЗН с цветом по статусу, tooltip при наведении, контекстное меню' : 'Post row in Gantt: displays WO blocks with status color, hover tooltip, context menu'],
            ['TimelineHeader.jsx', isRu ? 'Заголовок Gantt: временные метки (часы), текущее время (красная линия), масштаб' : 'Gantt header: time marks (hours), current time (red line), scale'],
            ['WorkOrderModal.jsx', isRu ? 'Модалка создания/редактирования ЗН: номер, описание, нормо-часы, пост, время начала/конца, приоритет' : 'WO create/edit modal: number, description, norm hours, post, start/end time, priority'],
            ['ConflictModal.jsx', isRu ? 'Модалка конфликта: показывает conflicts[] от HTTP 409, позволяет перезаписать или обновить свои данные' : 'Conflict modal: shows conflicts[] from HTTP 409, allows overwrite or refresh own data'],
            ['FreeWorkOrdersTable.jsx', isRu ? 'Таблица свободных (unscheduled) ЗН: drag source для размещения на Gantt, фильтры' : 'Free (unscheduled) WO table: drag source for placing on Gantt, filters'],
            ['ShiftSettings.jsx', isRu ? 'Настройки смен в контексте Gantt: временные границы смены, привязанные работники' : 'Shift settings in Gantt context: shift time boundaries, assigned workers'],
            ['Legend.jsx', isRu ? 'Легенда статусов ЗН: цветовые обозначения (pending, scheduled, in_progress, paused, completed)' : 'WO status legend: color codes (pending, scheduled, in_progress, paused, completed)'],
            ['constants.js', isRu ? 'Константы: цвета статусов, высота строки, масштабы зума, границы drag-n-drop' : 'Constants: status colors, row height, zoom scales, drag-n-drop boundaries'],
          ]}
        />

        <Sub>{isRu ? 'postsDetail/ (4 файла)' : 'postsDetail/ (4 files)'}</Sub>
        <Table
          headers={[isRu ? 'Файл' : 'File', isRu ? 'Описание' : 'Description']}
          rows={[
            ['PostDetailPanel.jsx', isRu ? 'Детальная панель поста: 11 сворачиваемых секций (таймлайн, работники, события, статистика, ЗН, камеры, календарь, алерты, summary)' : 'Post detail panel: 11 collapsible sections (timeline, workers, events, statistics, WOs, cameras, calendar, alerts, summary)'],
            ['PostCardsView.jsx', isRu ? 'Карточный вид списка постов: цвет рамки по статусу, мини-метрики, клик для выбора' : 'Card view of post list: border color by status, mini metrics, click to select'],
            ['PostTableView.jsx', isRu ? 'Табличный вид списка постов: колонки (имя, тип, статус, загрузка, текущий ЗН), сортировка' : 'Table view of post list: columns (name, type, status, load, current WO), sorting'],
            ['CollapsibleSection.jsx', isRu ? 'Сворачиваемая секция: заголовок + ChevronDown/Up, анимация expand/collapse, используется в PostDetailPanel' : 'Collapsible section: title + ChevronDown/Up, expand/collapse animation, used in PostDetailPanel'],
          ]}
        />


        {/* ============================================================ */}
        {/* Section 11 — Contexts */}
        {/* ============================================================ */}
        <SectionTitle id="contexts">{isRu ? '11. Контексты (Auth, Theme, Toast)' : '11. Contexts (Auth, Theme, Toast)'}</SectionTitle>

        <Sub>AuthContext (338 LOC)</Sub>
        <P>{isRu
          ? 'Центральный контекст приложения, отвечающий за авторизацию, API-клиент и систему доступа. Хранит состояние: user (объект пользователя с ролью, permissions, pages, hiddenElements), token (JWT access token), loading (статус загрузки). Предоставляет: login(email, password), logout(), api (Axios-подобный клиент с автоматическим refresh token), hasPermission(key), isElementVisible(pageId, elementId).'
          : 'Central app context responsible for auth, API client, and access system. State: user (user object with role, permissions, pages, hiddenElements), token (JWT access token), loading. Provides: login(email, password), logout(), api (Axios-like client with auto refresh token), hasPermission(key), isElementVisible(pageId, elementId).'
        }</P>
        <P>{isRu
          ? 'api -- обёртка над fetch с автоматическими заголовками (Authorization: Bearer) и перехватом 401 для refresh token. При истечении access token автоматически вызывает POST /api/auth/refresh, получает новый token и повторяет исходный запрос. Методы: api.get(url), api.post(url, data), api.put(url, data), api.delete(url).'
          : 'api -- fetch wrapper with automatic headers (Authorization: Bearer) and 401 interception for refresh token. On access token expiry, automatically calls POST /api/auth/refresh, gets new token and retries the original request. Methods: api.get(url), api.post(url, data), api.put(url, data), api.delete(url).'
        }</P>

        <Sub>PAGE_ELEMENTS {isRu ? 'реестр' : 'Registry'}</Sub>
        <P>{isRu
          ? 'AuthContext содержит PAGE_ELEMENTS -- реестр всех настраиваемых элементов по страницам. Этот реестр используется на странице Users для отображения чекбоксов скрытия/показа виджетов. Каждая запись содержит: pageId, elementId, labelRu, labelEn.'
          : 'AuthContext contains PAGE_ELEMENTS -- a registry of all configurable elements per page. This registry is used on the Users page to display show/hide widget checkboxes. Each entry contains: pageId, elementId, labelRu, labelEn.'
        }</P>
        <Table
          headers={[isRu ? 'Страница' : 'Page', isRu ? 'Элементы (elementId)' : 'Elements (elementId)', isRu ? 'Кол-во' : 'Count']}
          rows={[
            ['Dashboard', 'kpiCards, liveSto, predictions, recommendations, recentEvents', '5'],
            ['DashboardPosts', 'shiftStats, currentShift, ganttTimeline, freeWorkOrders', '4'],
            ['PostsDetail', 'postsList, detailPanel, timeline, summary, workOrders, workers, alerts, eventLog, statistics, cameras, calendar', '11'],
            ['Analytics', 'summaryStats, trendsCharts, rankingCharts, planFactChart, comparisonTable, heatmaps, postDetail', '7'],
          ]}
        />

        <Sub>ROLE_DEFAULT_PAGES</Sub>
        <P>{isRu
          ? 'AuthContext также содержит маппинг ROLE_DEFAULT_PAGES, определяющий какие страницы доступны каждой роли по умолчанию при создании пользователя. Администратор может потом расширить или ограничить набор через pages[] в PUT /api/users/:id. При логине бэкенд мерджит pages из БД с дефолтными страницами роли.'
          : 'AuthContext also contains ROLE_DEFAULT_PAGES mapping, defining which pages are accessible to each role by default when creating a user. Admin can then expand or restrict the set via pages[] in PUT /api/users/:id. On login, backend merges DB pages with role default pages.'
        }</P>

        <Sub>ThemeContext</Sub>
        <P>{isRu
          ? 'Управляет темой (dark/light). Устанавливает CSS-переменные на :root: --bg-primary, --bg-secondary, --bg-tertiary, --text-primary, --text-secondary, --text-muted, --accent, --accent-light, --border-glass, --shadow-glass. Тема хранится в localStorage[\'theme\']. По умолчанию dark. Glassmorphism: background с rgba + backdrop-filter: blur(12px) + border с rgba.'
          : 'Manages theme (dark/light). Sets CSS variables on :root: --bg-primary, --bg-secondary, --bg-tertiary, --text-primary, --text-secondary, --text-muted, --accent, --accent-light, --border-glass, --shadow-glass. Theme stored in localStorage[\'theme\']. Default: dark. Glassmorphism: background with rgba + backdrop-filter: blur(12px) + border with rgba.'
        }</P>

        <Sub>ToastContext</Sub>
        <P>{isRu
          ? 'Глобальная система уведомлений. 4 типа: success (зелёный), error (красный), warning (жёлтый), info (синий). Максимум 3 тоста одновременно. Auto-dismiss с настраиваемым таймером (по умолчанию 4с для success, 6с для error). API: showToast(message, type, duration?). Тосты анимированы (slide-in/slide-out) и кликабельны для закрытия.'
          : 'Global notification system. 4 types: success (green), error (red), warning (yellow), info (blue). Max 3 toasts simultaneous. Auto-dismiss with configurable timer (default 4s for success, 6s for error). API: showToast(message, type, duration?). Toasts are animated (slide-in/slide-out) and clickable to dismiss.'
        }</P>


        {/* ============================================================ */}
        {/* Section 12 — Hooks */}
        {/* ============================================================ */}
        <SectionTitle id="hooks">{isRu ? '12. Хуки' : '12. Hooks'}</SectionTitle>
        <P>{isRu
          ? 'Четыре кастомных хука инкапсулируют сложную логику: Socket.IO, таймеры ЗН, мониторинг камер, и универсальные API-запросы.'
          : 'Four custom hooks encapsulate complex logic: Socket.IO, WO timers, camera monitoring, and universal API requests.'
        }</P>

        <Sub>useSocket.js</Sub>
        <P>{isRu
          ? 'Основной модуль real-time коммуникации. Экспортирует: (1) connectSocket(token) -- устанавливает singleton Socket.IO подключение с JWT auth; (2) disconnectSocket() -- разрывает; (3) usePolling(callback, interval) -- декларативный setInterval с автоочисткой при unmount; (4) useSubscribe(event, handler) -- подписка на Socket.IO событие с автоотпиской; (5) useSocketStatus() -- текущий статус (connected/disconnected/reconnecting). Singleton гарантирует одно подключение на приложение.'
          : 'Main real-time communication module. Exports: (1) connectSocket(token) -- establishes singleton Socket.IO connection with JWT auth; (2) disconnectSocket() -- tears down; (3) usePolling(callback, interval) -- declarative setInterval with auto-cleanup on unmount; (4) useSubscribe(event, handler) -- Socket.IO event subscription with auto-unsubscribe; (5) useSocketStatus() -- current status (connected/disconnected/reconnecting). Singleton ensures one connection per app.'
        }</P>

        <Sub>useWorkOrderTimer.js</Sub>
        <P>{isRu
          ? 'Хук таймера ЗН. Принимает workOrder (normHours, startedAt, pausedAt, totalPausedMs). Возвращает: elapsedMs (реальное рабочее время = now - startedAt - totalPausedMs - currentPauseTime), percentUsed (elapsedMs / normHours * 100), warningLevel (none <80%, warning 80-95%, critical 95-100%, overtime >100%). Обновляется каждую секунду через requestAnimationFrame. При pausedAt !== null таймер стоит.'
          : 'WO timer hook. Takes workOrder (normHours, startedAt, pausedAt, totalPausedMs). Returns: elapsedMs (real work time = now - startedAt - totalPausedMs - currentPauseTime), percentUsed (elapsedMs / normHours * 100), warningLevel (none <80%, warning 80-95%, critical 95-100%, overtime >100%). Updates every second via requestAnimationFrame. When pausedAt !== null, timer stops.'
        }</P>

        <Sub>useCameraStatus.js</Sub>
        <P>{isRu
          ? 'Подписывается на Socket.IO camera:status и поддерживает Map<cameraId, { online: boolean, lastCheck: Date }>. Обновляется каждые 30 секунд от CameraHealthCheck. Любой компонент может узнать статус камеры без API-запросов.'
          : 'Subscribes to Socket.IO camera:status and maintains Map<cameraId, { online: boolean, lastCheck: Date }>. Updated every 30 seconds from CameraHealthCheck. Any component can check camera status without API requests.'
        }</P>

        <Sub>useAsync.js</Sub>
        <P>{isRu
          ? 'Универсальный хук API-запросов. Принимает URL и опции { enabled, deps, transform, initialData }. Возвращает { data, loading, error, refetch }. Автоматически вызывает api.get() при mount и при изменении deps. mountedRef предотвращает setState после unmount. transform позволяет преобразовать ответ перед сохранением.'
          : 'Universal API request hook. Takes URL and options { enabled, deps, transform, initialData }. Returns { data, loading, error, refetch }. Auto-calls api.get() on mount and when deps change. mountedRef prevents setState after unmount. transform allows response transformation before storing.'
        }</P>

        <Table
          headers={[isRu ? 'Хук' : 'Hook', isRu ? 'Вход' : 'Input', isRu ? 'Выход' : 'Output']}
          rows={[
            ['connectSocket', 'token: string', 'Socket.IO instance (singleton)'],
            ['usePolling', 'callback: () => void, interval: number', isRu ? 'Нет (side effect)' : 'None (side effect)'],
            ['useSubscribe', 'event: string, handler: (data) => void', isRu ? 'Нет (side effect)' : 'None (side effect)'],
            ['useWorkOrderTimer', 'workOrder: { normHours, startedAt, pausedAt, totalPausedMs }', '{ elapsedMs, percentUsed, warningLevel }'],
            ['useCameraStatus', isRu ? 'Нет' : 'None', 'Map<cameraId, { online, lastCheck }>'],
            ['useAsync', 'url: string, options: { enabled?, deps?, transform?, initialData? }', '{ data, loading, error, refetch }'],
          ]}
        />


        {/* ============================================================ */}
        {/* Section 13 — Utilities */}
        {/* ============================================================ */}
        <SectionTitle id="utils">{isRu ? '13. Утилиты' : '13. Utilities'}</SectionTitle>

        <Sub>translate.js</Sub>
        <P>{isRu
          ? 'Модуль перевода динамических данных (приходят с бэкенда на русском). Три функции:'
          : 'Module for translating dynamic data (comes from backend in Russian). Three functions:'
        }</P>
        <Table
          headers={[isRu ? 'Функция' : 'Function', isRu ? 'Вход' : 'Input', isRu ? 'Пример' : 'Example']}
          rows={[
            ['translateZone(name, isRu)', isRu ? 'Название зоны, язык' : 'Zone name, language', isRu ? '"Зона ремонта" -> "Repair Zone" (en)' : '"Зона ремонта" -> "Repair Zone" (en)'],
            ['translatePost(name, isRu)', isRu ? 'Название поста, язык' : 'Post name, language', isRu ? '"Пост 1 (грузовой)" -> "Post 1 (heavy)" (en)' : '"Пост 1 (грузовой)" -> "Post 1 (heavy)" (en)'],
            ['translateWorksDesc(desc, isRu)', isRu ? 'Описание работ, язык' : 'Work description, language', isRu ? 'Перевод типовых описаний работ' : 'Translation of standard work descriptions'],
          ]}
        />

        <Sub>export.js</Sub>
        <P>{isRu
          ? 'Три функции экспорта данных из фронтенда:'
          : 'Three data export functions from the frontend:'
        }</P>
        <Table
          headers={[isRu ? 'Функция' : 'Function', isRu ? 'Описание' : 'Description']}
          rows={[
            ['exportToXlsx(data, options)', isRu ? 'Генерация XLSX с 4 листами: Summary (статистика за период), Posts (данные по постам), Daily (дневная разбивка), Details (записи). Библиотека xlsx (SheetJS). Автоскачивание через programmatic <a> click' : 'Generates XLSX with 4 sheets: Summary (period stats), Posts (per-post data), Daily (daily breakdown), Details (records). Library xlsx (SheetJS). Auto-download via programmatic <a> click'],
            ['exportToPdf(element, filename)', isRu ? 'Экспорт DOM-элемента в PDF (A4 landscape). Клонирование элемента off-screen, чанки по 2500px (лимит canvas), html2canvas -> jsPDF. Фон #0f172a для тёмной темы' : 'Export DOM element to PDF (A4 landscape). Off-screen element cloning, 2500px chunks (canvas limit), html2canvas -> jsPDF. Background #0f172a for dark theme'],
            ['downloadChartAsPng(chartRef, filename)', isRu ? 'Скачивание Recharts графика как PNG: html2canvas рендерит SVG в canvas -> data URL -> скачивание' : 'Download Recharts chart as PNG: html2canvas renders SVG to canvas -> data URL -> download'],
          ]}
        />


        {/* ============================================================ */}
        {/* Section 14 — RBAC */}
        {/* ============================================================ */}
        <SectionTitle id="rbac">{isRu ? '14. RBAC -- Система доступа' : '14. RBAC -- Access Control'}</SectionTitle>
        <P>{isRu
          ? 'Система контроля доступа работает на трёх независимых уровнях: роли (базовый набор разрешений), страницы (доступные маршруты), видимость элементов (виджеты на страницах). Каждый уровень настраивается через админ-панель (страница Users).'
          : 'The access control system operates on three independent levels: roles (base permission set), pages (accessible routes), element visibility (page widgets). Each level is configured via admin panel (Users page).'
        }</P>

        <Sub>{isRu ? '15 разрешений (Permissions)' : '15 Permissions'}</Sub>
        <Table
          headers={[isRu ? 'Ключ' : 'Key', isRu ? 'Описание' : 'Description', isRu ? 'Роли' : 'Roles']}
          rows={[
            ['view_dashboard', isRu ? 'Просмотр Dashboard' : 'View Dashboard', 'admin, director, manager, mechanic, viewer'],
            ['view_analytics', isRu ? 'Просмотр аналитики' : 'View analytics', 'admin, director'],
            ['view_zones', isRu ? 'Просмотр зон' : 'View zones', 'admin, director, manager, viewer'],
            ['view_posts', isRu ? 'Просмотр постов' : 'View posts', 'admin, director, manager, mechanic, viewer'],
            ['view_sessions', isRu ? 'Просмотр сессий' : 'View sessions', 'admin, director, manager, mechanic'],
            ['view_events', isRu ? 'Просмотр событий' : 'View events', 'admin, director, manager'],
            ['view_work_orders', isRu ? 'Просмотр заказ-нарядов' : 'View work orders', 'admin, director'],
            ['view_recommendations', isRu ? 'Просмотр рекомендаций' : 'View recommendations', 'admin, director, manager'],
            ['view_cameras', isRu ? 'Просмотр камер' : 'View cameras', 'admin, director'],
            ['manage_zones', isRu ? 'Управление зонами и постами (CRUD)' : 'Manage zones and posts (CRUD)', 'admin'],
            ['manage_work_orders', isRu ? 'Управление заказ-нарядами (CRUD, schedule)' : 'Manage work orders (CRUD, schedule)', 'admin, manager'],
            ['manage_users', isRu ? 'Управление пользователями (CRUD, roles, pages)' : 'Manage users (CRUD, roles, pages)', 'admin'],
            ['manage_cameras', isRu ? 'Управление камерами (CRUD, zone mapping)' : 'Manage cameras (CRUD, zone mapping)', 'admin'],
            ['manage_roles', isRu ? 'Управление ролями и разрешениями' : 'Manage roles and permissions', 'admin'],
            ['manage_settings', isRu ? 'Управление системными настройками' : 'Manage system settings', 'admin'],
          ]}
        />

        <Sub>{isRu ? 'Доступ к страницам' : 'Page Access'}</Sub>
        <P>{isRu
          ? 'Массив user.pages[] хранит список pageId страниц, доступных пользователю. При создании пользователя pages заполняется из ROLE_DEFAULT_PAGES для его роли. Администратор может расширить или ограничить набор. На фронтенде Sidebar фильтрует навигацию: показывает только те пункты, для которых user.pages.includes(pageId) === true. Исключение: admin видит все пункты безусловно. ProtectedRoute проверяет доступ к странице и редиректит на Dashboard при отсутствии доступа.'
          : 'The user.pages[] array stores the list of pageId pages accessible to the user. When creating a user, pages is populated from ROLE_DEFAULT_PAGES for their role. Admin can expand or restrict the set. On the frontend, Sidebar filters navigation: shows only items where user.pages.includes(pageId) === true. Exception: admin sees all items unconditionally. ProtectedRoute checks page access and redirects to Dashboard if access denied.'
        }</P>

        <Sub>{isRu ? 'Видимость элементов (hiddenElements)' : 'Element Visibility (hiddenElements)'}</Sub>
        <P>{isRu
          ? 'JSON-массив строк формата "pageId:elementId" в поле user.hiddenElements. Пример: ["dashboard:liveSto", "analytics:heatmaps"]. isElementVisible(pageId, elementId) из AuthContext проверяет наличие в массиве. Если элемент скрыт -- компонент не рендерится. Всего 27 настраиваемых элементов на 4 страницах (Dashboard: 5, DashboardPosts: 4, PostsDetail: 11, Analytics: 7).'
          : 'JSON array of strings in "pageId:elementId" format in user.hiddenElements field. Example: ["dashboard:liveSto", "analytics:heatmaps"]. isElementVisible(pageId, elementId) from AuthContext checks array membership. If hidden -- component is not rendered. Total: 27 configurable elements across 4 pages (Dashboard: 5, DashboardPosts: 4, PostsDetail: 11, Analytics: 7).'
        }</P>

        <Sub>{isRu ? 'Backend middleware' : 'Backend Middleware'}</Sub>
        <Code>{`// ${isRu ? 'Цепочка middleware для защищённого маршрута' : 'Middleware chain for protected route'}
router.put('/api/users/:id',
  authenticate,                    // JWT -> req.user (${isRu ? 'кеш 15мин' : 'cache 15min'})
  requirePermission('manage_users'), // ${isRu ? 'проверка разрешения, 403 при отсутствии' : 'permission check, 403 if missing'}
  auditLog('user'),                // ${isRu ? 'перехват res.json для аудита' : 'intercept res.json for audit'}
  validate(updateUserSchema),      // Zod ${isRu ? 'валидация body' : 'body validation'}
  asyncHandler(handler)            // ${isRu ? 'обработка ошибок (P2025 -> 404)' : 'error handling (P2025 -> 404)'}
);`}</Code>


        {/* ============================================================ */}
        {/* Section 15 — i18n */}
        {/* ============================================================ */}
        <SectionTitle id="i18n">{isRu ? '15. Интернационализация' : '15. Internationalization'}</SectionTitle>
        <P>{isRu
          ? 'react-i18next с двумя языками: русский (RU, по умолчанию) и английский (EN). Файлы: frontend/src/i18n/ru.json и en.json -- по 613 строк, ~512 ключей каждый. 100% паритет: каждый ключ существует в обоих файлах. Язык хранится в localStorage[\'language\'].'
          : 'react-i18next with two languages: Russian (RU, default) and English (EN). Files: frontend/src/i18n/ru.json and en.json -- 613 lines, ~512 keys each. 100% parity: every key exists in both files. Language stored in localStorage[\'language\'].'
        }</P>

        <Sub>{isRu ? 'Структура ключей' : 'Key Structure'}</Sub>
        <Table
          headers={[isRu ? 'Секция' : 'Section', isRu ? 'Примеры ключей' : 'Example Keys', isRu ? 'Кол-во' : 'Count']}
          rows={[
            ['nav.*', 'nav.dashboard, nav.analytics, nav.workOrders, nav.cameras, nav.users, nav.shifts', '~20'],
            ['dashboard.*', 'dashboard.title, dashboard.totalVehicles, dashboard.avgRepairTime, dashboard.utilization', '~30'],
            ['posts.*', 'posts.title, posts.status.free, posts.status.occupied, posts.type.heavy', '~25'],
            ['workOrders.*', 'workOrders.title, workOrders.status.pending, workOrders.normHours, workOrders.import', '~35'],
            ['analytics.*', 'analytics.title, analytics.export.xlsx, analytics.trends, analytics.ranking', '~40'],
            ['events.*', 'events.title, events.type.vehicle_enter, events.filter.zone, events.filter.period', '~25'],
            ['cameras.*', 'cameras.title, cameras.stream, cameras.offline, cameras.zone_coverage', '~15'],
            ['users.*', 'users.title, users.role, users.pages, users.hiddenElements, users.active', '~20'],
            ['shifts.*', 'shifts.title, shifts.workers, shifts.conflict, shifts.complete', '~15'],
            ['audit.*', 'audit.title, audit.action.create, audit.entity.user, audit.export', '~15'],
            ['common.*', 'common.save, common.cancel, common.delete, common.loading, common.error', '~50'],
            [isRu ? 'Прочие (data1c, map, health, predict, help, ...)' : 'Other (data1c, map, health, predict, help, ...)', '...', '~220'],
          ]}
        />

        <P>{isRu
          ? 'Использование: все статические тексты через t(\'key\'). Динамические данные (названия зон/постов от бэкенда) через translate.js. Переключение: i18n.changeLanguage(\'en\') / i18n.changeLanguage(\'ru\') -- мгновенное обновление всего UI без перезагрузки.'
          : 'Usage: all static texts via t(\'key\'). Dynamic data (zone/post names from backend) via translate.js. Switching: i18n.changeLanguage(\'en\') / i18n.changeLanguage(\'ru\') -- instant full UI update without reload.'
        }</P>


        {/* ============================================================ */}
        {/* Section 16 — PWA */}
        {/* ============================================================ */}
        <SectionTitle id="pwa">{isRu ? '16. PWA и Service Worker' : '16. PWA & Service Worker'}</SectionTitle>
        <P>{isRu
          ? 'Progressive Web App с Service Worker и Web Push уведомлениями. Service Worker (sw.js, текущая версия: metricsaiup-v54) использует стратегию Network-first для всех запросов.'
          : 'Progressive Web App with Service Worker and Web Push notifications. Service Worker (sw.js, current version: metricsaiup-v54) uses Network-first strategy for all requests.'
        }</P>

        <Sub>{isRu ? 'Стратегия кеширования' : 'Caching Strategy'}</Sub>
        <P>{isRu
          ? 'Network-first: (1) fetch из сети; (2) при успехе -- сохранить в кеш + вернуть; (3) при ошибке -- cache.match (вернуть из кеша). Исключения (не кешируются): /api/* (бэкенд API), /socket.io/* (WebSocket), chrome-extension://*. Статические ассеты (JS, CSS, изображения, шрифты) кешируются при первом запросе.'
          : 'Network-first: (1) fetch from network; (2) on success -- save to cache + return; (3) on error -- cache.match (return from cache). Exclusions (not cached): /api/* (backend API), /socket.io/* (WebSocket), chrome-extension://*. Static assets (JS, CSS, images, fonts) cached on first request.'
        }</P>

        <Sub>CACHE_NAME</Sub>
        <P>{isRu
          ? 'CACHE_NAME = \'metricsaiup-v54\'. ОБЯЗАТЕЛЬНО бампить при каждом билде фронтенда. При активации нового Service Worker он удаляет все кеши кроме текущего CACHE_NAME. Это единственный способ гарантировать обновление у всех клиентов.'
          : 'CACHE_NAME = \'metricsaiup-v54\'. MUST bump on every frontend build. On new Service Worker activation, it deletes all caches except the current CACHE_NAME. This is the only way to guarantee updates for all clients.'
        }</P>

        <Sub>Web Push</Sub>
        <P>{isRu
          ? 'Протокол Web Push с VAPID-ключами. Фронтенд: navigator.serviceWorker.ready -> registration.pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY }) -> POST /api/push/subscribe (endpoint, keys.p256dh, keys.auth). Бэкенд сохраняет в PushSubscription. Отправка: POST /api/push/send с title, body, target (userId или broadcast). Библиотека: web-push 3.6.'
          : 'Web Push protocol with VAPID keys. Frontend: navigator.serviceWorker.ready -> registration.pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY }) -> POST /api/push/subscribe (endpoint, keys.p256dh, keys.auth). Backend saves to PushSubscription. Sending: POST /api/push/send with title, body, target (userId or broadcast). Library: web-push 3.6.'
        }</P>

        <Sub>manifest.json</Sub>
        <P>{isRu
          ? 'PWA манифест: name = "MetricsAiUp", short_name = "MetricsAiUp", start_url = "/", display = "standalone", theme_color и background_color. Иконки: favicon.svg (SVG для всех размеров). При установке PWA на мобильном устройстве появляется иконка на домашнем экране.'
          : 'PWA manifest: name = "MetricsAiUp", short_name = "MetricsAiUp", start_url = "/", display = "standalone", theme_color and background_color. Icons: favicon.svg (SVG for all sizes). When installing PWA on mobile, an icon appears on the home screen.'
        }</P>


        {/* ============================================================ */}
        {/* Section 17 — HLS */}
        {/* ============================================================ */}
        <SectionTitle id="hls">{isRu ? '17. HLS Видеостриминг' : '17. HLS Video Streaming'}</SectionTitle>
        <P>{isRu
          ? 'HLS-сервер (server.js) работает на порту 8181 с HTTPS (сертификат из .ssl/). Конвертирует 10 RTSP-потоков камер в HLS через FFmpeg. Каждая камера -- отдельный FFmpeg-процесс.'
          : 'HLS server (server.js) runs on port 8181 with HTTPS (certificate from .ssl/). Converts 10 RTSP camera streams to HLS via FFmpeg. Each camera is a separate FFmpeg process.'
        }</P>

        <Sub>{isRu ? '10 камер' : '10 Cameras'}</Sub>
        <Table
          headers={['ID', isRu ? 'Имя' : 'Name', isRu ? 'RTSP URL' : 'RTSP URL', isRu ? 'HLS файл' : 'HLS File']}
          rows={[
            ['cam01', isRu ? 'Камера 1' : 'Camera 1', 'rtsp://86.57.249.76:1732/stream1', '/project/hls/cam01.m3u8'],
            ['cam02', isRu ? 'Камера 2' : 'Camera 2', 'rtsp://86.57.249.76:1832/stream2', '/project/hls/cam02.m3u8'],
            ['cam03', isRu ? 'Камера 3' : 'Camera 3', 'rtsp://86.57.249.76:1932/stream3', '/project/hls/cam03.m3u8'],
            ['cam04', isRu ? 'Камера 4' : 'Camera 4', 'rtsp://86.57.249.76:2032/stream4', '/project/hls/cam04.m3u8'],
            ['cam05', isRu ? 'Камера 5' : 'Camera 5', 'rtsp://86.57.249.76:2132/stream5', '/project/hls/cam05.m3u8'],
            ['cam06-cam10', isRu ? 'Камеры 6-10' : 'Cameras 6-10', 'rtsp://86.57.249.76:2232-2632/stream6-10', '/project/hls/cam06-10.m3u8'],
          ]}
        />

        <Sub>{isRu ? 'FFmpeg конвейер' : 'FFmpeg Pipeline'}</Sub>
        <Code>{`ffmpeg -rtsp_transport tcp -i rtsp://86.57.249.76:1732/stream1 \\
  -c:v copy                    # ${isRu ? 'без перекодирования видео (passthrough)' : 'no video transcoding (passthrough)'}
  -f hls                       # ${isRu ? 'выходной формат HLS' : 'output format HLS'}
  -hls_time 2                  # ${isRu ? '2-секундные сегменты' : '2-second segments'}
  -hls_list_size 6             # ${isRu ? '6 сегментов в плейлисте (~12с окно)' : '6 segments in playlist (~12s window)'}
  -hls_flags delete_segments   # ${isRu ? 'удаление старых сегментов' : 'delete old segments'}
  -hls_segment_filename /project/hls/cam01-%06d.ts
  /project/hls/cam01.m3u8

# ${isRu ? 'Автоперезапуск: при падении FFmpeg -- рестарт через 3 секунды' : 'Auto-restart: on FFmpeg crash -- restart after 3 seconds'}
# ${isRu ? 'Выход: .m3u8 (плейлист) + .ts (сегменты) в /project/hls/' : 'Output: .m3u8 (playlist) + .ts (segments) in /project/hls/'}`}</Code>

        <Sub>{isRu ? 'API HLS-сервера' : 'HLS Server API'}</Sub>
        <Table
          headers={[isRu ? 'Метод' : 'Method', isRu ? 'Путь' : 'Path', isRu ? 'Описание' : 'Description']}
          rows={[
            ['GET', '/api/cameras', isRu ? 'Список камер с HLS URL и статусом' : 'Camera list with HLS URLs and status'],
            ['GET', '/api/cameras/:id/stream', isRu ? 'HLS stream URL для конкретной камеры' : 'HLS stream URL for specific camera'],
            ['GET', '/hls/*.m3u8', isRu ? 'HLS плейлист (через server.js на :8181, CORS *)' : 'HLS playlist (via server.js on :8181, CORS *)'],
            ['GET', '/hls/*.ts', isRu ? 'HLS видеосегмент (через server.js на :8181, CORS *)' : 'HLS video segment (via server.js on :8181, CORS *)'],
          ]}
        />

        <P>{isRu
          ? 'На фронтенде HLS-потоки воспроизводятся через HLS.js 1.6 в CameraStreamModal. HLS.js автоматически адаптирует качество к пропускной способности. Камеры доступны на страницах Cameras (по зонам), MapViewer (позиции на карте), PostsDetail (камеры поста). Статус мониторится CameraHealthCheck (30с) + Socket.IO camera:status.'
          : 'On frontend, HLS streams play via HLS.js 1.6 in CameraStreamModal. HLS.js auto-adapts quality to bandwidth. Cameras available on Cameras (by zones), MapViewer (map positions), PostsDetail (post cameras). Status monitored by CameraHealthCheck (30s) + Socket.IO camera:status.'
        }</P>


        {/* ============================================================ */}
        {/* Section 18 — 1C Integration */}
        {/* ============================================================ */}
        <SectionTitle id="integration1c">{isRu ? '18. Интеграция с 1С' : '18. 1C Integration'}</SectionTitle>
        <P>{isRu
          ? 'Интеграция с ERP 1С через XLSX-файлы. Два режима импорта: ручной (drag-n-drop на странице Data1C) и автоматический (file watcher /data/1c-import/). Два типа данных: Planning (планирование) и Workers (выработка).'
          : '1C ERP integration via XLSX files. Two import modes: manual (drag-n-drop on Data1C page) and automatic (file watcher /data/1c-import/). Two data types: Planning and Workers (production).'
        }</P>

        <Sub>{isRu ? 'Формат Planning XLSX (16 колонок)' : 'Planning XLSX Format (16 columns)'}</Sub>
        <Table
          headers={[isRu ? 'Колонка' : 'Column', isRu ? 'Описание' : 'Description']}
          rows={[
            [isRu ? 'Номер ЗН' : 'WO Number', isRu ? 'Уникальный номер заказ-наряда из 1С' : 'Unique work order number from 1C'],
            [isRu ? 'Дата' : 'Date', isRu ? 'Дата планируемого ремонта' : 'Planned repair date'],
            [isRu ? 'Клиент' : 'Client', isRu ? 'Имя клиента или организация' : 'Client name or organization'],
            [isRu ? 'Авто (марка, модель)' : 'Vehicle (make, model)', isRu ? 'Марка и модель автомобиля' : 'Vehicle make and model'],
            [isRu ? 'Гос. номер' : 'Plate Number', isRu ? 'Государственный регистрационный знак' : 'License plate number'],
            [isRu ? 'Вид работ' : 'Work Type', isRu ? 'Описание планируемых работ' : 'Planned work description'],
            [isRu ? 'Нормо-часы' : 'Norm Hours', isRu ? 'Плановые нормо-часы на работу' : 'Planned norm hours for work'],
            [isRu ? 'Мастер' : 'Master', isRu ? 'Ответственный мастер/менеджер' : 'Responsible master/manager'],
            [isRu ? 'Пост' : 'Post', isRu ? 'Назначенный пост (1-10)' : 'Assigned post (1-10)'],
            [isRu ? 'Время начала' : 'Start Time', isRu ? 'Планируемое время начала' : 'Planned start time'],
            [isRu ? 'Время окончания' : 'End Time', isRu ? 'Планируемое время окончания' : 'Planned end time'],
            [isRu ? 'Приоритет' : 'Priority', isRu ? 'Приоритет: low/normal/high/urgent' : 'Priority: low/normal/high/urgent'],
            [isRu ? '+ 4 доп. колонки' : '+ 4 extra columns', isRu ? 'Статус, комментарии, запчасти, стоимость' : 'Status, comments, parts, cost'],
          ]}
        />

        <Sub>{isRu ? 'Формат Workers XLSX (15 колонок)' : 'Workers XLSX Format (15 columns)'}</Sub>
        <P>{isRu
          ? 'Данные выработки: ФИО работника, дата, номера выполненных ЗН, фактические нормо-часы, тип работ, качество (оценка), и другие метрики производительности.'
          : 'Production data: worker name, date, completed WO numbers, actual norm hours, work type, quality (rating), and other performance metrics.'
        }</P>

        <Sub>{isRu ? 'File watcher и дедупликация' : 'File Watcher & Deduplication'}</Sub>
        <P>{isRu
          ? 'Sync1C мониторит директорию /data/1c-import/ через fs.watch. При появлении .xlsx файла: (1) парсинг через xlsx (SheetJS); (2) определение типа (Planning/Workers) по структуре колонок; (3) дедупликация по уникальным ключам (номер ЗН + дата + работник); (4) сохранение в JSON: /data/1c-planning.json, /data/1c-workers.json, /data/1c-stats.json; (5) запись SyncLog в БД (type, direction=import, status, fileName, recordCount, error). Повторный импорт того же файла не создаёт дублей.'
          : 'Sync1C monitors /data/1c-import/ via fs.watch. On .xlsx file appearance: (1) parse via xlsx (SheetJS); (2) determine type (Planning/Workers) by column structure; (3) deduplicate by unique keys (WO number + date + worker); (4) save to JSON: /data/1c-planning.json, /data/1c-workers.json, /data/1c-stats.json; (5) write SyncLog to DB (type, direction=import, status, fileName, recordCount, error). Re-importing same file does not create duplicates.'
        }</P>

        <Sub>{isRu ? 'Экспорт' : 'Export'}</Sub>
        <P>{isRu
          ? 'POST /api/1c/export генерирует XLSX с фильтрами (период, тип данных, работники). Файл скачивается через Content-Disposition: attachment. Используется serverExport.js для серверной генерации XLSX.'
          : 'POST /api/1c/export generates XLSX with filters (period, data type, workers). File downloads via Content-Disposition: attachment. Uses serverExport.js for server-side XLSX generation.'
        }</P>


        {/* ============================================================ */}
        {/* Section 19 — Testing */}
        {/* ============================================================ */}
        <SectionTitle id="testing">{isRu ? '19. Тестирование' : '19. Testing'}</SectionTitle>
        <P>{isRu
          ? 'Тестирование фронтенда через Vitest + React Testing Library + jsdom. Конфигурация в vite.config.js (секция test). Тесты: frontend/src/components/__tests__/.'
          : 'Frontend testing via Vitest + React Testing Library + jsdom. Configuration in vite.config.js (test section). Tests: frontend/src/components/__tests__/.'
        }</P>
        <Table
          headers={[isRu ? 'Инструмент' : 'Tool', isRu ? 'Версия' : 'Version', isRu ? 'Назначение' : 'Purpose']}
          rows={[
            ['Vitest', '~3.x', isRu ? 'Test runner, совместимый с Vite. Watch mode, coverage, параллельное выполнение' : 'Test runner compatible with Vite. Watch mode, coverage, parallel execution'],
            ['React Testing Library', '~16.x', isRu ? 'Тестирование компонентов с точки зрения пользователя: render(), screen.getByText(), fireEvent' : 'Component testing from user perspective: render(), screen.getByText(), fireEvent'],
            ['jsdom', '~25.x', isRu ? 'DOM-эмуляция в Node.js для тестов' : 'DOM emulation in Node.js for tests'],
            ['@testing-library/jest-dom', '~6.x', isRu ? 'Дополнительные матчеры: toBeInTheDocument(), toHaveClass(), toBeVisible()' : 'Additional matchers: toBeInTheDocument(), toHaveClass(), toBeVisible()'],
          ]}
        />
        <Code>{`# ${isRu ? 'Запуск тестов' : 'Run tests'}
cd /project/frontend && npm test        # ${isRu ? 'watch mode' : 'watch mode'}
cd /project/frontend && npm test -- --run  # ${isRu ? 'однократный запуск' : 'single run'}

# ${isRu ? 'Расположение тестов' : 'Test location'}
frontend/src/components/__tests__/*.test.jsx

# ${isRu ? 'Конфигурация в vite.config.js' : 'Configuration in vite.config.js'}
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.js']
}`}</Code>


        {/* ============================================================ */}
        {/* Section 20 — Physical STO Map */}
        {/* ============================================================ */}
        <SectionTitle id="map">{isRu ? '20. Физическая карта СТО' : '20. Physical STO Map'}</SectionTitle>
        <P>{isRu
          ? 'Интерактивная карта на Konva (2D canvas через react-konva). Реальный план здания: 46540x30690 мм. Две страницы: MapViewer (live просмотр) и MapEditor (редактирование, 1244 строк).'
          : 'Interactive map on Konva (2D canvas via react-konva). Real building plan: 46540x30690mm. Two pages: MapViewer (live viewing) and MapEditor (editing, 1244 LOC).'
        }</P>

        <Sub>{isRu ? '8 типов элементов' : '8 Element Types'}</Sub>
        <Table
          headers={[isRu ? 'Тип' : 'Type', isRu ? 'Konva' : 'Konva', isRu ? 'Свойства' : 'Properties', isRu ? 'Описание' : 'Description']}
          rows={[
            ['building', 'Rect + Line', 'x, y, width, height, fill, stroke', isRu ? 'Стены здания, контур корпуса' : 'Building walls, body outline'],
            ['post', 'Rect + Text', 'x, y, width, height, postNumber (1-10), postType (light/heavy/special)', isRu ? 'Рабочий пост. Цвет зависит от статуса в live-режиме' : 'Work post. Color depends on status in live mode'],
            ['zone', 'Rect (полупрозрачный)', 'x, y, width, height, zoneType, zoneName, fill (alpha)', isRu ? 'Зона с полупрозрачной заливкой по типу' : 'Zone with semi-transparent fill by type'],
            ['camera', 'Circle + Wedge', 'x, y, rotation, fov (угол обзора), cameraId', isRu ? 'Камера с конусом обзора (FOV)' : 'Camera with field of view cone (FOV)'],
            ['door', 'Rect', 'x, y, width, doorType (door/gate)', isRu ? 'Дверь или ворота' : 'Door or gate'],
            ['wall', 'Line', 'x1, y1, x2, y2, thickness, color', isRu ? 'Отдельная стена/перегородка' : 'Separate wall/partition'],
            ['label', 'Text', 'x, y, text, fontSize, color, fontStyle', isRu ? 'Текстовая подпись на карте' : 'Text label on map'],
            ['infozone', 'Rect + Text', 'x, y, width, height, text, color, opacity', isRu ? 'Информационная зона (подписи областей)' : 'Information zone (area labels)'],
          ]}
        />

        <Sub>{isRu ? 'Konva Layer System' : 'Konva Layer System'}</Sub>
        <P>{isRu
          ? 'Карта использует многослойную систему Konva: Layer 1 (buildings) -> Layer 2 (zones) -> Layer 3 (posts) -> Layer 4 (cameras) -> Layer 5 (walls, doors) -> Layer 6 (labels, infozones). Слои рендерятся в указанном порядке (buildings на заднем плане, labels на переднем). Zoom реализован через Stage.scale(), pan -- через Stage.position() с drag.'
          : 'The map uses Konva multi-layer system: Layer 1 (buildings) -> Layer 2 (zones) -> Layer 3 (posts) -> Layer 4 (cameras) -> Layer 5 (walls, doors) -> Layer 6 (labels, infozones). Layers render in order (buildings in back, labels in front). Zoom via Stage.scale(), pan via Stage.position() with drag.'
        }</P>

        <Sub>{isRu ? 'Версионирование' : 'Versioning'}</Sub>
        <P>{isRu
          ? 'Каждое сохранение карты через POST /api/map-layout создаёт MapLayoutVersion с автором и timestamp. GET /api/map-layout/versions возвращает историю. POST /api/map-layout/restore/:versionId восстанавливает предыдущую версию. Данные элементов хранятся в JSON-поле elements как массив объектов.'
          : 'Each map save via POST /api/map-layout creates a MapLayoutVersion with author and timestamp. GET /api/map-layout/versions returns history. POST /api/map-layout/restore/:versionId restores a previous version. Element data stored in JSON field elements as object array.'
        }</P>

        <Sub>MapEditor ({isRu ? 'возможности' : 'capabilities'})</Sub>
        <P>{isRu
          ? 'MapEditor.jsx (1244 строк) -- полнофункциональный редактор: toolbar с 8 типами элементов, drag-n-drop размещение, выделение (click), перемещение (drag), resize (corner handles), rotation (для камер), delete (клавиша Delete), snap-to-grid (10px), zoom (ctrl+scroll), pan (middle click drag), undo/redo stack, properties panel (редактирование свойств выбранного элемента), save button (-> API).'
          : 'MapEditor.jsx (1244 LOC) -- full-featured editor: toolbar with 8 element types, drag-n-drop placement, selection (click), movement (drag), resize (corner handles), rotation (for cameras), delete (Delete key), snap-to-grid (10px), zoom (ctrl+scroll), pan (middle click drag), undo/redo stack, properties panel (editing selected element properties), save button (-> API).'
        }</P>


        {/* ============================================================ */}
        {/* Section 21 — Dependencies */}
        {/* ============================================================ */}
        <SectionTitle id="deps">{isRu ? '21. Зависимости' : '21. Dependencies'}</SectionTitle>

        <Sub>{isRu ? 'Frontend (33 зависимости)' : 'Frontend (33 dependencies)'}</Sub>
        <Table
          headers={[isRu ? 'Пакет' : 'Package', isRu ? 'Версия' : 'Version', isRu ? 'Назначение' : 'Purpose']}
          rows={[
            ['react', '19.2.4', isRu ? 'UI-фреймворк (hooks, Suspense, lazy)' : 'UI framework (hooks, Suspense, lazy)'],
            ['react-dom', '19.2.4', isRu ? 'DOM-рендеринг React' : 'React DOM rendering'],
            ['react-router-dom', '7.13.1', isRu ? 'Маршрутизация: HashRouter, Outlet, Navigate, useParams, useLocation' : 'Routing: HashRouter, Outlet, Navigate, useParams, useLocation'],
            ['tailwindcss', '4.2.2', isRu ? 'Utility-first CSS (glassmorphism через custom CSS variables)' : 'Utility-first CSS (glassmorphism via custom CSS variables)'],
            ['vite', '8.0.1', isRu ? 'Сборщик, dev-сервер, HMR, prebuild script' : 'Bundler, dev server, HMR, prebuild script'],
            ['@vitejs/plugin-react', '4.x', isRu ? 'React Fast Refresh для Vite' : 'React Fast Refresh for Vite'],
            ['recharts', '3.8.0', isRu ? 'Графики: LineChart, BarChart, PieChart, AreaChart, RadarChart, Tooltip, Legend' : 'Charts: LineChart, BarChart, PieChart, AreaChart, RadarChart, Tooltip, Legend'],
            ['konva', '10.2.3', isRu ? '2D Canvas фреймворк (карта СТО)' : '2D Canvas framework (STO map)'],
            ['react-konva', '19.x', isRu ? 'React-обёртка для Konva (Stage, Layer, Rect, Circle, Line, Text, Wedge)' : 'React wrapper for Konva (Stage, Layer, Rect, Circle, Line, Text, Wedge)'],
            ['i18next', '25.9.0', isRu ? 'Ядро i18n' : 'i18n core'],
            ['react-i18next', '15.x', isRu ? 'React-интеграция i18n (useTranslation hook, Trans component)' : 'React i18n integration (useTranslation hook, Trans component)'],
            ['socket.io-client', '4.8.3', isRu ? 'Socket.IO клиент (WebSocket + polling fallback)' : 'Socket.IO client (WebSocket + polling fallback)'],
            ['hls.js', '1.6.15', isRu ? 'HLS-плеер в браузере (MSE API)' : 'HLS player in browser (MSE API)'],
            ['jspdf', '4.2.1', isRu ? 'Генерация PDF из JavaScript' : 'PDF generation from JavaScript'],
            ['html2canvas', '1.4.x', isRu ? 'DOM -> Canvas рендеринг (для PDF/PNG экспорта)' : 'DOM -> Canvas rendering (for PDF/PNG export)'],
            ['xlsx', '0.18.5', isRu ? 'XLSX генерация/парсинг (SheetJS)' : 'XLSX generation/parsing (SheetJS)'],
            ['lucide-react', '0.577.0', isRu ? 'SVG-иконки (единственный источник иконок в проекте, без emoji)' : 'SVG icons (sole icon source in project, no emoji)'],
            ['qrcode.react', '~4.x', isRu ? 'Генерация QR-кодов (для сессий авто)' : 'QR code generation (for vehicle sessions)'],
            ['date-fns', '~4.x', isRu ? 'Утилиты работы с датами' : 'Date utilities'],
          ]}
        />

        <Sub>{isRu ? 'Backend (19 зависимостей)' : 'Backend (19 dependencies)'}</Sub>
        <Table
          headers={[isRu ? 'Пакет' : 'Package', isRu ? 'Версия' : 'Version', isRu ? 'Назначение' : 'Purpose']}
          rows={[
            ['express', '4.21.0', isRu ? 'HTTP-сервер, маршрутизация, middleware chain' : 'HTTP server, routing, middleware chain'],
            ['@prisma/client', '5.20.0', isRu ? 'ORM: запросы к SQLite, транзакции, миграции' : 'ORM: SQLite queries, transactions, migrations'],
            ['prisma', '5.20.0', isRu ? 'CLI для миграций, генерации клиента, seed' : 'CLI for migrations, client generation, seed'],
            ['jsonwebtoken', '9.0.2', isRu ? 'JWT: jwt.sign() (access 24h, refresh 7d), jwt.verify()' : 'JWT: jwt.sign() (access 24h, refresh 7d), jwt.verify()'],
            ['bcryptjs', '2.4.3', isRu ? 'Хеширование паролей (bcrypt.hash, bcrypt.compare), salt rounds: 10' : 'Password hashing (bcrypt.hash, bcrypt.compare), salt rounds: 10'],
            ['socket.io', '4.8.0', isRu ? 'WebSocket-сервер с rooms, namespace, broadcast' : 'WebSocket server with rooms, namespace, broadcast'],
            ['helmet', '7.1.0', isRu ? 'Заголовки безопасности (CSP, XSS, HSTS)' : 'Security headers (CSP, XSS, HSTS)'],
            ['cors', '2.8.5', isRu ? 'CORS middleware (origin: *)' : 'CORS middleware (origin: *)'],
            ['morgan', '1.10.0', isRu ? 'HTTP request logging (dev format)' : 'HTTP request logging (dev format)'],
            ['zod', '4.3.6', isRu ? 'Валидация данных: строки, числа, enum, nested objects, arrays' : 'Data validation: strings, numbers, enums, nested objects, arrays'],
            ['node-cron', '4.2.1', isRu ? 'Планировщик: cron выражения, минутная гранулярность' : 'Scheduler: cron expressions, minute granularity'],
            ['xlsx', '0.18.5', isRu ? 'Серверная генерация/парсинг XLSX' : 'Server-side XLSX generation/parsing'],
            ['web-push', '3.6.7', isRu ? 'Web Push: VAPID, sendNotification()' : 'Web Push: VAPID, sendNotification()'],
            ['node-telegram-bot-api', '0.67.0', isRu ? 'Telegram Bot API: onText, sendMessage, sendDocument' : 'Telegram Bot API: onText, sendMessage, sendDocument'],
            ['winston', '3.x', isRu ? 'Структурированное логирование: Console + File (logs/), ротация, уровни' : 'Structured logging: Console + File (logs/), rotation, levels'],
            ['swagger-jsdoc', '6.x', isRu ? 'Генерация OpenAPI 3.0 спецификации из JSDoc комментариев' : 'OpenAPI 3.0 spec generation from JSDoc comments'],
            ['swagger-ui-express', '5.x', isRu ? 'Swagger UI на /api-docs (интерактивная документация API)' : 'Swagger UI at /api-docs (interactive API docs)'],
            ['express-rate-limit', '7.x', isRu ? 'Rate limiting: 20 req/min для /api/auth/login' : 'Rate limiting: 20 req/min for /api/auth/login'],
            ['cookie-parser', '1.4.x', isRu ? 'Парсинг cookies (refresh token в httpOnly cookie)' : 'Cookie parsing (refresh token in httpOnly cookie)'],
          ]}
        />


        {/* ============================================================ */}
        {/* Section 22 — Environment Variables */}
        {/* ============================================================ */}
        <SectionTitle id="env">{isRu ? '22. Переменные окружения' : '22. Environment Variables'}</SectionTitle>
        <P>{isRu
          ? 'Переменные окружения в файле backend/.env. При отсутствии файла используются значения по умолчанию.'
          : 'Environment variables in backend/.env file. When file is missing, default values are used.'
        }</P>
        <Table
          headers={[isRu ? 'Переменная' : 'Variable', isRu ? 'По умолчанию' : 'Default', isRu ? 'Обязательно' : 'Required', isRu ? 'Описание' : 'Description']}
          rows={[
            ['DATABASE_URL', 'file:./dev.db', isRu ? 'Да' : 'Yes', isRu ? 'Путь к SQLite файлу (относительно prisma/). Prisma генерирует клиент по этому пути' : 'SQLite file path (relative to prisma/). Prisma generates client by this path'],
            ['JWT_SECRET', 'change-me-in-production', isRu ? 'Да' : 'Yes', isRu ? 'Секретный ключ для jwt.sign() и jwt.verify(). ОБЯЗАТЕЛЬНО сменить в продакшене! Используется для access token (24h) и refresh token (7d)' : 'Secret for jwt.sign() and jwt.verify(). MUST change in production! Used for access token (24h) and refresh token (7d)'],
            ['PORT', '3001', isRu ? 'Нет' : 'No', isRu ? 'HTTP-порт Express (фронт + API + Socket.IO). HTTPS-сервер всегда стартует на :443 при наличии сертификата в /project/.ssl/' : 'Express HTTP port (frontend + API + Socket.IO). HTTPS server always starts on :443 when certificate is present in /project/.ssl/'],
            ['NODE_ENV', 'development', isRu ? 'Нет' : 'No', isRu ? 'development: morgan dev, verbose errors. production: helmet strict, minimal errors' : 'development: morgan dev, verbose errors. production: helmet strict, minimal errors'],
            ['TELEGRAM_BOT_TOKEN', isRu ? '(пусто)' : '(empty)', isRu ? 'Нет' : 'No', isRu ? 'Токен от @BotFather. Если пусто -- TelegramBot не запускается, ReportScheduler не отправляет отчёты' : 'Token from @BotFather. If empty -- TelegramBot does not start, ReportScheduler does not send reports'],
            ['VAPID_PUBLIC_KEY', isRu ? '(пусто)' : '(empty)', isRu ? 'Нет' : 'No', isRu ? 'Публичный VAPID-ключ (Base64 URL-safe). Отдаётся фронтенду через GET /api/push/vapid-key' : 'Public VAPID key (Base64 URL-safe). Served to frontend via GET /api/push/vapid-key'],
            ['VAPID_PRIVATE_KEY', isRu ? '(пусто)' : '(empty)', isRu ? 'Нет' : 'No', isRu ? 'Приватный VAPID-ключ для подписи push-запросов (web-push library)' : 'Private VAPID key for signing push requests (web-push library)'],
            ['MONITORING_API_URL', isRu ? '(пусто)' : '(empty)', isRu ? 'Нет' : 'No', isRu ? 'URL внешнего CV API для MonitoringProxy. Если пусто -- live-режим использует демо-данные' : 'External CV API URL for MonitoringProxy. If empty -- live mode uses demo data'],
            ['MONITORING_POLL_INTERVAL', '10000', isRu ? 'Нет' : 'No', isRu ? 'Интервал опроса CV API в миллисекундах (по умолчанию 10 секунд)' : 'CV API polling interval in milliseconds (default 10 seconds)'],
            ['BACKUP_CRON', isRu ? '"0 */6 * * *"' : '"0 */6 * * *"', isRu ? 'Нет' : 'No', isRu ? 'Cron-выражение для BackupScheduler (по умолчанию каждые 6 часов)' : 'Cron expression for BackupScheduler (default every 6 hours)'],
            ['BACKUP_KEEP', '24', isRu ? 'Нет' : 'No', isRu ? 'Сколько последних снимков БД хранить, остальные удаляются ротацией' : 'How many recent DB snapshots to keep, the rest deleted by rotation'],
            ['RETENTION_DAYS', '30', isRu ? 'Нет' : 'No', isRu ? 'Окно хранения для MonitoringSnapshot и Event в днях. RetentionCleaner удаляет записи старше этого окна' : 'Retention window for MonitoringSnapshot and Event in days. RetentionCleaner deletes records older than this window'],
          ]}
        />

        <Sub>localStorage ({isRu ? 'фронтенд' : 'frontend'})</Sub>
        <Table
          headers={[isRu ? 'Ключ' : 'Key', isRu ? 'Тип' : 'Type', isRu ? 'Описание' : 'Description', isRu ? 'Используется' : 'Used by']}
          rows={[
            ['token', 'string', isRu ? 'JWT access token (24ч). Устанавливается при login, очищается при logout' : 'JWT access token (24h). Set on login, cleared on logout', 'AuthContext'],
            ['currentUser', 'JSON object', isRu ? 'Кеш пользователя для быстрого старта (не используется как источник правды)' : 'User cache for fast start (not used as source of truth)', 'AuthContext'],
            ['language', '"ru" | "en"', isRu ? 'Текущий язык интерфейса' : 'Current UI language', 'i18n'],
            ['theme', '"dark" | "light"', isRu ? 'Текущая тема оформления' : 'Current visual theme', 'ThemeContext'],
            ['dashboardPostsSettings', 'JSON', isRu ? 'Настройки Gantt: масштаб зума, выбранные фильтры, видимость колонок' : 'Gantt settings: zoom scale, selected filters, column visibility', 'DashboardPosts'],
            ['dashboardPostsSchedule', 'JSON', isRu ? 'Локальный кеш расписания ЗН (для быстрого рендеринга до загрузки API)' : 'Local WO schedule cache (for fast rendering before API loads)', 'DashboardPosts'],
          ]}
        />


        {/* ============================================================ */}
        {/* Section 23 — Seed Data */}
        {/* ============================================================ */}
        <SectionTitle id="seed">{isRu ? '23. Seed-данные' : '23. Seed Data'}</SectionTitle>
        <P>{isRu
          ? 'Seed загружается при инициализации БД: npx prisma db seed (файл backend/prisma/seed.js). Создаёт полный набор начальных данных для работы системы. Можно перезапустить для сброса к начальному состоянию.'
          : 'Seed loads on DB initialization: npx prisma db seed (file backend/prisma/seed.js). Creates a complete set of initial data for system operation. Can be re-run to reset to initial state.'
        }</P>

        <Sub>{isRu ? 'Пользователи' : 'Users'}</Sub>
        <Table
          headers={['Email', isRu ? 'Пароль' : 'Password', isRu ? 'Роль' : 'Role', isRu ? 'Имя' : 'Name', isRu ? 'Активен' : 'Active', isRu ? 'Описание' : 'Description']}
          rows={[
            ['admin@metricsai.up', 'admin123', 'admin', 'Admin MetricsAI', isRu ? 'Да' : 'Yes', isRu ? 'Полный доступ, все 23 страницы, все разрешения' : 'Full access, all 23 pages, all permissions'],
            ['demo@metricsai.up', 'demo12345', 'manager', isRu ? 'Генри Форд' : 'Henry Ford', isRu ? 'Да' : 'Yes', isRu ? 'Демо-аккаунт для презентаций, расширенный набор страниц' : 'Demo account for presentations, expanded page set'],
            ['manager@metricsai.up', 'demo123', 'manager', isRu ? 'Сергей Петров' : 'Sergey Petrov', isRu ? 'Да' : 'Yes', isRu ? 'Рабочий аккаунт менеджера, стандартный набор страниц' : 'Working manager account, standard page set'],
            ['mechanic@metricsai.up', 'demo123', 'mechanic', isRu ? 'Иван Козлов' : 'Ivan Kozlov', isRu ? 'Нет' : 'No', isRu ? 'Неактивный аккаунт механика (для тестов деактивации)' : 'Inactive mechanic account (for deactivation testing)'],
          ]}
        />

        <Sub>{isRu ? '5 ролей и 15 разрешений' : '5 Roles and 15 Permissions'}</Sub>
        <P>{isRu
          ? 'Seed создаёт 5 ролей (admin, director, manager, mechanic, viewer) и 15 базовых разрешений (view_dashboard, view_analytics, view_zones, view_posts, view_sessions, view_events, view_work_orders, view_recommendations, view_cameras, manage_zones, manage_work_orders, manage_users, manage_cameras, manage_roles, manage_settings). Каждая роль получает свой набор разрешений через RolePermission.'
          : 'Seed creates 5 roles (admin, director, manager, mechanic, viewer) and 15 base permissions (view_dashboard, view_analytics, view_zones, view_posts, view_sessions, view_events, view_work_orders, view_recommendations, view_cameras, manage_zones, manage_work_orders, manage_users, manage_cameras, manage_roles, manage_settings). Each role gets its permission set via RolePermission.'
        }</P>

        <Sub>{isRu ? '5 зон' : '5 Zones'}</Sub>
        <Table
          headers={[isRu ? 'Название' : 'Name', isRu ? 'Тип' : 'Type', isRu ? 'Описание' : 'Description']}
          rows={[
            [isRu ? 'Зона ремонта' : 'Repair Zone', 'repair', isRu ? 'Основная зона с 10 постами, автомобили на ремонте' : 'Main zone with 10 posts, vehicles being repaired'],
            [isRu ? 'Зона ожидания' : 'Waiting Zone', 'waiting', isRu ? 'Очередь автомобилей, ожидающих ремонта' : 'Queue of vehicles awaiting repair'],
            [isRu ? 'Зона въезда' : 'Entry Zone', 'entry', isRu ? 'Въездные ворота, приёмка автомобилей' : 'Entry gates, vehicle reception'],
            [isRu ? 'Парковка' : 'Parking', 'parking', isRu ? 'Парковка для завершённых и ожидающих авто' : 'Parking for completed and waiting vehicles'],
            [isRu ? 'Свободная зона' : 'Free Zone', 'free', isRu ? 'Территория без назначения' : 'Unassigned area'],
          ]}
        />

        <Sub>{isRu ? '10 постов' : '10 Posts'}</Sub>
        <Table
          headers={[isRu ? 'Пост' : 'Post', isRu ? 'Тип' : 'Type', isRu ? 'Назначение' : 'Purpose']}
          rows={[
            [isRu ? 'Пост 1-4 (грузовые)' : 'Posts 1-4 (heavy)', 'heavy', isRu ? 'Для грузовых автомобилей, расширенное оборудование' : 'For trucks, extended equipment'],
            [isRu ? 'Пост 5-8 (легковые)' : 'Posts 5-8 (light)', 'light', isRu ? 'Для легковых автомобилей, стандартное оборудование' : 'For cars, standard equipment'],
            [isRu ? 'Пост 9-10 (специальные)' : 'Posts 9-10 (special)', 'special', isRu ? 'Специализированные работы (диагностика, развал-схождение)' : 'Specialized work (diagnostics, alignment)'],
          ]}
        />

        <Sub>{isRu ? '10 камер' : '10 Cameras'}</Sub>
        <P>{isRu
          ? 'Seed создаёт 10 камер (cam01-cam10) с RTSP URL, каждая привязана к зоне через CameraZone с приоритетом. Камеры покрывают все 5 зон СТО.'
          : 'Seed creates 10 cameras (cam01-cam10) with RTSP URLs, each linked to a zone via CameraZone with priority. Cameras cover all 5 STO zones.'
        }</P>


        {/* ============================================================ */}
        {/* Section 24 — Monitoring & Live Mode */}
        {/* ============================================================ */}
        <SectionTitle id="monitoring">{isRu ? '24. Мониторинг и Live-режим' : '24. Monitoring & Live Mode'}</SectionTitle>
        <P>{isRu
          ? 'Система поддерживает два режима работы: demo (демонстрационный, данные из БД и предсказаний) и live (реальные данные от внешнего CV API). Переключение через настройки: PUT /api/monitoring/settings { mode: "demo" | "live" }.'
          : 'The system supports two operating modes: demo (demonstration, data from DB and predictions) and live (real data from external CV API). Switching via settings: PUT /api/monitoring/settings { mode: "demo" | "live" }.'
        }</P>

        <Sub>MonitoringProxy (340 LOC)</Sub>
        <P>{isRu
          ? 'MonitoringProxy (backend/src/services/monitoringProxy.js, 340 строк) -- ключевой сервис live-режима. Каждые 10 секунд опрашивает внешний CV API (MONITORING_API_URL из .env), получая JSON с текущим состоянием: номерные знаки автомобилей на каждом посту, статусы постов, время пребывания. Данные маппятся на внутреннюю модель:'
          : 'MonitoringProxy (backend/src/services/monitoringProxy.js, 340 LOC) -- key live mode service. Every 10 seconds polls external CV API (MONITORING_API_URL from .env), getting JSON with current state: license plates at each post, post statuses, stay durations. Data is mapped to the internal model:'
        }</P>
        <Table
          headers={[isRu ? 'CV API поле' : 'CV API Field', isRu ? 'Внутренний маппинг' : 'Internal Mapping', isRu ? 'Описание' : 'Description']}
          rows={[
            ['post.status', 'Post.status (free/occupied/active_work/occupied_no_work)', isRu ? 'Маппинг статусов от CV к внутренним' : 'Status mapping from CV to internal'],
            ['post.plate', 'PostStay.plateNumber, VehicleSession.plateNumber', isRu ? 'Номерной знак автомобиля на посту' : 'License plate at post'],
            ['post.duration', 'PostStay.activeTime', isRu ? 'Время пребывания на посту (секунды)' : 'Stay duration at post (seconds)'],
            ['zone.vehicles[]', 'ZoneStay records', isRu ? 'Список авто в зоне' : 'List of vehicles in zone'],
          ]}
        />
        <P>{isRu
          ? 'В live-режиме Dashboard и MapViewer показывают реальные данные. Страница LiveDebug (доступна admin) показывает сырые ответы от CV API, результат маппинга, таймстемпы опроса и ошибки. При переключении режима эмитится Socket.IO событие settings:changed и все клиенты обновляют данные. Если MONITORING_API_URL не задан -- live-режим использует демо-данные.'
          : 'In live mode, Dashboard and MapViewer show real data. LiveDebug page (admin only) shows raw CV API responses, mapping results, polling timestamps and errors. On mode switch, Socket.IO settings:changed event is emitted and all clients refresh. If MONITORING_API_URL is not set -- live mode uses demo data.'
        }</P>

        <Sub>{isRu ? 'Эндпоинты мониторинга и replay' : 'Monitoring & Replay Endpoints'}</Sub>
        <Table
          headers={[isRu ? 'Метод' : 'Method', isRu ? 'Путь' : 'Path', isRu ? 'Описание' : 'Description']}
          rows={[
            ['GET', '/api/monitoring/state', isRu ? 'Текущее состояние всех зон и постов (последний снимок MonitoringCurrent)' : 'Current state of all zones and posts (latest MonitoringCurrent snapshot)'],
            ['GET', '/api/monitoring/cameras', isRu ? 'Данные от внешнего CV по камерам (последний ответ MonitoringProxy)' : 'External CV camera data (last MonitoringProxy response)'],
            ['GET', '/api/monitoring/state/:zoneName', isRu ? 'Текущее состояние конкретной зоны' : 'Current state of specific zone'],
            ['GET', '/api/monitoring/raw', isRu ? 'Сырой ответ от внешнего CV API (для отладки на странице LiveDebug)' : 'Raw external CV API response (for LiveDebug page)'],
            ['GET', '/api/monitoring/history?from=&to=', isRu ? 'Исторические снимки MonitoringSnapshot за диапазон. Используется для построения timeline' : 'Historical MonitoringSnapshot for range. Used for building timeline'],
            ['GET', '/api/monitoring/zone-history/:zoneName', isRu ? 'История конкретной зоны: периоды занятости, события входа/выхода' : 'Specific zone history: occupancy periods, enter/exit events'],
            ['GET', '/api/monitoring/post-history/:postNumber', isRu ? 'История конкретного поста: периоды статусов, ЗН, работники' : 'Specific post history: status periods, WOs, workers'],
            ['GET', '/api/monitoring/full-history', isRu ? 'Полная история по всем зонам и постам в одном запросе (с фильтрами по времени)' : 'Full history for all zones and posts in one query (with time filters)'],
            ['GET', '/api/monitoring/db-stats', isRu ? 'Статистика БД мониторинга: кол-во MonitoringSnapshot, диапазон времени, размер' : 'Monitoring DB stats: MonitoringSnapshot count, time range, size'],
            ['GET', '/api/monitoring/db-current', isRu ? 'Содержимое таблицы MonitoringCurrent (для гидратации)' : 'MonitoringCurrent table content (for hydration)'],
            ['GET', '/api/monitoring/health', isRu ? 'Здоровье связки monitoring: статус MonitoringProxy, lastPollAt, ошибки опроса' : 'Monitoring stack health: MonitoringProxy status, lastPollAt, polling errors'],
            ['GET', '/api/replay/range', isRu ? 'Доступный диапазон replay: { minTime, maxTime } из MonitoringSnapshot' : 'Available replay range: { minTime, maxTime } from MonitoringSnapshot'],
            ['GET', '/api/replay/window?from=&to=&step=', isRu ? 'Окно агрегированных снапшотов для воспроизведения (используется ReplayPanel и MapViewer)' : 'Window of aggregated snapshots for playback (used by ReplayPanel and MapViewer)'],
            ['GET', '/api/settings/mode', isRu ? 'Текущий режим: { mode: "demo" | "live" }' : 'Current mode: { mode: "demo" | "live" }'],
            ['PUT', '/api/settings/mode', isRu ? 'Изменить режим. demo -> запуск demo-генератора, live -> запуск MonitoringProxy. Эмитит settings:changed' : 'Change mode. demo -> start demo generator, live -> start MonitoringProxy. Emits settings:changed'],
          ]}
        />

        <Sub>{isRu ? 'Replay-режим (детально)' : 'Replay Mode (detailed)'}</Sub>
        <P>{isRu
          ? 'Replay-режим позволяет "перемотать" состояние СТО на произвольный момент в прошлом и проиграть события в ускоренном темпе. Архитектурно это работает так: (1) MonitoringProxy постоянно пишет MonitoringSnapshot через каждые 10с в live-режиме; (2) ReplayPanel на MapViewer запрашивает GET /api/replay/range и узнаёт доступный диапазон; (3) при выборе диапазона делается GET /api/replay/window с from/to/step -- бэкенд отдаёт массив агрегированных снапшотов; (4) MapViewer рендерит карту по выбранному снапшоту вместо текущего состояния, цвета постов и счётчики обновляются как при live-режиме, но из истории. Когда replay активен, Socket.IO события игнорируются (карта в read-only состоянии).'
          : 'Replay mode allows "rewinding" STO state to any past moment and playing events at accelerated pace. Architecturally: (1) MonitoringProxy continuously writes MonitoringSnapshot every 10s in live mode; (2) ReplayPanel on MapViewer queries GET /api/replay/range and gets available range; (3) when range is selected, GET /api/replay/window is called with from/to/step -- backend returns aggregated snapshot array; (4) MapViewer renders the map by selected snapshot instead of current state, post colors and counters update as in live mode but from history. When replay is active, Socket.IO events are ignored (map in read-only state).'
        }</P>


        {/* ============================================================ */}
        {/* Section 25 — Telegram Bot */}
        {/* ============================================================ */}
        <SectionTitle id="telegram">{isRu ? '25. Telegram-бот' : '25. Telegram Bot'}</SectionTitle>
        <P>{isRu
          ? 'Telegram-бот (backend/src/services/telegramBot.js) обеспечивает оперативный доступ к данным СТО через мессенджер. Запускается при наличии TELEGRAM_BOT_TOKEN в .env. Использует библиотеку node-telegram-bot-api в режиме polling.'
          : 'Telegram bot (backend/src/services/telegramBot.js) provides quick STO data access via messenger. Starts when TELEGRAM_BOT_TOKEN is set in .env. Uses node-telegram-bot-api library in polling mode.'
        }</P>

        <Sub>{isRu ? '5 команд' : '5 Commands'}</Sub>
        <Table
          headers={[isRu ? 'Команда' : 'Command', isRu ? 'Описание' : 'Description', isRu ? 'Пример ответа' : 'Example Response']}
          rows={[
            ['/start', isRu ? 'Привязка Telegram-аккаунта к пользователю системы. Запрашивает email, создаёт TelegramLink (chatId + userId). После привязки доступны остальные команды' : 'Bind Telegram account to system user. Asks for email, creates TelegramLink (chatId + userId). After binding, other commands available', isRu ? '"Введите ваш email для привязки аккаунта"' : '"Enter your email to bind account"'],
            ['/status', isRu ? 'Текущий статус СТО: количество авто, занятые/свободные посты, активные ЗН, рекомендации' : 'Current STO status: vehicle count, occupied/free posts, active WOs, recommendations', isRu ? '"СТО: 7 авто, 6/10 постов заняты, 4 активных ЗН"' : '"STO: 7 vehicles, 6/10 posts occupied, 4 active WOs"'],
            ['/post N', isRu ? 'Статус конкретного поста (N = 1-10): статус, авто, ЗН, работник, время' : 'Specific post status (N = 1-10): status, vehicle, WO, worker, time', isRu ? '"/post 3" -> "Пост 3: active_work, А123БВ, ЗН-0042, 1ч 15мин"' : '"/post 3" -> "Post 3: active_work, A123BV, WO-0042, 1h 15min"'],
            ['/free', isRu ? 'Список свободных постов с временем простоя' : 'List of free posts with idle time', isRu ? '"Свободные посты: 2 (45мин), 7 (12мин), 9 (2ч)"' : '"Free posts: 2 (45min), 7 (12min), 9 (2h)"'],
            ['/report', isRu ? 'Генерация и отправка сводного отчёта за текущий день в формате XLSX (как Telegram-документ)' : 'Generate and send daily summary report in XLSX format (as Telegram document)', isRu ? 'Отправляет .xlsx файл как документ Telegram' : 'Sends .xlsx file as Telegram document'],
          ]}
        />

        <Sub>{isRu ? 'Уведомления и доставка отчётов' : 'Notifications & Report Delivery'}</Sub>
        <P>{isRu
          ? 'Telegram-бот также используется ReportScheduler для автоматической доставки XLSX-отчётов. Когда cron-задание срабатывает, ReportScheduler генерирует XLSX через serverExport.js и отправляет его как документ через Telegram Bot API (bot.sendDocument). Получатель определяется полем telegramChatId в ReportSchedule. Если у пользователя нет TelegramLink -- отчёт не отправляется, но логируется ошибка.'
          : 'The Telegram bot is also used by ReportScheduler for automatic XLSX report delivery. When a cron job triggers, ReportScheduler generates XLSX via serverExport.js and sends it as a document via Telegram Bot API (bot.sendDocument). Recipient is determined by telegramChatId in ReportSchedule. If user has no TelegramLink -- report is not sent but error is logged.'
        }</P>

        <Sub>{isRu ? 'Модель TelegramLink' : 'TelegramLink Model'}</Sub>
        <P>{isRu
          ? 'Таблица TelegramLink связывает Telegram chatId (уникальный идентификатор чата) с userId пользователя системы. Создаётся при выполнении /start с корректным email. Одному пользователю может соответствовать один chatId. Бот проверяет наличие TelegramLink перед выполнением всех команд кроме /start.'
          : 'TelegramLink table links Telegram chatId (unique chat identifier) with system userId. Created when executing /start with a valid email. One user can have one chatId. Bot checks TelegramLink existence before all commands except /start.'
        }</P>


        {/* ============================================================ */}
        {/* Section 26 — Audit System */}
        {/* ============================================================ */}
        <SectionTitle id="audit">{isRu ? '26. Система аудита' : '26. Audit System'}</SectionTitle>
        <P>{isRu
          ? 'Система аудита отслеживает все мутирующие операции (create, update, delete) через middleware auditLog.js. Каждая запись содержит полную информацию о том, кто, что и когда изменил.'
          : 'The audit system tracks all mutating operations (create, update, delete) via auditLog.js middleware. Each record contains complete information about who changed what and when.'
        }</P>

        <Sub>{isRu ? 'Что логируется' : 'What Gets Logged'}</Sub>
        <Table
          headers={[isRu ? 'Поле' : 'Field', isRu ? 'Тип' : 'Type', isRu ? 'Описание' : 'Description']}
          rows={[
            ['action', 'String', isRu ? 'Тип операции: create, update, delete' : 'Operation type: create, update, delete'],
            ['entity', 'String', isRu ? 'Тип сущности: user, post, zone, workOrder, shift, camera, mapLayout, location, reportSchedule, и др.' : 'Entity type: user, post, zone, workOrder, shift, camera, mapLayout, location, reportSchedule, etc.'],
            ['entityId', 'String', isRu ? 'ID изменённой записи' : 'ID of changed record'],
            ['oldData', 'JSON', isRu ? 'Состояние ДО операции (null для create). Сериализуется из Prisma-объекта' : 'State BEFORE operation (null for create). Serialized from Prisma object'],
            ['newData', 'JSON', isRu ? 'Состояние ПОСЛЕ операции (null для delete). Сериализуется из res.json() ответа' : 'State AFTER operation (null for delete). Serialized from res.json() response'],
            ['userId', 'Int', isRu ? 'ID пользователя, выполнившего операцию (из req.user)' : 'ID of user who performed the operation (from req.user)'],
            ['ip', 'String', isRu ? 'IP-адрес клиента (req.ip)' : 'Client IP address (req.ip)'],
            ['userAgent', 'String', isRu ? 'User-Agent браузера (req.headers[\'user-agent\'])' : 'Browser User-Agent (req.headers[\'user-agent\'])'],
            ['createdAt', 'DateTime', isRu ? 'Временная метка операции (автоматически Prisma)' : 'Operation timestamp (automatic by Prisma)'],
          ]}
        />

        <Sub>{isRu ? 'Как работает middleware' : 'How Middleware Works'}</Sub>
        <P>{isRu
          ? 'auditLog(entityType) -- middleware-фабрика. Принимает строку-идентификатор типа сущности (например, "user", "post"). Перехватывает оригинальный res.json(): (1) для PUT/DELETE -- загружает текущее состояние записи (oldData) через Prisma findUnique перед выполнением handler; (2) оборачивает res.json() -- при вызове handler, middleware перехватывает ответ, извлекает newData, и создаёт AuditLog запись. Для POST (create) oldData = null. Для DELETE newData = null.'
          : 'auditLog(entityType) -- middleware factory. Takes entity type string (e.g., "user", "post"). Intercepts original res.json(): (1) for PUT/DELETE -- loads current record state (oldData) via Prisma findUnique before handler execution; (2) wraps res.json() -- when handler executes, middleware intercepts response, extracts newData, and creates AuditLog record. For POST (create) oldData = null. For DELETE newData = null.'
        }</P>

        <Sub>{isRu ? 'API аудит-лога' : 'Audit Log API'}</Sub>
        <Table
          headers={[isRu ? 'Метод' : 'Method', isRu ? 'Путь' : 'Path', isRu ? 'Описание' : 'Description']}
          rows={[
            ['GET', '/api/audit-log', isRu ? 'Список записей с фильтрами: ?userId=, ?action=, ?entity=, ?from=, ?to=, ?page=, ?limit=. Требует authenticate. Сортировка по createdAt DESC' : 'Record list with filters: ?userId=, ?action=, ?entity=, ?from=, ?to=, ?page=, ?limit=. Requires authenticate. Sorted by createdAt DESC'],
            ['GET', '/api/audit-log/export/csv', isRu ? 'CSV-экспорт аудит-лога с теми же фильтрами. Content-Disposition: attachment. Содержит все поля AuditLog' : 'CSV export of audit log with same filters. Content-Disposition: attachment. Contains all AuditLog fields'],
          ]}
        />

        <Sub>{isRu ? 'Индексы БД' : 'DB Indexes'}</Sub>
        <P>{isRu
          ? 'Для быстрого поиска AuditLog индексируется по: userId (поиск по пользователю), action (фильтр по типу операции), entity (фильтр по типу сущности), createdAt (фильтр по дате, сортировка). Составной индекс [entity, entityId] для поиска истории конкретной записи.'
          : 'For fast lookups, AuditLog is indexed by: userId (user search), action (operation type filter), entity (entity type filter), createdAt (date filter, sorting). Composite index [entity, entityId] for searching specific record history.'
        }</P>

        <Sub>{isRu ? 'Страница Audit' : 'Audit Page'}</Sub>
        <P>{isRu
          ? 'Страница Audit.jsx на фронтенде отображает аудит-лог в виде таблицы с фильтрами (dropdown: пользователь, действие, сущность; date range: период). Каждая строка раскрывается для показа diff (oldData vs newData в JSON). Кнопка CSV Export скачивает отфильтрованные данные. Доступна только пользователям с правами (обычно admin).'
          : 'The Audit.jsx page on the frontend displays the audit log as a table with filters (dropdowns: user, action, entity; date range: period). Each row expands to show diff (oldData vs newData in JSON). CSV Export button downloads filtered data. Available only to users with permissions (usually admin).'
        }</P>


        {/* Footer */}
        <div className="mt-10 pt-4 border-t text-center" style={{ borderColor: 'var(--border-glass)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            MetricsAiUp — {isRu ? 'Техническая документация v3.0 | ' : 'Technical Documentation v3.0 | '}{generatedDate}
            {' | '}{isRu ? '26 секций' : '26 sections'}
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
