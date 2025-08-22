import bcrypt from 'bcrypt'
import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  try {
    console.log('处理修改密码请求')
    
    // 检查认证
    const user = event.context.user
    if (!user) {
      console.log('修改密码失败：未授权')
      throw createError({
        statusCode: 401,
        message: '未授权'
      })
    }

    const body = await readBody(event)
    console.log(`用户 ${user.id} 请求修改密码`)
    
    if (!body.currentPassword || !body.newPassword) {
      console.log('修改密码失败：密码参数不完整')
      throw createError({
        statusCode: 400,
        message: '当前密码和新密码不能为空'
      })
    }
    
    // 获取用户信息
    let currentUser
    try {
      console.log(`查询用户 ID: ${user.id} 的详细信息`)
      currentUser = await prisma.user.findUnique({
        where: {
          id: user.id
        }
      })
    } catch (dbError: any) {
      console.error('查询用户信息数据库错误:', dbError)
      
      // 使用原始SQL查询
      try {
        console.log('尝试使用原始SQL查询用户信息')
        const result = await prisma.$queryRaw`
          SELECT * FROM "User" WHERE id = ${user.id}
        `
        currentUser = Array.isArray(result) && result.length > 0 ? result[0] : null
      } catch (sqlError: any) {
        console.error('原始SQL查询失败:', sqlError)
        throw createError({
          statusCode: 500,
          message: '数据库查询错误，无法获取用户信息'
        })
      }
    }
    
    if (!currentUser) {
      console.log(`修改密码失败：未找到ID为 ${user.id} 的用户`)
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }
    
    // 验证当前密码
    let isPasswordValid
    try {
      console.log('验证当前密码')
      isPasswordValid = await bcrypt.compare(body.currentPassword, currentUser.password)
      console.log('密码验证结果:', isPasswordValid)
    } catch (bcryptError: any) {
      console.error('bcrypt密码验证错误:', bcryptError)
      throw createError({
        statusCode: 500,
        message: '密码验证过程中出错'
      })
    }
    
    if (!isPasswordValid) {
      console.log('修改密码失败：当前密码不正确')
      throw createError({
        statusCode: 401,
        message: '当前密码不正确'
      })
    }
    
    // 验证新密码不能与当前密码相同
    const isSamePassword = await bcrypt.compare(body.newPassword, currentUser.password)
    if (isSamePassword) {
      console.log('修改密码失败：新密码不能与当前密码相同')
      throw createError({
        statusCode: 400,
        message: '新密码不能与当前密码相同'
      })
    }
    
    // 加密新密码
    let hashedPassword
    try {
      console.log('加密新密码')
      hashedPassword = await bcrypt.hash(body.newPassword, 10)
    } catch (hashError: any) {
      console.error('密码加密错误:', hashError)
      throw createError({
        statusCode: 500,
        message: '密码加密过程中出错'
      })
    }
    
    // 更新密码
    try {
      console.log(`更新用户 ID: ${user.id} 的密码`)
      
      // 使用原始SQL更新
      await prisma.$executeRaw`
        UPDATE "User"
        SET password = ${hashedPassword},
            "passwordChangedAt" = NOW(),
            "forcePasswordChange" = false
        WHERE id = ${user.id}
      `
      
      console.log('密码更新成功')
    } catch (updateError: any) {
      console.error('更新密码数据库错误:', updateError)
      throw createError({
        statusCode: 500,
        message: '更新密码失败，请稍后重试'
      })
    }
    
    console.log(`用户 ID: ${user.id} 密码修改成功`)
    return {
      success: true,
      message: '密码修改成功'
    }
  } catch (error: any) {
    // 已格式化的错误直接抛出
    if (error.statusCode) {
      throw error
    }
    
    // 记录错误信息
    console.error('修改密码过程中发生未处理的错误:', error)
    
    // 创建错误响应
    throw createError({
      statusCode: 500,
      message: '修改密码失败: ' + (error.message || '未知错误')
    })
  }
})