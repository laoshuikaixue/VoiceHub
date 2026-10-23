import { defineEventHandler, getQuery } from 'h3'
import { desc, eq } from 'drizzle-orm'
import { db, browserFingerprints } from '~/drizzle/db'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { hashFingerprint, isValidFingerprint } from '~~/server/utils/fingerprint'

// 当前账号的浏览器指纹绑定列表；传入 fingerprint 时服务端标记哪条是当前浏览器
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '需要登录才能查看绑定列表')
  }

  const query = getQuery(event)
  const rawFingerprint = typeof query.fingerprint === 'string' ? query.fingerprint : ''
  let currentHash: string | null = null
  if (rawFingerprint) {
    if (!isValidFingerprint(rawFingerprint)) {
      throw createApiError(
        400,
        SERVER_ERROR_CODES.AUTH_FINGERPRINT_INVALID,
        '浏览器指纹格式无效'
      )
    }
    currentHash = hashFingerprint(rawFingerprint)
  }

  const bindings = await db.query.browserFingerprints.findMany({
    where: eq(browserFingerprints.userId, user.id),
    orderBy: [desc(browserFingerprints.createdAt)]
  })

  return bindings.map((binding) => ({
    id: binding.id,
    label: binding.label,
    browser: binding.browser,
    operatingSystem: binding.operatingSystem,
    device: binding.device,
    createdAt: binding.createdAt,
    lastUsedAt: binding.lastUsedAt,
    lastLoginIp: binding.lastLoginIp,
    current: currentHash != null && binding.fingerprintHash === currentHash
  }))
})
