<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">验证码</label>
    <div class="flex gap-2 items-start">
      <!-- SVG 图片（可点击刷新） -->
      <div
        class="w-28 h-10 rounded border border-gray-300 dark:border-gray-600 overflow-hidden cursor-pointer bg-gray-50 dark:bg-gray-800"
        @click="refreshCaptcha"
        title="点击刷新验证码"
        v-html="svgContent"
      />
      <!-- 输入框 -->
      <input
        v-model="inputValue"
        type="text"
        maxlength="4"
        autocomplete="off"
        placeholder="请输入验证码"
        class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
        @input="$emit('update:modelValue', inputValue)"
      />
      <!-- 刷新按钮（也可直接点图片，这里提供文字按钮辅助） -->
      <button
        type="button"
        class="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
        @click="refreshCaptcha"
      >
        换一张
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:captchaId': [id: string]
}>()

const svgContent = ref('')
const captchaId = ref('')
const inputValue = ref(props.modelValue || '')

async function refreshCaptcha() {
  try {
    const res = await $fetch<{ id: string; svg: string }>('/api/auth/captcha')
    svgContent.value = res.svg
    captchaId.value = res.id
    emit('update:captchaId', res.id)
    inputValue.value = ''
    emit('update:modelValue', '')
  } catch (e) {
    console.error('获取验证码失败', e)
  }
}

onMounted(() => {
  refreshCaptcha()
})
</script>
