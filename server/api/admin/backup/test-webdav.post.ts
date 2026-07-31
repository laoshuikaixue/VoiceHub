import { defineEventHandler, readBody } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getAutoBackupConfig } from '~~/server/services/autoBackupService'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '只有超级管理员可以测试 WebDAV 连接')
  }

  const body = await readBody(event)
  let { url, username, password, path: dirPath } = body

  // 密码为空时从已保存配置中获取
  if (!password) {
    const config = await getAutoBackupConfig()
    password = config?.methods?.webdav?.password || ''
    username = username || config?.methods?.webdav?.username || ''
    url = url || config?.methods?.webdav?.url || ''
    dirPath = dirPath || config?.methods?.webdav?.path || ''
  }

  if (!url || !username || !password) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少必要参数：url, username, password')
  }

  try {
    const auth = Buffer.from(`${username}:${password}`).toString('base64')
    const testUrl = `${url.replace(/\/$/, '')}/${(dirPath || '').replace(/\/$/, '')}/.voicehub-test-connection`

    // 写入测试文件
    const putRes = await fetch(testUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'text/plain'
      },
      body: 'VoiceHub WebDAV connection test'
    })

    if (!putRes.ok) {
      throw new Error(`WebDAV 写入失败: ${putRes.status} ${putRes.statusText}`)
    }

    // 清理测试文件
    await fetch(testUrl, {
      method: 'DELETE',
      headers: { Authorization: `Basic ${auth}` }
    }).catch(() => {})

    return { success: true, message: 'WebDAV 连接测试成功' }
  } catch (err: any) {
    return { success: false, message: err.message || 'WebDAV 连接测试失败' }
  }
})