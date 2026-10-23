import { createError, defineEventHandler, getQuery, setHeader } from 'h3'
import { promises as fs } from 'fs'
import path from 'path'
import { isSafeBackupFilename } from '~~/server/utils/backup-filename'

export default defineEventHandler(async (event) => {
  try {
    // 验证管理员权限
    const user = event.context.user
    if (!user || user.role !== 'SUPER_ADMIN') {
      throw createError({
        statusCode: 403,
        message: '只有超级管理员可以下载备份文件'
      })
    }

    const query = getQuery(event)
    const { filename } = query

    if (!filename || typeof filename !== 'string') {
      throw createError({
        statusCode: 400,
        message: '缺少文件名参数'
      })
    }

    // 安全校验：统一走备份文件名白名单（纯 basename + 无遍历 + 前缀 + .json）
    if (!isSafeBackupFilename(filename)) {
      throw createError({
        statusCode: 400,
        message: '无效的备份文件'
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
          message: '备份文件不存在'
        })
      }
      throw createError({
        statusCode: 500,
        message: '读取备份文件失败'
      })
    }
  } catch (error) {
    console.error('下载备份文件失败:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '下载备份文件失败'
    })
  }
})
