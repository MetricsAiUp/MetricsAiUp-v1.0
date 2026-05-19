// Зеркало /project/backend/src/config/rolePages.js.
// Содержимое ROLE_PAGES должно совпадать байт-в-байт (проверяется бэк-тестом).

export const ROLE_PAGES = {
  admin: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'sessions', 'work-orders',
    'shifts', 'events', 'analytics', 'cameras', 'data-1c', 'discrepancies',
    'users', 'map-view', 'map-editor', 'audit', 'health', 'my-post',
    'report-schedule', 'tech-docs', 'user-guide', 'live-debug', 'utilization',
  ],
  director: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'map-view', 'sessions',
    'work-orders', 'events', 'analytics', 'cameras', 'discrepancies', 'utilization',
    'user-guide',
  ],
  manager: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'map-view', 'sessions',
    'work-orders', 'shifts', 'analytics', 'events', 'data-1c', 'discrepancies', 'utilization',
    'user-guide',
  ],
  mechanic: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'map-view', 'sessions', 'my-post',
    'user-guide',
  ],
  viewer: [
    'dashboard', 'dashboard-posts', 'map-view', 'user-guide',
  ],
};

export function pagesForRole(role) {
  return ROLE_PAGES[role] || ROLE_PAGES.viewer;
}
