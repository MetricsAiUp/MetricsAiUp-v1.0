import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

// Static JSON API — Nginx serves api/*.json files relative to base
const BASE = import.meta.env.BASE_URL || './';
const fetchJson = async (path) => {
  const res = await fetch(`${BASE}api/${path}.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

// Wrapper to mimic axios-like API for components
const api = {
  get: async (url) => {
    // Transform /api/zones → zones, /api/sessions?status=completed → sessions-completed
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
    // For login — read pre-generated token
    if (url.includes('auth/login')) {
      const data = await fetchJson('auth-login');
      return { data };
    }
    // For other POSTs — send to backend on 3001 as fallback
    try {
      const res = await fetch(`http://${window.location.hostname}:3001${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { data: await res.json() };
    } catch {
      return { data: {} };
    }
  },
  put: async (url, body) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3001${url}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { data: await res.json() };
    } catch {
      return { data: {} };
    }
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchJson('auth-me')
        .then(data => setUser(data))
        .catch(() => { logout(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const data = await fetchJson('auth-login');
    const { token: newToken, user: userData } = data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const hasPermission = (key) => {
    return user?.permissions?.includes(key) || false;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasPermission, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
