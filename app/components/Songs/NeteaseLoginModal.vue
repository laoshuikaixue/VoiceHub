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
        <div class="absolute inset-0 bg-bg-primary-60 backdrop-blur-sm" />

        <div
          class="relative w-full max-w-sm bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl overflow-hidden"
          @click.stop
        >
          <!-- 头部 -->
          <div class="p-8 pb-4 flex items-center justify-between border-b border-border-secondary-50">
            <div>
              <h3 class="text-xl font-black text-text-primary tracking-tight flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-2xl bg-primary-hover-10 flex items-center justify-center text-primary"
                >
                  <Icon name="music" :size="20" />
                </div>
                {{ locale.neteaseTitle }}
              </h3>
              <p class="text-xs text-text-tertiary mt-1 ml-13">{{ locale.neteaseDesc }}</p>
            </div>
            <button
              class="p-3 bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary rounded-2xl transition-all"
              @click="handleClose"
            >
              <Icon name="x" :size="20" />
            </button>
          </div>

          <!-- 主体 -->
          <div class="p-8 pt-4 flex flex-col items-center">
            <div class="w-full flex flex-col items-center min-h-[250px] justify-center">
              <div v-if="loading" class="flex flex-col items-center text-text-tertiary">
                <Icon name="loader" :size="48" class="mb-4 animate-spin text-text-tertiary" />
                <p class="font-bold uppercase tracking-widest text-[10px]">{{ locale.loadingQr }}</p>
              </div>

              <div v-else-if="qrImg" class="relative group">
                <div
                  class="p-4 bg-bg-secondary rounded-3xl shadow-inner transition-transform duration-500 group-hover:scale-[1.02]"
                >
                  <img :src="qrImg" alt="Login QR Code" class="w-44 h-44 object-contain" >
                </div>

                <div
                  v-if="isExpired"
                  class="absolute inset-0 bg-bg-secondary-90 backdrop-blur-sm rounded-3xl flex items-center justify-center cursor-pointer transition-all hover:bg-bg-secondary-80"
                  @click="initLogin"
                >
                  <div class="flex flex-col items-center text-text-primary">
                    <Icon name="refresh" :size="40" class="mb-3 text-text-tertiary" />
                    <span class="font-black uppercase tracking-widest text-xs">{{ locale.qrExpired }}</span>
                    <span class="text-[10px] text-text-tertiary mt-1 font-bold">{{ locale.clickRefresh }}</span>
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
                    class="text-text-tertiary text-xs font-black uppercase tracking-widest"
                  >
                    {{ locale.expiredRefresh }}
                  </p>
                  <p
                    v-else-if="status === 801"
                    class="text-text-tertiary text-xs font-black uppercase tracking-widest"
                  >
                    {{ locale.neteaseWaiting }}
                  </p>
                  <p
                    v-else-if="status === 802"
                    class="text-primary text-xs font-black uppercase tracking-widest flex items-center justify-center"
                  >
                    <Icon name="check" :size="16" class="mr-2" />
                    {{ locale.scanSuccess }}
                  </p>
                  <p
                    v-else-if="status === 803"
                    class="text-success text-xs font-black uppercase tracking-widest"
                  >
                    {{ locale.neteaseSuccess }}
                  </p>
                </Transition>
              </div>
            </div>

            <!-- 说明提示 -->
            <div class="mt-8 p-4 bg-bg-tertiary-30 rounded-2xl border border-border-secondary-50 w-full">
              <p
                class="text-[10px] leading-relaxed text-text-tertiary text-center uppercase tracking-[0.15em] font-black"
              >
                {{ locale.neteaseTip }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import { useLocale } from '~/utils/locale'

interface Props {
  show: boolean
}

const props = defineProps<Props>()
const { songs } = useLocale()
const locale = computed(() => songs.value?.musicLoginModal || {})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'login-success', data: { cookie: string; user: any }): void
}>()

const BASE_URL = '/api/api-enhanced/netease'

const qrImg = ref('')
const loading = ref(false)
const status = ref(0) // 800已过期、801待扫码、802已扫码、803登录成功
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
    // 获取二维码登录密钥
    const keyRes = await fetch(`${BASE_URL}/login/qr/key?timestamp=${Date.now()}`)
    const keyData = await keyRes.json()
    unikey = keyData.data.unikey

    // 生成二维码
    const qrRes = await fetch(
      `${BASE_URL}/login/qr/create?key=${unikey}&qrimg=true&timestamp=${Date.now()}&ua=pc`
    )
    const qrData = await qrRes.json()
    qrImg.value = qrData.data.qrimg
    status.value = 801

    // 启动轮询
    timer = setInterval(checkStatus, 3000)
  } catch (err) {
    console.error('初始化登录失败:', err)
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
    // 通过登录凭证获取用户信息
    const userRes = await fetch(`${BASE_URL}/login/status?timestamp=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cookie })
    })
    const res = await userRes.json()

    const userInfo = {
      cookie,
      user: {
        userId: res.data?.profile?.userId,
        id: res.data?.profile?.userId,
        nickname: res.data?.profile?.nickname,
        avatarUrl: res.data?.profile?.avatarUrl,
        userName: res.data?.profile?.nickname
      }
    }

    emit('login-success', userInfo)
    handleClose()
  } catch (err) {
    console.error('获取用户信息失败:', err)
    emit('login-success', { cookie, user: null })
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
