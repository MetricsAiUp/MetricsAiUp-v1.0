import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../hooks/useSocket';

const AuthContext = createContext();

const BASE = import.meta.env.BASE_URL || './';

// API on same origin (Express serves both frontend and API)
const API_BASE = '';

// Fallback: load static JSON mock
const fetchJson = async (path) => {
  const res = await fetch(`${BASE}data/${path}.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

// Registry of major page elements (widgets/sections) that can be hidden per user
const PAGE_ELEMENTS = {
  dashboard: [
    { id: 'statCards', label: { ru: 'KPI-карточки', en: 'KPI Cards' } },
    { id: 'liveWidget', label: { ru: 'Live СТО', en: 'Live STO' } },
    { id: 'predictionWidget', label: { ru: 'Прогнозы AI', en: 'AI Predictions' } },
    { id: 'recommendations', label: { ru: 'Рекомендации', en: 'Recommendations' } },
    { id: 'recentEvents', label: { ru: 'Последние события', en: 'Recent Events' } },
  ],
  'dashboard-posts': [
    { id: 'headerStats', label: { ru: 'Статистика смены', en: 'Shift Stats' } },
    { id: 'currentShift', label: { ru: 'Текущая смена', en: 'Current Shift' } },
    { id: 'ganttTimeline', label: { ru: 'Gantt-таймлайн', en: 'Gantt Timeline' } },
    { id: 'freeOrders', label: { ru: 'Свободные ЗН', en: 'Free Work Orders' } },
  ],
  'posts-detail': [
    { id: 'postsList', label: { ru: 'Список постов', en: 'Posts List' } },
    { id: 'detailPanel', label: { ru: 'Панель деталей', en: 'Detail Panel' } },
    { id: 'pd.timeline', label: { ru: 'Таймлайн', en: 'Timeline' } },
    { id: 'pd.summary', label: { ru: 'План/Факт/Загрузка', en: 'Plan/Fact/Load' } },
    { id: 'pd.workOrders', label: { ru: 'Заказ-наряды', en: 'Work Orders' } },
    { id: 'pd.workers', label: { ru: 'Исполнители', en: 'Workers' } },
    { id: 'pd.alerts', label: { ru: 'Предупреждения', en: 'Alerts' } },
    { id: 'pd.eventLog', label: { ru: 'Лог событий', en: 'Event Log' } },
    { id: 'pd.statistics', label: { ru: 'Статистика', en: 'Statistics' } },
    { id: 'pd.cameras', label: { ru: 'Камеры', en: 'Cameras' } },
    { id: 'pd.calendar', label: { ru: 'Календарь загрузки', en: 'Calendar Load' } },
  ],
  analytics: [
    { id: 'summaryStats', label: { ru: 'Сводные показатели', en: 'Summary Stats' } },
    { id: 'trendsCharts', label: { ru: 'Графики трендов', en: 'Trend Charts' } },
    { id: 'rankingCharts', label: { ru: 'Рейтинг и диаграммы', en: 'Ranking & Charts' } },
    { id: 'planFactChart', label: { ru: 'План vs Факт', en: 'Plan vs Actual' } },
    { id: 'comparisonTable', label: { ru: 'Сравнительная таблица', en: 'Comparison Table' } },
    { id: 'heatmaps', label: { ru: 'Тепловые карты', en: 'Heatmaps' } },
    { id: 'postDetail', label: { ru: 'Детализация поста', en: 'Post Detail' } },
  ],
};

const PAGE_PERMISSIONS = {
  'dashboard': ['view_dashboard'],
  'dashboard-posts': ['view_dashboard'],
  'posts-detail': ['view_dashboard', 'view_posts'],
  'map': ['view_zones'],
  'sessions': ['view_sessions'],
  'work-orders': ['view_work_orders'],
  'events': ['view_events'],
  'analytics': ['view_analytics'],
  'cameras': ['view_cameras'],
  'camera-mapping': ['manage_cameras'],
  'shifts': ['view_shifts', 'manage_shifts'],
  'data-1c': ['view_work_orders'],
  'users': ['manage_users'],
  'map-view': ['view_zones'],
  'map-editor': ['manage_zones'],
  'audit': ['manage_users'],
  'tech-docs': ['view_dashboard'],
};

function buildPermissions(pages, role) {
  const perms = new Set();
  (pages || []).forEach(pageId => {
    const pp = PAGE_PERMISSIONS[pageId];
    if (pp) pp.forEach(p => perms.add(p));
  });
  if (role === 'admin') {
    Object.values(PAGE_PERMISSIONS).flat().forEach(p => perms.add(p));
    ['manage_roles', 'manage_users', 'manage_settings', 'manage_cameras', 'manage_work_orders', 'manage_zones', 'view_recommendations'].forEach(p => perms.add(p));
  }
  return [...perms];
}

// Map URL to JSON mock filename for fallback
function urlToMockPath(url) {
  let clean = url.replace(/^\/api\//, '');
  const qIdx = clean.indexOf('?');
  let suffix = '';
  if (qIdx !== -1) {
    const params = new URLSearchParams(clean.slice(qIdx));
    clean = clean.slice(0, qIdx);
    if (params.get('status') === 'completed') suffix = '-completed';
    if (params.get('period')) suffix = `-${params.get('period')}`;
  }
  return clean.replace(/\//g, '-') + suffix;
}

function createApi(getToken, onTokenRefreshed, onAuthFailed) {
  const headers = (extra = {}) => {
    const h = { 'Content-Type': 'application/json', ...extra };
    const t = getToken();
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  };

  const request = async (method, url, body) => {
    const opts = { method, headers: headers(), credentials: 'include' };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}/api/${url.replace(/^\/api\//, '')}`, opts);
    if (res.status === 401) {
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || err.message || res.statusText);
    }
    return { data: await res.json() };
  };

  return {
    get: async (url) => {
      try {
        return await request('GET', url);
      } catch (err) {
        console.warn(`[API] GET ${url} failed:`, err.message);
        return { data: null };
      }
    },
    post: (url, body) => request('POST', url, body),
    put: (url, body) => request('PUT', url, body),
    delete: (url) => request('DELETE', url),
  };
}

