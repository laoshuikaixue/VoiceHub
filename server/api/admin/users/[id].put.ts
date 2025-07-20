import { createError, defineEventHandler, readBody, getRouterParam } from 'h3'
import { prisma } from '../../../models/schema'
import bcrypt from 'bcrypt'

export default defineEventHandler(async (event) => {
  try {
    // 检查认证和权限
    const user = event.context.user
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: '没有权限访问'
      })
    }

    const userId = getRouterParam(event, 'id')
    const body = await readBody(event)
    const { name, username, password, role, grade, class: userClass } = body

    // 验证必填字段
    if (!name || !username) {
      throw createError({
        statusCode: 400,
        statusMessage: '姓名和用户名为必填项'
      })
    }

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    })

    if (!existingUser) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    // 检查用户名是否被其他用户使用
    if (username !== existingUser.username) {
      const duplicateUser = await prisma.user.findUnique({
        where: { username }
      })

      if (duplicateUser) {
        throw createError({
          statusCode: 400,
          statusMessage: '用户名已被其他用户使用'
        })
      }
    }

    // 准备更新数据
    const updateData = {
      name,
      username,
      role: ['USER', 'ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN'].includes(role) ? role : 'USER',
      grade,
      class: userClass
    }

    // 如果提供了密码，则加密并更新
    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    // 更新用户
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        grade: true,
        class: true,
        lastLogin: true,
        lastLoginIp: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return {
      success: true,
      user: updatedUser,
      message: '用户更新成功'
    }
  } catch (error) {
    console.error('更新用户失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '更新用户失败: ' + error.message
    })
  }
})
