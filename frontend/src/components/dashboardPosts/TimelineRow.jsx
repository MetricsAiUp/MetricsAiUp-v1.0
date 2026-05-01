import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Car, MapPin } from 'lucide-react';
import { POST_TYPE_ICONS, POST_STATUS_COLORS, STATUS_COLORS, getBlockStyle, getItemStatus } from './constants';

// Single timeline row for a post or zone — supports drag-and-drop (для постов)
export default function TimelineRow({ post, shiftStart, shiftEnd, onBlockClick, onDrop, dragOverPostId, conflictItemIds }) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const isZone = post.kind === 'zone';
  const timelineRef = useRef(null);
  const PostIcon = isZone ? MapPin : (POST_TYPE_ICONS[post.type] || Car);
  const postStatusColor = post.status === 'free'
    ? POST_STATUS_COLORS.free
    : post.status === 'no_data'
      ? POST_STATUS_COLORS.unknown
      : post.currentVehicle
        ? POST_STATUS_COLORS.occupied
        : POST_STATUS_COLORS.unknown;

  const isDropTarget = dragOverPostId === post.id;

  const handleDragStart = useCallback((e, item) => {
    e.dataTransfer.effectAllowed = 'move';
    const dragData = {
      type: 'timeline-block',
      itemId: item.id,
      fromPostId: post.id,
      startTime: item.startTime,
      endTime: item.endTime || item.estimatedEnd,
      normHours: item.normHours,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.currentTarget.style.opacity = '0.4';
  }, [post.id]);

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.style.opacity = '1';
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    if (!onDrop || !timelineRef.current) return;

    let dragData;
    try {
      dragData = JSON.parse(e.dataTransfer.getData('application/json'));
    } catch { return; }

    const rect = timelineRef.current.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (dropX / rect.width) * 100));

    onDrop({
      ...dragData,
      toPostId: post.id,
      dropPercent: percent,
    });
  }, [onDrop, post.id]);

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
            {isZone
              ? `${isRu ? 'Зона' : 'Zone'} ${String(post.number).padStart(2, '0')}`
              : (() => { const m = post.name?.match(/\d+/)?.[0]; const num = m ? parseInt(m, 10) : null; return num ? t(`posts.post${num}`) : post.name; })()}
          </span>
          <span
            className="px-1.5 py-0.5 rounded"
            style={{
              background: 'var(--accent-light)',
              color: 'var(--accent)',
              fontSize: '9px',
            }}
          >
            {isZone ? (isRu ? 'Зона' : 'Zone') : (t(`posts.${post.type}`) || post.type)}
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
            {post.status === 'no_data'
              ? (isRu ? 'Нет данных' : 'No data')
              : t('posts.free')}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div
        ref={timelineRef}
        className="flex-1 relative overflow-hidden"
        style={{
          minHeight: 28,
          outline: !isZone && isDropTarget ? '2px dashed var(--accent)' : 'none',
          outlineOffset: -1,
          borderRadius: 4,
          transition: 'outline 0.15s ease',
        }}
        onDragOver={isZone ? undefined : handleDragOver}
        onDrop={isZone ? undefined : handleDrop}
      >
        {/* Background grid */}
        <div
          className="absolute inset-0 rounded"
          style={{
            background: isDropTarget ? 'rgba(var(--accent-rgb, 99, 102, 241), 0.08)' : 'var(--bg-glass)',
            border: '1px solid var(--border-glass)',
            transition: 'background 0.15s ease',
          }}
        />

        {/* Hour + half-hour grid lines */}
        {(() => {
          const startH = parseInt(shiftStart.split(':')[0], 10);
          const endH = parseInt(shiftEnd.split(':')[0], 10);
          const total = endH - startH;
          const lines = [];
          for (let h = startH; h <= endH; h++) {
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
          const hasConflict = conflictItemIds && conflictItemIds.has(item.id);

          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              onDragEnd={handleDragEnd}
              className="absolute top-0.5 bottom-0.5 rounded cursor-grab transition-all hover:opacity-90 hover:shadow-lg flex items-center px-1 overflow-hidden"
              style={{
                ...style,
                background: colors.bg,
                color: colors.text,
                zIndex: 2,
                marginRight: 2,
                minWidth: 30,
                outline: hasConflict ? '2px solid var(--danger)' : 'none',
                outlineOffset: -1,
                boxShadow: hasConflict ? '0 0 6px rgba(239, 68, 68, 0.5)' : undefined,
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
      </div>
    </div>
  );
}
