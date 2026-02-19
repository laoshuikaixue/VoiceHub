<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @click="handleClose"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <div
          class="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
          @click.stop
        >
          <!-- 头部 -->
          <div class="p-8 pb-4 flex items-center justify-between border-b border-zinc-800/50">
            <div>
              <h3 class="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500"
                >
                  <Icon name="music" :size="20" />
                </div>
                网易云扫码登录
              </h3>
              <p class="text-xs text-zinc-500 mt-1 ml-13">扫描二维码以安全登录您的账号</p>
            </div>
            <button
              class="p-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-2xl transition-all"
              @click="handleClose"
            >
              <Icon name="x" :size="20" />
            </button>
          </div>

          <!-- 主体 -->
          <div class="p-8 pt-4 flex flex-col items-center">
            <div class="w-full flex flex-col items-center min-h-[250px] justify-center">
              <div v-if="loading" class="flex flex-col items-center text-zinc-500">
                <Icon name="loader" :size="48" class="mb-4 animate-spin text-zinc-400" />
                <p class="font-bold uppercase tracking-widest text-[10px]">正在获取二维码...</p>
              </div>

              <div v-else-if="qrImg" class="relative group">
                <div
                  class="p-4 bg-white rounded-3xl shadow-inner transition-transform duration-500 group-hover:scale-[1.02]"
                >
                  <img :src="qrImg" alt="Login QR Code" class="w-44 h-44 object-contain" >
                </div>

                <div
                  v-if="isExpired"
                  class="absolute inset-0 bg-zinc-900/90 backdrop-blur-sm rounded-3xl flex items-center justify-center cursor-pointer transition-all hover:bg-zinc-900/80"
                  @click="initLogin"
                >
                  <div class="flex flex-col items-center text-zinc-100">
                    <Icon name="refresh" :size="40" class="mb-3 text-zinc-400" />
                    <span class="font-black uppercase tracking-widest text-xs">二维码已失效</span>
                    <span class="text-[10px] text-zinc-500 mt-1 font-bold">点击刷新</span>
                  </div>
                </div>
              </div>

              <div class="mt-8 text-center h-6">
                <Transition
                  enter-active-class="transition duration-300 ease-out"
                  enter-from-class="opacity-0 translate-y-2"
                  enter-to-class="opacity-100 translate-y-0"
                >
                  <p
                    v-if="status === 800"
                    class="text-zinc-400 text-xs font-black uppercase tracking-widest"
                  >
                    二维码已过期，请点击刷新
                  </p>
                  <p
                    v-else-if="status === 801"
                    class="text-zinc-400 text-xs font-black uppercase tracking-widest"
                  >
                    请使用网易云音乐APP扫码登录
                  </p>
                  <p
                    v-else-if="status === 802"
                    class="text-blue-500 text-xs font-black uppercase tracking-widest flex items-center justify-center"
                  >
                    <Icon name="check" :size="16" class="mr-2" />
                    扫描成功，请在手机上确认
                  </p>
                  <p
                    v-else-if="status === 803"
                    class="text-emerald-500 text-xs font-black uppercase tracking-widest"
                  >
                    登录成功，正在跳转...
                  </p>
                </Transition>
              </div>
            </div>

            <!-- 说明提示 -->
            <div class="mt-8 p-4 bg-zinc-800/30 rounded-2xl border border-zinc-800/50 w-full">
              <p
                class="text-[10px] leading-relaxed text-zinc-500 text-center uppercase tracking-[0.15em] font-black"
              >
                说明：登录状态将保存到您的浏览器中，用于搜索播客等功能。
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { onUnmounted, ref, watch } from 'vue'
import Icon from '~/components/UI/Icon.vue'

interface Props {
  show: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'login-success', data: { cookie: string; user: any }): void
}>()

const BASE_URL = 'https://api.voicehub.lao-shui.top'

const qrImg = ref('')
const loading = ref(false)
const status = ref(0) // 800: expired, 801: waiting, 802: scanned, 803: success
const isExpired = ref(false)
let timer: any = null
let unikey = ''

const handleClose = () => {
  stopPolling()
  emit('close')
}

const stopPolling = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const initLogin = async () => {
  stopPolling()
  loading.value = true
  isExpired.value = false
  status.value = 0

  try {
    // 1. Get Key
    const keyRes = await fetch(`${BASE_URL}/login/qr/key?timestamp=${Date.now()}`)
    const keyData = await keyRes.json()
    unikey = keyData.data.unikey

    // 2. Create QR
    const qrRes = await fetch(
      `${BASE_URL}/login/qr/create?key=${unikey}&qrimg=true&timestamp=${Date.now()}&ua=pc`
    )
    const qrData = await qrRes.json()
    qrImg.value = qrData.data.qrimg
    status.value = 801

    // 3. Start Polling
    timer = setInterval(checkStatus, 3000)
  } catch (err) {
    console.error('Failed to init login:', err)
    status.value = 0
  } finally {
    loading.value = false
  }
}

const checkStatus = async () => {
  if (!unikey) return

  try {
    const res = await fetch(
      `${BASE_URL}/login/qr/check?key=${unikey}&timestamp=${Date.now()}&ua=pc`
    )
    const data = await res.json()
    status.value = data.code

    if (data.code === 800) {
      // 已过期
      isExpired.value = true
      stopPolling()
    } else if (data.code === 803) {
      // 登录成功
      stopPolling()
      const cookie = data.cookie
      await handleLoginSuccess(cookie)
    }
  } catch (err) {
    console.error('检查二维码状态失败:', err)
  }
}

const handleLoginSuccess = async (cookie: string) => {
  try {
    // 使用 cookie 获取用户信息
    const userRes = await fetch(`${BASE_URL}/login/status?timestamp=${Date.now()}`, {
      method: 'POST', // 文档建议使用 POST，我们将 cookie 放在 body 中
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cookie })
    })
    const res = await userRes.json()

    const userInfo = {
      cookie,
      uid: res.data?.profile?.userId,
      nickname: res.data?.profile?.nickname,
      avatarUrl: res.data?.profile?.avatarUrl,
      userName: res.data?.profile?.nickname
    }

    // 即使获取用户信息失败，我们也有 cookie，可以认为部分成功
    // 目前直接提交现有信息
    emit('login-success', userInfo)
    handleClose()
  } catch (err) {
    console.error('获取用户信息失败:', err)
    emit('login-success', { cookie })
    handleClose()
  }
}

// 监听显示属性以初始化/停止
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      initLogin()
    } else {
      stopPolling()
    }
  }
)

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped></style>
