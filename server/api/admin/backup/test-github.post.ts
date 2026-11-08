import { defineEventHandler, readBody } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { resolveBackupTestParams } from '~~/server/utils/backup-test-credentials'
import { checkGitRepoAccess, normalizeGitApiMode } from '~~/server/utils/githubGitClient'
import { assertSafeOutboundUrl } from '~~/server/utils/outbound-url'
import { ADMIN_AUDIT_RESULT, recordAdminAudit } from '~~/server/utils/admin-audit'

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
    // 令牌是凭据，审计只记录访问目标
    await recordAdminAudit(event, 'backup.test-github', {
      targetType: 'backup',
      summary: { apiBase, repo, branch }
    })
    return { success: true, message: 'Git 仓库连接测试成功' }
  } catch (err: any) {
    await recordAdminAudit(event, 'backup.test-github', {
      targetType: 'backup',
      summary: { apiBase, repo, branch, error: err.message || 'Git 仓库连接测试失败' },
      result: ADMIN_AUDIT_RESULT.FAILURE
    })
    return { success: false, message: err.message || 'Git 仓库连接测试失败' }
  }
})
