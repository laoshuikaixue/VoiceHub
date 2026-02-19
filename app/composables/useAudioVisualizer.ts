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
    if (isInitialized.value || !audioElement) return

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

      // 获取或创建源
      if (sourceCache.has(audioElement)) {
        source.value = sourceCache.get(audioElement)!
      } else {
        // 连接源到分析器和目标（以听到声音）
        // 注意：如果音频元素已连接到其他目标（默认），
        // 创建 MediaElementSource 会断开其与默认输出的连接。
        // 所以必须将其连回 ctx.destination。

        // 假设目前只有我们在做可视化。

        // 检查是否设置了 crossOrigin，CDN 音频需要
        // 注意：在 src 设置之前应设置 crossOrigin="anonymous"。
        if (!audioElement.crossOrigin) {
          audioElement.crossOrigin = 'anonymous'
        }

        try {
          const src = ctx.createMediaElementSource(audioElement)
          sourceCache.set(audioElement, src)
          source.value = src

          // 连接链：源 -> 分析器 -> 目标
          src.connect(analyser.value)
          analyser.value.connect(ctx.destination)
        } catch (e) {
          console.error('创建 MediaElementSource 失败，可能是 CORS 问题:', e)
          // 如果 CORS 失败，无法可视化，但必须确保音频继续播放。
          // 因为 createMediaElementSource 失败，默认连接应该没断，
          // 所以这里不做额外处理。
          isInitialized.value = false
          return
        }
      }

      // 如果源是缓存的，可能需要重新连接
      // 连接源 -> 分析器 -> 目标
      if (source.value && analyser.value) {
        try {
          source.value.connect(analyser.value)
          analyser.value.connect(ctx.destination)
        } catch (e) {
          // 已连接或其他错误
        }
      }

      isInitialized.value = true

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
