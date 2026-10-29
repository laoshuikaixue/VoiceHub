/**
 * 身份记录（userIdentities）响应脱敏。
 *
 * TOTP 的共享密钥存放在 providerUserId 列，属于第二因子种子：
 * 一旦进入响应即可被克隆，因此除签发环节（2FA 开启时返回一次供扫码）外，
 * 任何身份列表都不回传。WebAuthn 的 providerUserId 是凭证 ID（公开标识符），
 * OAuth 的是平台用户 ID，均正常返回。
 */
export const SECRET_IDENTITY_PROVIDERS: readonly string[] = ['totp']

export type IdentityWithSecretField = {
  provider: string
  providerUserId?: unknown
}

export function isSecretIdentityProvider(provider: unknown): boolean {
  return typeof provider === 'string' && SECRET_IDENTITY_PROVIDERS.includes(provider)
}

/** 清除单条身份的机密 providerUserId；数据库比对与头像解析须在调用本函数前完成 */
export function maskIdentitySecret<T extends IdentityWithSecretField>(identity: T): T {
  if (!identity || !isSecretIdentityProvider(identity.provider)) return identity
  return { ...identity, providerUserId: '' } as T
}

/** 批量清除身份列表中的机密 providerUserId，缺省视为空列表 */
export function maskIdentitiesSecrets<T extends IdentityWithSecretField>(
  identities: readonly T[] | null | undefined
): T[] {
  return (identities ?? []).map((identity) => maskIdentitySecret(identity))
}
