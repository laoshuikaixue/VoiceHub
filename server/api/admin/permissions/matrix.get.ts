import { createError, defineEventHandler } from 'h3'
import { buildPermissionMatrix } from '~~/server/utils/permission-admin'

// 权限矩阵：角色模板现状、内置默认、站点级能力持有者分布
export default defineEventHandler(async () => {
  try {
    return { success: true, matrix: await buildPermissionMatrix() }
  } catch (error: any) {
    if (error?.statusCode) throw error
    console.error('[Permissions] 读取权限矩阵失败:', error)
    throw createError({ statusCode: 500, message: '读取权限矩阵失败' })
  }
})
