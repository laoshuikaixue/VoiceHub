import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getAutoBackupConfig } from '~~/server/services/autoBackupService'

/**
 * 备份连接测试取参（S3 / WebDAV / Git 仓库共用）。
 * 本次提交的字段优先，空字段回填已保存配置；未提交密钥时复用已保存密钥，
 * 此时要求出站目标地址与已保存配置一致，避免已保存凭据被发往调用方临时指定的主机。
 */

/** 各备份方式的密钥字段与出站目标字段 */
const TEST_SECRET_FIELDS: Record<'s3' | 'webdav' | 'github', { secret: string; target: string }> = {
  s3: { secret: 'secretKey', target: 'endpoint' },
  webdav: { secret: 'password', target: 'url' },
  github: { secret: 'token', target: 'apiBase' }
}

/** 归一化出站地址，忽略大小写与末尾斜杠差异 */
function normalizeTarget(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return ''
  try {
    const url = new URL(raw)
    const pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '')
    return `${url.origin.toLowerCase()}${pathname}`
  } catch {
    return raw.toLowerCase().replace(/\/+$/, '')
  }
}

/** 合并已保存配置，返回连接测试实际使用的参数字典 */
export async function resolveBackupTestParams(
  method: keyof typeof TEST_SECRET_FIELDS,
  body: Record<string, any> = {}
): Promise<Record<string, any>> {
  const fields = TEST_SECRET_FIELDS[method]
  const saved: Record<string, any> = { ...(await getAutoBackupConfig())?.methods?.[method] || {} }
  const params: Record<string, any> = { ...body }

  for (const key of Object.keys(saved)) {
    if (key === 'enabled' || key === fields.secret) continue
    const incoming = params[key]
    if (incoming === undefined || incoming === null || String(incoming).trim() === '') {
      params[key] = saved[key]
    }
  }

  const submittedSecret = String(params[fields.secret] ?? '').trim()
  if (submittedSecret) {
    params[fields.secret] = submittedSecret
    return params
  }

  if (normalizeTarget(params[fields.target]) !== normalizeTarget(saved[fields.target])) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '变更目标地址后需重新填写密钥再测试')
  }
  params[fields.secret] = saved[fields.secret] || ''
  return params
}
