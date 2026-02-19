import { computed } from 'vue'
import { useAuth } from './useAuth'

export const usePermissions = () => {
  const auth = useAuth()

  // 检查用户是否可以访问后台
  const canAccessAdmin = computed(() => {
    if (!auth.user.value) return false
    const role = auth.user.value.role
    return ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(role)
  })

  // 检查用户是否可以访问指定页面
  const canAccessPage = (page: string): boolean => {
    if (!auth.user.value) return false

    const role = auth.user.value.role

    // 超级管理员可以访问所有页面
    if (role === 'SUPER_ADMIN') return true

    // 管理员可以访问的页面
    if (role === 'ADMIN') {
      return ['overview', 'schedule', 'print', 'songs', 'users', 'data-analysis'].includes(page)
    }

    // 歌曲管理员可以访问的页面
    if (role === 'SONG_ADMIN') {
      return ['schedule', 'print', 'songs'].includes(page)
    }

    return false
  }

  // 获取用户可访问的页面列表
  const getUserPages = computed(() => {
    if (!auth.user.value) return []

    const role = auth.user.value.role

    switch (role) {
      case 'SUPER_ADMIN':
        return [
          'overview',
          'schedule',
          'print',
          'songs',
          'users',
          'notifications',
          'smtp-config',
          'playtimes',
          'request-times',
          'semesters',
          'blacklist',
          'site-config',
          'database',
          'api-keys'
        ]
      case 'ADMIN':
        return ['overview', 'schedule', 'print', 'songs', 'users', 'data-analysis']
      case 'SONG_ADMIN':
        return ['schedule', 'print', 'songs']
      default:
        return []
    }
  })

  // 角色检查
  const isUser = computed(() => auth.user.value?.role === 'USER')
  const isSongAdmin = computed(() => auth.user.value?.role === 'SONG_ADMIN')
  const isAdmin = computed(() => auth.user.value?.role === 'ADMIN')
  const isSuperAdmin = computed(() => auth.user.value?.role === 'SUPER_ADMIN')

  // 权限组合检查
  const isAdminOrAbove = computed(() => {
    const role = auth.user.value?.role
    return ['ADMIN', 'SUPER_ADMIN'].includes(role)
  })

  const isSongAdminOrAbove = computed(() => {
    const role = auth.user.value?.role
    return ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(role)
  })

  // 检查是否可以管理用户角色
  const canManageUserRole = (targetRole: string): boolean => {
    if (!auth.user.value) return false

    // 只有超级管理员可以分配角色
    if (auth.user.value.role === 'SUPER_ADMIN') {
      return ['USER', 'SONG_ADMIN', 'ADMIN'].includes(targetRole)
    }

    return false
  }

  // 检查是否可以打印排期
  const canPrintSchedule = computed(() => {
    if (!auth.user.value) return false
    const role = auth.user.value.role
    return ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(role)
  })

  return {
    // 页面访问权限
    canAccessAdmin,
    canAccessPage,
    getUserPages,

    // 角色检查
    isUser,
    isSongAdmin,
    isAdmin,
    isSuperAdmin,
    isAdminOrAbove,
    isSongAdminOrAbove,

    // 功能权限
    canPrintSchedule,

    // 用户管理权限
    canManageUserRole
  }
}
