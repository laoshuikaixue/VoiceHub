/**
 * 用户角色联合类型。
 * 与 `shared/auth-constants.ts` 中的 `ADMIN_ROLES` 保持同步：
 * - 'USER' 普通用户
 * - 'ADMIN' 普通管理员
 * - 'SUPER_ADMIN' 超级管理员
 * - 'SONG_ADMIN' 歌曲管理员
 * 新增/移除角色时必须同时更新 `ADMIN_ROLES` 与本类型。
 */
export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'SONG_ADMIN'

export interface User {
  id: number
  username: string
  name: string | null
  grade?: string | null
  class?: string | null
  role: UserRole
  lastLoginAt?: Date | null
  lastLoginIp?: string | null
  forcePasswordChange?: boolean
  passwordChangedAt?: string | null
  requirePasswordChange?: boolean
  hasSetPassword?: boolean
  avatar?: string | null
  has2FA?: boolean
  email?: string | null
  emailVerified?: boolean
  identities?: Array<{
    provider: string
    providerUsername?: string | null
    providerUserId?: string | null
  }>
  /**
   * 标记该 User 对象是否包含完整的 profile 数据（has2FA、avatar、identities 等）。
   * SSR 中间件仅填充核心字段时不设置此标志（默认 undefined/false），
   * 客户端 initAuth 通过 /api/auth/verify 获取完整数据后设为 true。
   */
  _isFullProfile?: boolean
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
  preferredPlayTimeId?: number | null
  preferredPlayTime?: PlayTime | null
  cover?: string | null // 音乐封面URL
  musicPlatform?: string | null // 音乐平台（netease, tencent等）
  musicId?: string | null // 平台上的歌曲ID
  playUrl?: string | null // 播放地址URL
  requesterGrade?: string | null
  requesterClass?: string | null
  hasSubmissionNote?: boolean
  submissionNote?: string | null
  submissionNotePublic?: boolean
  createdAt: string
  voted?: boolean
  scheduled?: boolean // 是否已排期
  scheduleDate?: string // 排期日期
  schedulePlayed?: boolean // 排期中的播放状态
}

export interface Schedule {
  id: number
  playDate: string
  playTimeId?: number | null
  playTime?: PlayTime | null
  song: {
    id: number
    title: string
    artist: string
    requester: string
    requesterGrade?: string | null
    requesterClass?: string | null
    voteCount: number
    played?: boolean
    cover?: string | null
    musicPlatform?: string | null
    musicId?: string | null
    playUrl?: string | null
  }
}

export type NotificationType = 'SONG_SELECTED' | 'SONG_PLAYED' | 'SONG_VOTED' | 'SYSTEM_NOTICE'

export interface Notification {
  id: number
  createdAt: string
  updatedAt: string
  userId: number
  type: string
  message: string
  songId?: number | null
  read: boolean
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
  meowUserId?: string
  userEmail?: string
  emailVerified?: boolean
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

// 播出时段接口
export interface PlayTime {
  id: number
  name: string // 时段名称，如"上午"、"下午"
  startTime?: string // 开始时间，格式为"HH:MM"，可选
  endTime?: string // 结束时间，格式为"HH:MM"，可选
  enabled: boolean // 是否启用
  description?: string // 描述，可选
}

// 学期接口
export interface Semester {
  id: number
  name: string // 学期名称
  isActive: boolean // 是否为当前活跃学期
}

// 系统设置接口
export interface SystemSettings {
  id: number
  enablePlayTimeSelection: boolean
  enableRequestTimeLimitation?: boolean
  forceBlockAllRequests?: boolean
  enableReplayRequests?: boolean
  enableCollaborativeSubmission?: boolean
  enableSubmissionRemarks?: boolean
}

export interface RequestTime {
  id: number
  createdAt: string
  updatedAt: string
  name: string
  startTime: string
  endTime: string
  enabled: boolean
  description?: string | null
  expected: number
  accepted: number
  past: boolean
}
