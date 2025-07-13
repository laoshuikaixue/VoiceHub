<template>
  <div class="change-password-page">
    <div class="page-header">
      <h1>修改密码</h1>
    </div>
    
    <div class="content-container">
      <div class="card">
        <ClientOnly>
          <ChangePasswordForm />
        </ClientOnly>
      </div>
    </div>
    
    <div class="back-link">
      <NuxtLink to="/dashboard">返回仪表盘</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import ChangePasswordForm from '~/components/Auth/ChangePasswordForm.vue'

const auth = useAuth()
const router = useRouter()

// 未登录用户重定向到登录页
onMounted(() => {
  if (!auth.isAuthenticated.value && process.client) {
    router.push('/login')
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