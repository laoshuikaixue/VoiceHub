import { computed } from 'vue'
import { useAuth } from './useAuth'
import {
  ADMIN_CONSOLE_ROLES,
  MANAGER_ROLES,
  PAGE_PERMISSIONS,
  ROLE_PERMISSION_TEMPLATES_DEFAULT,
  canAccessAdminConsole,
  canAccessAdminPage,
  hasAnyPermission,
  resolveEffectivePermissions
} from '~/utils/admin-permissions'

export const usePermissions = () => {
  const auth = useAuth()

  // 权限码由 /api/auth/verify 与登录接口下发；缺失时按角色默认模板回落，避免登录首屏无权限
  const perms = computed(() => {
    const current = auth.user.value as any
    if (!current) return []
    if (Array.isArray(current.perms)) return current.perms
    return resolveEffectivePermissions({ role: current.role }, ROLE_PERMISSION_TEMPLATES_DEFAULT)
  })

  // 检查用户是否可以访问后台
  const canAccessAdmin = computed(() => canAccessAdminConsole(perms.value))

  // 检查用户是否可以访问指定页面
  const canAccessPage = (page: string): boolean => canAccessAdminPage(perms.value, page)

  // 获取用户可访问的页面列表（修改密码不属于后台页面）
  const getUserPages = computed(() =>
    Object.keys(PAGE_PERMISSIONS).filter((page) => page !== 'password' && canAccessAdminPage(perms.value, page))
  )

  // 角色检查：用于身份展示，能力判断一律走权限码
  const isUser = computed(() => auth.user.value?.role === 'USER')
  const isSongAdmin = computed(() => auth.user.value?.role === 'SONG_ADMIN')
  const isAdmin = computed(() => auth.user.value?.role === 'ADMIN')
  const isSuperAdmin = computed(() => auth.user.value?.role === 'SUPER_ADMIN')

  const isAdminOrAbove = computed(() => MANAGER_ROLES.includes(auth.user.value?.role || ''))
  const isSongAdminOrAbove = computed(() => ADMIN_CONSOLE_ROLES.includes(auth.user.value?.role || ''))

  // 分配角色尚无独立权限码，保持仅超级管理员可分配
  const canManageUserRole = (targetRole: string): boolean => {
    if (auth.user.value?.role !== 'SUPER_ADMIN') return false
    return ['USER', 'SONG_ADMIN', 'ADMIN'].includes(targetRole)
  }

  // 检查是否可以打印排期
  const canPrintSchedule = computed(() => hasAnyPermission(perms.value, ['schedule:read']))

  return {
    // 权限码
    perms,

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
