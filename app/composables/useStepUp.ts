import { ref } from 'vue'

export const STEP_UP_REASON_SUPER_ADMIN = 'super-admin-role'

/**
 * 敏感操作二次验证的弹窗状态与等待编排。
 * 验证结果由服务端按「场景 + 用户 + 会话」记录，前端只负责打开弹窗并等待结果。
 */
export const useStepUp = () => {
  const show = ref(false)
  const reason = ref(STEP_UP_REASON_SUPER_ADMIN)
  let resolver: ((verified: boolean) => void) | null = null

  const settle = (verified: boolean) => {
    show.value = false
    const resolve = resolver
    resolver = null
    resolve?.(verified)
  }

  // 打开验证弹窗并等待结果，用户取消时返回 false
  const requestStepUp = (nextReason: string = STEP_UP_REASON_SUPER_ADMIN): Promise<boolean> =>
    new Promise((resolve) => {
      if (resolver) resolver(false)
      reason.value = nextReason
      show.value = true
      resolver = resolve
    })

  return { show, reason, requestStepUp, settle }
}
