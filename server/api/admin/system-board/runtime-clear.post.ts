import { verifyAdminAuth } from '~~/server/utils/auth'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { clearBoardRuntimeEvents } from '~~/server/services/systemBoardService'
import { recordRuntimeEvent } from '~~/server/utils/system-event-buffer'

export default defineEventHandler(async (event) => {
  const authResult = await verifyAdminAuth(event)
  if (!authResult.success) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '需要管理员权限')
  }
  // 清空进程内缓冲会影响排障现场，仅限超级管理员
  if (authResult.user?.role !== 'SUPER_ADMIN') {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '需要超级管理员权限')
  }

  try {
    const removed = clearBoardRuntimeEvents()
    recordRuntimeEvent('info', 'systemBoard', JSON.stringify({ code: 'bufferCleared', count: removed }))
    return { success: true, data: { removed } }
  } catch (error) {
    console.error('[SystemBoard] 清空运行事件缓冲失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.SYSTEM_BOARD_FAILED, '运行事件缓冲清空失败')
  }
})
