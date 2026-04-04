<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
      @click="close"
    >
      <div
        class="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
        @click.stop
      >
        <div class="px-8 py-6 border-b border-zinc-800/50 flex items-center justify-between">
          <h3 class="text-xl font-black text-zinc-100">投稿备注留言</h3>
          <button class="text-zinc-500 hover:text-zinc-300 transition-colors" @click="close">
            <X :size="20" />
          </button>
        </div>
        <div class="p-8 space-y-4">
          <div class="flex items-center gap-3">
            <p class="text-xs text-zinc-500 font-medium">{{ songTitle }}</p>
            <label class="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                :checked="isPublic"
                @change="$emit('update:isPublic', $event.target.checked)"
                class="w-4 h-4 rounded border-zinc-800 bg-zinc-950 accent-blue-500"
              >
              <span
                :class="[
                  'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors',
                  isPublic
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 group-hover:bg-blue-500/20'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20 group-hover:bg-amber-500/20'
                ]"
              >
                {{ isPublic ? '公开备注' : '仅管理员可见' }}
              </span>
            </label>
          </div>
          <div class="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-4">
            <p class="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {{ content }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { X } from 'lucide-vue-next'

defineProps({
  show: {
    type: Boolean,
    default: false
  },
  songTitle: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['close', 'update:isPublic'])

const close = () => {
  emit('close')
}
</script>