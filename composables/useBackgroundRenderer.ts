import { ref, computed, onMounted, onUnmounted } from 'vue'
import '@applemusic-like-lyrics/core/style.css'
import { BackgroundRender, MeshGradientRenderer, PixiRenderer } from '@applemusic-like-lyrics/core'

export interface BackgroundConfig {
  type: 'gradient' | 'cover'
  dynamic: boolean
  flowSpeed: number
  colorMask: boolean
  maskColor: string
  maskOpacity: number
}

export const useBackgroundRenderer = () => {
  const backgroundRenderer = ref<BackgroundRender<PixiRenderer | MeshGradientRenderer> | null>(null)
  const containerElement = ref<HTMLElement | null>(null)
  const coverBlurElement = ref<HTMLElement | null>(null)
  const isInitialized = ref(false)
  const isRendering = ref(false)

  // 当前渲染器类型与封面地址
  const currentRenderer = ref<'gradient' | 'cover'>('gradient')
  const currentCoverUrl = ref<string>('')

  // 默认配置
  const defaultConfig: BackgroundConfig = {
    type: 'gradient',
    dynamic: true,
    flowSpeed: 4,
    colorMask: true,
    maskColor: '#000000',
    maskOpacity: 45
  }

  const config = ref<BackgroundConfig>({ ...defaultConfig })

  // 初始化背景渲染器
  const initializeBackground = async (container: HTMLElement) => {
    if (isInitialized.value || !container) return

    try {
      containerElement.value = container
      
      // 创建 MeshGradient 渲染器
      backgroundRenderer.value = BackgroundRender.new(MeshGradientRenderer)
      currentRenderer.value = 'gradient'
      
      // 将渲染器的 canvas 元素添加到容器中
      const canvas = backgroundRenderer.value.getElement()
      container.appendChild(canvas)
      
      // 设置 canvas 样式
      canvas.style.position = 'absolute'
      canvas.style.top = '0'
      canvas.style.left = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.zIndex = '-1'
      
      // 应用初始配置
      await applyConfig()
      
      isInitialized.value = true
      console.log('背景渲染器初始化成功')
    } catch (error) {
      console.error('背景渲染器初始化失败:', error)
    }
  }

  // 切换底层渲染器
  const switchRenderer = (type: 'gradient' | 'cover') => {
    if (!containerElement.value) return
    const container = containerElement.value
    const oldCanvas = backgroundRenderer.value?.getElement()

    try {
      if (oldCanvas) {
        container.removeChild(oldCanvas)
      }
      // 释放旧实例
      backgroundRenderer.value?.dispose()

      // 创建对应渲染器
      backgroundRenderer.value = type === 'gradient'
        ? BackgroundRender.new(MeshGradientRenderer)
        : BackgroundRender.new(PixiRenderer)

      currentRenderer.value = type

      // 挂载新 canvas
      const canvas = backgroundRenderer.value.getElement()
      container.appendChild(canvas)
      canvas.style.position = 'absolute'
      canvas.style.top = '0'
      canvas.style.left = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.zIndex = '-1'

    } catch (error) {
      console.error('切换背景渲染器失败:', error)
    }
  }

  // 应用配置
  const applyConfig = async () => {
    if (!backgroundRenderer.value) return

    try {
      if (config.value.type === 'gradient') {
        // 如有必要切换回 MeshGradientRenderer
        if (currentRenderer.value !== 'gradient') {
          switchRenderer('gradient')
        }

        // 显示渐变背景
        backgroundRenderer.value.setVisible(true)

        // 根据配置设置动态/静态
        backgroundRenderer.value.setStaticMode(!config.value.dynamic)
        backgroundRenderer.value.setFlowSpeed(config.value.flowSpeed)

        // 使用当前封面作为颜色来源
        if (currentCoverUrl.value) {
          await backgroundRenderer.value.setAlbum(currentCoverUrl.value)
        }

        // 隐藏旧的封面模糊元素（改为统一使用 AMLL 背景）
        if (coverBlurElement.value) {
          coverBlurElement.value.style.display = 'none'
        }

        // 清除可能存在的滤镜
        backgroundRenderer.value.getElement().style.filter = ''
        backgroundRenderer.value.getElement().style.transform = ''

      } else {
        // 封面动态模糊：使用 PixiRenderer 承载封面并应用模糊
        if (currentRenderer.value !== 'cover') {
          switchRenderer('cover')
        }

        backgroundRenderer.value.setVisible(true)

        // 设置封面并根据需要动态流动
        if (currentCoverUrl.value) {
          await backgroundRenderer.value.setAlbum(currentCoverUrl.value)
        }
        backgroundRenderer.value.setStaticMode(!config.value.dynamic)
        backgroundRenderer.value.setFlowSpeed(config.value.flowSpeed)

        // 为画布应用模糊与轻微放大效果
        const canvas = backgroundRenderer.value.getElement()
        canvas.style.filter = 'blur(40px)'
        canvas.style.transform = 'scale(1.1)'

        // 不再使用独立的 CSS 封面模糊层
        if (coverBlurElement.value) {
          coverBlurElement.value.style.display = 'none'
        }
      }

      // 应用颜色蒙版
      if (config.value.colorMask) {
        const maskOpacity = config.value.maskOpacity / 100
        backgroundRenderer.value.setColorMask(config.value.maskColor, maskOpacity)
      } else {
        backgroundRenderer.value.clearColorMask()
      }

    } catch (error) {
      console.error('应用背景配置失败:', error)
    }
  }

  // 更新配置
  const updateConfig = async (newConfig: Partial<BackgroundConfig>) => {
    config.value = { ...config.value, ...newConfig }
    await applyConfig()
  }

  // 设置封面背景（同时更新 AMLL 背景封面来源）
  const setCoverBackground = async (coverUrl: string) => {
    currentCoverUrl.value = coverUrl

    // 兼容旧的独立封面模糊元素设置（作为备选，不再显示）
    if (coverBlurElement.value) {
      try {
        coverBlurElement.value.style.backgroundImage = `url(${coverUrl})`
        coverBlurElement.value.style.backgroundSize = 'cover'
        coverBlurElement.value.style.backgroundPosition = 'center'
        coverBlurElement.value.style.filter = 'blur(20px)'
        coverBlurElement.value.style.transform = 'scale(1.1)'
        const overlay = coverBlurElement.value.querySelector('.cover-blur-overlay') as HTMLElement
        if (overlay) {
          overlay.style.background = 'rgba(0, 0, 0, 0.5)'
        }
      } catch (error) {
        console.error('设置封面背景失败:', error)
      }
    }

    // 将封面应用到渲染器
    if (backgroundRenderer.value) {
      try {
        await backgroundRenderer.value.setAlbum(coverUrl)
      } catch (error) {
        console.error('应用封面到背景失败:', error)
      }
    }
  }

  // 设置封面模糊元素（旧实现备用，不默认使用）
  const setCoverBlurElement = (element: HTMLElement) => {
    coverBlurElement.value = element
  }

  // 设置渐变颜色（基于歌曲封面）
  const setGradientFromCover = async (coverUrl: string) => {
    if (!backgroundRenderer.value) return
    currentCoverUrl.value = coverUrl

    try {
      await backgroundRenderer.value.setAlbum(coverUrl)
    } catch (error) {
      console.error('设置背景图片失败:', error)
    }
  }

  // 开始渲染
  const startRender = () => {
    if (!backgroundRenderer.value || isRendering.value) return

    try {
      backgroundRenderer.value.start()
      isRendering.value = true
      console.log('背景渲染已开始')
    } catch (error) {
      console.error('开始背景渲染失败:', error)
    }
  }

  // 停止渲染
  const stopRender = () => {
    if (!backgroundRenderer.value || !isRendering.value) return

    try {
      backgroundRenderer.value.stop()
      isRendering.value = false
      console.log('背景渲染已停止')
    } catch (error) {
      console.error('停止背景渲染失败:', error)
    }
  }

  // 暂停/恢复渲染
  const pauseRender = () => {
    if (!backgroundRenderer.value) return
    
    try {
      backgroundRenderer.value.pause()
    } catch (error) {
      console.error('暂停背景渲染失败:', error)
    }
  }

  const resumeRender = () => {
    if (!backgroundRenderer.value) return
    
    try {
      backgroundRenderer.value.resume()
    } catch (error) {
      console.error('恢复背景渲染失败:', error)
    }
  }

  // 清理资源
  const dispose = () => {
    if (backgroundRenderer.value) {
      try {
        if (isRendering.value) {
          backgroundRenderer.value.stop()
        }
        backgroundRenderer.value.dispose()
        backgroundRenderer.value = null
      } catch (error) {
        console.error('清理背景渲染器失败:', error)
      }
    }
    isInitialized.value = false
    isRendering.value = false
    containerElement.value = null
    coverBlurElement.value = null
    currentCoverUrl.value = ''
    currentRenderer.value = 'gradient'
  }

  // 组件卸载时清理
  onUnmounted(() => {
    dispose()
  })

  return {
    // 状态
    backgroundRenderer: computed(() => backgroundRenderer.value),
    isInitialized: computed(() => isInitialized.value),
    isRendering: computed(() => isRendering.value),
    config: computed(() => config.value),

    // 方法
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
    applyConfig
  }
}