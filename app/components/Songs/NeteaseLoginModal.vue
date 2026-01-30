<template>
  <div v-if="show" class="modal-overlay" @click="handleClose">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>网易云音乐扫码登录</h3>
        <button class="close-btn" @click="handleClose">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <line x1="18" x2="6" y1="6" y2="18"></line>
            <line x1="6" x2="18" y1="6" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="qr-container">
          <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>正在获取二维码...</p>
          </div>

          <div v-else-if="qrImg" class="qr-wrapper">
            <img :src="qrImg" alt="Login QR Code" class="qr-code"/>
            <div v-if="isExpired" class="qr-overlay" @click="initLogin">
              <div class="refresh-btn">
                <span>二维码已失效</span>
                <span class="refresh-text">点击刷新</span>
              </div>
            </div>
          </div>

          <div class="status-text">
            <p v-if="status === 800">二维码已过期，请点击刷新</p>
            <p v-else-if="status === 801">请使用网易云音乐APP扫码登录</p>
            <p v-else-if="status === 802">扫描成功，请在手机上确认</p>
            <p v-else-if="status === 803">登录成功，正在跳转...</p>
            <p v-else>正在加载...</p>
          </div>
        </div>

        <div class="tips">
          <p>说明：登录状态将保存到您的浏览器中，用于搜索播客等功能。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {onUnmounted, ref, watch} from 'vue'

interface Props {
  show: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'login-success', data: { cookie: string, user: any }): void
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
    const qrRes = await fetch(`${BASE_URL}/login/qr/create?key=${unikey}&qrimg=true&timestamp=${Date.now()}&ua=pc`)
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
    const res = await fetch(`${BASE_URL}/login/qr/check?key=${unikey}&timestamp=${Date.now()}&ua=pc`)
    const data = await res.json()
    status.value = data.code

    if (data.code === 800) {
      // Expired
      isExpired.value = true
      stopPolling()
    } else if (data.code === 803) {
      // Success
      stopPolling()
      const cookie = data.cookie
      await handleLoginSuccess(cookie)
    }
  } catch (err) {
    console.error('Check status error:', err)
  }
}

const handleLoginSuccess = async (cookie: string) => {
  try {
    // Get user info with the cookie
    const userRes = await fetch(`${BASE_URL}/login/status?timestamp=${Date.now()}`, {
      method: 'POST', // The docs/example suggest POST for status, but let's check if we can pass cookie in query or body
      // Actually standard usage with this API often accepts cookie as query param or in body. 
      // The example uses POST with body { cookie }.
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({cookie})
    })
    const userData = await userRes.json()
    const user = userData.data?.profile || userData.data?.account || {}

    emit('login-success', {cookie, user})
    handleClose()
  } catch (err) {
    console.error('Get user info error:', err)
    // Even if getting user info fails, we have the cookie, so we can consider it a partial success or retry
    // For now, let's emit what we have
    emit('login-success', {cookie, user: {}})
    handleClose()
  }
}

// Watch for show prop to init/stop
watch(() => props.show, (newVal) => {
  if (newVal) {
    initLogin()
  } else {
    stopPolling()
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--bg-primary, #ffffff);
  border-radius: 16px;
  width: 90%;
  max-width: 360px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  animation: modal-in 0.3s ease-out;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--text-secondary, #6b7280);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.close-btn:hover {
  background: var(--bg-hover, #f3f4f6);
  color: var(--text-primary, #111827);
}

.close-btn svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 250px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 180px;
  color: var(--text-secondary, #6b7280);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #e60026;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

.qr-wrapper {
  position: relative;
  width: 180px;
  height: 180px;
  margin-bottom: 16px;
}

.qr-code {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.refresh-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-weight: 500;
  color: #e60026;
}

.refresh-text {
  font-size: 0.875rem;
  margin-top: 4px;
}

.status-text {
  margin-top: 8px;
  text-align: center;
  color: var(--text-primary, #374151);
  font-size: 0.95rem;
  height: 24px;
}

.tips {
  margin-top: 24px;
  font-size: 0.75rem;
  color: var(--text-secondary, #9ca3af);
  text-align: center;
  max-width: 240px;
}

.tips p {
  margin: 4px 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Dark mode support - updated to match new style */
:root[class~="dark"] .modal-content {
  background: rgba(20, 20, 25, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ffffff;
  backdrop-filter: blur(8px);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

:root[class~="dark"] .modal-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.02);
}

:root[class~="dark"] .modal-header h3 {
  color: #ffffff;
}

:root[class~="dark"] .close-btn {
  color: rgba(255, 255, 255, 0.4);
}

:root[class~="dark"] .close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

:root[class~="dark"] .status-text {
  color: rgba(255, 255, 255, 0.9);
}

:root[class~="dark"] .tips {
  color: rgba(255, 255, 255, 0.5);
}

:root[class~="dark"] .qr-overlay {
  background: rgba(20, 20, 25, 0.95);
}

:root[class~="dark"] .spinner {
  border-color: rgba(255, 255, 255, 0.1);
  border-top-color: #e60026;
}
</style>
