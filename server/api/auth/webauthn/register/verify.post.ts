import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { getWebAuthnChallenge, clearWebAuthnChallenge } from '~~/server/utils/webauthn-token'
import { getWebAuthnConfig } from '~~/server/utils/webauthn-config'
import { db, userIdentities } from '~/drizzle/db'

const VALID_TRANSPORTS = ['internal', 'hybrid', 'usb', 'nfc', 'ble']

function sanitizeTransports(transports: unknown): string[] {
  if (!Array.isArray(transports)) return []
  return transports.filter((t): t is string => 
    typeof t === 'string' && VALID_TRANSPORTS.includes(t)
  )
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  const body = await readBody(event)
  const challengeData = getWebAuthnChallenge(event)

  if (!challengeData || challengeData.userId !== user.id.toString()) {
    throw createError({ statusCode: 400, message: 'Challenge 已失效或不匹配' })
  }

  const { rpID, origin } = getWebAuthnConfig(event)

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo
      
      // 提取凭证数据
      const { id: credentialID, publicKey: credentialPublicKey, counter, transports } = credential

      if (!credentialID || !credentialPublicKey) {
        throw new Error('注册信息缺少凭证 ID 或公钥')
      }

      // 转换为 Base64URL 格式存储
      const credentialIDBase64 = credentialID
      const publicKeyBase64 = Buffer.from(credentialPublicKey).toString('base64url')

      if (!publicKeyBase64) {
        throw new Error('生成的公钥为空，注册失败')
      }

      // 构造凭证数据
      const credentialData = {
        label: body.label || 'WebAuthn 设备',
        publicKey: publicKeyBase64,
        counter: Number(counter),
        transports: sanitizeTransports(transports)
      }

      // 存储到数据库
      await db.insert(userIdentities).values({
        userId: user.id,
        provider: 'webauthn',
        providerUserId: credentialIDBase64,
        providerUsername: JSON.stringify(credentialData),
        createdAt: new Date()
      })

      clearWebAuthnChallenge(event)
      return { success: true }
    } else {
      throw createError({ statusCode: 400, message: '验证失败' })
    }
  } catch (error) {
    console.error('WebAuthn 验证失败:', error)
    const message = error instanceof Error ? error.message : '验证失败'
    throw createError({ statusCode: 400, message })
  }
})
