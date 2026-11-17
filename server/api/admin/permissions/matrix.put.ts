import { createError, defineEventHandler, readBody } from 'h3'
import {
  assertProtectedCodesSurvive,
  assertRoleTemplateExpansionWithinOperator,
  buildPermissionMatrix,
  loadPermissionHolderRows,
  normalizeSubmittedTemplates,
  saveRolePermissionTemplates,
  withPermissionTransaction
} from '~~/server/utils/permission-admin'
import { collectCodeHolders } from '~~/server/utils/permission-policy'
import { PROTECTED_PRIV_CODES } from '~~/app/utils/admin-permissions'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

// 保存角色权限模板：整表替换，缺省角色回落内置模板；安全阀在写库前拦截自锁与最后一个持有者
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<Record<string, unknown> | null>(event)
    const payload = body && typeof body === 'object' && 'templates' in body ? body.templates : body
    const nextTemplates = normalizeSubmittedTemplates(payload)

    await withPermissionTransaction(event, async (tx, currentTemplates) => {
      const { id: operatorId, perms: operatorPerms } = event.context.user
      assertRoleTemplateExpansionWithinOperator(
        currentTemplates,
        nextTemplates,
        operatorPerms ?? []
      )
      const rows = await loadPermissionHolderRows(tx)
      assertProtectedCodesSurvive(
        collectCodeHolders(rows, currentTemplates, PROTECTED_PRIV_CODES),
        collectCodeHolders(rows, nextTemplates, PROTECTED_PRIV_CODES),
        operatorId
      )
      await saveRolePermissionTemplates(nextTemplates, tx)
    })
    await recordAdminAudit(event, 'permission.matrix-update', {
      targetType: 'permission',
      summary: { roleKeys: Object.keys(nextTemplates ?? {}) }
    })
    return { success: true, matrix: await buildPermissionMatrix() }
  } catch (error: any) {
    if (error?.statusCode) throw error
    console.error('[Permissions] 保存角色权限模板失败:', error)
    throw createError({ statusCode: 500, message: '保存角色权限模板失败' })
  }
})
