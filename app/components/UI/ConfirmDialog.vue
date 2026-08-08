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
        class="fixed inset-0 z-[2000] bg-bg-primary-80 backdrop-blur-sm flex items-center justify-center p-4"
        @click="handleOverlayClick"
      >
        <div
          class="w-full max-w-md bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl overflow-hidden"
          @click.stop
        >
          <!-- 内容 -->
          <div class="flex flex-col items-center p-8 text-center">
            <!-- 图标 -->
            <div
              class="w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 transition-colors border"
              :class="iconClasses"
            >
              <Icon :name="iconName" :size="40" />
            </div>

            <!-- 文字内容 -->
            <div class="space-y-2 mb-8">
              <h4 class="text-xl font-black text-text-primary tracking-tight">{{ resolvedTitle }}</h4>
              <p class="text-sm text-text-tertiary leading-relaxed font-medium whitespace-pre-line break-all">
                {{ message }}
              </p>
              
              <!-- 可选的输入框 -->
              <div v-if="showInput" class="pt-4 w-full">
                <input
                  v-model="inputValue"
                  :type="inputType"
                  :placeholder="inputPlaceholder"
                  class="w-full bg-bg-tertiary-50 border border-border-tertiary-50 rounded-xl px-4 py-3 text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                  @keyup.enter="handleConfirm"
                />
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex gap-3 w-full">
              <button
                class="flex-1 px-6 py-4 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-black rounded-2xl transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="loading"
                @click="handleCancel"
              >
                {{ resolvedCancelText }}
              </button>
              <button
                class="flex-[2] px-6 py-4 text-text-primary text-xs font-black rounded-2xl shadow-lg transition-all active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                :class="confirmBtnClasses"
                :disabled="loading || (showInput && !inputValue)"
                @click="handleConfirm"
              >
                <Icon v-if="loading" name="loader" :size="16" class="animate-spin" />
                {{ loading ? locale.processing : resolvedConfirmText }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
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

const handleOverlayClick = () => {
  if (props.closeOnOverlay && !props.loading) {
    handleCancel()
  }
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

<style scoped></style>
