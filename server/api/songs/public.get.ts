import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  try {
    // 获取当前日期，使用UTC时间
    const now = new Date()
    const today = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ))
    
    console.log('获取排期使用的今日日期:', today.toISOString())
    
    // 获取已排期的歌曲，包含播放时段信息
    const schedules = await prisma.schedule.findMany({
      where: {
        playDate: {
          gte: today // 只获取当前日期及以后的排期
        }
      },
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
      
      // 输出调试信息，查看日期处理
      console.log('排期日期处理:', {
        原始日期: schedule.playDate,
        处理后日期: dateOnly,
        ISO字符串: dateOnly.toISOString(),
        日期字符串: `${dateOnly.getUTCFullYear()}-${(dateOnly.getUTCMonth() + 1).toString().padStart(2, '0')}-${dateOnly.getUTCDate().toString().padStart(2, '0')}`
      })
      
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
          musicUrl: schedule.song.musicUrl || null
        }
      }
    })
    
    return formattedSchedules
  } catch (error: any) {
    console.error('获取公共排期失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || '获取排期数据失败'
    })
  }
}) 