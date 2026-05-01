// Centralized localStorage service with typed keys and TTL support

const KEYS = {
  TOKEN: 'token',
  CURRENT_USER: 'currentUser',
  LANGUAGE: 'language',
  THEME: 'theme',
  CAMERA_MAPPING: 'cameraMappingData',
  DASHBOARD_POSTS_SETTINGS: 'dashboardPostsSettings',
  IMPORTED_PLANNING: '1c-imported-planning',
  IMPORTED_WORKERS: '1c-imported-workers',
};

function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getString(key, fallback = '') {
  return localStorage.getItem(key) || fallback;
}

function set(key, value) {
  if (value === null || value === undefined) {
    localStorage.removeItem(key);
  } else if (typeof value === 'string') {
    localStorage.setItem(key, value);
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

function remove(key) {
  localStorage.removeItem(key);
}

// Clear all app data (on logout or reset)
function clearAll() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

export const storage = { KEYS, get, getString, set, remove, clearAll };
