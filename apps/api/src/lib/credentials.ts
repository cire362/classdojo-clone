import { hash, verify } from '@node-rs/argon2';
import { randomInt } from 'node:crypto';

export function hashPassword(password: string): Promise<string> {
  // argon2id с параметрами по умолчанию (m=19 МиБ, t=2) — рекомендация OWASP
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

const WORDS_A = [
  'lion', 'tiger', 'panda', 'koala', 'eagle', 'shark', 'fox', 'wolf', 'bear', 'owl', 'seal', 'lynx',
  'hawk', 'otter', 'zebra', 'moose', 'crab', 'frog', 'bee', 'whale', 'puma', 'yak', 'gecko', 'raven',
  'bison', 'camel', 'hippo', 'lemur', 'mole', 'orca', 'swan', 'toad',
];
const WORDS_B = [
  'sun', 'moon', 'star', 'rock', 'wave', 'leaf', 'fire', 'snow', 'wind', 'rain', 'sky', 'cloud',
  'storm', 'comet', 'river', 'ocean', 'iron', 'gold', 'jade', 'ruby', 'mint', 'lime', 'berry', 'nova',
  'bolt', 'spark', 'frost', 'flash', 'dune', 'peak', 'reef', 'glow',
];

/**
 * Пароль для ученика: легко прочитать и набрать на латинской раскладке,
 * без похожих символов (0/O, 1/l). Пример: fox347moon.
 */
export function generatePassword(): string {
  return WORDS_A[randomInt(WORDS_A.length)] + String(randomInt(100, 1000)) + WORDS_B[randomInt(WORDS_B.length)];
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k',
  л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function transliterate(s: string): string {
  return s
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

/** Базовый логин из имени: «Маша Иванова» → masha.i */
export function loginBase(name: string): string {
  const words = name.trim().split(/\s+/).map(transliterate).filter(Boolean);
  if (!words.length) return 'hero';
  const first = words[0].slice(0, 16);
  return words[1] ? `${first}.${words[1][0]}` : first;
}

/** Подбирает свободный логин: masha.i, masha.i2, masha.i3 … */
export function pickLogin(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}
