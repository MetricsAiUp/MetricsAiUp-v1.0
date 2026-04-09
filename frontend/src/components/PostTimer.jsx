import { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';

function getTimerColor(remainingMs, totalMs) {
  if (remainingMs <= 0) return { bg: '#ef4444', text: '#fff', pulse: true };
  const pct = remainingMs / totalMs;
  if (pct <= 0.15) return { bg: '#ef4444', text: '#fff', pulse: true };
  if (pct <= 0.35) return { bg: '#f59e0b', text: '#1a1a1a', pulse: false };
  return { bg: '#10b981', text: '#fff', pulse: false };
}

function formatCountdown(ms) {
  if (ms <= 0) return '+' + formatDuration(-ms);
  return formatDuration(ms);
}

function formatDuration(ms) {
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PostTimer({ estimatedEnd, startTime, size = 'md', className = '', warningThreshold = 0.8 }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!estimatedEnd) return null;

  const endMs = new Date(estimatedEnd).getTime();
  const startMs = startTime ? new Date(startTime).getTime() : endMs - 3600000;
  const totalMs = endMs - startMs;
  const remainingMs = endMs - now;
  const progress = totalMs > 0 ? 1 - (remainingMs / totalMs) : 0;
  const { bg, text, pulse } = getTimerColor(remainingMs, totalMs);

  // Warning border effect when progress exceeds threshold
  const warningBorder = progress >= 1
    ? '2px solid #ef4444'
    : progress >= warningThreshold
      ? `2px solid ${progress >= 0.95 ? '#ef4444' : '#f59e0b'}`
      : 'none';
  const shouldPulseBorder = progress >= warningThreshold;

  const sizes = {
    sm: { icon: 10, font: 'text-xs', px: 'px-1.5 py-0.5', iconSize: 10 },
    md: { icon: 14, font: 'text-sm', px: 'px-2 py-1', iconSize: 14 },
    lg: { icon: 18, font: 'text-base', px: 'px-3 py-1.5', iconSize: 18 },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg font-mono font-bold ${s.font} ${s.px} ${pulse || shouldPulseBorder ? 'animate-pulse' : ''} ${className}`}
      style={{ background: bg, color: text, border: warningBorder }}
    >
      <Timer size={s.iconSize} />
      <span>{formatCountdown(remainingMs)}</span>
    </div>
  );
}

// Konva-compatible timer text (returns string only, no React component)
export function usePostTimerText(estimatedEnd, startTime) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!estimatedEnd) return { text: '', color: '#94a3b8', pulse: false };

  const endMs = new Date(estimatedEnd).getTime();
  const startMs = startTime ? new Date(startTime).getTime() : endMs - 3600000;
  const totalMs = endMs - startMs;
  const remainingMs = endMs - now;
  const { bg, pulse } = getTimerColor(remainingMs, totalMs);

  return { text: formatCountdown(remainingMs), color: bg, pulse };
}
