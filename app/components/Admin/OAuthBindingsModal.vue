<template>
  <AppModal
    :description="locale.oauthBindingsDesc"
    :show="show"
    :title="locale.oauthBindingsTitle"
    size="xl"
    @close="$emit('close')"
  >
    <template #icon>
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-10 text-success">
        <Link :size="18" />
      </span>
    </template>


            <div
              v-if="identities.length === 0"
              class="py-16 flex flex-col items-center justify-center gap-3 text-text-disabled"
            >
              <Link :size="28" class="opacity-60" />
              <p class="text-xs font-medium">{{ locale.oauthBindingsEmpty }}</p>
            </div>

            <div v-else class="space-y-4">
              <div
                v-for="(identity, index) in identities"
                :key="identity.id ?? `${identity.provider}-${identity.providerUserId}-${index}`"
                class="p-5 bg-bg-primary-50 border border-border-secondary-50 rounded-2xl space-y-4"
              >
                <div class="flex items-center gap-4">
                  <div
                    class="w-11 h-11 rounded-xl bg-bg-primary border border-border-secondary flex items-center justify-center text-text-secondary shrink-0 overflow-hidden"
                  >
                    <AuthProvidersGitHubIcon
                      v-if="identity.provider === 'github'"
                      class="w-5 h-5"
                    />
                    <AuthProvidersCasdoorIcon
                      v-else-if="identity.provider === 'casdoor'"
                      class="w-5 h-5"
                    />
                    <AuthProvidersGoogleIcon
                      v-else-if="identity.provider === 'google'"
                      class="w-5 h-5"
                    />
                    <Icon
                      v-else-if="isAggregateProvider(identity.provider)"
                      :name="
                        getAggregateOAuthLoginTypeIcon(getAggregateLoginType(identity.provider))
                      "
                      :size="22"
                    />
                    <Fingerprint v-else-if="identity.provider === 'webauthn'" :size="20" />
                    <ShieldCheck v-else-if="identity.provider === 'totp'" :size="20" />
                    <Link v-else :size="20" />
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-text-primary truncate">
                      {{ getOAuthProviderName(identity.provider) }}
                    </div>
                    <div class="text-xs text-text-tertiary mt-0.5 truncate">
                      {{ getIdentityDisplayName(identity) }}
                    </div>
                  </div>

                  <div
                    class="w-12 h-12 rounded-xl bg-bg-primary border border-border-secondary overflow-hidden flex items-center justify-center text-text-secondary shrink-0"
                  >
                    <img
                      v-if="identity.avatar && !failedAvatarIds.includes(identity.id)"
                      :src="identity.avatar"
                      :alt="getIdentityDisplayName(identity)"
                      class="w-full h-full object-cover"
                      loading="lazy"
                      @error="markAvatarFailed(identity.id)"
                    >
                    <Icon v-else name="user" :size="20" class="text-text-disabled" />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="p-3 bg-bg-primary-30 rounded-xl border border-border-secondary-30">
                    <div
                      class="text-xs font-bold text-text-disabled uppercase tracking-tighter"
                    >
                      {{ locale.oauthProvider }}
                    </div>
                    <div class="text-xs font-bold text-text-secondary mt-1 break-all">
                      {{ getOAuthProviderName(identity.provider) }}
                    </div>
                  </div>
                  <div class="p-3 bg-bg-primary-30 rounded-xl border border-border-secondary-30">
                    <div
                      class="text-xs font-bold text-text-disabled uppercase tracking-tighter"
                    >
                      {{ locale.oauthUsername }}
                    </div>
                    <div class="text-xs font-bold text-text-secondary mt-1 break-all">
                      {{ getIdentityDisplayName(identity) }}
                    </div>
                  </div>
                  <div class="p-3 bg-bg-primary-30 rounded-xl border border-border-secondary-30">
                    <div
                      class="text-xs font-bold text-text-disabled uppercase tracking-tighter"
                    >
                      {{ locale.oauthUserId }}
                    </div>
                    <div class="text-xs font-bold text-text-secondary mt-1 break-all">
                      {{ getIdentityUserId(identity) }}
                    </div>
                  </div>
                  <div class="p-3 bg-bg-primary-30 rounded-xl border border-border-secondary-30">
                    <div
                      class="text-xs font-bold text-text-disabled uppercase tracking-tighter"
                    >
                      {{ locale.oauthBoundAt }}
                    </div>
                    <div class="text-xs font-bold text-text-secondary mt-1">
                      {{ formatDateTime(identity.createdAt) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
  </AppModal>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Fingerprint, Link, ShieldCheck } from '@lucide/vue'
import AppModal from '~/components/UI/Common/AppModal.vue'
import Icon from '~/components/UI/Icon.vue'
import AuthProvidersCasdoorIcon from '~/components/Auth/Providers/Casdoor/Icon.vue'
import AuthProvidersGitHubIcon from '~/components/Auth/Providers/GitHub/Icon.vue'
import AuthProvidersGoogleIcon from '~/components/Auth/Providers/Google/Icon.vue'
import { getAggregateOAuthLoginTypeIcon, getOAuthProviderName } from '~/utils/oauth'
import { useLocale } from '~/utils/locale'

defineProps({
  show: {
    type: Boolean,
    default: false
  },
  identities: {
    type: Array,
    default: () => []
  }
})

defineEmits(['close'])

const { admin, currentLocale } = useLocale()
const locale = computed(() => admin.value?.userManager?.detail || {})
const failedAvatarIds = ref([])

const isAggregateProvider = (provider) =>
  String(provider || '')
    .toLowerCase()
    .startsWith('aggregate:')
const getAggregateLoginType = (provider) => String(provider || '').replace(/^aggregate:/i, '')

const getIdentityDisplayName = (identity) => {
  if (identity.provider === 'webauthn') {
    try {
      const data = JSON.parse(identity.providerUsername)
      return data?.label || locale.value.oauthUnknownDevice || '未知设备'
    } catch {
      return locale.value.oauthUnknownDevice || '未知设备'
    }
  }
  if (identity.provider === 'totp') return locale.value.oauthTotpLabel || '双重认证'
  return identity.providerUsername || locale.value.oauthNoUsername || '未提供用户名'
}

const getIdentityUserId = (identity) => {
  if (identity.provider === 'totp') return locale.value.oauthIdHidden || '已隐藏'
  return identity.providerUserId || locale.value.oauthNoId || '未提供 ID'
}

const markAvatarFailed = (id) => {
  if (id == null || failedAvatarIds.value.includes(id)) return
  failedAvatarIds.value = [...failedAvatarIds.value, id]
}

const formatDateTime = (value) => {
  if (!value) return locale.value.oauthUnknownTime || '未知时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return locale.value.oauthUnknownTime || '未知时间'
  return new Intl.DateTimeFormat(currentLocale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}
</script>
