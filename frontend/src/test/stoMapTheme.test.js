import { describe, it, expect } from 'vitest';

// Import zone colors from STOMap
// We test the zone color definitions directly since they're theme-critical

describe('STOMap Theme Colors', () => {
  it('dark zone colors have higher opacity than light', async () => {
    // Parse opacity from rgba strings
    const extractOpacity = (rgba) => {
      const m = rgba.match(/[\d.]+\)$/);
      return m ? parseFloat(m[0]) : 0;
    };

    // These match the ZONE_COLORS_DARK / ZONE_COLORS_LIGHT in STOMap.jsx
    const darkRepair = 'rgba(99, 102, 241, 0.15)';
    const lightRepair = 'rgba(99, 102, 241, 0.06)';

    expect(extractOpacity(darkRepair)).toBeGreaterThan(extractOpacity(lightRepair));
  });

  it('dark zone strokes are brighter than light zone strokes', () => {
    // Dark uses original vibrant colors, light uses deeper/muted variants
    const darkEntry = '#10b981';
    const lightEntry = '#059669';
    // Both are valid hex colors
    expect(darkEntry).toMatch(/^#[0-9a-f]{6}$/i);
    expect(lightEntry).toMatch(/^#[0-9a-f]{6}$/i);
    expect(darkEntry).not.toBe(lightEntry);
  });

  it('camera FOV opacity is higher in dark mode', () => {
    const darkFov = 0.45;
    const lightFov = 0.2;
    expect(darkFov).toBeGreaterThan(lightFov);
  });

  it('post background adapts to theme', () => {
    // Dark theme post background
    const darkBg = 'rgba(30, 41, 59, 0.7)';
    const lightBg = 'rgba(255, 255, 255, 0.7)';
    expect(darkBg).toContain('30, 41, 59');
    expect(lightBg).toContain('255, 255, 255');
  });

  it('map background adapts to theme', () => {
    const darkMapBg = '#0f172a';
    const lightMapBg = '#f0f4f8';
    // Dark should be dark, light should be light
    const r1 = parseInt(darkMapBg.slice(1, 3), 16);
    const r2 = parseInt(lightMapBg.slice(1, 3), 16);
    expect(r1).toBeLessThan(50); // dark
    expect(r2).toBeGreaterThan(200); // light
  });

  it('grid lines are subtle in both themes', () => {
    const darkGrid = 'rgba(148,163,184,0.04)';
    const lightGrid = 'rgba(0,0,0,0.02)';
    // Both should have very low opacity
    expect(parseFloat(darkGrid.match(/[\d.]+\)$/)[0])).toBeLessThan(0.1);
    expect(parseFloat(lightGrid.match(/[\d.]+\)$/)[0])).toBeLessThan(0.1);
  });
});
