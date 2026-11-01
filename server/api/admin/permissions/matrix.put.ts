import { createError, defineEventHandler, readBody } from 'h3'
import {
  assertProtectedCodesSurvive,
  buildPermissionMatrix,
  loadPermissionHolderRows,
  normalizeSubmittedTemplates,
  saveRolePermissionTemplates
} from '~~/server/utils/permission-admin'
import { collectCodeHolders } from '~~/server/utils/permission-policy'
import { PROTECTED_PRIV_CODES } from '~~/app/utils/admin-permissions'
import { getRolePermissionTemplatesCached } from '~~/server/utils/system-settings-helper'

// 保存角色权限模板：整表替换，缺省角色回落内置模板；安全阀在写库前拦截自锁与最后一个持有者
export default defineEventHandler(async (event) => {
  try {
    const { id: operatorId } = event.context.user

    const body = await readBody<Record<string, unknown> | null>(event)
    const payload = body && typeof body === 'object' && 'templates' in body ? body.templates : body
    const nextTemplates = normalizeSubmittedTemplates(payload)

    const currentTemplates = await getRolePermissionTemplatesCached()
    const rows = await loadPermissionHolderRows()
    assertProtectedCodesSurvive(
      collectCodeHolders(rows, currentTemplates, PROTECTED_PRIV_CODES),
      collectCodeHolders(rows, nextTemplates, PROTECTED_PRIV_CODES),
      operatorId
    )

    await saveRolePermissionTemplates(nextTemplates)
    return { success: true, matrix: await buildPermissionMatrix() }
  } catch (error: any) {
    if (error?.statusCode) throw error
    console.error('[Permissions] 保存角色权限模板失败:', error)
    throw createError({ statusCode: 500, message: '保存角色权限模板失败' })
  }
})
