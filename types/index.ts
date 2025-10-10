export interface User {
    id: number
    username: string
    name: string | null
    grade?: string | null
    class?: string | null
    role: 'USER' | 'ADMIN'
    lastLoginAt?: Date | null
    lastLoginIp?: string | null
    forcePasswordChange?: boolean
    passwordChangedAt?: Date | null
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
    cover?: string | null        // 音乐封面URL
    musicPlatform?: string | null // 音乐平台（netease, tencent等）
    musicId?: string | null      // 平台上的歌曲ID
    playUrl?: string | null      // 播放地址URL
    createdAt: string
    voted?: boolean
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
    name: string        // 时段名称，如"上午"、"下午"
    startTime?: string  // 开始时间，格式为"HH:MM"，可选
    endTime?: string    // 结束时间，格式为"HH:MM"，可选
    enabled: boolean    // 是否启用
    description?: string // 描述，可选
}

// 学期接口
export interface Semester {
    id: number
    name: string        // 学期名称
    isActive: boolean   // 是否为当前活跃学期
}

// 系统设置接口
export interface SystemSettings {
    id: number
    enablePlayTimeSelection: boolean // 是否启用播出时段选择功能
}

export interface RequestTime {
    id: number
    name: string        // 时段名称，如"上午"、"下午"
    startTime?: string  // 开始时间，格式为"HH:MM"，可选
    endTime?: string    // 结束时间，格式为"HH:MM"，可选
    enabled: boolean    // 是否启用
    description?: string // 描述，可选
    expected: number,
    accepted: number,
    past: boolean,
}
