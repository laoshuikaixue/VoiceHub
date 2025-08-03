const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixSequences() {
  try {
    console.log('检查和修复数据库序列...')
    
    // 获取Song表的最大ID
    const maxSong = await prisma.song.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true }
    })
    
    if (maxSong) {
      console.log(`Song表当前最大ID: ${maxSong.id}`)
      
      // 重置Song表的序列
      await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Song"', 'id'), ${maxSong.id}, true);`
      console.log(`✅ Song表序列已重置为: ${maxSong.id}`)
    } else {
      console.log('Song表为空，重置序列为1')
      await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Song"', 'id'), 1, false);`
    }
    
    // 检查其他表的序列
    const tables = [
      { name: 'User', model: prisma.user },
      { name: 'Vote', model: prisma.vote },
      { name: 'Schedule', model: prisma.schedule },
      { name: 'Notification', model: prisma.notification },
      { name: 'PlayTime', model: prisma.playTime },
      { name: 'Semester', model: prisma.semester },
      { name: 'SystemSettings', model: prisma.systemSettings }
    ]
    
    for (const table of tables) {
      try {
        const maxRecord = await table.model.findFirst({
          orderBy: { id: 'desc' },
          select: { id: true }
        })
        
        if (maxRecord) {
          await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence(${`"${table.name}"`}, 'id'), ${maxRecord.id}, true);`
          console.log(`✅ ${table.name}表序列已重置为: ${maxRecord.id}`)
        } else {
          await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence(${`"${table.name}"`}, 'id'), 1, false);`
          console.log(`✅ ${table.name}表序列已重置为: 1`)
        }
      } catch (error) {
        console.error(`❌ 重置${table.name}表序列失败:`, error.message)
      }
    }
    
    console.log('\n🎉 序列修复完成！')
    
  } catch (error) {
    console.error('修复序列时出错:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixSequences()