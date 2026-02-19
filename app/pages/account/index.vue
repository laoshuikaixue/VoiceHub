<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 pb-24">
    <!-- 顶部导航栏 -->
    <div
      class="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900/50 px-4 py-4 mb-8"
    >
      <div class="max-w-[1200px] mx-auto flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            class="p-2 hover:bg-zinc-900 rounded-xl transition-all text-zinc-400 hover:text-zinc-100"
            @click="goBack"
          >
            <ArrowLeft :size="20" />
          </button>
          <div>
            <h1 class="text-xl font-black text-zinc-100 tracking-tight">账号管理</h1>
            <p class="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">
              Account Management
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-[1200px] mx-auto px-4">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <!-- 左侧：用户信息概览 (PC端占据 4/12) -->
        <div class="lg:col-span-4 space-y-6">
          <section :class="sectionClass" class="flex flex-col items-center text-center">
            <div class="relative group">
              <div
                class="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-blue-900/20 mb-6 group-hover:scale-105 transition-transform duration-500"
              >
                <img
                  v-if="auth.user.value?.avatar && !avatarError"
                  :src="auth.user.value.avatar"
                  class="w-full h-full object-cover"
                  @error="avatarError = true"
                >
                <span v-else>{{ userInitials }}</span>
              </div>
              <div
                class="absolute -bottom-1 -right-1 p-2 bg-zinc-900 border border-zinc-800 rounded-full text-blue-500 shadow-xl"
              >
                <User :size="16" />
              </div>
            </div>

            <div class="space-y-2">
              <h2 class="text-2xl font-black text-zinc-100 tracking-tight">
                {{ auth.user.value?.name || auth.user.value?.username }}
              </h2>
              <p class="text-sm font-medium text-zinc-500">@{{ auth.user.value?.username }}</p>
            </div>

            <div class="flex flex-wrap justify-center gap-2 mt-6">
              <span
                class="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[10px] font-black uppercase tracking-wider rounded-full"
              >
                {{ roleName }}
              </span>
              <span
                v-if="auth.user.value?.grade"
                class="px-3 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-wider rounded-full"
              >
                {{ auth.user.value?.grade }}
              </span>
              <span
                v-if="auth.user.value?.class"
                class="px-3 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-wider rounded-full"
              >
                {{ auth.user.value?.class }}
              </span>
            </div>
          </section>
        </div>

        <!-- 右侧：详细设置 (PC端占据 8/12) -->
        <div class="lg:col-span-8 space-y-8">
          <!-- 第三方登录绑定 -->
          <section v-if="hasOAuthProviders" :class="sectionClass">
            <div class="flex items-center gap-3 border-b border-zinc-800/50 pb-5 mb-6">
              <div class="p-2.5 bg-purple-500/10 rounded-xl">
                <LinkIcon :size="20" class="text-purple-500" />
              </div>
              <div>
                <h2 class="text-base font-black text-zinc-100">第三方账号绑定</h2>
                <p class="text-xs text-zinc-500 mt-0.5">绑定社交账号以便更快捷地登录系统</p>
              </div>
            </div>
            <AuthOAuthBindingCard />
          </section>

          <!-- 修改密码 -->
          <section :class="sectionClass">
            <div class="flex items-center gap-3 border-b border-zinc-800/50 pb-5 mb-6">
              <div class="p-2.5 bg-blue-500/10 rounded-xl">
                <Lock :size="20" class="text-blue-500" />
              </div>
              <div>
                <h2 class="text-base font-black text-zinc-100">修改密码</h2>
                <p class="text-xs text-zinc-500 mt-0.5">为了您的账号安全，建议定期更换高强度密码</p>
              </div>
            </div>
            <div class="max-w-md">
              <AuthChangePasswordForm />
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { ArrowLeft, User, Link as LinkIcon, Lock } from 'lucide-vue-next'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'

const auth = useAuth()
const router = useRouter()
const route = useRoute()
const { showToast } = useToast()
const config = useRuntimeConfig()

const hasOAuthProviders = computed(() => {
  return config.public.oauth.github || config.public.oauth.casdoor || config.public.oauth.google
})

const avatarError = ref(false)

// 监听用户头像变化，重置错误状态
watch(
  () => auth.user.value?.avatar,
  () => {
    avatarError.value = false
  }
)

// 处理来自 OAuth 回调的消息
onMounted(() => {
  if (route.query.message) {
    showToast(route.query.message, 'success')
    router.replace({ query: { ...route.query, message: undefined, error: undefined } })
  }
  if (route.query.error) {
    showToast(route.query.error, 'error')
    router.replace({ query: { ...route.query, message: undefined, error: undefined } })
  }
})

// 样式类常量
const sectionClass = 'bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 md:p-8 shadow-2xl'

const userInitials = computed(() => {
  const name = auth.user.value?.name || auth.user.value?.username || 'U'
  return name.charAt(0).toUpperCase()
})

const roleName = computed(() => {
  const role = auth.user.value?.role
  const map = {
    ADMIN: '管理员',
    SUPER_ADMIN: '超级管理员',
    SONG_ADMIN: '审歌员',
    USER: '普通用户'
  }
  return map[role] || role
})

const goBack = () => {
  router.back()
}
</script>
