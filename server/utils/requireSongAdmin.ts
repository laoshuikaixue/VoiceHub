/**
 * 歌曲管理员守卫（兼容层，S3-B1 语义修正）。
 *
 * 现状（cc882ed）：内联 `['SONG_ADMIN','ADMIN','SUPER_ADMIN'].includes(user.role)` —— 这是
 * 「第二份角色矩阵」（与 catalog 的 minRole 派生规则各写一份，会漂移），且 `user.status !== 'active'`
 * 比内核其余 guard 更严（`undefined` 状态在本文件被拒、在 guards 里放行），行为不一致。
 *
 * 现在：**委托内核**（`requireActiveUser` 统一 401/403-账号异常，`isSongAdminRole` 走 catalog 角色谓词），
 * 保住原有语义（SONG_ADMIN 及以上），不再持有角色数组。
 * 调用点迁移（本域内归零）由 S3-B2/B3 各批负责；本文件保留导出名以兼容未迁移的调用方。
 */

import type { H3Event } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { isSongAdminRole, requireActiveUser } from '~~/server/utils/rbac'

export function requireSongAdmin(event: H3Event): void {
  const user = requireActiveUser(event)
  if (!isSongAdminRole(user)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
      '只有歌曲管理员及以上权限才能执行此操作'
    )
  }
}

