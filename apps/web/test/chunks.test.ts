import { expect, it } from 'vitest';
import { rollup, type OutputChunk } from 'rollup';
import { createManualChunks } from '../build/chunks';

it('оставляет иконки ленивых страниц вне ядра, сохраняя прямые и косвенные зависимости ядра', async () => {
  const icon = (name: string) => `/node_modules/@phosphor-icons/react/dist/csr/${name}.js`;
  const base = '/node_modules/@phosphor-icons/react/dist/lib/IconBase.js';
  const modules: Record<string, string> = {
    '/src/main.ts': `import { shell } from '/src/app/Layout.ts';
      console.log(shell); export const open = () => import('/src/pages/Lesson.ts');`,
    '/src/app/Layout.ts': `import { direct } from '${icon('direct')}';
      import { shared } from '/src/ui/shared.ts'; export const shell = direct + shared;`,
    '/src/ui/shared.ts': `export { indirect as shared } from '${icon('indirect')}';`,
    '/src/pages/Lesson.ts': `export { a } from '/src/features/lesson/A.ts';
      export { b } from '/src/features/lesson/B.ts';`,
    '/src/features/lesson/A.ts': `import { rare } from '${icon('rare')}';
      import { single } from '${icon('single')}';
      import { indirect } from '${icon('indirect')}'; export const a = rare + single + indirect;`,
    '/src/features/lesson/B.ts': `export { rare as b } from '${icon('rare')}';`,
    [base]: 'export const base = globalThis.iconBase;',
  };
  for (const name of ['direct', 'indirect', 'rare', 'single']) {
    modules[icon(name)] = `import { base } from '${base}'; export const ${name} = base + '${name}';`;
  }
  const bundle = await rollup({
    input: '/src/main.ts',
    plugins: [{ name: 'fixture', resolveId: (id) => id in modules ? id : null, load: (id) => modules[id] }],
  });
  try {
    const { output } = await bundle.generate({
      format: 'es', manualChunks: createManualChunks(/\/src\/app\/Layout\.ts$/),
    });
    const chunks = output.filter((file): file is OutputChunk => file.type === 'chunk');
    const app = chunks.find((c) => c.name === 'app')!;
    const extra = chunks.find((c) => c.name === 'icons-extra')!;
    expect(app.modules).toHaveProperty([icon('direct')]);
    expect(app.modules).toHaveProperty([icon('indirect')]);
    expect(app.modules).toHaveProperty([base]);
    expect(extra.modules).toHaveProperty([icon('rare')]);
    expect(app.modules).not.toHaveProperty([icon('rare')]);
    expect(app.modules).not.toHaveProperty([icon('single')]);
    expect(extra.modules).not.toHaveProperty([icon('single')]);
    // Проверяем весь граф первого экрана: вынесенный файл не должен вернуться косвенным импортом.
    const visited = new Set<string>();
    const visit = (chunk: OutputChunk) => {
      if (visited.has(chunk.fileName)) return;
      visited.add(chunk.fileName);
      chunk.imports.forEach((file) => visit(chunks.find((c) => c.fileName === file)!));
    };
    chunks.filter((c) => c.isEntry).forEach(visit);
    expect(visited.has(app.fileName)).toBe(true);
    expect(visited.has(extra.fileName)).toBe(false);
    expect(extra.imports).toContain(app.fileName);
  } finally {
    await bundle.close();
  }
});
