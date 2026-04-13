import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, Area, AreaChart,
} from 'recharts';
import { FileSpreadsheet, FileText, ArrowLeftRight } from 'lucide-react';
import HelpButton from '../components/HelpButton';
import DeltaBadge from '../components/DeltaBadge';
import WeeklyHeatmap from '../components/WeeklyHeatmap';
import { exportToXlsx, exportToPdf, downloadChartAsPng } from '../utils/export';

const POST_COLORS = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'];

const PERIODS = [
  { key: 'today', days: 1 },
  { key: '24h', days: 1 },
  { key: '7d', days: 7 },
  { key: '30d', days: 30 },
];

function StatCard({ label, value, sub, color }) {
  return (
    <div className="glass px-3 py-2">
      <p className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-lg font-bold leading-tight" style={{ color: color || 'var(--accent)' }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children, chartRef, onContextMenu }) {
  return (
    <div className="glass-static p-5" ref={chartRef} onContextMenu={onContextMenu}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {children}
    </div>
  );
}

const customTooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.9)',
  border: '1px solid rgba(148, 163, 184, 0.2)',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: '12px',
};

export default function Analytics() {
  const { t, i18n } = useTranslation();
  const { api, isElementVisible } = useAuth();
  const elVis = (id) => isElementVisible('analytics', id);
  const [history, setHistory] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [selectedPost, setSelectedPost] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [compareMode, setCompareMode] = useState(false);

  const containerRef = useRef(null);
  const chartRefs = useRef({});

  const isRu = i18n.language === 'ru';

  const getChartRef = useCallback((key) => {
    if (!chartRefs.current[key]) chartRefs.current[key] = { current: null };
    return (el) => { chartRefs.current[key].current = el; };
  }, []);

  const handleChartContextMenu = useCallback((e, chartKey) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, chartKey });
  }, []);

  const handleDownloadPng = useCallback(async () => {
    if (!ctxMenu) return;
    const el = chartRefs.current[ctxMenu.chartKey]?.current;
    if (el) {
      try {
        await downloadChartAsPng(el, `${ctxMenu.chartKey}-${new Date().toISOString().slice(0, 10)}.png`);
      } catch (err) {
        console.error('PNG export failed:', err);
      }
    }
    setCtxMenu(null);
  }, [ctxMenu]);

  // Close context menu on click anywhere
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [ctxMenu]);

  useEffect(() => {
    api.get('/api/analytics-history').then(r => setHistory(r.data)).catch(console.error);
  }, []);

  const periodDays = PERIODS.find(p => p.key === period)?.days || 30;

  // Filter data by period
  const filteredPosts = useMemo(() => {
    if (!history?.posts) return [];
    return history.posts.map(post => ({
      ...post,
      days: post.days.slice(-periodDays),
    }));
  }, [history, periodDays]);

  const filteredDaily = useMemo(() => {
    if (!history?.daily) return [];
    return history.daily.slice(-periodDays);
  }, [history, periodDays]);

  // Aggregated per-post summary for the selected period
  const postSummaries = useMemo(() => {
    return filteredPosts.map((post, i) => {
      const days = post.days;
      const workDays = days.filter(d => d.vehicleCount > 0).length || 1;
      return {
        id: post.id,
        name: isRu ? post.name : post.nameEn,
        type: post.type,
        color: POST_COLORS[i],
        avgOccupancy: +(days.reduce((s, d) => s + d.occupancyRate, 0) / days.length * 100).toFixed(1),
        avgEfficiency: +(days.reduce((s, d) => s + d.efficiency, 0) / days.length * 100).toFixed(1),
        totalVehicles: days.reduce((s, d) => s + d.vehicleCount, 0),
        avgVehiclesPerDay: +(days.reduce((s, d) => s + d.vehicleCount, 0) / workDays).toFixed(1),
        avgTimePerVehicle: Math.round(days.reduce((s, d) => s + d.avgTimePerVehicle, 0) / workDays),
        avgWaitTime: Math.round(days.reduce((s, d) => s + d.avgWaitTime, 0) / days.length),
        totalActiveH: +(days.reduce((s, d) => s + d.activeMinutes, 0) / 60).toFixed(1),
        totalIdleH: +(days.reduce((s, d) => s + d.idleMinutes, 0) / 60).toFixed(1),
        avgWorkerPresence: +(days.reduce((s, d) => s + d.workerPresence, 0) / days.length * 100).toFixed(1),
        totalPlanned: days.reduce((s, d) => s + d.plannedOrders, 0),
        totalCompleted: days.reduce((s, d) => s + d.completedOrders, 0),
        totalNoShows: days.reduce((s, d) => s + d.noShows, 0),
        plannedH: +(days.reduce((s, d) => s + d.plannedHours, 0)).toFixed(1),
        actualH: +(days.reduce((s, d) => s + d.actualHours, 0)).toFixed(1),
      };
    });
  }, [filteredPosts, isRu]);

  // Overall totals
  const totals = useMemo(() => {
    if (!postSummaries.length) return {};
    return {
      avgOccupancy: +(postSummaries.reduce((s, p) => s + p.avgOccupancy, 0) / postSummaries.length).toFixed(1),
      avgEfficiency: +(postSummaries.reduce((s, p) => s + p.avgEfficiency, 0) / postSummaries.length).toFixed(1),
      totalVehicles: postSummaries.reduce((s, p) => s + p.totalVehicles, 0),
      totalActiveH: +(postSummaries.reduce((s, p) => s + p.totalActiveH, 0)).toFixed(1),
      totalIdleH: +(postSummaries.reduce((s, p) => s + p.totalIdleH, 0)).toFixed(1),
      totalNoShows: postSummaries.reduce((s, p) => s + p.totalNoShows, 0),
    };
  }, [postSummaries]);

  // Previous period data for comparison
  const prevPostSummaries = useMemo(() => {
    if (!compareMode || !history?.posts) return [];
    return history.posts.map((post) => {
      const days = post.days.slice(-periodDays * 2, -periodDays);
      if (!days.length) return null;
      const workDays = days.filter(d => d.vehicleCount > 0).length || 1;
      return {
        avgOccupancy: +(days.reduce((s, d) => s + d.occupancyRate, 0) / days.length * 100).toFixed(1),
        avgEfficiency: +(days.reduce((s, d) => s + d.efficiency, 0) / days.length * 100).toFixed(1),
        totalVehicles: days.reduce((s, d) => s + d.vehicleCount, 0),
        totalActiveH: +(days.reduce((s, d) => s + d.activeMinutes, 0) / 60).toFixed(1),
        totalIdleH: +(days.reduce((s, d) => s + d.idleMinutes, 0) / 60).toFixed(1),
        totalNoShows: days.reduce((s, d) => s + d.noShows, 0),
      };
    }).filter(Boolean);
  }, [compareMode, history, periodDays]);

  const deltas = useMemo(() => {
    if (!compareMode || !prevPostSummaries.length) return {};
    const prev = {
      avgOccupancy: +(prevPostSummaries.reduce((s, p) => s + p.avgOccupancy, 0) / prevPostSummaries.length).toFixed(1),
      avgEfficiency: +(prevPostSummaries.reduce((s, p) => s + p.avgEfficiency, 0) / prevPostSummaries.length).toFixed(1),
      totalVehicles: prevPostSummaries.reduce((s, p) => s + p.totalVehicles, 0),
      totalActiveH: +(prevPostSummaries.reduce((s, p) => s + p.totalActiveH, 0)).toFixed(1),
      totalIdleH: +(prevPostSummaries.reduce((s, p) => s + p.totalIdleH, 0)).toFixed(1),
      totalNoShows: prevPostSummaries.reduce((s, p) => s + p.totalNoShows, 0),
    };
    return {
      avgOccupancy: +(totals.avgOccupancy - prev.avgOccupancy).toFixed(1),
      avgEfficiency: +(totals.avgEfficiency - prev.avgEfficiency).toFixed(1),
      totalVehicles: totals.totalVehicles - prev.totalVehicles,
      totalActiveH: +(totals.totalActiveH - prev.totalActiveH).toFixed(1),
      totalIdleH: +(totals.totalIdleH - prev.totalIdleH).toFixed(1),
      totalNoShows: totals.totalNoShows - prev.totalNoShows,
    };
  }, [compareMode, prevPostSummaries, totals]);

  // Data for occupancy pie chart
  const pieData = postSummaries.map(p => ({ name: p.name, value: p.avgOccupancy }));

  // Data for bar chart: ranking posts
  const rankingData = [...postSummaries].sort((a, b) => b.avgOccupancy - a.avgOccupancy);

  // Daily trend: occupancy per post (line chart)
  const trendData = useMemo(() => {
    if (!filteredPosts.length) return [];
    const days = filteredPosts[0].days;
    return days.map((_, di) => {
      const point = { date: filteredPosts[0].days[di].date.slice(5) }; // MM-DD
      filteredPosts.forEach((post, pi) => {
        point[post.name] = +(post.days[di]?.occupancyRate * 100).toFixed(1);
      });
      return point;
    });
  }, [filteredPosts]);

  // Daily vehicles chart
  const vehiclesData = filteredDaily.map(d => ({
    date: d.date.slice(5),
    [isRu ? 'Авто' : 'Vehicles']: d.totalVehicles,
    [isRu ? 'No-show' : 'No-show']: d.totalNoShows,
  }));

  // Efficiency per post bar data
  const efficiencyData = postSummaries.map(p => ({
    name: p.name,
    [isRu ? 'Эффективность' : 'Efficiency']: p.avgEfficiency,
    [isRu ? 'Занятость' : 'Occupancy']: p.avgOccupancy,
  }));

  // Plan vs fact per post
  const planFactData = postSummaries.map(p => ({
    name: p.name,
    [isRu ? 'План (ч)' : 'Plan (h)']: p.plannedH,
    [isRu ? 'Факт (ч)' : 'Actual (h)']: p.actualH,
  }));

  // Heatmap data: 10 posts x 12 hours (8-19)
  const heatmapData = useMemo(() => {
    if (!filteredPosts.length) return [];
    return filteredPosts.map((post, pi) => {
      const hours = [];
      for (let h = 8; h <= 19; h++) {
        let totalOcc = 0, totalVeh = 0, count = 0;
        post.days.forEach(day => {
          const hd = day.hourly?.find(hr => hr.hour === h);
          if (hd) { totalOcc += hd.occupancy; totalVeh += hd.vehicles; count++; }
        });
        hours.push({
          hour: h,
          occupancy: count > 0 ? +(totalOcc / count * 100).toFixed(0) : 0,
          vehicles: count > 0 ? +(totalVeh / count).toFixed(1) : 0,
        });
      }
      return { id: post.id, name: isRu ? post.name : post.nameEn, hours, color: POST_COLORS[pi] };
    });
  }, [filteredPosts, isRu]);

  // Weekly heatmap data: aggregate by day of week
  const weeklyHeatmapData = useMemo(() => {
    if (!filteredPosts.length) return [];
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => ({ sum: 0, count: 0 })));
    filteredPosts.forEach(post => {
      post.days.forEach(day => {
        const dow = (new Date(day.date).getDay() + 6) % 7;
        (day.hourly || []).forEach(h => {
          const hi = h.hour - 8;
          if (hi >= 0 && hi < 12) { grid[dow][hi].sum += h.occupancy; grid[dow][hi].count++; }
        });
      });
    });
    return grid.map((row, dow) => ({
      dayIndex: dow,
      hours: row.map((cell, hi) => ({ hour: hi + 8, avgOccupancy: cell.count > 0 ? Math.round(cell.sum / cell.count * 100) : 0 })),
    }));
  }, [filteredPosts]);

  // Selected post detail
  const selPost = selectedPost ? filteredPosts.find(p => p.id === selectedPost) : null;
  const selSummary = selectedPost ? postSummaries.find(p => p.id === selectedPost) : null;

  const handleExportXlsx = async () => {
    try {
      setExporting('xlsx');
      exportToXlsx(history, postSummaries, filteredPosts, filteredDaily, isRu);
    } catch (err) {
      console.error('XLSX export failed:', err);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    try {
      setExporting('pdf');
      await exportToPdf(containerRef, isRu);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(null);
    }
  };

  if (!history) return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Загрузка...' : 'Loading...'}</div>;

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Context menu for chart PNG download */}
      {ctxMenu && (
        <div
          className="fixed z-50 shadow-lg rounded-lg py-1 px-1"
          style={{
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-glass)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <button
            onClick={handleDownloadPng}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('analytics.downloadPng')}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {isRu ? 'Аналитика постов' : 'Post Analytics'}
          </h2>
          <HelpButton pageKey="analytics" />
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={handleExportXlsx}
            disabled={exporting === 'xlsx'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
            style={{
              background: 'var(--bg-glass)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-glass)',
              opacity: exporting === 'xlsx' ? 0.6 : 1,
            }}
            title={t('analytics.exportExcel')}
          >
            <FileSpreadsheet size={16} />
            <span className="hidden sm:inline">{t('analytics.exportExcel')}</span>
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting === 'pdf'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
            style={{
              background: 'var(--bg-glass)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-glass)',
              opacity: exporting === 'pdf' ? 0.6 : 1,
            }}
            title={t('analytics.exportPdf')}
          >
            <FileText size={16} />
            <span className="hidden sm:inline">{t('analytics.exportPdf')}</span>
          </button>
          <div className="w-px h-6" style={{ background: 'var(--border-glass)' }} />
          {[
            { key: 'today', label: isRu ? 'Сегодня' : 'Today' },
            { key: '7d', label: isRu ? '7 дней' : '7 days' },
            { key: '30d', label: isRu ? '30 дней' : '30 days' },
          ].map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="px-4 py-2 rounded-xl text-sm transition-all"
              style={{
                background: period === p.key ? 'var(--accent)' : 'var(--bg-glass)',
                color: period === p.key ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${period === p.key ? 'var(--accent)' : 'var(--border-glass)'}`,
              }}>
              {p.label}
            </button>
          ))}
          <div className="w-px h-6" style={{ background: 'var(--border-glass)' }} />
          <button
            onClick={() => setCompareMode(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-all"
            style={{
              background: compareMode ? 'var(--accent)' : 'var(--bg-glass)',
              color: compareMode ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${compareMode ? 'var(--accent)' : 'var(--border-glass)'}`,
            }}
            title={t('analytics.vsPrevPeriod')}
          >
            <ArrowLeftRight size={14} />
            <span className="hidden sm:inline">{t('analytics.compare')}</span>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {elVis('summaryStats') && <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <StatCard label={isRu ? 'Ср. занятость' : 'Avg Occupancy'} value={`${totals.avgOccupancy}%`} color="#6366f1" sub={compareMode && deltas.avgOccupancy !== undefined ? <DeltaBadge value={deltas.avgOccupancy} /> : undefined} />
        <StatCard label={isRu ? 'Ср. эффективность' : 'Avg Efficiency'} value={`${totals.avgEfficiency}%`} color={totals.avgEfficiency >= 70 ? '#10b981' : '#f59e0b'} sub={compareMode && deltas.avgEfficiency !== undefined ? <DeltaBadge value={deltas.avgEfficiency} /> : undefined} />
        <StatCard label={isRu ? 'Всего авто' : 'Total Vehicles'} value={totals.totalVehicles} color="#3b82f6" sub={compareMode && deltas.totalVehicles !== undefined ? <DeltaBadge value={deltas.totalVehicles} suffix="" /> : undefined} />
        <StatCard label={isRu ? 'Активных часов' : 'Active Hours'} value={totals.totalActiveH} color="#10b981" sub={compareMode && deltas.totalActiveH !== undefined ? <DeltaBadge value={deltas.totalActiveH} suffix="h" /> : undefined} />
        <StatCard label={isRu ? 'Часов простоя' : 'Idle Hours'} value={totals.totalIdleH} color="#ef4444" sub={compareMode && deltas.totalIdleH !== undefined ? <DeltaBadge value={deltas.totalIdleH} suffix="h" inverse /> : undefined} />
        <StatCard label={isRu ? 'No-show' : 'No-show'} value={totals.totalNoShows} color="#f59e0b" sub={compareMode && deltas.totalNoShows !== undefined ? <DeltaBadge value={deltas.totalNoShows} suffix="" inverse /> : undefined} />
      </div>}

      {/* Row 1: Occupancy trend + Vehicles trend */}
      {elVis('trendsCharts') && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={isRu ? 'Загрузка постов по дням (%)' : 'Post Occupancy Trend (%)'} chartRef={getChartRef('occupancy-trend')} onContextMenu={(e) => handleChartContextMenu(e, 'occupancy-trend')}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="date" fontSize={10} stroke="#94a3b8" />
              <YAxis fontSize={10} stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip contentStyle={customTooltipStyle} />
              {filteredPosts.map((post, i) => (
                <Area key={post.id} type="monotone" dataKey={post.name}
                  stroke={POST_COLORS[i]} fill={POST_COLORS[i]} fillOpacity={0.08}
                  strokeWidth={1.5} dot={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={isRu ? 'Авто за день (все посты)' : 'Vehicles per Day (all posts)'} chartRef={getChartRef('vehicles-daily')} onContextMenu={(e) => handleChartContextMenu(e, 'vehicles-daily')}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={vehiclesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="date" fontSize={10} stroke="#94a3b8" />
              <YAxis fontSize={10} stroke="#94a3b8" />
              <Tooltip contentStyle={customTooltipStyle} />
              <Bar dataKey={isRu ? 'Авто' : 'Vehicles'} fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="No-show" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>}

      {/* Row 2: Ranking + Pie */}
      {elVis('rankingCharts') && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranking */}
        <ChartCard title={isRu ? 'Рейтинг постов по загрузке' : 'Post Ranking by Occupancy'} chartRef={getChartRef('ranking')} onContextMenu={(e) => handleChartContextMenu(e, 'ranking')}>
          <div className="space-y-2">
            {rankingData.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                onClick={() => setSelectedPost(p.id)}>
                <span className="text-xs w-5 font-bold" style={{ color: 'var(--text-muted)' }}>#{i + 1}</span>
                <span className="text-sm w-16" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'var(--bg-glass)' }}>
                  <div className="h-full rounded-full" style={{ width: `${p.avgOccupancy}%`, background: p.color }} />
                </div>
                <span className="text-xs w-12 text-right font-medium" style={{ color: p.color }}>{p.avgOccupancy}%</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Efficiency comparison */}
        <ChartCard title={isRu ? 'Эффективность vs Занятость' : 'Efficiency vs Occupancy'} chartRef={getChartRef('efficiency')} onContextMenu={(e) => handleChartContextMenu(e, 'efficiency')}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={efficiencyData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis type="number" fontSize={10} stroke="#94a3b8" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" fontSize={10} stroke="#94a3b8" width={55} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Bar dataKey={isRu ? 'Эффективность' : 'Efficiency'} fill="#10b981" radius={[0, 4, 4, 0]} barSize={8} />
              <Bar dataKey={isRu ? 'Занятость' : 'Occupancy'} fill="#6366f1" radius={[0, 4, 4, 0]} barSize={8} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Pie chart */}
        <ChartCard title={isRu ? 'Распределение загрузки' : 'Occupancy Distribution'} chartRef={getChartRef('pie')} onContextMenu={(e) => handleChartContextMenu(e, 'pie')}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}
                fontSize={10}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={POST_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip contentStyle={customTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>}

      {/* Row 3: Plan vs Fact */}
      {elVis('planFactChart') && <ChartCard title={isRu ? 'План vs Факт по постам (часы)' : 'Plan vs Actual by Post (hours)'} chartRef={getChartRef('plan-fact')} onContextMenu={(e) => handleChartContextMenu(e, 'plan-fact')}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={planFactData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
            <XAxis dataKey="name" fontSize={10} stroke="#94a3b8" />
            <YAxis fontSize={10} stroke="#94a3b8" />
            <Tooltip contentStyle={customTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey={isRu ? 'План (ч)' : 'Plan (h)'} fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey={isRu ? 'Факт (ч)' : 'Actual (h)'} fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>}

      {/* Comparison table */}
      {elVis('comparisonTable') && <ChartCard title={isRu ? 'Сравнительная таблица постов' : 'Post Comparison Table'}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <th className="text-left px-3 py-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Пост' : 'Post'}</th>
                <th className="text-center px-3 py-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Занятость' : 'Occup.'}</th>
                <th className="text-center px-3 py-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Эффект.' : 'Effic.'}</th>
                <th className="text-center px-3 py-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Авто' : 'Cars'}</th>
                <th className="text-center px-3 py-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Авто/день' : 'Cars/day'}</th>
                <th className="text-center px-3 py-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Ср.время' : 'Avg time'}</th>
                <th className="text-center px-3 py-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Ожидание' : 'Wait'}</th>
                <th className="text-center px-3 py-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Работник' : 'Worker'}</th>
                <th className="text-center px-3 py-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Актив.ч' : 'Active h'}</th>
                <th className="text-center px-3 py-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Простой.ч' : 'Idle h'}</th>
                <th className="text-center px-3 py-2" style={{ color: 'var(--text-muted)' }}>{isRu ? 'No-show' : 'No-show'}</th>
              </tr>
            </thead>
            <tbody>
              {postSummaries.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-glass)' }}
                  className="cursor-pointer hover:opacity-80" onClick={() => setSelectedPost(p.id)}>
                  <td className="px-3 py-2 font-medium" style={{ color: p.color }}>{p.name}</td>
                  <td className="px-3 py-2 text-center" style={{ color: p.avgOccupancy >= 70 ? '#6366f1' : '#f59e0b' }}>{p.avgOccupancy}%</td>
                  <td className="px-3 py-2 text-center" style={{ color: p.avgEfficiency >= 70 ? '#10b981' : '#ef4444' }}>{p.avgEfficiency}%</td>
                  <td className="px-3 py-2 text-center" style={{ color: 'var(--text-primary)' }}>{p.totalVehicles}</td>
                  <td className="px-3 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{p.avgVehiclesPerDay}</td>
                  <td className="px-3 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{p.avgTimePerVehicle}{isRu ? 'м' : 'm'}</td>
                  <td className="px-3 py-2 text-center" style={{ color: p.avgWaitTime > 30 ? '#ef4444' : 'var(--text-secondary)' }}>{p.avgWaitTime}{isRu ? 'м' : 'm'}</td>
                  <td className="px-3 py-2 text-center" style={{ color: p.avgWorkerPresence >= 80 ? '#10b981' : '#f59e0b' }}>{p.avgWorkerPresence}%</td>
                  <td className="px-3 py-2 text-center" style={{ color: '#10b981' }}>{p.totalActiveH}</td>
                  <td className="px-3 py-2 text-center" style={{ color: '#ef4444' }}>{p.totalIdleH}</td>
                  <td className="px-3 py-2 text-center" style={{ color: p.totalNoShows > 0 ? '#ef4444' : 'var(--text-muted)' }}>{p.totalNoShows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>}

      {/* Heatmap */}
      {elVis('heatmaps') && heatmapData.length > 0 && (
        <ChartCard title={t('analytics.heatmapTitle')}>
          <div>
            <table className="w-full text-xs table-fixed">
              <thead>
                <tr>
                  <th className="text-left px-1 py-1" style={{ color: 'var(--text-muted)', width: '7%' }}>{isRu ? 'Пост' : 'Post'}</th>
                  {Array.from({ length: 12 }, (_, i) => i + 8).map(h => (
                    <th key={h} className="text-center px-0 py-1" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{h}:00</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.map(post => (
                  <tr key={post.id}>
                    <td className="px-1 py-0.5 font-medium truncate" style={{ color: post.color, fontSize: 10 }}>{post.name}</td>
                    {post.hours.map((h, hi) => {
                      const pct = h.occupancy;
                      const bg = pct >= 80 ? 'rgba(239,68,68,0.6)'
                        : pct >= 60 ? 'rgba(239,68,68,0.35)'
                        : pct >= 40 ? 'rgba(234,179,8,0.4)'
                        : pct >= 20 ? 'rgba(34,197,94,0.3)'
                        : 'rgba(34,197,94,0.1)';
                      return (
                        <td key={hi} className="text-center px-0 py-0.5 relative group">
                          <div className="rounded" style={{ background: bg, padding: '2px 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: 9 }}>
                            {pct}%
                          </div>
                          <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap"
                            style={{ background: 'rgba(15,23,42,0.95)', color: '#f1f5f9', fontSize: 10, border: '1px solid rgba(148,163,184,0.2)' }}>
                            <div className="font-bold">{post.name} — {h.hour}:00</div>
                            <div>{t('analytics.heatmapOccupancy')}: {pct}%</div>
                            <div>{t('analytics.heatmapVehicles')}: {h.vehicles}</div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{isRu ? 'Шкала:' : 'Scale:'}</span>
            {[
              { bg: 'rgba(34,197,94,0.1)', label: '0-20%' },
              { bg: 'rgba(34,197,94,0.3)', label: '20-40%' },
              { bg: 'rgba(234,179,8,0.4)', label: '40-60%' },
              { bg: 'rgba(239,68,68,0.35)', label: '60-80%' },
              { bg: 'rgba(239,68,68,0.6)', label: '80-100%' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="w-4 h-3 rounded" style={{ background: s.bg }} />
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Weekly Heatmap */}
      {elVis('heatmaps') && weeklyHeatmapData.length > 0 && (
        <ChartCard title={t('analytics.weeklyHeatmapTitle')}>
          <WeeklyHeatmap data={weeklyHeatmapData} isRu={isRu} />
        </ChartCard>
      )}

      {/* Selected post detail */}
      {elVis('postDetail') && selPost && selSummary && (
        <ChartCard title={`${selSummary.name} — ${isRu ? 'детализация' : 'details'}`}>
          <div className="flex justify-end mb-2">
            <button onClick={() => setSelectedPost(null)} className="text-xs px-3 py-1 rounded-lg"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border-glass)' }}>✕</button>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
            <StatCard label={isRu ? 'Занятость' : 'Occupancy'} value={`${selSummary.avgOccupancy}%`} color="#6366f1" />
            <StatCard label={isRu ? 'Эффективн.' : 'Efficiency'} value={`${selSummary.avgEfficiency}%`} color="#10b981" />
            <StatCard label={isRu ? 'Авто' : 'Vehicles'} value={selSummary.totalVehicles} color="#3b82f6" />
            <StatCard label={isRu ? 'Ср.время' : 'Avg time'} value={`${selSummary.avgTimePerVehicle}${isRu ? 'м' : 'm'}`} color="#f59e0b" />
            <StatCard label={isRu ? 'Ожидание' : 'Wait'} value={`${selSummary.avgWaitTime}${isRu ? 'м' : 'm'}`} color="#a855f7" />
            <StatCard label={isRu ? 'Работник' : 'Worker'} value={`${selSummary.avgWorkerPresence}%`} color="#14b8a6" />
          </div>

          {/* Daily occupancy + efficiency */}
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={selPost.days.map(d => ({
              date: d.date.slice(5),
              [isRu ? 'Занятость' : 'Occupancy']: +(d.occupancyRate * 100).toFixed(1),
              [isRu ? 'Эффективность' : 'Efficiency']: +(d.efficiency * 100).toFixed(1),
              [isRu ? 'Работник' : 'Worker']: +(d.workerPresence * 100).toFixed(1),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="date" fontSize={10} stroke="#94a3b8" />
              <YAxis fontSize={10} stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey={isRu ? 'Занятость' : 'Occupancy'} stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={isRu ? 'Эффективность' : 'Efficiency'} stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={isRu ? 'Работник' : 'Worker'} stroke="#a855f7" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
