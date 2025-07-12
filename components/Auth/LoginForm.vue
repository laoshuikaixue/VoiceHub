<template>
  <div class="login-form">
    <h2>用户登录</h2>
    <form @submit.prevent="handleLogin">
      <div class="form-group">
        <label for="email">邮箱</label>
        <input 
          id="email" 
          v-model="email" 
          type="email" 
          required 
          placeholder="请输入邮箱"
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
        />
      </div>
      
      <div v-if="error" class="error">{{ error }}</div>
      
      <button type="submit" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>
      
      <p class="register-link">
        还没有账号？<NuxtLink to="/register">注册</NuxtLink>
      </p>
    </form>
  </div>
</template>

<script setup>
const router = useRouter()
const auth = useAuth() // 假设我们有一个auth组合式函数

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const handleLogin = async () => {
  error.value = ''
  loading.value = true
  
  try {
    await auth.login(email.value, password.value)
    router.push('/dashboard')
  } catch (err) {
    error.value = err.message || '登录失败，请稍后重试'
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
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

button {
  width: 100%;
  padding: 0.75rem;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 1rem;
}

button:hover {
  background-color: #2980b9;
}

button:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.error {
  color: #e74c3c;
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.register-link {
  margin-top: 1rem;
  text-align: center;
  font-size: 0.9rem;
}

.register-link a {
  color: #3498db;
  text-decoration: none;
}

.register-link a:hover {
  text-decoration: underline;
}
</style> 