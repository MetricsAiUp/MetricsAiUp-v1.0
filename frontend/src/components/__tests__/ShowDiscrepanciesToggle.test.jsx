import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const authMock = vi.hoisted(() => ({
  user: { id: '1', uiState: { showDiscrepancies: false } },
  api: { patch: vi.fn() },
  updateCurrentUser: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authMock,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k }),
}));

import ShowDiscrepanciesToggle from '../ShowDiscrepanciesToggle';

describe('ShowDiscrepanciesToggle', () => {
  beforeEach(() => {
    authMock.user = { id: '1', uiState: { showDiscrepancies: false } };
    authMock.api.patch = vi.fn().mockResolvedValue({ data: { uiState: { showDiscrepancies: true } } });
    authMock.updateCurrentUser = vi.fn();
  });

  it('renders nothing when user is null', () => {
    authMock.user = null;
    const { container } = render(<ShowDiscrepanciesToggle />);
    expect(container.firstChild).toBeNull();
  });

  it('reads boolean state from uiState object', () => {
    authMock.user = { id: '1', uiState: { showDiscrepancies: true } };
    render(<ShowDiscrepanciesToggle />);
    expect(screen.getByText('discrepancies.toggle.on')).toBeTruthy();
  });

  it('parses uiState from JSON string', () => {
    authMock.user = { id: '1', uiState: JSON.stringify({ showDiscrepancies: true }) };
    render(<ShowDiscrepanciesToggle />);
    expect(screen.getByText('discrepancies.toggle.on')).toBeTruthy();
  });

  it('renders "off" label when disabled', () => {
    authMock.user = { id: '1', uiState: { showDiscrepancies: false } };
    render(<ShowDiscrepanciesToggle />);
    expect(screen.getByText('discrepancies.toggle.off')).toBeTruthy();
  });

  it('toggles via api.patch and updates current user on success', async () => {
    render(<ShowDiscrepanciesToggle />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(authMock.api.patch).toHaveBeenCalledWith(
      '/api/users/me/ui-state',
      { patch: { showDiscrepancies: true } },
    ));
    expect(authMock.updateCurrentUser).toHaveBeenCalled();
  });

  it('silently ignores API failure', async () => {
    authMock.api.patch = vi.fn().mockRejectedValue(new Error('500'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<ShowDiscrepanciesToggle />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(warnSpy).toHaveBeenCalled());
    expect(authMock.updateCurrentUser).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('handles malformed uiState string gracefully', () => {
    authMock.user = { id: '1', uiState: 'not json' };
    render(<ShowDiscrepanciesToggle />);
    expect(screen.getByText('discrepancies.toggle.off')).toBeTruthy();
  });
});
