/**
 * 更新角色 × 权限矩阵（覆盖式）（spec [S6]）
 * PUT /api/admin/rbac/roles/[role]
 * 权限：role.manage（仅 SUPER_ADMIN）
 *
 * SUPER_ADMIN 角色不允许被修改（防止锁死）
 */

import { db } from '~/drizzle/db'
import { permissions, rolePermissions } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireSuperAdmin } from '~~/server/utils/rbac/guards'
import { ROLES } from '~~/server/utils/rbac/constants'

const bodySchema = z.object({
  permissions: z.array(z.string().min(1).max(100)).max(200)
})

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const role = getRouterParam(event, 'role')
  if (!role || !(role in ROLES)) {
    throw createError({
      statusCode: 400,
      message: `无效的角色：${role}`
    })
  }

  if (role === ROLES.SUPER_ADMIN) {
    throw createError({
      statusCode: 403,
      message: 'SUPER_ADMIN 角色不允许通过此接口修改（防锁死）'
    })
  }

  const body = await readBody(event)
  const validated = bodySchema.parse(body)

  // 校验所有 permission key 都存在
  if (validated.permissions.length > 0) {
    const existing = await db
      .select({ key: permissions.key })
      .from(permissions)
    const validKeys = new Set(existing.map((p) => p.key))
    const invalid = validated.permissions.filter((k) => !validKeys.has(k))
    if (invalid.length > 0) {
      throw createError({
        statusCode: 400,
        message: `权限 key 不存在：${invalid.join(', ')}`
      })
    }
  }

  // 解析 permission keys → ids
  const allPerms = await db
    .select({ id: permissions.id, key: permissions.key })
    .from(permissions)
  const keyToId = new Map(allPerms.map((p) => [p.key, p.id]))
  const permissionIds = validated.permissions
    .map((k) => keyToId.get(k))
    .filter((id): id is number => id !== undefined)

  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.role, role as any))
    if (permissionIds.length > 0) {
      await tx.insert(rolePermissions).values(
        permissionIds.map((permissionId) => ({
          role: role as any,
          permissionId
        }))
      )
    }
    // 角色矩阵变更失效所有用户的缓存
    const { rbacCache } = await import('~~/server/utils/rbac/cache')
    rbacCache.invalidateAll()
  })

  return {
    success: true,
    message: `角色 ${role} 权限已更新`
  }
})
