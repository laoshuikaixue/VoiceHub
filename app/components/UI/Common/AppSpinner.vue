<template>
  <span class="app-spinner-wrap" :class="{ 'app-spinner-wrap--with-label': label }">
    <span
      class="app-spinner"
      :class="{ 'app-spinner--accent': !color }"
      :style="spinnerStyle"
      role="status"
      :aria-label="label || '加载中'"
    />
    <span v-if="label" class="app-spinner-label">{{ label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // 转圈直径（px）
  size: { type: Number, default: 32 },
  // 边框粗细（px），默认按尺寸自动计算
  borderWidth: { type: Number, default: 0 },
  // 可选文字（显示在转圈右侧，不随转圈旋转）
  label: { type: String, default: '' },
  // 自定义颜色（如播放器按钮旁的白色），不传则保持主题色
  color: { type: String, default: '' }
})

const spinnerStyle = computed(() => {
  const border = props.borderWidth || Math.max(2, Math.round(props.size / 10))
  const style = {
    width: `${props.size}px`,
    height: `${props.size}px`,
    borderWidth: `${border}px`
  }
  if (props.color) {
    style.borderColor = `color-mix(in srgb, ${props.color} 30%, transparent)`
    style.borderTopColor = props.color
  }
  return style
})
</script>

<style scoped>
.app-spinner-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.app-spinner {
  display: inline-block;
  flex-shrink: 0;
  border-style: solid;
  border-radius: 50%;
  animation: app-spinner-rotate 0.8s linear infinite;
}

/* 默认主题色，仅未传 color 时生效 */
.app-spinner--accent {
  border-color: var(--color-accent-alpha-20);
  border-top-color: var(--color-accent);
}

.app-spinner-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}

@keyframes app-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}
</style>
