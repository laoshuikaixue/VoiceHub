import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getSystemBoardSnapshot } from '~~/server/services/systemBoardService'

export default defineEventHandler(async () => {
  // 看板含数据库规模、表结构与进程信息，守卫表限定超级管理员
  try {
    return { success: true, data: await getSystemBoardSnapshot() }
  } catch (error) {
    console.error('[SystemBoard] 读取系统看板快照失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.SYSTEM_BOARD_FAILED, '系统看板数据读取失败')
  }
})
