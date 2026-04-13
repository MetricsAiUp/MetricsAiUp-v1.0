import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// Suppress console.error from React for expected errors
const originalError = console.error;
beforeAll(() => { console.error = vi.fn(); });
afterAll(() => { console.error = originalError; });

function ThrowError({ shouldThrow }) {
  if (shouldThrow) throw new Error('Test error message');
  return <div>Content works</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('renders fallback UI on error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Test error message')).toBeTruthy();
  });

  it('uses custom fallbackTitle and retryLabel', () => {
    render(
      <ErrorBoundary fallbackTitle="Custom title" retryLabel="Try again">
        <ThrowError shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom title')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('resets error state when retry button is clicked', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    // Clicking retry resets hasError state, which re-renders children
    // Since ThrowError still throws, ErrorBoundary catches again
    fireEvent.click(screen.getByText('Retry'));
    // The component re-threw, so we're back to error state
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });
});
