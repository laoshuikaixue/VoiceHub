import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { canResetDatabase } from '~~/server/utils/rbac'
import { clearBoardRuntimeEvents } from '~~/server/services/systemBoardService'
import { recordRuntimeEvent } from '~~/server/utils/system-event-buffer'

export default defineEventHandler(async (event) => {
  // 清空进程内缓冲会影响排障现场，仅限超级管理员（routePermissionMap 登记 database.reset；守卫在 try 外）
  await canResetDatabase(event)

  try {
    const removed = clearBoardRuntimeEvents()
    recordRuntimeEvent('info', 'systemBoard', JSON.stringify({ code: 'bufferCleared', count: removed }))
    return { success: true, data: { removed } }
  } catch (error) {
    console.error('[SystemBoard] 清空运行事件缓冲失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.SYSTEM_BOARD_FAILED, '运行事件缓冲清空失败')
  }
})
