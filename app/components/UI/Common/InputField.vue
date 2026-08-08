<template>
  <div class="space-y-1.5">
    <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest">{{ label }}</label>
    <input
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      class="w-full bg-panel-bg-darkest border border-panel-bg-dark rounded-xl px-4 py-2.5 text-sm text-text-primary-light focus:outline-none focus:border-primary-30 placeholder:text-text-disabled"
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