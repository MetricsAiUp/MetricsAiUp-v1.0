import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowLeft, User, ClipboardList, Clock, TrendingUp, Wrench, Car } from 'lucide-react';
import HelpButton from '../components/HelpButton';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

export default function WorkerStats() {
  const { workerName } = useParams();
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api, appMode } = useAuth();
  const isLive = appMode === 'live';
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/api/workers/${encodeURIComponent(workerName)}/stats${qs}`);
      setData(res?.data || res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [api, workerName, dateFrom, dateTo]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (isLive) {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('nav.workerStats') || 'Worker Stats'}</h2>
        <div className="glass p-8 text-center" style={{ color: 'var(--text-muted)' }}>
          {isRu ? 'В режиме LIVE данные этой страницы не отображаются.' : 'This page has no data in LIVE mode.'}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        {t('common.loading')}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm mb-4 hover:opacity-80" style={{ color: 'var(--accent)' }}>
          <ArrowLeft size={16} /> {t('workerStats.back')}
        </button>
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
          {t('workerStats.noData')}
        </div>
      </div>
    );
  }

  const { summary, topRepairTypes, topBrands, dailyStats, recentOrders } = data;

  const kpis = [
    { label: t('workerStats.totalWO'), value: summary.totalWorkOrders, icon: ClipboardList, color: '#3b82f6' },
    { label: t('workerStats.normHours'), value: `${summary.totalNormHours}h`, icon: Clock, color: '#10b981' },
    { label: t('workerStats.efficiency'), value: `${summary.avgEfficiency}%`, icon: TrendingUp, color: summary.avgEfficiency >= 100 ? '#10b981' : '#f59e0b' },
    { label: isRu ? 'Завершено' : 'Completed', value: summary.completedWorkOrders, icon: Wrench, color: '#8b5cf6' },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs mb-1 hover:opacity-80" style={{ color: 'var(--accent)' }}>
            <ArrowLeft size={14} /> {t('workerStats.back')}
          </button>
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <User size={20} style={{ color: 'var(--accent)' }} />
            {t('workerStats.title')}: {decodeURIComponent(workerName)}
            <HelpButton pageKey="workerStats" />
          </h2>
        </div>
        {/* Period selector */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>-</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className="glass-static rounded-2xl p-4" style={{ border: '1px solid var(--border-glass)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} style={{ color: kpi.color }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{kpi.label}</span>
              </div>
              <div className="text-2xl font-bold font-mono" style={{ color: kpi.color }}>
                {kpi.value}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily output chart */}
        {dailyStats.length > 0 && (
          <div className="glass-static rounded-2xl p-5" style={{ border: '1px solid var(--border-glass)' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              {t('workerStats.dailyOutput')}
            </h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-glass)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="normHours" name={isRu ? 'Нормо-часы' : 'Norm hours'} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actualHours" name={isRu ? 'Факт. часы' : 'Actual hours'} fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Repair types pie chart */}
        {topRepairTypes.length > 0 && (
          <div className="glass-static rounded-2xl p-5" style={{ border: '1px solid var(--border-glass)' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              {t('workerStats.repairTypes')}
            </h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={topRepairTypes}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ type, count }) => `${type} (${count})`}
                    labelLine={{ stroke: 'var(--text-muted)' }}
                  >
                    {topRepairTypes.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-glass)', borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top brands */}
        {topBrands.length > 0 && (
          <div className="glass-static rounded-2xl p-5" style={{ border: '1px solid var(--border-glass)' }}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Car size={16} style={{ color: 'var(--accent)' }} />
              {t('workerStats.brands')}
            </h3>
            <div className="space-y-1.5">
              {topBrands.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{b.brand}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-glass)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(b.count / topBrands[0].count) * 100}%`, background: COLORS[i % COLORS.length] }}
                    />
                  </div>
                  <span className="text-xs font-mono w-8 text-right" style={{ color: 'var(--text-muted)' }}>{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent orders table */}
        {recentOrders.length > 0 && (
          <div className="glass-static rounded-2xl p-5" style={{ border: '1px solid var(--border-glass)' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              {t('workerStats.recentOrders')}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <th className="text-left px-2 py-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>#</th>
                    <th className="text-left px-2 py-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Тип' : 'Type'}</th>
                    <th className="text-left px-2 py-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Авто' : 'Vehicle'}</th>
                    <th className="text-right px-2 py-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Н/ч' : 'N/h'}</th>
                    <th className="text-left px-2 py-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Статус' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td className="px-2 py-1.5 font-mono" style={{ color: 'var(--accent)' }}>{o.number}</td>
                      <td className="px-2 py-1.5" style={{ color: 'var(--text-primary)' }}>{o.workType || '-'}</td>
                      <td className="px-2 py-1.5" style={{ color: 'var(--text-secondary)' }}>
                        {o.brand ? `${o.brand} ${o.model || ''}` : '-'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{o.normHours || '-'}</td>
                      <td className="px-2 py-1.5">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-xs"
                          style={{
                            background: o.status === 'completed' ? 'rgba(16,185,129,0.15)' : o.status === 'in_progress' ? 'rgba(59,130,246,0.15)' : 'rgba(148,163,184,0.15)',
                            color: o.status === 'completed' ? '#10b981' : o.status === 'in_progress' ? '#3b82f6' : 'var(--text-muted)',
                          }}
                        >
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* No data message */}
      {!dailyStats.length && !topRepairTypes.length && !recentOrders.length && (
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
          <User size={48} className="mx-auto mb-3 opacity-30" />
          <div>{t('workerStats.noData')}</div>
        </div>
      )}
    </div>
  );
}
