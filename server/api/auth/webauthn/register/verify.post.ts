import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { getWebAuthnChallenge, clearWebAuthnChallenge } from '~~/server/utils/webauthn-token'
import { getWebAuthnConfig } from '~~/server/utils/webauthn-config'
import { db, eq, and, userIdentities } from '~/drizzle/db'
import { isoBase64URL } from '@simplewebauthn/server/helpers'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  const body = await readBody(event)
  const challengeData = getWebAuthnChallenge(event)

  if (!challengeData || challengeData.userId !== user.id) {
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
      
      // 适配新版 @simplewebauthn/server 返回结构
      // credential.id 是 Base64URL 字符串
      // credential.publicKey 是 Uint8Array
      const { id: credentialID, publicKey: credentialPublicKey, counter, transports } = credential

      if (!credentialID || !credentialPublicKey) {
        throw new Error('Registration info missing credentialID or credentialPublicKey')
      }

      // credentialID 已经是 Base64URL 字符串
      const credentialIDBase64 = credentialID
      const publicKeyBase64 = Buffer.from(credentialPublicKey).toString('base64url')

      if (!publicKeyBase64) {
        throw new Error('生成的公钥为空，注册失败')
      }

      // 存储 WebAuthn 凭证
      // provider: 'webauthn'
      // providerUserId: Credential ID (Unique)
      // providerUsername: JSON 包含 { label, publicKey, counter, transports }
      
      const credentialData = {
        label: body.label || 'WebAuthn 设备',
        publicKey: publicKeyBase64,
        counter: Number(counter), // 确保存储为数字
        transports: transports || []
      }

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
    throw createError({ statusCode: 400, message: error.message || '验证失败' })
  }
})
