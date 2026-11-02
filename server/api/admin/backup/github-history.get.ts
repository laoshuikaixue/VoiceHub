import { defineEventHandler, getQuery } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getAutoBackupConfig } from '~~/server/services/autoBackupService'
import { assertSafeOutboundUrl } from '~~/server/utils/outbound-url'
import { listBackupCommits } from '~~/server/utils/githubGitClient'
import { formatDateTime, parseUtcTimestamp } from '~/utils/timeUtils'

/** 读取 Git 仓库分支上的备份提交，只读，不产生任何写请求 */
export default defineEventHandler(async (event) => {
  const config = await getAutoBackupConfig()
  const github = config?.methods?.github
  if (!github?.apiBase || !github?.repo || !github?.token) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '未配置 Git 仓库备份的 API 地址、仓库或访问令牌')
  }
  await assertSafeOutboundUrl(github.apiBase, 'GitHub API 地址')

  const rawLimit = Number(getQuery(event).limit)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 30

  try {
    const history = await listBackupCommits(
      { apiBase: github.apiBase, repo: github.repo, branch: github.branch, token: github.token, apiMode: github.apiMode },
      github.path,
      limit
    )
    return {
      success: true,
      data: {
        ...history,
        repo: github.repo,
        entries: history.entries.map((entry) => ({
          ...entry,
          committedAtBeijing: entry.committedAt ? formatDateTime(parseUtcTimestamp(entry.committedAt)) : ''
        }))
      }
    }
  } catch (error: any) {
    return { success: false, message: error?.message || '读取 Git 仓库备份历史失败' }
  }
})
