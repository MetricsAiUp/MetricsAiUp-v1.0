import TimelineHeader from './TimelineHeader';
import TimelineRow from './TimelineRow';
import { getNowPosition } from './constants';

// Main timeline visualization: header + rows + "now" indicator
export default function GanttTimeline({ posts, shiftStart, shiftEnd, onBlockClick }) {
  return (
    <div
      className="glass rounded-xl p-3 relative"
      style={{ border: '1px solid var(--border-glass)' }}
    >
      <div className="flex gap-2 mb-1">
        <div style={{ width: 190, minWidth: 190 }} />
        <div className="flex-1">
          <TimelineHeader shiftStart={shiftStart} shiftEnd={shiftEnd} />
        </div>
      </div>
      {posts.map((post) => (
        <TimelineRow
          key={post.id}
          post={post}
          shiftStart={shiftStart}
          shiftEnd={shiftEnd}
          onBlockClick={onBlockClick}
        />
      ))}
      {/* Global "now" line overlay — same flex layout as rows */}
      <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none flex gap-2" style={{ padding: '12px', zIndex: 10 }}>
        <div style={{ width: 190, minWidth: 190, flexShrink: 0 }} />
        <div className="flex-1 relative">
          {(() => {
            const nowPos = getNowPosition(shiftStart, shiftEnd);
            return (
              <>
                <div className="absolute top-0 bottom-0" style={{ left: `${nowPos}%`, width: 2, background: 'var(--danger)' }} />
                <div className="absolute" style={{ left: `${nowPos}%`, top: 0, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', transform: 'translate(-3px, -2px)' }} />
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
