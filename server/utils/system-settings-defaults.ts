import { MUSIC_SOURCE_PLATFORMS } from '~~/server/config/constants'
import { DEFAULT_ASTRBOT_GROUP_EVENTS, DEFAULT_ASTRBOT_GROUP_THROTTLE } from '~~/server/utils/astrbot-group'

export const normalizeScheduleVisibilitySettings = (settings) => {
  for (const field of [
    'scheduleDaysBeforeEnabled',
    'scheduleDaysBefore',
    'scheduleDaysAfterEnabled',
    'scheduleDaysAfter'
  ]) {
    if (Object.prototype.hasOwnProperty.call(settings, field) && settings[field] === null) {
      delete settings[field]
    }
  }
  return settings
}

export const SYSTEM_SETTINGS_DEFAULTS = {
  telemetryEnabled: true,
  enablePlayTimeSelection: false,
  siteTitle: 'VoiceHub',
  siteLogoUrl: '/favicon.ico',
  schoolLogoHomeUrl: null,
  schoolLogoPrintUrl: null,
  siteDescription: '校园广播站点歌系统 - 让你的声音被听见',
  submissionGuidelines: `1. 投稿时无需加入书名号
2. 除DJ外，其他类型歌曲均接收（包括小语种）
3. 禁止投递含有违规内容的歌曲
4. 点播的歌曲将由管理员进行审核
5. 审核通过后将安排在播放时段播出
6. 提交即表明我已阅读投稿须知并已知该歌曲有概率无法播出
7. 本系统仅提供音乐搜索和播放管理功能，不存储任何音乐文件。所有音乐内容均来自第三方音乐平台，版权归原平台及版权方所有。用户点歌时请确保遵守相关音乐平台的服务条款，尊重音乐作品版权。我们鼓励用户支持正版音乐，在官方平台购买和收听喜爱的音乐作品。
8. 最终解释权归广播站所有`,
  icpNumber: null,
  gonganNumber: null,
  showBeianIcon: false,
  enableSubmissionLimit: false,
  dailySubmissionLimit: null,
  weeklySubmissionLimit: null,
  monthlySubmissionLimit: null,
  scheduleDaysBeforeEnabled: false,
  scheduleDaysBefore: 1,
  scheduleDaysAfterEnabled: false,
  scheduleDaysAfter: 1,
  showBlacklistKeywords: false,
  hideStudentInfo: true,
  enableReplayRequests: false,
  enableCollaborativeSubmission: true,
  enableSubmissionRemarks: false,
  // 卡密点歌相关
  enableCardCodeRequests: false,
  requireCardCodeForRequests: false,
  enableCardCodeLimitBypass: false,
  // 重复投稿限制
  enableSubmissionRestriction: false,
  submissionRestrictionScope: 'all',
  sameSongRestrictionHours: null,
  sameArtistRestrictionHours: null,
  enableRequestTimeLimitation: false,
  forceBlockAllRequests: false,
  forcePasswordChangeOnFirstLogin: false,
  smtpEnabled: false,
  smtpHost: null,
  smtpPort: 587,
  smtpSecure: false,
  smtpUsername: null,
  smtpPassword: null,
  smtpFromEmail: null,
  smtpFromName: '校园广播站',
  astrbotEnabled: false,
  astrbotPlatforms: { qq: false, wecom: false, dingtalk: false, lark: false },
  astrbotBaseUrl: null,
  astrbotToken: null,
  astrbotBroadcastEnabled: false,
  // 群广播目标由管理员在后台维护：UMO 前缀是 AstrBot 平台实例 ID，无法推断适配器，
  // 因此每条目标显式记录所属平台与备注，投递时按平台开关逐个校验。
  astrbotGroupTargets: [] as Array<{ umo: string; platform: string; label: string }>,
  // 群事件开关：默认只开高频需求（新点歌投稿、注册待审核），其余按需开启。
  astrbotGroupEvents: DEFAULT_ASTRBOT_GROUP_EVENTS,
  // 防刷屏：同群同类型事件在窗口内合并为一条，并按单群频率上限节流。
  astrbotGroupThrottle: DEFAULT_ASTRBOT_GROUP_THROTTLE,
  astrbotPushMode: 'push',
  astrbotWeeklyConfig: { showCover: true, showSequence: true, showRequester: true, showVotes: false, showPlayTime: true, showDate: true },
  allowOAuthRegistration: false,
  allowRegister: false,
  registerRequiresApproval: true,
  oauthRegisterRequiresApproval: true,
  registerEmailRequired: false,
  registerRequiresGradeClass: false,
  submissionNoteRequiresApproval: false,
  captchaEnabled: false, // 默认关闭图形验证码
  captchaMaxFailures: 3, //触发阈值
  captchaProvider: 'graphic', // 默认使用图形验证码
  turnstileSiteKey: null,
  turnstileSecretKey: null,
  // 阿里云 ESA AI 验证码（身份标与场景 ID 均由 ESA 控制台生成，非机密信息）
  esaCaptchaPrefix: null,
  // 场景 ID 规则列表：[{ endpoint: 'login' | 'register', host: '*', sceneId }]
  esaCaptchaScenes: '[]',
  esaCaptchaRegion: 'cn',
  // 自动备份
  autoBackupEnabled: false,
  autoBackupConfig: null,
  // 站点统计代码（任意统计平台 HTML/JS 片段）
  statisticsCodeEnabled: false,
  statisticsCode: null,
  legalConsentEnabled: false,
  legalConsentDisplayMode: 'modal',
  legalConsentUpdatedDate: null,
  legalConsentDocuments: '[]',
  // 主题管理
  defaultTheme: 'System',
  enabledThemes: JSON.stringify(['System', 'ClassicDark', 'ClassicLight', 'ModernLight']),
  // 平台管理
  enabledPlatforms: JSON.stringify([...MUSIC_SOURCE_PLATFORMS]),
  platformOrder: JSON.stringify([...MUSIC_SOURCE_PLATFORMS]),
}

