import { getQuery } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { canResetDatabase } from '~~/server/utils/rbac'
import {
  getBoardEvents,
  resolveBoardEventsQuery
} from '~~/server/services/systemBoardService'
import { getRuntimeEventsMeta } from '~~/server/utils/system-event-buffer'

export default defineEventHandler(async (event) => {
  // 运行事件含异常堆栈与请求 5xx，仅限超级管理员（routePermissionMap 登记 database.reset；守卫在 try 外）
  await canResetDatabase(event)

  try {
    const { list, truncated } = await getBoardEvents(resolveBoardEventsQuery(getQuery(event)))
    return { success: true, data: { events: list, truncated, runtimeMeta: getRuntimeEventsMeta() } }
  } catch (error) {
    console.error('[SystemBoard] 读取系统看板事件失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.SYSTEM_BOARD_FAILED, '系统看板事件读取失败')
  }
})
