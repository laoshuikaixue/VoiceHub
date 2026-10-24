import { listUserAssignedCardCodes } from '~~/server/services/cardCodeAssignmentService'

/**
 * 查询当前登录用户持有的点歌券。
 * 用于投稿选项弹窗中的下拉选择，数据只包含派发给本人且尚未使用的券。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  const rows = await listUserAssignedCardCodes(user.id)

  return {
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      code: row.code,
      assignedAt: row.assignedAt,
      note: row.note,
      assignmentId: row.assignmentId,
      assignedByName: row.assignedByName,
      notifyStatus: row.notifyStatus
    }))
  }
})
