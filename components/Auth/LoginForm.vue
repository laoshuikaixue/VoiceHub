<template>
  <div class="login-form">
    <h2>用户登录</h2>
    <form @submit.prevent="handleLogin">
      <div class="form-group">
        <label for="username">账号名</label>
        <input 
          id="username" 
          v-model="username" 
          type="text" 
          required 
          placeholder="请输入账号名"
          :class="{ 'input-error': error }"
          @input="error = ''"
        />
      </div>
      
      <div class="form-group">
        <label for="password">密码</label>
        <input 
          id="password" 
          v-model="password" 
          type="password" 
          required 
          placeholder="请输入密码"
          :class="{ 'input-error': error }"
          @input="error = ''"
        />
      </div>
      
      <div v-if="error" class="error-container">
        <div class="error-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <div class="error-message">{{ error }}</div>
      </div>
      
      <button type="submit" :disabled="loading">
        <span v-if="loading" class="loading-spinner"></span>
        {{ loading ? '登录中...' : '登录' }}
      </button>
    </form>
  </div>
</template>

<script setup>
const router = useRouter()
const auth = useAuth() // 假设我们有一个auth组合式函数

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const handleLogin = async () => {
  error.value = ''
  loading.value = true
  
  try {
    await auth.login(username.value, password.value)
    router.push('/') // 修改为返回主页
  } catch (err) {
    // 显示详细的错误信息
    error.value = err.message || '登录失败，请稍后重试'
    // 如果是密码错误，清空密码字段
    if (error.value.includes('密码不正确')) {
      password.value = ''
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-form {
  max-width: 400px;
  margin: 0 auto;
  padding: 2rem;
  border-radius: 0.75rem;
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
  transition: border-color 0.2s ease;
}

input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

input.input-error {
  border-color: var(--danger);
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

button:hover {
  background-color: var(--primary-dark);
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-container {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0.75rem 0;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 0.375rem;
}

.error-icon {
  color: var(--danger);
  flex-shrink: 0;
  margin-top: 2px;
}

.error-message {
  color: var(--danger);
  font-size: 0.9rem;
  flex: 1;
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style> 