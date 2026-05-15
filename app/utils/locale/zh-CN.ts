/**
 * 中文语言包 — 集中管理用户可见文本。
 * 后续如需多语言支持，可基于此结构扩展其他语言文件并接入 vue-i18n。
 */

export const siteConfig = {
  pageTitle: '站点配置',
  pageDescription: '管理站点全局属性、视觉识别、点歌逻辑及系统安全策略',
  reset: '重置',
  saving: '保存中...',
  saved: '已保存',
  saveConfig: '保存配置',
  loading: '加载配置中...',

  // 基础信息
  basicInfo: '基础信息',
  siteTitle: '站点标题',
  siteTitlePlaceholder: '请输入站点标题',
  icpNumber: '备案号 (ICP)',
  icpPlaceholder: '请输入备案号',
  gonganNumber: '公安联网备案号',
  gonganPlaceholder: '请输入公安备案号 (如：陕公网安备 61011302001964 号)',
  showBeianIcon: '显示备案图标',
  showBeianIconDesc: '在公安联网备案号前显示备案图标',
  siteDescription: '站点描述',
  siteDescriptionPlaceholder: '请输入站点描述',

  // 视觉识别
  visualIdentity: '视觉识别',
  siteLogoUrl: '站点 Logo URL',
  siteLogoPlaceholder: '请输入Logo图片URL',
  schoolLogoHome: '首页学校 Logo URL (大尺寸)',
  schoolLogoHomePlaceholder: '请输入首页学校Logo URL',
  schoolLogoPrint: '打印排期 Logo URL (小尺寸)',
  schoolLogoPrintPlaceholder: '请输入打印页学校Logo URL',

  // 投稿逻辑
  submissionLogic: '投稿逻辑设置',
  enableCollaborative: '启用联合投稿',
  enableCollaborativeDesc: '允许用户添加联合投稿人并发起协作投稿',
  enableRemarks: '启用投稿备注留言',
  enableRemarksDesc: '允许用户在投稿时附加公开或仅管理员可见的备注',
  enableReplay: '启用重播申请',
  enableReplayDesc: '允许用户对本学期已播放过的歌曲再次申请',
  enableLimit: '启用投稿限额',
  enableLimitDesc: '限制单个用户的点歌频率',
  dailyLimit: '每日限额',
  weeklyLimit: '每周限额',
  monthlyLimit: '每月限额',
  limitUnit: '首 / 人',

  // 安全与隐私
  securityPrivacy: '安全与隐私设置',
  captchaEnabled: '启用登录人机验证',
  captchaEnabledDesc: '开启后，可以有效防范暴力破解和机器人注册。',
  captchaType: '验证类型',
  captchaGraphic: '图形验证码',
  captchaTurnstile: 'Cloudflare Turnstile',
  captchaMaxFailures: '触发阈值（失败次数）',
  captchaMaxFailuresDesc: '连续密码错误达到此次数后，后续登录必须输入验证码。建议设置为 3-5 次。',
  turnstileSiteKey: 'Site Key (Sitekey)',
  turnstileSiteKeyPlaceholder: '在此输入 Turnstile 的 Site Key',
  turnstileSecretKey: 'Secret Key (Secret)',
  turnstileSecretKeyPlaceholder: '在此输入 Turnstile 的 Secret Key (留空表示不修改)',
  turnstileSecretKeyDesc: '开启 Turnstile 后，所有用户在每次登录时都需要进行安全验证。',
  forcePasswordChange: '首次登录强制改密',
  forcePasswordChangeDesc: '开启后，未修改过密码的用户在登录时将被强制跳转至改密页面，完成修改后方可使用系统。',
  showBlacklistKeywords: '显示黑名单具体关键词',
  showBlacklistKeywordsDesc: '开启后，在投稿命中黑名单时将明确提示冲突关键词；关闭则仅提示"包含关键词"。',
  hideStudentInfo: '隐藏学生详细信息',
  hideStudentInfoDesc: '开启后，非管理员用户在前端点歌列表、排期预览中将无法查看投稿学生的完整学号与真实姓名。',
  configWarning: '站点基础配置在保存后将立即对所有终端生效。请在修改关键业务逻辑（如投稿限额）前确保已知晓对现有用户的影响。',

  // 投稿须知
  submissionGuidelines: '投稿须知',
  guidelinesPlaceholder: '请输入投稿须知内容',

  // 提示消息
  loadFailed: '加载配置失败',
  saveFailed: '保存配置失败',
  saveFailedRetry: '保存配置失败，请重试',
  saveSuccess: '配置保存成功！',
  fetchFailed: '获取配置失败'
} as const

export const changePassword = {
  welcomeTitle: '欢迎使用VoiceHub',
  welcomeDesc: '为了保障您的账号安全，请设置一个新的密码',
  securityTitle: '账号安全',
  securityDesc: '定期更新密码有助于保护您的账号安全',
  tipsTitle: '密码安全建议',
  tipMinLength: '至少8个字符',
  tipCase: '包含大小写字母',
  tipSpecial: '包含数字和特殊字符',
  setNewPassword: '设置新密码',
  changePasswordTitle: '修改密码',
  setNewPasswordDesc: '请设置一个安全的密码',
  updatePasswordDesc: '更新您的登录密码',
  backToHome: '返回主页',
  cannotComplete: '无法完成密码修改？',
  forgotPassword: '忘记密码',
  logout: '退出登录',
  logoutConfirm: '确定要退出登录吗？退出后需要重新登录才能继续操作。'
} as const
