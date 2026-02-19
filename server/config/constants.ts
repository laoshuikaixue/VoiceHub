/**
 * 系统常量配置文件
 * 消除魔法数字，提供统一的配置管理
 */

// API Key 相关常量
export const API_KEY_CONSTANTS = {
  // API Key 格式
  PREFIX: 'vhub_',
  TOTAL_LENGTH: 37,
  PREFIX_LENGTH: 10,

  // 数据库字段长度
  NAME_MAX_LENGTH: 255,
  KEY_HASH_MAX_LENGTH: 255,
  PREFIX_MAX_LENGTH: 10,
  PERMISSION_MAX_LENGTH: 100,
  ENDPOINT_MAX_LENGTH: 500,
  METHOD_MAX_LENGTH: 10,

  // 默认值
  DEFAULT_USAGE_COUNT: 0,
  DEFAULT_IS_ACTIVE: true
} as const

// HTTP 状态码常量
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const

// API 错误码常量
export const API_ERROR_CODES = {
  MISSING_API_KEY: 'MISSING_API_KEY',
  INVALID_API_KEY: 'INVALID_API_KEY',
  INVALID_API_KEY_FORMAT: 'INVALID_API_KEY_FORMAT',
  API_KEY_DISABLED: 'API_KEY_DISABLED',
  API_KEY_EXPIRED: 'API_KEY_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const

// API 错误消息常量
export const API_ERROR_MESSAGES = {
  [API_ERROR_CODES.MISSING_API_KEY]:
    'API Key is required. Please provide a valid API Key in the X-API-Key header.',
  [API_ERROR_CODES.INVALID_API_KEY]: 'Invalid API Key',
  [API_ERROR_CODES.INVALID_API_KEY_FORMAT]: 'Invalid API Key format',
  [API_ERROR_CODES.API_KEY_DISABLED]: 'API Key is disabled',
  [API_ERROR_CODES.API_KEY_EXPIRED]: 'API Key has expired',
  [API_ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions',
  [API_ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [API_ERROR_CODES.INVALID_PARAMETERS]: 'Invalid parameters',
  [API_ERROR_CODES.INTERNAL_ERROR]: 'Internal server error'
} as const

// 分页常量
export const PAGINATION_CONSTANTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1
} as const

// 日志相关常量
export const LOG_CONSTANTS = {
  MAX_RESPONSE_BODY_LENGTH: 10000, // 最大响应体长度
  LOG_LEVEL: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
  } as const,
  // 日志轮转和归档配置
  LOG_DIR: 'logs',
  ARCHIVE_DIR: 'logs/archive',
  RETENTION_DAYS: 30, // 日志文件保留天数
  ARCHIVE_AFTER_DAYS: 7, // 多少天后归档
  DB_RETENTION_DAYS: 90, // 数据库日志保留天数
  MAX_LOG_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  ROTATION_INTERVAL: 24 * 60 * 60 * 1000 // 24小时轮转间隔
} as const

// 缓存相关常量
export const CACHE_CONSTANTS = {
  DEFAULT_TTL: 180, // 3分钟
  LONG_TTL: 3600, // 1小时
  SHORT_TTL: 60, // 1分钟
  MAX_RESPONSE_BODY_LENGTH: 10000, // 最大响应体长度
  CACHE_KEY_PREFIX: {
    OPEN_API: 'open:',
    SONGS: 'songs:',
    SCHEDULES: 'schedules:',
    USERS: 'users:'
  }
} as const

// 通知设置默认值常量
export const NOTIFICATION_DEFAULTS = {
  ENABLED: true,
  SONG_REQUEST_ENABLED: true,
  SONG_VOTED_ENABLED: true,
  SONG_PLAYED_ENABLED: true,
  REFRESH_INTERVAL: 60,
  SONG_VOTED_THRESHOLD: 1
} as const

// 系统设置默认值常量
export const SYSTEM_DEFAULTS = {
  ENABLE_PLAY_TIME_SELECTION: false,
  ENABLE_SUBMISSION_LIMIT: false,
  SHOW_BLACKLIST_KEYWORDS: false,
  HIDE_STUDENT_INFO: true,
  IS_ACTIVE: false
} as const

// 排序相关常量
export const SORT_CONSTANTS = {
  DEFAULT_SORT_BY: 'createdAt',
  DEFAULT_SORT_ORDER: 'desc',
  VALID_SORT_ORDERS: ['asc', 'desc'] as const,

  // 排期排序字段
  SCHEDULE_SORT_FIELDS: ['playDate', 'createdAt'] as const,

  // 歌曲排序字段
  SONG_SORT_FIELDS: ['createdAt', 'title', 'artist', 'playedAt', 'votes'] as const
} as const

// 权限常量
export const PERMISSIONS = {
  SCHEDULES_READ: 'schedules:read',
  SONGS_READ: 'songs:read',
  ADMIN_ACCESS: 'admin:access'
} as const

// 用户角色常量
export const USER_ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN'
} as const

// 黑名单类型常量
export const BLACKLIST_TYPES = {
  SONG: 'SONG',
  KEYWORD: 'KEYWORD'
} as const

// 音乐平台常量
export const MUSIC_PLATFORMS = {
  NETEASE: 'netease',
  TENCENT: 'tencent',
  KUGOU: 'kugou',
  KUWO: 'kuwo'
} as const

export const RISK_CONTROL_CONSTANTS = {
  IP_SWITCH_WINDOW_MS: 5 * 60 * 1000,
  IP_SWITCH_THRESHOLD: 3,
  IP_SWITCH_BLOCK_MINUTES: 10,
  USER_BLOCK_MINUTES: 10,
  SONG_VOTE_PROTECT_WINDOW_MS: 60 * 60 * 1000,
  SONG_VOTE_PROTECT_THRESHOLD: 10,
  SONG_VOTE_PROTECT_DURATION_MS: 10 * 60 * 1000,
  USER_BASELINE_MIN_PER_MIN: 0.5,
  USER_BASELINE_MULTIPLIER: 3,
  EMA_ALPHA: 0.2,
  SONG_IP_DOMINANCE_PERCENT: 0.6,
  SONG_IP_MIN_SAMPLE: 8
} as const
