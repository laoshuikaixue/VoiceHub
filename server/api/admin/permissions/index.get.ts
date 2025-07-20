import { createError, defineEventHandler } from 'h3'
import { PERMISSIONS, PERMISSION_CATEGORIES } from '../../../utils/permissions.js'

export default defineEventHandler(async (event) => {
  try {
    // 将权限定义转换为API格式
    const permissions = Object.entries(PERMISSIONS).map(([key, displayName]) => ({
      name: key,
      displayName,
      category: key.split('.')[0] // 从权限名称中提取分类
    }))

    // 按分类分组
    const groupedPermissions = {}
    for (const [categoryKey, categoryConfig] of Object.entries(PERMISSION_CATEGORIES)) {
      groupedPermissions[categoryKey] = {
        name: categoryConfig.name,
        permissions: categoryConfig.permissions.map(permName => ({
          name: permName,
          displayName: PERMISSIONS[permName]
        }))
      }
    }

    return {
      success: true,
      permissions,
      groupedPermissions,
      total: permissions.length
    }
  } catch (error) {
    console.error('获取权限列表失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取权限列表失败: ' + error.message
    })
  }
})
