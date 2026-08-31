<script setup lang="ts">
/**
 * 歌词渲染组件 - 基于 @applemusic-like-lyrics/core
 */
import type {
  BaseRenderer,
  LyricLine,
  LyricLineMouseEvent,
  LyricPlayerBase,
  OptimizeLyricOptions,
  spring
} from '@applemusic-like-lyrics/core'
import {
  type PropType,
  type Ref,
  type ShallowRef,
  ref,
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  watch
} from 'vue'
import '@applemusic-like-lyrics/core/style.css'

/**
 * Props 定义
 */
const props = defineProps({
  /**
   * 是否禁用歌词播放组件
   */
  disabled: {
    type: Boolean,
    default: false
  },
  /**
   * 是否演出部分效果
   */
  playing: {
    type: Boolean,
    default: true
  },
  /**
   * 设置歌词行的对齐方式
   */
  alignAnchor: {
    type: String as PropType<'top' | 'bottom' | 'center'>,
    default: 'center'
  },
  /**
   * 设置默认的歌词行对齐位置
   */
  alignPosition: {
    type: Number,
    default: 0.5
  },
  /**
   * 设置是否使用物理弹簧算法
   */
  enableSpring: {
    type: Boolean,
    default: true
  },
  /**
   * 设置是否启用歌词行的模糊效果
   */
  enableBlur: {
    type: Boolean,
    default: true
  },
  /**
   * 设置是否启用缩放效果
   */
  enableScale: {
    type: Boolean,
    default: true
  },
  /**
   * 设置是否隐藏已经播放过的歌词行
   */
  hidePassedLines: {
    type: Boolean,
    default: false
  },
  /**
   * 设置当前播放歌词
   */
  lyricLines: {
    type: Object as PropType<LyricLine[]>,
    required: false
  },
  /**
   * 设置当前播放进度
   */
  currentTime: {
    type: Number,
    default: 0
  },
  /**
   * 设置文字动画的渐变宽度
   */
  wordFadeWidth: {
    type: Number,
    default: 0.5
  },
  /**
   * X 轴弹簧参数
   */
  linePosXSpringParams: {
    type: Object as PropType<Partial<spring.SpringParams>>,
    required: false
  },
  /**
   * Y 轴弹簧参数
   */
  linePosYSpringParams: {
    type: Object as PropType<Partial<spring.SpringParams>>,
    required: false
  },
  /**
   * 缩放弹簧参数
   */
  lineScaleSpringParams: {
    type: Object as PropType<Partial<spring.SpringParams>>,
    required: false
  },
  /**
   * 渲染器类
   */
  lyricPlayer: {
    type: Object as PropType<{
      new (...args: ConstructorParameters<typeof BaseRenderer>): BaseRenderer
    }>,
    required: false
  },
  /**
   * AMLL 歌词行优化配置（修改后需重新 setLyricLines 才对当前歌词生效）
   */
  optimizeOptions: {
    type: Object as PropType<OptimizeLyricOptions>,
    required: false
  }
})

/**
 * 歌词播放组件的事件
 */
const emit = defineEmits<{
  lineClick: [event: LyricLineMouseEvent]
  lineContextmenu: [event: LyricLineMouseEvent]
}>()

/**
 * 歌词播放组件的引用
 */
export interface LyricPlayerRef {
  /**
   * 歌词播放实例
   */
  lyricPlayer: Ref<LyricPlayerBase | undefined>
  /**
   * 将歌词播放实例的元素包裹起来的 DIV 元素实例
   */
  wrapperEl: Readonly<ShallowRef<HTMLDivElement | null>>
}

// 模板引用
const wrapperRef = ref<HTMLDivElement | null>(null)
// 歌词播放实例
const playerRef = ref<LyricPlayerBase>()

// 初始化完成标记与内容淡入控制
const initialized = ref(false)
const contentVisible = ref(false)
// 初始化完成前到达的歌词行，初始化后统一应用
let pendingLyricLines: LyricLine[] | undefined
// 最新播放进度（非响应式；setLyricLines 不带时间会把内部进度重置为 0）
let latestTime = 0

// 事件处理器
const lineClickHandler = (e: Event) => emit('lineClick', e as LyricLineMouseEvent)
const lineContextMenuHandler = (e: Event) => emit('lineContextmenu', e as LyricLineMouseEvent)

// 底部行元素 (用于 Teleport)
const bottomLineEl = computed(() => playerRef.value?.getBottomLineElement())

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

// 组件挂载时初始化（分帧等待渲染，避免挂载首帧跳动）
onMounted(async () => {
  const wrapper = wrapperRef.value
  if (!wrapper) return

  try {
    const { LyricPlayer: CoreLyricPlayer } = await import('@applemusic-like-lyrics/core')
    if (wrapperRef.value !== wrapper || playerRef.value) return

    const player = new CoreLyricPlayer()
    playerRef.value = player
    wrapper.appendChild(player.getElement())
    player.addEventListener('line-click', lineClickHandler)
    player.addEventListener('line-contextmenu', lineContextMenuHandler)
    if (props.optimizeOptions) player.setOptimizeOptions({ ...props.optimizeOptions })

    await nextTick()
    if (playerRef.value !== player) return
    await nextFrame()
    if (playerRef.value !== player) return

    if (pendingLyricLines) {
      player.setLyricLines(pendingLyricLines, latestTime)
      pendingLyricLines = undefined
      await nextFrame()
      if (playerRef.value !== player) return
    }

    player.update(0)
    player.setCurrentTime(latestTime, true)
    initialized.value = true
    contentVisible.value = true
  } catch (error) {
    console.error('AM 歌词播放器初始化失败:', error)
  }
})

