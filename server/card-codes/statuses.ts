export const CARD_CODE_STATUSES = ['AVAILABLE', 'LOCKED', 'REDEEMED', 'INVALID'] as const

export type CardCodeStatus = (typeof CARD_CODE_STATUSES)[number]
