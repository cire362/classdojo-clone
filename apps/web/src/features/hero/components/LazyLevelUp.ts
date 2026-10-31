import { lazy } from 'react';

// Праздник уровня с конфетти бывает редко и тянет библиотеку анимаций — грузим его только когда он нужен
export const LevelUpOverlay = lazy(() => import('./LevelUp').then((m) => ({ default: m.LevelUpOverlay })));
