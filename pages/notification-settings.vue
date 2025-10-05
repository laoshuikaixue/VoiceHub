<template>
  <div class="notification-settings-page">
    <!-- 顶部导航栏 -->
    <div class="top-nav">
      <button class="back-button" @click="goBack">
        <svg fill="none" height="20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"
             stroke-width="2" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
          <path d="m12 19-7-7 7-7"/>
          <path d="M19 12H5"/>
        </svg>
        返回主页
      </button>
      <h1 class="page-title">通知设置</h1>
    </div>


    <div class="main-container">
      <div v-if="loading" class="loading-container">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <div v-else class="settings-content">
        <!-- 站内通知设置 -->
        <section class="settings-section">
          <div class="section-header">
            <h2>站内通知设置</h2>
            <p>配置您希望接收的通知类型</p>
          </div>

          <div class="settings-grid">
            <!-- 歌曲被选中通知 -->
            <div class="setting-card">
              <div class="setting-info">
                <h3>歌曲被选中通知</h3>
                <p>当您投稿的歌曲被选中播放时通知您</p>
              </div>
              <div class="setting-control">
                <label class="toggle-switch">
                  <input
                      v-model="localSettings.songSelectedNotify"
                      type="checkbox"
                  >
                  <span class="switch"></span>
                </label>
              </div>
            </div>

            <!-- 歌曲已播放通知 -->
            <div class="setting-card">
              <div class="setting-info">
                <h3>歌曲已播放通知</h3>
                <p>当您投稿的歌曲播放完成时通知您</p>
              </div>
              <div class="setting-control">
                <label class="toggle-switch">
                  <input
                      v-model="localSettings.songPlayedNotify"
                      type="checkbox"
                  >
                  <span class="switch"></span>
                </label>
              </div>
            </div>

            <!-- 歌曲获得投票通知 -->
            <div class="setting-card">
              <div class="setting-info">
                <h3>歌曲获得投票通知</h3>
                <p>当您投稿的歌曲获得投票时通知您</p>
              </div>
              <div class="setting-control">
                <label class="toggle-switch">
                  <input
                      v-model="localSettings.songVotedNotify"
                      type="checkbox"
                  >
                  <span class="switch"></span>
                </label>
              </div>
            </div>

            <!-- 投票阈值设置 -->
            <div class="setting-card">
              <div class="setting-info">
                <h3>投票通知阈值</h3>
                <p>当投票数达到此阈值时才发送通知</p>
              </div>
              <div class="setting-control">
                <div class="threshold-input">
                  <input
                      v-model.number="localSettings.songVotedThreshold"
                      class="number-input"
                      max="100"
                      min="1"
                      type="number"
                  >
                  <span class="unit">票</span>
                </div>
              </div>
            </div>

            <!-- 系统通知 -->
            <div class="setting-card">
              <div class="setting-info">
                <h3>系统通知</h3>
                <p>接收系统重要通知和公告</p>
              </div>
              <div class="setting-control">
                <label class="toggle-switch">
                  <input
                      v-model="localSettings.systemNotify"
                      type="checkbox"
                  >
                  <span class="switch"></span>
                </label>
              </div>
            </div>

            <!-- 邮件通知总开关移除：绑定且已验证邮箱即启用邮件通知 -->

            <!-- 邮件通知细分设置移除：邮件沿用上面的通知类型设置 -->

            <!-- 通知刷新间隔 -->
            <div class="setting-card">
              <div class="setting-info">
                <h3>通知刷新间隔</h3>
                <p>设置通知检查的时间间隔</p>
              </div>
              <div class="setting-control">
                <div class="interval-input">
                  <input
                      v-model.number="localSettings.refreshInterval"
                      class="range-input"
                      max="300"
                      min="30"
                      step="30"
                      type="range"
                  >
                  <span class="interval-display">{{ localSettings.refreshInterval }}秒</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 社交账号绑定 -->
        <section class="settings-section">
          <div class="section-header">
            <h2>社交账号</h2>
            <p>绑定您的社交账号以接收推送通知</p>
          </div>

          <div class="settings-grid">
            <!-- 邮箱绑定 -->
            <div class="setting-card email-card">
              <div class="setting-info">
                <h3>邮箱通知</h3>
                <p v-if="!userEmail">绑定邮箱以接收邮件通知</p>
                <p v-else-if="!emailVerified" class="pending-info">邮箱：<span class="email-address">{{
                    userEmail
                  }}</span> <span class="status pending">待验证</span></p>
                <p v-else class="bound-info">已绑定邮箱：<span class="email-address">{{ userEmail }}</span> <span
                    class="status verified">已验证</span></p>
              </div>
              <div class="setting-control">
                <!-- 未绑定状态 -->
                <div v-if="!userEmail" class="email-bind-section">
                  <div class="bind-step">
                    <input
                        v-model="newEmail"
                        :disabled="bindingEmail"
                        class="email-input"
                        placeholder="请输入邮箱地址"
                        type="email"
                    >
                    <button
                        :disabled="!newEmail || bindingEmail"
                        class="btn btn-primary"
                        @click="bindEmail"
                    >
                      {{ bindingEmail ? '绑定中...' : '绑定邮箱' }}
                    </button>
                  </div>
                </div>

                <!-- 待验证状态：验证码方式 -->
                <div v-else-if="!emailVerified" class="email-verify-section">
                  <div class="verify-info">
                    <p>验证码已发送到您的邮箱：<span class="email-address">{{ userEmail }}</span></p>
                    <p>请在5分钟内输入6位验证码完成验证：</p>
                  </div>
                  <div class="verify-input-group">
                    <input
                        v-model="emailCode"
                        :class="{ 'complete': emailCode.length === 6, 'error': emailCodeError }"
                        :disabled="bindingEmail"
                        autocomplete="off"
                        class="verify-input"
                        inputmode="numeric"
                        maxlength="6"
                        pattern="[0-9]*"
                        placeholder="输入6位验证码"
                        type="text"
                        @input="handleEmailCodeInput"
                        @keydown="handleEmailCodeKeydown"
                    >
                    <div class="verify-actions">
                      <button :disabled="bindingEmail || emailCode.length !== 6" class="btn btn-primary"
                              @click="verifyEmailCode">
                        {{ bindingEmail ? '验证中...' : '确认验证' }}
                      </button>
                      <button :disabled="resendingEmail" class="btn btn-secondary" @click="resendVerificationEmail">
                        {{ resendingEmail ? '发送中...' : '重新发送验证码' }}
                      </button>
                      <button class="btn btn-outline" @click="changeEmail">
                        更换邮箱
                      </button>
                    </div>
                  </div>
                </div>

                <!-- 已验证状态 -->
                <div v-else class="email-bound-section">
                  <div class="bound-actions">
                    <button
                        class="btn btn-outline"
                        @click="changeEmail"
                    >
                      更换邮箱
                    </button>
                    <button
                        :disabled="unbindingEmail"
                        class="btn btn-danger"
                        @click="unbindEmail"
                    >
                      {{ unbindingEmail ? '解绑中...' : '解绑邮箱' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- MeoW 账号绑定 -->
            <div class="setting-card meow-card">
              <div class="setting-info">
                <h3>MeoW 账号</h3>
                <p v-if="!localSettings.meowUserId">绑定 MeoW 账号以接收推送通知</p>
                <p v-else class="bound-info">已绑定账号：<span class="user-id">{{ localSettings.meowUserId }}</span></p>
              </div>
              <div class="setting-control">
                <!-- 未绑定状态 -->
                <div v-if="!localSettings.meowUserId" class="meow-bind-section">
                  <!-- 第一步：输入用户ID -->
                  <div v-if="!verificationSent" class="bind-step">
                    <input
                        v-model="meowUserId"
                        :disabled="binding"
                        class="meow-input"
                        placeholder="请输入 MeoW 用户 ID"
                        type="text"
                    >
                    <button
                        :disabled="!meowUserId || binding"
                        class="btn btn-primary"
                        @click="sendVerificationCode"
                    >
                      {{ binding ? '发送中...' : '发送验证码' }}
                    </button>
                  </div>

                  <!-- 第二步：输入验证码 -->
                  <div v-else class="verify-step">
                    <div class="verify-info">
                      <p>验证码已发送到 MeoW ID: <strong>{{ meowUserId }}</strong></p>
                      <p>请在 MeoW 中查收验证码并输入：</p>
                    </div>
                    <div class="verify-input-group">
                      <input
                          v-model="verificationCode"
                          :class="{
                          'complete': verificationCode.length === 6,
                          'error': verificationCodeError
                        }"
                          :disabled="binding"
                          autocomplete="off"
                          class="verify-input"
                          inputmode="numeric"
                          maxlength="6"
                          pattern="[0-9]*"
                          placeholder="输入6位验证码"
                          type="text"
                          @input="handleVerificationCodeInput"
                          @keydown="handleVerificationCodeKeydown"
                      >
                      <div class="verify-actions">
                        <button :disabled="binding || verificationCode.length !== 6" class="btn btn-primary"
                                @click="verifyAndBind">
                          {{ binding ? '验证中...' : '确认绑定' }}
                        </button>
                        <button :disabled="binding" class="btn btn-secondary" @click="cancelVerification">
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 已绑定状态 -->
                <div v-else class="meow-bound-section">
                  <button class="btn btn-danger" @click="showUnbindConfirm">
                    解绑账号
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 保存按钮 -->
        <div class="save-section">
          <button :disabled="saving" class="btn btn-primary save-btn" @click="saveSettings">
            {{ saving ? '保存中...' : '保存设置' }}
          </button>
        </div>
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
import {nextTick, onMounted, ref} from 'vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import {useSiteConfig} from '~/composables/useSiteConfig'

const {siteTitle} = useSiteConfig()

// 页面状态
const loading = ref(true)
const saving = ref(false)
const binding = ref(false)

// 通知设置
const localSettings = ref({
  songSelectedNotify: true,
  songPlayedNotify: true,
  songVotedNotify: true,
  songVotedThreshold: 5,
  systemNotify: true,
  refreshInterval: 60,
  meowUserId: '',
  // 邮件通知设置
  // 邮件通知总开关移除：以邮箱是否已验证判断
})

// MeoW 绑定相关
const meowUserId = ref('')
const verificationSent = ref(false)
const verificationCode = ref('')
const verificationCodeError = ref(false)

// 邮箱绑定相关
const userEmail = ref('')
const emailVerified = ref(false)
const newEmail = ref('')
const bindingEmail = ref(false)
const resendingEmail = ref(false)
const unbindingEmail = ref(false)
const emailCode = ref('')
const emailCodeError = ref(false)

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialog = ref({
  title: '',
  message: '',
  type: 'warning',
  loading: false,
  onConfirm: () => {
  },
  onCancel: () => {
  }
})


// 通知显示函数
const showNotification = (message, type = 'info') => {
  if (typeof window !== 'undefined' && window.$showNotification) {
    window.$showNotification(message, type)
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`)
  }
}

// 返回主页
const goBack = () => {
  if (typeof window !== 'undefined') {
    window.history.back()
  }
}

// 页面初始化
onMounted(async () => {
  // 设置页面标题
  if (typeof document !== 'undefined' && siteTitle.value) {
    document.title = `通知设置 | ${siteTitle.value}`
  }

  await loadSettings()
})

// 格式化时间间隔显示
const formatInterval = (seconds) => {
  if (seconds < 60) {
    return `${seconds}秒`
  } else {
    return `${Math.floor(seconds / 60)}分钟`
  }
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

// 处理验证码输入
const handleVerificationCodeInput = (event) => {
  // 只允许数字输入
  const value = event.target.value.replace(/[^0-9]/g, '')
  verificationCode.value = value

  // 清除错误状态
  if (verificationCodeError.value) {
    verificationCodeError.value = false
  }

  // 如果输入了6位数字，自动聚焦到确认按钮
  if (value.length === 6) {
    nextTick(() => {
      const confirmBtn = document.querySelector('.verify-actions .btn-primary')
      if (confirmBtn && !confirmBtn.disabled) {
        confirmBtn.focus()
      }
    })
  }
}

// 处理验证码输入键盘事件
const handleVerificationCodeKeydown = (event) => {
  // 允许的键：数字、退格、删除、方向键、Tab
  const allowedKeys = [
    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ]

  // 如果不是允许的键，阻止输入
  if (!allowedKeys.includes(event.key)) {
    event.preventDefault()
    return
  }

  // 如果按下回车键且验证码长度为6位，执行绑定
  if (event.key === 'Enter' && verificationCode.value.length === 6) {
    verifyAndBind()
  }
}

// 加载设置
const loadSettings = async () => {
  try {
    loading.value = true
    const response = await $fetch('/api/notifications/settings')

    if (response.success) {
      localSettings.value = {
        songSelectedNotify: response.data.songSelectedNotify || false,
        songPlayedNotify: response.data.songPlayedNotify || false,
        songVotedNotify: response.data.songVotedNotify || false,
        songVotedThreshold: response.data.songVotedThreshold || 5,
        systemNotify: response.data.systemNotify || true,
        refreshInterval: response.data.refreshInterval || 60,
        meowUserId: response.data.meowUserId || '',
        // 邮件通知总开关移除
      }

      // 加载用户邮箱信息
      userEmail.value = response.data.userEmail || ''
      emailVerified.value = response.data.emailVerified || false
    }
  } catch (err) {
    console.error('加载设置失败:', err)
    showNotification('加载设置失败，请刷新页面重试', 'error')
  } finally {
    loading.value = false
  }
}

// 发送验证码
const sendVerificationCode = async () => {
  if (!meowUserId.value.trim()) {
    showNotification('请输入 MeoW 用户 ID', 'error')
    return
  }

  try {
    binding.value = true

    const response = await $fetch('/api/meow/bind', {
      method: 'POST',
      body: {
        action: 'send_verification',
        meowId: meowUserId.value.trim()
      }
    })

    if (response.success) {
      verificationSent.value = true
      showNotification('验证码已发送到您的 MeoW 账号', 'success')
    } else {
      showNotification(response.message || '发送验证码失败，请检查 MeoW ID 是否正确', 'error')
    }
  } catch (err) {
    console.error('发送验证码失败:', err)
    showNotification(err.data?.message || '发送验证码失败，请检查 MeoW ID 是否正确', 'error')
  } finally {
    binding.value = false
  }
}

// 验证并绑定
const verifyAndBind = async () => {
  if (!verificationCode.value || verificationCode.value.length !== 6) {
    showNotification('请输入6位验证码', 'error')
    verificationCodeError.value = true
    return
  }

  try {
    binding.value = true

    const response = await $fetch('/api/meow/bind', {
      method: 'POST',
      body: {
        action: 'verify_and_bind',
        meowId: meowUserId.value.trim(),
        verificationCode: verificationCode.value
      }
    })

    if (response.success) {
      localSettings.value.meowUserId = meowUserId.value.trim()

      // 重置状态
      meowUserId.value = ''
      verificationCode.value = ''
      verificationSent.value = false

      showNotification('MeoW 账号绑定成功！', 'success')
    } else {
      showNotification(response.message || '验证码错误或已过期，请重试', 'error')
      verificationCodeError.value = true
      // 添加抖动动画效果
      setTimeout(() => {
        verificationCodeError.value = false
      }, 1000)
    }
  } catch (err) {
    console.error('绑定失败:', err)
    showNotification(err.data?.message || '验证码错误或已过期，请重试', 'error')
    verificationCodeError.value = true
    setTimeout(() => {
      verificationCodeError.value = false
    }, 1000)
  } finally {
    binding.value = false
  }
}

// 取消验证
const cancelVerification = () => {
  verificationSent.value = false
  verificationCode.value = ''
  meowUserId.value = ''
}

// 显示解绑确认对话框
const showUnbindConfirm = () => {
  confirmDialog.value = {
    title: '解绑 MeoW 账号',
    message: '确定要解绑 MeoW 账号吗？解绑后将无法接收推送通知。',
    type: 'danger',
    loading: false,
    onConfirm: performUnbind,
    onCancel: () => {
      showConfirmDialog.value = false
    }
  }
  showConfirmDialog.value = true
}

// 执行解绑操作
const performUnbind = async () => {
  try {
    confirmDialog.value.loading = true

    const response = await $fetch('/api/meow/unbind', {
      method: 'POST'
    })

    if (response.success) {
      localSettings.value.meowUserId = ''
      showNotification('MeoW 账号已解绑', 'success')
      showConfirmDialog.value = false
    } else {
      showNotification(response.message || '解绑失败', 'error')
    }
  } catch (err) {
    console.error('解绑失败:', err)
    showNotification(err.data?.message || '解绑失败，请重试', 'error')
  } finally {
    confirmDialog.value.loading = false
  }
}

// 邮箱绑定相关方法
const bindEmail = async () => {
  if (!newEmail.value) {
    showNotification('请输入邮箱地址', 'error')
    return
  }

  // 简单的邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(newEmail.value)) {
    showNotification('请输入有效的邮箱地址', 'error')
    return
  }

  bindingEmail.value = true
  try {
    const response = await $fetch('/api/user/email/bind', {
      method: 'POST',
      body: {email: newEmail.value}
    })

    if (response.success) {
      userEmail.value = newEmail.value
      emailVerified.value = false
      newEmail.value = ''
      showNotification('验证码已发送，请查收邮箱', 'success')
    } else {
      showNotification(response.message || '绑定失败', 'error')
    }
  } catch (err) {
    console.error('绑定邮箱失败:', err)
    showNotification(err.data?.message || '绑定邮箱失败，请重试', 'error')
  } finally {
    bindingEmail.value = false
  }
}


const handleEmailCodeInput = (event) => {
  const value = event.target.value.replace(/[^0-9]/g, '')
  emailCode.value = value
  if (emailCodeError.value) emailCodeError.value = false
}

const handleEmailCodeKeydown = (event) => {
  const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
  if (!allowed.includes(event.key)) {
    event.preventDefault();
    return
  }
  if (event.key === 'Enter' && emailCode.value.length === 6) verifyEmailCode()
}

const verifyEmailCode = async () => {
  if (emailCode.value.length !== 6) {
    emailCodeError.value = true
    showNotification('请输入6位验证码', 'error')
    return
  }
  try {
    bindingEmail.value = true
    const response = await $fetch('/api/user/email/verify-code', {
      method: 'POST',
      body: {email: userEmail.value, code: emailCode.value}
    })
    if (response.success) {
      emailVerified.value = true
      emailCode.value = ''
      showNotification('邮箱验证成功', 'success')
    } else {
      emailCodeError.value = true
      showNotification(response.message || '验证码错误或已过期', 'error')
    }
  } catch (err) {
    console.error('邮箱验证失败:', err)
    emailCodeError.value = true
    showNotification(err.data?.message || '邮箱验证失败，请重试', 'error')
  } finally {
    bindingEmail.value = false
  }
}

const changeEmail = () => {
  // 显示确认对话框
  confirmDialog.value = {
    title: '更换邮箱',
    message: '更换邮箱将清除当前绑定的邮箱信息，需要重新验证新邮箱。确定要继续吗？',
    type: 'warning',
    loading: false,
    onConfirm: performChangeEmail,
    onCancel: () => {
      showConfirmDialog.value = false
    }
  }
  showConfirmDialog.value = true
}

const performChangeEmail = () => {
  userEmail.value = ''
  emailVerified.value = false
  newEmail.value = ''
  emailCode.value = ''
  emailCodeError.value = false
  showConfirmDialog.value = false
  showNotification('已清除邮箱信息，请输入新邮箱地址', 'info')
}

const resendVerificationEmail = async () => {
  if (!userEmail.value) {
    showNotification('邮箱信息丢失，请重新绑定', 'error')
    return
  }

  try {
    resendingEmail.value = true

    const response = await $fetch('/api/user/email/resend-verification', {
      method: 'POST'
    })

    if (response.success) {
      emailCode.value = ''
      emailCodeError.value = false
      showNotification('验证码已重新发送，请查收邮箱', 'success')
    } else {
      showNotification(response.message || '重新发送失败，请稍后重试', 'error')
    }
  } catch (err) {
    console.error('重新发送验证码失败:', err)
    showNotification(err.data?.message || '重新发送失败，请稍后重试', 'error')
  } finally {
    resendingEmail.value = false
  }
}

const unbindEmail = async () => {
  confirmDialog.value = {
    title: '确认解绑邮箱',
    message: '解绑后将无法接收邮件通知，确定要继续吗？',
    type: 'warning',
    loading: false,
    onConfirm: performEmailUnbind,
    onCancel: () => {
      showConfirmDialog.value = false
    }
  }
  showConfirmDialog.value = true
}

const performEmailUnbind = async () => {
  try {
    confirmDialog.value.loading = true

    const response = await $fetch('/api/user/email/unbind', {
      method: 'POST'
    })

    if (response.success) {
      userEmail.value = ''
      emailVerified.value = false
      // 邮件通知总开关移除，无需重置
      showNotification('邮箱已解绑', 'success')
      showConfirmDialog.value = false
    } else {
      showNotification(response.message || '解绑失败', 'error')
    }
  } catch (err) {
    console.error('解绑邮箱失败:', err)
    showNotification(err.data?.message || '解绑邮箱失败，请重试', 'error')
  } finally {
    confirmDialog.value.loading = false
  }
}

// 保存设置
const saveSettings = async () => {
  try {
    saving.value = true

    const response = await $fetch('/api/notifications/settings', {
      method: 'POST',
      body: localSettings.value
    })

    if (response.success) {
      showNotification('设置保存成功', 'success')
    } else {
      showNotification(response.message || '保存失败', 'error')
    }
  } catch (err) {
    console.error('保存设置失败:', err)
    showNotification(err.data?.message || '保存设置失败，请重试', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* 页面容器 */
.notification-settings-page {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* 顶部导航栏 */
.top-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-secondary);
}

.back-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-tertiary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: var(--transition-normal);
}

.back-button:hover {
  background: var(--bg-quaternary);
  color: var(--text-primary);
  border-color: var(--border-quaternary);
}

.page-title {
  color: var(--text-primary);
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  margin: 0;
}


/* 主容器 */
.main-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--bg-tertiary);
  border-top: 3px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 设置内容 */
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* 设置区域 */
.settings-section {
  background: var(--bg-secondary);
  border-radius: var(--radius-xl);
  padding: 2rem;
  border: 1px solid var(--border-secondary);
}

.section-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-secondary);
}

.section-header h2 {
  color: var(--text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin-bottom: 0.5rem;
}

.section-header p {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  margin: 0;
}

/* 设置网格 */
.settings-grid {
  display: grid;
  gap: 1rem;
}

.setting-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-tertiary);
  transition: var(--transition-normal);
}

.setting-card:hover {
  border-color: var(--primary);
  background: var(--bg-hover);
}

.setting-info {
  flex: 1;
}

.setting-info h3 {
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  margin-bottom: 0.5rem;
}

.setting-info p {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.4;
  margin: 0;
}

.setting-control {
  margin-left: 1.5rem;
}

/* 开关样式 */
.toggle-switch {
  position: relative;
}

.toggle-switch input[type="checkbox"] {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;
  background: var(--bg-quaternary);
  border-radius: 14px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.switch::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 24px;
  height: 24px;
  background: white;
  border-radius: 50%;
  transition: transform 0.3s ease;
  box-shadow: var(--shadow-sm);
}

.toggle-switch input[type="checkbox"]:checked + .switch {
  background: var(--primary);
}

.toggle-switch input[type="checkbox"]:checked + .switch::before {
  transform: translateX(24px);
}

/* 禁用状态的开关 */
.switch.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 邮箱相关样式 */
.email-card .setting-info {
  margin-bottom: 1rem;
}

.email-address {
  color: var(--primary);
  font-weight: var(--font-medium);
}

.status {
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  margin-left: 0.5rem;
}

.status.verified {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status.pending {
  background: rgba(249, 115, 22, 0.1);
  color: #f97316;
}

.email-bind-section .bind-step,
.email-verify-section,
.email-bound-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.email-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-tertiary);
  border-radius: var(--radius-md);
  background: var(--bg-quaternary);
  color: var(--text-primary);
  font-size: var(--text-sm);
  transition: var(--transition-normal);
}

.email-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--input-shadow-focus);
}

.email-input::placeholder {
  color: var(--text-quaternary);
}

.verify-actions,
.bound-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-outline {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-tertiary);
}

.btn-outline:hover:not(:disabled) {
  background: var(--bg-quaternary);
  border-color: var(--border-secondary);
  color: var(--text-primary);
}

/* 邮件通知细分设置 */
.email-details {
  border-left: 3px solid var(--primary);
}

.email-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.email-setting-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  transition: var(--transition-normal);
}

.email-setting-item:hover {
  color: var(--text-primary);
}

.email-setting-item input[type="checkbox"] {
  display: none;
}

.checkmark {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-tertiary);
  border-radius: var(--radius-sm);
  position: relative;
  transition: var(--transition-normal);
}

.email-setting-item input[type="checkbox"]:checked + .checkmark {
  background: var(--primary);
  border-color: var(--primary);
}

.email-setting-item input[type="checkbox"]:checked + .checkmark::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* 阈值输入 */
.threshold-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.number-input {
  width: 80px;
  padding: 0.5rem;
  border: 1px solid var(--border-tertiary);
  border-radius: var(--radius-md);
  background: var(--bg-quaternary);
  color: var(--text-primary);
  text-align: center;
  font-size: var(--text-sm);
}

.number-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--input-shadow-focus);
}

.unit {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

/* 间隔输入 */
.interval-input {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 200px;
}

.range-input {
  flex: 1;
  height: 6px;
  background: var(--bg-quaternary);
  border-radius: 3px;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
}

.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.range-input::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: var(--shadow-sm);
}

.interval-display {
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  min-width: 60px;
  text-align: right;
}

/* MeoW 卡片特殊样式 */
.meow-card {
  border: 1px solid var(--primary-border);
  background: var(--primary-light);
}

.meow-card:hover {
  border-color: var(--primary);
}

.bound-info {
  color: var(--text-primary);
}

.user-id {
  color: var(--primary);
  font-weight: var(--font-semibold);
}

/* MeoW 绑定样式 */
.meow-bind-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bind-step, .verify-step {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.verify-info {
  padding: 12px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 6px;
  margin-bottom: 8px;
}

.verify-info p {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.4;
}

.verify-info p:first-child {
  margin-bottom: 4px;
}

.verify-input-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.verify-actions {
  display: flex;
  gap: 8px;
}

.meow-input, .verify-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-tertiary);
  border-radius: var(--radius-md);
  background: var(--bg-quaternary);
  color: var(--text-primary);
  font-size: var(--text-sm);
  min-width: 200px;
}

.meow-input:focus, .verify-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--input-shadow-focus);
}

.verify-input {
  text-align: center;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', 'Courier New', monospace;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 4px;
  min-width: auto;
  width: 180px;
  height: 48px;
  background: var(--bg-secondary);
  border: 2px solid var(--border-tertiary);
  border-radius: 8px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  -webkit-font-feature-settings: "tnum";
  font-feature-settings: "tnum";
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.verify-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1), 0 4px 12px rgba(0, 0, 0, 0.1);
  background: var(--bg-primary);
  transform: translateY(-1px);
}

.verify-input:hover:not(:disabled) {
  border-color: rgba(59, 130, 246, 0.5);
}

.verify-input::placeholder {
  color: var(--text-quaternary);
  font-weight: 400;
  letter-spacing: 2px;
}

/* 验证码输入完成状态 */
.verify-input.complete {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.05);
  color: #10b981;
}

/* 验证码输入错误状态 */
.verify-input.error {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}

/* 数字输入动画 */
.verify-input:not(:placeholder-shown) {
  background: var(--bg-primary);
  border-color: rgba(59, 130, 246, 0.3);
}

.meow-input::placeholder {
  color: var(--text-quaternary);
}

/* 按钮样式 */
.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: var(--transition-normal);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
}

.btn-primary:hover:not(:disabled) {
  background: var(--btn-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-secondary {
  background: var(--btn-secondary-bg);
  color: var(--btn-secondary-text);
  border: 1px solid var(--btn-secondary-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--btn-secondary-hover);
  border-color: var(--border-quaternary);
}

.btn-danger {
  background: var(--btn-error-bg);
  color: var(--btn-error-text);
}

.btn-danger:hover:not(:disabled) {
  background: var(--btn-error-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

/* 保存按钮 */
.save-section {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.save-btn {
  padding: 0.75rem 2rem;
  font-size: var(--text-base);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .top-nav {
    padding: 1rem;
  }

  .page-title {
    font-size: var(--text-xl);
  }

  .main-container {
    padding: 1rem;
  }

  .settings-section {
    padding: 1.5rem;
  }

  .setting-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
  }

  .setting-control {
    margin-left: 0;
    width: 100%;
  }

  .meow-bind-section {
    flex-direction: column;
    align-items: stretch;
  }

  .meow-input {
    min-width: auto;
  }

  .interval-input {
    min-width: auto;
  }
}

@media (max-width: 480px) {
  .top-nav {
    padding: 0.75rem;
  }

  .back-button {
    padding: 0.375rem 0.75rem;
    font-size: var(--text-xs);
  }

  .page-title {
    font-size: var(--text-lg);
  }

  .main-container {
    padding: 0.75rem;
  }

  .settings-section {
    padding: 1rem;
  }

  .section-header h2 {
    font-size: var(--text-lg);
  }

  .setting-info h3 {
    font-size: var(--text-sm);
  }

  .setting-info p {
    font-size: var(--text-xs);
  }
}
</style>