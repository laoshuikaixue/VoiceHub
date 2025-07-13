import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能获取歌曲列表'
    })
  }
  
  // 获取所有歌曲及其投票数
  const songs = await prisma.song.findMany({
    include: {
      requester: {
        select: {
          id: true,
          name: true,
          grade: true,
          class: true
        }
      },
      votes: {
        select: {
          id: true
        }
      },
      _count: {
        select: {
          votes: true
        }
      }
    },
    orderBy: {
      votes: {
        _count: 'desc'
      }
    }
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
  const formattedSongs = songs.map(song => {
    // 处理投稿人姓名，如果是同名用户则添加后缀
    let requesterName = song.requester.name || '未知用户'
    
    // 检查是否有同名用户
    const sameNameUsers = nameToUsers.get(requesterName)
    if (sameNameUsers && sameNameUsers.length > 1) {
      const requesterWithGradeClass = song.requester
      
      // 如果有年级信息，则添加年级后缀
      if (requesterWithGradeClass.grade) {
        // 检查同一个年级是否有同名
        const sameGradeUsers = sameNameUsers.filter(u => u.grade === requesterWithGradeClass.grade)
        
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
      id: song.id,
      title: song.title,
      artist: song.artist,
      requester: requesterName,
      voteCount: song._count.votes,
      played: song.played,
      playedAt: song.playedAt,
      semester: song.semester,
      createdAt: song.createdAt
    }
  })
  
  return formattedSongs
}) 