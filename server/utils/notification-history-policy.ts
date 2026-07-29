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
