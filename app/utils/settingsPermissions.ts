/**
 * 系统设置中涉及用户数据、外部凭据、站点展示与账号安全策略的字段：仅超级管理员可读写。
 *
 * 普通管理员可维护投稿与播放运营、限额、卡密、音源平台等配置；
 * 下列字段能改登录链路与凭据（SMTP/OAuth/验证码/机器人令牌）、
 * 影响用户隐私与账号安全策略（学生信息、注册与条款、遥测）、
 * 向所有页面注入脚本，或控制站点对外展示与文案，一律归超级管理员。
 *
 * 服务端 index.post.ts 用它拒绝越权写入，index.ts 用它裁剪响应；
 * 后台表单提交前调用 stripSuperAdminOnlySettingFields，避免整表单被 403 挡住。
 */
export const SUPER_ADMIN_ONLY_SETTING_FIELDS = [
  // SMTP：改写后可截获找回密码邮件
  'smtpEnabled',
  'smtpHost',
  'smtpPort',
  'smtpSecure',
  'smtpUsername',
  'smtpPassword',
  'smtpFromEmail',
  'smtpFromName',
  // OAuth 与聚合登录：端点或密钥被改写即可劫持第三方登录
  'oauthRedirectUri',
  'oauthStateSecret',
  'githubOAuthEnabled',
  'githubClientId',
  'githubClientSecret',
  'casdoorOAuthEnabled',
  'casdoorServerUrl',
  'casdoorClientId',
  'casdoorClientSecret',
  'casdoorOrganizationName',
  'googleOAuthEnabled',
  'googleClientId',
  'googleClientSecret',
  'aggregateOAuthEnabled',
  'aggregateOAuthAppId',
  'aggregateOAuthAppKey',
  'aggregateOAuthLoginType',
  'aggregateOAuthEndpoint',
  'customOAuthEnabled',
  'customOAuthDisplayName',
  'customOAuthAuthorizeUrl',
  'customOAuthTokenUrl',
  'customOAuthUserInfoUrl',
  'customOAuthScope',
  'customOAuthClientId',
  'customOAuthClientSecret',
  'customOAuthUserIdField',
  'customOAuthUsernameField',
  'customOAuthNameField',
  'customOAuthEmailField',
  'customOAuthAvatarField',
  'allowOAuthRegistration',
  'oauthRegisterRequiresApproval',
  // 人机验证：关闭或放宽阈值即可撞库
  'captchaEnabled',
  'captchaProvider',
  'captchaMaxFailures',
  'turnstileSiteKey',
  'turnstileSecretKey',
  'esaCaptchaPrefix',
  'esaCaptchaScenes',
  'esaCaptchaRegion',
  // AstrBot：令牌可重置任何已绑定账号密码，机器人地址决定通知投递目的地
  'astrbotEnabled',
  'astrbotToken',
  'astrbotBaseUrl',
  'astrbotPushMode',
  'astrbotBroadcastEnabled',
  'astrbotGroupTargets',
  'astrbotPlatforms',
  'astrbotWeeklyConfig',
  'astrbotGroupEvents',
  'astrbotGroupThrottle',
  // 站点展示与文案（与站点配置页同属超管维护范围）
  'siteTitle',
  'siteDescription',
  'siteLogoUrl',
  'schoolLogoHomeUrl',
  'schoolLogoPrintUrl',
  'icpNumber',
  'gonganNumber',
  'showBeianIcon',
  'submissionGuidelines',
  'showBlacklistKeywords',
  'submissionNoteRequiresApproval',
  // 全站统计代码与自定义 CSS：原样注入 SSR 页面
  'statisticsCode',
  'statisticsCodeEnabled',
  'customCss',
  'customCssEnabled',
  // 注册与口令策略
  'allowRegister',
  'registerRequiresApproval',
  'registerEmailRequired',
  'registerRequiresGradeClass',
  'forcePasswordChangeOnFirstLogin',
  // 学生隐私与匿名投稿
  'hideStudentInfo',
  'allowAnonymousSubmission',
  // 条款文档与版本
  'legalConsentEnabled',
  'legalConsentDisplayMode',
  'legalConsentDocuments',
  'legalConsentUpdatedDate',
  // 遥测外发开关
  'telemetryEnabled',
  // 站点主题
  'defaultTheme',
  'enabledThemes'
] as const

export type SuperAdminOnlySettingField = (typeof SUPER_ADMIN_ONLY_SETTING_FIELDS)[number]

const SUPER_ADMIN_ONLY_FIELD_SET: ReadonlySet<string> = new Set(SUPER_ADMIN_ONLY_SETTING_FIELDS)

/** 请求体中出现的超级管理员专属字段 */
export function findSuperAdminOnlySettingFields(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  return Object.keys(payload).filter((field) => SUPER_ADMIN_ONLY_FIELD_SET.has(field))
}

/** 剔除超级管理员专属字段，其余配置原样保留 */
export function stripSuperAdminOnlySettingFields<T extends Record<string, any>>(payload: T): T {
  if (!payload) return payload
  return Object.fromEntries(
    Object.entries(payload).filter(([field]) => !SUPER_ADMIN_ONLY_FIELD_SET.has(field))
  ) as T
}
