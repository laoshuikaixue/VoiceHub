import { defineEventHandler, getQuery } from 'h3'
import { eq } from 'drizzle-orm'
import { db, browserFingerprints } from '~/drizzle/db'
import { hashFingerprint, isValidFingerprint } from '~~/server/utils/fingerprint'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { getClientIP } from '~~/server/utils/ip-utils'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'

// 单 IP 预检频率限制，防止利用本接口探测绑定关系
const PRECHECK_LIMIT = 120
const PRECHECK_WINDOW_MS = 10 * 60 * 1000

// 登录页预检：当前浏览器是否已绑定指纹登录（匿名可达，仅返回布尔与掩码用户名）
export default defineEventHandler(async (event) => {
  const clientIp = getClientIP(event)
  const limitResult = await checkDistributedRateLimit(
    `fingerprint_precheck:${clientIp}`,
    PRECHECK_LIMIT,
    PRECHECK_WINDOW_MS
  )
  if (!limitResult.isAllowed) {
    return { available: false }
  }

  const settings = await getSystemSettingsCached()
  if (!settings?.fingerprintLoginEnabled) {
    return { available: false }
  }

  const query = getQuery(event)
  const fingerprint = typeof query.fingerprint === 'string' ? query.fingerprint : ''
  if (!isValidFingerprint(fingerprint)) {
    return { available: false }
  }

  const binding = await db.query.browserFingerprints.findFirst({
    where: eq(browserFingerprints.fingerprintHash, hashFingerprint(fingerprint)),
    with: { user: { columns: { username: true, status: true } } }
  })

  if (!binding || binding.user?.status !== 'active') {
    return { available: false }
  }

  const username = binding.user.username || ''
  const maskedUsername =
    username.length <= 2 ? '**' : `${username.slice(0, 1)}${'*'.repeat(Math.min(username.length - 1, 8))}`

  return { available: true, maskedUsername }
})
