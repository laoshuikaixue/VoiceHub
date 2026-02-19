import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { getWebAuthnChallenge, clearWebAuthnChallenge } from '~~/server/utils/webauthn-token'
import { getWebAuthnConfig } from '~~/server/utils/webauthn-config'
import { db, eq, and, userIdentities } from '~/drizzle/db'
import { createError, defineEventHandler, setCookie } from 'h3'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const challengeData = getWebAuthnChallenge(event)

  if (!challengeData) {
    throw createError({ statusCode: 400, message: 'Challenge 已失效' })
  }

  // 根据 credentialID 查找用户
  const credentialID = body.id
  if (!credentialID) {
    throw createError({ statusCode: 400, message: '缺少 Credential ID' })
  }

  const identity = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.provider, 'webauthn'), eq(userIdentities.providerUserId, credentialID)),
    with: { user: true }
  })

  if (!identity) {
    throw createError({ statusCode: 400, message: '未找到该 Passkey 关联的账号' })
  }

  // 检查用户状态
  if (identity.user.status !== 'active') {
    throw createError({ statusCode: 403, message: '账号已被禁用或注销' })
  }

  // 解析存储的 JSON 数据
  let credentialData
  try {
    credentialData = JSON.parse(identity.providerUsername)
  } catch {
    throw createError({ statusCode: 500, message: '凭证数据损坏' })
  }

  const { publicKey, counter } = credentialData
  
  // 检查 publicKey 是否存在
  if (!publicKey) {
     throw createError({ statusCode: 500, message: '凭证数据缺失 publicKey' })
  }

  const { rpID, origin } = getWebAuthnConfig(event)

  // 构造 WebAuthnCredential 对象
  // 注意：id 必须是 Base64URL 字符串，publicKey 必须是 Uint8Array
  const credential = {
    id: credentialID,
    publicKey: Buffer.from(publicKey, 'base64url'),
    counter: Number(counter || 0),
    transports: credentialData.transports
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential
    })

    if (verification.verified) {
      // 更新 counter
      const newCounter = verification.authenticationInfo.newCounter
      credentialData.counter = newCounter
      
      await db.update(userIdentities)
        .set({ providerUsername: JSON.stringify(credentialData) })
        .where(eq(userIdentities.id, identity.id))

      // 签发登录 Token
      const token = JWTEnhanced.generateToken(identity.user.id, identity.user.role)
      setCookie(event, 'auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      })

      clearWebAuthnChallenge(event)
      return { success: true, redirect: '/' }
    } else {
      throw createError({ statusCode: 400, message: '验证失败' })
    }
  } catch (error) {
    console.error('WebAuthn 登录验证失败:', error)
    throw createError({ statusCode: 400, message: error.message || '验证失败' })
  }
})
