// 硬编码的四个角色配置
const ROLES = {
  USER: {
    displayName: '普通用户',
    description: '普通用户，只能访问主页功能',
    pages: [], // 不能访问后台页面
    canAccessAdmin: false
  },
  SONG_ADMIN: {
    displayName: '歌曲管理员',
    description: '负责歌曲和排期管理',
    pages: [
      'schedule', // 排期管理
      'print', // 打印排期
      'songs' // 歌曲管理
    ],
    canAccessAdmin: true
  },
  ADMIN: {
    displayName: '管理员',
    description: '系统管理员，拥有大部分权限',
    pages: [
      'overview', // 数据概览
      'schedule', // 排期管理
      'print', // 打印排期
      'songs', // 歌曲管理
      'users', // 用户管理
      'data-analysis' // 数据分析
    ],
    canAccessAdmin: true
  },
  SUPER_ADMIN: {
    displayName: '超级管理员',
    description: '拥有所有权限的超级管理员',
    pages: [
      'overview', // 数据概览
      'schedule', // 排期管理
      'print', // 打印排期
      'songs', // 歌曲管理
      'users', // 用户管理
      'notifications', // 通知管理
      'playtimes', // 播出时段
      'semesters', // 学期管理
      'blacklist', // 黑名单管理
      'site-config', // 站点配置
      'database', // 数据库操作
      'data-analysis' // 数据分析
    ],
    canAccessAdmin: true
  }
}

// 检查用户是否可以访问后台
function canAccessAdmin(user) {
  if (!user || !user.role) return false

  const roleConfig = ROLES[user.role]
  if (!roleConfig) return false

  return roleConfig.canAccessAdmin
}

// 检查用户是否可以访问指定页面
function canAccessPage(user, page) {
  if (!user || !user.role) return false

  // 超级管理员可以访问所有页面
  if (user.role === 'SUPER_ADMIN') return true

  const roleConfig = ROLES[user.role]
  if (!roleConfig) return false

  return roleConfig.pages.includes(page)
}

// 获取用户可访问的页面列表
function getUserPages(user) {
  if (!user || !user.role) return []

  const roleConfig = ROLES[user.role]
  if (!roleConfig) return []

  return roleConfig.pages
}

// 获取角色信息
function getRoleInfo(roleName) {
  return ROLES[roleName] || null
}

// 检查用户是否可以管理其他用户角色
function canManageUserRole(currentUser, targetRole) {
  if (!currentUser || !currentUser.role) return false

  // 只有超级管理员可以分配角色
  if (currentUser.role === 'SUPER_ADMIN') {
    // 超级管理员可以分配除自己以外的所有角色
    return ['USER', 'SONG_ADMIN', 'ADMIN'].includes(targetRole)
  }

  return false
}

// 导出所有函数和常量
export { ROLES, canAccessAdmin, canAccessPage, getUserPages, getRoleInfo, canManageUserRole }
