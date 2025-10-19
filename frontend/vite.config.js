// frontend/vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const DEV_PROXY_ON = String(env.VITE_DEV_PROXY || '').toUpperCase() === 'ON';
  const BACKEND = env.VITE_BACKEND;

  return {
    plugins: [react()],
    server: DEV_PROXY_ON
      ? {
          proxy: {
            '/api': {
              target: BACKEND,
              changeOrigin: true,
            },
          },
        }
      : undefined,
  };
});
