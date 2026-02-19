/**
 * 音源配置文件
 * 定义音源接口、配置和默认设置
 */

/**
 * 音源接口定义
 */
export interface MusicSource {
  /** 音源唯一标识 */
  id: string
  /** 音源显示名称 */
  name: string
  /** API基础URL */
  baseUrl: string
  /** 优先级，数字越小优先级越高 */
  priority: number
  /** 是否启用 */
  enabled: boolean
  /** 请求超时时间（毫秒），可选 */
  timeout?: number
  /** 自定义请求头，可选 */
  headers?: Record<string, string>
}

/**
 * 音源配置接口
 */
export interface MusicSourceConfig {
  /** 主音源ID */
  primarySource: string
  /** 是否启用故障转移 */
  enableFailover: boolean
  /** 音源列表 */
  sources: MusicSource[]
  /** 默认超时时间（毫秒） */
  timeout: number
  /** 重试次数 */
  retryAttempts: number
}

/**
 * 音源状态接口
 */
export interface SourceStatus {
  /** 状态：在线、离线、错误 */
  status: 'online' | 'offline' | 'error'
  /** 响应时间（毫秒） */
  responseTime?: number
  /** 最后检查时间 */
  lastCheck: Date
  /** 错误信息 */
  errorMessage?: string
}

/**
 * 音乐搜索参数接口
 */
export interface MusicSearchParams {
  /** 搜索关键词 */
  keywords: string
  /** 音乐平台：tencent=QQ音乐, netease=网易云音乐 */
  platform?: string
  /** 返回数量限制 */
  limit?: number
  /** 偏移量 */
  offset?: number
  /** 搜索类型：1=单曲, 10=专辑, 100=歌手, 1000=歌单, 1009=播客/电台, 2000=声音 */
  type?: number
  /** 网易云音乐Cookie */
  cookie?: string
}

/**
 * 音乐搜索结果接口
 */
export interface MusicSearchResult {
  /** 是否成功 */
  success: boolean
  /** 使用的音源ID */
  source: string
  /** 搜索结果数据 */
  data: any[]
  /** 错误信息 */
  error?: string
}

/**
 * 歌曲详情参数接口
 */
export interface SongDetailParams {
  /** 歌曲ID，可以是单个或多个 */
  ids: string | string[]
}

/**
 * 歌曲详情结果接口
 */
export interface SongDetailResult {
  /** 是否成功 */
  success: boolean
  /** 使用的音源ID */
  source: string
  /** 歌曲详情数据 */
  data: {
    songs: any[]
  }
  /** 错误信息 */
  error?: string
}

/**
 * 默认音源配置
 * 包含主音源 Vkeys 和两个网易云备用音源端点
 */
export const MUSIC_SOURCE_CONFIG: MusicSourceConfig = {
  primarySource: 'netease-backup-1',
  enableFailover: true,
  timeout: 10000,
  retryAttempts: 2,
  sources: [
    {
      id: 'netease-backup-1',
      name: 'NeteaseCloudMusicApi',
      baseUrl: 'https://api.voicehub.lao-shui.top:443',
      priority: 1,
      enabled: true,
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    },
    {
      id: 'vkeys-v3',
      name: 'Vkeys音源 (v3)',
      baseUrl: 'https://api.vkeys.cn/music',
      priority: 2,
      enabled: true,
      timeout: 10000
    },
    {
      id: 'vkeys',
      name: 'Vkeys音源',
      baseUrl: 'https://api.vkeys.cn/v2/music',
      priority: 3,
      enabled: true,
      timeout: 10000
    },
    {
      id: 'netease-backup-2',
      name: '网易云备用源2',
      baseUrl: 'https://ncmapi.zcy.life:443',
      priority: 4,
      enabled: true,
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    },
    {
      id: 'meting-1',
      name: 'Meting API 备用源1',
      baseUrl: 'https://api.qijieya.cn/meting',
      priority: 5,
      enabled: true,
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    },
    {
      id: 'meting-2',
      name: 'Meting API 备用源2',
      baseUrl: 'https://api.obdo.cc/meting',
      priority: 6,
      enabled: true,
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    },
    {
      id: 'bilibili',
      name: '哔哩哔哩',
      baseUrl: 'https://api.bilibili.com',
      priority: 7,
      enabled: true,
      timeout: 10000
    }
  ]
}

/**
 * 获取启用的音源列表（按优先级排序）
 */
export function getEnabledSources(): MusicSource[] {
  return MUSIC_SOURCE_CONFIG.sources
    .filter((source) => source.enabled)
    .sort((a, b) => a.priority - b.priority)
}

/**
 * 根据ID获取音源
 */
export function getSourceById(id: string): MusicSource | undefined {
  return MUSIC_SOURCE_CONFIG.sources.find((source) => source.id === id)
}

/**
 * 获取主音源
 */
export function getPrimarySource(): MusicSource | undefined {
  return getSourceById(MUSIC_SOURCE_CONFIG.primarySource)
}

/**
 * 获取备用音源列表
 */
export function getBackupSources(): MusicSource[] {
  return getEnabledSources().filter((source) => source.id !== MUSIC_SOURCE_CONFIG.primarySource)
}
