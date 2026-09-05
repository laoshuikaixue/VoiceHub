/**
 * RBAC 具名策略
 * 业务代码可读性辅助；本质是对 requirePermission 的语义包装
 */

import type { H3Event } from 'h3'
import { requirePermission } from './guards'
import { PERMISSIONS } from './constants'

export const policies = {
  canManageUsers(event: H3Event) {
    return requirePermission(event, PERMISSIONS.USER_MANAGE)
  },
  canReadUsers(event: H3Event) {
    return requirePermission(event, PERMISSIONS.USER_READ)
  },
  canChangeUserStatus(event: H3Event) {
    return requirePermission(event, PERMISSIONS.USER_STATUS)
  },
  canWriteSong(event: H3Event) {
    return requirePermission(event, PERMISSIONS.SONG_WRITE)
  },
  canRejectSong(event: H3Event) {
    return requirePermission(event, PERMISSIONS.SONG_REJECT)
  },
  canEditSchedule(event: H3Event) {
    return requirePermission(event, PERMISSIONS.SCHEDULE_WRITE)
  },
  canPublishSchedule(event: H3Event) {
    return requirePermission(event, PERMISSIONS.SCHEDULE_PUBLISH)
  },
  canManageSemester(event: H3Event) {
    return requirePermission(event, PERMISSIONS.SEMESTER_MANAGE)
  },
  canManagePlayTimes(event: H3Event) {
    return requirePermission(event, PERMISSIONS.PLAYTIMES_MANAGE)
  },
  canManageRequestTimes(event: H3Event) {
    return requirePermission(event, PERMISSIONS.REQUEST_TIMES_MANAGE)
  },
  canManageBlacklist(event: H3Event) {
    return requirePermission(event, PERMISSIONS.BLACKLIST_MANAGE)
  },
  canManageSystemSettings(event: H3Event) {
    return requirePermission(event, PERMISSIONS.SYSTEM_SETTINGS_WRITE)
  },
  canManageSmtp(event: H3Event) {
    return requirePermission(event, PERMISSIONS.SMTP_MANAGE)
  },
  canManageEmailTemplates(event: H3Event) {
    return requirePermission(event, PERMISSIONS.EMAIL_TEMPLATES_MANAGE)
  },
  canManageGradeClass(event: H3Event) {
    return requirePermission(event, PERMISSIONS.GRADE_CLASS_MANAGE)
  },
  canSendSystemNotification(event: H3Event) {
    return requirePermission(event, PERMISSIONS.NOTIFICATION_SEND)
  },
  canExecuteBackup(event: H3Event) {
    return requirePermission(event, PERMISSIONS.BACKUP_EXECUTE)
  },
  canExportBackup(event: H3Event) {
    return requirePermission(event, PERMISSIONS.BACKUP_EXPORT)
  },
  canRestoreBackup(event: H3Event) {
    return requirePermission(event, PERMISSIONS.BACKUP_RESTORE)
  },
  canResetDatabase(event: H3Event) {
    return requirePermission(event, PERMISSIONS.DATABASE_RESET)
  },
  canWriteApiKey(event: H3Event) {
    return requirePermission(event, PERMISSIONS.API_KEYS_WRITE)
  },
  canDeleteApiKey(event: H3Event) {
    return requirePermission(event, PERMISSIONS.API_KEYS_DELETE)
  },
  canManageApiKey(event: H3Event) {
    return requirePermission(event, PERMISSIONS.API_KEYS_MANAGE)
  },
  canManageRoles(event: H3Event) {
    return requirePermission(event, PERMISSIONS.ROLE_MANAGE)
  },
  canManageUserPermissions(event: H3Event) {
    return requirePermission(event, PERMISSIONS.USER_PERMISSIONS_MANAGE)
  },
  canManagePermissions(event: H3Event) {
    return requirePermission(event, PERMISSIONS.PERMISSIONS_MANAGE)
  }
}
