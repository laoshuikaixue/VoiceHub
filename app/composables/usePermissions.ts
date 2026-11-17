import { computed } from 'vue'
import { useAuth } from './useAuth'
import {
  ADMIN_CONSOLE_ROLES,
  MANAGER_ROLES,
  PAGE_PERMISSIONS,
  PRIV_GRANT,
  PRIV_ROLE_TEMPLATE,
  canAccessAdminConsole,
  canAccessAdminPage,
  canAssignRole,
  canUseAdminPage,
  hasPermission,
} from '~/utils/admin-permissions'

export const usePermissions = () => {
  const auth = useAuth()

  // 权限码由认证接口下发；未取得权限时不展示管理能力。
  const perms = computed(() => {
    const current = auth.user.value as any
    if (!current) return []
    if (Array.isArray(current.perms)) return current.perms
    return []
  })

  // 检查用户是否可以访问后台
  const canAccessAdmin = computed(() => canAccessAdminConsole(perms.value))

  // 检查用户是否可以访问指定页面
  const canAccessPage = (page: string): boolean => canAccessAdminPage(perms.value, page)
  const canUsePage = (page: string): boolean => canUseAdminPage(perms.value, page)
  const can = (code: string): boolean => canAccessAdmin.value && hasPermission(perms.value, code)

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

  // 角色分配受独立权限码与受保护角色约束，判定口径与后端 canAssignRole 一致
  // availableRoles 传入含动态角色的完整名单时按其判定
  const canManageUserRole = (targetRole: string, availableRoles?: readonly string[]): boolean =>
    canAssignRole(auth.user.value, targetRole, availableRoles)

  // 检查是否可以打印排期
  const canPrintSchedule = computed(() => can('schedule:read'))

  // 授权能力：编辑角色模板（权限矩阵）/ 按用户显式授权
  const canManageRoleTemplates = computed(() => can(PRIV_ROLE_TEMPLATE))
  const canGrantPermissions = computed(() => can(PRIV_GRANT))

  return {
    // 权限码
    perms,
    can,

    // 页面访问权限
    canAccessAdmin,
    canAccessPage,
    canUsePage,
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
    canManageRoleTemplates,
    canGrantPermissions,

    // 用户管理权限
    canManageUserRole
  }
}
