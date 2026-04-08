import { describe, it, expect, vi } from 'vitest';

// Mock hooks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { firstName: 'Test', role: 'mechanic', pages: ['my-post'] },
    api: { get: vi.fn().mockResolvedValue({ data: {} }) },
  }),
}));

vi.mock('../hooks/useSocket', () => ({
  usePolling: vi.fn(),
}));

describe('MyPost page', () => {
  it('exports a default component', async () => {
    const mod = await import('../pages/MyPost');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
