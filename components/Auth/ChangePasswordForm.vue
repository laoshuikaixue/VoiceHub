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
    success.value = '密码修改成功'
    // 清空表单
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    error.value = err.message || '密码修改失败，请稍后重试'
  } finally {
    loading.value = false
  }
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