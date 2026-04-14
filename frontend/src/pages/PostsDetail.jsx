import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { X, User, AlertTriangle } from 'lucide-react';
import HelpButton from '../components/HelpButton';
import PostCardsView from '../components/postsDetail/PostCardsView';
import PostTableView from '../components/postsDetail/PostTableView';
import PostDetailPanel from '../components/postsDetail/PostDetailPanel';

const STATUS_COLORS = {
  completed: 'var(--success)',
  in_progress: 'var(--accent)',
  scheduled: 'var(--text-muted)',
};
const SEVERITY_COLORS = { warning: 'var(--warning)', danger: 'var(--danger)', info: 'var(--info)' };

function formatTime(t) {
  if (!t) return '—';
  return new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function ListModal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl p-5 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl"
        style={{ border: '1px solid var(--border-glass)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function PostsDetail() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api, isElementVisible, appMode } = useAuth();
  const isLive = appMode === 'live';
  const elVis = (id) => isElementVisible('posts-detail', id);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [modal, setModal] = useState(null);
  const [viewMode, setViewMode] = useState('cards');

  const selectedPostId = searchParams.get('post') || null;
  const selectedZoneId = searchParams.get('zone') || null;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (period === 'custom' && customFrom) params.set('from', customFrom);
    if (period === 'custom' && customTo) params.set('to', customTo);
    const qs = params.toString() ? `?${params}` : '';
    Promise.all([
      api.get(`/api/posts-analytics${qs}`),
      api.get('/api/dashboard-posts'),
    ])
      .then(([{ data: res }, { data: dash }]) => { setData(res); setDashData(dash); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  const selectedPost = useMemo(() => {
    if (!data?.posts) return null;
    if (selectedPostId) return data.posts.find(p => p.id === selectedPostId);
    if (selectedZoneId) return (data.zones || []).find(z => z.id === selectedZoneId);
    return null;
  }, [data, selectedPostId, selectedZoneId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        {t('common.loading')}
      </div>
    );
  }

  const posts = data?.posts || [];
  const zones = data?.zones || [];
  const allItems = [...posts, ...zones];

  return (
    <div className="p-4">
      <div>
        {selectedPost ? (
          elVis('detailPanel') && <PostDetailPanel
            selectedPost={selectedPost}
            dashData={dashData}
            period={period}
            setPeriod={setPeriod}
            showCustom={showCustom}
            setShowCustom={setShowCustom}
            customFrom={customFrom}
            setCustomFrom={setCustomFrom}
            customTo={customTo}
            setCustomTo={setCustomTo}
            navigate={navigate}
            setModal={setModal}
            isZone={selectedPost?.type === 'zone'}
          />
        ) : (
          elVis('postsList') && <div>
            {/* Header with period + view toggle */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>{t('postsDetail.title')} <HelpButton pageKey="postsDetail" /></h2>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Period selector */}
                <div className="flex items-center gap-1">
                  {[
                    { key: 'today', label: t('postsDetail.today') },
                    { key: 'yesterday', label: t('postsDetail.yesterday') },
                    { key: 'week', label: t('postsDetail.week') },
                    { key: 'month', label: t('postsDetail.month') },
                    { key: 'custom', label: isRu ? 'Период' : 'Custom' },
                  ].map(p => (
                    <button key={p.key}
                      onClick={() => { setPeriod(p.key); if (p.key === 'custom') setShowCustom(true); else setShowCustom(false); }}
                      className="px-2 py-1 rounded-lg text-xs transition-all"
                      style={{ background: period === p.key ? 'var(--accent)' : 'var(--bg-glass)', color: period === p.key ? '#fff' : 'var(--text-secondary)', border: `1px solid ${period === p.key ? 'var(--accent)' : 'var(--border-glass)'}` }}>
                      {p.label}
                    </button>
                  ))}
                  {showCustom && (
                    <div className="flex items-center gap-1 ml-1">
                      <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                        className="px-1.5 py-0.5 rounded-lg text-xs"
                        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                      <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                        className="px-1.5 py-0.5 rounded-lg text-xs"
                        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
                    </div>
                  )}
                </div>
                {/* View toggle */}
                <div className="flex gap-1" style={{ borderLeft: '1px solid var(--border-glass)', paddingLeft: 8 }}>
                  {[{ key: 'cards', label: isRu ? 'Плитки' : 'Cards' }, { key: 'table', label: isRu ? 'Таблица' : 'Table' }].map(v => (
                    <button key={v.key} onClick={() => setViewMode(v.key)}
                      className="px-3 py-1 rounded-lg text-xs transition-all"
                      style={{ background: viewMode === v.key ? 'var(--accent)' : 'var(--bg-glass)', color: viewMode === v.key ? '#fff' : 'var(--text-secondary)', border: `1px solid ${viewMode === v.key ? 'var(--accent)' : 'var(--border-glass)'}` }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {viewMode === 'cards' && <PostCardsView posts={allItems} navigate={navigate} />}
            {viewMode === 'table' && <PostTableView posts={allItems} navigate={navigate} />}
          </div>
        )}
      </div>

      {/* Modal for full lists */}
      {modal && (
        <ListModal
          title={t(`postsDetail.${modal.type === 'workOrders' ? 'allWorkOrders' : modal.type === 'workers' ? 'allWorkers' : modal.type === 'alerts' ? 'allAlerts' : 'allEvents'}`)}
          onClose={() => setModal(null)}
        >
          {modal.type === 'workOrders' && (
            <div className="space-y-2">
              {modal.data.map(wo => (
                <div key={wo.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[wo.status] }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium" style={{ color: 'var(--accent)' }}>{wo.orderNumber}</span>
                      <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{wo.plateNumber}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{wo.brand} {wo.model}</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{wo.workType}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{wo.normHours}ч / {wo.actualHours ?? '—'}ч</div>
                    {wo.planVsFact != null && <div className="text-xs font-medium" style={{ color: wo.planVsFact <= 100 ? 'var(--success)' : 'var(--danger)' }}>{wo.planVsFact}%</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {modal.type === 'workers' && (
            <div className="space-y-2">
              {modal.data.map(w => (
                <div key={w.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                  <User size={14} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{w.role}</span>
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-secondary)' }}>{w.hoursWorked}ч / {w.ordersCompleted} ЗН</span>
                </div>
              ))}
            </div>
          )}
          {modal.type === 'alerts' && (
            <div className="space-y-2">
              {modal.data.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-glass)', border: `1px solid ${SEVERITY_COLORS[a.severity]}` }}>
                  <AlertTriangle size={14} style={{ color: SEVERITY_COLORS[a.severity] }} />
                  <span className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>{a.message}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatTime(a.time)}</span>
                </div>
              ))}
            </div>
          )}
          {modal.type === 'events' && (
            <div className="space-y-1">
              {modal.data.map(ev => (
                <div key={ev.id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-glass)' }}>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{formatTime(ev.time)}</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ev.description}</span>
                </div>
              ))}
            </div>
          )}
        </ListModal>
      )}
    </div>
  );
}
