<template>
  <div class="space-y-1.5">
    <label class="text-xs font-semibold text-text-secondary">{{ label }}</label>
    <input
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      class="w-full rounded-xl border border-panel-bg-dark bg-panel-bg-darkest px-4 py-2.5 text-base text-text-primary-light transition-colors placeholder:text-text-disabled focus:border-primary-30 focus:outline-none"
      @input="$emit('update:modelValue', $event.target.value)"
    >
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' }
})

defineEmits(['update:modelValue'])
</script>