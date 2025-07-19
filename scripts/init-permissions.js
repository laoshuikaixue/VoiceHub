#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 定义默认权限
const defaultPermissions = [
  // 歌曲相关权限
  {
    name: 'song_request',
    displayName: '点歌投稿',
    description: '允许用户点歌和投稿',
    category: 'song'
  },
  {
    name: 'song_vote',
    displayName: '歌曲投票',
    description: '允许用户为歌曲投票',
    category: 'song'
  },
  {
    name: 'song_manage',
    displayName: '歌曲管理',
    description: '管理歌曲列表，删除歌曲等',
    category: 'song'
  },
  
  // 排期相关权限
  {
    name: 'schedule_view',
    displayName: '查看排期',
    description: '查看歌曲播放排期',
    category: 'schedule'
  },
  {
    name: 'schedule_manage',
    displayName: '排期管理',
    description: '编辑和管理歌曲播放排期',
    category: 'schedule'
  },
  
  // 用户相关权限
  {
    name: 'user_manage',
    displayName: '用户管理',
    description: '管理用户账户，添加删除用户',
    category: 'user'
  },
  {
    name: 'permission_manage',
    displayName: '权限管理',
    description: '管理用户权限和角色',
    category: 'user'
  },
  
  // 系统相关权限
  {
    name: 'system_settings',
    displayName: '系统设置',
    description: '修改系统设置和配置',
    category: 'system'
  },
  {
    name: 'notification_send',
    displayName: '发送通知',
    description: '向用户发送系统通知',
    category: 'system'
  },
  {
    name: 'blacklist_manage',
    displayName: '黑名单管理',
    description: '管理歌曲黑名单和关键词过滤',
    category: 'system'
  },
  {
    name: 'semester_manage',
    displayName: '学期管理',
    description: '管理学期设置',
    category: 'system'
  }
];

// 定义角色权限映射
const rolePermissions = {
  USER: [
    'song_request',
    'song_vote',
    'schedule_view'
  ],
  SONG_ADMIN: [
    'song_request',
    'song_vote',
    'schedule_view',
    'song_manage',
    'schedule_manage'
  ],
  ADMIN: [
    // 超级管理员拥有所有权限
    'song_request',
    'song_vote',
    'schedule_view',
    'song_manage',
    'schedule_manage',
    'user_manage',
    'permission_manage',
    'system_settings',
    'notification_send',
    'blacklist_manage',
    'semester_manage'
  ],
  SUPER_ADMIN: [
    // 超级管理员拥有所有权限（与ADMIN相同）
    'song_request',
    'song_vote',
    'schedule_view',
    'song_manage',
    'schedule_manage',
    'user_manage',
    'permission_manage',
    'system_settings',
    'notification_send',
    'blacklist_manage',
    'semester_manage'
  ]
};

async function initPermissions() {
  console.log('🔐 初始化权限系统...');
  
  try {
    // 1. 创建权限
    console.log('📝 创建默认权限...');
    for (const permission of defaultPermissions) {
      await prisma.permission.upsert({
        where: { name: permission.name },
        update: permission,
        create: permission
      });
      console.log(`✅ 权限创建/更新: ${permission.displayName}`);
    }
    
    // 2. 为角色分配权限
    console.log('🎭 配置角色权限...');
    for (const [role, permissions] of Object.entries(rolePermissions)) {
      // 先删除现有的角色权限
      await prisma.rolePermission.deleteMany({
        where: { role: role }
      });
      
      // 创建新的角色权限
      for (const permissionName of permissions) {
        const permission = await prisma.permission.findUnique({
          where: { name: permissionName }
        });
        
        if (permission) {
          await prisma.rolePermission.create({
            data: {
              role: role,
              permissionId: permission.id,
              granted: true
            }
          });
        }
      }
      console.log(`✅ 角色权限配置完成: ${role} (${permissions.length}个权限)`);
    }
    
    console.log('🎉 权限系统初始化完成！');
    
  } catch (error) {
    console.error('❌ 权限系统初始化失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initPermissions();
