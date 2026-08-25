<template>
  <section :class="cardClass">
    <h3
      class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2 border-b border-border-secondary pb-4"
    >
      <Shield :size="16" class="text-success" /> {{ locale.title }}
    </h3>

    <div class="flex items-start gap-3 p-4 bg-primary-5 border border-primary-10 rounded-xl">
      <AlertCircle :size="14" class="text-primary shrink-0 mt-0.5" />
      <p class="text-[10px] text-text-tertiary leading-relaxed">
        {{
          locale.runtimeConfigNotice ||
          'OAuth 运行时配置已迁移到后台。环境变量仅用于兼容旧部署和一键导入，导入后以此页面保存的配置为准。'
        }}
      </p>
    </div>

    <!-- 基础配置 -->
    <div class="space-y-4 mb-6 pb-6 border-b border-border-secondary">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-text-tertiary uppercase tracking-widest">{{ locale.baseSettings }}</h4>
        <button
          v-if="envData.hasBaseConfig"
          type="button"
          class="text-[10px] px-2 py-1 bg-primary-10 text-primary hover:bg-primary-20 border border-primary-20 rounded-md transition-colors font-bold flex items-center gap-1"
          @click="importEnvData('base')"
        >
          <Download :size="12" />
          {{ locale.importEnv }}
        </button>
      </div>

      <div
        class="flex items-center justify-between bg-bg-secondary-50 p-4 rounded-xl border border-border-secondary-50"
      >
        <div>
          <label :class="labelClass">{{ locale.allowRegistration }}</label>
          <p class="text-[10px] text-text-disabled mt-1">{{ locale.allowRegistrationDesc }}</p>
        </div>
        <div class="flex items-center gap-2">
          <span
            :class="[
              'text-[10px] font-bold',
              formData.allowOAuthRegistration ? 'text-success' : 'text-text-tertiary'
            ]"
          >
            {{ formData.allowOAuthRegistration ? locale.allowed : locale.notAllowed }}
          </span>
          <input
            v-model="formData.allowOAuthRegistration"
            type="checkbox"
            class="w-4 h-4 rounded border-border-secondary bg-bg-secondary accent-green-600 cursor-pointer"
          />
        </div>
      </div>

      <div>
        <label :class="labelClass">{{ locale.redirectUri }}</label>
        <p class="text-[10px] text-text-disabled px-1 mb-2">
          {{ locale.redirectExample }} <code class="bg-bg-primary px-2 py-1 rounded">https://yourdomain.com/api/auth/[provider]/callback</code>
        </p>
        <input
          v-model="formData.oauthRedirectUri"
          type="text"
          placeholder="https://yourdomain.com/api/auth/[provider]/callback"
          :class="inputClass"
        />
      </div>

      <div>
        <label :class="labelClass">{{ locale.stateSecret }}</label>
        <p class="text-[10px] text-text-disabled px-1 mb-2">{{ locale.stateSecretDesc }}</p>
        <div class="flex gap-2">
          <input
            v-model="formData.oauthStateSecret"
            :type="showSecrets.state ? 'text' : 'password'"
            :placeholder="locale.stateSecretPlaceholder"
            :class="inputClass"
          />
          <button
            type="button"
            class="px-4 py-2.5 bg-bg-tertiary hover:bg-bg-quaternary text-text-tertiary text-xs font-bold rounded-xl transition-all"
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
      :doc-url="provider.docUrl"
      :doc-label="provider.docLabel"
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
          />
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
          />
        </div>
      </template>
      <template #after-fields v-else-if="provider.id === 'aggregate'">
        <div>
          <CustomSelect
            v-model="formData.aggregateOAuthLoginType"
            :label="locale.aggregateLoginTypeLabel || '登录方式'"
            :options="aggregateLoginTypes"
            :placeholder="locale.aggregateLoginTypePlaceholder || '请选择至少一种登录方式'"
            multiple
          />
          <p class="text-[10px] text-text-disabled px-1 mt-2">
            {{
              locale.aggregateLoginTypeDesc ||
              '请选择当前聚合登录服务已接入并开通的登录方式；启用服务商尚未支持的平台会导致授权失败。每种登录方式会独立记录账号绑定关系。'
            }}
          </p>
        </div>
        <div>
          <label :class="labelClass">{{ locale.aggregateEndpointLabel || '接口地址' }}</label>
          <input
            v-model="formData.aggregateOAuthEndpoint"
            type="url"
            placeholder="https://example.com/connect.php"
            :class="inputClass"
          />
          <p class="text-[10px] text-text-disabled px-1 mt-2">
            {{
              locale.aggregateEndpointDesc ||
              '兼容彩虹聚合登录协议的服务端 connect.php 地址；公网应使用 HTTPS，可信内网可使用 HTTP。'
            }}
          </p>
        </div>

        <div class="pt-2 border-t border-border-secondary/60">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-error-5 border border-error-15 rounded-xl"
          >
            <div>
              <p class="text-xs font-bold text-error">
                {{ locale.clearBindingsTitle || '清除所有聚合登录绑定' }}
              </p>
              <p class="text-[10px] text-text-tertiary mt-0.5 leading-relaxed">
                {{
                  locale.clearBindingsDesc ||
                  '更换聚合登录提供商时使用，将清除系统中所有用户的聚合登录绑定关系并要求其重新绑定。'
                }}
              </p>
            </div>
            <button
              type="button"
              :disabled="clearingBindings"
              class="shrink-0 px-3.5 py-2 bg-error-10 hover:bg-error-20 text-error border border-error-20 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
              @click="showClearConfirm = true"
            >
              <Trash2 :size="13" />
              {{ locale.clearBindingsBtn || '清除绑定' }}
            </button>
          </div>
        </div>
      </template>
    </AdminProviderConfigSection>

    <!-- Custom OAuth2 -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-text-tertiary uppercase tracking-widest">{{ locale.customOAuth }}</h4>
        <div class="flex items-center gap-2">
          <span
            :class="[
              'text-[10px] font-bold',
              formData.customOAuthEnabled ? 'text-success' : 'text-error'
            ]"
          >
            {{ formData.customOAuthEnabled ? locale.enabled : locale.disabled }}
          </span>
          <input
            v-model="formData.customOAuthEnabled"
            type="checkbox"
            class="w-4 h-4 rounded border-border-secondary bg-bg-secondary accent-green-600 cursor-pointer"
          />
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
          />
        </div>

        <div>
          <label :class="labelClass">{{ locale.authorizeUrl }}</label>
          <input
            v-model="formData.customOAuthAuthorizeUrl"
            type="text"
            placeholder="https://oauth.example.com/authorize"
            :class="inputClass"
          />
        </div>

        <div>
          <label :class="labelClass">{{ locale.tokenUrl }}</label>
          <input
            v-model="formData.customOAuthTokenUrl"
            type="text"
            placeholder="https://oauth.example.com/token"
            :class="inputClass"
          />
        </div>

        <div>
          <label :class="labelClass">{{ locale.userInfoUrl }}</label>
          <input
            v-model="formData.customOAuthUserInfoUrl"
            type="text"
            placeholder="https://oauth.example.com/userinfo"
            :class="inputClass"
          />
        </div>

        <div>
          <label :class="labelClass">{{ locale.scope }}</label>
          <input
            v-model="formData.customOAuthScope"
            type="text"
            placeholder="openid profile email"
            :class="inputClass"
          />
        </div>

        <div>
          <label :class="labelClass">{{ locale.clientId }}</label>
          <input
            v-model="formData.customOAuthClientId"
            type="text"
            :placeholder="locale.clientIdPlaceholder"
            :class="inputClass"
          />
        </div>

        <div>
          <label :class="labelClass">{{ locale.clientSecret }}</label>
          <div class="flex gap-2">
            <input
              v-model="formData.customOAuthClientSecret"
              :type="showSecrets.custom ? 'text' : 'password'"
              :placeholder="showSecrets.custom ? locale.clientSecretPlaceholder : '••••••••••••••••'"
              :class="inputClass"
            />
            <button
              type="button"
              class="px-4 py-2.5 bg-bg-tertiary hover:bg-bg-quaternary text-text-tertiary text-xs font-bold rounded-xl transition-all"
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
            />
          </div>

          <div>
            <label :class="labelClass">{{ locale.usernameField }}</label>
            <input
              v-model="formData.customOAuthUsernameField"
              type="text"
              placeholder="preferred_username"
              :class="inputClass"
            />
          </div>

          <div>
            <label :class="labelClass">{{ locale.nameField }}</label>
            <input
              v-model="formData.customOAuthNameField"
              type="text"
              placeholder="name"
              :class="inputClass"
            />
          </div>

          <div>
            <label :class="labelClass">{{ locale.emailField }}</label>
            <input
              v-model="formData.customOAuthEmailField"
              type="text"
              placeholder="email"
              :class="inputClass"
            />
          </div>

          <div class="md:col-span-2">
            <label :class="labelClass">{{ locale.avatarField }}</label>
            <input
              v-model="formData.customOAuthAvatarField"
              type="text"
              placeholder="picture"
              :class="inputClass"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 信息提示 -->
    <div
      class="mt-6 p-4 bg-warning-5 border border-warning-10 rounded-xl flex items-start gap-3"
    >
      <AlertCircle class="text-warning shrink-0 mt-0.5" :size="14" />
      <div class="text-[10px] text-text-tertiary leading-relaxed space-y-1">
        <p>
          {{ locale.brokerHintPrefix }}
          <a href="https://github.com/laoshuikaixue/VoiceHub-Auth-Broker" target="_blank" class="text-primary hover:underline">VoiceHub-Auth-Broker</a>
          {{ locale.brokerHintSuffix }}
        </p>
      </div>
    </div>

    <!-- 清除聚合登录绑定二次确认弹窗 -->
    <ConfirmDialog
      v-model:show="showClearConfirm"
      type="danger"
      :title="locale.clearBindingsConfirmTitle || '确认清除所有聚合登录绑定？'"
      :message="
        locale.clearBindingsConfirmMessage ||
        '此操作将永久清除系统中所有用户的聚合登录绑定关系。\n若更换了聚合登录提供商，旧数据已失效，清除后用户需重新绑定方可通过聚合登录访问账号。\n此操作不可撤销，是否继续？'
      "
      :confirm-text="locale.clearBindingsBtn || '清除绑定'"
      :loading="clearingBindings"
      @confirm="handleClearBindings"
      @cancel="showClearConfirm = false"
    />
  </section>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { AlertCircle, Shield, Download, Trash2 } from '@lucide/vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import { useServerErrors, useLocaleText } from '~/composables/useLocaleText'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import {
  AGGREGATE_OAUTH_LOGIN_TYPE_OPTIONS,
  getAggregateOAuthLoginTypesOrDefault
} from '~/utils/oauth'

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  }
})

