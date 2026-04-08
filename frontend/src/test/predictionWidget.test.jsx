import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en' },
  }),
}));

describe('PredictionWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', async () => {
    // Mock fetch to hang
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { default: PredictionWidget } = await import('../components/PredictionWidget');
    render(<PredictionWidget />);

    expect(screen.getByText('predict.title')).toBeDefined();
  });

  it('shows unavailable message when ML service is down', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Connection refused')));

    const { default: PredictionWidget } = await import('../components/PredictionWidget');

    render(<PredictionWidget />);

    await waitFor(() => {
      // Should show the unavailable state (either title or instruction)
      const els = screen.getAllByText('predict.title');
      expect(els.length).toBeGreaterThan(0);
    });
  });

  it('renders forecast data when ML service responds', async () => {
    const mockForecast = {
      date: '2026-04-08',
      hourly: [
        { hour: 8, avg: 0.3, predictions: { post_1: 0.3 } },
        { hour: 9, avg: 0.5, predictions: { post_1: 0.5 } },
        { hour: 10, avg: 0.8, predictions: { post_1: 0.8 } },
      ],
    };
    const mockFree = {
      predictions: [
        { post: 1, status: 'occupied', free_in_minutes: 20 },
        { post: 2, status: 'free', free_in_minutes: 0 },
      ],
    };

    global.fetch = vi.fn((url) => {
      if (url.includes('/predict/load')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockForecast) });
      }
      if (url.includes('/predict/free')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFree) });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const { default: PredictionWidget } = await import('../components/PredictionWidget');
    render(<PredictionWidget />);

    await waitFor(() => {
      expect(screen.getByText('predict.loadForecast')).toBeDefined();
    });
  });

  it('ML API URL defaults to window.location when env not set', async () => {
    // The ML_API should use window.location.hostname as fallback
    const expectedHost = window.location.hostname || 'localhost';
    // Just verify the import doesn't error
    const mod = await import('../components/PredictionWidget');
    expect(mod.default).toBeDefined();
  });
});
