import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import ConflictModal from '../dashboardPosts/ConflictModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

describe('ConflictModal', () => {
  const defaultProps = {
    conflicts: [
      { reason: 'version_mismatch', clientVersion: 1, serverVersion: 2 },
      { reason: 'record_deleted' },
    ],
    onReload: vi.fn(),
    onForce: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders conflict list', () => {
    const { container } = render(<ConflictModal {...defaultProps} />);
    // Should render conflict items
    const items = container.querySelectorAll('.space-y-2 > div');
    expect(items.length).toBe(2);
    // First conflict shows version info
    expect(items[0].textContent).toContain('v1');
    expect(items[0].textContent).toContain('v2');
    // Second conflict shows reason
    expect(items[1].textContent).toContain('record_deleted');
  });

  it('renders title in English', () => {
    const { getByText } = render(<ConflictModal {...defaultProps} />);
    expect(getByText('Data Conflict')).toBeInTheDocument();
  });

  it('calls onReload when reload button clicked', () => {
    const { getByText } = render(<ConflictModal {...defaultProps} />);
    fireEvent.click(getByText('Reload data'));
    expect(defaultProps.onReload).toHaveBeenCalledTimes(1);
  });

  it('calls onForce when overwrite button clicked', () => {
    const { getByText } = render(<ConflictModal {...defaultProps} />);
    fireEvent.click(getByText('Overwrite'));
    expect(defaultProps.onForce).toHaveBeenCalledTimes(1);
  });
});
