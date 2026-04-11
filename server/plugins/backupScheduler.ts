import { getBackupScheduler } from '../utils/backupScheduler'
import { getBackupService } from '../services/backupService'
import { getS3UploadService } from '../services/s3UploadService'
import { getWebDAVUploadService } from '../services/webdavUploadService'

export default defineNitroPlugin(async () => {
  console.log('[BackupPlugin] Initializing scheduled backup system...')

  const scheduler = getBackupScheduler()
  const backupService = getBackupService()

  try {
    const enabledSchedules = await backupService.getEnabledSchedules()

    for (const schedule of enabledSchedules) {
      scheduler.addTask({
        id: schedule.id,
        name: schedule.name,
        scheduleType: schedule.scheduleType as 'daily' | 'weekly' | 'monthly' | 'cron',
        scheduleTime: schedule.scheduleTime || undefined,
        scheduleDay: schedule.scheduleDay || undefined,
        cronExpression: schedule.cronExpression || undefined,
        enabled: schedule.enabled,
        callback: async () => {
          console.log(`[BackupPlugin] Executing scheduled backup: ${schedule.name} (ID: ${schedule.id})`)

          try {
            const result = await backupService.createBackup({
              scheduleId: schedule.id,
              includeSongs: schedule.includeSongs,
              includeUsers: schedule.includeUsers,
              includeSystemData: schedule.includeSystemData
            })

            if (result.success && schedule.uploadEnabled && schedule.uploadType) {
              if (schedule.uploadType === 's3' && result.localPath) {
                const s3Service = getS3UploadService()
                const uploadResult = await s3Service.uploadFromSchedule(schedule, result.localPath)
                
                if (!uploadResult.success) {
                  console.error(`[BackupPlugin] S3 upload failed: ${uploadResult.errorMessage}`)
                }
              } else if (schedule.uploadType === 'webdav' && result.localPath) {
                const webdavService = getWebDAVUploadService()
                const uploadResult = await webdavService.uploadFromSchedule(schedule, result.localPath)
                
                if (!uploadResult.success) {
                  console.error(`[BackupPlugin] WebDAV upload failed: ${uploadResult.errorMessage}`)
                }
              }
            }

            await backupService.applyRetentionPolicy(schedule.id)

            console.log(`[BackupPlugin] Scheduled backup completed: ${schedule.name}`)
          } catch (error) {
            console.error(`[BackupPlugin] Scheduled backup failed: ${schedule.name}`, error)
          }
        }
      })

      console.log(`[BackupPlugin] Registered scheduled backup: ${schedule.name} (${schedule.scheduleType})`)
    }

    scheduler.start()
    console.log(`[BackupPlugin] Started ${enabledSchedules.length} scheduled backup tasks`)
  } catch (error) {
    console.error('[BackupPlugin] Failed to initialize scheduled backups:', error)
  }
})
