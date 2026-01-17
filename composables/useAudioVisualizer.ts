import { ref, onUnmounted } from 'vue'

// WeakMap to store MediaElementAudioSourceNode for each HTMLMediaElement
// This prevents creating multiple sources for the same element which throws an error
const sourceCache = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>()

// Global AudioContext (lazy initialized) to avoid "too many AudioContexts" error
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
                console.warn('AudioContext not supported')
                return
            }
            audioContext.value = ctx

            // Create Analyser
            if (!analyser.value) {
                analyser.value = ctx.createAnalyser()
                analyser.value.fftSize = 256 // Adjust resolution as needed
                analyser.value.smoothingTimeConstant = 0.8
            }

            // Get or create source
            if (sourceCache.has(audioElement)) {
                source.value = sourceCache.get(audioElement)!
            } else {
                // Connect source to analyser and destination (to hear sound)
                // Note: If the audio element is already connected to another destination (default),
                // creating a MediaElementSource will disconnect it from the default output.
                // So we must connect it back to ctx.destination.
                
                // However, be careful if other parts of the app also do this.
                // Assuming we are the only one doing visualization for now.
                
                // Check if crossOrigin is set, needed for some CDN audio
                if (!audioElement.crossOrigin) {
                    audioElement.crossOrigin = 'anonymous'
                }
                
                const src = ctx.createMediaElementSource(audioElement)
                sourceCache.set(audioElement, src)
                source.value = src
                
                // Connect chain: Source -> Analyser -> Destination
                src.connect(analyser.value)
                analyser.value.connect(ctx.destination)
            }
            
            // If source was cached, we might need to reconnect if the graph was broken
            // But usually the graph persists. 
            // If we are in a new component instance using the same cached source, 
            // we just need to ensure the analyser is connected.
            
            // Connect source -> analyser -> destination
            if (source.value && analyser.value) {
                 try {
                     source.value.connect(analyser.value)
                     analyser.value.connect(ctx.destination)
                 } catch (e) {
                     // Already connected or other error
                 }
            }

            isInitialized.value = true
            
            // Resume context if suspended (browser policy)
            if (ctx.state === 'suspended') {
                ctx.resume()
            }

        } catch (error) {
            console.error('Failed to initialize audio visualizer:', error)
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
                console.error('Error during dispose cleanup:', e)
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
