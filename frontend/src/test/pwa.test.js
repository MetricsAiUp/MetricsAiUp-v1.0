import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('PWA Configuration', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(__dirname, '../../public/manifest.json'), 'utf-8')
  );

  it('manifest has required PWA fields', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.theme_color).toBeTruthy();
  });

  it('manifest has icons', () => {
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThan(0);
    expect(manifest.icons[0].src).toBeTruthy();
  });

  it('manifest theme color matches app accent', () => {
    expect(manifest.theme_color).toBe('#6366f1'); // indigo accent
  });

  it('service worker file exists and handles events', () => {
    const sw = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf-8');

    expect(sw).toContain("addEventListener('install'");
    expect(sw).toContain("addEventListener('activate'");
    expect(sw).toContain("addEventListener('fetch'");
    expect(sw).toContain("addEventListener('push'");
    expect(sw).toContain("addEventListener('notificationclick'");
  });

  it('service worker has network-first strategy', () => {
    const sw = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf-8');

    // Should fetch first, then fallback to cache
    expect(sw).toContain('fetch(event.request)');
    expect(sw).toContain('caches.match(event.request)');
  });

  it('service worker skips API and socket.io requests', () => {
    const sw = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf-8');

    expect(sw).toContain("'/api/'");
    expect(sw).toContain("'/socket.io/'");
  });

  it('service worker caches static assets', () => {
    const sw = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf-8');

    expect(sw).toContain('STATIC_ASSETS');
    expect(sw).toContain('index.html');
  });

  it('main.jsx registers service worker', () => {
    const main = readFileSync(resolve(__dirname, '../main.jsx'), 'utf-8');

    expect(main).toContain("serviceWorker");
    expect(main).toContain("register");
  });

  it('index.html has manifest link and meta tags', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');

    expect(html).toContain('manifest');
    expect(html).toContain('theme-color');
    expect(html).toContain('apple-mobile-web-app-capable');
  });
});
