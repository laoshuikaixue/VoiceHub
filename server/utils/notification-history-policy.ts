export const NOTIFICATION_HISTORY_STATUSES = ['ALL', 'READ', 'UNREAD'] as const

export type NotificationHistoryStatus = (typeof NOTIFICATION_HISTORY_STATUSES)[number]

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
const LEGACY_GROUP_PATTERN = /^legacy-group-[0-9a-f]{32}$/

export const resolveNotificationBatchReference = (value: unknown) => {
  if (typeof value !== 'string') return null

  const normalized = value.trim()
  if (LEGACY_GROUP_PATTERN.test(normalized)) {
    return {
      batchId: normalized,
      notificationId: null
    }
  }

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
