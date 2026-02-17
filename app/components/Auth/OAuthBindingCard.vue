<template>
  <div class="space-y-6">
    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <Loader2 :size="24" class="text-blue-500 animate-spin mb-3" />
      <p class="text-zinc-500 text-xs font-medium">加载绑定状态...</p>
    </div>

    <div v-else class="space-y-4">
      <!-- GitHub -->
      <div v-if="config.public.oauth.github" :class="itemClass">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 text-zinc-100">
            <AuthProvidersGitHubIcon class="w-5 h-5" />
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-bold text-zinc-200">{{ getProviderDisplayName('github') }}</span>
            <span v-if="githubIdentity" class="text-[11px] text-blue-500 font-medium mt-0.5">{{ githubIdentity.providerUsername }}</span>
            <span v-else class="text-[11px] text-zinc-500 mt-0.5">未绑定</span>
          </div>
        </div>
        
        <button
            v-if="githubIdentity"
            class="px-4 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 text-xs font-black rounded-xl transition-all disabled:opacity-50"
            @click="confirmUnbind('github')"
            :disabled="actionLoading"
        >
          {{ actionLoading ? '处理中...' : '解绑' }}
        </button>
        <button
            v-else
            class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
            @click="handleBind('github')"
            :disabled="actionLoading"
        >
          {{ actionLoading ? '跳转中...' : '立即绑定' }}
        </button>
      </div>

      <!-- Casdoor (如果启用) -->
      <div v-if="config.public.oauth.casdoor" :class="itemClass">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 text-zinc-100">
            <Shield :size="20" />
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-bold text-zinc-200">{{ getProviderDisplayName('casdoor') }}</span>
            <span v-if="casdoorIdentity" class="text-[11px] text-blue-500 font-medium mt-0.5">{{ casdoorIdentity.providerUsername }}</span>
            <span v-else class="text-[11px] text-zinc-500 mt-0.5">未绑定</span>
          </div>
        </div>
        
        <button
            v-if="casdoorIdentity"
            class="px-4 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 text-xs font-black rounded-xl transition-all disabled:opacity-50"
            @click="confirmUnbind('casdoor')"
            :disabled="actionLoading"
        >
          {{ actionLoading ? '处理中...' : '解绑' }}
        </button>
        <button
            v-else
            class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
            @click="handleBind('casdoor')"
            :disabled="actionLoading"
        >
          {{ actionLoading ? '跳转中...' : '立即绑定' }}
        </button>
      </div>

      <!-- Google (如果启用) -->
      <div v-if="config.public.oauth.google" :class="itemClass">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 text-zinc-100">
            <AuthProvidersGoogleIcon class="w-5 h-5" />
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-bold text-zinc-200">{{ getProviderDisplayName('google') }}</span>
            <span v-if="googleIdentity" class="text-[11px] text-blue-500 font-medium mt-0.5">{{ googleIdentity.providerUsername }}</span>
            <span v-else class="text-[11px] text-zinc-500 mt-0.5">未绑定</span>
          </div>
        </div>
        
        <button
            v-if="googleIdentity"
            class="px-4 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 text-xs font-black rounded-xl transition-all disabled:opacity-50"
            @click="confirmUnbind('google')"
            :disabled="actionLoading"
        >
          {{ actionLoading ? '处理中...' : '解绑' }}
        </button>
        <button
            v-else
            class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
            @click="handleBind('google')"
            :disabled="actionLoading"
        >
          {{ actionLoading ? '跳转中...' : '立即绑定' }}
        </button>
      </div>
    </div>

    <!-- 确认对话框 -->
    <ConfirmDialog
      v-model:show="showConfirmDialog"
      :loading="confirmDialog.loading"
      :message="confirmDialog.message"
      :title="confirmDialog.title"
      :type="confirmDialog.type"
      @cancel="confirmDialog.onCancel"
      @confirm="confirmDialog.onConfirm"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { Loader2, Shield } from 'lucide-vue-next'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useToast } from '~/composables/useToast'
import { getProviderDisplayName } from '~/utils/oauth'

const config = useRuntimeConfig()
const { showToast } = useToast()
const identities = ref([])
const loading = ref(true)
const actionLoading = ref(false)

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialog = ref({
  title: '',
  message: '',
  type: 'warning',
  loading: false,
  onConfirm: () => { },
  onCancel: () => { }
})

// 样式类
const itemClass = "flex items-center justify-between p-4 bg-zinc-950/30 border border-zinc-900 rounded-2xl hover:bg-zinc-900/50 transition-all group"

const githubIdentity = computed(() => identities.value.find(i => i.provider === 'github'))
const casdoorIdentity = computed(() => identities.value.find(i => i.provider === 'casdoor'))
const googleIdentity = computed(() => identities.value.find(i => i.provider === 'google'))

const fetchIdentities = async () => {
  try {
    loading.value = true
    identities.value = await $fetch('/api/auth/identities')
  } catch (e) {
    console.error('Failed to fetch identities', e)
  } finally {
    loading.value = false
  }
}

const handleBind = (provider) => {
  actionLoading.value = true
  // 绑定也是通过 OAuth 流程，最终回调时会自动识别已登录状态并执行绑定
  navigateTo(`/api/auth/${provider}`, { external: true })
}

const confirmUnbind = (provider) => {
  const providerName = getProviderDisplayName(provider)
  
  confirmDialog.value = {
    title: '解除绑定',
    message: `确定要解除 ${providerName} 账号的绑定吗？解除后您将无法使用该账号登录。`,
    type: 'danger',
    loading: false,
    onConfirm: () => handleUnbind(provider),
    onCancel: () => { showConfirmDialog.value = false }
  }
  showConfirmDialog.value = true
}

const handleUnbind = async (provider) => {
  confirmDialog.value.loading = true
  actionLoading.value = true
  try {
    await $fetch('/api/auth/unbind', {
      method: 'POST',
      body: { provider }
    })
    await fetchIdentities()
    showToast('解除绑定成功', 'success')
    showConfirmDialog.value = false
  } catch (e) {
    showToast(e.data?.message || '解绑失败', 'error')
  } finally {
    actionLoading.value = false
    confirmDialog.value.loading = false
  }
}

onMounted(() => {
  fetchIdentities()
})
</script>
