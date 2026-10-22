import { createError, defineEventHandler, getRouterParam, setHeader } from 'h3'
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

    const filename = getRouterParam(event, 'filename')

    if (!filename) {
      throw createError({
        statusCode: 400,
        message: '请指定文件名'
      })
    }

    // 安全校验：与 download.get.ts 共用同一备份文件名白名单（此前仅防路径遍历，可越权下载任意 .json）
    if (!isSafeBackupFilename(filename)) {
      throw createError({
        statusCode: 400,
        message: '无效的备份文件'
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
        message: '备份文件不存在'
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
      message: error.message || '下载备份文件失败'
    })
  }
})
