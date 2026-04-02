import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const BASE = import.meta.env.BASE_URL || './';
const fetchApi = async (path) => {
  const res = await fetch(`${BASE}data/${path}.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};
import {
  Clock, Truck, Car, Wrench, AlertTriangle, Settings,
  ChevronDown, ChevronUp, X, User, FileText, Calendar,
  CircleDot, Timer, Package, CreditCard, ArrowRight,
} from 'lucide-react';

const POST_TYPE_ICONS = {
  light: Car,
  heavy: Truck,
  diagnostics: Wrench,
  wash: Wrench,
  tire: Wrench,
  alignment: Wrench,
};

const STATUS_COLORS = {
  completed: { bg: 'var(--success)', text: '#fff' },
  in_progress: { bg: 'var(--accent)', text: '#fff' },
  scheduled: { bg: 'var(--text-muted)', text: '#fff' },
  overdue: { bg: 'var(--danger)', text: '#fff' },
};

const POST_STATUS_COLORS = {
  occupied: 'var(--danger)',
  free: 'var(--success)',
  unknown: 'var(--text-muted)',
};

function parseTime(timeStr) {
  const d = new Date(timeStr);
  return d.getTime();
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  const d = new Date(timeStr);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function getShiftBounds(shiftStart, shiftEnd) {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(`${today}T${shiftStart}:00`).getTime();
  const end = new Date(`${today}T${shiftEnd}:00`).getTime();
  return { start, end, duration: end - start };
}

function getNowPosition(shiftStart, shiftEnd) {
  const { start, duration } = getShiftBounds(shiftStart, shiftEnd);
  const now = Date.now();
  return Math.max(0, Math.min(100, ((now - start) / duration) * 100));
}

function getBlockStyle(item, shiftStart, shiftEnd) {
  const { start, duration } = getShiftBounds(shiftStart, shiftEnd);
  const itemStart = parseTime(item.startTime);
  const itemEnd = parseTime(item.endTime || item.estimatedEnd || item.startTime);
  const left = Math.max(0, ((itemStart - start) / duration) * 100);
  const width = Math.max(2, ((itemEnd - itemStart) / duration) * 100);
  return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
}

function getItemStatus(item, shiftStart, shiftEnd) {
  if (item.status === 'completed') return 'completed';
  if (item.status === 'scheduled') return 'scheduled';
  if (item.status === 'in_progress') {
    const est = item.estimatedEnd ? parseTime(item.estimatedEnd) : null;
    if (est && Date.now() > est) return 'overdue';
    return 'in_progress';
  }
  return item.status;
}

// Timeline hours markers
function TimelineHeader({ shiftStart, shiftEnd }) {
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

// Single timeline row for a post
function TimelineRow({ post, shiftStart, shiftEnd, onBlockClick }) {
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

// Work order detail modal
function WorkOrderModal({ item, post, onClose, t }) {
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
              {(() => { const num = post.name?.match(/\d+/)?.[0]; return num ? t(`posts.post${num}`) : post.name; })()}
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

// Settings panel
function SettingsPanel({ settings, onSettingsChange, onClose, t }) {
  const [local, setLocal] = useState({ ...settings });

  const handleSave = () => {
    onSettingsChange(local);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
        style={{ border: '1px solid var(--border-glass)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings size={20} style={{ color: 'var(--accent)' }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('dashboardPosts.settings')}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Shift start */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              {t('dashboardPosts.shiftStart')}
            </label>
            <input
              type="time"
              value={local.shiftStart}
              onChange={(e) => setLocal({ ...local, shiftStart: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Shift end */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              {t('dashboardPosts.shiftEnd')}
            </label>
            <input
              type="time"
              value={local.shiftEnd}
              onChange={(e) => setLocal({ ...local, shiftEnd: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Posts count */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              {t('dashboardPosts.postsCount')}
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={local.postsCount}
              onChange={(e) => setLocal({ ...local, postsCount: parseInt(e.target.value, 10) || 10 })}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Mode */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              {t('dashboardPosts.mode')}
            </label>
            <div className="flex gap-2">
              {['demo', 'live'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLocal({ ...local, mode })}
                  className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: local.mode === mode ? 'var(--accent)' : 'var(--bg-glass)',
                    color: local.mode === mode ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${local.mode === mode ? 'var(--accent)' : 'var(--border-glass)'}`,
                  }}
                >
                  {mode === 'demo' ? 'Demo' : 'Live'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl text-sm"
            style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-secondary)',
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Free work orders table
function FreeWorkOrdersTable({ orders, t }) {
  const [expanded, setExpanded] = useState(true);

  if (!orders || orders.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-2 hover:opacity-80 transition-opacity"
      >
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('dashboardPosts.freeWorkOrders')}
        </h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
        >
          {orders.length}
        </span>
      </button>

      {expanded && (
        <div
          className="glass rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border-glass)' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--bg-glass)' }}>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {t('workOrders.orderNumber')}
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {t('workOrders.plateNumber')}
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {t('workOrders.workType')}
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {t('dashboardPosts.postType')}
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {t('workOrders.normHours')}
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {t('dashboardPosts.client')}
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {t('dashboardPosts.note')}
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((wo) => {
                const TypeIcon = wo.postType === 'heavy' ? Truck : Car;
                return (
                  <tr
                    key={wo.id}
                    className="border-t hover:opacity-80 transition-opacity"
                    style={{ borderColor: 'var(--border-glass)' }}
                  >
                    <td className="px-3 py-2.5 font-mono font-medium text-sm" style={{ color: 'var(--accent)' }}>
                      {wo.workOrderNumber}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {wo.plateNumber}
                      </span>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {wo.brand} {wo.model}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {wo.workType}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <TypeIcon size={14} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {t(`posts.${wo.postType}`)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {wo.normHours} {t('dashboardPosts.hours')}
                    </td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {wo.client}
                    </td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: wo.note ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {wo.note || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Legend
function Legend({ t }) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {Object.entries(STATUS_COLORS).map(([key, { bg }]) => (
        <div key={key} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: bg }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t(`dashboardPosts.status_${key}`)}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 ml-2">
        <div className="w-4 h-0.5" style={{ background: 'var(--danger)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('dashboardPosts.currentTime')}
        </span>
      </div>
    </div>
  );
}

// Main component
export default function DashboardPosts() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    shiftStart: '08:00',
    shiftEnd: '20:00',
    postsCount: 10,
    mode: 'demo',
  });

  useEffect(() => {
    const saved = localStorage.getItem('dashboardPostsSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchApi('dashboard-posts')
      .then((res) => {
        setData(res);
        if (res.settings) {
          const saved = localStorage.getItem('dashboardPostsSettings');
          if (!saved) {
            setSettings(res.settings);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('dashboardPostsSettings', JSON.stringify(newSettings));
  };

  const handleBlockClick = (item, post) => {
    setSelectedItem(item);
    setSelectedPost(post);
  };

  const posts = useMemo(() => {
    if (!data?.posts) return [];
    return data.posts.slice(0, settings.postsCount);
  }, [data, settings.postsCount]);

  // Summary stats
  const stats = useMemo(() => {
    if (!posts.length) return {};
    const occupied = posts.filter(p => p.status !== 'free').length;
    const free = posts.length - occupied;
    let completedWO = 0, totalNormHours = 0, totalActualHours = 0;
    let idleMinutes = 0, overdueMinutes = 0, savedMinutes = 0;
    const now = new Date();
    const { start: shiftStartMs } = getShiftBounds(settings.shiftStart, settings.shiftEnd);

    posts.forEach(p => {
      const tl = p.timeline.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      tl.forEach(item => {
        if (item.status === 'completed') {
          completedWO++;
          totalNormHours += item.normHours || 0;
          totalActualHours += item.actualHours || 0;
          // Saved time: norm - actual (if faster)
          if (item.actualHours != null && item.normHours > item.actualHours) {
            savedMinutes += (item.normHours - item.actualHours) * 60;
          }
        }
        // Overdue: in_progress past estimatedEnd
        if (item.status === 'in_progress' && item.estimatedEnd) {
          const est = new Date(item.estimatedEnd);
          if (now > est) overdueMinutes += (now - est) / 60000;
        }
      });
      // Idle time: gaps between WOs within shift
      for (let i = 0; i < tl.length - 1; i++) {
        const end = new Date(tl[i].endTime || tl[i].estimatedEnd || tl[i].startTime);
        const nextStart = new Date(tl[i + 1].startTime);
        if (nextStart > end) idleMinutes += (nextStart - end) / 60000;
      }
      // Idle before first WO (from shift start)
      if (tl.length > 0) {
        const firstStart = new Date(tl[0].startTime);
        if (firstStart.getTime() > shiftStartMs) {
          idleMinutes += (firstStart.getTime() - shiftStartMs) / 60000;
        }
      }
    });

    const fmtMin = (m) => {
      const h = Math.floor(m / 60);
      const min = Math.round(m % 60);
      return h > 0 ? `${h}ч ${min}м` : `${min}м`;
    };

    return { occupied, free, completedWO, totalNormHours: Math.round(totalNormHours * 10) / 10, idleTime: fmtMin(idleMinutes), overdueTime: fmtMin(overdueMinutes), savedTime: fmtMin(savedMinutes) };
  }, [posts, settings.shiftStart, settings.shiftEnd]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('dashboardPosts.title')}
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('dashboardPosts.subtitle')} · {settings.shiftStart} – {settings.shiftEnd}
            {settings.mode === 'demo' && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ background: 'var(--warning)', color: '#000' }}>
                DEMO
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <Calendar size={14} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {new Date().toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl hover:opacity-80 transition-opacity"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: isRu ? 'Занято' : 'Occupied', value: stats.occupied, color: 'var(--accent)', icon: CircleDot,
            tip: isRu ? 'Количество постов, на которых сейчас находится автомобиль' : 'Number of posts currently occupied by a vehicle' },
          { label: isRu ? 'Свободно' : 'Free', value: stats.free, color: 'var(--warning)', icon: CircleDot,
            tip: isRu ? 'Количество свободных постов, готовых принять авто' : 'Number of free posts ready to accept a vehicle' },
          { sep: true },
          { label: isRu ? 'Выполнено ЗН' : 'Completed WO', value: stats.completedWO, color: 'var(--success)', icon: FileText,
            tip: isRu ? 'Количество завершённых заказ-нарядов за текущую смену' : 'Number of completed work orders this shift' },
          { label: isRu ? 'Нормо-часы' : 'Norm hours', value: stats.totalNormHours, color: 'var(--text-primary)', icon: Clock,
            tip: isRu ? 'Сумма нормо-часов по завершённым заказ-нарядам' : 'Total norm hours from completed work orders' },
          { label: isRu ? 'Простой' : 'Idle time', value: stats.idleTime, color: 'var(--text-muted)', icon: Timer,
            tip: isRu ? 'Суммарное время, когда посты были свободны в течение смены' : 'Total time posts were idle during the shift' },
          { label: isRu ? 'Просрочка' : 'Overdue', value: stats.overdueTime, color: 'var(--danger)', icon: AlertTriangle,
            tip: isRu ? 'Суммарное время задержки — работы идут дольше запланированного' : 'Total overdue time — work taking longer than planned' },
          { label: isRu ? 'Турбо' : 'Turbo', value: stats.savedTime, color: 'var(--success)', icon: ArrowRight,
            tip: isRu ? 'Сэкономленное время — работы выполнены быстрее нормо-часов' : 'Saved time — work completed faster than norm hours' },
        ].map((card, i) => card.sep ? (
          <div key={i} style={{ width: 1, background: 'var(--border-glass)', alignSelf: 'stretch' }} />
        ) : (
          <div
            key={i}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg relative group"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}
          >
            <div className="absolute top-full left-0 mt-1 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
              style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', width: 220, fontSize: '12px', lineHeight: 1.4 }}>
              {card.tip}
            </div>
            <card.icon size={11} style={{ color: card.color }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.label}</span>
            <span className="text-sm font-bold" style={{ color: card.color }}>{card.value}</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <Legend t={t} />

      {/* Timeline header + rows with global "now" line */}
      <div
        className="glass rounded-xl p-3 relative"
        style={{ border: '1px solid var(--border-glass)' }}
      >
        <div className="flex gap-2 mb-1">
          <div style={{ width: 190, minWidth: 190 }} />
          <div className="flex-1">
            <TimelineHeader shiftStart={settings.shiftStart} shiftEnd={settings.shiftEnd} />
          </div>
        </div>
        {posts.map((post) => (
          <TimelineRow
            key={post.id}
            post={post}
            shiftStart={settings.shiftStart}
            shiftEnd={settings.shiftEnd}
            onBlockClick={handleBlockClick}
          />
        ))}
        {/* Global "now" line overlay — same flex layout as rows */}
        <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none flex gap-2" style={{ padding: '12px', zIndex: 10 }}>
          <div style={{ width: 190, minWidth: 190, flexShrink: 0 }} />
          <div className="flex-1 relative">
            {(() => {
              const nowPos = getNowPosition(settings.shiftStart, settings.shiftEnd);
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

      {/* Free work orders */}
      <FreeWorkOrdersTable orders={data?.freeWorkOrders} t={t} />

      {/* Modals */}
      {selectedItem && (
        <WorkOrderModal
          item={selectedItem}
          post={selectedPost}
          onClose={() => { setSelectedItem(null); setSelectedPost(null); }}
          t={t}
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
          t={t}
        />
      )}
    </div>
  );
}
