import { useTranslation } from 'react-i18next';
import { Car } from 'lucide-react';
import { POST_TYPE_ICONS, POST_STATUS_COLORS, STATUS_COLORS, getBlockStyle, getItemStatus } from './constants';

// Single timeline row for a post
export default function TimelineRow({ post, shiftStart, shiftEnd, onBlockClick }) {
  const { t } = useTranslation();
  const PostIcon = POST_TYPE_ICONS[post.type] || Car;
  const postStatusColor = post.status === 'free'
    ? POST_STATUS_COLORS.free
    : post.currentVehicle
      ? POST_STATUS_COLORS.occupied
      : POST_STATUS_COLORS.unknown;

  return (
    <div
      className="flex items-center gap-2 py-1.5 border-b"
      style={{ borderColor: 'var(--border-glass)' }}
    >
      {/* Post info column */}
      <div className="flex-shrink-0" style={{ width: 190, minWidth: 190 }}>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: postStatusColor }}
          />
          <PostIcon size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <span className="font-semibold" style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
            {(() => { const num = post.name?.match(/\d+/)?.[0]; return num ? t(`posts.post${num}`) : post.name; })()}
          </span>
          <span
            className="px-1.5 py-0.5 rounded"
            style={{
              background: 'var(--accent-light)',
              color: 'var(--accent)',
              fontSize: '9px',
            }}
          >
            {t(`posts.${post.type}`) || post.type}
          </span>
        </div>
        {post.currentVehicle ? (
          <div style={{ color: 'var(--text-secondary)', marginLeft: 18, fontSize: '11px' }}>
            <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
              {post.currentVehicle.plateNumber}
            </span>
            <span className="ml-1">
              {post.currentVehicle.brand} {post.currentVehicle.model}
            </span>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', marginLeft: 18, fontSize: '11px' }}>
            {t('posts.free')}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="flex-1 relative" style={{ minHeight: 28 }}>
        {/* Background grid */}
        <div
          className="absolute inset-0 rounded"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}
        />

        {/* Hour + half-hour grid lines */}
        {(() => {
          const startH = parseInt(shiftStart.split(':')[0], 10);
          const endH = parseInt(shiftEnd.split(':')[0], 10);
          const total = endH - startH;
          const lines = [];
          for (let h = startH; h <= endH; h++) {
            // Hour line
            if (h > startH) {
              const pos = ((h - startH) / total) * 100;
              lines.push(
                <div
                  key={`h${h}`}
                  className="absolute top-0 bottom-0"
                  style={{ left: `${pos}%`, width: 1, background: 'var(--text-muted)', opacity: 0.45 }}
                />
              );
            }
            // Half-hour line
            if (h < endH) {
              const pos30 = ((h - startH + 0.5) / total) * 100;
              lines.push(
                <div
                  key={`m${h}`}
                  className="absolute top-0 bottom-0"
                  style={{ left: `${pos30}%`, width: 1, background: 'var(--text-muted)', opacity: 0.2 }}
                />
              );
            }
          }
          return lines;
        })()}

        {/* Work order blocks */}
        {post.timeline.map((item) => {
          const style = getBlockStyle(item, shiftStart, shiftEnd);
          const status = getItemStatus(item, shiftStart, shiftEnd);
          const colors = STATUS_COLORS[status] || STATUS_COLORS.scheduled;

          return (
            <div
              key={item.id}
              className="absolute top-0.5 bottom-0.5 rounded cursor-pointer transition-all hover:opacity-90 hover:shadow-lg flex items-center px-1 overflow-hidden"
              style={{
                ...style,
                background: colors.bg,
                color: colors.text,
                zIndex: 2,
                marginRight: 2,
                minWidth: 30,
              }}
              onClick={() => onBlockClick(item, post)}
              title={`${item.workOrderNumber} — ${item.workType}`}
            >
              <span className="font-medium truncate" style={{ fontSize: '10px' }}>
                {item.workOrderNumber}
              </span>
            </div>
          );
        })}

        {/* Current time indicator — drawn globally */}
      </div>
    </div>
  );
}
