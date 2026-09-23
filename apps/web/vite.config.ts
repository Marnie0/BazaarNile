import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vendor code changes far less often than app code; separate chunks keep it cached across deploys.
const vendorChunks: Record<string, string[]> = {
  react: ['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'],
  query: ['@tanstack/react-query', '@tanstack/query-core'],
  motion: ['framer-motion', 'motion-dom', 'motion-utils'],
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const match = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
          if (!match) return undefined;
          return Object.entries(vendorChunks).find(([, packages]) => packages.includes(match[1]))?.[0];
        },
      },
    },
  },
});
