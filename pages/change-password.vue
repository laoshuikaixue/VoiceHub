<template>
  <div class="change-password-page">
    <div class="page-header">
      <h1>修改密码</h1>
    </div>
    
    <div v-if="isFirstLogin" class="first-login-notice">
      <div class="notice-content">
        <p>您是首次登录，请修改初始密码以保障账号安全</p>
      </div>
    </div>
    
    <div class="content-container">
      <div class="card">
        <ClientOnly>
          <ChangePasswordForm />
        </ClientOnly>
      </div>
    </div>
    
    <div class="back-link">
      <NuxtLink to="/">返回主页</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import ChangePasswordForm from '~/components/Auth/ChangePasswordForm.vue'
import { ref } from 'vue'

const auth = useAuth()
const router = useRouter()
const isFirstLogin = ref(false)

// 未登录用户重定向到登录页
onMounted(() => {
  if (!auth.isAuthenticated.value && process.client) {
    router.push('/login')
    return
  }
  
  // 检查是否首次登录
  if (process.client) {
    const userJson = localStorage.getItem('user')
    if (userJson) {
      const user = JSON.parse(userJson)
      isFirstLogin.value = user.firstLogin === true
    }
  }
})
</script>

<style scoped>
.change-password-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
  text-align: center;
}

.page-header h1 {
  font-size: 1.8rem;
  color: var(--light);
}

.first-login-notice {
  background: rgba(246, 196, 67, 0.1);
  border-left: 4px solid var(--warning);
  padding: 1rem;
  margin-bottom: 2rem;
  border-radius: 0.25rem;
}

.notice-content {
  color: var(--light);
}

.content-container {
  display: flex;
  justify-content: center;
}

.card {
  width: 100%;
  max-width: 500px;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  overflow: hidden;
}

.back-link {
  text-align: center;
  margin-top: 2rem;
}

.back-link a {
  color: var(--primary);
  text-decoration: none;
}

.back-link a:hover {
  text-decoration: underline;
}
</style> 