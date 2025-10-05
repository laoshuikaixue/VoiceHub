<template>
  <svg
      :class="['icon', `icon-${name}`, className]"
      :height="size"
      :style="{ color }"
      :width="size"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      viewBox="0 0 24 24"
  >
    <!-- 播放图标 -->
    <polygon v-if="name === 'play'" fill="currentColor" points="5,3 19,12 5,21"/>

    <!-- 暂停图标 -->
    <g v-else-if="name === 'pause'">
      <rect fill="currentColor" height="16" width="4" x="6" y="4"/>
      <rect fill="currentColor" height="16" width="4" x="14" y="4"/>
    </g>

    <!-- 停止图标 -->
    <rect v-else-if="name === 'stop'" fill="currentColor" height="14" width="14" x="5" y="5"/>

    <!-- 音量图标 -->
    <g v-else-if="name === 'volume'">
      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </g>

    <!-- 静音图标 -->
    <g v-else-if="name === 'volume-mute'">
      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
      <line x1="23" x2="17" y1="9" y2="15"/>
      <line x1="17" x2="23" y1="9" y2="15"/>
    </g>

    <!-- 左箭头 -->
    <g v-else-if="name === 'chevron-left'">
      <polyline points="15,18 9,12 15,6"/>
    </g>

    <!-- 右箭头 -->
    <g v-else-if="name === 'chevron-right'">
      <polyline points="9,18 15,12 9,6"/>
    </g>

    <!-- 上箭头 -->
    <g v-else-if="name === 'chevron-up'">
      <polyline points="18,15 12,9 6,15"/>
    </g>

    <!-- 下箭头 -->
    <g v-else-if="name === 'chevron-down'">
      <polyline points="6,9 12,15 18,9"/>
    </g>

    <!-- 心形/点赞图标 -->
    <path v-else-if="name === 'heart'"
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>

    <!-- 音乐图标 -->
    <g v-else-if="name === 'music'">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </g>

    <!-- 目标/选中图标 -->
    <g v-else-if="name === 'target'">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </g>

    <!-- 拇指向上 -->
    <g v-else-if="name === 'thumbs-up'">
      <path
          d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
    </g>

    <!-- 扬声器/广播图标 -->
    <g v-else-if="name === 'speaker'">
      <rect height="20" rx="2" ry="2" width="16" x="4" y="2"/>
      <circle cx="12" cy="14" r="4"/>
      <circle cx="12" cy="6" r="2"/>
    </g>

    <!-- 通知图标 -->
    <g v-else-if="name === 'bell'">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </g>

    <!-- 日历图标 -->
    <g v-else-if="name === 'calendar'">
      <rect height="18" rx="2" ry="2" width="18" x="3" y="4"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
    </g>

    <!-- 时钟图标 -->
    <g v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </g>

    <!-- 用户图标 -->
    <g v-else-if="name === 'user'">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </g>

    <!-- 设置图标 -->
    <g v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3"/>
      <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </g>

    <!-- 关闭/叉叉图标 -->
    <g v-else-if="name === 'x' || name === 'close'">
      <line x1="18" x2="6" y1="6" y2="18"/>
      <line x1="6" x2="18" y1="6" y2="18"/>
    </g>

    <!-- 信息图标 -->
    <g v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" x2="12" y1="16" y2="12"/>
      <line x1="12" x2="12.01" y1="8" y2="8"/>
    </g>

    <!-- 成功/勾选图标 -->
    <g v-else-if="name === 'check' || name === 'success'">
      <polyline points="20,6 9,17 4,12"/>
    </g>

    <!-- 错误/叉叉图标 -->
    <g v-else-if="name === 'error' || name === 'x-circle'">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" x2="9" y1="9" y2="15"/>
      <line x1="9" x2="15" y1="9" y2="15"/>
    </g>

    <!-- 警告图标 -->
    <g v-else-if="name === 'warning' || name === 'alert-triangle'">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" x2="12" y1="9" y2="13"/>
      <line x1="12" x2="12.01" y1="17" y2="17"/>
    </g>

    <!-- 上一首图标 -->
    <g v-else-if="name === 'skip-back' || name === 'previous'">
      <polygon fill="currentColor" points="19,20 9,12 19,4"/>
      <line stroke="currentColor" stroke-width="2" x1="5" x2="5" y1="19" y2="5"/>
    </g>

    <!-- 下一首图标 -->
    <g v-else-if="name === 'skip-forward' || name === 'next'">
      <polygon fill="currentColor" points="5,4 15,12 5,20"/>
      <line stroke="currentColor" stroke-width="2" x1="19" x2="19" y1="5" y2="19"/>
    </g>

    <!-- 快退图标 -->
    <g v-else-if="name === 'rewind'">
      <polygon fill="currentColor" points="11,19 2,12 11,5"/>
      <polygon fill="currentColor" points="22,19 13,12 22,5"/>
    </g>

    <!-- 快进图标 -->
    <g v-else-if="name === 'fast-forward'">
      <polygon fill="currentColor" points="13,19 22,12 13,5"/>
      <polygon fill="currentColor" points="2,19 11,12 2,5"/>
    </g>

    <!-- 歌词图标 -->
    <g v-else-if="name === 'lyrics'">
      <!-- 音符基础形状 -->
      <path d="M9 18V5l12-2v13" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="6" cy="18" fill="currentColor" r="3"/>
      <circle cx="18" cy="16" fill="currentColor" r="3"/>
      <!-- 歌词文本线条 -->
      <line stroke="currentColor" stroke-linecap="round" stroke-width="1.5" x1="2" x2="7" y1="8" y2="8"/>
      <line stroke="currentColor" stroke-linecap="round" stroke-width="1.5" x1="2" x2="9" y1="12" y2="12"/>
      <line stroke="currentColor" stroke-linecap="round" stroke-width="1.5" x1="2" x2="6" y1="16" y2="16"/>
    </g>

    <!-- 默认图标（如果没有匹配的图标） -->
    <circle v-else cx="12" cy="12" r="10"/>
  </svg>
</template>

<script setup>
defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: [String, Number],
    default: 24
  },
  color: {
    type: String,
    default: 'currentColor'
  },
  className: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.icon {
  display: inline-block;
  vertical-align: middle;
  transition: all 0.2s ease;
  /* 确保SVG在所有设备上渲染一致 */
  shape-rendering: geometricPrecision;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.icon:hover {
  transform: scale(1.05);
}
</style>
