import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  SECRET_IDENTITY_PROVIDERS,
  isSecretIdentityProvider,
  maskIdentitySecret,
  maskIdentitiesSecrets
} from '../../server/utils/identity-secrets.ts'

// TOTP 共享密钥存放在 userIdentities.providerUserId，只允许在签发环节出服务端
const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8')

const OWN_IDENTITIES = read('../../server/api/auth/identities.get.ts')
const ADMIN_USERS_LIST = read('../../server/api/admin/users/index.get.ts')
const ADMIN_USER_DETAIL = read('../../server/api/admin/users/[id].get.ts')
const ADMIN_USERS_EXPORT = read('../../server/api/admin/users/export.get.ts')
const TOTP_GENERATE = read('../../server/api/user/2fa/generate.post.ts')
const TOTP_VERIFY = read('../../server/api/auth/2fa/verify.post.ts')

test('仅 TOTP 的 providerUserId 属于机密', () => {
  assert.deepEqual([...SECRET_IDENTITY_PROVIDERS], ['totp'])
  assert.equal(isSecretIdentityProvider('totp'), true)
  // WebAuthn 存凭证 ID，OAuth 存平台用户 ID，均需回传用于展示与头像解析
  assert.equal(isSecretIdentityProvider('webauthn'), false)
  assert.equal(isSecretIdentityProvider('github'), false)
  assert.equal(isSecretIdentityProvider('aggregate:qq'), false)
  assert.equal(isSecretIdentityProvider(undefined), false)
})

test('脱敏只清 providerUserId 并保留其余字段', () => {
  const totp = maskIdentitySecret({
    id: 7,
    provider: 'totp',
    providerUserId: 'JBSWY3DPEHPK3PXP',
    providerUsername: null,
    avatar: 'x',
    createdAt: '2026-10-30 10:00:00',
    isAvatarSource: false
  })
  assert.equal(totp.providerUserId, '')
  assert.equal(totp.id, 7)
  assert.equal(totp.provider, 'totp')
  assert.equal(totp.createdAt, '2026-10-30 10:00:00')

  const oauth = { id: 8, provider: 'github', providerUserId: '123456' }
  assert.equal(maskIdentitySecret(oauth), oauth)
})

test('批量脱敏处理混合列表与空值', () => {
  const masked = maskIdentitiesSecrets([
    { provider: 'totp', providerUserId: 'JBSWY3DPEHPK3PXP' },
    { provider: 'webauthn', providerUserId: 'credential-id' },
    { provider: 'google', providerUserId: '987' }
  ])
  assert.deepEqual(masked.map((item) => item.providerUserId), ['', 'credential-id', '987'])
  assert.deepEqual(maskIdentitiesSecrets(null), [])
  assert.deepEqual(maskIdentitiesSecrets(undefined), [])
  assert.deepEqual(maskIdentitiesSecrets([]), [])
})

test('身份出口全部脱敏，签发与校验链路不受影响', () => {
  for (const [name, source] of [
    ['auth/identities', OWN_IDENTITIES],
    ['admin/users 列表', ADMIN_USERS_LIST],
    ['admin/users 详情', ADMIN_USER_DETAIL]
  ] as const) {
    assert.match(source, /maskIdentitiesSecrets\(/, `${name} 未脱敏身份响应`)
  }
  // 导出接口本就不查询 providerUserId
  assert.doesNotMatch(ADMIN_USERS_EXPORT, /providerUserId/)
  // 扫码配对必须拿到密钥，不能被一并清掉
  assert.match(TOTP_GENERATE, /return \{ secret, qrCode \}/)
  // 校验链路读数据库原值，不经过响应脱敏
  assert.doesNotMatch(TOTP_VERIFY, /identity-secrets/)
})
