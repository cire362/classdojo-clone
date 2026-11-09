import type { ComponentType } from 'react';
import { iconKey, type IconKey } from '@heroes/shared/icons';
import {
  AlarmIcon, BookOpenIcon, BooksIcon, BrainIcon, CalendarCheckIcon, CertificateIcon, ChairIcon, ChalkboardTeacherIcon,
  CheckCircleIcon, ClipboardTextIcon, CoffeeIcon, CookieIcon, DeviceMobileSlashIcon, FlaskIcon, GameControllerIcon,
  GiftIcon, GraduationCapIcon, HandIcon, HandshakeIcon, HeartIcon, HourglassIcon, LaptopIcon, LightbulbIcon, LightningIcon,
  MaskHappyIcon, MedalIcon, MegaphoneIcon, MoonIcon, MusicNotesIcon, NotebookIcon, PaletteIcon, PencilSimpleIcon,
  PuzzlePieceIcon, RocketIcon, SoccerBallIcon, SparkleIcon, SpeakerSlashIcon, StarIcon, TargetIcon, TrophyIcon,
  UsersThreeIcon, type IconProps,
} from '@phosphor-icons/react';

const ICONS: Record<IconKey, ComponentType<IconProps>> = {
  star: StarIcon, sparkle: SparkleIcon, lightning: LightningIcon, lightbulb: LightbulbIcon, handshake: HandshakeIcon,
  puzzle: PuzzlePieceIcon, check: CheckCircleIcon, 'calendar-check': CalendarCheckIcon, trophy: TrophyIcon, medal: MedalIcon,
  target: TargetIcon, rocket: RocketIcon, books: BooksIcon, book: BookOpenIcon, notebook: NotebookIcon,
  clipboard: ClipboardTextIcon, pencil: PencilSimpleIcon, brain: BrainIcon, hand: HandIcon, users: UsersThreeIcon,
  alarm: AlarmIcon, moon: MoonIcon, megaphone: MegaphoneIcon, 'phone-slash': DeviceMobileSlashIcon,
  'speaker-slash': SpeakerSlashIcon, hourglass: HourglassIcon, palette: PaletteIcon, flask: FlaskIcon,
  graduation: GraduationCapIcon, chalkboard: ChalkboardTeacherIcon, certificate: CertificateIcon, laptop: LaptopIcon,
  chair: ChairIcon, music: MusicNotesIcon, gift: GiftIcon, game: GameControllerIcon, cookie: CookieIcon,
  soccer: SoccerBallIcon, masks: MaskHappyIcon, heart: HeartIcon, coffee: CoffeeIcon,
};

/** Подписи для выбора значка: экранный диктор называет картинку, а не ключ */
export const ICON_LABELS: Record<IconKey, string> = {
  star: 'звезда', sparkle: 'искорка', lightning: 'молния', lightbulb: 'лампочка', handshake: 'рукопожатие',
  puzzle: 'пазл', check: 'галочка', 'calendar-check': 'календарь', trophy: 'кубок', medal: 'медаль', target: 'мишень',
  rocket: 'ракета', books: 'книги', book: 'открытая книга', notebook: 'тетрадь', clipboard: 'планшет с листом',
  pencil: 'карандаш', brain: 'мозг', hand: 'поднятая рука', users: 'команда', alarm: 'будильник', moon: 'луна',
  megaphone: 'мегафон', 'phone-slash': 'телефон перечёркнут', 'speaker-slash': 'без звука', hourglass: 'песочные часы',
  palette: 'палитра', flask: 'колба', graduation: 'академическая шапка', chalkboard: 'преподаватель у доски',
  certificate: 'грамота', laptop: 'ноутбук', chair: 'стул', music: 'ноты', gift: 'подарок', game: 'геймпад',
  cookie: 'печенье', soccer: 'мяч', masks: 'театральная маска', heart: 'сердце', coffee: 'кофе',
};

/**
 * Значок причины, награды или достижения: рисованная иконка по ключу из базы.
 * Старые эмодзи тоже понимает, незнакомое значение показывает искоркой
 */
export function Glyph({ name, size = 24, className = '' }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[iconKey(name)];
  return <Icon size={size} weight="duotone" className={`shrink-0 ${className}`} aria-hidden />;
}
