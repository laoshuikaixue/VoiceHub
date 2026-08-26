// 微信/QQ 内置浏览器账号密码登录后的绑定引导，仅保存在当前浏览器
const PENDING_KEY = 'voicehub:oauth-bind-reminder-pending'
const DISMISSED_KEY = 'voicehub:oauth-bind-reminder-dismissed'

const getBrowserStorage = () =>
  import.meta.client && typeof window !== 'undefined' ? window.localStorage : null

export const useOAuthBindReminder = () => {
  const markPasswordLogin = () => {
    getBrowserStorage()?.setItem(PENDING_KEY, '1')
  }

  const hasPendingPasswordLogin = () => getBrowserStorage()?.getItem(PENDING_KEY) === '1'

  const clearPending = () => {
    getBrowserStorage()?.removeItem(PENDING_KEY)
  }

  const isDismissed = () => getBrowserStorage()?.getItem(DISMISSED_KEY) === '1'

  const dismissForever = () => {
    const storage = getBrowserStorage()
    storage?.setItem(DISMISSED_KEY, '1')
    storage?.removeItem(PENDING_KEY)
  }

  return {
    markPasswordLogin,
    hasPendingPasswordLogin,
    clearPending,
    isDismissed,
    dismissForever
  }
}
