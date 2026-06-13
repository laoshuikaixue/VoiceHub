import {
  checkQqLogin,
  getQqCookieDiagnostic,
  getQqUserAvatar,
  normalizeQqCookie
} from '~~/server/utils/qq_music_sdk'

const getSessionCookie = (session: any) => {
  if (typeof session?.cookie === 'string') return session.cookie
  if (Array.isArray(session?.cookieList)) return session.cookieList.join('; ')
  return ''
}

const normalizeLoginStatus = (data: any) => {
  if (data?.isOk) return 'success'
  if (data?.refresh) return 'expired'
  return 'waiting'
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const ptqrtoken = body?.ptqrtoken
  const qrsig = String(body?.qrsig || '').trim()

  if (!ptqrtoken || !qrsig) {
    throw createError({ statusCode: 400, message: '缺少 ptqrtoken 或 qrsig 参数' })
  }

  try {
    const data: any = await checkQqLogin(ptqrtoken, qrsig)
    const session = data?.session || null
    const cookie = normalizeQqCookie(getSessionCookie(session))
    const cookieObject = session?.cookieObject || {}
    const uin = cookieObject.qqmusic_uin || session?.uin || session?.loginUin || cookieObject.uin || ''
    let avatarUrl = ''

    if (data?.isOk && uin) {
      try {
        const avatar = await getQqUserAvatar({ uin, size: 140 })
        avatarUrl = avatar?.avatarUrl || ''
      } catch (avatarError) {
        console.warn('[qq/check-login] 获取 QQ 头像失败:', avatarError)
      }
    }

    return {
      success: true,
      data: {
        ...data,
        status: normalizeLoginStatus(data),
        cookie: cookie || undefined,
        authDiagnostic: getQqCookieDiagnostic(cookie),
        user: data?.isOk
          ? {
              userId: uin,
              id: uin,
              nickname: uin ? `QQ ${uin}` : 'QQ音乐账号',
              userName: uin ? `QQ ${uin}` : 'QQ音乐账号',
              avatarUrl,
              raw: session
            }
          : undefined,
        session: session
          ? {
              ...session,
              cookie
            }
          : session
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: 502,
      message: error?.message || '检查 QQ 登录状态失败'
    })
  }
})
