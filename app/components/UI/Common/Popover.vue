<template>
  <div class="relative inline-block" ref="containerRef">
    <div @click="toggle" class="cursor-pointer">
      <slot name="trigger" :isOpen="isOpen"></slot>
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform scale-95 opacity-0 translate-y-2"
        enter-to-class="transform scale-100 opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform scale-100 opacity-100 translate-y-0"
        leave-to-class="transform scale-95 opacity-0 translate-y-2"
      >
        <div
          v-if="isOpen"
          ref="contentRef"
          :style="contentStyle"
          class="fixed z-[10000] bg-[#1e1e1e]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          @click.stop
        >
          <slot name="content" :close="close"></slot>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onUnmounted, type StyleValue } from 'vue'

const props = defineProps({
  placement: {
    type: String,
    default: 'bottom-end' // bottom-start, bottom-end, top-start, top-end
  },
  offset: {
    type: Number,
    default: 8
  }
})

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const contentStyle = ref<StyleValue>({})

const updatePosition = () => {
  if (!isOpen.value || !containerRef.value || !contentRef.value) return

  const triggerRect = containerRef.value.getBoundingClientRect()
  const contentRect = contentRef.value.getBoundingClientRect()
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight

  let top = 0
  let left = 0
  
  // Vertical positioning base
  if (props.placement.startsWith('top')) {
      top = triggerRect.top - contentRect.height - props.offset
  } else {
      top = triggerRect.bottom + props.offset
  }

  // Horizontal positioning base
  if (props.placement.endsWith('end')) {
      left = triggerRect.right - contentRect.width
  } else {
      left = triggerRect.left
  }

  // Boundary checks
  // Right edge
  if (left + contentRect.width > windowWidth - 10) {
      left = windowWidth - contentRect.width - 10
  }
  // Left edge
  if (left < 10) {
      left = 10
  }
  
  // Flip vertical if needed
  if (props.placement.startsWith('bottom') && top + contentRect.height > windowHeight - 10) {
      // Try top
      const topSpace = triggerRect.top
      if (topSpace > contentRect.height + props.offset) {
          top = triggerRect.top - contentRect.height - props.offset
      }
  } else if (props.placement.startsWith('top') && top < 10) {
      // Try bottom
      const bottomSpace = windowHeight - triggerRect.bottom
      if (bottomSpace > contentRect.height + props.offset) {
          top = triggerRect.bottom + props.offset
      }
  }

  contentStyle.value = {
    top: `${top}px`,
    left: `${left}px`
  }
}

const close = () => {
  isOpen.value = false
}

const toggle = async () => {
  if (isOpen.value) {
    close()
  } else {
    isOpen.value = true
    await nextTick()
    updatePosition()
  }
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  if (
    containerRef.value && 
    !containerRef.value.contains(target) &&
    contentRef.value && 
    !contentRef.value.contains(target)
  ) {
    close()
  }
}

const handleScrollOrResize = () => {
  if (isOpen.value) {
    updatePosition()
  }
}

watch(isOpen, (val) => {
  if (val) {
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    // Use setTimeout to avoid immediate trigger if the click that opened it bubbles up
    setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0)
  } else {
    window.removeEventListener('scroll', handleScrollOrResize, true)
    window.removeEventListener('resize', handleScrollOrResize)
    document.removeEventListener('mousedown', handleClickOutside)
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScrollOrResize, true)
  window.removeEventListener('resize', handleScrollOrResize)
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>
