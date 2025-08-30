<template>
  <div class="app-layout">
    <slot />
    <SiteFooter />
    
    <!-- 全局公告弹窗 -->
    <AnnouncementDialog
      v-if="showAnnouncementDialog && currentAnnouncement"
      :announcement="currentAnnouncement"
      :show="showAnnouncementDialog"
      @close="handleAnnouncementClose"
      @confirm="handleAnnouncementConfirm"
      @remember="handleAnnouncementRemember"
    />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useAnnouncements } from '~/composables/useAnnouncements'
import AnnouncementDialog from '~/components/UI/AnnouncementDialog.vue'

const { initSiteConfig } = useSiteConfig()
const { 
  currentAnnouncement, 
  showAnnouncementDialog,
  closeAnnouncementDialog,
  markAsViewed,
  rememberAnnouncement
} = useAnnouncements()

// 处理公告事件
const handleAnnouncementClose = () => {
  closeAnnouncementDialog()
}

const handleAnnouncementConfirm = async () => {
  if (currentAnnouncement.value) {
    await markAsViewed(currentAnnouncement.value.id)
  }
  closeAnnouncementDialog()
}

const handleAnnouncementRemember = () => {
  if (currentAnnouncement.value) {
    rememberAnnouncement(currentAnnouncement.value.id)
  }
  closeAnnouncementDialog()
}

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