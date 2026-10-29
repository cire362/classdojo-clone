import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';
import { presenceConfig } from '../src/lib/presence';

// Анимации в тестах не нужны: элементы появляются и исчезают сразу
MotionGlobalConfig.skipAnimations = true;
presenceConfig.skipExit = true;

// jsdom не реализует matchMedia и scrollIntoView
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}
Element.prototype.scrollIntoView = function () {};

afterEach(() => cleanup());
