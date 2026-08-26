<template>
  <Teleport to="body">
    <Transition name="bind-reminder">
      <div v-if="show" class="bind-reminder-overlay" @click.self="handleIgnore">
        <div class="bind-reminder-modal" role="dialog" aria-modal="true" :aria-label="title">
          <button
            type="button"
            class="bind-reminder-close"
            :aria-label="closeLabel"
            @click="handleIgnore"
          >
            <Icon name="x" :size="18" />
          </button>

          <div class="bind-reminder-badge" :class="`is-${loginType}`">
            <Icon :name="providerIcon" :size="34" />
          </div>

          <h3 class="bind-reminder-title">{{ title }}</h3>
          <p class="bind-reminder-desc">{{ description }}</p>

          <div class="bind-reminder-actions">
            <button type="button" class="bind-reminder-btn primary" @click="handleBind">
              <Link :size="16" />
              <span>{{ locale.bindNow }}</span>
            </button>
            <button type="button" class="bind-reminder-btn ghost" @click="handleIgnore">
              {{ locale.ignore }}
            </button>
          </div>

          <button type="button" class="bind-reminder-dismiss" @click="handleNeverRemind">
            {{ locale.neverRemind }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import { Link } from '@lucide/vue'
import { detectEmbeddedBrowser } from '~/utils/embedded-browser'
import { getAggregateOAuthLoginTypeIcon, getAggregateOAuthLoginTypeName } from '~/utils/oauth'
import { useOAuthBindReminder } from '~/composables/useOAuthBindReminder'
import { useLocaleText } from '~/composables/useLocaleText'
import { useLocale } from '~/utils/locale'

const { isAuthenticated, user } = useAuth()
const { initSiteConfig, oauthProviders } = useSiteConfig()
const route = useRoute()
const { auth: authLocale, common } = useLocale()
const locale = computed(() => authLocale.value?.bindReminder || {})
const { format } = useLocaleText(locale)
const reminder = useOAuthBindReminder()

const show = ref(false)
const checking = ref(false)
const loginType = ref('')

const providerName = computed(() => getAggregateOAuthLoginTypeName(loginType.value))
const providerIcon = computed(() => getAggregateOAuthLoginTypeIcon(loginType.value))
const title = computed(() => format(locale.value.title, '', providerName.value))
const description = computed(() => format(locale.value.description, '', providerName.value))
const closeLabel = computed(() => common.value?.close || '关闭')

const isEligibleRoute = () => {
  return route.path === '/'
}

const tryShow = async () => {
  if (import.meta.server || !import.meta.client) return
  if (show.value || checking.value) return
  if (!isAuthenticated.value || !user.value?.id || user.value?.requirePasswordChange) return
  if (!isEligibleRoute()) return

  const env = detectEmbeddedBrowser()
  const envType = env.isWeChat ? 'wx' : env.isQQApp ? 'qq' : ''
  if (!envType) return
  if (!reminder.hasPendingPasswordLogin()) return
  if (reminder.isDismissed()) {
    reminder.clearPending()
    return
  }

  checking.value = true
  try {
    await initSiteConfig()
    const enabledTypes = new Set(
      (oauthProviders.value || [])
        .filter((item) => item.routeProvider === 'aggregate' && item.loginType)
        .map((item) => item.loginType)
    )
    if (!enabledTypes.has(envType)) {
      reminder.clearPending()
      return
    }

    let identities = []
    try {
      identities = await $fetch('/api/auth/identities')
    } catch {
      // 查询失败时保留待提示状态，下次进入主页再尝试
      return
    }

    const alreadyBound = identities.some((item) => item.provider === `aggregate:${envType}`)
    if (alreadyBound) {
      reminder.clearPending()
      return
    }

    if (!isEligibleRoute()) return
    loginType.value = envType
    show.value = true
  } finally {
    checking.value = false
  }
}

watch([() => route.path, () => isAuthenticated.value, () => user.value?.id], () => tryShow(), {
  immediate: true
})

const handleBind = () => {
  const type = loginType.value
  if (!type) return
  reminder.clearPending()
  show.value = false
  const query = new URLSearchParams()
  query.set('type', type)
  navigateTo(`/api/auth/aggregate?${query.toString()}`, { external: true })
}

const handleIgnore = () => {
  // 忽略只关闭本次弹窗，保留待提示状态，回到可提示页面时再次弹出
  show.value = false
}

const handleNeverRemind = () => {
  reminder.dismissForever()
  show.value = false
}
</script>

<style scoped>
.bind-reminder-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
}

.bind-reminder-modal {
  position: relative;
  width: 100%;
  max-width: 400px;
  padding: 34px 28px 22px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-xl);
  text-align: center;
}

.bind-reminder-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-lg);
  color: var(--text-quaternary);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.bind-reminder-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.bind-reminder-badge {
  width: 68px;
  height: 68px;
  margin: 0 auto 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-secondary);
  border-radius: 22px;
}

.bind-reminder-badge.is-wx {
  color: var(--oauth-wx);
}

.bind-reminder-badge.is-qq {
  color: var(--oauth-qq);
}

.bind-reminder-title {
  margin: 0 0 10px;
  font-size: 19px;
  font-weight: var(--font-bold);
  color: var(--text-primary);
  line-height: 1.4;
}

.bind-reminder-desc {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.bind-reminder-actions {
  display: flex;
  gap: 12px;
}

.bind-reminder-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 16px;
  border-radius: var(--radius-xl);
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: var(--font-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition:
    filter var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);
}

.bind-reminder-btn.primary {
  background: var(--oauth-wx);
  color: #06331f;
}

.is-qq .bind-reminder-btn.primary {
  background: var(--oauth-qq);
  color: #083344;
}

.bind-reminder-btn.primary:hover {
  filter: brightness(1.05);
}

.bind-reminder-btn.ghost {
  background: var(--bg-tertiary);
  border-color: var(--border-secondary);
  color: var(--text-primary);
}

.bind-reminder-btn.ghost:hover {
  border-color: var(--border-tertiary);
  background: var(--bg-quaternary);
}

.bind-reminder-btn:active {
  transform: scale(0.98);
}

.bind-reminder-dismiss {
  display: block;
  margin: 18px auto 0;
  padding: 6px 10px;
  background: transparent;
  border: none;
  font-size: 13px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.bind-reminder-dismiss:hover {
  color: var(--text-primary);
}

.bind-reminder-enter-active,
.bind-reminder-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.bind-reminder-enter-from,
.bind-reminder-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.97);
}

@media (max-width: 480px) {
  .bind-reminder-modal {
    padding: 30px 20px 20px;
  }

  .bind-reminder-title {
    font-size: 18px;
  }

  .bind-reminder-actions {
    gap: 10px;
  }

  .bind-reminder-btn {
    padding: 12px 10px;
    font-size: 13px;
  }
}
</style>
