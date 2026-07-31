export const NOTIFICATION_TITLE_MAX_LENGTH = 200
export const NOTIFICATION_CONTENT_MAX_LENGTH = 20000
export const NOTIFICATION_SOURCES = {
  SYSTEM: 'SYSTEM',
  ADMIN_MANUAL: 'ADMIN_MANUAL'
} as const

export type NotificationSenderInput = {
  id: number
  name?: string | null
  username?: string | null
}

export type NotificationSenderSnapshot = {
  senderId: number | null
  senderName: string | null
  senderUsername: string | null
}

export const resolveNotificationSource = (sender: NotificationSenderInput | null) =>
  sender ? NOTIFICATION_SOURCES.ADMIN_MANUAL : NOTIFICATION_SOURCES.SYSTEM

export const createNotificationSenderSnapshot = (
  sender: NotificationSenderInput | null = null
): NotificationSenderSnapshot => ({
  senderId: sender?.id ?? null,
  senderName: sender?.name?.trim() || null,
  senderUsername: sender?.username?.trim() || null
})

export const serializeNotificationSender = (snapshot: NotificationSenderSnapshot) =>
  snapshot.senderId
    ? {
        id: snapshot.senderId,
        name: snapshot.senderName,
        username: snapshot.senderUsername
      }
    : null

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

export const shouldRetainNotificationHistory = (type: string, source: string): boolean =>
  type === 'SYSTEM_NOTICE' && source === NOTIFICATION_SOURCES.ADMIN_MANUAL

export const createNotificationReadUpdate = (updatedAt = new Date()) => ({
  read: true as const,
  updatedAt
})

export const createNotificationUserDeleteUpdate = (updatedAt = new Date()) => ({
  userDeleted: true as const,
  read: true as const,
  updatedAt
})
