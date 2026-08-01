<template>
  <div class="space-y-1.5">
    <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{{ label }}</label>
    <div class="relative">
      <input
        :value="modelValue"
        :type="show ? 'text' : 'password'"
        :placeholder="placeholder"
        class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 pr-10 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/40 placeholder:text-zinc-700"
        @input="$emit('update:modelValue', $event.target.value)"
      >
      <button
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
        @click="show = !show"
      >
        <EyeOff v-if="show" class="w-4 h-4" />
        <Eye v-else class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Eye, EyeOff } from '@lucide/vue'

defineProps({
  label: { type: String, required: true },
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' }
})

defineEmits(['update:modelValue'])

const show = ref(false)
</script>