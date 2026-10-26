<template>
  <div class="space-y-2.5">
    <!-- 搜索 + 已选数量 -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <Search :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
        <input
          v-model="keyword"
          type="text"
          :placeholder="locale.assignSearchCodePlaceholder"
          class="w-full rounded-xl border border-border-secondary bg-bg-primary py-2.5 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-40 focus:outline-none"
          @input="handleKeywordInput"
        >
        <button
          v-if="keyword"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-tertiary hover:text-text-primary"
          @click="clearKeyword"
        >
          <X :size="14" />
        </button>
      </div>
      <button
        v-if="modelValue.length"
        type="button"
        class="shrink-0 rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-xs font-bold text-text-secondary hover:text-text-primary"
        @click="clearAll"
      >
        {{ locale.assignClearCodes }}
      </button>
    </div>

    <div class="rounded-xl border border-border-secondary bg-bg-primary">
      <div class="flex items-center justify-between gap-2 border-b border-border-secondary px-3 py-2">
        <p class="text-[11px] font-bold text-text-tertiary">
          <AppSpinner v-if="loading" :size="13" class="mr-1 align-middle" />
          {{ loading ? locale.assignCodeLoading : getMessage('assignCodeSummary', modelValue.length, total) }}
        </p>
        <button
          v-if="codes.length"
          type="button"
          class="text-[11px] font-bold text-primary hover:text-primary-hover"
          @click="selectAll"
        >
          {{ locale.assignSelectAllCodes }}
        </button>
      </div>

      <div class="max-h-[240px] overflow-y-auto p-1.5">
        <button
          v-for="item in codes"
          :key="item.id"
          type="button"
          class="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-bg-tertiary-50 sm:min-h-0"
          @click="toggle(item.id)"
        >
          <span
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-black"
            :class="isSelected(item.id) ? 'border-primary bg-primary text-text-primary' : 'border-border-tertiary'"
          >
            {{ isSelected(item.id) ? '✓' : '' }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-mono text-[13px] text-text-primary">{{ item.code }}</span>
            <span v-if="item.note" class="block truncate text-[11px] text-text-tertiary">{{ item.note }}</span>
          </span>
          <span
            v-if="isPresetOnly(item.id)"
            class="shrink-0 rounded-md border border-warning-20 bg-warning-10 px-1.5 py-0.5 text-[10px] font-bold text-warning"
          >
            {{ locale.assignCodePresetTag }}
          </span>
          <span class="shrink-0 text-[10px] text-text-tertiary">{{ formatDate(item.createdAt) }}</span>
        </button>

        <p v-if="!loading && !codes.length" class="px-3 py-6 text-center text-xs text-text-tertiary">
          {{ keyword.trim() ? locale.assignCodeSearchEmpty : locale.assignCodeEmpty }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Search, X } from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { useLocale } from '~/utils/locale'
import { useLocaleText } from '~/composables/useLocaleText'

/** 选择可用点歌券。 */
const props = defineProps({
  // 已勾选的点歌券 ID
  modelValue: {
    type: Array,
    default: () => []
  },
  // 打开弹窗时预勾选的券（含完整信息），来自券列表的行内/批量入口
  presetCoupons: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

const { admin } = useLocale()
const locale = computed(() => admin.value?.cardCodesManager || {})
const { msg: getMessage } = useLocaleText(locale)

const keyword = ref('')
const codes = ref([])
const total = ref(0)
const loading = ref(false)

let timer = null

const isSelected = (id) => props.modelValue.includes(id)

// 标记当前结果之外的预勾选券。
const presetOnlyIds = ref(new Set())
const isPresetOnly = (id) => presetOnlyIds.value.has(id)

const toggle = (id) => {
  const next = isSelected(id)
    ? props.modelValue.filter((item) => item !== id)
    : [...props.modelValue, id]
  emit('update:modelValue', next)
}

const clearAll = () => emit('update:modelValue', [])

const selectAll = () => {
  emit('update:modelValue', [...new Set([...props.modelValue, ...codes.value.map((item) => item.id)])])
}

const formatDate = (value) => {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(value))
  } catch {
    return ''
  }
}

const fetchCodes = async () => {
  loading.value = true
  try {
    const res = await $fetch('/api/admin/card-codes', {
      query: {
        status: 'AVAILABLE',
        q: keyword.value.trim(),
        page: 1,
        limit: 100
      }
    })
    const list = Array.isArray(res?.data) ? res.data : []
    // 保留当前结果之外的预勾选项。
    const known = new Set(list.map((item) => item.id))
    const extras = props.presetCoupons
      .map((item) => ({
        id: Number(item?.id),
        code: item?.code || '',
        note: item?.note || '',
        createdAt: item?.createdAt || null
      }))
      .filter((item) => Number.isInteger(item.id) && item.id > 0 && !known.has(item.id))
    codes.value = [...list, ...extras]
    // 只有在没有搜索词时才判定为「已不在可用列表」：搜索时命中不到可能只是被过滤掉了
    presetOnlyIds.value = keyword.value.trim()
      ? new Set()
      : new Set(extras.map((item) => item.id))
    total.value = Number(res?.pagination?.total || 0)
  } catch (error) {
    console.error('加载可用点歌券失败', error)
    codes.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// 搜索防抖。
const handleKeywordInput = () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(fetchCodes, 300)
}

const clearKeyword = () => {
  keyword.value = ''
  fetchCodes()
}

// 预勾选仅保留 AVAILABLE 券。
watch(
  () => props.presetCoupons,
  (list) => {
    const preset = (Array.isArray(list) ? list : [])
      .map((item) => Number(item?.id))
      .filter((id) => Number.isInteger(id) && id > 0)
    if (preset.length) {
      emit('update:modelValue', [...new Set([...props.modelValue, ...preset])])
    }
  },
  { immediate: true }
)

onMounted(fetchCodes)
</script>
