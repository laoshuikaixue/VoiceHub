import { computed, onUnmounted, ref, shallowRef } from 'vue'
import type {
  AbstractBaseRenderer,
  BackgroundRender,
  MeshGradientRenderer
} from '@applemusic-like-lyrics/core'

const isClient = typeof window !== 'undefined'
let CoreModule: typeof import('@applemusic-like-lyrics/core') | null = null

const CORS_PROXY_PATH = '/api/proxy/image'

const needsCorsProxy = (url: string): boolean => {
  try {
    const u = new URL(url)
    const h = u.hostname.toLowerCase()
    return (
      h.endsWith('.y.qq.com') || h === 'y.qq.com' ||
      h.endsWith('.y.gtimg.cn') || h === 'y.gtimg.cn' ||
      h.endsWith('.music.126.net') || h === 'music.126.net'
    )
  } catch {
    return false
  }
}

const toProxiedUrl = (url: string): string => {
  if (!needsCorsProxy(url)) return url
  return `${CORS_PROXY_PATH}?url=${encodeURIComponent(url)}`
}

const ensureCoreModule = async () => {
  if (!isClient) return null

  if (!CoreModule) {
    CoreModule = await import('@applemusic-like-lyrics/core')
    await import('@applemusic-like-lyrics/core/style.css')
  }

  return CoreModule
}

export interface BackgroundConfig {
  type: 'gradient' | 'cover'
  dynamic: boolean
  flowSpeed: number
  fps?: number
  renderScale?: number
  hasLyric?: boolean
}

export const useBackgroundRenderer = () => {
  const backgroundRenderer = shallowRef<
    BackgroundRender<MeshGradientRenderer> | AbstractBaseRenderer | null
  >(null)
  const containerElement = ref<HTMLElement | null>(null)
  const coverBlurElement = ref<HTMLElement | null>(null)
  const isInitialized = ref(false)
  const isRendering = ref(false)
  const hasRenderError = ref(false)
  const currentCoverUrl = ref('')
  const loadedCoverUrl = ref('')

  const config = ref<BackgroundConfig>({
    type: 'gradient',
    dynamic: true,
    flowSpeed: 2,
    fps: 30,
    renderScale: 0.5,
    hasLyric: true
  })

  const applyCanvasStyle = (canvas: HTMLElement) => {
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.style.zIndex = '0'
    canvas.style.pointerEvents = 'none'
  }

  const applyRendererState = async () => {
    const renderer = backgroundRenderer.value
    if (!renderer) return

    renderer.setFPS(config.value.fps ?? 30)
    renderer.setFlowSpeed(config.value.flowSpeed)
    renderer.setRenderScale(config.value.renderScale ?? 0.5)
    renderer.setHasLyric(config.value.hasLyric ?? true)
    renderer.setStaticMode(!config.value.dynamic)

    const cover = currentCoverUrl.value
    if (cover !== loadedCoverUrl.value) {
      try {
        if (cover) {
          await renderer.setAlbum(toProxiedUrl(cover), false)
        }
        if (currentCoverUrl.value === cover) {
          loadedCoverUrl.value = cover
          hasRenderError.value = false
        }
      } catch (error) {
        if (currentCoverUrl.value === cover) {
          hasRenderError.value = true
        }
        console.error('应用封面到背景失败:', error)
      }
    }

    if (isRendering.value && config.value.dynamic) {
      renderer.resume()
    } else {
      renderer.pause()
    }
  }

  const initializeBackground = async (container: HTMLElement) => {
    if (!container) return
    if (isInitialized.value && containerElement.value === container) {
      await applyRendererState()
      return
    }

    dispose()
    containerElement.value = container
    hasRenderError.value = false

    try {
      const Core = await ensureCoreModule()
      if (!Core) return

      const renderer = Core.BackgroundRender.new(Core.MeshGradientRenderer)
      backgroundRenderer.value = renderer

      const canvas = renderer.getElement()
      applyCanvasStyle(canvas)
      container.appendChild(canvas)

      isInitialized.value = true
      await applyRendererState()
    } catch (error) {
      hasRenderError.value = true
      console.error('背景渲染器初始化失败:', error)
      dispose()
    }
  }

  const updateConfig = async (newConfig: Partial<BackgroundConfig>) => {
    config.value = { ...config.value, ...newConfig }
    await applyRendererState()
  }

  const setCoverBackground = async (coverUrl: string) => {
    currentCoverUrl.value = coverUrl || ''

    if (coverBlurElement.value) {
      coverBlurElement.value.style.backgroundImage = coverUrl ? `url(${coverUrl})` : ''
    }

    await applyRendererState()
  }

  const setCoverBlurElement = (element: HTMLElement | null) => {
    coverBlurElement.value = element
  }

  const setGradientFromCover = async (coverUrl: string) => {
    await setCoverBackground(coverUrl)
  }

  const startRender = () => {
    const renderer = backgroundRenderer.value
    if (!renderer) return

    isRendering.value = true
    renderer.setStaticMode(!config.value.dynamic)

    if (config.value.dynamic) {
      renderer.resume()
    }
  }

  const stopRender = () => {
    const renderer = backgroundRenderer.value
    if (!renderer) return

    isRendering.value = false
    renderer.pause()
  }

  const pauseRender = () => {
    backgroundRenderer.value?.pause()
  }

  const resumeRender = () => {
    if (!config.value.dynamic) return
    backgroundRenderer.value?.resume()
  }

  function dispose() {
    const renderer = backgroundRenderer.value

    if (renderer) {
      try {
        renderer.pause()
        renderer.dispose()
      } catch (error) {
        console.error('清理背景渲染器失败:', error)
      }
    }

    backgroundRenderer.value = null
    isInitialized.value = false
    isRendering.value = false
    containerElement.value = null
    coverBlurElement.value = null
    currentCoverUrl.value = ''
    loadedCoverUrl.value = ''
  }

  onUnmounted(() => {
    dispose()
  })

  return {
    backgroundRenderer: computed(() => backgroundRenderer.value),
    isInitialized: computed(() => isInitialized.value),
    isRendering: computed(() => isRendering.value),
    hasRenderError: computed(() => hasRenderError.value),
    config: computed(() => config.value),
    initializeBackground,
    updateConfig,
    setCoverBackground,
    setCoverBlurElement,
    setGradientFromCover,
    startRender,
    stopRender,
    pauseRender,
    resumeRender,
    dispose,
    applyConfig: applyRendererState
  }
}
