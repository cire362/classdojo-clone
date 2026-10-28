import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { defineConfig, type Plugin } from 'vite';
import type { OutputChunk } from 'rollup';
import { PAGE_MODULES } from './src/routes';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * src/early.ts (вместе с src/routes.ts) встраивается в <head> обычным скриптом: он должен
 * выполниться сразу, не дожидаясь модулей приложения. При сборке рядом кладётся карта
 * «страница → файлы её кода», чтобы ранний скрипт заказал их через modulepreload.
 */
function inlineEarlyScript(): Plugin {
  return {
    name: 'heroes-inline-early-script',
    async transformIndexHtml(html, ctx) {
      const out = await build({
        entryPoints: [fileURLToPath(new URL('./src/early.ts', import.meta.url))],
        bundle: true,
        write: false,
        minify: true,
        format: 'iife',
        target: 'es2020',
      });
      const code = out.outputFiles[0].text.trim();
      const chunks: Record<string, string[]> = {};
      if (ctx.bundle) {
        const all = Object.values(ctx.bundle).filter((c): c is OutputChunk => c.type === 'chunk');
        const byFile = new Map(all.map((c) => [c.fileName, c]));
        for (const [key, modulePath] of Object.entries(PAGE_MODULES)) {
          const chunk = all.find((c) => c.facadeModuleId?.endsWith(`/src/${modulePath}`));
          if (!chunk) continue;
          // Сам файл страницы и всё, что он статически импортирует
          const files = new Set<string>();
          const visit = (file: string) => {
            if (files.has(file)) return;
            files.add(file);
            byFile.get(file)?.imports.forEach(visit);
          };
          visit(chunk.fileName);
          chunks[key] = [...files];
        }
      }
      // Сразу после <meta>, но до стилей: обычный скрипт после <link rel=stylesheet> ждал бы их загрузки
      return html.replace(
        '<!-- heroes:early-script -->',
        `<script>window.__heroesChunks=${JSON.stringify(chunks)};${code}</script>`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), inlineEarlyScript()],
  build: {
    rollupOptions: {
      output: {
        // Библиотеки — в отдельных файлах: они редко меняются и дольше живут в кэше браузера
        manualChunks(id) {
          // Ядро приложения, нужное любой странице, — одним файлом, а не россыпью мелких
          if (/[\\/]src[\\/]((api|auth|news|hooks|pages|routes)\.tsx?|components[\\/](ui|Toast|Layout|ChunkErrorBoundary|PageSkeleton)\.tsx|lib[\\/]network\.ts)$/.test(id)) {
            return 'app';
          }
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
