<template>
  <div class="notification-settings-page">
    <!-- 顶部导航栏 -->
    <div class="top-nav">
      <button @click="goBack" class="back-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                    type="checkbox" 
                    v-model="localSettings.songSelectedNotify"
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
                    type="checkbox" 
                    v-model="localSettings.songPlayedNotify"
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
                    type="checkbox" 
                    v-model="localSettings.songVotedNotify"
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
                    type="number" 
                    v-model.number="localSettings.songVotedThreshold"
                    min="1"
                    max="100"
                    class="number-input"
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
                    type="checkbox" 
                    v-model="localSettings.systemNotify"
                  >
                  <span class="switch"></span>
                </label>
              </div>
            </div>

            <!-- 通知刷新间隔 -->
            <div class="setting-card">
              <div class="setting-info">
                <h3>通知刷新间隔</h3>
                <p>设置通知检查的时间间隔</p>
              </div>
              <div class="setting-control">
                <div class="interval-input">
                  <input 
                    type="range" 
                    v-model.number="localSettings.refreshInterval"
                    min="30"
                    max="300"
                    step="30"
                    class="range-input"
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
                      type="text" 
                      v-model="meowUserId" 
                      placeholder="请输入 MeoW 用户 ID"
                      class="meow-input"
                      :disabled="binding"
                    >
                    <button 
                      @click="sendVerificationCode" 
                      class="btn btn-primary"
                      :disabled="!meowUserId || binding"
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
                        type="text"
                        placeholder="输入6位验证码"
                        class="verify-input"
                        :class="{
                          'complete': verificationCode.length === 6,
                          'error': verificationCodeError
                        }"
                        maxlength="6"
                        :disabled="binding"
                        @input="handleVerificationCodeInput"
                        @keydown="handleVerificationCodeKeydown"
                        autocomplete="off"
                        inputmode="numeric"
                        pattern="[0-9]*"
                      >
                      <div class="verify-actions">
                        <button @click="verifyAndBind" class="btn btn-primary" :disabled="binding || verificationCode.length !== 6">
                          {{ binding ? '验证中...' : '确认绑定' }}
                        </button>
                        <button @click="cancelVerification" class="btn btn-secondary" :disabled="binding">
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 已绑定状态 -->
                <div v-else class="meow-bound-section">
                  <button @click="showUnbindConfirm" class="btn btn-danger">
                    解绑账号
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 保存按钮 -->
        <div class="save-section">
          <button @click="saveSettings" class="btn btn-primary save-btn" :disabled="saving">
            {{ saving ? '保存中...' : '保存设置' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 确认对话框 -->
    <ConfirmDialog
      v-model:show="showConfirmDialog"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :type="confirmDialog.type"
      :loading="confirmDialog.loading"
      @confirm="confirmDialog.onConfirm"
      @cancel="confirmDialog.onCancel"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'

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
  meowUserId: ''
})

// MeoW 绑定相关
const meowUserId = ref('')
const verificationSent = ref(false)
const verificationCode = ref('')
const verificationCodeError = ref(false)

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialog = ref({
  title: '',
  message: '',
  type: 'warning',
  loading: false,
  onConfirm: () => {},
  onCancel: () => {}
})



// 页面初始化
onMounted(async () => {
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

// 返回主页
const goBack = () => {
  navigateTo('/')
}

// 显示通知
const showNotification = (message, type = 'info') => {
  if (window.$showNotification) {
    window.$showNotification(message, type)
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`)
  }
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
        meowUserId: response.data.meowUserId || ''
      }
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
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