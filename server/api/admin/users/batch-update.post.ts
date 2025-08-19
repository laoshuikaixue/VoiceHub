import { z } from 'zod'
import { prisma } from '~/server/models/schema'
import jwt from 'jsonwebtoken'

// 请求体验证模式
const batchUpdateSchema = z.object({
  updates: z.array(
    z.object({
      userId: z.number().int().positive(),
      grade: z.string().optional(),
      class: z.string().optional()
    })
  ).min(1).max(100) // 限制批量更新数量
})

export default defineEventHandler(async (event) => {
  try {
    // 验证用户身份和权限
    const token = getCookie(event, 'auth-token') || getHeader(event, 'authorization')?.replace('Bearer ', '')
    
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }

    let currentUser
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any
      currentUser = await prisma.user.findUnique({
        where: { id: decoded.userId }
      })
    } catch (error) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid token'
      })
    }

    if (!currentUser) {
      throw createError({
        statusCode: 401,
        statusMessage: 'User not found'
      })
    }

    // 检查权限 - 只有管理员和超级管理员可以执行批量更新
    if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Insufficient permissions'
      })
    }

    // 验证请求体
    const body = await readBody(event)
    const validationResult = batchUpdateSchema.safeParse(body)
    
    if (!validationResult.success) {
      throw createError({
        statusCode: 400,
        statusMessage: '请求参数无效: ' + validationResult.error.errors.map(e => e.message).join(', ')
      })
    }

    const { updates } = validationResult.data

    // 获取所有要更新的用户ID
    const userIds = updates.map(update => update.userId)
    
    // 验证用户是否存在且为学生角色
    const existingUsers = await prisma.user.findMany({
      where: {
        id: {
          in: userIds
        },
        role: 'USER'
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true
      }
    })

    // 检查是否所有用户都存在且为学生
    const existingUserIds = new Set(existingUsers.map(user => user.id))
    const missingUserIds = userIds.filter(id => !existingUserIds.has(id))
    
    if (missingUserIds.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `以下用户ID不存在或不是学生: ${missingUserIds.join(', ')}`
      })
    }

    // 执行批量更新
    const updateResults = []
    const errors = []

    for (const update of updates) {
      try {
        // 构建更新数据
        const updateData: any = {}
        
        if (update.grade !== undefined && update.grade.trim()) {
          updateData.grade = update.grade.trim()
        }
        
        if (update.class !== undefined && update.class.trim()) {
          updateData.class = update.class.trim()
        }

        // 如果没有要更新的字段，跳过
        if (Object.keys(updateData).length === 0) {
          continue
        }

        // 更新用户信息
        const updatedUser = await prisma.user.update({
          where: { id: update.userId },
          data: updateData,
          select: {
            id: true,
            name: true,
            username: true,
            grade: true,
            class: true
          }
        })

        updateResults.push(updatedUser)
      } catch (error) {
        console.error(`处理用户 ${update.userId} 更新时出错:`, error)
        errors.push({
          userId: update.userId,
          error: error.message || '未知错误'
        })
      }
    }

    // 返回结果
    const response = {
      success: true,
      message: `批量更新完成，成功更新 ${updateResults.length} 个用户`,
      data: {
        updated: updateResults,
        errors: errors,
        summary: {
          total: updates.length,
          success: updateResults.length,
          failed: errors.length
        }
      }
    }

    // 如果有部分失败，调整消息
    if (errors.length > 0) {
      response.message = `批量更新部分完成，成功更新 ${updateResults.length} 个用户，${errors.length} 个用户更新失败`
    }

    return response

  } catch (error) {
    console.error('批量更新用户失败:', error)
    
    // 如果是已知错误，直接抛出
    if (error.statusCode) {
      throw error
    }
    
    // 未知错误
    throw createError({
      statusCode: 500,
      statusMessage: '批量更新用户失败: ' + error.message
    })
  }
})