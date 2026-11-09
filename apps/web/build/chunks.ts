import type { GetManualChunk } from 'rollup';

/** Статическая зависимость ядра: динамический импорт страницы не делает её частью первого экрана. */
function usedByCore(id: string, appModule: RegExp, getModuleInfo: Parameters<GetManualChunk>[1]['getModuleInfo']): boolean {
  const pending = [id];
  const seen = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    if (appModule.test(current)) return true;
    pending.push(...(getModuleInfo(current)?.importers ?? []));
  }
  return false;
}

export function createManualChunks(appModule: RegExp): GetManualChunk {
  return (id, { getModuleInfo }) => {
    if (appModule.test(id)) return 'app';
    if (!id.includes('node_modules')) return undefined;
    // До react: это слово есть и в пути Phosphor.
    if (id.includes('@phosphor-icons')) {
      if (/[\\/]dist[\\/]lib[\\/]/.test(id)) return 'app';
      if (/[\\/]dist[\\/]csr[\\/]/.test(id)) {
        if (usedByCore(id, appModule, getModuleInfo)) return 'app';
        // Общие иконки ленивых экранов — одним файлом, без россыпи запросов на каждую иконку.
        if ((getModuleInfo(id)?.importers.length ?? 0) > 1) return 'icons-extra';
      }
      return undefined;
    }
    if (/[\\/](react-router|react-router-dom)[\\/]/.test(id)) return 'router';
    if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
    if (/[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
    return undefined;
  };
}
