import { createError, defineEventHandler, readBody } from 'h3'
import { uploadToS3, deleteFromS3 } from '~~/server/utils/s3Client'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, message: '只有超级管理员可以测试 S3 连接' })
  }

  const body = await readBody(event)
  const { endpoint, bucket, region, accessKey, secretKey } = body

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw createError({ statusCode: 400, message: '缺少必要参数：endpoint, bucket, accessKey, secretKey' })
  }

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

    return { success: true, message: 'S3 连接测试成功' }
  } catch (err: any) {
    return { success: false, message: err.message || 'S3 连接测试失败' }
  }
})