import react from '@vitejs/plugin-react';
import { defineConfig, type ProxyOptions } from 'vite';

const BACKEND_TARGET = 'http://127.0.0.1:5168';

function createApiProxy(): Record<string, ProxyOptions> {
  return {
    '/api': {
      target: BACKEND_TARGET,
      changeOrigin: true,
      configure(proxy) {
        proxy.on('error', (_err, _req, res) => {
          if ('writeHead' in res && typeof res.writeHead === 'function' && !res.headersSent) {
            res.writeHead(503, {
              'Content-Type': 'application/json',
            });
            res.end(
              JSON.stringify({
                type: 'https://httpstatuses.com/503',
                title: 'Backend Service Unavailable',
                status: 503,
                detail: `Nexus backend API at ${BACKEND_TARGET} is offline or unreachable.`,
                backendOffline: true,
              }),
            );
          }
        });
      },
    },
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: createApiProxy(),
  },
  preview: {
    port: 4173,
    proxy: createApiProxy(),
  },
});
