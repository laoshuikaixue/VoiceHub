const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

async function backupAndMigrate() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔍 开始备份现有数据...')
    
    // 1. 备份用户数据
    console.log('📦 备份用户数据...')
    const users = await prisma.user.findMany()
    
    // 转换用户角色数据
    const userBackup = users.map(user => ({
      ...user,
      // 将旧的角色ID转换为新的角色字符串
      newRole: user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      // 保留lastLoginAt字段数据
      lastLogin: user.lastLoginAt || user.lastLogin
    }))
    
    // 保存备份文件
    const backupDir = path.join(__dirname, '../backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = path.join(backupDir, `users-backup-${timestamp}.json`)
    
    fs.writeFileSync(backupFile, JSON.stringify({
      users: userBackup,
      timestamp: new Date().toISOString(),
      totalUsers: userBackup.length
    }, null, 2))
    
    console.log(`✅ 用户数据已备份到: ${backupFile}`)
    console.log(`📊 备份了 ${userBackup.length} 个用户`)
    
    // 2. 显示迁移后的恢复计划
    console.log('\n📋 迁移计划:')
    console.log('1. 现在可以安全地运行 "npx prisma db push" 并选择 Y')
    console.log('2. 迁移完成后运行恢复脚本')
    console.log('3. 用户数据将被恢复，角色将被正确映射')
    
    console.log('\n🔄 角色映射:')
    const roleCounts = userBackup.reduce((acc, user) => {
      acc[user.newRole] = (acc[user.newRole] || 0) + 1
      return acc
    }, {})
    
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`   ${role}: ${count} 个用户`)
    })
    
    return backupFile
    
  } catch (error) {
    console.error('❌ 备份失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

async function restoreUsers(backupFile) {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔄 开始恢复用户数据...')
    
    // 读取备份文件
    if (!backupFile || !fs.existsSync(backupFile)) {
      // 查找最新的备份文件
      const backupDir = path.join(__dirname, '../backups')
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('users-backup-') && f.endsWith('.json'))
        .sort()
        .reverse()
      
      if (files.length === 0) {
        throw new Error('没有找到备份文件')
      }
      
      backupFile = path.join(backupDir, files[0])
      console.log(`📁 使用备份文件: ${backupFile}`)
    }
    
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'))
    
    console.log(`📊 恢复 ${backup.users.length} 个用户...`)
    
    // 恢复用户数据
    for (const userData of backup.users) {
      try {
        await prisma.user.upsert({
          where: { username: userData.username },
          update: {
            name: userData.name,
            role: userData.newRole,
            grade: userData.grade,
            class: userData.class,
            lastLogin: userData.lastLogin,
            lastLoginIp: userData.lastLoginIp,
            passwordChangedAt: userData.passwordChangedAt
          },
          create: {
            username: userData.username,
            name: userData.name,
            password: userData.password,
            role: userData.newRole,
            grade: userData.grade,
            class: userData.class,
            lastLogin: userData.lastLogin,
            lastLoginIp: userData.lastLoginIp,
            passwordChangedAt: userData.passwordChangedAt
          }
        })
        console.log(`✅ 恢复用户: ${userData.username} (${userData.newRole})`)
      } catch (error) {
        console.error(`❌ 恢复用户 ${userData.username} 失败:`, error.message)
      }
    }
    
    console.log('✅ 用户数据恢复完成!')
    
  } catch (error) {
    console.error('❌ 恢复失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 命令行参数处理
const command = process.argv[2]

if (command === 'backup') {
  backupAndMigrate()
    .then((backupFile) => {
      console.log('\n🎉 备份完成!')
      console.log('💡 下一步: 运行 "npx prisma db push" 并选择 Y')
      console.log(`💡 然后运行: node scripts/backup-and-migrate.js restore "${backupFile}"`)
    })
    .catch((error) => {
      console.error('备份失败:', error)
      process.exit(1)
    })
} else if (command === 'restore') {
  const backupFile = process.argv[3]
  restoreUsers(backupFile)
    .then(() => {
      console.log('\n🎉 恢复完成!')
      console.log('💡 现在可以重启开发服务器并初始化角色系统')
    })
    .catch((error) => {
      console.error('恢复失败:', error)
      process.exit(1)
    })
} else {
  console.log('用法:')
  console.log('  备份: node scripts/backup-and-migrate.js backup')
  console.log('  恢复: node scripts/backup-and-migrate.js restore [备份文件路径]')
}
