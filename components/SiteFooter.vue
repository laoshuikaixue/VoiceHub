<template>
  <footer class="site-footer" v-if="showFooter">
    <div class="footer-content">
      <div class="footer-links">
        <span v-if="siteTitle" class="footer-text">© {{ currentYear }} {{ siteTitle }}</span>
        <span v-else class="footer-text">© {{ currentYear }} VoiceHub</span>
        <span v-if="icpNumber" class="icp-number">
          <a :href="icpLink" target="_blank" rel="noopener noreferrer">
            {{ icpNumber }}
          </a>
        </span>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useSiteConfig } from '~/composables/useSiteConfig'

const { title: siteTitle, icp: icpNumber, initSiteConfig } = useSiteConfig()

// 确保在客户端初始化站点配置
onMounted(() => {
  initSiteConfig()
})

// 当前年份
const currentYear = new Date().getFullYear()

// 是否显示底部 - 总是显示
const showFooter = computed(() => {
  return true // 总是显示底部
})

// ICP备案链接
const icpLink = computed(() => {
  if (!icpNumber.value) return '#'
  
  // 如果包含"ICP备"，链接到工信部
  if (icpNumber.value.includes('ICP备') || icpNumber.value.includes('ICP證')) {
    return 'https://beian.miit.gov.cn/'
  }
  
  // 如果包含"公网安备"，链接到公安部
  if (icpNumber.value.includes('公网安备')) {
    return 'http://www.beian.gov.cn/portal/registerSystemInfo'
  }
  
  // 默认链接到工信部
  return 'https://beian.miit.gov.cn/'
})
</script>

<style scoped>
.site-footer {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  padding: 16px 0;
  margin-top: auto;
  position: relative;
  z-index: 10;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.footer-links {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.footer-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.icp-number {
  font-size: 12px;
}

.icp-number a {
  color: var(--text-tertiary);
  text-decoration: none;
  transition: color 0.2s ease;
}

.icp-number a:hover {
  color: var(--text-secondary);
  text-decoration: underline;
}

/* 响应式设计 */
@media (min-width: 768px) {
  .footer-links {
    flex-direction: row;
    justify-content: center;
    gap: 24px;
  }
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .site-footer {
    background: var(--bg-secondary, #1a1a1a);
    border-top-color: var(--border-color, #333);
  }
  
  .footer-text {
    color: var(--text-secondary, #888);
  }
  
  .icp-number a {
    color: var(--text-tertiary, #666);
  }
  
  .icp-number a:hover {
    color: var(--text-secondary, #888);
  }
}
</style>