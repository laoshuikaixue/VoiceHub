<template>
  <div class="border border-panel-bg-dark rounded-2xl overflow-hidden">
    <button
      class="w-full flex items-center justify-between px-5 py-4 hover:bg-panel-bg-darkest-50 transition-colors"
      @click="open = !open"
    >
      <span class="text-xs font-black text-text-muted uppercase tracking-widest">{{ title }}</span>
      <ChevronDown :class="['w-4 h-4 text-text-tertiary transition-transform duration-200', open && 'rotate-180']" />
    </button>
    <div v-show="open" class="px-5 pb-5">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ChevronDown } from '@lucide/vue'

defineProps({
  title: { type: String, required: true }
})

const open = ref(false)
</script>