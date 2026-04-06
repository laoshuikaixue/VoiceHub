<template>
  <div
    class="volume-control-container"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @wheel.prevent="handleWheel"
  >
    <!-- 弹出的音量条 (仅 PC 端 hover 或移动端点击时显示) -->
    <Transition name="volume-slide">
      <div v-show="showSlider" class="volume-slider-popup">
        <div
          ref="sliderRef"
          class="volume-slider"
          @mousedown="startDrag"
          @touchstart.prevent="startTouchDrag"
          @click="handleSliderClick"
        >
          <div class="volume-slider-bg">
            <div
              class="volume-slider-fill"
              :style="{ height: `${volumePercentage}%` }"
            />
            <div
              class="volume-slider-thumb"
              :style="{ bottom: `${volumePercentage}%` }"
              :class="{ dragging: isDragging }"
            />
          </div>
        </div>
      </div>
    </Transition>

    <!-- 底部按钮区 -->
    <div
      class="volume-btn"
      :class="{ active: showSlider }"
      @click="toggleMuteOrShowSlider"
    >
      <!-- 显示百分比或图标 -->
      <Transition name="fade-icon" mode="out-in">
        <span v-if="showSlider" class="volume-text sf-pro">
          {{ Math.round(volumePercentage) }}%
        </span>
        <Icon
          v-else
          :name="volumeIcon"
          :size="20"
          :class="{ 'muted-icon': isMuted }"
        />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'
import { useAudioPlayerControl } from '~/composables/useAudioPlayerControl'

const control = useAudioPlayerControl()

const isMobile = ref(false)
const showSlider = ref(false)
const sliderRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
let hideTimer: number | null = null

const volumePercentage = computed(() => {
  return (control.volume.value || 0) * 100
})

const isMuted = computed(() => {
  return control.isMuted.value || control.volume.value === 0
})

const volumeIcon = computed(() => {
  if (isMuted.value || control.volume.value === 0) return 'volume-mute'
  return 'volume'
})

const checkMobile = () => {
  if (import.meta.client) {
    isMobile.value = window.innerWidth <= 768
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  document.removeEventListener('click', handleClickOutside)
  clearTimeout(hideTimer!)
})

// PC端 Hover 效果
const handleMouseEnter = () => {
  if (isMobile.value || isDragging.value) return
  if (hideTimer) clearTimeout(hideTimer)
  showSlider.value = true
}

const handleMouseLeave = () => {
  if (isMobile.value || isDragging.value) return
  hideTimer = window.setTimeout(() => {
    showSlider.value = false
  }, 300)
}

// 移动端点击处理
const toggleMuteOrShowSlider = (e: Event) => {
  if (isMobile.value) {
    e.stopPropagation()
    showSlider.value = !showSlider.value
  } else {
    // PC端点击直接静音/取消静音
    control.toggleMute()
  }
}

// 滚轮控制音量
const handleWheel = (e: WheelEvent) => {
  if (!showSlider.value && !isMobile.value) return
  // 向上滚增加音量，向下滚减小音量
  const delta = e.deltaY > 0 ? -0.05 : 0.05
  control.setVolume(control.volume.value + delta)
}

// 拖拽控制
const updateVolumeFromEvent = (clientY: number) => {
  if (!sliderRef.value) return
  const rect = sliderRef.value.getBoundingClientRect()
  // 计算相对于底部的百分比
  const y = Math.max(0, Math.min(rect.height, rect.bottom - clientY))
  const percentage = y / rect.height
  control.setVolume(percentage)
}

const handleSliderClick = (e: MouseEvent) => {
  updateVolumeFromEvent(e.clientY)
}

const startDrag = (e: MouseEvent) => {
  isDragging.value = true
  updateVolumeFromEvent(e.clientY)

  const onMouseMove = (e: MouseEvent) => {
    updateVolumeFromEvent(e.clientY)
  }

  const onMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    // 如果鼠标已经离开区域，隐藏 slider
    if (!isMobile.value) {
      hideTimer = window.setTimeout(() => {
        showSlider.value = false
      }, 500)
    }
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const startTouchDrag = (e: TouchEvent) => {
  isDragging.value = true
  updateVolumeFromEvent(e.touches[0].clientY)

  const onTouchMove = (e: TouchEvent) => {
    updateVolumeFromEvent(e.touches[0].clientY)
  }

  const onTouchEnd = () => {
    isDragging.value = false
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', onTouchEnd)
  }

  document.addEventListener('touchmove', onTouchMove, { passive: false })
  document.addEventListener('touchend', onTouchEnd)
}

const handleClickOutside = (e: Event) => {
  if (isMobile.value && showSlider.value) {
    const target = e.target as HTMLElement
    if (!target.closest('.volume-control-container')) {
      showSlider.value = false
    }
  }
}
</script>

<style scoped>
.volume-control-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 39px;
  height: 39px;
  z-index: 100;
}

/* 底部按钮 */
.volume-btn {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff92;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  border-radius: 50%;
  background: transparent;
  user-select: none;
}

.volume-btn:hover {
  color: #ffffff;
  transform: scale(1.1);
}

.volume-btn.active {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
}

.muted-icon {
  color: rgba(255, 100, 100, 0.9);
}

.volume-text {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.5px;
}

/* 图标/文本切换动画 */
.fade-icon-enter-active,
.fade-icon-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-icon-enter-from,
.fade-icon-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* 弹出层 */
.volume-slider-popup {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 120px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05)),
    rgba(30, 30, 35, 0.85);
  backdrop-filter: blur(20px) saturate(1.8);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  padding: 12px 0;
}

/* 弹出动画 */
.volume-slide-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: bottom center;
}
.volume-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: bottom center;
}
.volume-slide-enter-from,
.volume-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px) scale(0.8);
}

/* 滑动条容器 */
.volume-slider {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  cursor: pointer;
  touch-action: none;
}

.volume-slider-bg {
  position: relative;
  width: 6px;
  height: 100%;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.volume-slider-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(to top, #4facfe, #00f2fe);
  border-radius: 3px;
  transition: height 0.1s linear;
}

.volume-slider-thumb {
  position: absolute;
  left: 50%;
  transform: translate(-50%, 50%);
  width: 14px;
  height: 14px;
  background: #ffffff;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  pointer-events: none;
}

.volume-slider-thumb.dragging,
.volume-slider:hover .volume-slider-thumb {
  transform: translate(-50%, 50%) scale(1.2);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
}
</style>
