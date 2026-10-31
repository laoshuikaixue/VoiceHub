<template>
  <AppModal
    :description="locale.qqDesc"
    :show="show"
    :title="locale.qqTitle"
    size="sm"
    @close="handleClose"
  >
    <template #icon>
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info-10 text-info">
        <Icon name="music" :size="18" />
      </span>
    </template>


            <!-- 登录渠道 Tab -->
            <div
              v-if="!status || status !== 'success'"
              class="mb-5 grid w-full grid-cols-2 gap-1 rounded-2xl bg-bg-tertiary-50 p-1"
            >
              <button
                :class="[
                  'rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all',
                  channel === 'qq'
                    ? 'bg-bg-secondary text-text-primary shadow'
                    : 'text-text-tertiary hover:text-text-secondary'
                ]"
                type="button"
                @click="switchChannel('qq')"
              >
                {{ locale.channelQq }}
              </button>
              <button
                :class="[
                  'rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all',
                  channel === 'wx'
                    ? 'bg-bg-secondary text-text-primary shadow'
                    : 'text-text-tertiary hover:text-text-secondary'
                ]"
                type="button"
                @click="switchChannel('wx')"
              >
                {{ locale.channelWx }}
              </button>
            </div>

            <div class="flex min-h-[250px] w-full flex-col items-center justify-center">
              <div v-if="loading" class="flex flex-col items-center text-text-tertiary">
                <AppSpinner :size="48" class="mb-4" />
                <p class="text-xs font-bold uppercase tracking-wider">{{ locale.loadingQr }}</p>
              </div>

              <div v-else-if="qrImg" class="group relative">
                <div
                  class="rounded-2xl bg-bg-secondary p-4 shadow-inner transition-transform duration-500 group-hover:scale-[1.02]"
                >
                  <img
                    :src="qrImg"
                    alt="QQ Music Login QR Code"
                    class="h-44 w-44 rounded-2xl object-contain"
                  >
                </div>

                <div
                  v-if="isExpired"
                  class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl bg-bg-secondary-90 backdrop-blur-sm transition-all hover:bg-bg-secondary-80"
                  @click="initLogin"
                >
                  <div class="flex flex-col items-center text-text-primary">
                    <Icon name="refresh" :size="40" class="mb-3 text-text-tertiary" />
                    <span class="text-xs font-bold uppercase tracking-wider">{{ locale.qrExpired }}</span>
                    <span class="mt-1 text-xs font-bold text-text-tertiary">{{ locale.clickRefresh }}</span>
                  </div>
                </div>
              </div>

              <div v-else-if="errorMessage" class="flex flex-col items-center text-center">
                <Icon name="alert-circle" :size="44" class="mb-4 text-error" />
                <p class="text-sm font-bold text-text-primary">{{ errorMessage }}</p>
                <button
                  class="mt-5 rounded-2xl bg-info px-5 py-2 text-xs font-bold text-text-primary transition hover:bg-info"
                  type="button"
                  @click="initLogin"
                >
                  {{ locale.retry }}
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
                    class="text-xs font-bold uppercase tracking-wider text-text-tertiary"
                  >
                    {{ locale.expiredRefresh }}
                  </p>
                  <p
                    v-else-if="status === 'waiting'"
                    class="text-xs font-bold uppercase tracking-wider text-text-tertiary"
                  >
                    {{
                      scanned
                        ? locale.wxScanned
                        : channel === 'wx'
                          ? locale.wxWaiting
                          : locale.qqWaiting
                    }}
                  </p>
                  <p
                    v-else-if="status === 'success'"
                    class="text-xs font-bold uppercase tracking-wider text-success"
                  >
                    {{ locale.qqSuccess }}
                  </p>
                </Transition>
              </div>
            </div>

            <div class="mt-8 w-full rounded-2xl border border-border-secondary-50 bg-bg-tertiary-30 p-4">
              <p
                class="text-center text-xs font-bold uppercase leading-relaxed tracking-[0.15em] text-text-tertiary"
              >
                {{ channel === 'wx' ? locale.wxTip : locale.qqTip }}
              </p>
            </div>
  </AppModal>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import AppModal from '~/components/UI/Common/AppModal.vue'
