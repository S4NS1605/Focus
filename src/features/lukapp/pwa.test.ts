/// <reference types="node" />
// Node types are referenced here rather than added to tsconfig.app.json: this
// is the only test that reads files off disk, and widening the app's type
// environment for it would let Node globals leak into browser code.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = process.cwd();
const leer = (ruta: string) => readFileSync(resolve(raiz, ruta), 'utf8');

const manifest = JSON.parse(leer('public/ecosistema.webmanifest'));
const sw = leer('public/sw.js');
const html = leer('ecosistema/index.html');

describe('manifest', () => {
  it('declares what a browser needs before it offers to install', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/ecosistema');
    expect(manifest.display).toBe('standalone');
  });

  it('points at icons that actually exist', () => {
    // A renamed icon breaks installability silently: the browser simply stops
    // offering to install, with nothing in the console to explain why.
    for (const icono of manifest.icons) {
      expect(existsSync(resolve(raiz, 'public', icono.src.slice(1)))).toBe(true);
    }
  });

  it('includes a maskable icon, or Android crops the artwork', () => {
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  });

  it('has the 192 and 512 sizes install prompts require', () => {
    const tamanos = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(tamanos).toContain('192x192');
    expect(tamanos).toContain('512x512');
  });

  it('is linked from the page, not merely present in the folder', () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('/ecosistema.webmanifest');
  });

  it('keeps the apple-touch-icon, which iOS uses instead of the manifest', () => {
    expect(html).toContain('apple-touch-icon');
  });
});

describe('service worker', () => {
  it('never caches the API, Supabase or auth', () => {
    // The rule that matters most. A cached balance looks authoritative and is
    // wrong, and a cached auth response could resurrect a signed-out session —
    // failures the user cannot see, which is what makes them worse than an
    // outright error.
    expect(sw).toContain("url.pathname.startsWith('/api/')");
    expect(sw).toContain("url.hostname.endsWith('.supabase.co')");
    expect(sw).toContain("url.pathname.includes('/auth/')");
  });

  it('leaves the public portfolio alone', () => {
    // Registered at scope "/", so it also sees the portfolio. Falling back to
    // this app's shell for a portfolio URL would serve the wrong site offline.
    expect(sw).toContain('esRutaDeLaApp');
    expect(sw).toContain("['/ecosistema', '/lukapp', '/superadmin', '/estadisticas']");
  });

  it('only ever handles GET', () => {
    expect(sw).toContain("peticion.method !== 'GET'");
  });

  it('serves navigations network-first, so a deploy is not stuck behind a cache', () => {
    const navegacion = sw.slice(sw.indexOf("mode === 'navigate'"));
    expect(navegacion.indexOf('fetch(peticion)')).toBeLessThan(navegacion.indexOf('caches.match'));
  });

  it('drops caches from previous versions on activate', () => {
    expect(sw).toContain('caches.delete');
  });
});
