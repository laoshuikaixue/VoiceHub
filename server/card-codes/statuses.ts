// 卡密状态常量（对齐 app/drizzle/schema.ts 的 card_code_status 枚举；旧 CONVERTED 状态已废弃，统一用 REDEEMED 表示已兑换）
export const CARD_CODE_STATUSES = ['AVAILABLE', 'LOCKED', 'REDEEMED', 'INVALID'] as const

export type CardCodeStatus = (typeof CARD_CODE_STATUSES)[number]

// 管理员可手动切换到状态（不含 REDEEMED 之外的自动流转）
export const CARD_CODE_MUTABLE_STATUSES = ['AVAILABLE', 'LOCKED', 'REDEEMED', 'INVALID'] as const