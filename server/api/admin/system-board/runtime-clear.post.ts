import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { clearBoardRuntimeEvents } from '~~/server/services/systemBoardService'
import { recordRuntimeEvent } from '~~/server/utils/system-event-buffer'

export default defineEventHandler(async () => {
  // 清空进程内缓冲会影响排障现场，守卫表限定超级管理员
  try {
    const removed = clearBoardRuntimeEvents()
    recordRuntimeEvent('info', 'systemBoard', JSON.stringify({ code: 'bufferCleared', count: removed }))
    return { success: true, data: { removed } }
  } catch (error) {
    console.error('[SystemBoard] 清空运行事件缓冲失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.SYSTEM_BOARD_FAILED, '运行事件缓冲清空失败')
  }
})
