import path from 'path'

// 备份文件命名前缀白名单（唯一权威定义，list/download/delete 共用，避免口径漂移）
export const BACKUP_FILE_PREFIXES = Object.freeze([
  'database-backup-',
  'users-backup-',
  'users-system-backup-',
  'songs-backup-',
  'songs-system-backup-',
  'system-settings-backup-',
  'auto-backup-',
  'uploaded-'
])

/**
 * 校验备份文件名是否安全且合法：
 * 纯 basename、无路径遍历/NUL、限定前缀、.json 后缀、长度上限。
 * 用于下载与删除端点，防止越权读取 backups/ 目录内非备份产物。
 */
export function isSafeBackupFilename(filename: unknown): filename is string {
  if (typeof filename !== 'string' || !filename) return false
  if (filename.includes('\0') || filename.includes('..')) return false
  if (filename.includes('/') || filename.includes('\\')) return false
  if (filename.length > 255) return false
  if (path.basename(filename) !== filename) return false
  if (!filename.endsWith('.json')) return false
  return BACKUP_FILE_PREFIXES.some((prefix) => filename.startsWith(prefix))
}
