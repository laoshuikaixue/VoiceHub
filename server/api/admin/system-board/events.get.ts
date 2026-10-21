import { getQuery } from 'h3'
import { verifyAdminAuth } from '~~/server/utils/auth'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  getBoardEvents,
  resolveBoardEventsQuery
} from '~~/server/services/systemBoardService'
import { getRuntimeEventsMeta } from '~~/server/utils/system-event-buffer'

export default defineEventHandler(async (event) => {
  const authResult = await verifyAdminAuth(event)
  if (!authResult.success) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '需要管理员权限')
  }
  // 运行事件含异常堆栈与请求 5xx，仅限超级管理员
  if (authResult.user?.role !== 'SUPER_ADMIN') {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '需要超级管理员权限')
  }

  try {
    const { list, truncated } = await getBoardEvents(resolveBoardEventsQuery(getQuery(event)))
    return { success: true, data: { events: list, truncated, runtimeMeta: getRuntimeEventsMeta() } }
  } catch (error) {
    console.error('[SystemBoard] 读取系统看板事件失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.SYSTEM_BOARD_FAILED, '系统看板事件读取失败')
  }
})
