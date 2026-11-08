import { defineEventHandler, readBody } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { uploadToS3, deleteFromS3 } from '~~/server/utils/s3Client'
import { resolveBackupTestParams } from '~~/server/utils/backup-test-credentials'
import { assertSafeOutboundUrl } from '~~/server/utils/outbound-url'
import { ADMIN_AUDIT_RESULT, recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  // 未提交密钥时复用已保存密钥，此时 endpoint 必须与已保存配置一致
  const { endpoint, bucket, region, accessKey, secretKey } = await resolveBackupTestParams('s3', body)

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少必要参数：endpoint, bucket, accessKey, secretKey')
  }

  // 防 SSRF：拒绝指向云元数据/内部管理地址的目标（含域名解析后的地址）
  await assertSafeOutboundUrl(endpoint, 'S3 endpoint')

  const testKey = '.voicehub-test-connection'

  try {
    await uploadToS3(
      endpoint,
      bucket,
      region || 'auto',
      accessKey,
      secretKey,
      testKey,
      'VoiceHub S3 connection test',
      'text/plain'
    )

    // 清理测试文件
    await deleteFromS3(
      endpoint,
      bucket,
      region || 'auto',
      accessKey,
      secretKey,
      testKey
    ).catch(() => {})

    // 密钥是凭据，审计只记录访问目标
    await recordAdminAudit(event, 'backup.test-s3', {
      targetType: 'backup',
      summary: { endpoint, bucket, region: region || 'auto' }
    })

    return { success: true, message: 'S3 连接测试成功' }
  } catch (err: any) {
    await recordAdminAudit(event, 'backup.test-s3', {
      targetType: 'backup',
      summary: { endpoint, bucket, error: err.message || 'S3 连接测试失败' },
      result: ADMIN_AUDIT_RESULT.FAILURE
    })
    return { success: false, message: err.message || 'S3 连接测试失败' }
  }
})