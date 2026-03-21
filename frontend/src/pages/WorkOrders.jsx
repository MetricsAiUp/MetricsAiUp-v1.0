import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export default function WorkOrders() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const [orders, setOrders] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');

  const fetchOrders = () => {
    api.get('/api/work-orders')
      .then(res => setOrders(res.data.orders))
      .catch(console.error);
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleImport = async () => {
    try {
      await api.post('/api/work-orders/import-csv', { csvData: csvText });
      setCsvText('');
      setShowImport(false);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const statusColors = {
    scheduled: 'var(--info)',
    in_progress: 'var(--warning)',
    completed: 'var(--success)',
    cancelled: 'var(--text-muted)',
    no_show: 'var(--danger)',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('workOrders.title')}
        </h2>
        <button
          onClick={() => setShowImport(!showImport)}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          {t('workOrders.importCsv')}
        </button>
      </div>

      {/* CSV Import */}
      {showImport && (
        <div className="glass p-4 space-y-3">
          <textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder="order_number,date,plate_number,work_type,norm_hours"
            rows={5}
            className="w-full p-3 rounded-xl text-sm font-mono outline-none"
            style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-primary)',
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              className="px-4 py-2 rounded-xl text-sm text-white"
              style={{ background: 'var(--success)' }}
            >
              {t('common.save')}
            </button>
            <button
              onClick={() => setShowImport(false)}
              className="px-4 py-2 rounded-xl text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-static overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
              {['orderNumber', 'scheduledTime', 'plateNumber', 'workType', 'normHours', 'status'].map(col => (
                <th key={col} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                  {t(`workOrders.${col}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(wo => (
              <tr key={wo.id} className="hover:opacity-80 transition-opacity" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{wo.orderNumber}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{new Date(wo.scheduledTime).toLocaleString()}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{wo.plateNumber || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{wo.workType || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{wo.normHours || '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-1 rounded-full text-xs"
                    style={{ background: (statusColors[wo.status] || 'var(--text-muted)') + '22', color: statusColors[wo.status] }}
                  >
                    {t(`workOrders.${wo.status}`)}
                  </span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  {t('common.noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
