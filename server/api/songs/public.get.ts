import { createError, defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../models/schema'
import { executeWithPool } from '~/server/utils/db-pool'
import { CacheService } from '~/server/services/cacheService'

export default defineEventHandler(async (event) => {
  try {
    // 获取查询参数
    const query = getQuery(event)
    const semester = query.semester as string
    
    // 初始化缓存服务
    const cacheService = new CacheService()
    
    // 获取当前日期，使用UTC时间
    const now = new Date()
    const today = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ))
    
    // 尝试从缓存获取排期数据
    const cacheKey = `public_schedules_${semester || 'all'}`
    let cachedSchedules = await cacheService.getSchedulesList()
    
    if (cachedSchedules && (!semester || cachedSchedules.some(s => s.song?.semester === semester))) {
      console.log('[Cache] 公共排期缓存命中')
      // 如果指定了学期，过滤数据
      if (semester) {
        cachedSchedules = cachedSchedules.filter(s => s.song?.semester === semester)
      }
      return cachedSchedules
    }
    
    // 获取排期的歌曲，包含播放时段信息
    const result = await executeWithPool(async () => {
      // 构建查询条件
      const whereCondition: any = {}
      if (semester) {
        whereCondition.song = {
          semester: semester
        }
      }
      
      const schedules = await prisma.schedule.findMany({
        where: whereCondition,
        include: {
          song: {
            include: {
              requester: {
                select: {
                  name: true,
                  grade: true,
                  class: true
                }
              },
              _count: {
                select: {
                  votes: true
                }
              }
            }
          },
          playTime: true // 包含播放时段信息
        },
        orderBy: [
          { playDate: 'asc' }
          // 不使用sequence字段排序
        ]
      })

      // 获取所有用户的姓名列表，用于检测同名用户
      const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        grade: true,
        class: true
      }
    })
    
    // 创建姓名到用户数组的映射
    const nameToUsers = new Map()
    users.forEach(user => {
      if (user.name) {
        if (!nameToUsers.has(user.name)) {
          nameToUsers.set(user.name, [])
        }
        nameToUsers.get(user.name).push(user)
      }
    })
    
    // 转换数据格式
    const formattedSchedules = schedules.map(schedule => {
      // 获取原始日期，并确保使用UTC时间
      const originalDate = new Date(schedule.playDate)
      
      // 创建一个新的日期对象，保留原始日期的年月日，但使用UTC时间
      const dateOnly = new Date(Date.UTC(
        originalDate.getUTCFullYear(),
        originalDate.getUTCMonth(),
        originalDate.getUTCDate(),
        0, 0, 0, 0
      ))
      
      // 处理投稿人姓名，如果是同名用户则添加后缀
      let requesterName = schedule.song.requester.name || '未知用户'
      
      // 检查是否有同名用户
      const sameNameUsers = nameToUsers.get(requesterName)
      if (sameNameUsers && sameNameUsers.length > 1) {
        const requesterWithGradeClass = schedule.song.requester
        
        // 如果有年级信息，则添加年级后缀
        if (requesterWithGradeClass.grade) {
          // 检查同一个年级是否有同名
          const sameGradeUsers = sameNameUsers.filter((u: {id: number, name: string | null, grade: string | null, class: string | null}) => 
            u.grade === requesterWithGradeClass.grade
          )
          
          if (sameGradeUsers.length > 1 && requesterWithGradeClass.class) {
            // 同一个年级有同名，添加班级后缀
            requesterName = `${requesterName}（${requesterWithGradeClass.grade} ${requesterWithGradeClass.class}）`
          } else {
            // 只添加年级后缀
            requesterName = `${requesterName}（${requesterWithGradeClass.grade}）`
          }
        }
      }
      
      return {
        id: schedule.id,
        playDate: dateOnly,
        sequence: schedule.sequence || 1,
        played: schedule.played || false,
        playTimeId: schedule.playTimeId, // 添加播放时段ID
        playTime: schedule.playTime ? {
          id: schedule.playTime.id,
          name: schedule.playTime.name,
          startTime: schedule.playTime.startTime,
          endTime: schedule.playTime.endTime,
          enabled: schedule.playTime.enabled
        } : null, // 添加播放时段信息
        song: {
          id: schedule.song.id,
          title: schedule.song.title,
          artist: schedule.song.artist,
          requester: requesterName,
          voteCount: schedule.song._count.votes,
          played: schedule.song.played || false,
          cover: schedule.song.cover || null,
          musicPlatform: schedule.song.musicPlatform || null,
          musicId: schedule.song.musicId || null,
          semester: schedule.song.semester || null
        }
      }
    })

    return formattedSchedules
    }, 'getPublicSchedules')
    
    // 缓存结果
    if (result && result.length > 0) {
      await cacheService.setSchedulesList(result)
      console.log(`[Cache] 公共排期已缓存，数量: ${result.length}`)
    }

    return result
  } catch (error: any) {
    console.error('获取公共排期失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || '获取排期数据失败'
    })
  }
})