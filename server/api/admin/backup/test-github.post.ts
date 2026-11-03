import { defineEventHandler, readBody } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { resolveBackupTestParams } from '~~/server/utils/backup-test-credentials'
import { checkGitRepoAccess, normalizeGitApiMode } from '~~/server/utils/githubGitClient'
import { assertSafeOutboundUrl } from '~~/server/utils/outbound-url'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  // 未提交令牌时复用已保存令牌，此时 API 地址必须与已保存配置一致
  const { apiBase, repo, branch, token, apiMode } = await resolveBackupTestParams('github', body)

  if (!apiBase || !repo || !token) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少必要参数：apiBase, repo, token')
  }

  // 防 SSRF：拒绝指向云元数据/内部管理地址的目标（含域名解析后的地址）
  await assertSafeOutboundUrl(apiBase, 'GitHub API 地址')

  try {
    await checkGitRepoAccess({ apiBase, repo, branch, token, apiMode: normalizeGitApiMode(apiMode) })
    return { success: true, message: 'Git 仓库连接测试成功' }
  } catch (err: any) {
    return { success: false, message: err.message || 'Git 仓库连接测试失败' }
  }
})