// Default pages per role (used when backend doesn't return pages)
const ROLE_DEFAULT_PAGES = {
  admin: Object.keys(PAGE_PERMISSIONS),
  manager: ['dashboard', 'dashboard-posts', 'posts-detail', 'map', 'sessions', 'work-orders', 'shifts', 'events', 'analytics', 'data-1c'],
  director: ['dashboard', 'dashboard-posts', 'posts-detail', 'map', 'sessions', 'work-orders', 'shifts', 'events', 'analytics', 'cameras'],
  mechanic: ['dashboard', 'dashboard-posts', 'map'],
  viewer: ['dashboard', 'posts-detail', 'map'],
};

// Load user overrides (hiddenElements, pages) from localStorage usersData
function getUserOverrides(email) {
  try {
    const saved = localStorage.getItem('usersData');
    if (!saved) return {};
    const { users } = JSON.parse(saved);
    const found = users?.find(u => u.email?.toLowerCase() === email?.toLowerCase());
    if (!found) return {};
    const overrides = {};
    if (found.hiddenElements?.length) overrides.hiddenElements = found.hiddenElements;
    if (found.pages?.length) overrides.pages = found.pages;
    return overrides;
  } catch { return {}; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appMode, setAppMode] = useState(localStorage.getItem('appMode') || 'demo');
  const tokenRef = useRef(localStorage.getItem('token'));

  const setToken = useCallback((t) => {
    tokenRef.current = t;
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');
  }, []);

  const api = createApi(
    () => tokenRef.current,
    (newToken) => setToken(newToken), // onTokenRefreshed
    () => { setToken(null); setUser(null); localStorage.removeItem('currentUser'); }, // onAuthFailed
  );

  // On mount: restore session from localStorage (no API calls — avoids preview proxy issues)
  useEffect(() => {
    if (tokenRef.current) {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          const overrides = getUserOverrides(parsed.email);
          if (overrides.hiddenElements) parsed.hiddenElements = overrides.hiddenElements;
          if (overrides.pages) parsed.pages = overrides.pages;
          setUser(parsed);
        } catch { /* ignore */ }
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        const meRes = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        let role = 'viewer', pages = [], permissions = [];
        if (meRes.ok) {
          const me = await meRes.json();
          role = me.role || me.roles?.[0] || 'viewer';
          permissions = me.permissions || [];
          pages = me.pages || ROLE_DEFAULT_PAGES[role] || ['dashboard'];
        }
        const overrides = getUserOverrides(data.user.email);
        const userData = {
          id: data.user.id, email: data.user.email,
          firstName: data.user.firstName, lastName: data.user.lastName,
          role, roles: [role],
          pages: overrides.pages || pages,
          hiddenElements: overrides.hiddenElements || [],
          permissions,
        };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        setUser(userData);
        return userData;
      }
      // Backend returned error (401, 429, etc.) — show the real error, don't fallback to mock
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || `Login failed (${res.status})`);
    } catch (fetchErr) {
      // Network error (backend unreachable) — fallback to mock login
      if (fetchErr.name === 'TypeError' || fetchErr.message?.includes('fetch')) {
        try {
          return await mockLogin(email, password);
        } catch { /* mock also failed */ }
      }
      throw fetchErr;
    }
  };

  // Fallback mock login (when backend is down)
  const mockLogin = async (email, password) => {
    let users = [];
    const saved = localStorage.getItem('usersData');
    if (saved) {
      try { users = JSON.parse(saved).users || []; } catch { /* ignore */ }
    }
    if (!users.length) {
      try { users = (await fetchJson('users')).users || []; } catch { /* ignore */ }
    }
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!found) throw new Error('User not found');
    if (!found.isActive) throw new Error('User is disabled');
    if (found.password && found.password !== password) throw new Error('Wrong password');
    const permissions = buildPermissions(found.pages, found.role);
    const userData = {
      id: found.id, email: found.email, firstName: found.firstName, lastName: found.lastName,
      roles: [found.role], role: found.role, pages: found.pages, hiddenElements: found.hiddenElements || [], permissions,
    };
    const fakeToken = btoa(JSON.stringify({ userId: found.id, ts: Date.now() }));
    localStorage.setItem('token', fakeToken);
    localStorage.setItem('currentUser', JSON.stringify(userData));
    setToken(fakeToken);
    setUser(userData);
    return userData;
  };

  // Connect Socket.IO when user is authenticated
  useEffect(() => {
    if (user && tokenRef.current) {
      connectSocket(tokenRef.current);
      // Listen for mode changes from other clients
      const socket = getSocket();
      if (socket) {
        const handleModeChange = (settings) => {
          if (settings?.mode) {
            setAppMode(settings.mode);
            localStorage.setItem('appMode', settings.mode);
          }
        };
        socket.on('settings:changed', handleModeChange);
        return () => { socket.off('settings:changed', handleModeChange); };
      }
    }
    return () => { if (!user) disconnectSocket(); };
  }, [user]);

  const logout = () => {
    fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.removeItem('currentUser');
    disconnectSocket();
    setToken(null);
    setUser(null);
  };

  const hasPermission = (key) => user?.permissions?.includes(key) || false;

  const isElementVisible = (pageId, elementId) => {
    if (!user?.hiddenElements?.length) return true;
    return !user.hiddenElements.includes(`${pageId}.${elementId}`);
  };

  // Load app mode from backend on login
  useEffect(() => {
    if (user && tokenRef.current) {
      api.get('/api/settings').then(res => {
        if (res.data?.mode) {
          setAppMode(res.data.mode);
          localStorage.setItem('appMode', res.data.mode);
        }
      });
    }
  }, [user]);

  const toggleAppMode = async (newMode) => {
    try {
      await api.put('/api/settings', { mode: newMode });
      setAppMode(newMode);
      localStorage.setItem('appMode', newMode);
    } catch (err) {
      console.error('[AppMode] Failed to switch:', err.message);
    }
  };

  const updateCurrentUser = (updatedUser) => {
    const permissions = buildPermissions(updatedUser.pages, updatedUser.role);
    const userData = {
      ...user,
      pages: updatedUser.pages,
      hiddenElements: updatedUser.hiddenElements || [],
      role: updatedUser.role,
      roles: [updatedUser.role],
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      permissions,
    };
    localStorage.setItem('currentUser', JSON.stringify(userData));
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, isElementVisible, updateCurrentUser, api, appMode, toggleAppMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { PAGE_ELEMENTS };