import Icon from '~/components/UI/Icon.vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { useLocale } from '~/utils/locale'

const { songs } = useLocale()
const locale = computed(() => songs.value?.musicLoginModal || {})

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
// 微信渠道：已扫码待确认（驱动状态行文案切换）
const scanned = ref(false)
const errorMessage = ref('')
const checking = ref(false)
// 登录渠道：qq、wx
const channel = ref('qq')
// 弹窗开关标记：防止关闭后在飞的长轮询响应继续触发下一轮
let isOpen = false
let timer = null
let qrPayload = null

const stopPolling = () => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

const scheduleNextCheck = () => {
  if (timer || !isOpen) return
  // 微信为长轮询接口，收到响应后短间隔重入即可
  const delay = channel.value === 'wx' ? 800 : 3000
  timer = setTimeout(async () => {
    timer = null
    await checkStatus()
  }, delay)
}

const handleClose = () => {
  isOpen = false
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
    nickname: uin || locale.value.qqAccount,
    userName: uin || locale.value.qqAccount,
    raw: session
  }
}

const switchChannel = (value) => {
  if (channel.value === value) return
  channel.value = value
  initLogin()
}

const initLogin = async () => {
  stopPolling()
  isOpen = true
  loading.value = true
  status.value = ''
  isExpired.value = false
  scanned.value = false
  errorMessage.value = ''
  qrImg.value = ''
  qrPayload = null

  try {
    if (channel.value === 'wx') {
      const response = await $fetch('/api/native-api/qq/login-qr-wx')
      const data = response?.data || {}
      if (!response?.success || !data.img || !data.uuid) {
        throw new Error(locale.value.qqQrIncomplete)
      }

      qrPayload = data
      qrImg.value = data.img
      status.value = 'waiting'
      scheduleNextCheck()
    } else {
      const response = await $fetch('/api/native-api/qq/login-qr')
      const data = response?.data || {}
      if (!response?.success || !data.img || !data.ptqrtoken || !data.qrsig) {
        throw new Error(locale.value.qqQrIncomplete)
      }

      qrPayload = data
      qrImg.value = data.img
      status.value = 'waiting'
      scheduleNextCheck()
    }
  } catch (error) {
    console.error('初始化扫码登录失败:', error)
    errorMessage.value = error?.message || locale.value.qqQrFailed
  } finally {
    loading.value = false
  }
}

const checkStatus = async () => {
  if (!qrPayload || !isOpen || checking.value) return

  checking.value = true
  try {
    let data
    if (channel.value === 'wx') {
      const response = await $fetch('/api/native-api/qq/check-wx-login', {
        method: 'POST',
        body: { uuid: qrPayload.uuid }
      })
      data = response?.data || {}
    } else {
      const response = await $fetch('/api/native-api/qq/check-login', {
        method: 'POST',
        body: {
          ptqrtoken: qrPayload.ptqrtoken,
          qrsig: qrPayload.qrsig
        }
      })
      data = response?.data || {}
    }
    const loginStatus = data.status || (data.isOk ? 'success' : data.refresh ? 'expired' : 'waiting')

    // 微信渠道：手机已扫码、等待确认
    if (data.scanned) {
      scanned.value = true
    }

    if (loginStatus === 'success' || data.isOk) {
      const cookie = data.cookie || getSessionCookie(data.session)
      if (!cookie) throw new Error(locale.value.qqMissingCookie)

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

    status.value = 'waiting'
  } catch (error) {
    console.error('检查扫码登录状态失败:', error)
    errorMessage.value = error?.message || locale.value.qqCheckFailed
    stopPolling()
  } finally {
    checking.value = false
  }

  // 仅在未出结果时继续轮询
  if (!isExpired.value && status.value === 'waiting') {
    scheduleNextCheck()
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      initLogin()
    } else {
      isOpen = false
      stopPolling()
    }
  }
)

onUnmounted(() => {
  isOpen = false
  stopPolling()
})
</script>
