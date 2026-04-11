import { defineEventHandler, getRouterParam } from 'h3'
import { getBackupService } from '~~/server/services/backupService'
import { getS3UploadService } from '~~/server/services/s3UploadService'
import { getWebDAVUploadService } from '~~/server/services/webdavUploadService'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '权限不足'
    })
  }

  const id = parseInt(getRouterParam(event, 'id') || '0')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: '无效的备份配置 ID'
    })
  }

  const backupService = getBackupService()
  const schedule = await backupService.getSchedule(id)

  if (!schedule) {
    throw createError({
      statusCode: 404,
      message: '备份配置不存在'
    })
  }

  console.log(`[API] Manual backup triggered for: ${schedule.name} by ${user.username}`)

  const result = await backupService.createBackup({
    scheduleId: schedule.id,
    includeSongs: schedule.includeSongs,
    includeUsers: schedule.includeUsers,
    includeSystemData: schedule.includeSystemData
  })

  if (!result.success) {
    throw createError({
      statusCode: 500,
      message: `备份失败: ${result.errorMessage}`
    })
  }

  if (schedule.uploadType && result.localPath) {
    let uploadSuccess = false

    if (schedule.uploadType === 's3') {
      const s3Service = getS3UploadService()
      const uploadResult = await s3Service.uploadFromSchedule(schedule, result.localPath)
      uploadSuccess = uploadResult.success

      if (!uploadSuccess) {
        console.error(`[API] S3 upload failed: ${uploadResult.errorMessage}`)
      }
    } else if (schedule.uploadType === 'webdav') {
      const webdavService = getWebDAVUploadService()
      const uploadResult = await webdavService.uploadFromSchedule(schedule, result.localPath)
      uploadSuccess = uploadResult.success

      if (!uploadSuccess) {
        console.error(`[API] WebDAV upload failed: ${uploadResult.errorMessage}`)
      }
    }

    if (uploadSuccess) {
      await backupService.applyRetentionPolicy(schedule.id)
    }
  } else {
    await backupService.applyRetentionPolicy(schedule.id)
  }

  return {
    success: true,
    message: '备份执行成功',
    data: {
      filename: result.filename,
      fileSize: result.fileSize,
      checksum: result.checksum
    }
  }
})
