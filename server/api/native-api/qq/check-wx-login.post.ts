import {
  checkQqWxLogin,
  getQqCookieDiagnostic,
  normalizeQqCookie
} from '~~/server/utils/qq_music_sdk'

const getSessionCookie = (session: any) => {
  if (typeof session?.cookie === 'string') return session.cookie
  if (Array.isArray(session?.cookieList)) return session.cookieList.join('; ')
  return ''
}

const normalizeLoginStatus = (data: any) => {
  // 微信取消登录(refused)同样归入过期态，前端引导重新出码
  if (data?.isOk) return 'success'
  if (data?.refresh) return 'expired'
  return 'waiting'
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const uuid = String(body?.uuid || '').trim()

  if (!uuid) {
    throw createError({ statusCode: 400, message: '缺少 uuid 参数' })
  }

  try {
    const data: any = await checkQqWxLogin(uuid)
    const session = data?.session || null
    const cookie = normalizeQqCookie(getSessionCookie(session))
    const cookieObject = session?.cookieObject || {}
    const uin = cookieObject.qqmusic_uin || session?.uin || session?.loginUin || cookieObject.uin || ''

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
              nickname: `微信 ${String(uin).slice(-4)}`,
              userName: `微信 ${String(uin).slice(-4)}`,
              avatarUrl: '',
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
      message: error?.message || '检查微信登录状态失败'
    })
  }
})
