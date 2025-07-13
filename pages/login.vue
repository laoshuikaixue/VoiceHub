<template>
  <div class="login-page">
    <ClientOnly>
      <LoginForm />
    </ClientOnly>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import LoginForm from '~/components/Auth/LoginForm.vue'

// 服务器端安全的认证状态管理
const isClientAuthenticated = ref(false)
const router = useRouter()

// 在组件挂载后初始化认证（只会在客户端执行）
onMounted(() => {
  const auth = useAuth()
  isClientAuthenticated.value = auth.isAuthenticated.value
  
  if (isClientAuthenticated.value) {
    router.push('/') // 修改为返回主页
  }
})
</script>

<style scoped>
.login-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style> 