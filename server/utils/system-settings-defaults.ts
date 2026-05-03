export const SYSTEM_SETTINGS_DEFAULTS = {
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
  showBlacklistKeywords: false,
  hideStudentInfo: true,
  enableReplayRequests: false,
  enableCollaborativeSubmission: true,
  enableSubmissionRemarks: false,
  enableRequestTimeLimitation: false,
  forceBlockAllRequests: false,
  smtpEnabled: false,
  smtpHost: null,
  smtpPort: 587,
  smtpSecure: false,
  smtpUsername: null,
  smtpPassword: null,
  smtpFromEmail: null,
  smtpFromName: '校园广播站',
  allowOAuthRegistration: false,
  captchaEnabled: false, // 默认关闭图形验证码
  captchaMaxFailures: 3 //触发阈值
}

export const PUBLIC_SETTINGS_FIELDS = [
  'siteTitle',
  'siteLogoUrl',
  'schoolLogoHomeUrl',
  'schoolLogoPrintUrl',
  'siteDescription',
  'submissionGuidelines',
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
  'enableCollaborativeSubmission',
  'enableSubmissionRemarks',
  'enableRequestTimeLimitation',
  'forceBlockAllRequests',
  'smtpEnabled',
  'allowOAuthRegistration',
  'githubOAuthEnabled',
  'casdoorOAuthEnabled',
  'googleOAuthEnabled',
  'customOAuthEnabled',
  'customOAuthDisplayName'
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
