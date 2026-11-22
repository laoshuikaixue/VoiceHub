import { defineEventHandler } from 'h3'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'

// 保留旧插件接口的错误提示；不读取聊天中提交的密码。
export default defineEventHandler(() => {
  throw createApiError(
    410,
    SERVER_ERROR_CODES.ASTRBOT_PASSWORD_RESET_WEB_REQUIRED,
    '不支持通过机器人重置密码，请前往 VoiceHub 登录页使用「忘记密码」'
  )
})
