import { createError, defineEventHandler } from 'h3'
import { promises as fs } from 'fs'
import path from 'path'
import formidable from 'formidable'

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

    // 创建备份目录
    const backupDir = path.join(process.cwd(), 'backups')
    try {
      await fs.access(backupDir)
    } catch {
      await fs.mkdir(backupDir, { recursive: true })
    }

    // 解析上传的文件
    const form = formidable({
      uploadDir: backupDir,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      filter: ({ mimetype, originalFilename }) => {
        // 只允许JSON文件
        return (
          mimetype === 'application/json' ||
          (originalFilename && originalFilename.endsWith('.json'))
        )
      }
    })

    const [fields, files] = await form.parse(event.node.req)

    if (!files.file || !files.file[0]) {
      throw createError({
        statusCode: 400,
        statusMessage: '请选择要上传的备份文件'
      })
    }

    const uploadedFile = files.file[0]

    // 验证文件内容
    let backupData
    try {
      const fileContent = await fs.readFile(uploadedFile.filepath, 'utf8')
      backupData = JSON.parse(fileContent)
    } catch (error) {
      // 删除无效文件
      await fs.unlink(uploadedFile.filepath)
      throw createError({
        statusCode: 400,
        statusMessage: '备份文件格式无效'
      })
    }

    // 验证备份文件结构
    if (!backupData.metadata && !backupData.users) {
      await fs.unlink(uploadedFile.filepath)
      throw createError({
        statusCode: 400,
        statusMessage: '不是有效的备份文件'
      })
    }

    // 生成新的文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const originalName = uploadedFile.originalFilename || 'backup.json'
    const fileExtension = path.extname(originalName)
    const baseName = path.basename(originalName, fileExtension)
    const newFilename = `uploaded-${baseName}-${timestamp}${fileExtension}`
    const newFilepath = path.join(backupDir, newFilename)

    // 移动文件到新位置
    await fs.rename(uploadedFile.filepath, newFilepath)

    // 更新备份文件的元数据
    if (backupData.metadata) {
      // 新格式备份文件
      backupData.metadata.uploadedBy = user.username
      backupData.metadata.uploadedAt = new Date().toISOString()
      backupData.metadata.originalFilename = originalName
      backupData.metadata.creator = user.username // 确保创建者信息正确
    } else if (backupData.users) {
      // 旧格式备份文件，创建元数据
      backupData.metadata = {
        version: '0.1',
        timestamp: backupData.timestamp || new Date().toISOString(),
        creator: user.username,
        uploadedBy: user.username,
        uploadedAt: new Date().toISOString(),
        originalFilename: originalName,
        description: '用户数据备份（上传）',
        tables: [{ name: 'users', recordCount: backupData.totalUsers || backupData.users.length }],
        totalRecords: backupData.totalUsers || backupData.users.length
      }
    }

    // 重新保存文件
    await fs.writeFile(newFilepath, JSON.stringify(backupData, null, 2), 'utf8')

    console.log(`管理员 ${user.username} 上传了备份文件: ${newFilename}`)

    // 获取文件信息
    const stats = await fs.stat(newFilepath)

    return {
      success: true,
      message: '备份文件上传成功',
      backup: {
        filename: newFilename,
        originalFilename: originalName,
        size: stats.size,
        uploadedBy: user.username,
        uploadedAt: new Date().toISOString(),
        metadata: backupData.metadata || null
      }
    }
  } catch (error) {
    console.error('上传备份文件失败:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || '上传备份文件失败'
    })
  }
})
