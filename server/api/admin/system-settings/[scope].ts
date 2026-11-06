import { defineEventHandler, getMethod, getRouterParam } from 'h3'
import readSettings from './index'
import writeSettings from './index.post'
import { canAccessSettingsScope, isAdminSettingsScope } from '~~/server/utils/admin-settings-scope'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async (event) => {
  const scope = getRouterParam(event, 'scope')
  const method = getMethod(event)
  if (!isAdminSettingsScope(scope) || !['GET', 'HEAD', 'POST'].includes(method)) {
    throw createApiError(404, SERVER_ERROR_CODES.COMMON_TARGET_NOT_FOUND, '配置模块不存在')
  }
  if (!canAccessSettingsScope(event.context.user, scope, method === 'POST')) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '没有该配置模块的权限')
  }
  event.context.adminSettingsScope = scope
  return method === 'POST' ? writeSettings(event) : readSettings(event)
})
