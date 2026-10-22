import { navigateTo } from '#app'
import { useAuth } from '~/composables/useAuth'
import { useRbac } from '~/composables/useRbac'
import { useToast } from '~/composables/useToast'

interface ResetSessionOptions {
  /** 清理完成后跳转的目标；为空则不跳转 */
  redirectTo?: string | null
}

/** 删除 auth-token cookie；HTTPS 下同时删除 Secure 变体 */
const clearAuthTokenCookie = () => {
  if (!import.meta.client) {
    return
  }

  document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'

  if (window.location.protocol === 'https:') {
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure'
  }
}

/** 会话失效清理必须走完全程：单步失败只告警，不中断后续清理 */
const safeRun = async (label: string, step: () => void | Promise<void>) => {
  try {
    await step()
  } catch (error) {
    console.warn(`[session-reset] ${label} 失败:`, error)
  }
}

/** 唯一的会话重置入口：认证态、RBAC 缓存、用户筛选缓存、toast、auth-token cookie */
export const resetSession = async (options: ResetSessionOptions = {}) => {
  await safeRun('清理认证态', () => useAuth().clearAuthState())

  await safeRun('清理 RBAC 缓存', () => useRbac().reset())

  await safeRun('清理用户筛选缓存', async () => {
    // 函数体内动态导入：useUserFilters 顶层依赖 useAuth，静态导入会形成循环
    const { useUserFilters } = await import('~/composables/useUserFilters')
    useUserFilters().resetUserFilters()
  })

  await safeRun('清空 toast', () => {
    const { toasts, removeToast } = useToast()
    for (const toast of [...toasts.value]) {
      removeToast(toast.id)
    }
  })

  await safeRun('删除 auth-token cookie', clearAuthTokenCookie)

  const target = options.redirectTo
  if (target && import.meta.client) {
    await safeRun('跳转', () => navigateTo(target))
  }
}