const emits = defineEmits(['update:modelValue'])

const { showToast } = useToast()
const { admin } = useLocale()
const { localize: localizeServerError } = useServerErrors()
const locale = computed(() => admin.value?.oauthConfig || {})
const { t: callLocale } = useLocaleText(locale)
const getLogMessage = (key) => locale.value?.logs?.[key] || key

const inputClass =
  'w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-30 transition-all placeholder:text-text-primary'
const labelClass = 'text-[10px] font-black text-text-disabled uppercase tracking-widest px-1 block mb-2'
const cardClass = 'bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 shadow-xl space-y-6'

const showSecrets = ref({
  state: false,
  custom: false
})

const showClearConfirm = ref(false)
const clearingBindings = ref(false)

const formData = computed({
  get: () => props.modelValue,
  set: (val) => emits('update:modelValue', val)
})

const envData = ref({
  hasBaseConfig: false,
  hasGithubConfig: false,
  hasCasdoorConfig: false,
  hasGoogleConfig: false,
  hasAggregateConfig: false
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
  },
  {
    id: 'aggregate',
    title: locale.value?.aggregateTitle || '聚合登录',
    hasEnvConfig: envData.value.hasAggregateConfig,
    enabledKey: 'aggregateOAuthEnabled',
    clientIdKey: 'aggregateOAuthAppId',
    clientSecretKey: 'aggregateOAuthAppKey',
    clientIdLabel: 'AppID',
    clientIdPlaceholder: locale.value?.aggregateClientIdPlaceholder || '输入聚合登录 AppID',
    clientSecretLabel: 'AppKey',
    clientSecretPlaceholder:
      locale.value?.aggregateClientSecretPlaceholder || '输入聚合登录 AppKey'
  }
])

