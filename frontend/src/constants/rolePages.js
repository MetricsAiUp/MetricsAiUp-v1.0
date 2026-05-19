// Зеркало /project/backend/src/config/rolePages.js.
// Содержимое ROLE_PAGES должно совпадать байт-в-байт (проверяется бэк-тестом).

export const ROLE_PAGES = {
  admin: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'sessions', 'work-orders',
    'shifts', 'events', 'analytics', 'cameras', 'data-1c', 'discrepancies',
    'users', 'map-view', 'map-editor', 'audit', 'health', 'my-post',
    'report-schedule', 'tech-docs', 'live-debug', 'utilization',
  ],
  director: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'map-view', 'sessions',
    'work-orders', 'events', 'analytics', 'cameras', 'discrepancies', 'utilization',
  ],
  manager: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'map-view', 'sessions',
    'work-orders', 'shifts', 'analytics', 'events', 'data-1c', 'discrepancies', 'utilization',
  ],
  mechanic: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'map-view', 'sessions', 'my-post',
  ],
  viewer: [
    'dashboard', 'dashboard-posts', 'map-view',
  ],
};

export function pagesForRole(role) {
  return ROLE_PAGES[role] || ROLE_PAGES.viewer;
}
