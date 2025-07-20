// 权限定义
const PERMISSIONS = {
  // 歌曲管理权限
  'song.view': '查看歌曲',
  'song.submit': '投稿歌曲',
  'song.manage': '管理歌曲',
  'song.vote': '投票',
  'song.delete': '删除歌曲',
  
  // 排期管理权限
  'schedule.view': '查看排期',
  'schedule.manage': '管理排期',
  'schedule.create': '创建排期',
  'schedule.edit': '编辑排期',
  'schedule.delete': '删除排期',
  
  // 用户管理权限
  'user.view': '查看用户',
  'user.manage': '管理用户',
  'user.create': '创建用户',
  'user.edit': '编辑用户',
  'user.delete': '删除用户',
  'user.reset_password': '重置密码',
  
  // 角色管理权限
  'role.view': '查看角色',
  'role.manage': '管理角色',
  'role.create': '创建角色',
  'role.edit': '编辑角色',
  'role.delete': '删除角色',
  
  // 系统管理权限
  'system.settings': '系统设置',
  'system.notifications': '通知管理',
  'system.blacklist': '黑名单管理',
  'system.semesters': '学期管理',
  'system.backup': '数据备份',
  'system.logs': '查看日志'
}

// 权限分类
const PERMISSION_CATEGORIES = {
  'song': {
    name: '歌曲管理',
    permissions: ['song.view', 'song.submit', 'song.manage', 'song.vote', 'song.delete']
  },
  'schedule': {
    name: '排期管理', 
    permissions: ['schedule.view', 'schedule.manage', 'schedule.create', 'schedule.edit', 'schedule.delete']
  },
  'user': {
    name: '用户管理',
    permissions: ['user.view', 'user.manage', 'user.create', 'user.edit', 'user.delete', 'user.reset_password']
  },
  'role': {
    name: '角色管理',
    permissions: ['role.view', 'role.manage', 'role.create', 'role.edit', 'role.delete']
  },
  'system': {
    name: '系统管理',
    permissions: ['system.settings', 'system.notifications', 'system.blacklist', 'system.semesters', 'system.backup', 'system.logs']
  }
}

// 默认角色配置
const DEFAULT_ROLES = {
  'USER': {
    displayName: '普通用户',
    description: '普通用户，可以投稿歌曲和投票',
    permissions: ['song.view', 'song.submit', 'song.vote', 'schedule.view'],
    isSystem: true
  },
  'SONG_ADMIN': {
    displayName: '歌曲管理员',
    description: '负责歌曲和排期管理',
    permissions: [
      'song.view', 'song.submit', 'song.manage', 'song.vote', 'song.delete',
      'schedule.view', 'schedule.manage', 'schedule.create', 'schedule.edit', 'schedule.delete'
    ],
    isSystem: true
  },
  'ADMIN': {
    displayName: '管理员',
    description: '系统管理员，拥有大部分权限',
    permissions: [
      // 歌曲权限
      'song.view', 'song.submit', 'song.manage', 'song.vote', 'song.delete',
      // 排期权限
      'schedule.view', 'schedule.manage', 'schedule.create', 'schedule.edit', 'schedule.delete',
      // 用户权限
      'user.view', 'user.manage', 'user.create', 'user.edit', 'user.delete', 'user.reset_password',
      // 系统权限
      'system.settings', 'system.notifications', 'system.blacklist', 'system.semesters'
    ],
    isSystem: true
  },
  'SUPER_ADMIN': {
    displayName: '超级管理员',
    description: '拥有所有权限的超级管理员',
    permissions: Object.keys(PERMISSIONS),
    isSystem: true
  }
}

// 检查用户是否有指定权限
function hasPermission(user, permission) {
  if (!user || !user.role) return false
  
  // 超级管理员拥有所有权限
  if (user.role === 'SUPER_ADMIN') return true
  
  // 从默认角色配置中检查权限
  const roleConfig = DEFAULT_ROLES[user.role]
  if (!roleConfig) return false
  
  return roleConfig.permissions.includes(permission)
}

// 检查用户是否有任一权限
function hasAnyPermission(user, permissions) {
  return permissions.some(permission => hasPermission(user, permission))
}

// 检查用户是否有所有权限
function hasAllPermissions(user, permissions) {
  return permissions.every(permission => hasPermission(user, permission))
}

// 获取用户的所有权限
function getUserPermissions(user) {
  if (!user || !user.role) return []

  const roleConfig = DEFAULT_ROLES[user.role]
  if (!roleConfig) return []

  return roleConfig.permissions
}

// 获取角色的权限
function getRolePermissions(roleName) {
  const roleConfig = DEFAULT_ROLES[roleName]
  return roleConfig ? roleConfig.permissions : []
}

// 导出所有函数和常量
export {
  PERMISSIONS,
  PERMISSION_CATEGORIES,
  DEFAULT_ROLES,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserPermissions,
  getRolePermissions
}
