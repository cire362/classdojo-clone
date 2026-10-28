import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Библиотеки — в отдельных файлах: они редко меняются и дольше живут в кэше браузера
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Иконки проверяем первыми: путь @phosphor-icons/react иначе попал бы в чанк react
          if (id.includes('@phosphor-icons')) return 'icons';
          if (/[\\/](react-router|react-router-dom)[\\/]/.test(id)) return 'router';
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (/[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
