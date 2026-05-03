import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock react-router-dom (keep actual, override hooks) ─────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ postNumber: '1', workerName: 'Test Worker' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    useNavigate: () => vi.fn(),
  };
});

// ── Mock contexts ───────────────────────────────────────────────────
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: '1', email: 'admin@test.com', firstName: 'Admin', lastName: 'Test',
      role: 'admin', roles: ['admin'],
      pages: [
        'dashboard','dashboard-posts','posts-detail','sessions','work-orders',
        'shifts','events','analytics','cameras','data-1c',
        'users','map-view','map-editor','audit','health','my-post',
        'report-schedule','tech-docs','live-debug',
      ],
      permissions: [
        'view_dashboard','view_analytics','manage_users','manage_zones',
        'manage_cameras','view_posts','view_sessions','view_events',
        'view_work_orders','manage_work_orders','view_recommendations',
        'manage_roles','manage_settings','manage_shifts',
      ],
      hiddenElements: [],
    },
    loading: false,
    api: {
      get: vi.fn().mockResolvedValue({ data: [] }),
      post: vi.fn().mockResolvedValue({ data: {} }),
      put: vi.fn().mockResolvedValue({ data: {} }),
      delete: vi.fn().mockResolvedValue({ data: {} }),
    },
    hasPermission: () => true,
    isElementVisible: () => true,
    appMode: 'demo',
    toggleAppMode: vi.fn(),
    logout: vi.fn(),
    login: vi.fn().mockResolvedValue({ firstName: 'Admin' }),
  }),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

// ── Mock i18n ───────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k) => k,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }) => children,
}));

// ── Mock hooks ──────────────────────────────────────────────────────
vi.mock('../hooks/useSocket', () => ({
  usePolling: vi.fn(),
  useSocket: vi.fn(),
  useSubscribe: vi.fn(),
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
  getSocket: () => null,
  useSocketStatus: () => false,
}));

vi.mock('../hooks/useCameraStatus', () => ({
  default: () => ({}),
  useCameraStatus: () => ({}),
}));

vi.mock('../hooks/useWorkOrderTimer', () => {
  const timerValue = {
    elapsedMs: 0, percentUsed: 0, warningLevel: 'none',
    isPaused: false, isRunning: false,
    start: vi.fn(), pause: vi.fn(), resume: vi.fn(), complete: vi.fn(),
  };
  return {
    default: () => timerValue,
    useWorkOrderTimer: () => timerValue,
  };
});

vi.mock('../hooks/useAsync', () => ({
  default: () => ({ data: null, loading: false, error: null, refetch: vi.fn() }),
}));

// ── Mock recharts ───────────────────────────────────────────────────
vi.mock('recharts', () => {
  const Wrapper = ({ children }) => <div>{children}</div>;
  const Noop = () => null;
  return {
    ResponsiveContainer: Wrapper,
    LineChart: Wrapper,
    BarChart: Wrapper,
    PieChart: Wrapper,
    AreaChart: Wrapper,
    ComposedChart: Wrapper,
    RadialBarChart: Wrapper,
    Line: Noop, Bar: Noop, Pie: Noop, Area: Noop,
    XAxis: Noop, YAxis: Noop, CartesianGrid: Noop,
    Tooltip: Noop, Legend: Noop, Cell: Noop, ReferenceLine: Noop,
  };
});

// ── Mock react-konva ────────────────────────────────────────────────
vi.mock('react-konva', () => {
  const Wrapper = ({ children }) => <div>{children}</div>;
  const Noop = () => null;
  return {
    Stage: Wrapper, Layer: Wrapper, Group: Wrapper,
    Rect: Noop, Circle: Noop, Text: Noop, Line: Noop,
    Arrow: Noop, Image: Noop, Transformer: Noop, Wedge: Noop,
    Arc: Noop, RegularPolygon: Noop, Ring: Noop, Star: Noop,
    Tag: Noop, Label: Noop, Path: Noop, TextPath: Noop,
    Ellipse: Noop, Sprite: Noop, Shape: Noop,
  };
});

// ── Mock konva ──────────────────────────────────────────────────────
vi.mock('konva', () => ({
  default: {
    Image: class {},
    Util: { createCanvasElement: () => document.createElement('canvas') },
  },
}));

// ── Mock hls.js ─────────────────────────────────────────────────────
vi.mock('hls.js', () => ({
  default: class {
    static isSupported() { return false; }
    loadSource = vi.fn();
    attachMedia = vi.fn();
    destroy = vi.fn();
    on = vi.fn();
  },
}));

// ── Mock qrcode.react ───────────────────────────────────────────────
vi.mock('qrcode.react', () => ({
  QRCodeSVG: () => <svg data-testid="qr" />,
}));

// ── Mock html2canvas ────────────────────────────────────────────────
vi.mock('html2canvas', () => ({ default: vi.fn() }));

