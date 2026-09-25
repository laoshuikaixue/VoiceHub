import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import type {
  AbstractBaseRenderer,
  BackgroundRender,
  MeshGradientRenderer
} from '@applemusic-like-lyrics/core'
import { getSizedCoverUrl } from '~/utils/url'
import { useTheme } from '~/composables/useTheme'
import { applyCoverTheme, extractCoverTheme } from '~/utils/cover-theme'

const isClient = typeof window !== 'undefined'
let CoreModule: typeof import('@applemusic-like-lyrics/core') | null = null

const CORS_PROXY_PATH = '/api/proxy/image'

const needsCorsProxy = (url: string): boolean => {
  try {
    const u = new URL(url)
    const h = u.hostname.toLowerCase()
    return (
      h.endsWith('.y.qq.com') ||
      h === 'y.qq.com' ||
      h.endsWith('.y.gtimg.cn') ||
      h === 'y.gtimg.cn' ||
      h.endsWith('.music.126.net') ||
      h === 'music.126.net' ||
      h.endsWith('.musicapp.migu.cn') ||
      h === 'd.musicapp.migu.cn' ||
      h.endsWith('.migu.cn')
    )
  } catch {
    return false
  }
}

const toProxiedUrl = (url: string): string => {
  if (!needsCorsProxy(url)) return url
  return `${CORS_PROXY_PATH}?url=${encodeURIComponent(url)}`
}

// 背景仅用于取色与模糊，加载尺寸化后的封面可避免超大原图被图片代理拒绝
const toBackgroundCoverUrl = (url: string): string => toProxiedUrl(getSizedCoverUrl(url))

// 渲染器加载字符串封面失败时只记日志并重试，不会抛错，因此先自行加载 <img> 以感知失败
const loadCoverImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (image.naturalWidth > 0) resolve(image)
      else reject(new Error('封面图像解码失败'))
    }
    image.onerror = () => reject(new Error('封面图像加载失败'))
    image.src = url
  })

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
  const isMotionPaused = ref(false)
  const hasRenderError = ref(false)
  const currentCoverUrl = ref('')
  const loadedCoverUrl = ref('')
  /** 最近一次成功加载的封面元素，兼作取色输入（已按 CORS 匿名加载） */
  const coverImage = shallowRef<HTMLImageElement | null>(null)
  const { isDark } = useTheme()

  const refreshCoverTheme = async () => {
    if (!isClient) return
    const image = coverImage.value
    if (!image) {
      applyCoverTheme(null)
      return
    }
    const Core = await ensureCoreModule()
    if (!Core) return
    applyCoverTheme(extractCoverTheme(Core, image, isDark.value))
  }

  // 主题明暗切换时文字色的明度目标随之改变，需用同一张封面重新计算
  watch(isDark, () => void refreshCoverTheme())

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

  const syncRendererMotion = () => {
    const renderer = backgroundRenderer.value
    if (!renderer) return

    if (!isRendering.value) {
      renderer.pause()
      return
    }

    renderer.setStaticMode(false)

    if (!config.value.dynamic) {
      renderer.setFlowSpeed(0)
      renderer.pause()
      return
    }

    renderer.setFlowSpeed(isMotionPaused.value ? 0 : config.value.flowSpeed)
    renderer.resume()
  }

  const applyRendererState = async () => {
    const renderer = backgroundRenderer.value
    if (!renderer) return

    renderer.setFPS(config.value.fps ?? 30)
    renderer.setRenderScale(config.value.renderScale ?? 0.5)
    renderer.setHasLyric(config.value.hasLyric ?? true)

    const cover = currentCoverUrl.value
    if (cover !== loadedCoverUrl.value) {
      try {
        if (cover) {
          const image = await loadCoverImage(toBackgroundCoverUrl(cover))
          coverImage.value = image
          await renderer.setAlbum(image, false)
        } else {
          coverImage.value = null
          await renderer.setAlbum('', false)
        }
        if (currentCoverUrl.value === cover) {
          loadedCoverUrl.value = cover
          hasRenderError.value = false
          await refreshCoverTheme()
        }
      } catch (error) {
        if (currentCoverUrl.value === cover) {
          hasRenderError.value = true
        }
        console.error('应用封面到背景失败:', error)
      }
    }

    syncRendererMotion()
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
      // 兜底层直连封面（不经图片代理），渲染器失败时仍可显示模糊封面
      const blurUrl = getSizedCoverUrl(coverUrl)
      coverBlurElement.value.style.backgroundImage = blurUrl ? `url(${blurUrl})` : ''
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
    isRendering.value = true
    isMotionPaused.value = false
    syncRendererMotion()
  }

  const stopRender = () => {
    const renderer = backgroundRenderer.value
    if (!renderer) return

    isRendering.value = false
    isMotionPaused.value = false
    renderer.setFlowSpeed(0)
    renderer.pause()
  }

  const pauseRender = () => {
    isMotionPaused.value = true
    if (!backgroundRenderer.value) return
    syncRendererMotion()
  }

  const resumeRender = () => {
    isMotionPaused.value = false
    if (!backgroundRenderer.value) return
    syncRendererMotion()
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
    isMotionPaused.value = false
    containerElement.value = null
    coverBlurElement.value = null
    currentCoverUrl.value = ''
    loadedCoverUrl.value = ''
    coverImage.value = null
    applyCoverTheme(null)
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
