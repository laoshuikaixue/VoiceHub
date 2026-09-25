<template>
  <Teleport to="body">
    <div v-if="visible" class="legal-consent-overlay" role="dialog" aria-modal="true" aria-labelledby="legal-consent-title">
      <div class="legal-consent-modal">
        <div class="legal-consent-heading"><span class="legal-consent-shield"><svg viewBox="0 0 24 24"><path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3zM9 12l2 2 4-4" /></svg></span><div><h3 id="legal-consent-title">{{ locale.legalConsentModalTitle }}</h3><span v-if="legalConsentUpdatedDate" class="legal-consent-date">{{ legalConsentUpdatedDate }}</span></div></div>
        <p>{{ locale.legalConsentModalDesc }}</p>
        <h4 class="legal-consent-related">{{ locale.legalConsentRelatedDocs }}</h4>
        <div class="legal-consent-docs">
          <a v-for="doc in legalConsentDocuments" :key="doc.slug" :href="`/legal/${doc.slug}`" target="_blank" rel="noopener noreferrer"><span class="doc-symbol"><svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6zM9 13h6M9 17h4" /></svg></span><strong>{{ doc.name }}</strong><span class="external-symbol"><svg viewBox="0 0 24 24"><path d="M14 5h5v5M19 5l-9 9M19 13v6H5V5h6" /></svg></span></a>
        </div>
        <div class="legal-consent-actions">
          <button type="button" class="legal-consent-reject" @click="handleReject">{{ locale.legalConsentReject }}</button>
          <button type="button" class="legal-consent-accept" :disabled="accepting" @click="handleAccept">{{ locale.legalConsentAccept }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useLegalConsentPrompt } from '~/composables/useLegalConsentPrompt'
import { useLocale } from '~/utils/locale'

const auth = useAuth()
const { legalConsentDocuments, legalConsentUpdatedDate } = useSiteConfig()
const { visible, pendingVersion, promptActive, ensureLegalConsent, resolveLegalConsentPrompt } = useLegalConsentPrompt()
const { auth: authLocale } = useLocale()
const locale = computed(() => authLocale.value?.loginForm || {})
const { error: toastError } = useToast()
const accepting = ref(false)

// 会话建立/恢复后按账号校验是否需要确认条款；覆盖 OAuth 整页重定向、WebAuthn、刷新重登等场景
// promptActive 依赖异步加载的站点配置，须 immediate 并纳入监听，避免首屏配置未就绪时校验被跳过且不再重跑
watch(
  [() => auth.isAuthenticated.value, () => auth.user.value?.id, () => promptActive.value],
  () => {
    if (import.meta.server) return
    void ensureLegalConsent()
  },
  { immediate: true }
)

const handleAccept = async () => {
  if (accepting.value) return
  accepting.value = true
  // 已登录时立即落库；注册前场景由注册请求自身显式携带同意版本，无需（也无法）落库
  if (auth.isAuthenticated.value) {
    try {
      await $fetch('/api/legal-consent', { method: 'POST', body: { version: pendingVersion.value } })
    } catch (e) {
      console.error('记录条款同意状态失败:', e)
    }
  }
  accepting.value = false
  visible.value = false
  resolveLegalConsentPrompt(true)
}

const handleReject = async () => {
  visible.value = false
  resolveLegalConsentPrompt(false)
  toastError(locale.value.legalConsentBlocked)
  // 登录后拒绝条款：终止本次会话，不进入系统
  if (auth.isAuthenticated.value) await auth.logout()
}
</script>

<style scoped>
.legal-consent-overlay { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,.6); backdrop-filter: blur(6px); }
.legal-consent-modal { width: min(600px, 100%); max-height: 90vh; overflow: auto; padding: 28px; border: 1px solid var(--border-secondary); border-radius: 18px; background: var(--bg-secondary); color: var(--text-primary); box-shadow: 0 20px 60px rgba(0,0,0,.35); }
.legal-consent-modal h3 { font-size: 20px; font-weight: 800; margin-bottom: 8px; }
.legal-consent-modal p { color: var(--text-secondary); font-size: 13px; line-height: 1.7; padding-bottom: 20px; border-bottom: 1px solid var(--border-secondary); }
.legal-consent-heading { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; min-width: 0; }
.legal-consent-heading h3 { margin: 0; }
.legal-consent-shield { display: grid; place-items: center; flex: 0 0 50px; width: 50px; height: 50px; border-radius: 12px; background: var(--info-light); color: var(--info); }
.legal-consent-shield svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.legal-consent-date { display: inline-block; margin-top: 4px; padding: 4px 9px; border-radius: 999px; background: var(--bg-tertiary); color: var(--text-tertiary); font-size: 11px; }
.legal-consent-related { margin: 20px 0 12px; font-size: 13px; color: var(--text-secondary); }
.legal-consent-docs { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; margin: 20px 0; }
.legal-consent-docs a { display: flex; align-items: center; gap: 10px; min-height: 62px; padding: 12px 16px; border: 1px solid var(--border-secondary); border-radius: 12px; color: var(--text-primary); background: var(--bg-tertiary); font-weight: 700; }
.legal-consent-docs a strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-symbol { display: grid; place-items: center; flex: 0 0 40px; width: 40px; height: 40px; border: 1px solid var(--border-secondary); border-radius: 8px; background: var(--bg-primary); color: var(--text-secondary); }
.doc-symbol svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.external-symbol { display: grid; place-items: center; margin-left: auto; color: var(--text-tertiary); }
.external-symbol svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.legal-consent-actions { display: flex; gap: 12px; padding-top: 20px; border-top: 1px solid var(--border-secondary); }
.legal-consent-actions button { flex: 1; min-height: 44px; padding: 12px; border-radius: 10px; font-size: 14px !important; line-height: 1.2; font-weight: 800; opacity: 1 !important; visibility: visible !important; }
.legal-consent-reject { background: var(--bg-tertiary); color: var(--text-primary) !important; }
.legal-consent-accept { background: var(--primary); color: #fff !important; }
.legal-consent-accept:disabled { opacity: .6; cursor: not-allowed; }

@media (max-width: 640px) {
  .legal-consent-modal { padding: 20px; border-radius: 14px; }
  .legal-consent-docs { grid-template-columns: 1fr; }
  .legal-consent-actions { flex-direction: column; }
}
</style>