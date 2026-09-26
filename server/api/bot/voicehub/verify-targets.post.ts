import { defineEventHandler, getHeader, readBody } from 'h3'
import { inArray } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindings, systemSettings } from '~/drizzle/schema'
import { adapterToAstrbotPlatform, isAstrbotPlatformEnabled } from '~~/server/utils/astrbot-platforms'
import { isAstrbotGroupTargetAllowed, isAstrbotGroupUmoShape } from '~~/server/utils/astrbot-group'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  ASTRBOT_TOKEN_HEADER,
  equalAstrbotToken,
  isAstrbotPrivateUmoShape
} from '~~/server/utils/astrbot-notification'


/**
 * 校验推送目标是否获授权（插件投递前回查）。
 *
 * 私聊目标：UMO 必须逐个命中某账号的绑定记录，且该行记录的 astrbotPlatform
 * 仍在受支持的适配器白名单内（与绑定接口同一套判定）。
 * 群目标：UMO 必须在管理员配置的群白名单内，且该群所属平台的开关为开。
 *
 * UMO 前缀是 AstrBot 的平台实例 ID，可由管理员改名，因此两种情况都不能拿它
 * 比对适配器名。任一目标无法确认即整体拒绝，避免任何未经确认的投递。
 */
export default defineEventHandler(async (event) => {
  const [settings] = await db.select({
    token: systemSettings.astrbotToken,
    enabled: systemSettings.astrbotEnabled,
    platforms: systemSettings.astrbotPlatforms,
    groupTargets: systemSettings.astrbotGroupTargets
  }).from(systemSettings).limit(1)
  if (!settings?.enabled || !equalAstrbotToken(getHeader(event, ASTRBOT_TOKEN_HEADER) ?? '', settings.token ?? '')) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
  }
  const body = await readBody(event)
  const umos = body?.umos
  if (!Array.isArray(umos) || !umos.length || umos.length > 200 ||
      umos.some((umo) => typeof umo !== 'string' ||
        (!isAstrbotPrivateUmoShape(umo) && !isAstrbotGroupUmoShape(umo))) ||
      new Set(umos).size !== umos.length) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_UMO_INVALID, '推送目标无效')
  }

  const groupUmos = umos.filter((umo) => isAstrbotGroupUmoShape(umo))
  if (groupUmos.some((umo) => !isAstrbotGroupTargetAllowed(settings.groupTargets, settings.platforms, umo))) {
    throw createApiError(403, SERVER_ERROR_CODES.ASTRBOT_UMO_INVALID, '包含未授权的群目标')
  }

  const privateUmos = umos.filter((umo) => !isAstrbotGroupUmoShape(umo))
  if (privateUmos.length) {
    const rows = await db.select({ umo: astrbotBindings.umo, platform: astrbotBindings.platform, adapter: astrbotBindings.adapter })
      .from(astrbotBindings).where(inArray(astrbotBindings.umo, privateUmos))
    if (rows.length !== privateUmos.length || rows.some((row) => !isAstrbotPlatformEnabled(settings.platforms, row.platform) ||
      adapterToAstrbotPlatform(row.adapter) !== row.platform)) {
      throw createApiError(403, SERVER_ERROR_CODES.ASTRBOT_UMO_INVALID, '包含未绑定的私聊目标')
    }
  }

  return { success: true, umos }
})
