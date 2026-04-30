import {
  Clock, Car, Wrench, AlertTriangle, X, User, FileText,
  Timer, Package, CreditCard,
} from 'lucide-react';
import { STATUS_COLORS, formatTime } from './constants';
import PostTimer from '../PostTimer';

// Work order detail modal
export default function WorkOrderModal({ item, post, onClose, t }) {
  if (!item) return null;

  const status = item.status;
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.scheduled;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl"
        style={{ border: '1px solid var(--border-glass)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={20} style={{ color: 'var(--accent)' }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {item.workOrderNumber}
            </h3>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: statusColor.bg, color: statusColor.text }}
            >
              {t(`workOrders.${status}`)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Client / Vehicle */}
          <div className="col-span-2 p-3 rounded-xl" style={{ background: 'var(--accent-light)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Car size={14} style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                {item.plateNumber}
              </span>
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {item.brand} {item.model}
            </div>
          </div>

          {/* Work type */}
          <div className="col-span-2 p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              {t('workOrders.workType')}
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {item.workType}
            </div>
          </div>

          {/* Time */}
          <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <div className="flex items-center gap-1 mb-1">
              <Clock size={12} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('dashboardPosts.startTime')}
              </span>
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {formatTime(item.startTime)}
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <div className="flex items-center gap-1 mb-1">
              <Timer size={12} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {status === 'completed' ? t('dashboardPosts.endTime') : t('dashboardPosts.estimatedEnd')}
              </span>
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {formatTime(item.endTime || item.estimatedEnd)}
            </div>
          </div>

          {/* Live timer for in-progress items */}
          {status === 'in_progress' && (item.endTime || item.estimatedEnd) && (
            <div className="col-span-2 flex items-center justify-center">
              <PostTimer
                estimatedEnd={item.endTime || item.estimatedEnd}
                startTime={item.startTime}
                size="lg"
              />
            </div>
          )}

          {/* Norm hours */}
          <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              {t('workOrders.normHours')}
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {item.normHours} {t('dashboardPosts.hours')}
            </div>
          </div>

          {item.actualHours != null && (
            <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                {t('workOrders.actualHours')}
              </div>
              <div className="text-sm font-medium" style={{
                color: item.actualHours > item.normHours ? 'var(--danger)' : 'var(--success)'
              }}>
                {item.actualHours} {t('dashboardPosts.hours')}
              </div>
            </div>
          )}

          {/* Master */}
          {item.master && (
            <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
              <div className="flex items-center gap-1 mb-1">
                <User size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('dashboardPosts.master')}
                </span>
              </div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {item.master}
              </div>
            </div>
          )}

          {/* Worker */}
          {item.worker && (
            <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
              <div className="flex items-center gap-1 mb-1">
                <Wrench size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('dashboardPosts.worker')}
                </span>
              </div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {item.worker}
              </div>
            </div>
          )}

          {/* Payment status placeholder */}
          <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <div className="flex items-center gap-1 mb-1">
              <CreditCard size={12} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('dashboardPosts.paymentStatus')}
              </span>
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--warning)' }}>
              {t('dashboardPosts.notPaid')}
            </div>
          </div>

          {/* Post */}
          <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              {t('dashboardPosts.post')}
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {(() => { const m = post.name?.match(/\d+/)?.[0]; const num = m ? parseInt(m, 10) : null; return num ? t(`posts.post${num}`) : post.name; })()}
            </div>
          </div>

          {/* Note */}
          {item.note && (
            <div className="col-span-2 p-3 rounded-xl" style={{ background: 'rgba(var(--warning-rgb, 234, 179, 8), 0.1)', border: '1px solid var(--warning)' }}>
              <div className="flex items-center gap-1 mb-1">
                <AlertTriangle size={12} style={{ color: 'var(--warning)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--warning)' }}>
                  {t('dashboardPosts.note')}
                </span>
              </div>
              <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {item.note}
              </div>
            </div>
          )}

          {/* Parts placeholder */}
          <div className="col-span-2 p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <div className="flex items-center gap-1 mb-1">
              <Package size={12} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('dashboardPosts.parts')}
              </span>
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('dashboardPosts.partsFromAlpha')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
