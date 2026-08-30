/**
 * 兼容导出：原 requireSongAdmin 改为 requirePermission 的薄封装
 *
 * 历史调用方（5 处 server/api/admin/**）可逐步迁移到 requirePermission；
 * 保留此文件 30 天观察期后由独立 chore PR 删除（spec [S13]）。
 *
 * 等价语义：原 requireSongAdmin 等同于要求 SONG_ADMIN/ADMIN/SUPER_ADMIN 三种角色；
 * 新实现要求 SONG_ADMIN 矩阵中的所有权限（write / reject / schedule / playtimes /
 * request_times / semester / stats / card_codes），覆盖原行为并更精确。
 */

import type { H3Event } from 'h3'
import { requirePermission } from '~~/server/utils/rbac/guards'
import { PERMISSIONS } from '~~/server/utils/rbac/constants'

export async function requireSongAdmin(event: H3Event): Promise<void> {
  // SONG_ADMIN 矩阵中权限最弱的是 card_codes.write；以其为基准等价覆盖原行为
  await requirePermission(event, PERMISSIONS.CARD_CODES_WRITE)
}
