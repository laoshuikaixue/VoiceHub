<template>
  <div class="auth-layout">
    <div class="auth-container">
      <!-- 左侧品牌区域 -->
      <div class="brand-section">
        <div class="brand-content">
          <div class="logo-section">
            <img alt="VoiceHub Logo" class="brand-logo" src="/images/logo.svg"/>
            <h1 v-if="siteTitle" class="brand-title">{{ siteTitle || 'VoiceHub' }}</h1>
          </div>
          <p class="brand-description">
            校园广播站点歌管理系统
          </p>
          <div class="feature-list">
            <div class="feature-item">
              <svg class="feature-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6"/>
                <path d="m21 12-6-3-6 3-6-3"/>
              </svg>
              <span>智能点歌管理</span>
            </div>
            <div class="feature-item">
              <svg class="feature-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect height="18" rx="2" ry="2" width="18" x="3" y="4"/>
                <line x1="16" x2="16" y1="2" y2="6"/>
                <line x1="8" x2="8" y1="2" y2="6"/>
                <line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
              <span>可视化排期</span>
            </div>
            <div class="feature-item">
              <svg class="feature-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>用户权限管理</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧登录表单 -->
      <div class="form-section">
        <ClientOnly>
          <LoginForm/>
        </ClientOnly>
      </div>
    </div>
  </div>
</template>

<script setup>
import {onMounted} from 'vue'
import LoginForm from '~/components/Auth/LoginForm.vue'

// 使用站点配置
const {siteTitle, initSiteConfig} = useSiteConfig()

// 在组件挂载后初始化站点配置
onMounted(async () => {
  // 初始化站点配置
  await initSiteConfig()

  // 设置页面标题
  if (typeof document !== 'undefined' && siteTitle.value) {
    document.title = `登录 | ${siteTitle.value}`
  }
})
</script>

<style scoped>
.auth-layout {
  min-height: 100vh;
  background: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.auth-container {
  width: 100%;
  max-width: 1200px;
  background: #111111;
  border-radius: 24px;
  border: 1px solid #1f1f1f;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 600px;
}

.brand-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60px 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.brand-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
  opacity: 0.3;
}

.brand-content {
  position: relative;
  z-index: 1;
  text-align: center;
  color: white;
}

.logo-section {
  margin-bottom: 32px;
}

.brand-logo {
  width: 160px;
  height: auto;
  margin-bottom: 24px;
  object-fit: contain;
}

.brand-title {
  font-size: 36px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-description {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 40px 0;
  line-height: 1.6;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  text-align: left;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.feature-icon {
  width: 24px;
  height: 24px;
  color: white;
  flex-shrink: 0;
}

.feature-item span {
  font-size: 16px;
  font-weight: 500;
  color: white;
}

.form-section {
  padding: 60px 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111111;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .auth-container {
    grid-template-columns: 1fr;
    max-width: 500px;
  }

  .brand-section {
    padding: 40px 30px;
  }

  .form-section {
    padding: 40px 30px;
  }

  .brand-title {
    font-size: 28px;
  }

  .brand-description {
    font-size: 16px;
  }
}

@media (max-width: 768px) {
  .auth-layout {
    padding: 10px;
  }

  .auth-container {
    border-radius: 16px;
    min-height: auto;
  }

  .brand-section,
  .form-section {
    padding: 30px 20px;
  }

  .feature-list {
    gap: 16px;
  }

  .feature-item {
    padding: 12px 16px;
  }
}
</style>