import { getQqWxLoginQr } from '~~/server/utils/qq_music_sdk'

// 获取 QQ 音乐微信扫码登录二维码
export default defineEventHandler(async () => {
  try {
    return {
      success: true,
      data: await getQqWxLoginQr()
    }
  } catch (error: any) {
    throw createError({
      statusCode: 502,
      message: error?.message || '获取微信登录二维码失败'
    })
  }
})
