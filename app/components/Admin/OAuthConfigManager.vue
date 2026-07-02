<template>
  <section :class="cardClass">
    <h3
      class="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-4"
    >
      <Shield :size="16" class="text-green-500" /> {{ locale.title }}
    </h3>

    <!-- 基础配置 -->
    <div class="space-y-4 mb-6 pb-6 border-b border-zinc-800">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest">{{ locale.baseSettings }}</h4>
        <button
          v-if="envData.hasBaseConfig"
          type="button"
          class="text-[10px] px-2 py-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20 rounded-md transition-colors font-bold flex items-center gap-1"
          @click="importEnvData('base')"
        >
          <Download :size="12" />
          {{ locale.importEnv }}
        </button>
      </div>

      <div class="flex items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
        <div>
          <label :class="labelClass">{{ locale.allowRegistration }}</label>
          <p class="text-[10px] text-zinc-600 mt-1">{{ locale.allowRegistrationDesc }}</p>
        </div>
        <div class="flex items-center gap-2">
          <span
            :class="[
              'text-[10px] font-bold',
              formData.allowOAuthRegistration ? 'text-green-500' : 'text-zinc-500'
            ]"
          >
            {{ formData.allowOAuthRegistration ? locale.allowed : locale.notAllowed }}
          </span>
          <input
            v-model="formData.allowOAuthRegistration"
            type="checkbox"
            class="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-green-600 cursor-pointer"
          >
        </div>
      </div>

      <div>
        <label :class="labelClass">{{ locale.redirectUri }}</label>
        <p class="text-[10px] text-zinc-600 px-1 mb-2">
          {{ locale.redirectExample }} <code class="bg-zinc-950 px-2 py-1 rounded">https://yourdomain.com/api/auth/[provider]/callback</code>
        </p>
        <input
          v-model="formData.oauthRedirectUri"
          type="text"
          placeholder="https://yourdomain.com/api/auth/[provider]/callback"
          :class="inputClass"
        >
      </div>

      <div>
        <label :class="labelClass">{{ locale.stateSecret }}</label>
        <p class="text-[10px] text-zinc-600 px-1 mb-2">{{ locale.stateSecretDesc }}</p>
        <div class="flex gap-2">
          <input
            v-model="formData.oauthStateSecret"
            :type="showSecrets.state ? 'text' : 'password'"
            :placeholder="locale.stateSecretPlaceholder"
            :class="inputClass"
          >
          <button
            type="button"
            class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all"
            @click="showSecrets.state = !showSecrets.state"
          >
            {{ showSecrets.state ? locale.hide : locale.show }}
          </button>
        </div>
      </div>
    </div>

    <!-- 循环渲染的基础 OAuth 提供商配置 -->
    <AdminProviderConfigSection
      v-for="provider in oauthProviders"
      :key="provider.id"
      :title="provider.title"
      :has-env-config="provider.hasEnvConfig"
      v-model:enabled="formData[provider.enabledKey]"
      v-model:clientId="formData[provider.clientIdKey]"
      v-model:clientSecret="formData[provider.clientSecretKey]"
      :client-id-label="provider.clientIdLabel"
      :client-id-placeholder="provider.clientIdPlaceholder"
      :client-secret-label="provider.clientSecretLabel"
      :client-secret-placeholder="provider.clientSecretPlaceholder"
      @import-env="importEnvData(provider.id)"
    >
      <template #before-fields v-if="provider.id === 'casdoor'">
        <div>
          <label :class="labelClass">{{ locale.casdoorServerUrl }}</label>
          <input
            v-model="formData.casdoorServerUrl"
            type="text"
            placeholder="https://casdoor.example.com"
            :class="inputClass"
          >
        </div>
      </template>
      <template #after-fields v-if="provider.id === 'casdoor'">
        <div>
          <label :class="labelClass">{{ locale.casdoorOrganizationName }}</label>
          <input
            v-model="formData.casdoorOrganizationName"
            type="text"
            :placeholder="locale.organizationPlaceholder"
            :class="inputClass"
          >
        </div>
      </template>
    </AdminProviderConfigSection>

    <!-- Custom OAuth2 -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest">{{ locale.customOAuth }}</h4>
        <div class="flex items-center gap-2">
          <span
            :class="[
              'text-[10px] font-bold',
              formData.customOAuthEnabled ? 'text-green-500' : 'text-red-500'
            ]"
          >
            {{ formData.customOAuthEnabled ? locale.enabled : locale.disabled }}
          </span>
          <input
            v-model="formData.customOAuthEnabled"
            type="checkbox"
            class="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-green-600 cursor-pointer"
          >
        </div>
      </div>

      <div v-if="formData.customOAuthEnabled" class="space-y-4">
        <div>
          <label :class="labelClass">{{ locale.displayName }}</label>
          <input
            v-model="formData.customOAuthDisplayName"
            type="text"
            :placeholder="locale.displayNamePlaceholder"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">{{ locale.authorizeUrl }}</label>
          <input
            v-model="formData.customOAuthAuthorizeUrl"
            type="text"
            placeholder="https://oauth.example.com/authorize"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">{{ locale.tokenUrl }}</label>
          <input
            v-model="formData.customOAuthTokenUrl"
            type="text"
            placeholder="https://oauth.example.com/token"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">{{ locale.userInfoUrl }}</label>
          <input
            v-model="formData.customOAuthUserInfoUrl"
            type="text"
            placeholder="https://oauth.example.com/userinfo"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">{{ locale.scope }}</label>
          <input
            v-model="formData.customOAuthScope"
            type="text"
            placeholder="openid profile email"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">{{ locale.clientId }}</label>
          <input
            v-model="formData.customOAuthClientId"
            type="text"
            :placeholder="locale.clientIdPlaceholder"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">{{ locale.clientSecret }}</label>
          <div class="flex gap-2">
            <input
              v-model="formData.customOAuthClientSecret"
              :type="showSecrets.custom ? 'text' : 'password'"
              :placeholder="showSecrets.custom ? locale.clientSecretPlaceholder : '••••••••••••••••'"
              :class="inputClass"
            >
            <button
              type="button"
              class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all"
              @click="showSecrets.custom = !showSecrets.custom"
            >
              {{ showSecrets.custom ? locale.hide : locale.show }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label :class="labelClass">{{ locale.userIdField }}</label>
            <input
              v-model="formData.customOAuthUserIdField"
              type="text"
              placeholder="sub"
              :class="inputClass"
            >
          </div>

          <div>
            <label :class="labelClass">{{ locale.usernameField }}</label>
            <input
              v-model="formData.customOAuthUsernameField"
              type="text"
              placeholder="preferred_username"
              :class="inputClass"
            >
          </div>

          <div>
            <label :class="labelClass">{{ locale.nameField }}</label>
            <input
              v-model="formData.customOAuthNameField"
              type="text"
              placeholder="name"
              :class="inputClass"
            >
          </div>

          <div>
            <label :class="labelClass">{{ locale.emailField }}</label>
            <input
              v-model="formData.customOAuthEmailField"
              type="text"
              placeholder="email"
              :class="inputClass"
            >
          </div>

          <div class="md:col-span-2">
            <label :class="labelClass">{{ locale.avatarField }}</label>
            <input
              v-model="formData.customOAuthAvatarField"
              type="text"
              placeholder="picture"
              :class="inputClass"
            >
          </div>
        </div>
      </div>
    </div>

    <!-- 信息提示 -->
    <div class="mt-6 p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-3">
      <AlertCircle class="text-amber-500 shrink-0 mt-0.5" :size="14" />
      <div class="text-[10px] text-zinc-500 leading-relaxed space-y-1">
        <p>
          {{ locale.brokerHintPrefix }}
          <a href="https://github.com/laoshuikaixue/VoiceHub-Auth-Broker" target="_blank" class="text-blue-500 hover:underline">VoiceHub-Auth-Broker</a> 
          {{ locale.brokerHintSuffix }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { AlertCircle, Shield, Download } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  }
})

