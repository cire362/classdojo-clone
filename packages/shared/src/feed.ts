/** Реакции на записи ленты: значками, а не эмодзи */
export const REACTION_KINDS = ['like', 'heart', 'star'] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];
