<template>
  <div class="admin-page">
    <div class="admin-header">
      <h1>公告管理</h1>
      <p>管理站内外公告，创建和编辑公告内容</p>
    </div>

    <div class="admin-content">
      <AnnouncementManager />
    </div>
  </div>
</template>

<script setup>
import { definePageMeta } from '#imports'
import AnnouncementManager from '~/components/Admin/AnnouncementManager.vue'

// 页面元数据 - 需要管理员权限
definePageMeta({
  middleware: 'auth',
  layout: 'admin'
})

// 页面标题
useHead({
  title: '公告管理 - VoiceHub Admin'
})
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #0a0a0a;
  color: #ffffff;
}

.admin-header {
  text-align: center;
  padding: 40px 20px;
  border-bottom: 1px solid #1f1f1f;
}

.admin-header h1 {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, #4F46E5, #7C3AED);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.admin-header p {
  font-size: 16px;
  color: #888;
  margin: 0;
}

.admin-content {
  padding: 0;
}
</style>
