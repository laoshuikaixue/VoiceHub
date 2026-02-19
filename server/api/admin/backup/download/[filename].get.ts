import { createError, defineEventHandler, getRouterParam, setHeader } from 'h3'
import { promises as fs } from 'fs'
import path from 'path'

export default defineEventHandler(async (event) => {
  try {
    // 验证管理员权限
    const user = event.context.user
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: '权限不足'
      })
    }

    const filename = getRouterParam(event, 'filename')

    if (!filename) {
      throw createError({
        statusCode: 400,
        statusMessage: '请指定文件名'
      })
    }

    // 验证文件名安全性
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw createError({
        statusCode: 400,
        statusMessage: '无效的文件名'
      })
    }

    // 验证文件扩展名
    if (!filename.endsWith('.json')) {
      throw createError({
        statusCode: 400,
        statusMessage: '只能下载JSON格式的备份文件'
      })
    }

    const backupDir = path.join(process.cwd(), 'backups')
    const filepath = path.join(backupDir, filename)

    // 检查文件是否存在
    try {
      await fs.access(filepath)
    } catch {
      throw createError({
        statusCode: 404,
        statusMessage: '备份文件不存在'
      })
    }

    // 获取文件信息
    const stats = await fs.stat(filepath)

    // 设置响应头
    setHeader(event, 'Content-Type', 'application/json')
    setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
    setHeader(event, 'Content-Length', stats.size.toString())
    setHeader(event, 'Cache-Control', 'no-cache')

    // 读取并返回文件内容
    const fileContent = await fs.readFile(filepath)

    console.log(`管理员 ${user.username} 下载了备份文件: ${filename}`)

    return fileContent
  } catch (error) {
    console.error('下载备份文件失败:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || '下载备份文件失败'
    })
  }
})
