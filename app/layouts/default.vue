<template>
  <div class="app-layout">
    <slot />
    <SiteFooter />
    <SpeedInsights />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { SpeedInsights } from "@vercel/speed-insights/nuxt"

const { initSiteConfig } = useSiteConfig()

// 初始化站点配置
onMounted(() => {
  initSiteConfig()
})
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
