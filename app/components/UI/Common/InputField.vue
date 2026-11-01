<template>
  <div class="group space-y-1.5">
    <label
      :for="inputId"
      class="text-[10px] font-black text-text-disabled uppercase tracking-widest transition-colors group-focus-within:text-primary"
    >{{ label }}</label>
    <input
      :id="inputId"
      ref="inputRef"
      v-bind="$attrs"
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="[$attrs['aria-describedby'], error ? errorId : null].filter(Boolean).join(' ') || undefined"
      class="w-full min-w-0 bg-bg-primary border rounded-lg font-bold text-text-secondary placeholder:text-text-disabled transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      :class="[
        sizeClass,
        error
          ? 'border-error focus:border-error'
          : 'border-border-secondary hover:border-border-tertiary focus:border-primary-50 focus:bg-primary-hover-5 focus:shadow-lg'
      ]"
      @input="$emit('update:modelValue', $event.target.value)"
    >
    <p v-if="error" :id="errorId" class="text-[11px] text-error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup>
import { computed, ref, useId } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  id: { type: String, default: '' },
  label: { type: String, required: true },
  modelValue: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
  size: { type: String, default: 'md' },
  disabled: { type: Boolean, default: false },
  error: { type: String, default: '' }
})

defineEmits(['update:modelValue'])

const inputRef = ref(null)
const generatedId = useId()
const inputId = computed(() => props.id || generatedId)
const errorId = computed(() => `${inputId.value}-error`)
const sizeClass = computed(() => {
  switch (props.size) {
    case 'xs': return 'px-2 py-1 text-[10px]'
    case 'sm': return 'px-3 py-2 text-[11px]'
    case 'lg': return 'px-4 py-3 text-sm'
    case 'xl': return 'p-3 text-base'
    case 'md':
    default: return 'px-3 py-2.5 text-sm'
  }
})

defineExpose({ focus: () => inputRef.value?.focus() })
</script>
