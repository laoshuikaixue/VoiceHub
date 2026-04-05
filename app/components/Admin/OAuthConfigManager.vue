<template>
  <section :class="cardClass">
    <h3
      class="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-4"
    >
      <Shield :size="16" class="text-green-500" /> OAuth 第三方登录配置
    </h3>

    <!-- 基础配置 -->
    <div class="space-y-4 mb-6 pb-6 border-b border-zinc-800">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest">基础设置</h4>
        <button
          v-if="envData.hasBaseConfig"
          type="button"
          class="text-[10px] px-2 py-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20 rounded-md transition-colors font-bold flex items-center gap-1"
          @click="importEnvData('base')"
        >
          <Download :size="12" />
          导入环境配置
        </button>
      </div>

      <div class="flex items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
        <div>
          <label :class="labelClass">允许第三方注册</label>
          <p class="text-[10px] text-zinc-600 mt-1">开启后，允许用户通过 OAuth 创建新账号；关闭时，仅允许绑定已有账号</p>
        </div>
        <div class="flex items-center gap-2">
          <span
            :class="[
              'text-[10px] font-bold',
              formData.allowOAuthRegistration ? 'text-green-500' : 'text-zinc-500'
            ]"
          >
            {{ formData.allowOAuthRegistration ? '已允许' : '未允许' }}
          </span>
          <input
            v-model="formData.allowOAuthRegistration"
            type="checkbox"
            class="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-green-600 cursor-pointer"
          >
        </div>
      </div>

      <div>
        <label :class="labelClass">OAuth 重定向 URI</label>
        <p class="text-[10px] text-zinc-600 px-1 mb-2">
          例: <code class="bg-zinc-950 px-2 py-1 rounded">https://yourdomain.com/api/auth/[provider]/callback</code>
        </p>
        <input
          v-model="formData.oauthRedirectUri"
          type="text"
          placeholder="https://yourdomain.com/api/auth/[provider]/callback"
          :class="inputClass"
        >
      </div>

      <div>
        <label :class="labelClass">OAuth State 密钥</label>
        <p class="text-[10px] text-zinc-600 px-1 mb-2">用于加密/解密 OAuth 状态参数，建议使用强随机字符串</p>
        <div class="flex gap-2">
          <input
            v-model="formData.oauthStateSecret"
            :type="showSecrets.state ? 'text' : 'password'"
            placeholder="输入强随机字符串"
            :class="inputClass"
          >
          <button
            type="button"
            class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all"
            @click="showSecrets.state = !showSecrets.state"
          >
            {{ showSecrets.state ? '隐藏' : '显示' }}
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
          <label :class="labelClass">Casdoor 服务器 URL</label>
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
          <label :class="labelClass">Casdoor 组织名称</label>
          <input
            v-model="formData.casdoorOrganizationName"
            type="text"
            placeholder="输入组织名称"
            :class="inputClass"
          >
        </div>
      </template>
    </AdminProviderConfigSection>

    <!-- Custom OAuth2 -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest">第三方 OAuth2</h4>
        <div class="flex items-center gap-2">
          <span
            :class="[
              'text-[10px] font-bold',
              formData.customOAuthEnabled ? 'text-green-500' : 'text-red-500'
            ]"
          >
            {{ formData.customOAuthEnabled ? '已启用' : '未启用' }}
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
          <label :class="labelClass">按钮显示名称</label>
          <input
            v-model="formData.customOAuthDisplayName"
            type="text"
            placeholder="例如：校园统一认证"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">授权地址 (Authorize URL)</label>
          <input
            v-model="formData.customOAuthAuthorizeUrl"
            type="text"
            placeholder="https://oauth.example.com/authorize"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">令牌地址 (Token URL)</label>
          <input
            v-model="formData.customOAuthTokenUrl"
            type="text"
            placeholder="https://oauth.example.com/token"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">用户信息地址 (UserInfo URL)</label>
          <input
            v-model="formData.customOAuthUserInfoUrl"
            type="text"
            placeholder="https://oauth.example.com/userinfo"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">Scope</label>
          <input
            v-model="formData.customOAuthScope"
            type="text"
            placeholder="openid profile email"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">Client ID</label>
          <input
            v-model="formData.customOAuthClientId"
            type="text"
            placeholder="输入 Client ID"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">Client Secret</label>
          <div class="flex gap-2">
            <input
              v-model="formData.customOAuthClientSecret"
              :type="showSecrets.custom ? 'text' : 'password'"
              :placeholder="showSecrets.custom ? '输入 Client Secret' : '••••••••••••••••'"
              :class="inputClass"
            >
            <button
              type="button"
              class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all"
              @click="showSecrets.custom = !showSecrets.custom"
            >
              {{ showSecrets.custom ? '隐藏' : '显示' }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label :class="labelClass">用户 ID 字段</label>
            <input
              v-model="formData.customOAuthUserIdField"
              type="text"
              placeholder="sub"
              :class="inputClass"
            >
          </div>

          <div>
            <label :class="labelClass">用户名字段</label>
            <input
              v-model="formData.customOAuthUsernameField"
              type="text"
              placeholder="preferred_username"
              :class="inputClass"
            >
          </div>

          <div>
            <label :class="labelClass">昵称字段</label>
            <input
              v-model="formData.customOAuthNameField"
              type="text"
              placeholder="name"
              :class="inputClass"
            >
          </div>

          <div>
            <label :class="labelClass">邮箱字段</label>
            <input
              v-model="formData.customOAuthEmailField"
              type="text"
              placeholder="email"
              :class="inputClass"
            >
          </div>

          <div class="md:col-span-2">
            <label :class="labelClass">头像字段</label>
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
          在 Vercel 等平台进行多环境部署时，GitHub OAuth App 等提供商通常只能配置单一的回调地址。为了解决这个问题，项目可以使用 
          <a href="https://github.com/laoshuikaixue/VoiceHub-Auth-Broker" target="_blank" class="text-blue-500 hover:underline">VoiceHub-Auth-Broker</a> 
          中间件作为统一的回调入口。该中间件能根据 <code>state</code> 参数动态转发回调请求到正确的部署环境，从而实现单个 OAuth App 支持无限个预览/生产环境。详情请参考该项目文档。
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { AlertCircle, Shield, Download } from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  }
})

