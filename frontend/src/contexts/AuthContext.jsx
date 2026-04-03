import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AuthContext = createContext();

const BASE = import.meta.env.BASE_URL || './';

// Fallback: load static JSON mock
const fetchJson = async (path) => {
  const res = await fetch(`${BASE}data/${path}.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
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
  'data-1c': ['view_work_orders'],
  'users': ['manage_users'],
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

  // Try to refresh access token via refresh cookie
  const tryRefresh = async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        onTokenRefreshed?.(data.token);
        return data.token;
      }
    } catch { /* refresh failed */ }
    onAuthFailed?.();
    return null;
  };

  const request = async (method, url, body, retry = true) => {
    const opts = { method, headers: headers(), credentials: 'include' };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`/api/${url.replace(/^\/api\//, '')}`, opts);
    // Auto-refresh on 401
    if (res.status === 401 && retry) {
      const newToken = await tryRefresh();
      if (newToken) {
        const retryOpts = { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${newToken}` } };
        const retryRes = await fetch(`/api/${url.replace(/^\/api\//, '')}`, retryOpts);
        if (retryRes.ok) return { data: await retryRes.json() };
        if (retryRes.status === 401) { onAuthFailed?.(); throw new Error('Unauthorized'); }
      }
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
        if (err.message === 'Unauthorized' || err.message === 'Forbidden') throw err;
        // Network error or backend down — fallback to mock
        const mockPath = urlToMockPath(url);
        const data = await fetchJson(mockPath);
        return { data };
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
  manager: ['dashboard', 'dashboard-posts', 'posts-detail', 'map', 'sessions', 'work-orders', 'events', 'analytics', 'data-1c'],
  director: ['dashboard', 'dashboard-posts', 'posts-detail', 'map', 'sessions', 'work-orders', 'events', 'analytics', 'cameras'],
  mechanic: ['dashboard', 'dashboard-posts', 'map'],
  viewer: ['dashboard', 'posts-detail', 'map'],
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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

  // On mount: try to restore session via /api/auth/me or savedUser
  useEffect(() => {
    const restore = async () => {
      if (tokenRef.current) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${tokenRef.current}` },
          });
          if (res.ok) {
            const me = await res.json();
            const role = me.role || me.roles?.[0] || 'viewer';
            const userData = {
              id: me.id, email: me.email, firstName: me.firstName, lastName: me.lastName,
              role, roles: me.roles || [role],
              pages: me.pages || ROLE_DEFAULT_PAGES[role] || ['dashboard'],
              permissions: me.permissions || [],
            };
            localStorage.setItem('currentUser', JSON.stringify(userData));
            setUser(userData);
            setLoading(false);
            return;
          }
          // Token expired — try refresh
          const refreshRes = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            setToken(data.token);
            // Retry /me
            const meRetry = await fetch('/api/auth/me', {
              headers: { Authorization: `Bearer ${data.token}` },
            });
            if (meRetry.ok) {
              const me = await meRetry.json();
              const role = me.role || me.roles?.[0] || 'viewer';
              const userData = {
                id: me.id, email: me.email, firstName: me.firstName, lastName: me.lastName,
                role, roles: me.roles || [role],
                pages: me.pages || ROLE_DEFAULT_PAGES[role] || ['dashboard'],
                permissions: me.permissions || [],
              };
              localStorage.setItem('currentUser', JSON.stringify(userData));
              setUser(userData);
              setLoading(false);
              return;
            }
          }
        } catch { /* backend down — use cached */ }
        // Fallback: use saved user from localStorage
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
          try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ }
        }
      }
      setLoading(false);
    };
    restore();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        const meRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        let role = 'viewer', pages = [], permissions = [];
        if (meRes.ok) {
          const me = await meRes.json();
          role = me.role || me.roles?.[0] || 'viewer';
          permissions = me.permissions || [];
          pages = me.pages || ROLE_DEFAULT_PAGES[role] || ['dashboard'];
        }
        const userData = {
          id: data.user.id, email: data.user.email,
          firstName: data.user.firstName, lastName: data.user.lastName,
          role, roles: [role], pages, permissions,
        };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        setUser(userData);
        return userData;
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    } catch (fetchErr) {
      if (fetchErr.message === 'Failed to fetch' || fetchErr.message === 'NetworkError') {
        return mockLogin(email, password);
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
      roles: [found.role], role: found.role, pages: found.pages, permissions,
    };
    const fakeToken = btoa(JSON.stringify({ userId: found.id, ts: Date.now() }));
    localStorage.setItem('token', fakeToken);
    localStorage.setItem('currentUser', JSON.stringify(userData));
    setToken(fakeToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    // Clear refresh cookie on server
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.removeItem('currentUser');
    setToken(null);
    setUser(null);
  };

  const hasPermission = (key) => user?.permissions?.includes(key) || false;

  const updateCurrentUser = (updatedUser) => {
    const permissions = buildPermissions(updatedUser.pages, updatedUser.role);
    const userData = {
      ...user,
      pages: updatedUser.pages,
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
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, updateCurrentUser, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
