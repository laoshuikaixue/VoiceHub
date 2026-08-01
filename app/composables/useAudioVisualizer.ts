import { ref, onUnmounted } from 'vue'

// WeakMap 用于存储每个 HTMLMediaElement 的 MediaElementAudioSourceNode
// 防止为同一元素创建多个源导致报错
const sourceCache = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>()

// 全局 AudioContext（懒加载）以避免"AudioContext 过多"错误
let globalAudioContext: AudioContext | null = null

export const useAudioVisualizer = () => {
  const audioContext = ref<AudioContext | null>(null)
  const analyser = ref<AnalyserNode | null>(null)
  const source = ref<MediaElementAudioSourceNode | null>(null)
  const isInitialized = ref(false)

  const getAudioContext = () => {
    if (!globalAudioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) {
        globalAudioContext = new AudioContextClass()
      }
    }
    return globalAudioContext
  }

  const initialize = (audioElement: HTMLMediaElement) => {
    if (!audioElement) return

    // 如果已经初始化过同一个音频元素，跳过
    if (isInitialized.value && source.value && sourceCache.has(audioElement)) {
      return
    }

    try {
      const ctx = getAudioContext()
      if (!ctx) {
        console.warn('不支持 AudioContext')
        return
      }
      audioContext.value = ctx

      // 创建分析器
      if (!analyser.value) {
        analyser.value = ctx.createAnalyser()
        analyser.value.fftSize = 256 // 根据需要调整分辨率
        analyser.value.smoothingTimeConstant = 0.8
      }

      // 检查是否已经有缓存的源
      if (sourceCache.has(audioElement)) {
        const cachedSource = sourceCache.get(audioElement)!
        source.value = cachedSource

        // 尝试重新连接
        try {
          // 先断开所有现有连接
          try {
            cachedSource.disconnect()
          } catch (e) {
            // 可能已经断开
          }

          // 重新连接：源 -> 分析器 -> 目标
          cachedSource.connect(analyser.value)
          // 先断开分析器现有输出，避免重复连接导致信号叠加
          try {
            analyser.value.disconnect()
          } catch (e) {
            // 可能尚未连接
          }
          analyser.value.connect(ctx.destination)
          isInitialized.value = true
        } catch (e) {
          console.warn('[AudioVisualizer] 重新连接失败，可能是不支持 CORS 的音频源，跳过可视化')
          // 如果重新连接失败，尝试恢复到直接输出
          try {
            cachedSource.disconnect()
            cachedSource.connect(ctx.destination)
          } catch (e2) {
            console.error('[AudioVisualizer] 恢复直接输出也失败:', e2)
          }
          isInitialized.value = false
        }
      } else {
        // 创建新的 MediaElementSource
        // 注意：这会断开音频元素的默认输出连接
        try {
          const src = ctx.createMediaElementSource(audioElement)
          sourceCache.set(audioElement, src)
          source.value = src

          // 连接链：源 -> 分析器 -> 目标
          src.connect(analyser.value)
          // 先断开分析器现有输出，避免重复连接导致信号叠加
          try {
            analyser.value.disconnect()
          } catch (e) {
            // 可能尚未连接
          }
          analyser.value.connect(ctx.destination)

          isInitialized.value = true
        } catch (e) {
          console.warn('[AudioVisualizer] 创建 MediaElementSource 失败，可能是不支持 CORS 的音频源（如咪咕音乐），跳过可视化')
          // createMediaElementSource 失败时，音频元素的默认连接应该保持不变
          // 不需要额外处理
          isInitialized.value = false
          return
        }
      }

      // 如果上下文被挂起（浏览器策略），恢复它
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
    } catch (error) {
      console.error('初始化音频可视化失败:', error)
    }
  }

  const getFrequencyData = () => {
    if (!analyser.value) return new Uint8Array(0)
    const dataArray = new Uint8Array(analyser.value.frequencyBinCount)
    analyser.value.getByteFrequencyData(dataArray)
    return dataArray
  }

  const dispose = () => {
    // 当组件卸载或关闭时，我们需要清理分析器连接
    // 但必须保持音频播放，所以需要将 source 直接连回 destination
    if (source.value) {
      try {
        // 断开所有连接（包括连向 analyser 的）
        source.value.disconnect()

        // 恢复直接连接到输出设备，确保声音继续播放
        if (audioContext.value) {
          source.value.connect(audioContext.value.destination)
        } else if (globalAudioContext) {
          source.value.connect(globalAudioContext.destination)
        }
      } catch (e) {
        console.error('清理过程出错:', e)
      }
    }
    isInitialized.value = false
  }

  onUnmounted(() => {
    dispose()
  })

  return {
    initialize,
    getFrequencyData,
    dispose,
    isInitialized,
    analyser
  }
}
