<template>
  <div v-if="totalPages > 1" class="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 pt-4">
    <!-- 分页信息 -->
    <div class="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] order-2 sm:order-1">
      {{ formatLocale(locale.info, currentPage, totalPages) }}
      <span v-if="totalItems !== null"> ({{ formatLocale(locale.totalItems, totalItems, displayItemName) }})</span>
    </div>

    <!-- 分页控制 -->
    <div class="flex flex-wrap items-center justify-center gap-2 order-1 sm:order-2">
      <!-- 首页 -->
      <button
        :disabled="currentPage === 1"
        class="w-10 h-10 rounded-lg border border-border-secondary flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary-30 transition-all disabled:opacity-20 disabled:hover:text-text-secondary disabled:hover:border-border-secondary"
        :title="locale.first"
        @click="goToPage(1)"
      >
        <ChevronsLeft :size="18" />
      </button>

      <!-- 上一页 -->
      <button
        :disabled="currentPage === 1"
        class="w-10 h-10 rounded-lg border border-border-secondary flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary-30 transition-all disabled:opacity-20 disabled:hover:text-text-secondary disabled:hover:border-border-secondary"
        :title="locale.prev"
        @click="goToPage(currentPage - 1)"
      >
        <ChevronLeft :size="18" />
      </button>

      <!-- 当前页码/按钮组 (移动端隐藏，只显示当前页) -->
      <div class="flex items-center gap-2">
        <button
          v-for="page in displayedPages"
          :key="page"
          :class="[
            'w-10 h-10 rounded-lg text-xs font-black transition-all shadow-lg',
            currentPage === page
              ? 'bg-primary-hover text-text-primary shadow-[var(--primary-glow)]'
              : 'border border-border-secondary text-text-secondary hover:text-primary hover:border-primary-30 shadow-none'
          ]"
          @click="goToPage(page)"
        >
          {{ page }}
        </button>
      </div>

      <!-- 下一页 -->
      <button
        :disabled="currentPage === totalPages"
        class="w-10 h-10 rounded-lg border border-border-secondary flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary-30 transition-all disabled:opacity-20 disabled:hover:text-text-secondary disabled:hover:border-border-secondary"
        :title="locale.next"
        @click="goToPage(currentPage + 1)"
      >
        <ChevronRight :size="18" />
      </button>

      <!-- 尾页 -->
      <button
        :disabled="currentPage === totalPages"
        class="w-10 h-10 rounded-lg border border-border-secondary flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary-30 transition-all disabled:opacity-20 disabled:hover:text-text-secondary disabled:hover:border-border-secondary"
        :title="locale.last"
        @click="goToPage(totalPages)"
      >
        <ChevronsRight :size="18" />
      </button>

      <!-- 跳转输入 -->
      <div class="flex items-center ml-2 pl-2 border-l border-border-secondary">
        <div class="relative group">
          <input
            v-model="jumpPageInput"
            type="text"
            class="w-12 h-10 bg-bg-primary border border-border-secondary rounded-lg text-center text-xs font-black text-text-secondary focus:outline-none focus:border-primary-50 transition-all"
            :placeholder="locale.pagePlaceholder"
            @keyup.enter="handleJump"
          >
        </div>
        <button
          class="ml-2 px-3 h-10 bg-bg-tertiary hover:bg-bg-quaternary text-text-tertiary hover:text-text-primary text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
          @click="handleJump"
        >
          {{ locale.jump }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from '@lucide/vue'
import { useLocale } from '~/utils/locale'

const { ui } = useLocale()
const locale = computed(() => ui.value?.pagination || {})

const props = defineProps({
  currentPage: {
    type: Number,
    required: true
  },
  totalPages: {
    type: Number,
    required: true
  },
  totalItems: {
    type: Number,
    default: null
  },
  itemName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:currentPage', 'change'])

const jumpPageInput = ref('')
const displayItemName = computed(() => props.itemName || locale.value.defaultItemName)

// 计算要显示的页码
const displayedPages = computed(() => {
  const pages = []
  const maxVisible = 3 // 手机端展示较少，桌面端也可以通过这个控制

  let start = Math.max(1, props.currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(props.totalPages, start + maxVisible - 1)

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  return pages
})

const goToPage = (page) => {
  if (page >= 1 && page <= props.totalPages && page !== props.currentPage) {
    emit('update:currentPage', page)
    emit('change', page)
  }
}

const handleJump = () => {
  const page = parseInt(jumpPageInput.value)
  if (!isNaN(page) && page >= 1 && page <= props.totalPages) {
    goToPage(page)
    jumpPageInput.value = ''
  } else {
    // 简单的输入验证
    jumpPageInput.value = ''
  }
}

// 监听当前页变化，清空跳转输入
watch(() => props.currentPage, () => {
  jumpPageInput.value = ''
})
</script>
