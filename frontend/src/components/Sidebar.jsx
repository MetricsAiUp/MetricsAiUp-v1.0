import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Map, Car, ClipboardList, ScrollText,
  BarChart3, Camera, Database, CalendarClock, Columns,
  ChevronDown, Users, PenTool, MapPin, Clock, Shield, Wrench, Activity,
  FileSpreadsheet, BookOpen, Bug,
} from 'lucide-react';
import { POST_STATUS_COLORS } from '../constants';


const navItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', pageId: 'dashboard' },
  { path: '/dashboard-posts', icon: CalendarClock, labelKey: 'nav.dashboardPosts', pageId: 'dashboard-posts' },
  { path: '/posts-detail', icon: Columns, labelKey: 'nav.postsAndZones', pageId: 'posts-detail', hasSub: true },
  { path: '/sessions', icon: Car, labelKey: 'nav.sessions', pageId: 'sessions' },
  { path: '/work-orders', icon: ClipboardList, labelKey: 'nav.workOrders', pageId: 'work-orders' },
  { path: '/shifts', icon: Clock, labelKey: 'nav.shifts', pageId: 'shifts' },
  { path: '/events', icon: ScrollText, labelKey: 'nav.events', pageId: 'events' },
  { path: '/analytics', icon: BarChart3, labelKey: 'nav.analytics', pageId: 'analytics' },
  { path: '/cameras', icon: Camera, labelKey: 'nav.cameras', pageId: 'cameras' },
  { path: '/data-1c', icon: Database, labelKey: 'nav.data1c', pageId: 'data-1c' },
  { path: '/users', icon: Users, labelKey: 'nav.users', pageId: 'users' },
  { path: '/map-view', icon: MapPin, labelKey: 'nav.mapView2', pageId: 'map-view' },
  { path: '/map-editor', icon: PenTool, labelKey: 'nav.mapEditor', pageId: 'map-editor' },
  { path: '/audit', icon: Shield, labelKey: 'nav.audit', pageId: 'audit' },
  { path: '/health', icon: Activity, labelKey: 'nav.health', pageId: 'health' },
  { path: '/my-post', icon: Wrench, labelKey: 'nav.myPost', pageId: 'my-post' },
  { path: '/report-schedule', icon: FileSpreadsheet, labelKey: 'nav.reportSchedule', pageId: 'report-schedule' },
  { path: '/tech-docs', icon: BookOpen, labelKey: 'nav.techDocs', pageId: 'tech-docs' },
];

const ZONE_ITEMS = [
  { id: 'zone-1', number: 1 },
  { id: 'zone-2', number: 2 },
  { id: 'zone-3', number: 3 },
  { id: 'zone-4', number: 4 },
  { id: 'zone-5', number: 5 },
  { id: 'zone-6', number: 6 },
  { id: 'zone-7', number: 7 },
];

