<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm font-medium text-text-secondary dark:text-text-tertiary">{{ locale.label }}</label>
    <div class="flex gap-2 items-start">
      <!-- SVG 图片（可点击刷新） -->
      <div
        class="captcha-svg-container border border-border-secondary dark:border-border-tertiary cursor-pointer"
        :title="locale.refreshTitle"
        @click="refreshCaptcha"
      >
        <img v-if="svgDataUrl" :src="svgDataUrl" :alt="locale.alt" class="captcha-svg-image">
      </div>
      <!-- 输入框 -->
      <input
        v-model="inputValue"
        type="text"
        maxlength="4"
        autocomplete="off"
        :placeholder="locale.placeholder"
        class="flex-1 px-3 py-2 border border-border-secondary dark:border-border-tertiary rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-bg-secondary dark:bg-bg-tertiary text-text-primary dark:text-text-primary-lighter placeholder-text-muted dark:placeholder-text-tertiary"
        @input="handleInput"
      >
      <!-- 刷新按钮（也可直接点图片，这里提供文字按钮辅助） -->
      <button
        type="button"
        class="px-2 py-1 text-xs text-primary-hover hover:text-primary-hover dark:text-primary"
        @click="refreshCaptcha"
      >
        {{ locale.refresh }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useLocale } from '~/utils/locale'

const { auth } = useLocale()
const locale = computed(() => auth.value?.captchaInput || {})

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'update:captchaId'])

const svgDataUrl = ref('')
const captchaId = ref('')
const inputValue = ref(props.modelValue || '')

function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function handleInput(event) {
  inputValue.value = event.target.value.trim()
  emit('update:modelValue', inputValue.value)
}

async function refreshCaptcha() {
  try {
    const res = await $fetch('/api/auth/captcha')
    svgDataUrl.value = svgToDataUrl(res.svg)
    captchaId.value = res.id
    emit('update:captchaId', res.id)
    inputValue.value = ''
    emit('update:modelValue', '')
  } catch (e) {
    console.error(locale.value.loadFailed, e)
  }
}
  
defineExpose({ refreshCaptcha })
  
onMounted(() => {
  refreshCaptcha()
})
</script>

<style scoped>
/* 保证 SVG 自适应容器，不被裁剪 */
:deep(svg) {
  max-width: 100%;
  height: auto;
  display: block;
}

.captcha-svg-image {
  max-width: 100%;
  height: auto;
  display: block;
}

/* 可选：优化容器的最小宽度和边框间距 */
.captcha-svg-container {
  min-width: 130px;
  padding: 4px;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-card, var(--panel-bg-overlay)); /* 不透明卡片背景，避免暗色遮罩/主题下验证码看不清 */
  border: 1px solid var(--border-tertiary);
}
</style>
