<template>
  <div class="change-password-form">
    <h2>修改密码</h2>
    <form @submit.prevent="handleChangePassword">
      <div class="form-group">
        <label for="current-password">当前密码</label>
        <input 
          id="current-password" 
          v-model="currentPassword" 
          type="password" 
          required 
          placeholder="请输入当前密码"
        />
      </div>
      
      <div class="form-group">
        <label for="new-password">新密码</label>
        <input 
          id="new-password" 
          v-model="newPassword" 
          type="password" 
          required 
          placeholder="请输入新密码"
        />
      </div>
      
      <div class="form-group">
        <label for="confirm-password">确认新密码</label>
        <input 
          id="confirm-password" 
          v-model="confirmPassword" 
          type="password" 
          required 
          placeholder="请再次输入新密码"
        />
      </div>
      
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="success" class="success">{{ success }}</div>
      
      <button type="submit" :disabled="loading">
        {{ loading ? '处理中...' : '修改密码' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const auth = useAuth()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

const handleChangePassword = async () => {
  error.value = ''
  success.value = ''
  
  // 密码确认检查
  if (newPassword.value !== confirmPassword.value) {
    error.value = '两次输入的新密码不一致'
    return
  }
  
  loading.value = true
  
  try {
    await auth.changePassword(currentPassword.value, newPassword.value)
    success.value = '密码修改成功，请重新登录'
    // 清空表单
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    
    // 显示通知并在2秒后注销并重定向到登录页面
    showNotification('密码已修改成功，请重新登录', 'success')
    setTimeout(() => {
      auth.logout() // 注销并重定向到登录页面
    }, 2000)
  } catch (err) {
    error.value = err.message || '密码修改失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

// 显示通知
const showNotification = (message, type = 'info') => {
  // 创建通知元素
  const notification = document.createElement('div')
  notification.className = `global-notification ${type}`
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
    </div>
  `
  
  // 添加到页面
  document.body.appendChild(notification)
  
  // 添加显示类
  setTimeout(() => {
    notification.classList.add('show')
  }, 10)
  
  // 自动关闭
  setTimeout(() => {
    notification.classList.remove('show')
    setTimeout(() => {
      document.body.removeChild(notification)
    }, 300)
  }, 3000)
}
</script>

<style scoped>
.change-password-form {
  max-width: 400px;
  margin: 0 auto;
  padding: 2rem;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: var(--light);
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--light);
}

input {
  width: 100%;
  padding: 0.75rem;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  font-size: 1rem;
  color: var(--light);
}

button {
  width: 100%;
  padding: 0.75rem;
  background-color: var(--primary);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 1rem;
}

button:hover {
  opacity: 0.9;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: var(--danger);
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.success {
  color: var(--success);
  margin: 0.5rem 0;
  font-size: 0.9rem;
}
</style>

<style>
/* 全局通知样式 */
.global-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  z-index: 9999;
  transform: translateX(120%);
  transition: transform 0.3s ease;
  max-width: 350px;
}

.global-notification.show {
  transform: translateX(0);
}

.global-notification.success {
  border-left: 4px solid var(--success);
}

.global-notification.error {
  border-left: 4px solid var(--danger);
}

.global-notification.info {
  border-left: 4px solid var(--primary);
}

.global-notification.warning {
  border-left: 4px solid var(--warning);
}

.notification-content {
  display: flex;
  align-items: center;
}

.notification-message {
  color: var(--light);
  font-size: 0.9rem;
}
</style> 