// 组件卸载时清理
onUnmounted(() => {
  const player = playerRef.value
  if (player) {
    player.removeEventListener('line-click', lineClickHandler)
    player.removeEventListener('line-contextmenu', lineContextMenuHandler)
    player.dispose()
  }
  initialized.value = false
  contentVisible.value = false
  pendingLyricLines = undefined
})

// 动画帧更新
watchEffect((onCleanup) => {
  if (!props.disabled) {
    let canceled = false
    let lastTime = -1
    const onFrame = (time: number) => {
      if (canceled) return
      if (lastTime !== -1) {
        playerRef.value?.update(time - lastTime)
      }
      lastTime = time
      requestAnimationFrame(onFrame)
    }
    requestAnimationFrame(onFrame)
    onCleanup(() => {
      canceled = true
    })
  }
})

// 播放/暂停状态（初始化完成前不驱动，避免时序竞争）
watchEffect(() => {
  if (!initialized.value) return
  if (props.playing !== undefined) {
    if (props.playing) {
      playerRef.value?.resume()
    } else {
      playerRef.value?.pause()
    }
  } else playerRef.value?.resume()
})

// 对齐锚点
watchEffect(() => {
  if (props.alignAnchor !== undefined) playerRef.value?.setAlignAnchor(props.alignAnchor)
})

// 隐藏已播放歌词行
watchEffect(() => {
  if (props.hidePassedLines !== undefined)
    playerRef.value?.setHidePassedLines(props.hidePassedLines)
})

// 对齐位置
watchEffect(() => {
  if (props.alignPosition !== undefined) playerRef.value?.setAlignPosition(props.alignPosition)
})

// 弹簧动画
watchEffect(() => {
  playerRef.value?.setEnableSpring(props.enableSpring)
})

// 模糊效果
watchEffect(() => {
  playerRef.value?.setEnableBlur(props.enableBlur)
})

// 缩放效果
watchEffect(() => {
  playerRef.value?.setEnableScale(props.enableScale)
})

// 歌词行数据（初始化完成前缓存，完成后统一应用）
watchEffect(() => {
  const lines = props.lyricLines
  if (lines === undefined) return
  const player = playerRef.value
  if (!player || !initialized.value) {
    pendingLyricLines = lines
    return
  }
  player.setLyricLines(lines, latestTime)
})

// AMLL 歌词优化配置（修改后需重新 setLyricLines 才对当前歌词生效）
watch(
  () => props.optimizeOptions,
  (options) => {
    const player = playerRef.value
    if (!player || !options) return
    player.setOptimizeOptions({ ...options })
    if (initialized.value && props.lyricLines) {
      player.setLyricLines(props.lyricLines, latestTime)
    }
  },
  { deep: true }
)

// 当前播放时间
watch(
  () => props.currentTime,
  (time, oldTime) => {
    if (time === undefined) return
    latestTime = time
    const isSeek = oldTime !== undefined && Math.abs(time - oldTime) > 1000
    playerRef.value?.setCurrentTime(time, isSeek)
  },
  { immediate: true }
)

// 渐变宽度
watchEffect(() => {
  if (props.wordFadeWidth !== undefined) playerRef.value?.setWordFadeWidth(props.wordFadeWidth)
})

// X 轴弹簧参数
watchEffect(() => {
  if (props.linePosXSpringParams !== undefined)
    playerRef.value?.setLinePosXSpringParams(props.linePosXSpringParams)
})

// Y 轴弹簧参数
watchEffect(() => {
  if (props.linePosYSpringParams !== undefined)
    playerRef.value?.setLinePosYSpringParams(props.linePosYSpringParams)
})

// 缩放弹簧参数
watchEffect(() => {
  if (props.lineScaleSpringParams !== undefined)
    playerRef.value?.setLineScaleSpringParams(props.lineScaleSpringParams)
})

// 暴露给父组件
defineExpose<LyricPlayerRef>({
  lyricPlayer: playerRef as unknown as Ref<LyricPlayerBase | undefined>,
  wrapperEl: wrapperRef as unknown as Readonly<ShallowRef<HTMLDivElement | null>>
})
</script>

<template>
  <div ref="wrapperRef" class="amll-wrapper" :class="{ 'is-visible': contentVisible }">
    <Teleport v-if="bottomLineEl" :to="bottomLineEl">
      <slot name="bottom-line" />
    </Teleport>
  </div>
</template>

<style scoped>
.amll-wrapper {
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 120ms cubic-bezier(0.2, 0, 0, 1);
}

.amll-wrapper.is-visible {
  opacity: 1;
}
</style>
