<template>
  <AppModal
    :close-on-esc="!loading"
    :close-on-overlay="closeOnOverlay && !loading"
    :persistent="loading"
    :show="show"
    :title="resolvedTitle"
    hide-close
    size="sm"
    @update:show="handleCancel"
  >
    <template #header="{ titleId }">
      <div class="flex w-full flex-col items-center text-center">
        <div
          class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors"
          :class="iconClasses"
        >
          <Icon :name="iconName" :size="24" />
        </div>
        <h4 :id="titleId" class="text-lg font-bold tracking-tight text-text-primary">
          {{ resolvedTitle }}
        </h4>
      </div>
    </template>

    <div class="space-y-4 text-center">
      <p class="whitespace-pre-line break-words text-sm font-medium leading-relaxed text-text-tertiary">
        {{ message }}
      </p>

      <div v-if="showInput">
        <input
          v-model="inputValue"
          :type="inputType"
          :placeholder="inputPlaceholder"
          class="w-full rounded-xl border border-border-tertiary-50 bg-bg-tertiary-50 px-4 py-3 text-base text-text-primary transition-colors placeholder:text-text-disabled focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          @keyup.enter="handleConfirm"
        >
      </div>
    </div>

    <template #footer>
      <div class="flex w-full gap-3">
        <button
          class="flex-1 rounded-xl bg-bg-tertiary px-5 py-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-quaternary disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="loading"
          type="button"
          @click="handleCancel"
        >
          {{ resolvedCancelText }}
        </button>
        <button
          class="flex flex-[2] items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-text-primary shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          :class="confirmBtnClasses"
          :disabled="loading || (showInput && !inputValue)"
          type="button"
          @click="handleConfirm"
        >
          <Icon v-if="loading" name="loader" :size="16" class="animate-spin" />
          {{ loading ? locale.processing : resolvedConfirmText }}
        </button>
      </div>
    </template>
  </AppModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import AppModal from '~/components/UI/Common/AppModal.vue'
import Icon from './Icon.vue'
import { useLocale } from '~/utils/locale'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'warning',
    validator: (value) => ['warning', 'danger', 'info', 'success'].includes(value)
  },
  confirmText: {
    type: String,
    default: ''
  },
  cancelText: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  },
  closeOnOverlay: {
    type: Boolean,
    default: true
  },
  showInput: {
    type: Boolean,
    default: false
  },
  inputType: {
    type: String,
    default: 'text'
  },
  inputPlaceholder: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['confirm', 'cancel', 'close', 'update:show'])

const inputValue = ref('')
const { common } = useLocale()
const locale = computed(() => common.value || {})
const resolvedTitle = computed(() => props.title || locale.value?.confirmOperation || '确认操作')
const resolvedConfirmText = computed(() => props.confirmText || locale.value?.confirm || '确认')
const resolvedCancelText = computed(() => props.cancelText || locale.value?.cancel || '取消')

watch(() => props.show, (newVal) => {
  if (newVal) {
    inputValue.value = ''
  }
})

const handleConfirm = () => {
  if (props.showInput) {
    emit('confirm', inputValue.value)
  } else {
    emit('confirm')
  }
}

const handleCancel = () => {
  emit('cancel')
  emit('close')
  emit('update:show', false)
}

const iconName = computed(() => {
  switch (props.type) {
    case 'danger':
      return 'alert-circle'
    case 'success':
      return 'success'
    case 'info':
      return 'info'
    case 'warning':
    default:
      return 'alert-triangle'
  }
})

const iconClasses = computed(() => {
  switch (props.type) {
    case 'danger':
      return 'bg-error-10 text-error border-error-20 shadow-[var(--error-glow-5)]'
    case 'success':
      return 'bg-success-10 text-success border-success-20 shadow-[var(--success-glow-5)]'
    case 'info':
      return 'bg-primary-10 text-primary border-primary-20 shadow-[var(--primary-glow-5)]'
    case 'warning':
    default:
      return 'bg-warning-10 text-warning border-warning-20 shadow-[var(--warning-glow-5)]'
  }
})

const confirmBtnClasses = computed(() => {
  switch (props.type) {
    case 'danger':
      return 'bg-error hover:bg-error shadow-[var(--error-glow-20)]'
    case 'success':
      return 'bg-success hover:bg-success shadow-[var(--success-glow-20)]'
    case 'info':
      return 'bg-primary-hover hover:bg-primary shadow-[var(--primary-glow)]'
    case 'warning':
    default:
      return 'bg-warning hover:bg-warning shadow-[var(--warning-glow-20)]'
  }
})
</script>
