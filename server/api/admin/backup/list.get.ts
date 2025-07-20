import { createError, defineEventHandler } from 'h3'
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

    const backupDir = path.join(process.cwd(), 'backups')
    
    // 检查备份目录是否存在
    try {
      await fs.access(backupDir)
    } catch {
      // 如果目录不存在，创建它
      await fs.mkdir(backupDir, { recursive: true })
      return {
        success: true,
        backups: [],
        total: 0
      }
    }

    // 读取备份目录中的文件
    const files = await fs.readdir(backupDir)
    const backupFiles = files.filter(file =>
      file.endsWith('.json') &&
      (file.startsWith('database-backup-') || file.startsWith('users-backup-') || file.startsWith('uploaded-'))
    )

    const backups = []

    for (const filename of backupFiles) {
      try {
        const filepath = path.join(backupDir, filename)
        const stats = await fs.stat(filepath)
        
        // 尝试读取备份文件的元数据
        let metadata = null
        try {
          const fileContent = await fs.readFile(filepath, 'utf8')
          const backupData = JSON.parse(fileContent)
          
          if (backupData.metadata) {
            metadata = backupData.metadata
          } else if (backupData.users) {
            // 兼容旧格式的用户备份文件
            metadata = {
              version: '0.1',
              timestamp: backupData.timestamp || stats.mtime.toISOString(),
              creator: 'system',
              description: '用户数据备份（旧格式）',
              tables: [{ name: 'users', recordCount: backupData.totalUsers || backupData.users.length }],
              totalRecords: backupData.totalUsers || backupData.users.length
            }
          }
        } catch (parseError) {
          console.warn(`无法解析备份文件 ${filename}:`, parseError.message)
        }

        // 判断备份类型
        let type = 'users' // 默认为用户备份
        if (filename.startsWith('database-backup-')) {
          type = 'full'
        } else if (filename.startsWith('users-backup-')) {
          type = 'users'
        } else if (filename.startsWith('uploaded-')) {
          // 对于上传的文件，根据元数据判断类型
          if (metadata) {
            if (metadata.backupType) {
              type = metadata.backupType
            } else if (metadata.tables && metadata.tables.length > 1) {
              type = 'full'
            }
          }
        }

        backups.push({
          filename,
          size: stats.size,
          createdAt: stats.mtime,
          metadata,
          type,
          isValid: metadata !== null
        })
      } catch (error) {
        console.error(`处理备份文件 ${filename} 失败:`, error)
      }
    }

    // 按创建时间倒序排列
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return {
      success: true,
      backups,
      total: backups.length
    }

  } catch (error) {
    console.error('获取备份文件列表失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: '获取备份文件列表失败'
    })
  }
})
