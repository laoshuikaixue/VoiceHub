<!-- 403 未授权页面：用户已登录但缺少访问目标页面的权限 -->
<template>
  <div class="min-h-screen bg-bg-primary flex items-center justify-center p-6">
    <div class="max-w-md w-full">
      <div
        class="bg-bg-secondary-40 border border-border-secondary rounded-3xl p-8 md:p-10 shadow-2xl text-center space-y-8"
      >
        <!-- 锁形图标 -->
        <div class="flex justify-center">
          <div
            class="w-24 h-24 rounded-3xl bg-warning-10 border border-warning-20 flex items-center justify-center text-warning"
          >
            <Lock :size="48" stroke-width="1.5" />
          </div>
        </div>

        <!-- 标题与说明 -->
        <div class="space-y-3">
          <h1 class="text-2xl font-black text-text-primary tracking-tight">
            {{ locale.title || '无权访问' }}
          </h1>
          <p class="text-sm text-text-tertiary leading-relaxed">
            {{ locale.message || '当前账号缺少访问此页面的权限。如有疑问请联系管理员。' }}
          </p>
        </div>

        <!-- 操作按钮 -->
        <div class="grid grid-cols-1 gap-3 pt-4">
          <NuxtLink
            to="/dashboard"
            class="flex items-center justify-center gap-2 py-3 bg-primary-hover hover:bg-primary text-text-primary text-sm font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95"
          >
            <Home :size="18" />
            {{ locale.backDashboard || '返回后台首页' }}
          </NuxtLink>
          <NuxtLink
            to="/"
            class="flex items-center justify-center gap-2 py-3 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-sm font-black rounded-xl transition-all active:scale-95"
          >
            <ArrowLeft :size="18" />
            {{ locale.backHome || '返回站点首页' }}
          </NuxtLink>
        </div>

        <!-- 底部提示 -->
        <p class="text-[10px] text-text-secondary font-medium uppercase tracking-widest pt-4">
          {{ locale.contactAdmin || '需要权限请联系系统管理员' }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Lock, Home, ArrowLeft } from '@lucide/vue'

definePageMeta({
  layout: 'default'
})

defineOptions({
  name: 'ForbiddenPage'
})
</script>

<style scoped></style>
