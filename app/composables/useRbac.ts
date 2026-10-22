/**
 * RBAC 前端镜像 composable —— 单一数据源：GET /api/admin/rbac/my-permissions
 *
 * 模块级共享缓存 + in-flight promise 去重（并发调用只发一次请求），
 * 与 usePlatformConfig.ts 的缓存写法保持一致。
 * SSR 阶段不读不写共享缓存（refresh / ensureLoaded 均有 import.meta.server 守卫），
 * 避免同一 Node 进程内多个并发 SSR 请求相互污染权限集。
 */

import { computed, ref } from 'vue'
import {
  canAccessAdmin as canAccessAdminBySet,
  canAccessPage as canAccessPageBySet,
  getUserPages as getUserPagesBySet,
  type PermissionSet
} from '~/utils/rbac-page-access'

/** 接口 data 段（字段全部按 unknown 收，解析时逐项收窄） */
type MyPermissionsPayload = {
  permissions?: unknown
  superAdmin?: unknown
  degraded?: unknown
  degradedReason?: unknown
}

const cache = {
  permissions: ref<Set<string>>(new Set()),
  superAdmin: ref(false),
  loaded: ref(false),
  degraded: ref(false),
  degradedReason: ref<string | null>(null),
  error: ref<string | null>(null),
  /** 加载中的 promise，避免并发重复请求 */
  inflight: null as Promise<void> | null,
  /** 会话代号：reset 后自增，用于丢弃 reset 之前发出的在途响应 */
  generation: 0
}

/** 容错解析权限数组：非数组、含非字符串项一律丢弃，禁止直接采用解析结果 */
const parsePermissionList = (value: unknown): Set<string> => {
  const result = new Set<string>()
  if (!Array.isArray(value)) return result
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0) result.add(item)
  }
  return result
}

const applyPayload = (payload: MyPermissionsPayload | undefined) => {
  cache.permissions.value = parsePermissionList(payload?.permissions)
  cache.superAdmin.value = payload?.superAdmin === true
  cache.degraded.value = payload?.degraded === true
  cache.degradedReason.value =
    typeof payload?.degradedReason === 'string' ? payload.degradedReason : null
  cache.error.value = null
  cache.loaded.value = true
}

const doLoad = async (generation: number) => {
  try {
    const res = await $fetch<{ data?: MyPermissionsPayload }>('/api/admin/rbac/my-permissions')
    if (generation !== cache.generation) return
    applyPayload(res?.data)
  } catch (err) {
    if (generation !== cache.generation) return
    // 失败降级为空集并把原因暴露给 UI：错误只记录，绝不抛到渲染层
    const reason = err instanceof Error ? err.message : '权限集合拉取失败'
    cache.permissions.value = new Set()
    cache.superAdmin.value = false
    cache.degraded.value = true
    cache.degradedReason.value = reason
    cache.error.value = reason
    cache.loaded.value = true
  }
}

/** 复用进行中的请求；没有则新建一次 */
const runLoad = (): Promise<void> => {
  if (cache.inflight) return cache.inflight
  cache.inflight = doLoad(cache.generation).finally(() => {
    cache.inflight = null
  })
  return cache.inflight
}

/** 已加载则直接返回，否则拉取（并发调用共享同一次请求） */
const ensureLoaded = async () => {
  if (import.meta.server) return
  if (cache.loaded.value) return
  await runLoad()
}

/** 强制重新拉取；SSR 阶段直接返回，防止污染共享缓存 */
const refresh = async () => {
  if (import.meta.server) return
  cache.loaded.value = false
  await runLoad()
}

/** 清空缓存，供会话失效 / 登出 / 切号时调用 */
const reset = () => {
  cache.generation += 1
  cache.permissions.value = new Set()
  cache.superAdmin.value = false
  cache.loaded.value = false
  cache.degraded.value = false
  cache.degradedReason.value = null
  cache.error.value = null
  cache.inflight = null
}

export const useRbac = () => {
  const permissions = computed<PermissionSet>(() => cache.permissions.value)
  const superAdmin = computed(() => cache.superAdmin.value)
  const loaded = computed(() => cache.loaded.value)
  const degraded = computed(() => cache.degraded.value)
  const degradedReason = computed(() => cache.degradedReason.value)
  const error = computed(() => cache.error.value)

  /** 是否拥有某个权限 key；超管恒真 */
  const can = (key: string): boolean =>
    cache.superAdmin.value || cache.permissions.value.has(key)

  const canAccessPage = (pageId: string): boolean =>
    canAccessPageBySet(cache.permissions.value, pageId, cache.superAdmin.value)

  const getUserPages = computed(() =>
    getUserPagesBySet(cache.permissions.value, cache.superAdmin.value)
  )

  const canAccessAdmin = computed(() =>
    canAccessAdminBySet(cache.permissions.value, cache.superAdmin.value)
  )

  return {
    permissions,
    superAdmin,
    loaded,
    degraded,
    degradedReason,
    error,
    can,
    canAccessPage,
    canAccessAdmin,
    getUserPages,
    ensureLoaded,
    refresh,
    reset
  }
}
