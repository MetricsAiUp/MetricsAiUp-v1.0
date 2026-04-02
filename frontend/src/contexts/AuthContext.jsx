import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const BASE = import.meta.env.BASE_URL || './';
const fetchJson = async (path) => {
  const res = await fetch(`${BASE}data/${path}.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

function getBackendUrl() {
  if (typeof window === 'undefined') return 'http://localhost:3002';
  const loc = window.location;
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') return `http://${loc.hostname}:3002`;
  const base = loc.href.split('/preview/')[0];
  return base ? `${base}/preview/3002` : `http://${loc.hostname}:3002`;
}

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

const api = {
  get: async (url) => {
    let clean = url.replace(/^\/api\//, '');
    const qIdx = clean.indexOf('?');
    let suffix = '';
    if (qIdx !== -1) {
      const params = new URLSearchParams(clean.slice(qIdx));
      clean = clean.slice(0, qIdx);
      if (params.get('status') === 'completed') suffix = '-completed';
      if (params.get('period')) suffix = `-${params.get('period')}`;
    }
    clean = clean.replace(/\//g, '-') + suffix;
    const data = await fetchJson(clean);
    return { data };
  },
  post: async (url, body) => {
    if (url.includes('auth/login')) {
      const data = await fetchJson('auth-login');
      return { data };
    }
    try {
      const res = await fetch(`http://${window.location.hostname}:3001${url}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return { data: await res.json() };
    } catch { return { data: {} }; }
  },
  put: async (url, body) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3001${url}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return { data: await res.json() };
    } catch { return { data: {} }; }
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

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
    // Load users from JSON (source of truth), localStorage adds new users only
    let jsonUsers = [];
    try {
      const usersData = await fetchJson('users');
      jsonUsers = usersData.users || [];
    } catch { /* json unavailable */ }

    // localStorage may contain users created via UI (not in JSON)
    let lsUsers = [];
    const saved = localStorage.getItem('usersData');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.users?.length > 0) lsUsers = parsed.users;
      } catch { /* ignore */ }
    }

    // localStorage has priority (user edits), JSON is fallback for unedited users
    const userMap = {};
    jsonUsers.forEach(u => { userMap[u.email.toLowerCase()] = u; }); // JSON base
    lsUsers.forEach(u => { userMap[u.email.toLowerCase()] = u; }); // localStorage overwrites
    const users = Object.values(userMap);
    if (users.length === 0) throw new Error('Cannot load users');

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
