export const NOTIFICATION_TITLE_MAX_LENGTH = 200
export const NOTIFICATION_CONTENT_MAX_LENGTH = 20000

export type ImportantNotificationCandidate = {
  id: number
  createdAt: Date | string
  important: boolean
  read: boolean
}

export const shouldCheckImportantNotification = (
  authenticated: boolean,
  userId?: number | null,
  requirePasswordChange = false
): boolean =>
  authenticated && Number.isInteger(userId) && Number(userId) > 0 && !requirePasswordChange

export const canSendSystemNotification = (role?: string): boolean =>
  role === 'ADMIN' || role === 'SUPER_ADMIN'

export const resolveImportantFlag = (value: unknown): boolean | null => {
  if (value === undefined) return false
  return typeof value === 'boolean' ? value : null
}

export const shouldDeliverSystemNotification = (
  important: boolean,
  notificationsEnabled?: boolean
): boolean => important || notificationsEnabled !== false

export const selectNextImportantNotification = <T extends ImportantNotificationCandidate>(
  candidates: T[]
): T | null => {
  const pending = candidates.filter((candidate) => candidate.important && !candidate.read)

  pending.sort((left, right) => {
    const createdAtDifference =
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    return createdAtDifference || left.id - right.id
  })

  return pending[0] || null
}

export const createNotificationReadUpdate = (updatedAt = new Date()) => ({
  read: true as const,
  updatedAt
})
