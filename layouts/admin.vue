<template>
  <div class="admin-layout">
    <!-- 顶部导航栏 -->
    <header class="admin-header">
      <div class="header-content">
        <div class="header-left">
          <NuxtLink to="/" class="logo">
            <Icon name="music" :size="24" />
            <span>VoiceHub</span>
          </NuxtLink>
          <span class="admin-badge">管理后台</span>
        </div>
        
        <nav class="header-nav">
          <NuxtLink to="/admin" class="nav-link">
            <Icon name="home" :size="18" />
            <span>总览</span>
          </NuxtLink>
          <NuxtLink to="/admin/announcements" class="nav-link">
            <Icon name="megaphone" :size="18" />
            <span>公告管理</span>
          </NuxtLink>
          <NuxtLink to="/dashboard" class="nav-link">
            <Icon name="chevron-left" :size="18" />
            <span>返回前台</span>
          </NuxtLink>
        </nav>
        
        <div class="header-right">
          <button @click="logout" class="logout-btn">
            <Icon name="log-out" :size="18" />
            <span>退出</span>
          </button>
        </div>
      </div>
    </header>

    <!-- 主内容区域 -->
    <main class="admin-main">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { useAuth } from '~/composables/useAuth'
import Icon from '~/components/UI/Icon.vue'

const { logout: authLogout } = useAuth()

const logout = async () => {
  await authLogout()
  await navigateTo('/login')
}
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
  background: #0a0a0a;
  display: flex;
  flex-direction: column;
}

.admin-header {
  background: #111111;
  border-bottom: 1px solid #1f1f1f;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  text-decoration: none;
  font-size: 18px;
  font-weight: 600;
  transition: all 0.2s;
}

.logo:hover {
  color: #4F46E5;
}

.admin-badge {
  background: linear-gradient(135deg, #4F46E5, #7C3AED);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  color: #cccccc;
  text-decoration: none;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
}

.nav-link:hover {
  background: #1a1a1a;
  color: #ffffff;
}

.nav-link.router-link-active {
  background: #4F46E5;
  color: #ffffff;
}

.header-right {
  display: flex;
  align-items: center;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: 1px solid #333;
  color: #cccccc;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  border-color: #ff4757;
  color: #ff4757;
}

.admin-main {
  flex: 1;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-content {
    padding: 0 16px;
  }
  
  .header-nav {
    display: none;
  }
  
  .nav-link span {
    display: none;
  }
  
  .logout-btn span {
    display: none;
  }
}
</style>
