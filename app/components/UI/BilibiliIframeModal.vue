<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[10000] flex items-center justify-center p-4"
        @click.self="close"
      >
        <div class="absolute inset-0 bg-black/90 backdrop-blur-sm" />

        <div class="relative w-full max-w-6xl h-[90vh] flex flex-col" @click.stop>
          <!-- 顶部工具栏 -->
          <div class="flex items-center justify-end gap-2 mb-3">
            <button
              class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all flex items-center gap-2"
              title="在新标签页打开"
              @click="openInNewTab"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              在哔哩哔哩打开
            </button>
            <button
              class="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-all"
              title="关闭"
              @click="close"
            >
              <Icon name="x" :size="20" />
            </button>
          </div>

          <!-- iframe 容器 -->
          <div class="flex-1 rounded-2xl overflow-hidden bg-black shadow-2xl">
            <iframe
              v-if="iframeUrl"
              :src="iframeUrl"
              class="w-full h-full border-none"
              allowfullscreen="true"
              sandbox="allow-top-navigation-by-user-activation allow-same-origin allow-forms allow-scripts"
              referrerpolicy="no-referrer"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-zinc-500">
              <div class="text-center">
                <Icon name="alert-circle" :size="48" class="mx-auto mb-4 opacity-20" />
                <p class="text-sm font-bold">无法加载视频</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import Icon from '~/components/UI/Icon.vue'

const props = defineProps({
  show: Boolean,
  bvid: String,
  page: {
    type: Number,
    default: 1
  }
})

const emit = defineEmits(['close'])

// 构建 iframe URL（使用移动端播放器）
const iframeUrl = computed(() => {
  if (!props.bvid) return null

  // 使用移动端播放器，更简洁且不会跳转
  let url = `https://www.bilibili.com/blackboard/html5mobileplayer.html?bvid=${props.bvid}`

  // 添加分P参数
  if (props.page && props.page > 1) {
    url += `&page=${props.page}`
  }

  // 添加其他参数
  url += '&as_wide=1' // 宽屏模式

  return url
})

// 构建完整的哔哩哔哩 URL
const bilibiliUrl = computed(() => {
  if (!props.bvid) return null

  let url = `https://www.bilibili.com/video/${props.bvid}/`

  if (props.page && props.page > 1) {
    url += `?p=${props.page}`
  }

  return url
})

const openInNewTab = () => {
  if (bilibiliUrl.value) {
    window.open(bilibiliUrl.value, '_blank')
  }
}

const close = () => {
  emit('close')
}
</script>

<style scoped>
/* 确保 iframe 正确显示 */
iframe {
  display: block;
}
</style>
