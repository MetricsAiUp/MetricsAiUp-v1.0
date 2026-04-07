import { useState, useCallback } from 'react';
import { Truck, Car, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';

// Free work orders table — rows are draggable onto the timeline
export default function FreeWorkOrdersTable({ orders, t }) {
  const [expanded, setExpanded] = useState(true);

  const handleDragStart = useCallback((e, wo) => {
    e.dataTransfer.effectAllowed = 'move';
    const dragData = {
      type: 'free-work-order',
      itemId: wo.id,
      fromPostId: null,
      workOrderNumber: wo.workOrderNumber,
      plateNumber: wo.plateNumber,
      brand: wo.brand,
      model: wo.model,
      workType: wo.workType,
      normHours: wo.normHours,
      postType: wo.postType,
      client: wo.client,
      note: wo.note,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.currentTarget.style.opacity = '0.4';
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.style.opacity = '1';
  }, []);

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
                <th className="w-8" />
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
                    draggable
                    onDragStart={(e) => handleDragStart(e, wo)}
                    onDragEnd={handleDragEnd}
                    className="border-t hover:opacity-80 transition-opacity cursor-grab"
                    style={{ borderColor: 'var(--border-glass)' }}
                  >
                    <td className="px-1 py-2.5 text-center">
                      <GripVertical size={14} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                    </td>
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
                      {wo.note || '\u2014'}
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
