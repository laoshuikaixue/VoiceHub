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
          class="relative w-full max-w-sm overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl"
          @click.stop
        >
          <div class="flex items-center justify-between border-b border-zinc-800/50 p-8 pb-4">
            <div>
              <h3 class="flex items-center gap-3 text-xl font-black tracking-tight text-zinc-100">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400"
                >
                  <Icon name="music" :size="20" />
                </div>
                QQ音乐扫码登录
              </h3>
              <p class="ml-13 mt-1 text-xs text-zinc-500">扫描二维码以获取账号播放能力</p>
            </div>
            <button
              class="rounded-2xl bg-zinc-800/50 p-3 text-zinc-500 transition-all hover:bg-zinc-800 hover:text-zinc-200"
              type="button"
              @click="handleClose"
            >
              <Icon name="x" :size="20" />
            </button>
          </div>

          <div class="flex flex-col items-center p-8 pt-4">
            <div class="flex min-h-[250px] w-full flex-col items-center justify-center">
              <div v-if="loading" class="flex flex-col items-center text-zinc-500">
                <Icon name="loader" :size="48" class="mb-4 animate-spin text-zinc-400" />
                <p class="text-[10px] font-bold uppercase tracking-widest">正在获取二维码...</p>
              </div>

              <div v-else-if="qrImg" class="group relative">
                <div
                  class="rounded-3xl bg-white p-4 shadow-inner transition-transform duration-500 group-hover:scale-[1.02]"
                >
                  <img :src="qrImg" alt="QQ Music Login QR Code" class="h-44 w-44 object-contain" >
                </div>

                <div
                  v-if="isExpired"
                  class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-3xl bg-zinc-900/90 backdrop-blur-sm transition-all hover:bg-zinc-900/80"
                  @click="initLogin"
                >
                  <div class="flex flex-col items-center text-zinc-100">
                    <Icon name="refresh" :size="40" class="mb-3 text-zinc-400" />
                    <span class="text-xs font-black uppercase tracking-widest">二维码已失效</span>
                    <span class="mt-1 text-[10px] font-bold text-zinc-500">点击刷新</span>
                  </div>
                </div>
              </div>

              <div v-else-if="errorMessage" class="flex flex-col items-center text-center">
                <Icon name="alert-circle" :size="44" class="mb-4 text-red-400" />
                <p class="text-sm font-bold text-zinc-200">{{ errorMessage }}</p>
                <button
                  class="mt-5 rounded-2xl bg-cyan-500 px-5 py-2 text-xs font-black text-white transition hover:bg-cyan-400"
                  type="button"
                  @click="initLogin"
                >
                  重试
                </button>
              </div>

              <div class="mt-8 h-6 text-center">
                <Transition
                  enter-active-class="transition duration-300 ease-out"
                  enter-from-class="opacity-0 translate-y-2"
                  enter-to-class="opacity-100 translate-y-0"
                >
                  <p
                    v-if="status === 'expired'"
                    class="text-xs font-black uppercase tracking-widest text-zinc-400"
                  >
                    二维码已过期，请点击刷新
                  </p>
                  <p
                    v-else-if="status === 'waiting'"
                    class="text-xs font-black uppercase tracking-widest text-zinc-400"
                  >
                    请使用 QQ 扫码登录
                  </p>
                  <p
                    v-else-if="status === 'success'"
                    class="text-xs font-black uppercase tracking-widest text-emerald-500"
                  >
                    登录成功，正在关闭...
                  </p>
                </Transition>
              </div>
            </div>

            <div class="mt-8 w-full rounded-2xl border border-zinc-800/50 bg-zinc-800/30 p-4">
              <p
                class="text-center text-[10px] font-black uppercase leading-relaxed tracking-[0.15em] text-zinc-500"
              >
                登录状态仅保存到当前浏览器，用于 QQ 音乐播放和歌词解析。
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { onUnmounted, ref, watch } from 'vue'
import Icon from '~/components/UI/Icon.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'login-success'])

const qrImg = ref('')
const loading = ref(false)
const status = ref('')
const isExpired = ref(false)
const errorMessage = ref('')
const checking = ref(false)
let timer = null
let qrPayload = null

const stopPolling = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const handleClose = () => {
  stopPolling()
  emit('close')
}

const getSessionCookie = (session) => {
  if (typeof session?.cookie === 'string') return session.cookie
  if (Array.isArray(session?.cookieList)) return session.cookieList.join('; ')
  return ''
}

const buildUserInfo = (session, user) => {
  if (user) return user

  const uin = session?.uin || session?.loginUin || session?.cookieObject?.uin || ''
  return {
    userId: uin,
    id: uin,
    nickname: uin ? `QQ ${uin}` : 'QQ音乐账号',
    userName: uin ? `QQ ${uin}` : 'QQ音乐账号',
    raw: session
  }
}

const initLogin = async () => {
  stopPolling()
  loading.value = true
  status.value = ''
  isExpired.value = false
  errorMessage.value = ''
  qrImg.value = ''
  qrPayload = null

  try {
    const response = await $fetch('/api/native-api/qq/login-qr')
    const data = response?.data || {}
    if (!response?.success || !data.img || !data.ptqrtoken || !data.qrsig) {
      throw new Error('QQ 登录二维码返回不完整')
    }

    qrPayload = data
    qrImg.value = data.img
    status.value = 'waiting'
    timer = setInterval(checkStatus, 3000)
  } catch (error) {
    console.error('初始化 QQ 登录失败:', error)
    errorMessage.value = error?.message || '获取 QQ 登录二维码失败'
  } finally {
    loading.value = false
  }
}

const checkStatus = async () => {
  if (!qrPayload?.ptqrtoken || !qrPayload?.qrsig || checking.value) return

  checking.value = true
  try {
    const response = await $fetch('/api/native-api/qq/check-login', {
      method: 'POST',
      body: {
        ptqrtoken: qrPayload.ptqrtoken,
        qrsig: qrPayload.qrsig
      }
    })
    const data = response?.data || {}
    const loginStatus = data.status || (data.isOk ? 'success' : data.refresh ? 'expired' : 'waiting')

    if (loginStatus === 'success' || data.isOk) {
      const cookie = data.cookie || getSessionCookie(data.session)
      if (!cookie) throw new Error('QQ 登录成功但未返回 Cookie')

      status.value = 'success'
      stopPolling()
      emit('login-success', {
        cookie,
        user: buildUserInfo(data.session, data.user),
        authDiagnostic: data.authDiagnostic
      })
      handleClose()
      return
    }

    if (loginStatus === 'expired' || data.refresh) {
      status.value = 'expired'
      isExpired.value = true
      stopPolling()
      return
    }

    if (data.message) {
      status.value = 'waiting'
      return
    }

    status.value = 'waiting'
  } catch (error) {
    console.error('检查 QQ 登录状态失败:', error)
    errorMessage.value = error?.message || '检查 QQ 登录状态失败'
    stopPolling()
  } finally {
    checking.value = false
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
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
