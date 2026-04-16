<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4">
    <div class="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
      <div>
        <h1 class="text-2xl font-black tracking-tight">兑换点歌券</h1>
        <p class="text-xs text-zinc-500 mt-2">提交卡密后会自动补交并解除点歌限制（如存在）。</p>
      </div>

      <div v-if="!token" class="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
        缺少兑换 token，请从通知链接进入。
      </div>

      <div class="space-y-3">
        <label class="text-xs font-bold text-zinc-400">卡密</label>
        <input
          v-model="code"
          type="text"
          placeholder="请输入点歌券卡密"
          class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/40"
        >
      </div>

      <button
        :disabled="submitting || !token || !code.trim()"
        class="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl py-3 transition"
        @click="submitRedeem"
      >
        {{ submitting ? '兑换中...' : '立即兑换' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'

const route = useRoute()
const auth = useAuth()
const { showToast } = useToast()

const code = ref('')
const submitting = ref(false)

const token = computed(() => {
  const value = route.query.token
  return typeof value === 'string' ? value.trim() : ''
})

onMounted(async () => {
  await auth.initAuth()

  if (!auth.isAuthenticated.value) {
    await navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`)
  }
})

const submitRedeem = async () => {
  if (!token.value || !code.value.trim()) {
    return
  }

  try {
    submitting.value = true

    const result = await $fetch('/api/voucher/redeem', {
      method: 'POST',
      body: {
        token: token.value,
        code: code.value
      },
      ...auth.getAuthConfig()
    })

    showToast(result?.message || '兑换成功', 'success')
    code.value = ''
    await navigateTo('/')
  } catch (error: any) {
    showToast(error?.data?.message || error?.message || '兑换失败，请稍后重试', 'error')
  } finally {
    submitting.value = false
  }
}
</script>
