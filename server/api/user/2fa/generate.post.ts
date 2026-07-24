import otplib from 'otplib'
const { authenticator } = otplib
import QRCode from 'qrcode'
import { db, userIdentities, eq, and } from '~/drizzle/db'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED_ACCESS', '未授权访问')
  }

  // 检查是否已开启2FA
  const existing = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, 'totp'))
  })

  if (existing) {
    throw createApiError(400, 'USER_2FA_ALREADY_ENABLED', '已开启双重认证')
  }

  const secret = authenticator.generateSecret()
  const otpauth = authenticator.keyuri(user.username, 'VoiceHub', secret)
  
  // 生成QR Code Data URL
  const qrCode = await QRCode.toDataURL(otpauth)

  return { secret, qrCode }
})
