/**
 * useRbac — 前端 RBAC 权限 composable
 *
 * 行为：
 *   - 首次调用时 fetch /api/admin/rbac/my-permissions 拉取有效权限集合
 *   - 缓存到模块内 Map（同进程跨组件复用）
 *   - 失败时降级为空集（前端隐藏按钮但保留路由可见性，避免白屏）
 *   - SSR 守卫：服务端不读共享缓存（防止请求间泄漏）
 *
 * 接口：
 *   const rbac = useRbac()
 *   rbac.can('user.manage')           // 单权限判断
 *   rbac.canAny(['a','b'])            // 任一满足
 *   rbac.canAll(['a','b'])            // 全部满足
 *   rbac.canAccessPage('users')       // sidebar pageId → permission
 *   rbac.refresh()                    // 手动重拉（如角色变更后）
 */

import { computed, ref } from 'vue'
import {
  PERMISSIONS,
  getPagePermission,
  normalizePermission,
  type PermissionKey
} from '~/utils/rbac'

type RbacState = {
  loaded: boolean
  loading: boolean
  error: string | null
  permissions: Set<PermissionKey>
}

const cache = new Map<number, RbacState>()

function emptyState(): RbacState {
  return { loaded: false, loading: false, error: null, permissions: new Set() }
}

export const useRbac = () => {
  // 兼容 SSR：服务端不持有跨请求缓存
  const isServer = typeof window === 'undefined'

  const userIdRef = ref<number | null>(null)
  const stateRef = ref<RbacState>(emptyState())

  async function load(userId: number, force = false) {
    if (isServer) {
      stateRef.value = emptyState()
      return
    }
    const cached = cache.get(userId)
    if (cached && cached.loaded && !force) {
      stateRef.value = cached
      return
    }
    if (cached && cached.loading) {
      // 已有 in-flight 请求，等待
      stateRef.value = cached
      return
    }

    const next: RbacState = { ...emptyState(), loading: true }
    cache.set(userId, next)
    stateRef.value = next

    try {
      const response = await $fetch<{ permissions: string[] }>(
        '/api/admin/rbac/my-permissions'
      )
      const perms = new Set<PermissionKey>()
      for (const raw of response?.permissions ?? []) {
        const normalized = normalizePermission(raw)
        if (normalized) perms.add(normalized)
      }
      const done: RbacState = {
        loaded: true,
        loading: false,
        error: null,
        permissions: perms
      }
      cache.set(userId, done)
      stateRef.value = done
    } catch (err: any) {
      const fail: RbacState = {
        loaded: true,
        loading: false,
        error: err?.message || String(err),
        permissions: new Set()
      }
      cache.set(userId, fail)
      stateRef.value = fail
    }
  }

  function bind(userId: number | null | undefined) {
    if (userId == null) {
      userIdRef.value = null
      stateRef.value = emptyState()
      return
    }
    if (userIdRef.value !== userId) {
      userIdRef.value = userId
      stateRef.value = emptyState()
    }
    if (!stateRef.value.loaded && !stateRef.value.loading) {
      // fire and forget
      load(userId)
    }
  }

  function can(key: PermissionKey | string): boolean {
    const k = normalizePermission(key) ?? (key as PermissionKey)
    return stateRef.value.permissions.has(k)
  }

  function canAny(keys: Array<PermissionKey | string>): boolean {
    return keys.some((k) => can(k))
  }

  function canAll(keys: Array<PermissionKey | string>): boolean {
    return keys.every((k) => can(k))
  }

  function canAccessPage(pageId: string): boolean {
    const key = getPagePermission(pageId)
    if (!key) return false
    return stateRef.value.permissions.has(key)
  }

  const loaded = computed(() => stateRef.value.loaded)
  const loading = computed(() => stateRef.value.loading)
  const permissions = computed(() => stateRef.value.permissions)
  const error = computed(() => stateRef.value.error)

  async function refresh() {
    if (userIdRef.value == null) return
    await load(userIdRef.value, true)
  }

  return {
    bind,
    can,
    canAny,
    canAll,
    canAccessPage,
    refresh,
    loaded,
    loading,
    permissions,
    error,
    PERMISSIONS
  }
}

/**
 * 全局缓存清理工具（用户登出 / 切换账号时调用）
 */
export function clearRbacCache(userId?: number) {
  if (userId == null) {
    cache.clear()
  } else {
    cache.delete(userId)
  }
}
