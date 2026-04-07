import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Map, Car, ClipboardList, ScrollText,
  BarChart3, Camera, Focus, Database, CalendarClock, Columns,
  ChevronDown, Users, PenTool, MapPin, Clock, Shield,
} from 'lucide-react';


const navItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', pageId: 'dashboard' },
  { path: '/dashboard-posts', icon: CalendarClock, labelKey: 'nav.dashboardPosts', pageId: 'dashboard-posts' },
  { path: '/posts-detail', icon: Columns, labelKey: 'nav.postsDetail', pageId: 'posts-detail', hasSub: true },
  { path: '/map', icon: Map, labelKey: 'nav.map', pageId: 'map' },
  { path: '/sessions', icon: Car, labelKey: 'nav.sessions', pageId: 'sessions' },
  { path: '/work-orders', icon: ClipboardList, labelKey: 'nav.workOrders', pageId: 'work-orders' },
  { path: '/shifts', icon: Clock, labelKey: 'nav.shifts', pageId: 'shifts' },
  { path: '/events', icon: ScrollText, labelKey: 'nav.events', pageId: 'events' },
  { path: '/analytics', icon: BarChart3, labelKey: 'nav.analytics', pageId: 'analytics' },
  { path: '/cameras', icon: Camera, labelKey: 'nav.cameras', pageId: 'cameras' },
  { path: '/camera-mapping', icon: Focus, labelKey: 'nav.cameraMapping', pageId: 'camera-mapping' },
  { path: '/data-1c', icon: Database, labelKey: 'nav.data1c', pageId: 'data-1c' },
  { path: '/users', icon: Users, labelKey: 'nav.users', pageId: 'users' },
  { path: '/map-view', icon: MapPin, labelKey: 'nav.mapView2', pageId: 'map-view' },
  { path: '/map-editor', icon: PenTool, labelKey: 'nav.mapEditor', pageId: 'map-editor' },
  { path: '/audit', icon: Shield, labelKey: 'nav.audit', pageId: 'audit' },
];

export default function Sidebar() {
  const { t } = useTranslation();
  const { user, hasPermission, api } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [postsOpen, setPostsOpen] = useState(false);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    api.get('/api/posts-analytics')
      .then(({ data: d }) => setPosts(d.posts || []))
      .catch(() => {});
  }, []);

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
                    {posts.map(post => {
                      const isSelected = location.search.includes(post.id);
                      return (
                        <button
                          key={post.id}
                          onClick={() => navigate(`/posts-detail?post=${post.id}`)}
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
                            style={{ background: post.today?.loadPercent > 0 ? 'var(--success)' : 'var(--text-muted)' }}
                          />
                          <span className="truncate">{(() => { const num = post.name?.match(/\d+/)?.[0]; return num ? t(`posts.post${num}`) : post.name; })()}</span>
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
