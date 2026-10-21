import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { canResetDatabase } from '~~/server/utils/rbac'
import { getSystemBoardSnapshot } from '~~/server/services/systemBoardService'

export default defineEventHandler(async (event) => {
  // 看板含数据库规模、表结构与进程信息，仅限超级管理员（routePermissionMap 登记 database.reset；守卫在 try 外）
  await canResetDatabase(event)

  try {
    return { success: true, data: await getSystemBoardSnapshot() }
  } catch (error) {
    console.error('[SystemBoard] 读取系统看板快照失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.SYSTEM_BOARD_FAILED, '系统看板数据读取失败')
  }
})
