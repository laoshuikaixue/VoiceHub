import { createError, defineEventHandler, readBody } from 'h3'
import { prisma } from '~/server/models/schema'

export default defineEventHandler(async (event) => {
  try {
    // 验证超级管理员权限
    const user = event.context.user
    if (!user || user.role !== 'SUPER_ADMIN') {
      throw createError({
        statusCode: 403,
        statusMessage: '只有超级管理员可以创建角色'
      })
    }

    const body = await readBody(event)
    const { name, description, permissions } = body

    if (!name) {
      throw createError({
        statusCode: 400,
        statusMessage: '角色名称不能为空'
      })
    }

    // 检查角色名称是否已存在
    const existingRole = await prisma.role.findUnique({
      where: { name }
    })

    if (existingRole) {
      throw createError({
        statusCode: 400,
        statusMessage: '角色名称已存在'
      })
    }

    // 创建角色
    const role = await prisma.role.create({
      data: {
        name,
        displayName: name, // 使用name作为displayName的默认值
        description: description || null,
        permissions: permissions || [],
        isSystem: false
      }
    })

    // 权限已经在角色创建时直接保存到permissions字段

    // 获取用户数量
    const userCount = await prisma.user.count({
      where: { role: role.name }
    })

    return {
      success: true,
      role: {
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
        permissions: role.permissions,
        userCount: userCount
      }
    }
  } catch (error) {
    console.error('创建角色失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '创建角色失败'
    })
  }
})
