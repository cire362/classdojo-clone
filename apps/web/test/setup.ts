import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';

// Анимации в тестах не нужны: элементы появляются и исчезают сразу
MotionGlobalConfig.skipAnimations = true;

// jsdom не реализует matchMedia и scrollIntoView
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}
Element.prototype.scrollIntoView = function () {};

afterEach(() => cleanup());
