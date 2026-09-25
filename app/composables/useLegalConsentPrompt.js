// 全局条款确认提示（弹窗模式）：登录成功后按账号校验是否需要确认当前条款版本，覆盖所有登录方式
import { useAuth } from '~/composables/useAuth'
import { useSiteConfig } from '~/composables/useSiteConfig'

// consentResolver/inflightCheck 仅由客户端交互逻辑读写，SSR 渲染阶段不会访问
let consentResolver = null
let inflightCheck = null

export const useLegalConsentPrompt = () => {
  const visible = useState('legalConsentPromptVisible', () => false)
  const pendingVersion = useState('legalConsentPromptVersion', () => '')
  const { legalConsentEnabled, legalConsentDocuments, legalConsentDisplayMode, legalConsentVersion } = useSiteConfig()
  const auth = useAuth()

  const promptActive = computed(
    () =>
      legalConsentEnabled.value &&
      legalConsentDocuments.value.length > 0 &&
      legalConsentDisplayMode.value === 'modal'
  )

  // 返回 true=允许进入系统（无需确认或已确认），false=用户拒绝条款（会话已终止）
  const ensureLegalConsent = () => {
    if (!promptActive.value || !auth.isAuthenticated.value) return Promise.resolve(true)
    // 并发去重：登录跳转与全局监听同时触发时共用同一次校验
    if (inflightCheck) return inflightCheck
    inflightCheck = (async () => {
      let status
      try {
        status = await $fetch('/api/legal-consent')
      } catch {
        // 状态查询失败不阻断进入系统
        return true
      }
      if (!status?.enabled || status.accepted || !status.consentVersion) return true
      pendingVersion.value = status.consentVersion
      visible.value = true
      return new Promise((resolve) => {
        consentResolver = resolve
      })
    })().finally(() => {
      inflightCheck = null
    })
    return inflightCheck
  }

  const resolveLegalConsentPrompt = (accepted) => {
    const resolve = consentResolver
    consentResolver = null
    if (resolve) resolve(accepted)
  }

  // 注册前确认：未登录场景弹出条款弹窗，同意后由注册请求显式携带同意版本
  const ensureLegalConsentForRegister = () => {
    if (!promptActive.value || !legalConsentVersion.value) return Promise.resolve(true)
    if (inflightCheck) return inflightCheck
    pendingVersion.value = legalConsentVersion.value
    visible.value = true
    inflightCheck = new Promise((resolve) => {
      consentResolver = resolve
    }).finally(() => {
      inflightCheck = null
    })
    return inflightCheck
  }

  return { visible, pendingVersion, promptActive, ensureLegalConsent, ensureLegalConsentForRegister, resolveLegalConsentPrompt }
}