const aggregateLoginTypes = computed(() =>
  AGGREGATE_OAUTH_LOGIN_TYPE_OPTIONS.map((option) => ({
    ...option,
    label: locale.value?.aggregateLoginTypes?.[option.value] || option.label
  }))
)

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
    const importedData = { ...data }
    if (provider === 'aggregate') {
      importedData.aggregateOAuthLoginType = getAggregateOAuthLoginTypesOrDefault(
        data.aggregateOAuthLoginType
      )
    }
    formData.value = {
      ...formData.value,
      ...importedData
    }
  } catch (e) {
    console.error(getLogMessage('importEnvFailed'), e)
    showToast(locale.value?.importFailed || 'OAuth 配置导入失败', 'error')
  }
}

const handleClearBindings = async () => {
  clearingBindings.value = true
  try {
    const res = await $fetch('/api/admin/system-settings/clear-aggregate-bindings', {
      method: 'POST'
    })
    showClearConfirm.value = false
    showToast(callLocale('clearBindingsSuccess', `已成功清除 ${res.count} 条聚合登录绑定数据（影响 ${res.usersAffected} 位用户）`, res.count, res.usersAffected), 'success')
  } catch (err) {
    console.error('清除聚合登录绑定失败:', err)
    showToast(
      localizeServerError(err) || locale.value?.clearBindingsFailed || '清除聚合登录绑定失败',
      'error'
    )
  } finally {
    clearingBindings.value = false
  }
}

onMounted(() => {
  fetchEnvData()
})
</script>
