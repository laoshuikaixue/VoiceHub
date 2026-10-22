/**
 * 备份文件名校验（统一口径）
 *
 * 历史问题：/api/admin/backup/download.get.ts 与 /api/admin/backup/download/[filename].get.ts
 * 两处校验规则不一致，后者只拦截路径分隔符而未校验文件名前缀，
 * 存在读取 backups 目录内任意 .json 文件（如导入上传的中间产物）的风险。
 *
 * 统一规则：文件名必须是纯 basename（不含路径分隔符与 ..），
 * 且必须命中允许的备份文件名前缀之一，扩展名固定为 .json。
 */

/** 允许下载的备份文件名前缀（与备份服务实际产出的命名保持一致） */
export const ALLOWED_BACKUP_FILENAME_PREFIXES = [
  'database-backup-',
  'users-backup-',
  'uploaded-'
] as const

/** 备份文件扩展名 */
const BACKUP_FILE_EXTENSION = '.json'

const PATH_SEPARATOR_PATTERN = /[/\\]/

/**
 * 判断文件名是否为允许下载的备份文件
 * @param filename 用户传入的文件名（未解码前应先解码）
 * @returns 是否允许
 */
export function isAllowedBackupFilename(filename: unknown): filename is string {
  if (typeof filename !== 'string') return false

  const name = filename.trim()
  if (!name || name.length > 255) return false

  // 必须是纯 basename：不含路径分隔符、不含 ..、不含空字节
  if (PATH_SEPARATOR_PATTERN.test(name)) return false
  if (name.includes('..')) return false
  if (name.includes('\0')) return false

  // 扩展名固定为 .json
  if (!name.toLowerCase().endsWith(BACKUP_FILE_EXTENSION)) return false

  // 必须命中允许的前缀
  return ALLOWED_BACKUP_FILENAME_PREFIXES.some((prefix) => name.startsWith(prefix))
}
