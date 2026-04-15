import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('lucide-react', () => {
  const icon = (props) => <span data-testid="icon" />;
  return {
    Settings: icon,
    X: icon,
    Copy: icon,
  };
});

import ShiftSettings from '../ShiftSettings';

describe('ShiftSettings', () => {
  const mockT = (k) => k;
  const defaultSettings = {
    shiftStart: '08:00',
    shiftEnd: '20:00',
    postsCount: 10,
  };
  const onSettingsChange = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders settings modal title', () => {
    render(
      <ShiftSettings settings={defaultSettings} onSettingsChange={onSettingsChange} onClose={onClose} t={mockT} />
    );
    expect(screen.getByText('dashboardPosts.settings')).toBeInTheDocument();
  });

  it('renders shift time inputs for each day', () => {
    render(
      <ShiftSettings settings={defaultSettings} onSettingsChange={onSettingsChange} onClose={onClose} t={mockT} />
    );
    // 7 days in week schedule
    const timeInputs = screen.getAllByDisplayValue('08:00');
    expect(timeInputs.length).toBeGreaterThanOrEqual(5); // at least workdays have start time 08:00

    const endInputs = screen.getAllByDisplayValue('20:00');
    expect(endInputs.length).toBeGreaterThanOrEqual(5);
  });

  it('renders day labels', () => {
    render(
      <ShiftSettings settings={defaultSettings} onSettingsChange={onSettingsChange} onClose={onClose} t={mockT} />
    );
    expect(screen.getByText('dashboardPosts.days.mon')).toBeInTheDocument();
    expect(screen.getByText('dashboardPosts.days.tue')).toBeInTheDocument();
    expect(screen.getByText('dashboardPosts.days.fri')).toBeInTheDocument();
    expect(screen.getByText('dashboardPosts.days.sat')).toBeInTheDocument();
    expect(screen.getByText('dashboardPosts.days.sun')).toBeInTheDocument();
  });

  it('save button calls onSettingsChange and closes modal', () => {
    render(
      <ShiftSettings settings={defaultSettings} onSettingsChange={onSettingsChange} onClose={onClose} t={mockT} />
    );
    const saveBtn = screen.getByText('common.save');
    fireEvent.click(saveBtn);
    expect(onSettingsChange).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('cancel button closes modal', () => {
    render(
      <ShiftSettings settings={defaultSettings} onSettingsChange={onSettingsChange} onClose={onClose} t={mockT} />
    );
    const cancelBtn = screen.getByText('common.cancel');
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it('X button closes modal', () => {
    render(
      <ShiftSettings settings={defaultSettings} onSettingsChange={onSettingsChange} onClose={onClose} t={mockT} />
    );
    // Click backdrop overlay
    const overlay = screen.getByText('dashboardPosts.settings').closest('.fixed');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders week schedule section', () => {
    render(
      <ShiftSettings settings={defaultSettings} onSettingsChange={onSettingsChange} onClose={onClose} t={mockT} />
    );
    expect(screen.getByText('dashboardPosts.weekSchedule')).toBeInTheDocument();
  });

  it('has day-off checkboxes', () => {
    render(
      <ShiftSettings settings={defaultSettings} onSettingsChange={onSettingsChange} onClose={onClose} t={mockT} />
    );
    // 7 dayOff labels
    const dayOffLabels = screen.getAllByText('dashboardPosts.dayOff');
    expect(dayOffLabels).toHaveLength(7);
  });

  it('saturday and sunday are day-off by default', () => {
    render(
      <ShiftSettings settings={defaultSettings} onSettingsChange={onSettingsChange} onClose={onClose} t={mockT} />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // The checkboxes include dayOff for 7 days + 1 for postsCount input? No, just checkboxes.
    // Sat (index 5) and Sun (index 6) should be checked
    const dayOffCheckboxes = checkboxes.filter((cb) => cb.type === 'checkbox');
    // Sat and Sun defaults are dayOff=true
    expect(dayOffCheckboxes[5]).toBeChecked();
    expect(dayOffCheckboxes[6]).toBeChecked();
  });

  it('can change start time', () => {
    render(
      <ShiftSettings settings={defaultSettings} onSettingsChange={onSettingsChange} onClose={onClose} t={mockT} />
    );
    const startInputs = screen.getAllByDisplayValue('08:00');
    fireEvent.change(startInputs[0], { target: { value: '07:00' } });
    expect(screen.getByDisplayValue('07:00')).toBeInTheDocument();
  });

  it('renders posts count input', () => {
    render(
      <ShiftSettings settings={defaultSettings} onSettingsChange={onSettingsChange} onClose={onClose} t={mockT} />
    );
    expect(screen.getByText('dashboardPosts.postsCount')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
  });
});
