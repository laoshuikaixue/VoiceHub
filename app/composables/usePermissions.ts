import { computed } from 'vue'
import { useAuth } from './useAuth'
import {
  ADMIN_ACCESS_ROLES,
  SUPER_ADMIN_ROLES,
  SYSTEM_ADMIN_ROLES,
  resolveEffectivePermissions
} from '~/utils/adminPermissions'

// 后台页面可见性：codes 命中任一即可见，roles 为角色兜底
const ADMIN_PAGES: Record<string, { codes?: string[]; roles?: readonly string[] }> = {
  overview: { roles: ADMIN_ACCESS_ROLES },
  schedule: { roles: ADMIN_ACCESS_ROLES },
  print: { roles: ADMIN_ACCESS_ROLES },
  songs: { codes: ['songs:read'] },
  'data-analysis': { roles: ADMIN_ACCESS_ROLES },
  'card-codes': { codes: ['card-codes:write'] },
  playtimes: { roles: ADMIN_ACCESS_ROLES },
  'request-times': { roles: ADMIN_ACCESS_ROLES },
  semesters: { roles: ADMIN_ACCESS_ROLES },
  users: { codes: ['user:manage'] },
  'grade-class': { roles: SYSTEM_ADMIN_ROLES },
  notifications: { roles: SUPER_ADMIN_ROLES },
  'smtp-config': { roles: SUPER_ADMIN_ROLES },
  blacklist: { roles: SUPER_ADMIN_ROLES },
  'site-config': { roles: SUPER_ADMIN_ROLES },
  database: { roles: SUPER_ADMIN_ROLES },
  'api-keys': { roles: SUPER_ADMIN_ROLES },
  'music-source': { roles: SYSTEM_ADMIN_ROLES },
  'system-board': { roles: SUPER_ADMIN_ROLES },
  // 修改密码为侧边栏独立入口，跳转 /change-password
  password: { roles: ADMIN_ACCESS_ROLES }
}

// 页面写操作所需权限码，未列出的页面按角色档位判断
const PAGE_WRITE_PERMISSIONS: Record<string, string> = {
  schedule: 'schedule:write',
  playtimes: 'play-times:write',
  'request-times': 'request-times:write',
  semesters: 'semester:write',
  'card-codes': 'card-codes:write'
}

export const usePermissions = () => {
  const auth = useAuth()

  const role = computed(() => auth.user.value?.role || '')
  const effectiveCodes = computed<string[]>(() => resolveEffectivePermissions(auth.user.value))

  const hasPermission = (code: string): boolean => effectiveCodes.value.includes(code)

  const canAccessAdmin = computed(() => ADMIN_ACCESS_ROLES.includes(role.value))

  const canAccessPage = (page: string): boolean => {
    if (!auth.user.value) return false
    const rule = ADMIN_PAGES[page]
    if (!rule) return false
    if (rule.codes?.some((code) => effectiveCodes.value.includes(code))) return true
    return Boolean(rule.roles?.includes(role.value))
  }

  const canEdit = (page: string): boolean => {
    if (!canAccessPage(page)) return false
    const code = PAGE_WRITE_PERMISSIONS[page]
    if (code) return hasPermission(code)
    return SYSTEM_ADMIN_ROLES.includes(role.value)
  }

  const getUserPages = computed(() =>
    Object.keys(ADMIN_PAGES).filter((page) => canAccessPage(page))
  )

  // 角色检查
  const isUser = computed(() => role.value === 'USER')
  const isSongAdmin = computed(() => role.value === 'SONG_ADMIN')
  const isAdmin = computed(() => role.value === 'ADMIN')
  const isSuperAdmin = computed(() => role.value === 'SUPER_ADMIN')

  // 权限组合检查
  const isAdminOrAbove = computed(() => SYSTEM_ADMIN_ROLES.includes(role.value))

  const isSongAdminOrAbove = computed(() => canAccessAdmin.value)

  // 检查是否可以管理用户角色
  const canManageUserRole = (targetRole: string): boolean => {
    if (!auth.user.value) return false
    if (role.value === 'SUPER_ADMIN') {
      return ['USER', 'SONG_ADMIN', 'ADMIN'].includes(targetRole)
    }
    return false
  }

  // 检查是否可以打印排期
  const canPrintSchedule = computed(() => canAccessAdmin.value)

  return {
    // 页面访问权限
    canAccessAdmin,
    canAccessPage,
    getUserPages,

    // 细粒度权限
    hasPermission,
    canEdit,
    effectiveCodes,

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
