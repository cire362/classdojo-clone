/**
 * Значки причин, наград и достижений портфолио — ключи рисованных иконок, а не эмодзи:
 * эмодзи на разных устройствах выглядят по-разному и не совпадают с остальным интерфейсом.
 * В базе хранится ключ; старые эмодзи переводит миграция, а на случай пропущенных — EMOJI_TO_ICON.
 */
export const ICON_KEYS = [
  'star', 'sparkle', 'lightning', 'lightbulb', 'handshake', 'puzzle', 'check', 'calendar-check', 'trophy', 'medal',
  'target', 'rocket', 'books', 'book', 'notebook', 'clipboard', 'pencil', 'brain', 'hand', 'users',
  'alarm', 'moon', 'megaphone', 'phone-slash', 'speaker-slash', 'hourglass',
  'palette', 'flask', 'graduation', 'chalkboard', 'certificate', 'laptop',
  'chair', 'music', 'gift', 'game', 'cookie', 'soccer', 'masks', 'heart', 'coffee',
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

export const EMOJI_TO_ICON: Record<string, IconKey> = {
  '💪': 'lightning', '💡': 'lightbulb', '🤝': 'handshake', '🧩': 'puzzle', '✨': 'sparkle', '⭐': 'star', '🌟': 'star',
  '⏰': 'alarm', '💤': 'moon', '📕': 'notebook', '📢': 'megaphone', '✅': 'check', '🏆': 'trophy', '🥇': 'medal',
  '🥈': 'medal', '🥉': 'medal', '🏅': 'medal', '📚': 'books', '📖': 'book', '🎯': 'target', '🚀': 'rocket',
  '🎨': 'palette', '🙋': 'hand', '📱': 'phone-slash', '📵': 'phone-slash', '🙊': 'speaker-slash', '🎁': 'gift',
  '🪑': 'chair', '🎵': 'music', '🧑‍🏫': 'chalkboard', '🎮': 'game', '🍬': 'cookie', '⚽': 'soccer', '🎓': 'graduation',
  '🔬': 'flask', '🎭': 'masks', '📅': 'calendar-check', '📝': 'clipboard',
};

const KNOWN = new Set<string>(ICON_KEYS);

/** Ключ иконки для сохранённого значения: ключ как есть, эмодзи — по словарю, незнакомое — искорка */
export function iconKey(value: string | null | undefined): IconKey {
  if (value && KNOWN.has(value)) return value as IconKey;
  return (value && EMOJI_TO_ICON[value]) || 'sparkle';
}

/** Наборы для выбора в редакторах */
export const REASON_ICONS: IconKey[] = [
  'star', 'lightning', 'lightbulb', 'handshake', 'puzzle', 'sparkle', 'check', 'calendar-check', 'target', 'rocket',
  'brain', 'hand', 'users', 'pencil', 'books', 'trophy', 'alarm', 'moon', 'notebook', 'megaphone', 'phone-slash', 'speaker-slash',
];
export const REWARD_ICONS: IconKey[] = [
  'gift', 'chair', 'music', 'chalkboard', 'alarm', 'hourglass', 'game', 'cookie',
  'book', 'palette', 'soccer', 'coffee', 'laptop', 'star', 'medal',
];
export const PORTFOLIO_ICONS: IconKey[] = [
  'trophy', 'medal', 'certificate', 'graduation', 'books', 'flask', 'palette', 'masks', 'music', 'soccer', 'lightbulb', 'rocket',
];
