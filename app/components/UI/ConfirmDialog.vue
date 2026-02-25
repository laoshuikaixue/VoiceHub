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
        class="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        @click="handleOverlayClick"
      >
        <div
          class="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
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
              <h4 class="text-xl font-black text-zinc-100 tracking-tight">{{ title }}</h4>
              <p class="text-sm text-zinc-500 leading-relaxed font-medium">
                {{ message }}
              </p>
              
              <!-- 可选的输入框 -->
              <div v-if="showInput" class="pt-4 w-full">
                <input
                  v-model="inputValue"
                  :type="inputType"
                  :placeholder="inputPlaceholder"
                  class="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                  @keyup.enter="handleConfirm"
                />
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex gap-3 w-full">
              <button
                class="flex-1 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black rounded-2xl transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="loading"
                @click="handleCancel"
              >
                {{ cancelText }}
              </button>
              <button
                class="flex-[2] px-6 py-4 text-white text-xs font-black rounded-2xl shadow-lg transition-all active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                :class="confirmBtnClasses"
                :disabled="loading || (showInput && !inputValue)"
                @click="handleConfirm"
              >
                <Icon v-if="loading" name="loader" :size="16" class="animate-spin" />
                {{ loading ? '处理中...' : confirmText }}
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

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '确认操作'
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
    default: '确认'
  },
  cancelText: {
    type: String,
    default: '取消'
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
      return 'bg-red-500/10 text-red-500 border-red-500/20 shadow-red-900/5'
    case 'success':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-900/5'
    case 'info':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-blue-900/5'
    case 'warning':
    default:
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-900/5'
  }
})

const confirmBtnClasses = computed(() => {
  switch (props.type) {
    case 'danger':
      return 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
    case 'success':
      return 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
    case 'info':
      return 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
    case 'warning':
    default:
      return 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20'
  }
})
</script>

<style scoped></style>
