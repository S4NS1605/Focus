/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import type { Connect, PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Serves the finance entry at `/ecosistema` as well as `/ecosistema/`.
 *
 * A multi-page entry lives at `ecosistema/index.html`, which Vite only resolves for
 * the trailing-slash form. Without this, the bare `/ecosistema` — the URL anyone
 * actually types — falls through to the SPA fallback and silently renders the
 * PORTFOLIO instead. Rewriting (rather than redirecting) keeps the address bar
 * clean and matches the 200 rewrite configured in netlify.toml for production.
 */
const ecosistemaTrailingSlash = (): PluginOption => {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    // Exact paths mapping to the trailing slash
    if (
      req.url === '/ecosistema' ||
      req.url === '/finanzas' ||
      req.url === '/superadmin' ||
      req.url === '/estadisticas'
    ) {
      req.url = '/ecosistema/';
    }
    // Paths with query strings
    else if (req.url?.startsWith('/ecosistema?')) req.url = `/ecosistema/${req.url.slice('/ecosistema'.length)}`;
    else if (req.url?.startsWith('/finanzas?')) req.url = `/ecosistema/${req.url.slice('/finanzas'.length)}`;
    else if (req.url?.startsWith('/superadmin?')) req.url = `/ecosistema/${req.url.slice('/superadmin'.length)}`;
    else if (req.url?.startsWith('/estadisticas?')) req.url = `/ecosistema/${req.url.slice('/estadisticas'.length)}`;

    // Explicit sub-routes falling back to index
    else if (
      req.url?.startsWith('/finanzas/') ||
      req.url?.startsWith('/superadmin/') ||
      req.url?.startsWith('/estadisticas/')
    ) {
      req.url = '/ecosistema/';
    }
    next()
  }

  return {
    name: 'ecosistema-trailing-slash',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ecosistemaTrailingSlash(),
  ],
  build: {
    rollupOptions: {
      // Two independent HTML entries. The private finance app needs its own
      // <head> (noindex, iOS standalone metas, manifest) which a single shared
      // index.html cannot provide, and this keeps the two bundles disjoint.
      input: {
        main: resolve(__dirname, 'index.html'),
        ecosistema: resolve(__dirname, 'ecosistema/index.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
