import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';

describe('ThemeContext', () => {
  const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

  beforeEach(() => {
    localStorage.clear();
    // Reset document.documentElement classes
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('defaults to dark theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
  });

  it('reads theme from localStorage', () => {
    localStorage.setItem('theme', 'light');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');
  });

  it('toggleTheme switches dark to light', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('light');
  });

  it('toggleTheme switches light to dark', () => {
    localStorage.setItem('theme', 'light');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('dark');
  });

  it('applies dark class to document.documentElement', () => {
    renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class on light theme', () => {
    localStorage.setItem('theme', 'light');
    renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists theme to localStorage on toggle', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(localStorage.getItem('theme')).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });

    expect(localStorage.getItem('theme')).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });

    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
