const { PrismaClient } = require('@prisma/client')

async function migrateRoles() {
  const prisma = new PrismaClient()
  
  try {
    console.log('开始角色系统迁移...')
    
    // 1. 创建基础角色
    console.log('创建基础角色...')
    
    const roles = [
      {
        name: 'USER',
        description: '普通用户',
        isSystem: true
      },
      {
        name: 'ADMIN', 
        description: '管理员',
        isSystem: true
      },
      {
        name: 'SONG_ADMIN',
        description: '歌曲管理员', 
        isSystem: true
      },
      {
        name: 'SUPER_ADMIN',
        description: '超级管理员',
        isSystem: true
      }
    ]
    
    for (const roleData of roles) {
      await prisma.role.upsert({
        where: { name: roleData.name },
        update: {},
        create: roleData
      })
      console.log(`创建角色: ${roleData.name}`)
    }
    
    // 2. 创建基础权限
    console.log('创建基础权限...')
    
    const permissions = [
      // 歌曲管理权限
      { name: 'song.submit', displayName: '歌曲投稿', category: 'song' },
      { name: 'song.vote', displayName: '歌曲投票', category: 'song' },
      { name: 'song.manage', displayName: '歌曲管理', category: 'song' },
      
      // 排期管理权限
      { name: 'schedule.view', displayName: '查看排期', category: 'schedule' },
      { name: 'schedule.manage', displayName: '排期管理', category: 'schedule' },
      
      // 用户管理权限
      { name: 'user.manage', displayName: '用户管理', category: 'user' },
      { name: 'user.permissions', displayName: '权限管理', category: 'user' },
      
      // 系统管理权限
      { name: 'system.settings', displayName: '系统设置', category: 'system' },
      { name: 'system.notifications', displayName: '通知发送', category: 'system' },
      { name: 'system.blacklist', displayName: '黑名单管理', category: 'system' },
      { name: 'system.semesters', displayName: '学期管理', category: 'system' }
    ]
    
    for (const permData of permissions) {
      await prisma.permission.upsert({
        where: { name: permData.name },
        update: {},
        create: permData
      })
      console.log(`创建权限: ${permData.name}`)
    }
    
    // 3. 分配角色权限
    console.log('分配角色权限...')
    
    // 获取角色和权限
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } })
    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } })
    const songAdminRole = await prisma.role.findUnique({ where: { name: 'SONG_ADMIN' } })
    const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } })
    
    const allPermissions = await prisma.permission.findMany()
    
    // 普通用户权限
    const userPermissions = allPermissions.filter(p => 
      ['song.submit', 'song.vote', 'schedule.view'].includes(p.name)
    )
    
    // 歌曲管理员权限
    const songAdminPermissions = allPermissions.filter(p => 
      p.category === 'song' || p.name === 'schedule.view'
    )
    
    // 管理员权限（除了用户管理）
    const adminPermissions = allPermissions.filter(p => 
      p.category !== 'user' || p.name === 'user.manage'
    )
    
    // 超级管理员权限（全部）
    const superAdminPermissions = allPermissions
    
    // 分配权限
    const rolePermissionMappings = [
      { role: userRole, permissions: userPermissions },
      { role: songAdminRole, permissions: songAdminPermissions },
      { role: adminRole, permissions: adminPermissions },
      { role: superAdminRole, permissions: superAdminPermissions }
    ]
    
    for (const mapping of rolePermissionMappings) {
      for (const permission of mapping.permissions) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: mapping.role.id,
              permissionId: permission.id
            }
          },
          update: {},
          create: {
            roleId: mapping.role.id,
            permissionId: permission.id,
            granted: true
          }
        })
      }
      console.log(`为角色 ${mapping.role.name} 分配了 ${mapping.permissions.length} 个权限`)
    }
    
    console.log('角色系统迁移完成！')
    
  } catch (error) {
    console.error('迁移失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateRoles()
    .then(() => {
      console.log('迁移成功完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('迁移失败:', error)
      process.exit(1)
    })
}

module.exports = { migrateRoles }
