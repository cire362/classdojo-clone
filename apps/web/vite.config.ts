import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { defineConfig, type Plugin } from 'vite';
import type { OutputChunk } from 'rollup';
import { PAGE_MODULES } from './src/app/routes';
import { createManualChunks } from './build/chunks';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * src/app/early.ts (вместе с src/app/routes.ts) встраивается в <head> обычным скриптом: он должен
 * выполниться сразу, не дожидаясь модулей приложения. При сборке рядом кладётся карта
 * «страница → файлы её кода», чтобы ранний скрипт заказал их через modulepreload.
 */
function inlineEarlyScript(): Plugin {
  return {
    name: 'heroes-inline-early-script',
    async transformIndexHtml(html, ctx) {
      const out = await build({
        entryPoints: [fileURLToPath(new URL('./src/app/early.ts', import.meta.url))],
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

/**
 * Стили встраиваются в index.html (~13 КБ в gzip). Отдельный CSS-файл по HTTP/1.1 ждал свободного
 * соединения из шести, которые ранний скрипт сразу занимает данными и кодом страницы, и первая
 * отрисовка иногда сдвигалась с 1,5 до 2,7 с. Шрифты остаются отдельными файлами (пути абсолютные).
 */
function inlineStyles(): Plugin {
  return {
    name: 'heroes-inline-styles',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        const bundle = ctx.bundle;
        return html.replace(/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/g, (tag, fileName: string) => {
          const asset = bundle[fileName];
          if (!asset || asset.type !== 'asset') return tag;
          delete bundle[fileName];
          return `<style>${String(asset.source).replace(/<\/style/gi, '<\\/style')}</style>`;
        });
      },
    },
  };
}

/**
 * `import { StarIcon } from '@phosphor-icons/react'` → импорт каждой иконки по её пути.
 * Через общий индексный файл все иконки «притягивались» к первому импортировавшему их файлу
 * (ядру приложения), а по отдельности каждая попадает в код той страницы, где нужна.
 */
function phosphorPerIcon(): Plugin {
  const IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]@phosphor-icons\/react['"];?/g;
  return {
    name: 'heroes-phosphor-per-icon',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]src[\\/].*\.tsx?$/.test(id) || !code.includes('@phosphor-icons/react')) return null;
      return code.replace(IMPORT, (_, names: string) =>
        names
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => {
            const [name, alias] = n.split(/\s+as\s+/);
            const file = name.replace(/Icon$/, '');
            return `import { ${name}${alias ? ` as ${alias}` : ''} } from '@phosphor-icons/react/dist/csr/${file}';`;
          })
          .join('\n'),
      );
    },
  };
}

/**
 * Каждая иконка Phosphor несёт 6 начертаний, а мы используем 2–3 (regular по умолчанию + weight="…"
 * в коде). Неиспользуемые начертания вырезаются при сборке — иконки становятся вдвое легче.
 * Набор начертаний собирается из исходников. weight={условие ? 'a' : 'b'} учитывается,
 * а любое другое выражение (значение неизвестно при сборке) отключает вырезание целиком.
 */
function phosphorUsedWeights(): Plugin {
  const ALL = ['thin', 'light', 'regular', 'bold', 'fill', 'duotone'];
  const srcDir = fileURLToPath(new URL('./src', import.meta.url));
  const used = new Set(['regular']);
  let dynamic = false;
  for (const file of readdirSync(srcDir, { recursive: true, encoding: 'utf8' })) {
    if (!/\.tsx?$/.test(file)) continue;
    const code = readFileSync(join(srcDir, file), 'utf8');
    for (const m of code.matchAll(/\bweight=(?:"(\w+)"|'(\w+)'|\{([^{}]*)\})/g)) {
      const literal = m[1] ?? m[2];
      const ternary = m[3] && /\?\s*['"](\w+)['"]\s*:\s*['"](\w+)['"]\s*$/.exec(m[3]);
      if (literal) used.add(literal);
      else if (ternary) ternary.slice(1).forEach((w) => used.add(w));
      else dynamic = true;
    }
  }
  const unused = ALL.filter((w) => !used.has(w));
  const ENTRY = new RegExp(`\\n  \\[\\n    "(?:${unused.join('|')})",\\n[\\s\\S]*?\\n  \\],?(?=\\n)`, 'g');
  return {
    name: 'heroes-phosphor-used-weights',
    apply: 'build',
    buildStart() {
      // Без этого предупреждения иконки молча становятся вдвое тяжелее
      if (dynamic) this.warn('weight={…} с неизвестным значением: начертания иконок не вырезаются');
    },
    transform(code, id) {
      if (dynamic || !unused.length || !/@phosphor-icons[\\/]react[\\/]dist[\\/]defs[\\/]/.test(id)) return null;
      return code.replace(ENTRY, '');
    },
  };
}

/**
 * Ядро приложения, нужное любой странице. Пути записаны строкой: переносишь файл — обнови список.
 * Rollup кладёт в ядро всё, что эти файлы импортируют, не глядя на tree-shaking, поэтому они берут из фич
 * только auth, news и notifications: в этих фичах нет ничего, кроме кода ядра.
 */
const APP_CHUNK = new RegExp(
  `[\\\\/]src[\\\\/](${[
    'app/(Layout|pages|routes)',
    'features/auth/auth',
    'features/groups/hooks/useGroup',
    'features/news/news',
    'features/notifications/notify',
    'features/profile/components/ProfileSkeleton',
    'lib/(api|hooks|network)',
    'ui/(index|Toast|PageSkeleton|ChunkErrorBoundary)',
  ]
    .join('|')
    .replaceAll('/', '[\\\\/]')})\\.tsx?$`,
);

export default defineConfig({
  plugins: [phosphorPerIcon(), phosphorUsedWeights(), react(), tailwindcss(), inlineEarlyScript(), inlineStyles()],
  build: {
    rollupOptions: {
      // Импорт из index.ts фичи не должен тянуть на страницу соседние файлы: любой memo() на верхнем уровне считается эффектом
      treeshake: { moduleSideEffects: (id) => !/[\\/]src[\\/]features[\\/]/.test(id) },
      output: {
        // Библиотеки — в отдельных файлах: они редко меняются и дольше живут в кэше браузера
        manualChunks: createManualChunks(APP_CHUNK),
      },
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
