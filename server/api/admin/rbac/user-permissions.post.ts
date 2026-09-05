/**
 * 新增用户加授 / 减授记录（spec [S2.3] + [S6]）
 * POST /api/admin/rbac/user-permissions
 * 权限：user_permissions.manage
 *
 * 同一 (user_id, permission_id) 已存在则更新 grant_type / expires_at / reason
 * （UNIQUE 约束见 schema）
 */

import { db } from '~/drizzle/db'
import { permissions, userPermissions } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requirePermission } from '~~/server/utils/rbac/guards'
import { GRANT_TYPES, PERMISSIONS } from '~~/server/utils/rbac/constants'
import { rbacCache } from '~~/server/utils/rbac/cache'

const bodySchema = z.object({
  userId: z.number().int().positive('userId 必须为正整数'),
  permissionKey: z.string().min(1).max(100),
  grantType: z.enum([GRANT_TYPES.ASSIGN, GRANT_TYPES.REVOKE]),
  expiresAt: z.union([z.string().datetime(), z.null()]).optional(),
  reason: z.string().max(500).optional().nullable()
})

export default defineEventHandler(async (event) => {
  const operator = await requirePermission(event, PERMISSIONS.USER_PERMISSIONS_MANAGE)

  const body = await readBody(event)
  const validated = bodySchema.parse(body)

  // 解析 permission key
  const permRow = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(eq(permissions.key, validated.permissionKey))
    .limit(1)

  if (!permRow[0]) {
    throw createError({
      statusCode: 400,
      message: `权限 key 不存在：${validated.permissionKey}`
    })
  }
  const permissionId = permRow[0].id

  // 写入或更新
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: userPermissions.id })
      .from(userPermissions)
      .where(eq(userPermissions.userId, validated.userId))
      .limit(1)

    if (existing.length > 0) {
      await tx
        .update(userPermissions)
        .set({
          permissionId,
          grantType: validated.grantType,
          expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
          grantedBy: operator.id,
          reason: validated.reason ?? null
        })
        .where(eq(userPermissions.id, existing[0].id))
    } else {
      await tx.insert(userPermissions).values({
        userId: validated.userId,
        permissionId,
        grantType: validated.grantType,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        grantedBy: operator.id,
        reason: validated.reason ?? null
      })
    }
  })

  // 失效该用户缓存
  rbacCache.invalidate(validated.userId)

  return {
    success: true,
    message: `用户 ${validated.userId} 的 ${validated.permissionKey} 加授已更新`
  }
})
