/// <reference types="vitest/config" />
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const STEAM_HOSTS = [
  'https://community.fastly.steamstatic.com',
  'https://community.cloudflare.steamstatic.com',
  'https://community.akamai.steamstatic.com',
];

/** Proxy de imagens Steam para contornar bloqueios de rede/CORS */
function steamImageProxy(): Plugin {
  return {
    name: 'steam-image-proxy',
    configureServer(server) {
      server.middlewares.use('/steam-img', steamProxyHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/steam-img', steamProxyHandler);
    },
  };
}

function steamProxyHandler(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const path = req.url ?? '';
  if (!path.startsWith('/economy/image/')) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  (async () => {
    for (const host of STEAM_HOSTS) {
      try {
        const target = `${host}${path}`;
        const response = await fetch(target, {
          headers: { 'User-Agent': 'CS2-TradeUp-Optimizer/1.0' },
        });
        if (!response.ok) continue;

        const buffer = Buffer.from(await response.arrayBuffer());
        res.setHeader('Content-Type', response.headers.get('content-type') ?? 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.statusCode = 200;
        res.end(buffer);
        return;
      } catch {
        continue;
      }
    }
    res.statusCode = 502;
    res.end('Steam CDN unavailable');
  })();
}

export default defineConfig({
  plugins: [react(), steamImageProxy()],
  server: {
    proxy: {
      '/api/backend': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/backend/, ''),
      },
      '/api/csfloat': {
        target: 'https://csfloat.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/csfloat/, '/api'),
      },
    },
  },
  preview: {
    proxy: {
      '/api/backend': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/backend/, ''),
      },
      '/api/csfloat': {
        target: 'https://csfloat.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/csfloat/, '/api'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
