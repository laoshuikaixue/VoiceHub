import { defineEventHandler, getQuery, setHeader } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getAutoBackupConfig } from '~~/server/services/autoBackupService'
import { assertSafeOutboundUrl } from '~~/server/utils/outbound-url'
import { fetchRepoFileContent } from '~~/server/utils/githubGitClient'
import { isSafeBackupFilename } from '~~/server/utils/backup-filename'

/** 读取 Git 仓库分支上的备份文件正文；仓库、分支与目录只取服务端配置 */
export default defineEventHandler(async (event) => {
  const config = await getAutoBackupConfig()
  const github = config?.methods?.github
  if (!github?.apiBase || !github?.repo || !github?.token) {
    throw createApiError(400, SERVER_ERROR_CODES.BACKUP_NOT_CONFIGURED, '未配置 Git 仓库备份的 API 地址、仓库或访问令牌')
  }

  const filename = getQuery(event).filename
  if (!isSafeBackupFilename(filename)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '文件名不是合法的备份文件')
  }

  await assertSafeOutboundUrl(github.apiBase, 'GitHub API 地址')

  let content: string
  try {
    content = await fetchRepoFileContent(
      { apiBase: github.apiBase, repo: github.repo, branch: github.branch, token: github.token, apiMode: github.apiMode },
      github.path,
      filename
    )
  } catch (error: any) {
    // SSRF 拦截等已带错误码的错误原样抛出
    if (error?.data?.code) throw error
    const status = Number(error?.status)
    const isMissing = status === 404
    const code = isMissing
      ? SERVER_ERROR_CODES.COMMON_TARGET_NOT_FOUND
      : (status === 401 || status === 403)
        ? SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION
        : SERVER_ERROR_CODES.BACKUP_FAILED
    console.warn('[Backup] 读取仓库备份文件失败:', error?.message || error)
    // 5xx 响应会被框架隐去 message，仓库缺文件属于可直接定位的请求问题，按 404 返回
    throw createApiError(isMissing ? 404 : 502, code, error?.message || '读取仓库备份文件失败')
  }

  setHeader(event, 'Content-Type', 'application/json')
  setHeader(event, 'Cache-Control', 'no-cache')
  return content
})
