export interface User {
  id: number
  username: string
  name: string | null
  grade?: string | null
  class?: string | null
  role: 'USER' | 'ADMIN'
  lastLoginAt?: Date | null
  lastLoginIp?: string | null
}

export interface Song {
  id: number
  title: string
  artist: string
  requester: string
  requesterId?: number
  voteCount: number
  played: boolean
  playedAt: string | null
  semester: string | null
  createdAt: string
  voted?: boolean
}

export interface Schedule {
  id: number
  playDate: string
  song: {
    id: number
    title: string
    artist: string
    requester: string
    voteCount: number
    played?: boolean
  }
}

export type NotificationType = 'SONG_SELECTED' | 'SONG_PLAYED' | 'SONG_VOTED' | 'SYSTEM_NOTICE'

export interface Notification {
  id: number
  createdAt: string
  userId: number
  type: NotificationType
  title: string
  content: string
  relatedId?: number | null
  read: boolean
  readAt: string | null
}

// 前端使用的通知设置接口
export interface NotificationSettings {
  id: number
  userId: number
  songSelectedNotify: boolean
  songPlayedNotify: boolean
  songVotedNotify: boolean
  systemNotify: boolean
  refreshInterval: number
  songVotedThreshold: number
}

// 数据库中的通知设置接口
export interface DBNotificationSettings {
  id: number
  userId: number
  enabled: boolean
  songRequestEnabled: boolean
  songVotedEnabled: boolean
  songPlayedEnabled: boolean
  refreshInterval: number
  songVotedThreshold: number
} 