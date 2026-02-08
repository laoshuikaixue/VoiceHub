<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4" @click="handleOverlayClick">
      <Transition name="scale">
        <div 
          v-if="show" 
          class="w-full max-w-sm bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden" 
          @click.stop
        >
          <!-- Content -->
          <div class="flex flex-col items-center py-6 px-4 space-y-4 text-center">
            <!-- Icon -->
            <div 
              class="w-14 h-14 rounded-2xl flex items-center justify-center border shadow-xl transition-colors"
              :class="iconClasses"
            >
              <component :is="iconComponent" class="w-7 h-7" />
            </div>

            <!-- Text -->
            <div class="space-y-2 px-2">
              <h4 class="text-lg font-black text-zinc-100 tracking-tight">{{ title }}</h4>
              <p class="text-sm text-zinc-500 leading-relaxed font-medium">
                {{ message }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 w-full pt-4">
              <button 
                @click="handleCancel" 
                class="flex-1 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-black rounded-xl transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="loading"
              >
                {{ cancelText }}
              </button>
              <button 
                @click="handleConfirm" 
                class="flex-1 px-4 py-3 text-zinc-950 text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                :class="confirmBtnClasses"
                :disabled="loading"
              >
                <span v-if="loading" class="w-3 h-3 border-2 border-zinc-900/30 border-t-zinc-950 rounded-full animate-spin"></span>
                {{ confirmText }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { AlertTriangle, Info, XCircle, CheckCircle2 } from 'lucide-vue-next'

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
    default: 'warning', // 'warning', 'danger', 'info', 'success'
    validator: value => ['warning', 'danger', 'info', 'success'].includes(value)
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
  }
})

const emit = defineEmits(['confirm', 'cancel', 'close'])

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
  emit('close')
}

const handleOverlayClick = () => {
  if (props.closeOnOverlay && !props.loading) {
    handleCancel()
  }
}

const iconComponent = computed(() => {
  switch (props.type) {
    case 'danger': return XCircle
    case 'success': return CheckCircle2
    case 'info': return Info
    case 'warning': 
    default: return AlertTriangle
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
      return 'bg-red-500 hover:bg-red-400 shadow-red-900/20'
    case 'success':
      return 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-900/20'
    case 'info':
      return 'bg-blue-500 hover:bg-blue-400 shadow-blue-900/20'
    case 'warning':
    default:
      return 'bg-amber-500 hover:bg-amber-400 shadow-amber-900/20'
  }
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}
</style>