// Map theme constants — shared between STOMap and MapViewer

export const ZONE_COLORS_DARK = {
  entry: { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981' },
  waiting: { fill: 'rgba(245, 158, 11, 0.15)', stroke: '#f59e0b' },
  repair: { fill: 'rgba(99, 102, 241, 0.15)', stroke: '#6366f1' },
  diagnostics: { fill: 'rgba(168, 85, 247, 0.15)', stroke: '#a855f7' },
  driveway: { fill: 'rgba(107, 114, 128, 0.10)', stroke: '#6b7280' },
  parking: { fill: 'rgba(59, 130, 246, 0.15)', stroke: '#3b82f6' },
  free: { fill: 'rgba(148, 163, 184, 0.12)', stroke: '#94a3b8' },
};

export const ZONE_COLORS_LIGHT = {
  entry: { fill: 'rgba(16, 185, 129, 0.06)', stroke: '#059669' },
  waiting: { fill: 'rgba(245, 158, 11, 0.06)', stroke: '#d97706' },
  repair: { fill: 'rgba(99, 102, 241, 0.06)', stroke: '#4f46e5' },
  diagnostics: { fill: 'rgba(168, 85, 247, 0.06)', stroke: '#7c3aed' },
  driveway: { fill: 'rgba(107, 114, 128, 0.04)', stroke: '#9ca3af' },
  parking: { fill: 'rgba(59, 130, 246, 0.06)', stroke: '#2563eb' },
  free: { fill: 'rgba(148, 163, 184, 0.05)', stroke: '#94a3b8' },
};

export function getZoneColors(isDark) {
  return isDark ? ZONE_COLORS_DARK : ZONE_COLORS_LIGHT;
}

export const MAP_BG = {
  dark: '#0f172a',
  light: '#f0f4f8',
};

export const MAP_TEXT = {
  dark: { primary: '#f1f5f9', secondary: '#94a3b8', muted: '#64748b' },
  light: { primary: '#1a202c', secondary: '#718096', muted: '#a0aec0' },
};

export const GRID_STROKE = {
  dark: 'rgba(148,163,184,0.04)',
  light: 'rgba(0,0,0,0.02)',
};

export const BUILDING_STROKE = {
  dark: 'rgba(148,163,184,0.2)',
  light: 'rgba(0,0,0,0.15)',
};

export const CAMERA_FOV_OPACITY = { dark: 0.45, light: 0.2 };
export const ZONE_FILL_OPACITY = { dark: 0.18, light: 0.08 };
export const DRIVEWAY_FILL = {
  dark: 'rgba(148,163,184,0.15)',
  light: 'rgba(148,163,184,0.06)',
};
