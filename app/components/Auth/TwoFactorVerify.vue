<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        @click="$emit('cancel')"
      >
        <div 
          class="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-6"
          @click.stop
        >
          <div class="text-center space-y-2">
            <h3 class="text-xl font-bold text-zinc-100">双重认证</h3>
            <p class="text-sm text-zinc-400">
              {{ method === 'totp' ? '请输入您的认证器应用生成的6位验证码' : '请输入发送到您邮箱的验证码' }}
            </p>
          </div>

          <div class="space-y-4">
            <!-- 验证码输入 -->
            <div>
              <div class="relative">
                <input
                  v-model="code"
                  type="text"
                  maxlength="6"
                  placeholder="000000"
                  class="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-center text-2xl font-mono tracking-widest text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  @keyup.enter="handleVerify"
                  ref="inputRef"
                />
              </div>
            </div>

            <!-- 发送邮箱验证码按钮 -->
            <div v-if="method === 'email'" class="text-center">
              <button
                type="button"
                @click="sendEmailCode"
                :disabled="cooldown > 0 || sending"
                class="text-sm text-blue-500 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {{ cooldown > 0 ? `${cooldown}秒后重新发送` : '发送验证码' }}
              </button>
            </div>

            <div v-if="error" class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle :size="16" />
              <span>{{ error }}</span>
            </div>

            <button
              @click="handleVerify"
              :disabled="loading || code.length !== 6"
              class="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Loader2 v-if="loading" class="animate-spin" :size="18" />
              <span>验证登录</span>
            </button>
            
            <!-- 切换验证方式按钮 -->
            <button
              v-if="hasMultipleMethods"
              @click="toggleMethod"
              class="w-full py-2 text-blue-500 hover:text-blue-400 text-sm transition-colors"
            >
              {{ method === 'totp' ? '无法使用验证器？切换到邮箱验证' : '使用验证器应用验证' }}
            </button>

            <button
              @click="$emit('cancel')"
              class="w-full py-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
            >
              返回登录
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { Loader2, AlertCircle } from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'

const props = defineProps<{
  show: boolean
  userId: number
  availableMethods?: string[]
  tempToken?: string
}>()

const emit = defineEmits<{
  (e: 'success', data: any): void
  (e: 'cancel'): void
}>()

const { showToast } = useToast()
// 默认优先使用 TOTP，如果没有则使用 Email
const defaultMethod = computed(() => props.availableMethods?.includes('totp') ? 'totp' : 'email')
const method = ref(defaultMethod.value)
const methods = computed(() => props.availableMethods || ['totp', 'email'])
const hasMultipleMethods = computed(() => methods.value.length > 1)

const code = ref('')
const loading = ref(false)
const sending = ref(false)
const cooldown = ref(0)
const error = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

let timer: any

const toggleMethod = () => {
  method.value = method.value === 'totp' ? 'email' : 'totp'
}

const sendEmailCode = async () => {
  try {
    sending.value = true
    error.value = ''
    
    await $fetch('/api/auth/2fa/send-email', {
      method: 'POST',
      body: { userId: props.userId }
    })

    showToast('验证码已发送', 'success')
    cooldown.value = 60
    timer = setInterval(() => {
      cooldown.value--
      if (cooldown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch (err: any) {
    error.value = err.message || '发送失败'
  } finally {
    sending.value = false
  }
}

const handleVerify = async () => {
  if (code.value.length !== 6) return
  
  try {
    loading.value = true
    error.value = ''
    
    const { verify2FA } = useAuth()
    const response = await verify2FA(props.userId, code.value, method.value as 'totp' | 'email', props.tempToken)
    
    emit('success', response)
  } catch (err: any) {
    error.value = err.message || '验证失败'
    code.value = '' // 出错清空
  } finally {
    loading.value = false
  }
}

// 切换方式时清空输入
watch(method, () => {
  code.value = ''
  error.value = ''
  nextTick(() => inputRef.value?.focus())
})

// 显示时聚焦输入框
watch(() => props.show, (newVal) => {
  if (newVal) {
    // 每次重新打开时重置为默认方式（优先 TOTP）
    method.value = defaultMethod.value
    nextTick(() => inputRef.value?.focus())
  }
})
</script>
