import { createContext, useContext, useState, useEffect } from 'react';

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

function createApi(getToken) {
  const headers = (extra = {}) => {
    const h = { 'Content-Type': 'application/json', ...extra };
    const t = getToken();
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  };

  return {
    get: async (url) => {
      try {
        const res = await fetch(`/api/${url.replace(/^\/api\//, '')}`, { headers: headers() });
        if (res.ok) {
          const data = await res.json();
          return { data };
        }
        // Auth error — don't fallback, propagate
        if (res.status === 401 || res.status === 403) {
          throw new Error(res.status === 401 ? 'Unauthorized' : 'Forbidden');
        }
      } catch (err) {
        if (err.message === 'Unauthorized' || err.message === 'Forbidden') throw err;
        // Network error or backend down — fallback to mock
      }
      // Fallback to static JSON
      const mockPath = urlToMockPath(url);
      const data = await fetchJson(mockPath);
      return { data };
    },

    post: async (url, body) => {
      const res = await fetch(`/api/${url.replace(/^\/api\//, '')}`, {
        method: 'POST', headers: headers(), body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || err.message || res.statusText);
      }
      return { data: await res.json() };
    },

    put: async (url, body) => {
      const res = await fetch(`/api/${url.replace(/^\/api\//, '')}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || err.message || res.statusText);
      }
      return { data: await res.json() };
    },

    delete: async (url) => {
      const res = await fetch(`/api/${url.replace(/^\/api\//, '')}`, {
        method: 'DELETE', headers: headers(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || err.message || res.statusText);
      }
      return { data: await res.json() };
    },
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
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const api = createApi(() => token);

  useEffect(() => {
    if (token) {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        try { setUser(JSON.parse(savedUser)); } catch { logout(); }
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // Try real backend first
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        const realToken = data.token;
        // Fetch full user profile with permissions
        const meRes = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${realToken}` },
        });
        let role = 'viewer', pages = [], permissions = [];
        if (meRes.ok) {
          const me = await meRes.json();
          role = me.roles?.[0] || 'viewer';
          permissions = me.permissions || [];
          pages = me.pages || ROLE_DEFAULT_PAGES[role] || ['dashboard'];
        }
        const userData = {
          id: data.user.id, email: data.user.email,
          firstName: data.user.firstName, lastName: data.user.lastName,
          role, roles: [role], pages, permissions,
        };
        localStorage.setItem('token', realToken);
        localStorage.setItem('currentUser', JSON.stringify(userData));
        setToken(realToken);
        setUser(userData);
        return userData;
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    } catch (fetchErr) {
      // If network error (backend down), fallback to mock login
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
    localStorage.removeItem('token');
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
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasPermission, updateCurrentUser, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
