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
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
      @click="close"
    >
      <div
        class="w-full max-w-lg bg-bg-secondary border border-border-secondary rounded-xl shadow-2xl overflow-hidden"
        @click.stop
      >
        <div class="px-8 py-6 border-b border-border-secondary-50 flex items-center justify-between">
          <h3 class="text-xl font-black text-text-primary">{{ locale.title }}</h3>
          <button class="text-text-tertiary hover:text-text-secondary transition-colors" @click="close">
            <X :size="20" />
          </button>
        </div>
        <div class="p-8 space-y-4">
          <div class="flex items-center gap-3">
            <p class="text-xs text-text-tertiary font-medium">{{ songTitle }}</p>
            <label for="is-public-checkbox" class="flex items-center gap-2 cursor-pointer group" :class="{ 'opacity-50': isUpdatingPublic }">
              <input
                id="is-public-checkbox"
                type="checkbox"
                :checked="isPublic"
                :disabled="isUpdatingPublic"
                @change="$emit('update:isPublic', $event.target.checked)"
                class="w-4 h-4 rounded border-border-secondary bg-bg-primary cursor-pointer disabled:cursor-not-allowed"
              >
              <span
                :class="[
                  'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors',
                  isPublic
                    ? 'bg-primary-10 text-primary border-primary-20 group-hover:bg-primary-20'
                    : 'bg-warning-10 text-warning border-warning-20 group-hover:bg-warning-20'
                ]"
              >
                {{ isPublic ? locale.publicRemark : locale.adminOnly }}
              </span>
              <span v-if="isUpdatingPublic" class="text-[10px] text-text-tertiary animate-pulse">{{ locale.updating }}</span>
            </label>
          </div>
          <div class="bg-bg-primary-50 border border-border-secondary-50 rounded-xl p-4">
            <p class="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {{ content }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { useLocale } from '~/utils/locale'

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
  },
  isUpdatingPublic: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'update:isPublic'])
const { admin } = useLocale()
const locale = computed(() => admin.value?.scheduleManager?.remarkDialog || {})

const close = () => {
  emit('close')
}
</script>
