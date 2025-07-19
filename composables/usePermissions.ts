import { ref, computed } from 'vue'
import { useAuth } from './useAuth'

// 权限缓存
const permissionCache = ref(new Set<string>())
const cacheTimestamp = ref(0)
const CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

export const usePermissions = () => {
  const auth = useAuth()
  const loading = ref(false)
  const error = ref('')

  // 获取用户权限
  const fetchUserPermissions = async (force = false) => {
    // 检查缓存
    if (!force && Date.now() - cacheTimestamp.value < CACHE_TTL && permissionCache.value.size > 0) {
      return permissionCache.value
    }

    if (!auth.isAuthenticated.value || !auth.user.value) {
      permissionCache.value.clear()
      return permissionCache.value
    }

    loading.value = true
    error.value = ''

    try {
      const response = await $fetch(`/api/admin/permissions/user/${auth.user.value.id}`, {
        ...auth.getAuthHeader()
      })

      const permissions = new Set<string>()
      response.permissions.forEach((perm: any) => {
        if (perm.granted) {
          permissions.add(perm.name)
        }
      })

      permissionCache.value = permissions
      cacheTimestamp.value = Date.now()
      
      return permissions
    } catch (err) {
      console.error('获取用户权限失败:', err)
      error.value = '获取权限失败'
      return new Set<string>()
    } finally {
      loading.value = false
    }
  }

  // 检查是否有指定权限
  const hasPermission = async (permission: string): Promise<boolean> => {
    const permissions = await fetchUserPermissions()
    return permissions.has(permission)
  }

  // 检查是否有任一权限
  const hasAnyPermission = async (permissions: string[]): Promise<boolean> => {
    const userPermissions = await fetchUserPermissions()
    return permissions.some(permission => userPermissions.has(permission))
  }

  // 检查是否有所有权限
  const hasAllPermissions = async (permissions: string[]): Promise<boolean> => {
    const userPermissions = await fetchUserPermissions()
    return permissions.every(permission => userPermissions.has(permission))
  }

  // 清除权限缓存
  const clearCache = () => {
    permissionCache.value.clear()
    cacheTimestamp.value = 0
  }

  // 基于角色的快速权限检查（不需要API调用）
  const hasRolePermission = (permission: string): boolean => {
    if (!auth.user.value) return false
    
    const role = auth.user.value.role
    
    // 超级管理员拥有所有权限
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      return true
    }
    
    // 歌曲管理员的权限
    if (role === 'SONG_ADMIN') {
      const songAdminPermissions = [
        'song_request',
        'song_vote',
        'schedule_view',
        'song_manage',
        'schedule_manage'
      ]
      return songAdminPermissions.includes(permission)
    }
    
    // 普通用户的权限
    if (role === 'USER') {
      const userPermissions = [
        'song_request',
        'song_vote',
        'schedule_view'
      ]
      return userPermissions.includes(permission)
    }
    
    return false
  }

  // 计算属性：常用权限检查
  const canRequestSongs = computed(() => hasRolePermission('song_request'))
  const canVoteSongs = computed(() => hasRolePermission('song_vote'))
  const canManageSongs = computed(() => hasRolePermission('song_manage'))
  const canManageSchedule = computed(() => hasRolePermission('schedule_manage'))
  const canManageUsers = computed(() => hasRolePermission('user_manage'))
  const canManagePermissions = computed(() => hasRolePermission('permission_manage'))
  const canManageBlacklist = computed(() => hasRolePermission('blacklist_manage'))
  const canManageSystem = computed(() => hasRolePermission('system_settings'))

  // 权限组合检查
  const isAdmin = computed(() => {
    const role = auth.user.value?.role
    return role === 'ADMIN' || role === 'SUPER_ADMIN'
  })

  const isSongAdmin = computed(() => {
    const role = auth.user.value?.role
    return role === 'SONG_ADMIN' || role === 'ADMIN' || role === 'SUPER_ADMIN'
  })

  return {
    loading,
    error,
    permissionCache: computed(() => permissionCache.value),
    
    // 方法
    fetchUserPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRolePermission,
    clearCache,
    
    // 常用权限检查
    canRequestSongs,
    canVoteSongs,
    canManageSongs,
    canManageSchedule,
    canManageUsers,
    canManagePermissions,
    canManageBlacklist,
    canManageSystem,
    
    // 角色检查
    isAdmin,
    isSongAdmin
  }
}
