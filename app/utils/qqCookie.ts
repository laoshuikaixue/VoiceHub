// QQ 音乐登录 Cookie 的本地存取封装
export const QQ_MUSIC_COOKIE_KEY = 'qq_music_cookie'

/** 服务端续期 Cookie 后的广播事件名，供持有内存副本的页面同步 */
export const QQ_MUSIC_COOKIE_EVENT = 'qq-music-cookie-updated'

/**
 * 落盘服务端续期后的 Cookie 并广播变更
 * @returns 是否实际替换了本地登录态（Cookie 为空或与当前一致时为 false）
 */
export const persistQqMusicCookie = (cookie?: string): boolean => {
  if (!import.meta.client || !cookie) return false
  if (localStorage.getItem(QQ_MUSIC_COOKIE_KEY) === cookie) return false

  localStorage.setItem(QQ_MUSIC_COOKIE_KEY, cookie)
  window.dispatchEvent(new CustomEvent(QQ_MUSIC_COOKIE_EVENT, { detail: { cookie } }))
  return true
}

/** 订阅 Cookie 续期事件，返回取消订阅函数 */
export const onQqMusicCookieUpdated = (handler: (cookie: string) => void): (() => void) => {
  if (!import.meta.client) return () => {}

  const listener = (event: Event) => {
    const cookie = (event as CustomEvent<{ cookie?: string }>).detail?.cookie
    if (cookie) handler(cookie)
  }
  window.addEventListener(QQ_MUSIC_COOKIE_EVENT, listener)
  return () => window.removeEventListener(QQ_MUSIC_COOKIE_EVENT, listener)
}
