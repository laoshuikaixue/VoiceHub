<template><main class="legal-page"><header class="legal-nav"><NuxtLink to="/" class="brand"><img :src="logoUrl" alt="" /><span>{{ siteTitle }}</span></NuxtLink><NuxtLink to="/login" class="login-link btn-primary"><LogIn :size="17" :stroke-width="2" />{{ locale.login }}</NuxtLink></header><section class="legal-hero"><div class="doc-icon"><FileText :size="27" :stroke-width="1.8" /></div><div class="eyebrow">{{ locale.category }}</div><h1>{{ document?.name || locale.title }}</h1><p v-if="updatedDate">{{ locale.updated }} {{ updatedDate }}</p></section><section class="legal-body"><AppSpinner v-if="loading" /><article v-else-if="document" class="legal-content"><div class="markdown-body" v-html="renderedContent" /></article><p v-else class="empty">{{ locale.notFound }}</p></section></main></template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { FileText, LogIn } from 'lucide-vue-next'
import { renderMarkdown } from '~/utils/markdown'
import { useLocale } from '~/utils/locale'
import { useSiteConfig } from '~/composables/useSiteConfig'\nimport { useThemeImage } from '~/composables/useThemeImage'
const route = useRoute(); const { common } = useLocale(); const { siteTitle, initSiteConfig } = useSiteConfig(); const { getLogo } = useThemeImage(); const logoUrl = computed(() => getLogo()); const document = ref(null); const updatedDate = ref(''); const loading = ref(true)
const locale = computed(() => ({ category: common.value?.legalPageCategory || '服务条款', title: common.value?.legalPageTitle || '服务条款', updated: common.value?.legalPageUpdated || '最后更新：', login: common.value?.login || '登录', notFound: common.value?.notFound || '文档不存在' }))
const renderedContent = computed(() => document.value ? renderMarkdown(document.value.content) : '')
onMounted(async () => { await initSiteConfig(); try { const response = await $fetch('/api/legal-documents'); updatedDate.value = response.updatedDate || ''; document.value = response.documents?.find((item) => item.slug === route.params.slug) || null } finally { loading.value = false } })
</script>
<style scoped>
.legal-page{min-height:100vh;color:var(--text-primary);background:var(--bg-primary)}.legal-nav{height:68px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,5vw,64px);border-bottom:1px solid var(--border-secondary)}.brand{display:flex;align-items:center;gap:12px;color:var(--text-primary);font-weight:800;text-decoration:none}.brand img{width:40px;height:40px;border-radius:10px;object-fit:cover}.login-link{min-height:40px;display:inline-flex;align-items:center;gap:8px;justify-content:center;padding:10px 22px;border-radius:10px;font-weight:700;text-decoration:none;transition:transform .2s ease,filter .2s ease}.login-link:hover{transform:translateY(-1px);filter:brightness(1.08)}.legal-hero,.legal-body{max-width:832px;margin:0 auto;padding-left:24px;padding-right:24px}.legal-hero{padding-top:58px;padding-bottom:34px}.doc-icon{width:52px;height:52px;display:grid;place-items:center;border-radius:14px;color:#2dd4bf;background:#123b3c}.doc-icon :deep(svg){width:27px;height:27px}.eyebrow{margin-top:24px;color:#2dd4bf;font-size:14px;font-weight:700}h1{margin:10px 0 12px;font-size:clamp(30px,5vw,48px);line-height:1.15;font-weight:850}.legal-hero p{margin:0;color:var(--text-tertiary);font-size:14px}.legal-content{padding:32px;border:1px solid var(--border-secondary);border-radius:14px;background:var(--bg-secondary)}.empty{color:var(--text-tertiary)}@media(max-width:600px){.legal-nav{padding:0 16px}.brand span{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.legal-hero{padding-top:40px}.legal-content{padding:20px}}
</style>




