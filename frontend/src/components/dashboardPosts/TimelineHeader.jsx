// Timeline hours markers
export default function TimelineHeader({ shiftStart, shiftEnd }) {
  const startH = parseInt(shiftStart.split(':')[0], 10);
  const endH = parseInt(shiftEnd.split(':')[0], 10);
  const total = endH - startH;
  const ticks = [];
  for (let h = startH; h <= endH; h++) {
    ticks.push({ h, m: 0, isHour: true });
    if (h < endH) ticks.push({ h, m: 30, isHour: false });
  }

  return (
    <div className="relative h-5 mb-0" style={{ marginLeft: 0 }}>
      {ticks.map(({ h, m, isHour }) => {
        const pos = ((h - startH + m / 60) / total) * 100;
        return (
          <span
            key={`${h}:${m}`}
            className="absolute"
            style={{
              left: `${pos}%`,
              transform: 'translateX(-50%)',
              color: isHour ? 'var(--text-secondary)' : 'var(--text-muted)',
              fontSize: isHour ? '11px' : '9px',
              top: isHour ? 0 : 2,
            }}
          >
            {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
          </span>
        );
      })}
    </div>
  );
}
