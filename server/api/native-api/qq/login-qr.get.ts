import { getQqLoginQr } from '~~/server/utils/qq_music_sdk'

export default defineEventHandler(async () => {
  try {
    return {
      success: true,
      data: await getQqLoginQr()
    }
  } catch (error: any) {
    throw createError({
      statusCode: 502,
      message: error?.message || '获取 QQ 登录二维码失败'
    })
  }
})
