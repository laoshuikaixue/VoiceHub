<template>
  <div class="auth-layout">
    <div class="auth-container">
      <div class="form-section">
        <div class="form-header">
          <div class="logo-row">
            <img :src="brandLogoSrc" alt="Brand Logo" class="brand-logo-center" >
            <div v-if="schoolLogoHomeUrl && schoolLogoHomeUrl.trim()" class="logo-divider" />
            <img
              v-if="schoolLogoHomeUrl && schoolLogoHomeUrl.trim()"
              :src="schoolLogoHomeUrl"
              alt="学校Logo"
              class="school-logo"
            >
          </div>
          <h1 class="form-title">{{ siteTitle ? siteTitle + ' | VoiceHub' : 'VoiceHub' }}</h1>
          <div class="header-divider" />
        </div>
        <ClientOnly>
          <LoginForm />
        </ClientOnly>
      </div>
    </div>
    <!-- 页脚信息显示 -->
    <SiteFooter />
  </div>
</template>

<script setup>
import { onMounted, computed, ref } from 'vue'
import LoginForm from '~/components/Auth/LoginForm.vue'
import logo from '~/public/images/logo.svg'

// 使用站点配置
const { siteTitle, initSiteConfig, logoUrl, schoolLogoHomeUrl, icp: icpNumber } = useSiteConfig()
// 主品牌Logo优先使用SVG，其次使用站点配置中非ICO的地址
const brandLogoSrc = computed(() => {
  const url = logoUrl.value
  if (url && !url.endsWith('.ico')) return url
  return logo
})

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
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 20px;
  /* 响应式尺寸变量 */
  --brand-logo-size: clamp(48px, 8vw, 96px);
  --school-logo-size: clamp(96px, 16vw, 160px);
  --logo-gap: clamp(12px, 2vw, 24px);
  --divider-height: clamp(32px, 10vw, 96px);
  --content-footer-gap: clamp(16px, 4vh, 40px);
}

.auth-container {
  width: 100%;
  max-width: 480px;
  background: var(--bg-secondary);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  margin: auto 0; /* 在纵向布局中居中 */
  margin-bottom: var(--content-footer-gap); /* 与底部footer保持最小距离 */
}

.brand-section {
  background: var(--bg-secondary);
  padding: 60px 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border-right: 1px solid var(--border-primary);
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
  color: var(--text-primary);
}

.logo-section {
  margin-bottom: 32px;
}

.brand-logo {
  width: 160px;
  height: auto;
  margin-bottom: 24px;
  object-fit: contain;
  transition:
    transform var(--transition-slow),
    filter var(--transition-slow);
}

.brand-logo:hover {
  transform: translateY(-3px) scale(1.02);
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.25));
}

.brand-title {
  font-size: 36px;
  font-weight: var(--font-bold);
  margin: 0;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.brand-description {
  font-size: 18px;
  color: var(--text-secondary);
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
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  backdrop-filter: none;
  border: 1px solid var(--border-secondary);
  transition:
    border-color var(--transition-normal),
    background var(--transition-normal),
    transform var(--transition-normal);
}

.feature-item:hover {
  background: var(--bg-hover);
  border-color: var(--card-hover-border);
  transform: translateY(-2px);
}

.feature-icon {
  width: 24px;
  height: 24px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.feature-item span {
  font-size: 16px;
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.form-section {
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
}

.form-header {
  text-align: center;
  margin-bottom: 20px;
}

.logo-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--logo-gap);
  margin-bottom: 12px;
}

.logo-divider {
  width: 1px;
  height: var(--divider-height);
  background: var(--border-secondary);
}

.brand-logo-center {
  width: var(--brand-logo-size);
  height: var(--brand-logo-size);
  margin: 0;
  object-fit: contain;
  max-width: 100%;
  max-height: 100%;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));
}

.school-logo {
  width: var(--school-logo-size);
  height: var(--school-logo-size);
  margin: 0;
  object-fit: contain;
  max-width: 100%;
  max-height: 100%;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));
}

.form-title {
  font-size: 24px;
  font-weight: var(--font-bold);
  margin: 0;
  color: var(--text-primary);
}

.header-divider {
  height: 1px;
  background: var(--border-secondary);
  margin: 14px auto 0;
  width: 100%;
}

/* 隐藏品牌区的纹理伪元素以保持简约视觉 */
.brand-section::before {
  background: none;
  opacity: 0;
  display: none;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .auth-container {
    max-width: 500px;
  }

  .form-section {
    padding: 36px 26px;
  }

  .form-title {
    font-size: 22px;
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

.icp-link,
.voicehub-link {
  color: inherit;
  text-decoration: none;
  transition: color 0.2s ease;
}

.icp-link:hover,
.voicehub-link:hover {
  color: rgba(255, 255, 255, 0.8);
}

@media (max-width: 768px) {
  .site-footer {
    padding: 15px 0;
    margin-top: 20px;
  }

  .footer-info {
    gap: 0;
  }

  .footer-item {
    font-size: 11px;
  }

  .footer-item:not(:last-child)::after {
    margin: 0 2px;
  }
}
</style>
