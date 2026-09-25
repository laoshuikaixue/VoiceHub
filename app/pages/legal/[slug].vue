<template>
  <div class="legal-page">
    <header class="legal-topbar">
      <NuxtLink to="/" class="topbar-brand">
        <img :src="getLogo()" alt="VoiceHub">
      </NuxtLink>
      <NuxtLink to="/login" class="topbar-login">
        <LogIn :size="15" />
        <span>{{ locale.login }}</span>
      </NuxtLink>
    </header>

    <main class="legal-main">
      <div class="legal-card">
        <div class="legal-head">
          <h1 class="legal-title">{{ legalDoc?.name || locale.title }}</h1>
          <p v-if="updatedDate" class="legal-updated">{{ locale.updated }}{{ updatedDate }}</p>
        </div>

        <div v-if="otherDocs.length" class="legal-tabs">
          <span class="legal-tabs-label">{{ locale.related }}</span>
          <NuxtLink
            v-for="doc in otherDocs"
            :key="doc.slug"
            :to="`/legal/${doc.slug}`"
            class="legal-tab"
          >
            {{ doc.name || locale.title }}
          </NuxtLink>
        </div>

        <div class="legal-divider" />

        <div v-if="loading" class="legal-loading">
          <AppSpinner />
        </div>
        <article v-else-if="legalDoc" class="markdown-body legal-content" v-html="renderedContent" />
        <div v-else class="legal-empty">
          <div class="legal-empty-icon">
            <FileQuestion :size="26" stroke-width="1.5" />
          </div>
          <p class="legal-empty-text">{{ locale.notFound }}</p>
          <NuxtLink to="/" class="legal-empty-back">{{ locale.backHome }}</NuxtLink>
        </div>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { LogIn, FileQuestion } from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import SiteFooter from '~/components/SiteFooter.vue'
import { renderMarkdown } from '~/utils/markdown'
import { useLocale } from '~/utils/locale'
import { useSiteConfig } from '~/composables/useSiteConfig'

const route = useRoute()
const { common } = useLocale()
const { initSiteConfig, siteTitle } = useSiteConfig()
const { getLogo } = useThemeImage()

const documents = ref([])
const legalDoc = ref(null)
const updatedDate = ref('')
const loading = ref(true)

const locale = computed(() => ({
  title: common.value?.legalPage?.title || '服务条款',
  updated: common.value?.legalPage?.updated || '最后更新：',
  notFound: common.value?.legalPage?.notFound || '文档不存在',
  login: common.value?.legalPage?.login || '登录',
  related: common.value?.legalPage?.related || '相关文档',
  backHome: common.value?.legalPage?.backHome || '返回首页'
}))

// 相关文档入口排除当前文档自身
const otherDocs = computed(() => documents.value.filter((doc) => doc.slug !== route.params.slug))

const renderedContent = computed(() => (legalDoc.value ? renderMarkdown(legalDoc.value.content) : ''))

onMounted(async () => {
  await initSiteConfig()
  try {
    const response = await $fetch('/api/legal-documents')
    updatedDate.value = response.updatedDate || ''
    documents.value = Array.isArray(response.documents) ? response.documents : []
    legalDoc.value = documents.value.find((item) => item.slug === route.params.slug) || null
    const docTitle = legalDoc.value?.name || locale.value.title
    document.title = siteTitle.value ? `${docTitle} | ${siteTitle.value}` : docTitle
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.legal-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.legal-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px clamp(16px, 4vw, 40px);
  border-bottom: 1px solid var(--border-secondary);
}

.topbar-brand img {
  height: 32px;
  width: auto;
  max-width: 160px;
  object-fit: contain;
}

.topbar-login {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--border-secondary);
  border-radius: 10px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  transition:
    color 0.2s ease,
    border-color 0.2s ease;
}

.topbar-login:hover {
  color: var(--text-primary);
  border-color: var(--border-primary);
}

.legal-main {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  padding: clamp(20px, 4vw, 40px) clamp(12px, 4vw, 40px);
}

.legal-card {
  width: 100%;
  max-width: 800px;
  padding: clamp(20px, 4vw, 36px);
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: 20px;
  box-shadow: var(--shadow-lg);
}

.legal-title {
  margin: 0;
  font-size: clamp(20px, 4vw, 26px);
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.legal-updated {
  margin: 8px 0 0;
  color: var(--text-tertiary);
  font-size: 12px;
}

.legal-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
}

.legal-tabs-label {
  color: var(--text-disabled);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.legal-tab {
  padding: 5px 12px;
  border: 1px solid var(--border-secondary);
  border-radius: 999px;
  background: var(--bg-primary-50);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  transition:
    color 0.2s ease,
    border-color 0.2s ease;
}

.legal-tab:hover {
  color: var(--text-primary);
  border-color: var(--border-primary);
}

.legal-divider {
  height: 1px;
  margin: clamp(16px, 3vw, 22px) 0;
  background: var(--border-secondary);
}

.legal-loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.legal-content {
  font-size: 14px;
  color: var(--text-secondary);
  overflow-wrap: break-word;
}

/* 条款内长表格在窄屏下横向滚动，避免撑破卡片 */
.legal-content :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
}

.legal-empty {
  padding: 32px 0 40px;
  text-align: center;
}

.legal-empty-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 14px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-secondary);
  border-radius: 16px;
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

.legal-empty-text {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 14px;
}

.legal-empty-back {
  display: inline-block;
  margin-top: 16px;
  color: var(--primary);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

@media (max-width: 640px) {
  .legal-topbar {
    padding: 12px 16px;
  }

  .topbar-brand img {
    height: 28px;
  }

  .legal-main {
    padding: 16px 12px 24px;
  }

  .legal-card {
    border-radius: 16px;
  }
}
</style>
