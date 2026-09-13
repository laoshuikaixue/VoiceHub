/**
 * 当前登录用户的有效权限集合（spec [S6]）
 * GET /api/admin/rbac/my-permissions
 * 权限：任意登录用户（前端 useRbac 用）
 */

import { db } from '~/drizzle/db'
import { permissions, rolePermissions, userPermissions } from '~/drizzle/schema'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { getUserPermissions } from '~~/server/utils/rbac/resolvePermissions'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  const perms = await getUserPermissions(user.id)

  return {
    success: true,
    data: {
      permissions: Array.from(perms)
    }
  }
})
