<template>
  <div class="player-actions">
    <button
        :class="{ active: showLyrics }"
        :title="showLyrics ? '隐藏歌词' : '显示歌词'"
        class="action-btn lyrics-btn"
        @click="$emit('toggleLyrics')"
    >
      <svg fill="none" height="16" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 5h18v2H3V5zm0 4h14v2H3V9zm0 4h18v2H3v-2zm0 4h10v2H3v-2z" fill="currentColor" opacity="0.9"/>
        <circle cx="20" cy="11" fill="currentColor" opacity="0.7" r="2"/>
        <circle cx="18" cy="15" fill="currentColor" opacity="0.7" r="1.5"/>
      </svg>
    </button>

    <div :class="{ 'expanded': showQualitySettings }" class="quality-selector">
      <button class="quality-btn" title="音质设置" @click="toggleQualitySettings">
        <span class="quality-icon">♪</span>
        <span class="quality-text">{{ currentQualityText }}</span>
        <span :class="{ 'rotated': showQualitySettings }" class="quality-arrow">▼</span>
      </button>

      <Transition name="quality-dropdown">
        <div v-if="showQualitySettings && currentPlatformOptions.length > 0" class="quality-dropdown">
          <div
              v-for="option in currentPlatformOptions"
              :key="option.value"
              :class="{ 'active': isCurrentQuality(option.value) }"
              class="quality-option"
              @click="selectQuality(option.value)"
          >
            <span class="option-label">{{ option.label }}</span>
          </div>
        </div>
      </Transition>
    </div>

    <button class="close-player" @click="$emit('close')">
      <Icon :size="16" color="white" name="x"/>
    </button>
  </div>
</template>

<script setup>
import {onMounted, onUnmounted, ref} from 'vue'
import Icon from '~/components/UI/Icon.vue'

const props = defineProps({
  showLyrics: {
    type: Boolean,
    default: false
  },
  song: {
    type: Object,
    default: null
  },
  currentQualityText: {
    type: String,
    default: '音质'
  },
  currentPlatformOptions: {
    type: Array,
    default: () => []
  },
  isCurrentQuality: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['toggleLyrics', 'selectQuality', 'close'])

const showQualitySettings = ref(false)

const toggleQualitySettings = () => {
  showQualitySettings.value = !showQualitySettings.value
}

const selectQuality = (qualityValue) => {
  showQualitySettings.value = false
  emit('selectQuality', qualityValue)
}

// 点击外部关闭下拉框
const handleClickOutside = (event) => {
  if (showQualitySettings.value && !event.target.closest('.quality-selector')) {
    showQualitySettings.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.player-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  color: white;
  flex-shrink: 0;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.action-btn.active {
  background: rgba(79, 172, 254, 0.3);
  color: #4facfe;
}

.lyrics-btn svg {
  width: 16px;
  height: 16px;
}

.quality-selector {
  position: relative;
  flex-shrink: 0;
}

.quality-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  height: 32px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  color: white;
  font-size: 11px;
  min-width: 60px;
  flex-shrink: 0;
}

.quality-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.close-player {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  color: white;
  flex-shrink: 0;
}

.close-player:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.quality-icon {
  font-size: 12px;
  opacity: 0.8;
}

.quality-text {
  font-size: 10px;
  white-space: nowrap;
  max-width: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quality-arrow {
  font-size: 8px;
  transition: transform 0.2s ease;
  opacity: 0.6;
}

.quality-arrow.rotated {
  transform: rotate(180deg);
}

.quality-dropdown {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 4px;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  min-width: 120px;
  overflow: hidden;
}

.quality-option {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  color: white;
  font-size: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.quality-option:last-child {
  border-bottom: none;
}

.quality-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.quality-option.active {
  background: rgba(79, 172, 254, 0.2);
  color: #4facfe;
}

.option-label {
  white-space: nowrap;
}

/* 移动端优化 */
@media (hover: none) and (pointer: coarse) {
  .action-btn,
  .close-player {
    width: 32px !important;
    height: 32px !important;
    min-width: 32px !important;
    min-height: 32px !important;
  }

  .quality-btn {
    height: 32px !important;
    min-height: 32px !important;
    padding: 0 8px;
    min-width: 60px;
  }

  .lyrics-btn svg {
    width: 16px !important;
    height: 16px !important;
  }

  /* 确保所有图标大小一致 */
  .action-btn svg,
  .close-player svg {
    width: 16px !important;
    height: 16px !important;
  }
}

/* 动画 */
.quality-dropdown-enter-active,
.quality-dropdown-leave-active {
  transition: all 0.2s ease;
}

.quality-dropdown-enter-from,
.quality-dropdown-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}
</style>