export default function Sidebar() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { user, hasPermission, api, appMode } = useAuth();
  const isLive = appMode === 'live';
  const navigate = useNavigate();
  const location = useLocation();
  const [postsOpen, setPostsOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [liveData, setLiveData] = useState(null);

  useEffect(() => {
    api.get('/api/posts-analytics')
      .then(({ data: d }) => setPosts(d.posts || []))
      .catch(() => {});
  }, [appMode]);

  // Fetch zone statuses — live mode from monitoring, demo from DB
  useEffect(() => {
    const fetchZones = () => {
      if (isLive) {
        api.get('/api/dashboard/live').then(r => setLiveData(r.data)).catch(() => {});
      } else {
        api.get('/api/zones').then(r => {
          // Transform DB zones to liveData-like format for unified rendering
          const zones = (r.data || []);
          const freeZones = ZONE_ITEMS.map(zi => {
            const dbZone = zones.find(z => {
              const n = parseInt(z.name?.match(/\d+/)?.[0], 10);
              return n === zi.number;
            });
            return {
              id: zi.id,
              name: isRu ? `Зона ${String(zi.number).padStart(2, '0')}` : `Zone ${String(zi.number).padStart(2, '0')}`,
              status: dbZone && (dbZone._count?.stays > 0) ? 'occupied' : 'free',
            };
          });
          setLiveData(prev => ({ ...prev, freeZones }));
        }).catch(() => {});
      }
    };
    fetchZones();
    const id = setInterval(fetchZones, 10000);
    return () => clearInterval(id);
  }, [isLive]);

  const isPostsActive = location.pathname === '/posts-detail';

  return (
    <aside
      className="glass-static min-h-screen p-3 flex flex-col flex-shrink-0"
      style={{ width: 160, minWidth: 160, maxWidth: 160, borderRadius: 0, borderRight: '1px solid var(--border-glass)' }}
    >
      {/* Logo */}
      <div className="mb-5 px-1">
        <h1 className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
          {t('app.title')}
        </h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.2 }}>
          {t('app.subtitle')}
        </p>
      </div>

      {/* Live Debug — only in live mode */}
      {isLive && (
        <div className="mb-2">
          <NavLink
            to="/live-debug"
            className={({ isActive }) =>
              `flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                isActive ? 'font-medium' : 'hover:opacity-80'
              }`
            }
            style={({ isActive }) => ({
              color: isActive ? '#ef4444' : '#ef4444',
              background: isActive ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.05)',
              fontSize: '11px',
              border: '1px solid rgba(239,68,68,0.2)',
            })}
          >
            <Bug size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span className="truncate">{t('nav.liveDebug')}</span>
          </NavLink>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon;

          if (!user?.pages?.includes(item.pageId) && user?.role !== 'admin') return null;

          // Posts with submenu
          if (item.hasSub) {
            return (
              <div key={item.path}>
                <div
                  className="flex items-center rounded-lg transition-all whitespace-nowrap"
                  style={{
                    background: isPostsActive ? 'var(--accent-light)' : 'transparent',
                  }}
                >
                  <button
                    onClick={() => navigate('/posts-detail')}
                    className="flex-1 flex items-center gap-2 px-2 py-1.5 hover:opacity-80 transition-opacity"
                    style={{
                      color: isPostsActive ? 'var(--accent)' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: isPostsActive ? 500 : 400,
                    }}
                  >
                    <Icon size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
                    <span className="truncate text-left">{t(item.labelKey)}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPostsOpen(!postsOpen); }}
                    className="px-1.5 py-1.5 rounded-md hover:opacity-70 transition-opacity"
                    style={{ color: isPostsActive ? 'var(--accent)' : 'var(--text-muted)' }}
                  >
                    <ChevronDown size={14} strokeWidth={2.5} style={{ transform: postsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                </div>
                {postsOpen && (
                  <div className="ml-3 mt-0.5 space-y-0 border-l" style={{ borderColor: 'var(--border-glass)' }}>
                    {/* Posts */}
                    {posts.map(post => {
                      const isSelected = location.search.includes(post.id);
                      // In live mode, get status from monitoring data
                      const postNum = post.number ?? parseInt(post.name?.match(/\d+/)?.[0], 10);
                      const livePost = isLive && liveData?.posts?.find(p => {
                        const n = p.number ?? parseInt(p.name?.match(/\d+/)?.[0], 10);
                        return n === postNum;
                      });
                      const status = livePost?.status ?? post.status;
                      const isNoData = status === 'no_data';
                      // Единая палитра карты СТО (POST_STATUS_COLORS):
                      // free=зелёный, occupied=оранжевый, active_work=индиго,
                      // occupied_no_work=красный, no_data=пунктир.
                      // В demo-режиме fallback на "был ли сегодня загружен" (loadPercent > 0).
                      const fallbackOccupied = !livePost && (post.today?.loadPercent > 0);
                      const dotColor = isNoData
                        ? null
                        : (POST_STATUS_COLORS[status]
                          || (fallbackOccupied ? POST_STATUS_COLORS.occupied : POST_STATUS_COLORS.free));
                      const noDataTitle = isRu
                        ? 'Нет данных от CV-системы. Пост существует в БД и на карте, но не репортится.'
                        : 'No data from CV system. Post exists in DB and map but is not reported.';
                      return (
                        <button
                          key={post.id}
                          onClick={() => navigate(`/posts-detail?post=${post.id}`)}
                          title={isNoData ? noDataTitle : undefined}
                          className="w-full text-left pl-3 py-1 rounded-r-lg transition-all flex items-center gap-1.5"
                          style={{
                            color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                            background: isSelected ? 'var(--accent-light)' : 'transparent',
                            fontSize: '10px',
                            fontWeight: isSelected ? 600 : 400,
                            opacity: isNoData ? 0.55 : 1,
                            fontStyle: isNoData ? 'italic' : 'normal',
                          }}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={isNoData
                              ? { background: 'transparent', border: '1px dashed var(--text-muted)' }
                              : { background: dotColor }
                            }
                          />
                          <span className="truncate">{(() => {
                            // Кастомное displayName (отличается от стандартного "Пост N" / "Post N") — приоритет
                            const isDefaultName = (s) => !s || /^(Пост|Post)\s*0?\d+$/i.test(s.trim());
                            const dn = isRu ? post.displayName : (post.displayNameEn || post.displayName);
                            if (dn && !isDefaultName(dn)) return dn;
                            // Иначе — i18n-ключ по post.number
                            const num = post.number ?? parseInt(post.name?.match(/\d+/)?.[0] || '0', 10);
                            if (num > 0) return t(`posts.post${num}`);
                            return post.name;
                          })()}</span>
                        </button>
                      );
                    })}
                    {/* Separator */}
                    <div className="my-1 mx-2 border-t" style={{ borderColor: 'var(--border-glass)' }} />
                    {/* Zones — палитра как на карте СТО:
                        free=зелёный, occupied (Занята)=оранжевый,
                        worksInProgress (Работы)=индиго (active_work). */}
                    {ZONE_ITEMS.map(zone => {
                      const isSelected = location.search.includes(zone.id);
                      const liveZone = liveData?.freeZones?.find(z => {
                        const n = parseInt(z.name?.match(/\d+/)?.[0], 10);
                        return n === zone.number;
                      });
                      const isOccupied = liveZone ? liveZone.status === 'occupied' : false;
                      const hasWork = !!liveZone?.worksInProgress;
                      const zoneDotColor = !isOccupied
                        ? POST_STATUS_COLORS.free
                        : hasWork ? POST_STATUS_COLORS.active_work : POST_STATUS_COLORS.occupied;
                      return (
                        <button
                          key={zone.id}
                          onClick={() => navigate(`/posts-detail?zone=${zone.id}`)}
                          className="w-full text-left pl-3 py-1 rounded-r-lg transition-all flex items-center gap-1.5"
                          style={{
                            color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                            background: isSelected ? 'var(--accent-light)' : 'transparent',
                            fontSize: '10px',
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: zoneDotColor }}
                          />
                          <span className="truncate">{isRu ? `Зона ${String(zone.number).padStart(2, '0')}` : `Zone ${String(zone.number).padStart(2, '0')}`}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Regular nav item
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  isActive ? 'font-medium' : 'hover:opacity-80'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-light)' : 'transparent',
                fontSize: '11px',
              })}
            >
              <Icon size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span className="truncate">{t(item.labelKey)}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
