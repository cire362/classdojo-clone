/** Реакции на записи ленты: значками, а не эмодзи */
export const REACTION_KINDS = ['like', 'heart', 'star'] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

/** Причины жалобы на запись или комментарий, по порядку в форме */
export const REPORT_REASONS = {
  insult: 'Грубость или оскорбление',
  personal: 'Личные данные или фото ребёнка',
  inappropriate: 'Неуместно для класса',
  other: 'Другое',
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
