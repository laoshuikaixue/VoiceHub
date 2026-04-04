<template>
  <section :class="cardClass">
    <h3
      class="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-4"
    >
      <Shield :size="16" class="text-green-500" /> OAuth 第三方登录配置
    </h3>

    <!-- 基础配置 -->
    <div class="space-y-4 mb-6 pb-6 border-b border-zinc-800">
      <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest">基础设置</h4>

      <div>
        <label :class="labelClass">OAuth 重定向 URI</label>
        <p class="text-[10px] text-zinc-600 px-1 mb-2">
          例: <code class="bg-zinc-950 px-2 py-1 rounded">https://yourdomain.com/auth/[provider]/callback</code>
        </p>
        <input
          v-model="formData.oauthRedirectUri"
          type="text"
          placeholder="https://yourdomain.com/auth/[provider]/callback"
          :class="inputClass"
        >
      </div>

      <div>
        <label :class="labelClass">OAuth State 密钥</label>
        <p class="text-[10px] text-zinc-600 px-1 mb-2">用于加密/解密 OAuth 状态参数，建议使用强随机字符串</p>
        <div class="flex gap-2">
          <input
            v-model="formData.oauthStateSecret"
            :type="showStateSecret ? 'text' : 'password'"
            placeholder="输入强随机字符串"
            :class="inputClass"
          >
          <button
            type="button"
            class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all"
            @click="showStateSecret = !showStateSecret"
          >
            {{ showStateSecret ? '隐藏' : '显示' }}
          </button>
        </div>
      </div>
    </div>

    <!-- GitHub OAuth -->
    <div class="space-y-4 mb-6 pb-6 border-b border-zinc-800">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest">GitHub OAuth</h4>
        <div class="flex items-center gap-2">
          <span
            :class="[
              'text-[10px] font-bold',
              formData.githubOAuthEnabled ? 'text-green-500' : 'text-red-500'
            ]"
          >
            {{ formData.githubOAuthEnabled ? '已启用' : '未启用' }}
          </span>
          <input
            v-model="formData.githubOAuthEnabled"
            type="checkbox"
            class="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-green-600 cursor-pointer"
          >
        </div>
      </div>

      <div v-if="formData.githubOAuthEnabled" class="space-y-4">
        <div>
          <label :class="labelClass">GitHub Client ID</label>
          <input
            v-model="formData.githubClientId"
            type="text"
            placeholder="输入 GitHub Client ID"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">GitHub Client Secret</label>
          <div class="flex gap-2">
            <input
              v-model="formData.githubClientSecret"
              :type="showGithubSecret ? 'text' : 'password'"
              :placeholder="showGithubSecret ? '输入 GitHub Client Secret' : '••••••••••••••••'"
              :class="inputClass"
            >
            <button
              type="button"
              class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all"
              @click="showGithubSecret = !showGithubSecret"
            >
              {{ showGithubSecret ? '隐藏' : '显示' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Casdoor OAuth -->
    <div class="space-y-4 mb-6 pb-6 border-b border-zinc-800">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest">Casdoor OAuth</h4>
        <div class="flex items-center gap-2">
          <span
            :class="[
              'text-[10px] font-bold',
              formData.casdoorOAuthEnabled ? 'text-green-500' : 'text-red-500'
            ]"
          >
            {{ formData.casdoorOAuthEnabled ? '已启用' : '未启用' }}
          </span>
          <input
            v-model="formData.casdoorOAuthEnabled"
            type="checkbox"
            class="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-green-600 cursor-pointer"
          >
        </div>
      </div>

      <div v-if="formData.casdoorOAuthEnabled" class="space-y-4">
        <div>
          <label :class="labelClass">Casdoor 服务器 URL</label>
          <input
            v-model="formData.casdoorServerUrl"
            type="text"
            placeholder="https://casdoor.example.com"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">Casdoor Client ID</label>
          <input
            v-model="formData.casdoorClientId"
            type="text"
            placeholder="输入 Client ID"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">Casdoor Client Secret</label>
          <div class="flex gap-2">
            <input
              v-model="formData.casdoorClientSecret"
              :type="showCasdoorSecret ? 'text' : 'password'"
              :placeholder="showCasdoorSecret ? '输入 Client Secret' : '••••••••••••••••'"
              :class="inputClass"
            >
            <button
              type="button"
              class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all"
              @click="showCasdoorSecret = !showCasdoorSecret"
            >
              {{ showCasdoorSecret ? '隐藏' : '显示' }}
            </button>
          </div>
        </div>

        <div>
          <label :class="labelClass">Casdoor 组织名称</label>
          <input
            v-model="formData.casdoorOrganizationName"
            type="text"
            placeholder="输入组织名称"
            :class="inputClass"
          >
        </div>
      </div>
    </div>

    <!-- Google OAuth -->
    <div class="space-y-4 mb-6 pb-6 border-b border-zinc-800">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-widest">Google OAuth</h4>
        <div class="flex items-center gap-2">
          <span
            :class="[
              'text-[10px] font-bold',
              formData.googleOAuthEnabled ? 'text-green-500' : 'text-red-500'
            ]"
          >
            {{ formData.googleOAuthEnabled ? '已启用' : '未启用' }}
          </span>
          <input
            v-model="formData.googleOAuthEnabled"
            type="checkbox"
            class="w-4 h-4 rounded border-zinc-800 bg-zinc-900 accent-green-600 cursor-pointer"
          >
        </div>
      </div>

      <div v-if="formData.googleOAuthEnabled" class="space-y-4">
        <div>
          <label :class="labelClass">Google Client ID</label>
          <input
            v-model="formData.googleClientId"
            type="text"
            placeholder="输入 Google Client ID（xxx.apps.googleusercontent.com）"
            :class="inputClass"
          >
        </div>

        <div>
          <label :class="labelClass">Google Client Secret</label>
          <div class="flex gap-2">
            <input
              v-model="formData.googleClientSecret"
              :type="showGoogleSecret ? 'text' : 'password'"
              :placeholder="showGoogleSecret ? '输入 Google Client Secret' : '••••••••••••••••'"
              :class="inputClass"
            >
            <button
              type="button"
              class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all"
              @click="showGoogleSecret = !showGoogleSecret"
            >
              {{ showGoogleSecret ? '隐藏' : '显示' }}
            </button>
          </div>
        </div>
      </div>
    </div>

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
              :type="showCustomSecret ? 'text' : 'password'"
              :placeholder="showCustomSecret ? '输入 Client Secret' : '••••••••••••••••'"
              :class="inputClass"
            >
            <button
              type="button"
              class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all"
              @click="showCustomSecret = !showCustomSecret"
            >
              {{ showCustomSecret ? '隐藏' : '显示' }}
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
        <p>• 请确保 OAuth 重定向 URI 与 OAuth 提供商配置中的回调地址完全匹配</p>
        <p>• 密钥信息仅在服务端使用，不会在前端页面中返回</p>
        <p>• 修改 OAuth 配置后，用户可能需要重新登录</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { AlertCircle, Shield } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  }
})

const emits = defineEmits(['update:modelValue'])

const inputClass =
  'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/30 transition-all placeholder:text-zinc-800'
const labelClass = 'text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1 block mb-2'
const cardClass = 'bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6'

const showStateSecret = ref(false)
const showGithubSecret = ref(false)
const showCasdoorSecret = ref(false)
const showGoogleSecret = ref(false)
const showCustomSecret = ref(false)

const formData = computed({
  get: () => props.modelValue,
  set: (val) => emits('update:modelValue', val)
})
</script>