export const PUBLIC_SETTINGS_FIELDS = [
  'siteTitle',
  'siteLogoUrl',
  'schoolLogoHomeUrl',
  'schoolLogoPrintUrl',
  'siteDescription',
  'submissionGuidelines',
  'legalConsentEnabled',
  'legalConsentDisplayMode',
  'legalConsentUpdatedDate',
  'legalConsentDocuments',
  'icpNumber',
  'gonganNumber',
  'showBeianIcon',
  'enablePlayTimeSelection',
  'enableSubmissionLimit',
  'dailySubmissionLimit',
  'weeklySubmissionLimit',
  'monthlySubmissionLimit',
  'showBlacklistKeywords',
  'hideStudentInfo',
  'enableReplayRequests',
  'enableSubmissionRestriction',
  'enableCollaborativeSubmission',
  'enableSubmissionRemarks',
  'enableCardCodeRequests',
  'requireCardCodeForRequests',
  'enableCardCodeLimitBypass',
  'enableRequestTimeLimitation',
  'forceBlockAllRequests',
  'forcePasswordChangeOnFirstLogin',
  'smtpEnabled',
  'allowOAuthRegistration',
  'allowRegister',
  'registerRequiresApproval',
  'oauthRegisterRequiresApproval',
  'registerEmailRequired',
  'registerRequiresGradeClass',
  'submissionNoteRequiresApproval',
  'githubOAuthEnabled',
  'casdoorOAuthEnabled',
  'googleOAuthEnabled',
  'aggregateOAuthEnabled',
  'aggregateOAuthLoginType',
  'customOAuthEnabled',
  'customOAuthDisplayName',
  'captchaEnabled',
  'captchaMaxFailures',
  'captchaProvider',
  'turnstileSiteKey',
  'esaCaptchaPrefix',
  'esaCaptchaScenes',
  'esaCaptchaRegion',
  'enabledPlatforms',
  'platformOrder',
  'defaultTheme',
  'enabledThemes'
]

export const filterPublicSettings = (data: any) => {
  if (!data) {
    return {}
  }
  const result: Record<string, any> = {}
  for (const key of PUBLIC_SETTINGS_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      result[key] = data[key]
    }
  }
  return result
}

//为兼容旧代码，导出别名
export { SYSTEM_SETTINGS_DEFAULTS as defaultSystemSettings }
