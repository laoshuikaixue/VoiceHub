import { createError, defineEventHandler, getQuery, setHeader } from 'h3'
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

    const query = getQuery(event)
    const { filename } = query

    if (!filename || typeof filename !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少文件名参数'
      })
    }

    // 安全检查：确保文件名不包含路径遍历字符
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw createError({
        statusCode: 400,
        statusMessage: '无效的文件名'
      })
    }

    // 检查文件是否为备份文件
    if (
      !filename.endsWith('.json') ||
      (!filename.startsWith('database-backup-') &&
        !filename.startsWith('users-backup-') &&
        !filename.startsWith('uploaded-'))
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: '无效的备份文件'
      })
    }

    const backupDir = path.join(process.cwd(), 'backups')
    const filepath = path.join(backupDir, filename)

    try {
      // 检查文件是否存在
      await fs.access(filepath)

      // 读取文件内容
      const fileContent = await fs.readFile(filepath, 'utf8')
      const fileStats = await fs.stat(filepath)

      // 设置响应头
      setHeader(event, 'Content-Type', 'application/json')
      setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
      setHeader(event, 'Content-Length', fileStats.size.toString())
      setHeader(event, 'Cache-Control', 'no-cache')

      return fileContent
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw createError({
          statusCode: 404,
          statusMessage: '备份文件不存在'
        })
      }
      throw createError({
        statusCode: 500,
        statusMessage: '读取备份文件失败'
      })
    }
  } catch (error) {
    console.error('下载备份文件失败:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || '下载备份文件失败'
    })
  }
})
