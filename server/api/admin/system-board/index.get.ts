import { verifyAdminAuth } from '~~/server/utils/auth'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getSystemBoardSnapshot } from '~~/server/services/systemBoardService'

export default defineEventHandler(async (event) => {
  const authResult = await verifyAdminAuth(event)
  if (!authResult.success) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '需要管理员权限')
  }
  // 看板含数据库规模、表结构与进程信息，仅限超级管理员
  if (authResult.user?.role !== 'SUPER_ADMIN') {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '需要超级管理员权限')
  }

  try {
    return { success: true, data: await getSystemBoardSnapshot() }
  } catch (error) {
    console.error('[SystemBoard] 读取系统看板快照失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.SYSTEM_BOARD_FAILED, '系统看板数据读取失败')
  }
})
