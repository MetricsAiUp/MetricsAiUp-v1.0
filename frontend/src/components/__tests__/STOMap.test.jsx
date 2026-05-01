import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'en' } }),
}));

vi.mock('react-konva', () => ({
  Stage: ({ children }) => <div data-testid="stage">{children}</div>,
  Layer: ({ children }) => <div data-testid="layer">{children}</div>,
  Rect: (props) => <div data-testid="rect" data-fill={props.fill} />,
  Circle: (props) => <div data-testid="circle" data-fill={props.fill} />,
  Text: ({ text }) => <div data-testid="konva-text">{text}</div>,
  Group: ({ children }) => <div data-testid="group">{children}</div>,
  Line: () => <div data-testid="line" />,
  Arrow: () => <div data-testid="arrow" />,
}));

vi.mock('lucide-react', () => {
  const icon = (props) => <span data-testid="icon" />;
  return {
    Car: icon, Truck: icon, Wrench: icon,
  };
});

vi.mock('../../constants', () => ({
  POST_STATUS_COLORS: {
    free: '#10b981',
    occupied: '#ef4444',
    occupied_no_work: '#f59e0b',
    active_work: '#6366f1',
  },
  MAP_FONT_FAMILY: 'sans-serif',
  MAP_FONT_MONO: 'monospace',
  MAP_TEXT_COLORS: {
    primary: { dark: '#fff', light: '#000' },
    secondary: { dark: '#ccc', light: '#333' },
    muted: { dark: '#888', light: '#666' },
    accent: { dark: '#a5b4fc', light: '#6366f1' },
    empty: { dark: '#334155', light: '#cbd5e1' },
    onColor: '#fff',
    onColorMuted: 'rgba(255,255,255,0.92)',
    conf: { high: '#22c55e', medium: '#f59e0b', low: '#ef4444' },
  },
  MAP_LETTER_SPACING: { header: 0.3, plate: 1.0, body: 0 },
  mapFontSizes: () => ({ header: 11, status: 10, plate: 12, body: 10, detail: 9, badge: 8 }),
  toTitleCase: (s) => s,
}));

vi.mock('../../constants/mapTheme', () => ({
  getZoneColors: () => ({
    repair: { fill: 'rgba(0,0,0,0.1)', stroke: '#666' },
    driveway: { fill: 'rgba(0,0,0,0.05)', stroke: '#888' },
    parking: { fill: 'rgba(0,0,0,0.05)', stroke: '#888' },
    entry: { fill: 'rgba(0,0,0,0.05)', stroke: '#10b981' },
    free: { fill: 'rgba(0,0,0,0.02)', stroke: '#ccc' },
  }),
  MAP_BG: { dark: '#0f172a', light: '#f8fafc' },
  GRID_STROKE: { dark: 'rgba(148,163,184,0.08)', light: 'rgba(0,0,0,0.05)' },
  BUILDING_STROKE: { dark: 'rgba(148,163,184,0.3)', light: 'rgba(0,0,0,0.15)' },
  CAMERA_FOV_OPACITY: { dark: 0.3, light: 0.2 },
}));

vi.mock('../PostTimer', () => ({
  usePostTimerText: () => ({ text: '', color: '' }),
}));

import STOMap from '../STOMap';

describe('STOMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Stage and Layer', () => {
    render(<STOMap />);
    expect(screen.getByTestId('stage')).toBeInTheDocument();
    expect(screen.getByTestId('layer')).toBeInTheDocument();
  });

  it('renders zone labels', () => {
    render(<STOMap />);
    // Zone labels from MAP_LAYOUT
    expect(screen.getByText('Repair zone (posts 5-9)')).toBeInTheDocument();
    expect(screen.getByText('Driveway')).toBeInTheDocument();
    expect(screen.getByText('Repair zone (posts 1-4, 10)')).toBeInTheDocument();
    expect(screen.getAllByText('Parking').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Entry/Exit')).toBeInTheDocument();
  });

  it('renders post elements', () => {
    render(<STOMap />);
    // Post labels (EN versions)
    expect(screen.getByText('Post 5')).toBeInTheDocument();
    expect(screen.getByText('Post 1')).toBeInTheDocument();
    expect(screen.getByText('Post 10')).toBeInTheDocument();
  });

  it('renders posts with status elements', () => {
    const zones = [
      {
        name: 'Repair Zone',
        posts: [
          { name: 'Post 01', status: 'free', stays: [] },
          { name: 'Post 02', status: 'occupied', stays: [] },
        ],
      },
    ];
    render(<STOMap zones={zones} />);
    // Multiple "Free" labels appear (one per default free post), at least one "Occupied" for Post 02
    expect(screen.getAllByText('Free').length).toBeGreaterThan(0);
    expect(screen.getByText('Occupied')).toBeInTheDocument();
  });

  it('handles empty zones array', () => {
    render(<STOMap zones={[]} />);
    expect(screen.getByTestId('stage')).toBeInTheDocument();
  });

  it('renders camera icons', () => {
    render(<STOMap />);
    // Camera labels like CAM01, CAM02, etc.
    expect(screen.getByText('CAM01')).toBeInTheDocument();
    expect(screen.getByText('CAM10')).toBeInTheDocument();
  });

  it('renders with dark mode by default', () => {
    render(<STOMap />);
    // The background Rect should use dark fill
    const rects = screen.getAllByTestId('rect');
    const bgRect = rects.find((r) => r.getAttribute('data-fill') === '#0f172a');
    expect(bgRect).toBeTruthy();
  });

  it('renders with light mode', () => {
    render(<STOMap isDark={false} />);
    const rects = screen.getAllByTestId('rect');
    const bgRect = rects.find((r) => r.getAttribute('data-fill') === '#f8fafc');
    expect(bgRect).toBeTruthy();
  });
});
