import { checkQqCookie } from '~~/server/utils/qq_music_sdk'

// 校验 QQ 音乐登录 Cookie 是否有效；无效时前端据此清理本地登录态
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const cookie = String(body?.cookie || '').trim()

  if (!cookie) {
    throw createError({ statusCode: 400, message: '缺少 cookie 参数' })
  }

  try {
    const result = await checkQqCookie({ cookie })

    return {
      success: true,
      data: {
        valid: result.valid,
        isVip: result.isVip,
        signals: result.signals,
        user: result.profile
          ? {
              userId: result.profile.userId,
              id: result.profile.userId,
              nickname: result.profile.nickname,
              userName: result.profile.nickname,
              avatarUrl: result.profile.avatarUrl
            }
          : undefined,
        authDiagnostic: result.authDiagnostic
      }
    }
  } catch (error: any) {
    // 网络等异常不属于「登录失效」，向上抛错让前端保留本地状态
    console.warn('[qq/check-cookie] 校验 QQ 登录态失败:', error?.message || error)
    throw createError({
      statusCode: 502,
      message: error?.message || '校验 QQ 登录状态失败'
    })
  }
})
