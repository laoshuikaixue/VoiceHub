import { createError, defineEventHandler, getRouterParam } from 'h3'
import { promises as fs } from 'fs'
import path from 'path'
import { isSafeBackupFilename } from '~~/server/utils/backup-filename'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
  try {
    const user = event.context.user

    const filename = getRouterParam(event, 'filename')

    if (!filename) {
      throw createError({
        statusCode: 400,
        message: '请指定文件名'
      })
    }

    // 安全校验：与下载端点共用同一备份文件名白名单（防止删除 backups/ 内非备份文件）
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

    // 删除文件
    await fs.unlink(filepath)

    console.log(`管理员 ${user.username} 删除了备份文件：${filename}`)

    await recordAdminAudit(event, 'backup.delete', {
      targetType: 'backup',
      targetId: typeof filename === 'string' ? filename : String(filename)
    })

    return {
      success: true,
      message: '备份文件删除成功',
      filename
    }
  } catch (error: any) {
    console.error('删除备份文件失败:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '删除备份文件失败'
    })
  }
})
