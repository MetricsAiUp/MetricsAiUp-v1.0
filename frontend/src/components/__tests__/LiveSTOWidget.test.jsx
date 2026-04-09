import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import LiveSTOWidget from '../LiveSTOWidget';

const mockGet = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    api: { get: mockGet },
    user: { role: 'admin' },
  }),
}));

vi.mock('../../hooks/useSocket', () => ({
  usePolling: vi.fn(),
}));

vi.mock('../../constants', () => ({
  POST_STATUS_COLORS: {
    free: '#22c55e',
    occupied: '#ef4444',
    occupied_no_work: '#f59e0b',
    active_work: '#6366f1',
  },
}));

describe('LiveSTOWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing initially when data is null (loading state)', () => {
    mockGet.mockResolvedValue({ data: null });
    const { container } = render(<LiveSTOWidget />);
    // Initially data is null, component returns null
    expect(container.innerHTML).toBe('');
  });

  it('renders title and content when data loads', async () => {
    const mockData = {
      summary: { working: 3, idle: 2, free: 5 },
      posts: [
        { id: 1, name: 'Post 1', status: 'free', plateNumber: null, startTime: null },
        { id: 2, name: 'Post 2', status: 'occupied', plateNumber: 'A123BC', startTime: '2026-04-09T08:00:00Z' },
      ],
      vehiclesOnSite: 5,
    };
    mockGet.mockResolvedValue({ data: mockData });

    const { findByText } = render(<LiveSTOWidget />);
    const title = await findByText('liveWidget.title');
    expect(title).toBeInTheDocument();
  });
});