const emits = defineEmits(['update:modelValue'])

const { showToast } = useToast()

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
    title: 'GitHub OAuth',
    hasEnvConfig: envData.value.hasGithubConfig,
    enabledKey: 'githubOAuthEnabled',
    clientIdKey: 'githubClientId',
    clientSecretKey: 'githubClientSecret',
    clientIdLabel: 'GitHub Client ID',
    clientIdPlaceholder: '输入 GitHub Client ID',
    clientSecretLabel: 'GitHub Client Secret',
    clientSecretPlaceholder: '输入 GitHub Client Secret',
  },
  {
    id: 'casdoor',
    title: 'Casdoor OAuth',
    hasEnvConfig: envData.value.hasCasdoorConfig,
    enabledKey: 'casdoorOAuthEnabled',
    clientIdKey: 'casdoorClientId',
    clientSecretKey: 'casdoorClientSecret',
    clientIdLabel: 'Casdoor Client ID',
    clientIdPlaceholder: '输入 Client ID',
    clientSecretLabel: 'Casdoor Client Secret',
    clientSecretPlaceholder: '输入 Client Secret',
  },
  {
    id: 'google',
    title: 'Google OAuth',
    hasEnvConfig: envData.value.hasGoogleConfig,
    enabledKey: 'googleOAuthEnabled',
    clientIdKey: 'googleClientId',
    clientSecretKey: 'googleClientSecret',
    clientIdLabel: 'Google Client ID',
    clientIdPlaceholder: '输入 Google Client ID（xxx.apps.googleusercontent.com）',
    clientSecretLabel: 'Google Client Secret',
    clientSecretPlaceholder: '输入 Google Client Secret',
  }
])

const fetchEnvData = async () => {
  try {
    const data = await $fetch('/api/admin/system-settings/env-oauth')
    envData.value = data
  } catch (e) {
    console.error('获取环境变量失败:', e)
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
    console.error('导入环境配置失败:', e)
    showToast('导入环境配置失败', 'error')
  }
}

onMounted(() => {
  fetchEnvData()
})
</script>
