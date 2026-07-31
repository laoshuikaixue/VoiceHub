import { createError, defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, message: '只有超级管理员可以测试 WebDAV 连接' })
  }

  const body = await readBody(event)
  const { url, username, password, path: dirPath } = body

  if (!url || !username || !password) {
    throw createError({ statusCode: 400, message: '缺少必要参数：url, username, password' })
  }

  try {
    const auth = Buffer.from(`${username}:${password}`).toString('base64')
    const testUrl = `${url.replace(/\/$/, '')}/${(dirPath || '').replace(/\/$/, '')}/.voicehub-test-connection`

    // 先尝试 PROPFIND 探测目录
    const propfindUrl = `${url.replace(/\/$/, '')}/${(dirPath || '').replace(/\/$/, '')}`
    const propfindRes = await fetch(propfindUrl, {
      method: 'PROPFIND',
      headers: {
        Authorization: `Basic ${auth}`,
        Depth: '0'
      }
    })

    if (!propfindRes.ok && propfindRes.status !== 405) {
      // 405 表示服务器不支持 PROPFIND，但可能仍支持 PUT
      // 直接尝试 PUT 写测试文件
    }

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