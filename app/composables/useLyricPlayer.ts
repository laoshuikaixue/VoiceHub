import { computed, onUnmounted, ref, watch } from 'vue'
import { useTheme } from '~/composables/useTheme'

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

export interface PlayerLyricLine {
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
  const currentLyrics = ref<PlayerLyricLine[]>([])
  const currentTime = ref(0)
  const isPlaying = ref(false)
  const onLineClickCallback = ref<((seconds: number) => void) | null>(null)

  // 默认配置
  const defaultConfig: LyricRenderConfig = {
    fontSize: 24,
    lineHeight: 1.6,
    activeColor: 'var(--text-primary)',
    inactiveColor: 'var(--overlay-60)',
    passedColor: 'var(--overlay-40)',
    enableBlur: true,
    enableScale: true,
    enableSpring: true,
    alignPosition: 0.5
  }

  // 将 config 中的 CSS 变量替换为实际颜色值（Canvas 无法直接解析 CSS 变量）
  const resolveCssVariables = (cfg: LyricRenderConfig): LyricRenderConfig => {
    const style = getComputedStyle(document.documentElement)
    const resolve = (color: string, fallback = '#ffffff') => {
      if (!color.startsWith('var(')) return color
      const varName = color.match(/var\(--([a-z0-9-]+)\)/)?.[1]
      if (!varName) return color
      const resolved = style.getPropertyValue(varName).trim()
      return resolved || fallback
    }
    return {
      ...cfg,
      inactiveColor: resolve(cfg.inactiveColor, '#cccccc'),
      passedColor: resolve(cfg.passedColor, '#888888'),
      activeColor: resolve(cfg.activeColor, '#ffffff')
    }
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
      console.log(
        '[useLyricPlayer] 歌词播放器方法:',
        Object.getOwnPropertyNames(Object.getPrototypeOf(lyricPlayer.value))
      )

      // 设置容器
      container.appendChild(lyricPlayer.value.getElement())
      console.log('[useLyricPlayer] 容器设置完成')

      // 应用初始配置（解析 CSS 变量为实际颜色值）
      if (lyricPlayer.value.setConfig) {
        lyricPlayer.value.setConfig(resolveCssVariables(defaultConfig))
      }
      console.log('[useLyricPlayer] 配置应用完成')

      // 注册行点击事件，实现交互跳转
      if (lyricPlayer.value && lyricPlayer.value.addEventListener) {
        lyricPlayer.value.addEventListener('line-click', (evt: any) => {
          try {
            const startMs =
              (evt?.line?.getLine ? evt.line.getLine().startTime : evt?.line?.startTime) ??
              evt?.detail?.startTime ??
              0
            const seconds = (startMs || 0) / 1000
            if (onLineClickCallback.value) {
              onLineClickCallback.value(seconds)
            }
          } catch (e) {
            console.warn('[useLyricPlayer] 处理 line-click 事件失败:', e)
          }
        })
      }
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
        color: var(--overlay-60);
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
      // 解析 CSS 变量为实际颜色值（Canvas 无法直接解析）
      const resolved = resolveCssVariables(config.value)
      
      // 设置字体大小和行高
      lyricPlayer.value.setLyricLineStyle({
        fontSize: resolved.fontSize,
        lineHeight: resolved.lineHeight
      })

      // 设置颜色
      lyricPlayer.value.setLyricLineColor({
        active: resolved.activeColor,
        inactive: resolved.inactiveColor,
        passed: resolved.passedColor
      })

      // 设置效果
      lyricPlayer.value.setLyricLineEffect({
        blur: resolved.enableBlur,
        scale: resolved.enableScale,
        spring: resolved.enableSpring
      })

      // 设置对齐位置
      lyricPlayer.value.setAlignPosition(resolved.alignPosition)
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
  const setLyrics = async (lyrics: PlayerLyricLine[]) => {
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

      // 强制中断当前动画 - 先暂停播放状态
      const wasPlaying = isPlaying.value
      if (lyricPlayer.value.pause) {
        lyricPlayer.value.pause()
      }

      // 立即跳转到目标时间，第二个参数 true 表示这是一个 seek 操作
      lyricPlayer.value.setCurrentTime(timeInMs, true)

      // 如果之前是播放状态，恢复播放状态
      if (wasPlaying && lyricPlayer.value.resume) {
        // 使用短暂延迟确保时间跳转完成后再恢复播放状态
        setTimeout(() => {
          if (lyricPlayer.value && lyricPlayer.value.resume) {
            lyricPlayer.value.resume()
          }
        }, 50) // 50ms 延迟确保跳转完成
      }

      currentTime.value = time
      console.log('[useLyricPlayer] 跳转到时间:', timeInMs, 'ms')
    } catch (error) {
      console.error('跳转时间失败:', error)
    }
  }

  // 对外暴露：注册歌词行点击回调
  const onLineClick = (cb: (seconds: number) => void) => {
    onLineClickCallback.value = cb
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
  watch(
    config,
    async (newConfig) => {
      await applyConfig()
    },
    { deep: true }
  )

  // 监听主题切换：响应式监听 currentTheme 变化，重新解析 CSS 变量颜色
  const { currentTheme } = useTheme()
  watch(
    () => currentTheme.value,
    async () => {
      await applyConfig()
    }
  )

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
    applyConfig,
    onLineClick
  }
}
