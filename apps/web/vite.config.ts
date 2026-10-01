import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { phosphorWeights } from './plugins/phosphor-weights.ts';

export default defineConfig({
  plugins: [react(), tailwindcss(), phosphorWeights()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
