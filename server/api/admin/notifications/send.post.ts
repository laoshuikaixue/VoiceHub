import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { and, eq, or } from 'drizzle-orm'
import {
  createBatchSystemNotifications,
  createSystemNotification
} from '../../../services/notificationService'
import { getClientIP } from '~~/server/utils/ip-utils'

export default defineEventHandler(async (event) => {
  // 检查用户是否为管理员
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员可以发送系统通知'
    })
  }

  try {
    // 获取客户端IP地址
    const clientIP = getClientIP(event)

    // 获取请求数据
    const body = await readBody(event)
    const { title, message, content, scope, filter, userId, type } = body

    // 处理单个用户通知（用于权限变更等系统通知）
    if (userId && title && (message || content)) {
      const notificationContent = message || content
      const result = await createSystemNotification(userId, title, notificationContent, clientIP)

      if (result) {
        return {
          success: true,
          message: '通知发送成功',
          sentCount: 1,
          totalUsers: 1
        }
      } else {
        throw createError({
          statusCode: 500,
          message: '发送通知失败'
        })
      }
    }

    // 验证批量通知请求数据
    if (!title || !content) {
      throw createError({
        statusCode: 400,
        message: '通知标题和内容不能为空'
      })
    }

    if (!scope || !['ALL', 'GRADE', 'CLASS', 'MULTI_CLASS', 'SPECIFIC_USERS'].includes(scope)) {
      throw createError({
        statusCode: 400,
        message: '无效的通知范围'
      })
    }

    // 查询符合条件的用户IDs
    let userIds: number[] = []

    if (scope === 'ALL') {
      // 查询所有用户
      const allUsers = await db.select({ id: users.id }).from(users)
      userIds = allUsers.map((user) => user.id)
    } else if (scope === 'GRADE') {
      // 按年级查询
      if (!filter?.grade) {
        throw createError({
          statusCode: 400,
          message: '年级不能为空'
        })
      }

      const gradeUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.grade, filter.grade))
      userIds = gradeUsers.map((user) => user.id)
    } else if (scope === 'CLASS') {
      // 按单个班级查询
      if (!filter?.grade || !filter?.class) {
        throw createError({
          statusCode: 400,
          message: '年级和班级不能为空'
        })
      }

      const classUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.grade, filter.grade), eq(users.class, filter.class)))
      userIds = classUsers.map((user) => user.id)
    } else if (scope === 'MULTI_CLASS') {
      // 按多个班级查询
      if (!filter?.classes || !Array.isArray(filter.classes) || filter.classes.length === 0) {
        throw createError({
          statusCode: 400,
          message: '未选择任何班级'
        })
      }

      // 构建查询条件，使用OR连接多个班级条件
      const whereConditions = filter.classes.map((cls: { grade: string; class: string }) =>
        and(eq(users.grade, cls.grade), eq(users.class, cls.class))
      )

      const multiClassUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(or(...whereConditions))
      userIds = multiClassUsers.map((user) => user.id)
    } else if (scope === 'SPECIFIC_USERS') {
      // 指定用户
      if (!filter?.userIds || !Array.isArray(filter.userIds) || filter.userIds.length === 0) {
        throw createError({
          statusCode: 400,
          message: '未选择任何用户'
        })
      }

      userIds = filter.userIds
    }

    if (userIds.length === 0) {
      return {
        success: true,
        message: '没有找到符合条件的用户',
        sentCount: 0,
        totalUsers: 0
      }
    }

    // 使用通知服务批量发送通知
    const result = await createBatchSystemNotifications(userIds, title, content, clientIP)

    if (!result) {
      throw new Error('发送通知失败')
    }

    // 处理结果
    let sentCount = 0
    let totalUsers = userIds.length

    // 判断result类型
    if (Array.isArray(result)) {
      sentCount = result.length
    } else if (result && typeof result === 'object' && 'count' in result) {
      sentCount = result.count
      totalUsers = result.total || userIds.length
    }

    return {
      success: true,
      message: '通知发送成功',
      sentCount,
      totalUsers
    }
  } catch (error: any) {
    console.error('发送通知失败:', error)

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '发送通知失败'
    })
  }
})
