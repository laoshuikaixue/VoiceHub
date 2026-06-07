import { checkQqLogin } from '~~/server/utils/qq_music_sdk'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const ptqrtoken = body?.ptqrtoken
  const qrsig = String(body?.qrsig || '').trim()

  if (!ptqrtoken || !qrsig) {
    throw createError({ statusCode: 400, message: '缺少 ptqrtoken 或 qrsig 参数' })
  }

  try {
    return {
      success: true,
      data: await checkQqLogin(ptqrtoken, qrsig)
    }
  } catch (error: any) {
    throw createError({
      statusCode: 502,
      message: error?.message || '检查 QQ 登录状态失败'
    })
  }
})
