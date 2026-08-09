<template>
  <div :class="['border rounded-2xl transition-all', enabled ? 'border-panel-bg-hover bg-panel-bg-darkest-30' : 'border-panel-bg-dark-50 bg-panel-bg-darkest-20']">
    <!-- 卡片头部 -->
    <div class="flex items-center justify-between px-5 py-4">
      <div class="flex items-center gap-3 min-w-0">
        <div class="text-text-tertiary shrink-0">
          <slot name="icon" />
        </div>
        <div class="min-w-0">
          <p :class="['text-sm font-bold truncate', masterOff ? 'text-text-disabled' : 'text-text-secondary']">{{ name }}</p>
          <p class="text-[11px] text-text-disabled truncate">{{ desc }}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="enabled"
        :disabled="masterOff"
        :class="[enabled ? 'bg-primary' : 'bg-panel-bg-compact', masterOff ? 'opacity-40 cursor-not-allowed' : '']"
        class="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ml-3"
        @click="toggle"
      >
        <span :class="enabled ? 'translate-x-4' : 'translate-x-0.5'" class="inline-block h-4 w-4 rounded-full bg-panel-bg-raised shadow-sm transition-transform duration-200 mt-0.5" />
      </button>
    </div>

    <!-- 展开的配置表单 -->
    <div v-if="enabled" class="px-5 pb-5 border-t border-panel-bg-dark-50 pt-4">
      <slot />
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  enabled: { type: Boolean, default: false },
  masterOff: { type: Boolean, default: false },
  name: { type: String, required: true },
  desc: { type: String, default: '' }
})

const emit = defineEmits(['toggle'])

const toggle = () => {
  if (!props.masterOff) {
    emit('toggle', !props.enabled)
  }
}
</script>