// ── Mock jspdf ──────────────────────────────────────────────────────
vi.mock('jspdf', () => ({
  default: class {
    addImage = vi.fn(); save = vi.fn(); addPage = vi.fn();
    setFontSize = vi.fn(); text = vi.fn();
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
  },
}));

// ── Mock xlsx ───────────────────────────────────────────────────────
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
    sheet_add_aoa: vi.fn(),
    sheet_to_json: vi.fn(() => []),
    aoa_to_sheet: vi.fn(() => ({})),
    decode_range: vi.fn(() => ({ s: { c: 0, r: 0 }, e: { c: 5, r: 10 } })),
  },
  read: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
  writeFile: vi.fn(),
}));

// ── Mock lucide-react (use real exports — they are lightweight SVG components) ──
// No mock needed — real lucide-react icons render fine in jsdom.

// ── Mock socket.io-client ───────────────────────────────────────────
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(), off: vi.fn(), emit: vi.fn(),
    connect: vi.fn(), disconnect: vi.fn(), connected: false,
  })),
}));

// ── Mock web-vitals ─────────────────────────────────────────────────
vi.mock('web-vitals', () => ({
  getCLS: vi.fn(), getFID: vi.fn(), getLCP: vi.fn(),
  getFCP: vi.fn(), getTTFB: vi.fn(),
}));

// ── Helper wrapper ──────────────────────────────────────────────────
const PageWrapper = ({ children }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

// ── Import all pages ────────────────────────────────────────────────
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import DashboardPosts from '../pages/DashboardPosts';
import PostsDetail from '../pages/PostsDetail';
import Sessions from '../pages/Sessions';
import WorkOrders from '../pages/WorkOrders';
import Events from '../pages/Events';
import Analytics from '../pages/Analytics';
import Data1C from '../pages/Data1C';
import Cameras from '../pages/Cameras';
import Users from '../pages/Users';
import MapEditor from '../pages/MapEditor';
import MapViewer from '../pages/MapViewer';
import Shifts from '../pages/Shifts';
import Audit from '../pages/Audit';
import MyPost from '../pages/MyPost';
import Health from '../pages/Health';
import WorkerStats from '../pages/WorkerStats';
import PostHistory from '../pages/PostHistory';
import ReportSchedule from '../pages/ReportSchedule';
import TechDocs from '../pages/TechDocs';
import LiveDebug from '../pages/LiveDebug';

// ── Tests ───────────────────────────────────────────────────────────
describe('Page Rendering — Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Login renders without crashing', () => {
    render(<PageWrapper><Login /></PageWrapper>);
  });

  it('Dashboard renders without crashing', () => {
    render(<PageWrapper><Dashboard /></PageWrapper>);
  });

  it('DashboardPosts renders without crashing', () => {
    render(<PageWrapper><DashboardPosts /></PageWrapper>);
  });

  it('PostsDetail renders without crashing', () => {
    render(<PageWrapper><PostsDetail /></PageWrapper>);
  });

  it('Sessions renders without crashing', () => {
    render(<PageWrapper><Sessions /></PageWrapper>);
  });

  it('WorkOrders renders without crashing', () => {
    render(<PageWrapper><WorkOrders /></PageWrapper>);
  });

  it('Events renders without crashing', () => {
    render(<PageWrapper><Events /></PageWrapper>);
  });

  it('Analytics renders without crashing', () => {
    render(<PageWrapper><Analytics /></PageWrapper>);
  });

  it('Data1C renders without crashing', () => {
    render(<PageWrapper><Data1C /></PageWrapper>);
  });

  it('Cameras renders without crashing', () => {
    render(<PageWrapper><Cameras /></PageWrapper>);
  });

  it('Users renders without crashing', () => {
    render(<PageWrapper><Users /></PageWrapper>);
  });

  it('MapEditor renders without crashing', () => {
    render(<PageWrapper><MapEditor /></PageWrapper>);
  });

  it('MapViewer renders without crashing', () => {
    render(<PageWrapper><MapViewer /></PageWrapper>);
  });

  it('Shifts renders without crashing', () => {
    render(<PageWrapper><Shifts /></PageWrapper>);
  });

  it('Audit renders without crashing', () => {
    render(<PageWrapper><Audit /></PageWrapper>);
  });

  it('MyPost renders without crashing', () => {
    render(<PageWrapper><MyPost /></PageWrapper>);
  });

  it('Health renders without crashing', () => {
    render(<PageWrapper><Health /></PageWrapper>);
  });

  it('WorkerStats renders without crashing', () => {
    render(<PageWrapper><WorkerStats /></PageWrapper>);
  });

  it('PostHistory renders without crashing', () => {
    render(<PageWrapper><PostHistory /></PageWrapper>);
  });

  it('ReportSchedule renders without crashing', () => {
    render(<PageWrapper><ReportSchedule /></PageWrapper>);
  });

  it('TechDocs renders without crashing', () => {
    render(<PageWrapper><TechDocs /></PageWrapper>);
  });

  it('LiveDebug renders without crashing', () => {
    render(<PageWrapper><LiveDebug /></PageWrapper>);
  });
});
