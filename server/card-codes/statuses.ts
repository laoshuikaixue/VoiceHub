export const CARD_CODE_STATUSES = [
  'AVAILABLE',
  'ASSIGNED',
  'LOCKED',
  'REDEEMED',
  'INVALID'
] as const

export type CardCodeStatus = (typeof CARD_CODE_STATUSES)[number]

/**
 * 派发动作的来源状态：只有 AVAILABLE（未被占用、未派发）的点歌券可以被派发。
 * ASSIGNED 需要先回收才能重新派发。
 */
export const CARD_CODE_ASSIGNABLE_STATUS = 'AVAILABLE' as const

export const CARD_CODE_ASSIGNMENT_STATUSES = ['ASSIGNED', 'USED', 'RECYCLED', 'FAILED'] as const

export type CardCodeAssignmentStatus = (typeof CARD_CODE_ASSIGNMENT_STATUSES)[number]
