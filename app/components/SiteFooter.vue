<template>
  <div class="site-footer">
    <div class="footer-info">
      <span v-if="icpNumber" class="footer-item">
        <a
          :href="`https://beian.miit.gov.cn/`"
          class="icp-link"
          rel="noopener noreferrer"
          target="_blank"
        >
          {{ icpNumber }}
        </a>
      </span>
      <span v-if="siteTitle" class="footer-item">© {{ currentYear }} {{ siteTitle }}</span>
      <span v-else class="footer-item">© {{ currentYear }} {{ copyrightOwner }}</span>
      <span class="footer-item">Worker in {{ responseTime }}ms</span>
      <span class="footer-item">
        <a class="voicehub-link" :href="repoUrl" rel="noopener noreferrer" target="_blank">
          {{ systemName }} v{{ systemVersion }}
        </a>
      </span>
      <span v-if="isNetlify" class="footer-item">
        <a
          href="https://www.netlify.com"
          target="_blank"
          rel="noopener noreferrer"
          class="netlify-badge"
        >
          <img
            src="https://www.netlify.com/img/global/badges/netlify-color-accent.svg"
            alt="Deploys by Netlify"
          >
        </a>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getCopyrightOwner, getSystemName, getRepoUrl } from '@/utils/core/security'
import packageJson from '~~/package.json'

// 使用 useSiteConfig composable 获取配置
const { siteTitle, icp: icpNumber } = useSiteConfig()
const config = useRuntimeConfig()
const isNetlify = config.public.isNetlify

const copyrightOwner = getCopyrightOwner()
const systemName = getSystemName()
const repoUrl = getRepoUrl()
const systemVersion = packageJson.version
const currentYear = new Date().getFullYear()

const responseTime = ref(0)

onMounted(() => {
  if (typeof window !== 'undefined' && window.performance) {
    // 使用 requestAnimationFrame 确保在渲染后计算
    requestAnimationFrame(() => {
      const loadTime = Math.round(window.performance.now())
      responseTime.value = loadTime
    })
  }
})
</script>

<style scoped>
.site-footer {
  text-align: center;
  padding: 20px 0;
  margin-top: 30px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
}

.footer-info {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
}

.footer-item {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  white-space: nowrap;
}

.footer-item:not(:last-child)::after {
  content: ' | ';
  margin: 0 10px;
  color: rgba(255, 255, 255, 0.4);
}

.footer-item a {
  color: inherit;
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-item a:hover {
  color: rgba(255, 255, 255, 0.8);
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

.netlify-badge {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.netlify-badge img {
  height: 16px;
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.netlify-badge:hover img {
  opacity: 1;
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
