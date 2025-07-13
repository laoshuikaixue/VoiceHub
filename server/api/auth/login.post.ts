import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    console.log('Login attempt for user:', body.username)
    
    if (!body.username || !body.password) {
      throw createError({
        statusCode: 400,
        message: '账号名和密码不能为空'
      })
    }
    
    // 检查 JWT_SECRET 是否已设置
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set')
      throw createError({
        statusCode: 500,
        message: '服务器配置错误：缺少必要的环境变量'
      })
    }
    
    // 查找用户
    let user
    try {
      user = await prisma.user.findUnique({
        where: {
          username: body.username
        }
      })
      console.log('User found:', user ? 'yes' : 'no')
    } catch (error) {
      console.error('Database error when finding user:', error)
      throw createError({
        statusCode: 500,
        message: '数据库查询错误'
      })
    }
    
    if (!user) {
      throw createError({
        statusCode: 401,
        message: '用户不存在'
      })
    }
    
    // 验证密码
    let isPasswordValid
    try {
      isPasswordValid = await bcrypt.compare(body.password, user.password)
      console.log('Password valid:', isPasswordValid)
    } catch (error) {
      console.error('bcrypt error:', error)
      throw createError({
        statusCode: 500,
        message: '密码验证错误'
      })
    }
    
    if (!isPasswordValid) {
      throw createError({
        statusCode: 401,
        message: '密码不正确'
      })
    }
    
    // 获取客户端IP
    const clientIp = getRequestIP(event, { xForwardedFor: true }) || '未知IP'
    console.log('Client IP:', clientIp)
    
    // 更新用户最后登录时间和IP
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: clientIp
        }
      })
      console.log('User login time updated')
    } catch (error) {
      console.error('Error updating user login time:', error)
      // 不中断登录流程，继续生成令牌
    }
    
    // 生成JWT令牌
    let token
    try {
      token = jwt.sign(
        { 
          userId: user.id,
          role: user.role
        },
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
      )
      console.log('JWT token generated')
    } catch (error) {
      console.error('JWT signing error:', error)
      throw createError({
        statusCode: 500,
        message: '令牌生成错误'
      })
    }
    
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        grade: user.grade,
        class: user.class,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp
      }
    }
  } catch (error: any) {
    console.error('Login error:', error)
    // 如果是已经格式化的错误，直接抛出
    if (error.statusCode) {
      throw error
    }
    // 否则创建一个通用的服务器错误
    throw createError({
      statusCode: 500,
      message: '登录处理错误: ' + (error.message || '未知错误')
    })
  }
}) 