/**
 * useRbac — 前端 RBAC 权限 composable
 *
 * 行为：
 *   - 首次调用时 fetch /api/admin/rbac/my-permissions 拉取有效权限集合
 *   - 缓存到模块内 Map（同进程跨组件复用）
 *   - 失败时：保留上次成功缓存并标记 degraded；首次失败时设空集并 1s 后自动 retry 一次，retry 仍失败则 toast 警告 + degraded 终态（W12 A4-2 / A6-3 修复）
 *   - SSR 守卫：服务端不读共享缓存（防止请求间泄漏）
 *   - 未知 pageId 对 SUPER_ADMIN 兜底放行，避免漏配静默锁出
 *
 * 接口：
 *   const rbac = useRbac()
 *   rbac.can('user.manage')           // 单权限判断
 *   rbac.canAny(['a','b'])            // 任一满足
 *   rbac.canAll(['a','b'])            // 全部满足
 *   rbac.canAccessPage('users')       // sidebar pageId → permission
 *   rbac.refresh()                    // 手动重拉（如角色变更后）
 *   rbac.degraded                     // 当前是否处于降级状态（permissions 不可信）
 *   clearRbacCache()                  // 顶层导出：登出/切换账号时清缓存（W12 A4-3 修复）
 */

import { computed, ref } from 'vue'
import {
  PERMISSIONS,
  getPagePermission,
  normalizePermission,
  type PermissionKey
} from '~/utils/rbac'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'

type RbacState = {
  loaded: boolean
  loading: boolean
  error: string | null
  permissions: Set<PermissionKey>
  superAdmin?: boolean
  retryCount?: number
  degraded?: boolean // true 表示当前未成功拉取过权限集合（空集不可信）；UI 可见
}

const cache = new Map<number, RbacState>()

// 模块级 state：多次 useRbac() 共享同一 ref，保证 Sidebar / ApiKeyManager / RbacManager
// 组件间 state 同步（A4-1 修复）
const userIdRef = ref<number | null>(null)
const stateRef = ref<RbacState>({ loaded: false, loading: false, error: null, permissions: new Set() })

// 首次失败后自动 retry 一次（1s 后），避免一次 5xx 永久锁出 sidebar（W12 A4-2 修复：3s → 1s）
const AUTO_RETRY_DELAY_MS = 1000
const MAX_AUTO_RETRY = 1

function emptyState(): RbacState {
  return { loaded: false, loading: false, error: null, permissions: new Set() }
}

export const useRbac = () => {
  // 兼容 SSR：服务端不持有跨请求缓存
  const isServer = typeof window === 'undefined'

  async function load(userId: number, force = false) {
    if (isServer) {
      stateRef.value = emptyState()
      return
    }
    const cached = cache.get(userId)
    if (cached && cached.loaded && !force && !cached.error) {
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
      // 后端响应被外层 { success, data } 包了一层,需解包 .data(W5 hidden bug 修复)
      const response = await $fetch<{ success: boolean; data: { permissions: string[] } }>(
        '/api/admin/rbac/my-permissions'
      )
      const perms = new Set<PermissionKey>()
      for (const raw of response?.data?.permissions ?? []) {
        const normalized = normalizePermission(raw)
        if (normalized) perms.add(normalized)
      }
      // superAdmin 优先从 response 读取，未提供时兜底 useAuth().user.value?.role
      let isSuperAdmin = false
      if (import.meta.client) {
        try {
          isSuperAdmin = useAuth().user.value?.role === 'SUPER_ADMIN'
        } catch {
          // useAuth 不可用，保持 false
        }
      }
      const done: RbacState = {
        loaded: true,
        loading: false,
        error: null,
        permissions: perms,
        superAdmin: isSuperAdmin
      }
      cache.set(userId, done)
      stateRef.value = done
    } catch (err: any) {
      const errMessage = err?.message || String(err)
      const prev = cache.get(userId)
      if (prev && prev.loaded && !prev.error) {
        // 已有成功缓存：保留上次成功集合，仅标记 error 和 degraded（A4-2 / A6-3 修复）
        const fail: RbacState = { ...prev, error: errMessage, degraded: true }
        cache.set(userId, fail)
        stateRef.value = fail
      } else {
        // 首次或持续失败：设空集，按 MAX_AUTO_RETRY 次数自动 retry
        const retryCount = (prev?.retryCount ?? 0) + 1
        // 超过重试上限 = degraded 终态（不会再 retry）
        const isFinalFailure = retryCount > MAX_AUTO_RETRY
        const fail: RbacState = {
          loaded: true,
          loading: false,
          error: errMessage,
          permissions: new Set(),
          retryCount,
          degraded: isFinalFailure
        }
        cache.set(userId, fail)
        stateRef.value = fail
        if (typeof window !== 'undefined' && !isFinalFailure) {
          setTimeout(() => {
            // 仅当 userIdRef 仍指向同一用户时才 retry，避免登出/切换账号后误触发
            if (userIdRef.value === userId) {
              void load(userId, true)
            }
          }, AUTO_RETRY_DELAY_MS)
        } else if (isFinalFailure) {
          // retry 仍失败：toast 警告用户当前处于降级状态（W12 A4-2 验收）
          try {
            const { warning } = useToast()
            warning('权限加载失败，部分功能可能不可用，请刷新页面重试', 5000)
          } catch {
            // useToast 不可用，静默降级
          }
        }
      }
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
    if (!key) {
      // 未知 pageId：SUPER_ADMIN 兜底通过，避免漏配静默锁出所有用户（A5-1 修复）
      if (stateRef.value.superAdmin === true) return true
      if (import.meta.client) {
        try {
          if (useAuth().user.value?.role === 'SUPER_ADMIN') return true
        } catch {
          // useAuth 不可用，保持 false
        }
      }
      return false
    }
    return stateRef.value.permissions.has(key)
  }

  const loaded = computed(() => stateRef.value.loaded)
  const loading = computed(() => stateRef.value.loading)
  const permissions = computed(() => stateRef.value.permissions)
  const error = computed(() => stateRef.value.error)
  // degraded=true 表示当前 permissions 不可信（曾失败 / 首次失败且 retry 已耗尽）
  const degraded = computed(() => stateRef.value.degraded === true)

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
    degraded,
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
  // 重置模块级 state,避免下一账号 login 完成前的权限泄露窗口 (W6 修复)
  stateRef.value = emptyState()
  userIdRef.value = null
}
