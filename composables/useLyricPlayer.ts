import { ref, computed, onUnmounted, watch } from 'vue'

export interface LyricRenderConfig {
  fontSize: number
  lineHeight: number
  activeColor: string
  inactiveColor: string
  passedColor: string
  enableBlur: boolean
  enableScale: boolean
  enableSpring: boolean
  alignPosition: number
}

export interface LyricLine {
  startTime: number
  endTime: number
  words: Array<{
    startTime: number
    endTime: number
    word: string
    romanWord?: string
  }>
  translatedLyric?: string
  romanLyric?: string
  isBG?: boolean
  isDuet?: boolean
}

export const useLyricPlayer = () => {
  const lyricPlayer = ref<any | null>(null)
  const containerElement = ref<HTMLElement | null>(null)
  const isInitialized = ref(false)
  const currentLyrics = ref<LyricLine[]>([])
  const currentTime = ref(0)
  const isPlaying = ref(false)

  // 默认配置
  const defaultConfig: LyricRenderConfig = {
    fontSize: 24,
    lineHeight: 1.6,
    activeColor: '#ffffff',
    inactiveColor: 'rgba(255,255,255,0.6)',
    passedColor: 'rgba(255,255,255,0.4)',
    enableBlur: true,
    enableScale: true,
    enableSpring: true,
    alignPosition: 0.5
  }

  const config = ref<LyricRenderConfig>({ ...defaultConfig })

  // 初始化歌词播放器
  const initializeLyricPlayer = async (container: HTMLElement) => {
    if (isInitialized.value || !container) return

    try {
      containerElement.value = container
      console.log('[useLyricPlayer] 开始初始化歌词播放器，容器:', container)
      
      // 动态导入 @applemusic-like-lyrics/core
      const { LyricPlayer } = await import('@applemusic-like-lyrics/core')
      console.log('[useLyricPlayer] LyricPlayer 类:', LyricPlayer)
      
      if (!LyricPlayer) {
        throw new Error('LyricPlayer 类未找到')
      }
      
      lyricPlayer.value = new LyricPlayer()
      console.log('[useLyricPlayer] LyricPlayer 实例创建成功')
      console.log('[useLyricPlayer] 歌词播放器方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(lyricPlayer.value)))
      
      // 设置容器
      container.appendChild(lyricPlayer.value.getElement())
      console.log('[useLyricPlayer] 容器设置完成')
      
      // 应用初始配置
      if (lyricPlayer.value.setConfig) {
        lyricPlayer.value.setConfig(defaultConfig)
      }
      console.log('[useLyricPlayer] 配置应用完成')
      
      isInitialized.value = true
      console.log('[useLyricPlayer] 歌词播放器初始化成功')
    } catch (error) {
      console.error('[useLyricPlayer] 歌词播放器初始化失败:', error)
      // 如果初始化失败，创建一个简单的占位符
      createFallbackPlayer(container)
    }
  }

  // 创建备用播放器
  const createFallbackPlayer = (container: HTMLElement) => {
    container.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: rgba(255, 255, 255, 0.6);
        font-size: 1.1rem;
        text-align: center;
      ">
        <div>
          <div style="margin-bottom: 1rem;">🎵</div>
          <div>歌词播放器加载中...</div>
        </div>
      </div>
    `
    isInitialized.value = true
  }

  // 应用配置
  const applyConfig = async () => {
    if (!lyricPlayer.value || !lyricPlayer.value.setLyricLineStyle) return

    try {
      // 设置字体大小和行高
      lyricPlayer.value.setLyricLineStyle({
        fontSize: config.value.fontSize,
        lineHeight: config.value.lineHeight
      })

      // 设置颜色
      lyricPlayer.value.setLyricLineColor({
        active: config.value.activeColor,
        inactive: config.value.inactiveColor,
        passed: config.value.passedColor
      })

      // 设置效果
      lyricPlayer.value.setLyricLineEffect({
        blur: config.value.enableBlur,
        scale: config.value.enableScale,
        spring: config.value.enableSpring
      })

      // 设置对齐位置
      lyricPlayer.value.setAlignPosition(config.value.alignPosition)

    } catch (error) {
      console.error('应用歌词配置失败:', error)
    }
  }

  // 更新配置
  const updateConfig = async (newConfig: Partial<LyricRenderConfig>) => {
    config.value = { ...config.value, ...newConfig }
    await applyConfig()
  }

  // 设置歌词数据
  const setLyrics = async (lyrics: LyricLine[]) => {
    if (!lyricPlayer.value) {
      console.error('[useLyricPlayer] 歌词播放器未初始化')
      return
    }
    
    if (!lyricPlayer.value.setLyricLines) {
      console.error('[useLyricPlayer] 歌词播放器缺少 setLyricLines 方法')
      return
    }

    try {
      console.log('[useLyricPlayer] 开始设置歌词数据，行数:', lyrics.length)
      console.log('[useLyricPlayer] 第一行歌词示例:', lyrics[0])
      
      currentLyrics.value = lyrics
      await lyricPlayer.value.setLyricLines(lyrics)
      console.log('[useLyricPlayer] 歌词数据设置成功')
    } catch (error) {
      console.error('[useLyricPlayer] 设置歌词数据失败:', error)
    }
  }

  // 更新播放时间
  const updateTime = (time: number) => {
    if (!lyricPlayer.value || !lyricPlayer.value.setCurrentTime) return

    try {
      currentTime.value = time
      // 确保时间是整数毫秒，符合 AMLL 要求
      const timeInMs = Math.floor(time)
      lyricPlayer.value.setCurrentTime(timeInMs)
      console.log('[useLyricPlayer] 更新播放时间:', timeInMs, 'ms')
    } catch (error) {
      console.error('[useLyricPlayer] 更新播放时间失败:', error)
    }
  }

  // 更新歌词播放器（类似于 applemusic-like-lyrics-page-main 中的 update 方法）
  const update = (deltaTime: number) => {
    if (!lyricPlayer.value || !lyricPlayer.value.update) return

    try {
      lyricPlayer.value.update(deltaTime)
    } catch (error) {
      console.error('[useLyricPlayer] 更新歌词播放器失败:', error)
    }
  }

  // 设置播放状态
  const setPlayingState = (playing: boolean) => {
    if (!lyricPlayer.value) return

    try {
      isPlaying.value = playing
      if (playing && lyricPlayer.value.resume) {
        lyricPlayer.value.resume()
      } else if (!playing && lyricPlayer.value.pause) {
        lyricPlayer.value.pause()
      }
    } catch (error) {
      console.error('设置播放状态失败:', error)
    }
  }

  // 跳转到指定时间
  const seekTo = (time: number) => {
    if (!lyricPlayer.value || !lyricPlayer.value.setCurrentTime) return

    try {
      // 确保时间是整数毫秒，符合 AMLL 要求，并标记为 seek 操作
      const timeInMs = Math.floor(time)
      lyricPlayer.value.setCurrentTime(timeInMs, true)
      currentTime.value = time
      console.log('[useLyricPlayer] 跳转到时间:', timeInMs, 'ms')
    } catch (error) {
      console.error('跳转时间失败:', error)
    }
  }

  // 清理资源
  const dispose = () => {
    if (lyricPlayer.value && lyricPlayer.value.dispose) {
      try {
        lyricPlayer.value.dispose()
        lyricPlayer.value = null
      } catch (error) {
        console.error('清理歌词播放器失败:', error)
      }
    }
    isInitialized.value = false
    containerElement.value = null
  }

  // 监听配置变化
  watch(config, async (newConfig) => {
    await applyConfig()
  }, { deep: true })

  // 组件卸载时清理
  onUnmounted(() => {
    dispose()
  })

  return {
    // 状态
    lyricPlayer: computed(() => lyricPlayer.value),
    isInitialized: computed(() => isInitialized.value),
    currentLyrics: computed(() => currentLyrics.value),
    currentTime: computed(() => currentTime.value),
    isPlaying: computed(() => isPlaying.value),
    update,
    config: computed(() => config.value),

    // 方法
    initializeLyricPlayer,
    updateConfig,
    setLyrics,
    updateTime,
    setPlayingState,
    seekTo,
    dispose,
    applyConfig
  }
}