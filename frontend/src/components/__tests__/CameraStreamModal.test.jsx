import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('hls.js', () => ({
  default: class MockHls {
    static isSupported() { return true; }
    static Events = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' };
    static ErrorTypes = { NETWORK_ERROR: 'networkError' };
    loadSource = vi.fn();
    attachMedia = vi.fn();
    destroy = vi.fn();
    on = vi.fn();
  },
}));

vi.mock('lucide-react', () => {
  const icon = ({ children, ...props }) => <span data-testid="icon">{children}</span>;
  return {
    Camera: icon, X: icon, Maximize2: icon, Play: icon,
    Square: icon, RefreshCw: icon,
  };
});

// Mock fetch for stream API calls
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
);

import CameraStreamModal from '../CameraStreamModal';

describe('CameraStreamModal', () => {
  const defaultProps = {
    camId: 'cam01',
    camName: 'Camera 01',
    camLocation: 'Entry Zone',
    camCovers: 'Zone 1, Zone 2',
    isRu: false,
    isDark: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with camera name', () => {
    render(<CameraStreamModal {...defaultProps} />);
    // Camera name appears in both top bar and info bar
    const names = screen.getAllByText('Camera 01');
    expect(names.length).toBeGreaterThanOrEqual(1);
  });

  it('shows video element', () => {
    const { container } = render(<CameraStreamModal {...defaultProps} />);
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    // muted and autoplay are boolean attributes
    expect(video.muted).toBe(true);
    expect(video.autoplay).toBe(true);
  });

  it('close button calls onClose', () => {
    render(<CameraStreamModal {...defaultProps} />);
    // Click the overlay backdrop
    const overlay = screen.getAllByText('Camera 01')[0].closest('.fixed');
    fireEvent.click(overlay);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows camera location', () => {
    render(<CameraStreamModal {...defaultProps} />);
    const locations = screen.getAllByText('Entry Zone');
    expect(locations.length).toBeGreaterThanOrEqual(1);
  });

  it('shows camera coverage zones', () => {
    render(<CameraStreamModal {...defaultProps} />);
    expect(screen.getByText('Zone 1')).toBeInTheDocument();
    expect(screen.getByText('Zone 2')).toBeInTheDocument();
  });

  it('shows connecting state initially', () => {
    render(<CameraStreamModal {...defaultProps} />);
    expect(screen.getByText('Connecting to camera...')).toBeInTheDocument();
  });

  it('renders without camCovers', () => {
    render(<CameraStreamModal {...defaultProps} camCovers={undefined} />);
    expect(screen.getAllByText('Camera 01').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Russian text when isRu is true', () => {
    render(<CameraStreamModal {...defaultProps} isRu={true} />);
    expect(screen.getByText(/Подключение к камере/)).toBeInTheDocument();
  });
});
