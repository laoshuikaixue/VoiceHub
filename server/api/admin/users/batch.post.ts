import bcrypt from 'bcrypt'
import { prisma } from '../../../models/schema'
import { sendProgressUpdate, completeProgress, sendProgressError } from '../../progress/events'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  const body = await readBody(event)
  
  if (!body.users || !Array.isArray(body.users) || body.users.length === 0) {
    throw createError({
      statusCode: 400,
      message: '无效的用户数据'
    })
  }
  
  // 获取进度ID
  const progressId = body.progressId
  
  const results = {
    created: 0,
    failed: 0,
    total: body.users.length
  }
  
  // 如果提供了进度ID，发送初始进度更新
  if (progressId) {
    sendProgressUpdate(progressId, {
      progress: 0,
      message: '准备导入用户...',
      subMessage: `共${body.users.length}个用户待导入`
    })
  }

  // 批量添加用户
  for (let i = 0; i < body.users.length; i++) {
    const userData = body.users[i]
    
    try {
      // 更新进度
      if (progressId) {
        const progress = Math.floor((i / body.users.length) * 100)
        sendProgressUpdate(progressId, {
          progress,
          message: `正在导入用户 (${i + 1}/${body.users.length})`,
          subMessage: `当前用户: ${userData.name} (${userData.username})`
        })
      }
      
      // 验证必填字段
      if (!userData.name || !userData.username || !userData.password) {
        console.warn('用户数据缺少必填字段:', userData)
        results.failed++
        continue
      }

      // 检查用户名是否已存在
      const existingUser = await prisma.user.findFirst({
        where: {
          username: userData.username
        }
      })

      if (existingUser) {
        console.warn('用户名已存在:', userData.username)
        results.failed++
        continue
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(userData.password, 10)

      // 创建用户
      await prisma.user.create({
        data: {
          name: userData.name,
          username: userData.username,
          password: hashedPassword,
          role: userData.role === 'ADMIN' ? 'ADMIN' : 'USER',
          grade: userData.grade,
          class: userData.class
        }
      })

      results.created++
      
      // 短暂延迟，防止数据库过载
      await new Promise(resolve => setTimeout(resolve, 50))
      
    } catch (error) {
      console.error('创建用户失败:', error)
      results.failed++
    }
  }
  
  // 操作完成，发送最终进度更新
  if (progressId) {
    completeProgress(progressId, {
      progress: 100,
      message: `导入完成: ${results.created}个成功, ${results.failed}个失败`,
      subMessage: `总共${results.total}个用户`
    })
  }

  return results
}) 