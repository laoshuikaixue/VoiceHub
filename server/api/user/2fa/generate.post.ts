import otplib from 'otplib'
const { authenticator } = otplib
import QRCode from 'qrcode'
import { db, userIdentities, eq, and } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  // 检查是否已开启2FA
  const existing = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, 'totp'))
  })

  if (existing) {
    throw createError({ statusCode: 400, message: '已开启双重认证' })
  }

  const secret = authenticator.generateSecret()
  const otpauth = authenticator.keyuri(user.username, 'VoiceHub', secret)
  
  // 生成QR Code Data URL
  const qrCode = await QRCode.toDataURL(otpauth)

  return { secret, qrCode }
})
