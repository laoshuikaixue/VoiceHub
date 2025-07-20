import { prisma } from '../../models/schema'
import { DEFAULT_ROLES } from '../../utils/permissions.js'

export default defineEventHandler(async (event) => {
  try {
    console.log('开始初始化角色系统...')

    // 检查是否已经初始化过
    let existingRoles = []
    try {
      existingRoles = await prisma.role.findMany()
      if (existingRoles.length > 0) {
        return {
          success: true,
          message: '角色系统已经初始化过了',
          roles: existingRoles
        }
      }
    } catch (error) {
      // Role表可能不存在，继续初始化
      console.log('Role表不存在，开始创建...')
    }

    // 1. 创建基础角色
    console.log('创建基础角色...')

    const createdRoles = []
    for (const [roleName, roleConfig] of Object.entries(DEFAULT_ROLES)) {
      try {
        const role = await prisma.role.upsert({
          where: { name: roleName },
          update: {
            displayName: roleConfig.displayName,
            description: roleConfig.description,
            permissions: roleConfig.permissions,
            isSystem: roleConfig.isSystem
          },
          create: {
            name: roleName,
            displayName: roleConfig.displayName,
            description: roleConfig.description,
            permissions: roleConfig.permissions,
            isSystem: roleConfig.isSystem
          }
        })
        createdRoles.push(role)
        console.log(`创建角色: ${roleName} - ${roleConfig.displayName}`)
      } catch (error) {
        console.log(`角色 ${roleName} 创建失败:`, error.message)
      }
    }

    console.log('角色系统初始化完成！')

    return {
      success: true,
      message: '角色系统初始化成功',
      roles: createdRoles
    }
    
  } catch (error) {
    console.error('初始化角色系统失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: '初始化角色系统失败: ' + error.message
    })
  }
})
