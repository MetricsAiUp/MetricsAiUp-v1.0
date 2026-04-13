import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastContext';

function TestConsumer() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Success message')}>Show Success</button>
      <button onClick={() => toast.error('Error message')}>Show Error</button>
      <button onClick={() => toast.warning('Warning message')}>Show Warning</button>
      <button onClick={() => toast.info('Info message')}>Show Info</button>
    </div>
  );
}

describe('ToastContext', () => {
  it('renders children without toasts initially', () => {
    render(
      <ToastProvider>
        <div>Child content</div>
      </ToastProvider>
    );
    expect(screen.getByText('Child content')).toBeTruthy();
  });

  it('shows success toast', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeTruthy();
  });

  it('shows error toast', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show Error'));
    expect(screen.getByText('Error message')).toBeTruthy();
  });

  it('limits to max 3 toasts', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show Success'));
    fireEvent.click(screen.getByText('Show Error'));
    fireEvent.click(screen.getByText('Show Warning'));
    fireEvent.click(screen.getByText('Show Info'));

    // Only last 3 should be visible
    expect(screen.queryByText('Success message')).toBeNull();
    expect(screen.getByText('Error message')).toBeTruthy();
    expect(screen.getByText('Warning message')).toBeTruthy();
    expect(screen.getByText('Info message')).toBeTruthy();
  });

  it('removes toast on close button click', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeTruthy();

    // Find the close button (X icon button)
    const closeButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg'));
    const toastClose = closeButtons[closeButtons.length - 1];
    fireEvent.click(toastClose);
    expect(screen.queryByText('Success message')).toBeNull();
  });

  it('auto-removes toast after duration', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(5100); });

    expect(screen.queryByText('Success message')).toBeNull();
    vi.useRealTimers();
  });
});
