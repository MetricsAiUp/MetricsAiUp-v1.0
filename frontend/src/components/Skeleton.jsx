export function SkeletonBox({ w, h, className = '' }) {
  return <div className={`skeleton ${className}`} style={{ width: w, height: h }} />;
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 12, width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="skeleton" style={{ width: 200, height: 24 }} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl p-4 space-y-2" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <div className="skeleton" style={{ width: 80, height: 12 }} />
            <div className="skeleton" style={{ width: 50, height: 28 }} />
          </div>
        ))}
      </div>
      <div className="skeleton" style={{ width: 160, height: 20 }} />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="rounded-xl p-3" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <div className="skeleton" style={{ width: '70%', height: 14 }} />
            <div className="skeleton mt-2" style={{ width: '100%', height: 10 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
      <div className="p-3" style={{ background: 'var(--bg-glass)' }}>
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="skeleton" style={{ width: 80, height: 12, flex: 1 }} />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-3 py-2.5 border-t" style={{ borderColor: 'var(--border-glass)' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton" style={{ width: '100%', height: 10, flex: 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