const emits = defineEmits(['update:modelValue'])

const { showToast } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.oauthConfig || {})
const getLogMessage = (key) => locale.value?.logs?.[key] || key

const inputClass =
  'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-zinc-800'
const labelClass = 'text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1 block mb-2'
const cardClass = 'bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6'

const showSecrets = ref({
  state: false,
  custom: false
})

const formData = computed({
  get: () => props.modelValue,
  set: (val) => emits('update:modelValue', val)
})

const envData = ref({
  hasBaseConfig: false,
  hasGithubConfig: false,
  hasCasdoorConfig: false,
  hasGoogleConfig: false
})

const oauthProviders = computed(() => [
  {
    id: 'github',
    title: locale.value?.githubTitle || 'GitHub OAuth',
    hasEnvConfig: envData.value.hasGithubConfig,
    enabledKey: 'githubOAuthEnabled',
    clientIdKey: 'githubClientId',
    clientSecretKey: 'githubClientSecret',
    clientIdLabel: locale.value?.githubClientId || 'GitHub Client ID',
    clientIdPlaceholder: locale.value?.githubClientIdPlaceholder || 'Enter GitHub Client ID',
    clientSecretLabel: locale.value?.githubClientSecret || 'GitHub Client Secret',
    clientSecretPlaceholder: locale.value?.githubClientSecretPlaceholder || 'Enter GitHub Client Secret',
  },
  {
    id: 'casdoor',
    title: locale.value?.casdoorTitle || 'Casdoor OAuth',
    hasEnvConfig: envData.value.hasCasdoorConfig,
    enabledKey: 'casdoorOAuthEnabled',
    clientIdKey: 'casdoorClientId',
    clientSecretKey: 'casdoorClientSecret',
    clientIdLabel: locale.value?.casdoorClientId || 'Casdoor Client ID',
    clientIdPlaceholder: locale.value?.clientIdPlaceholder || 'Enter Client ID',
    clientSecretLabel: locale.value?.casdoorClientSecret || 'Casdoor Client Secret',
    clientSecretPlaceholder: locale.value?.clientSecretPlaceholder || 'Enter Client Secret',
  },
  {
    id: 'google',
    title: locale.value?.googleTitle || 'Google OAuth',
    hasEnvConfig: envData.value.hasGoogleConfig,
    enabledKey: 'googleOAuthEnabled',
    clientIdKey: 'googleClientId',
    clientSecretKey: 'googleClientSecret',
    clientIdLabel: locale.value?.googleClientId || 'Google Client ID',
    clientIdPlaceholder: locale.value?.googleClientIdPlaceholder || 'Enter Google Client ID',
    clientSecretLabel: locale.value?.googleClientSecret || 'Google Client Secret',
    clientSecretPlaceholder: locale.value?.googleClientSecretPlaceholder || 'Enter Google Client Secret',
  }
])

const fetchEnvData = async () => {
  try {
    const data = await $fetch('/api/admin/system-settings/env-oauth')
    envData.value = data
  } catch (e) {
    console.error(getLogMessage('fetchEnvFailed'), e)
  }
}

const importEnvData = async (provider) => {
  try {
    const data = await $fetch('/api/admin/system-settings/env-oauth-import', {
      method: 'POST',
      body: { provider }
    })
    formData.value = {
      ...formData.value,
      ...data
    }
  } catch (e) {
    console.error(getLogMessage('importEnvFailed'), e)
    showToast(locale.value?.importFailed || '', 'error')
  }
}

onMounted(() => {
  fetchEnvData()
})
</script>
