import { useEffect, useMemo, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STEP_OPTIONS_SEC = [30, 60, 300];

function formatTimestamp(ms, isRu) {
  if (!ms) return '—';
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return isRu ? `${date} ${time}` : `${time} ${date}`;
}

/**
 * Replay panel — слайдер времени для MapViewer.
 *
 * Props:
 *   from, to       — Date (границы окна)
 *   cursor         — number (мс), позиция
 *   setCursor      — (number | (prev: number) => number) => void
 *   playing        — boolean
 *   setPlaying     — (boolean) => void
 *   stepSec        — 30 | 60 | 300
 *   setStepSec     — (number) => void
 *   loading        — boolean
 *   empty          — boolean (true если 0 событий за окно)
 *   onClose        — () => void  (вернуться в live)
 */
export default function ReplayPanel({
  from, to, cursor, setCursor,
  playing, setPlaying,
  stepSec, setStepSec,
  loading, empty,
  onClose,
}) {
  const { t, i18n } = useTranslation();
  const isRu = (i18n.language || 'ru').startsWith('ru');

  const minMs = from?.getTime() ?? 0;
  const maxMs = to?.getTime() ?? 0;

  // Авто-плей: каждую секунду двигаем курсор на stepSec секунд.
  // Если уперлись в правую границу — пауза.
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useEffect(() => {
    if (!playing || !maxMs) return;
    const id = setInterval(() => {
      setCursor((prev) => {
        const next = prev + stepSec * 1000;
        if (next >= maxMs) {
          setPlaying(false);
          return maxMs;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, stepSec, maxMs, setCursor, setPlaying]);

  const stepLabel = useMemo(() => ({
    30: t('mapView.replayStep30s'),
    60: t('mapView.replayStep1m'),
    300: t('mapView.replayStep5m'),
  }), [t]);

  const onSlide = (e) => {
    const v = Number(e.target.value);
    if (playing) setPlaying(false);
    setCursor(v);
  };

  const stepBack = () => {
    if (playing) setPlaying(false);
    setCursor((prev) => Math.max(minMs, prev - stepSec * 1000));
  };
  const stepFwd = () => {
    if (playing) setPlaying(false);
    setCursor((prev) => Math.min(maxMs, prev + stepSec * 1000));
  };
  const jumpStart = () => { if (playing) setPlaying(false); setCursor(minMs); };
  const jumpEnd = () => { if (playing) setPlaying(false); setCursor(maxMs); };

  const disabled = loading || empty || !maxMs;

  return (
    <div
      className="absolute left-3 right-3 bottom-3 z-20 rounded-xl px-3 py-2"
      style={{
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-glass)',
        color: 'var(--text-secondary)',
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold tracking-wide uppercase" style={{ color: 'var(--accent)' }}>
          {t('mapView.replay')}
        </span>

        {/* Time display */}
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {loading ? t('mapView.replayLoading') : (empty ? t('mapView.replayEmpty') : formatTimestamp(cursor, isRu))}
        </span>

        <div className="flex-1" />

        {/* Controls */}
        <button onClick={jumpStart} disabled={disabled} title={t('mapView.replayJumpStart')}
          className="p-1 rounded hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
          <ChevronsLeft size={14} />
        </button>
        <button onClick={stepBack} disabled={disabled} title={t('mapView.replayBack')}
          className="p-1 rounded hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
          <SkipBack size={14} />
        </button>
        <button onClick={() => setPlaying(p => !p)} disabled={disabled}
          title={playing ? t('mapView.replayPause') : t('mapView.replayPlay')}
          className="p-1.5 rounded hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button onClick={stepFwd} disabled={disabled} title={t('mapView.replayForward')}
          className="p-1 rounded hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
          <SkipForward size={14} />
        </button>
        <button onClick={jumpEnd} disabled={disabled} title={t('mapView.replayJumpEnd')}
          className="p-1 rounded hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
          <ChevronsRight size={14} />
        </button>

        {/* Step selector */}
        <span className="text-[10px] ml-2" style={{ color: 'var(--text-muted)' }}>{t('mapView.replayStep')}:</span>
        <div className="flex items-center gap-0.5 rounded overflow-hidden"
          style={{ border: '1px solid var(--border-glass)' }}>
          {STEP_OPTIONS_SEC.map((s) => (
            <button key={s} onClick={() => setStepSec(s)}
              className="px-1.5 py-0.5 text-[10px] hover:opacity-80"
              style={{
                background: s === stepSec ? 'var(--accent)' : 'var(--bg-secondary)',
                color: s === stepSec ? '#fff' : 'var(--text-secondary)',
              }}>
              {stepLabel[s]}
            </button>
          ))}
        </div>

        {/* Close */}
        <button onClick={onClose} title={t('mapView.replayLive')}
          className="ml-2 p-1 rounded hover:opacity-80"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
          <X size={14} />
        </button>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={minMs}
        max={maxMs}
        step={1000}
        value={Math.min(maxMs, Math.max(minMs, cursor || minMs))}
        onChange={onSlide}
        disabled={disabled}
        className="w-full mt-2 disabled:opacity-40"
        style={{ accentColor: 'var(--accent)' }}
      />
      <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
        <span>{formatTimestamp(minMs, isRu)}</span>
        <span>{formatTimestamp(maxMs, isRu)}</span>
      </div>
    </div>
  );
}
