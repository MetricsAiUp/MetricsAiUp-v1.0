import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'en', changeLanguage: vi.fn() } }),
}));

vi.mock('react-router-dom', () => ({
  Outlet: () => <div data-testid="outlet">Outlet Content</div>,
  useLocation: () => ({ pathname: '/', search: '' }),
  useNavigate: () => vi.fn(),
  NavLink: ({ children, to }) => (
    <a href={to}>{typeof children === 'function' ? children({ isActive: false }) : children}</a>
  ),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'admin', pages: [], firstName: 'Test', lastName: 'User' },
    logout: vi.fn(),
    hasPermission: () => true,
    api: { get: vi.fn(() => Promise.resolve({ data: {} })) },
    appMode: 'demo',
    toggleAppMode: vi.fn(),
  }),
}));

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

vi.mock('../../hooks/useSocket', () => ({
  useSocketStatus: () => true,
  useSocket: vi.fn(),
}));

vi.mock('../NotificationCenter', () => ({
  default: () => <div data-testid="notification-center">NotificationCenter</div>,
}));

vi.mock('../Sidebar', () => ({
  default: () => <nav data-testid="sidebar">Sidebar</nav>,
}));

vi.mock('lucide-react', () => {
  const icon = (props) => <span data-testid="icon" />;
  return {
    Sun: icon, Moon: icon, Globe: icon, LogOut: icon,
    Wifi: icon, WifiOff: icon, Menu: icon, X: icon,
    PanelLeftClose: icon, PanelLeftOpen: icon,
  };
});

import Layout from '../Layout';

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Sidebar', () => {
    render(<Layout />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('renders Outlet for child routes', () => {
    render(<Layout />);
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
    expect(screen.getByText('Outlet Content')).toBeInTheDocument();
  });

  it('renders Header with user initials', () => {
    render(<Layout />);
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('renders user full name', () => {
    render(<Layout />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('renders notification center in header', () => {
    render(<Layout />);
    expect(screen.getByTestId('notification-center')).toBeInTheDocument();
  });

  it('renders main content area', () => {
    const { container } = render(<Layout />);
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
  });

  it('has flex layout structure', () => {
    const { container } = render(<Layout />);
    const root = container.firstChild;
    expect(root).toHaveClass('flex');
    expect(root).toHaveClass('min-h-screen');
  });
});
