import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'ru' } }),
}));

import ReplayPanel from '../ReplayPanel';

function makeWindow() {
  const from = new Date('2026-04-14T10:00:00');
  const to = new Date('2026-04-14T11:00:00');
  return { from, to, minMs: from.getTime(), maxMs: to.getTime() };
}

describe('ReplayPanel', () => {
  it('renders Replay label', () => {
    const { from, to, minMs } = makeWindow();
    render(<ReplayPanel from={from} to={to} cursor={minMs} setCursor={() => {}}
      playing={false} setPlaying={() => {}} stepSec={30} setStepSec={() => {}} />);
    expect(screen.getByText('mapView.replay')).toBeTruthy();
  });

  it('shows replayLoading when loading=true', () => {
    const { from, to, minMs } = makeWindow();
    render(<ReplayPanel from={from} to={to} cursor={minMs} setCursor={() => {}}
      playing={false} setPlaying={() => {}} stepSec={30} setStepSec={() => {}} loading />);
    expect(screen.getByText('mapView.replayLoading')).toBeTruthy();
  });

  it('shows replayEmpty when empty=true', () => {
    const { from, to, minMs } = makeWindow();
    render(<ReplayPanel from={from} to={to} cursor={minMs} setCursor={() => {}}
      playing={false} setPlaying={() => {}} stepSec={30} setStepSec={() => {}} empty />);
    expect(screen.getByText('mapView.replayEmpty')).toBeTruthy();
  });

  it('renders formatted timestamp for cursor in RU order', () => {
    const { from, to } = makeWindow();
    const cursor = new Date('2026-04-14T10:30:45').getTime();
    render(<ReplayPanel from={from} to={to} cursor={cursor} setCursor={() => {}}
      playing={false} setPlaying={() => {}} stepSec={30} setStepSec={() => {}} />);
    expect(screen.getByText('14.04 10:30:45')).toBeTruthy();
  });

  it('disables controls when loading', () => {
    const { from, to, minMs } = makeWindow();
    const { container } = render(<ReplayPanel from={from} to={to} cursor={minMs} setCursor={() => {}}
      playing={false} setPlaying={() => {}} stepSec={30} setStepSec={() => {}} loading />);
    const range = container.querySelector('input[type="range"]');
    expect(range.disabled).toBe(true);
  });

  it('toggles play state on play button click', () => {
    const setPlaying = vi.fn();
    const { from, to, minMs } = makeWindow();
    render(<ReplayPanel from={from} to={to} cursor={minMs} setCursor={() => {}}
      playing={false} setPlaying={setPlaying} stepSec={30} setStepSec={() => {}} />);
    fireEvent.click(screen.getByTitle('mapView.replayPlay'));
    // Called with updater fn (prev => !prev)
    expect(setPlaying).toHaveBeenCalled();
    const updater = setPlaying.mock.calls[0][0];
    expect(updater(false)).toBe(true);
  });

  it('shows Pause icon title when playing', () => {
    const { from, to, minMs } = makeWindow();
    render(<ReplayPanel from={from} to={to} cursor={minMs} setCursor={() => {}}
      playing setPlaying={() => {}} stepSec={30} setStepSec={() => {}} />);
    expect(screen.getByTitle('mapView.replayPause')).toBeTruthy();
  });

  it('jumpStart sets cursor to minMs', () => {
    const setCursor = vi.fn();
    const { from, to, minMs, maxMs } = makeWindow();
    render(<ReplayPanel from={from} to={to} cursor={maxMs} setCursor={setCursor}
      playing={false} setPlaying={() => {}} stepSec={30} setStepSec={() => {}} />);
    fireEvent.click(screen.getByTitle('mapView.replayJumpStart'));
    expect(setCursor).toHaveBeenCalledWith(minMs);
  });

  it('jumpEnd sets cursor to maxMs', () => {
    const setCursor = vi.fn();
    const { from, to, minMs, maxMs } = makeWindow();
    render(<ReplayPanel from={from} to={to} cursor={minMs} setCursor={setCursor}
      playing={false} setPlaying={() => {}} stepSec={30} setStepSec={() => {}} />);
    fireEvent.click(screen.getByTitle('mapView.replayJumpEnd'));
    expect(setCursor).toHaveBeenCalledWith(maxMs);
  });

  it('stepBack uses updater clamped to minMs', () => {
    const setCursor = vi.fn();
    const { from, to, minMs } = makeWindow();
    render(<ReplayPanel from={from} to={to} cursor={minMs + 5000} setCursor={setCursor}
      playing={false} setPlaying={() => {}} stepSec={30} setStepSec={() => {}} />);
    fireEvent.click(screen.getByTitle('mapView.replayBack'));
    const updater = setCursor.mock.calls[0][0];
    // prev = minMs+5000, stepSec*1000=30000 → next = max(minMs, prev-30000) = minMs
    expect(updater(minMs + 5000)).toBe(minMs);
  });

  it('stepFwd uses updater clamped to maxMs', () => {
    const setCursor = vi.fn();
    const { from, to, maxMs } = makeWindow();
    render(<ReplayPanel from={from} to={to} cursor={maxMs - 5000} setCursor={setCursor}
      playing={false} setPlaying={() => {}} stepSec={30} setStepSec={() => {}} />);
    fireEvent.click(screen.getByTitle('mapView.replayForward'));
    const updater = setCursor.mock.calls[0][0];
    expect(updater(maxMs - 5000)).toBe(maxMs);
  });

  it('pauses playback when user moves slider', () => {
    const setCursor = vi.fn();
    const setPlaying = vi.fn();
    const { from, to, minMs } = makeWindow();
    const { container } = render(<ReplayPanel from={from} to={to} cursor={minMs} setCursor={setCursor}
      playing setPlaying={setPlaying} stepSec={30} setStepSec={() => {}} />);
    const range = container.querySelector('input[type="range"]');
    fireEvent.change(range, { target: { value: String(minMs + 60000) } });
    expect(setPlaying).toHaveBeenCalledWith(false);
    expect(setCursor).toHaveBeenCalledWith(minMs + 60000);
  });

  it('changes step on step option click', () => {
    const setStepSec = vi.fn();
    const { from, to, minMs } = makeWindow();
    render(<ReplayPanel from={from} to={to} cursor={minMs} setCursor={() => {}}
      playing={false} setPlaying={() => {}} stepSec={30} setStepSec={setStepSec} />);
    fireEvent.click(screen.getByText('mapView.replayStep5m'));
    expect(setStepSec).toHaveBeenCalledWith(300);
  });

  it('renders all three step options', () => {
    const { from, to, minMs } = makeWindow();
    render(<ReplayPanel from={from} to={to} cursor={minMs} setCursor={() => {}}
      playing={false} setPlaying={() => {}} stepSec={30} setStepSec={() => {}} />);
    expect(screen.getByText('mapView.replayStep30s')).toBeTruthy();
    expect(screen.getByText('mapView.replayStep1m')).toBeTruthy();
    expect(screen.getByText('mapView.replayStep5m')).toBeTruthy();
  });

  it('calls onClose on X button click', () => {
    const onClose = vi.fn();
    const { from, to, minMs } = makeWindow();
    render(<ReplayPanel from={from} to={to} cursor={minMs} setCursor={() => {}}
      playing={false} setPlaying={() => {}} stepSec={30} setStepSec={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByTitle('mapView.replayLive'));
    expect(onClose).toHaveBeenCalled();
  });

  it('auto-advances cursor while playing', () => {
    vi.useFakeTimers();
    try {
      const setCursor = vi.fn();
      const setPlaying = vi.fn();
      const { from, to, minMs } = makeWindow();
      render(<ReplayPanel from={from} to={to} cursor={minMs} setCursor={setCursor}
        playing setPlaying={setPlaying} stepSec={30} setStepSec={() => {}} />);
      act(() => { vi.advanceTimersByTime(1000); });
      expect(setCursor).toHaveBeenCalled();
      const updater = setCursor.mock.calls[0][0];
      expect(updater(minMs)).toBe(minMs + 30000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('auto-stop and clamp at maxMs', () => {
    vi.useFakeTimers();
    try {
      const setCursor = vi.fn();
      const setPlaying = vi.fn();
      const { from, to, maxMs } = makeWindow();
      render(<ReplayPanel from={from} to={to} cursor={maxMs - 1000} setCursor={setCursor}
        playing setPlaying={setPlaying} stepSec={30} setStepSec={() => {}} />);
      act(() => { vi.advanceTimersByTime(1000); });
      const updater = setCursor.mock.calls[0][0];
      // prev = maxMs-1000, next = prev+30000 > maxMs → setPlaying(false), return maxMs
      expect(updater(maxMs - 1000)).toBe(maxMs);
      expect(setPlaying).toHaveBeenCalledWith(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
