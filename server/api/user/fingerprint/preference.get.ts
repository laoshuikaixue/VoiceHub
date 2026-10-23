import { defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { db, users } from '~/drizzle/db'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'

// 查询当前账号的「浏览器指纹数据」开关状态
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(
      401,
      SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS,
      '需要登录才能查看浏览器指纹数据设置'
    )
  }

  const settings = await getSystemSettingsCached()
  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { fingerprintDataEnabled: true }
  })
  if (!userRecord) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '账号不存在')
  }

  return {
    // 管理员总开关关闭时，全站不可采集，前端应隐藏入口
    available: settings?.fingerprintDataEnabled === true,
    enabled: userRecord.fingerprintDataEnabled === true
  }
})
