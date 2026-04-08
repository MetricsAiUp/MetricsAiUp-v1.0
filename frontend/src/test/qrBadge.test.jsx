import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, size }) => (
    <svg data-testid="qr-code" data-value={value} width={size} height={size}>
      <rect />
    </svg>
  ),
}));

describe('QRBadge', () => {
  it('renders QR code with session URL', async () => {
    const { default: QRBadge } = await import('../components/QRBadge');
    const onClose = vi.fn();

    render(
      <QRBadge
        sessionId="test-session-123"
        plateNumber="A123BC77"
        entryTime="2026-04-08T10:00:00Z"
        onClose={onClose}
      />
    );

    const qr = screen.getByTestId('qr-code');
    expect(qr).toBeDefined();
    expect(qr.getAttribute('data-value')).toContain('test-session-123');
  });

  it('displays plate number', async () => {
    const { default: QRBadge } = await import('../components/QRBadge');

    render(
      <QRBadge
        sessionId="s1"
        plateNumber="X789YZ99"
        onClose={() => {}}
      />
    );

    expect(screen.getByText('X789YZ99')).toBeDefined();
  });

  it('calls onClose when clicking overlay', async () => {
    const { default: QRBadge } = await import('../components/QRBadge');
    const onClose = vi.fn();

    const { container } = render(
      <QRBadge sessionId="s1" plateNumber="A123BC" onClose={onClose} />
    );

    // Click the overlay (first fixed div)
    fireEvent.click(container.querySelector('.fixed'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows print button', async () => {
    const { default: QRBadge } = await import('../components/QRBadge');

    render(
      <QRBadge sessionId="s1" plateNumber="A123BC" onClose={() => {}} />
    );

    expect(screen.getByText('qr.print')).toBeDefined();
  });
});
