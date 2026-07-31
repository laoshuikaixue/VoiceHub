export const NOTIFICATION_HISTORY_STATUSES = ['ALL', 'READ', 'UNREAD'] as const

export type NotificationHistoryStatus = (typeof NOTIFICATION_HISTORY_STATUSES)[number]

export const NOTIFICATION_HISTORY_TYPES = ['ALL', 'IMPORTANT', 'NORMAL'] as const
export const NOTIFICATION_HISTORY_SORT_ORDERS = ['DESC', 'ASC'] as const
export const NOTIFICATION_HISTORY_KEYWORD_MAX_LENGTH = 100

export type NotificationHistoryType = (typeof NOTIFICATION_HISTORY_TYPES)[number]
export type NotificationHistorySortOrder = (typeof NOTIFICATION_HISTORY_SORT_ORDERS)[number]

export const resolveNotificationHistoryFilters = (values: {
  keyword?: unknown
  type?: unknown
  sender?: unknown
  sortOrder?: unknown
}): {
  keyword: string
  type: NotificationHistoryType
  senderId: number | null
  sortOrder: NotificationHistorySortOrder
} | null => {
  if (values.keyword !== undefined && typeof values.keyword !== 'string') return null

  const keyword = typeof values.keyword === 'string' ? values.keyword.trim() : ''
  if (keyword.length > NOTIFICATION_HISTORY_KEYWORD_MAX_LENGTH) return null

  if (values.type !== undefined && typeof values.type !== 'string') return null
  const type = typeof values.type === 'string' && values.type.trim()
    ? values.type.trim().toUpperCase()
    : 'ALL'
  if (!NOTIFICATION_HISTORY_TYPES.includes(type as NotificationHistoryType)) return null

  let senderId: number | null = null
  if (values.sender !== undefined && values.sender !== null && values.sender !== '') {
    if (typeof values.sender !== 'string') return null
    const parsedSenderId = Number(values.sender.trim())
    if (!Number.isInteger(parsedSenderId) || parsedSenderId <= 0) return null
    senderId = parsedSenderId
  }

  if (values.sortOrder !== undefined && typeof values.sortOrder !== 'string') return null
  const sortOrder = typeof values.sortOrder === 'string' && values.sortOrder.trim()
    ? values.sortOrder.trim().toUpperCase()
    : 'DESC'
  if (!NOTIFICATION_HISTORY_SORT_ORDERS.includes(sortOrder as NotificationHistorySortOrder)) {
    return null
  }

  return {
    keyword,
    type: type as NotificationHistoryType,
    senderId,
    sortOrder: sortOrder as NotificationHistorySortOrder
  }
}

export const resolveNotificationHistoryStatus = (
  value: unknown
): NotificationHistoryStatus | null => {
  if (value === undefined || value === null || value === '') return 'ALL'
  if (typeof value !== 'string') return null

  const normalized = value.trim().toUpperCase()
  return NOTIFICATION_HISTORY_STATUSES.includes(normalized as NotificationHistoryStatus)
    ? (normalized as NotificationHistoryStatus)
    : null
}

export const resolveNotificationHistoryPagination = (
  pageValue: unknown,
  limitValue: unknown
) => {
  const parsedPage = Number(pageValue)
  const parsedLimit = Number(limitValue)
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20

  return {
    page,
    limit,
    offset: (page - 1) * limit
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LEGACY_BATCH_PATTERN = /^legacy-([1-9]\d*)$/

export const resolveNotificationBatchReference = (value: unknown) => {
  if (typeof value !== 'string') return null

  const normalized = value.trim()
  const legacyMatch = normalized.match(LEGACY_BATCH_PATTERN)
  if (legacyMatch) {
    return {
      batchId: null,
      notificationId: Number(legacyMatch[1])
    }
  }

  if (!UUID_PATTERN.test(normalized)) return null

  return {
    batchId: normalized.toLowerCase(),
    notificationId: null
  }
}
