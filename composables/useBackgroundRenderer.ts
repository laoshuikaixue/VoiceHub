import { ref, computed, onMounted, onUnmounted } from 'vue'
import { BackgroundRender, EplorRenderer, PixiRenderer } from '@applemusic-like-lyrics/core'

export interface BackgroundConfig {
  type: 'gradient' | 'cover'
  dynamic: boolean
  flowSpeed: number
  colorMask: boolean
  maskColor: string
  maskOpacity: number
}

export const useBackgroundRenderer = () => {
  const backgroundRenderer = ref<BackgroundRender<PixiRenderer | EplorRenderer> | null>(null)
  const containerElement = ref<HTMLElement | null>(null)
  const coverBlurElement = ref<HTMLElement | null>(null)
  const isInitialized = ref(false)
  const isRendering = ref(false)

  // 默认配置
  const defaultConfig: BackgroundConfig = {
    type: 'gradient',
    dynamic: true,
    flowSpeed: 4,
    colorMask: false,
    maskColor: '#000000',
    maskOpacity: 30
  }

  const config = ref<BackgroundConfig>({ ...defaultConfig })

  // 初始化背景渲染器
  const initializeBackground = async (container: HTMLElement) => {
    if (isInitialized.value || !container) return

    try {
      containerElement.value = container
      
      // 创建 Eplor 渲染器（替代 MeshGradientRenderer）
      backgroundRenderer.value = BackgroundRender.new(EplorRenderer)
      
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

  // 应用配置
  const applyConfig = async () => {
    if (!backgroundRenderer.value) return

    try {
      if (config.value.type === 'gradient') {
        // 显示渐变背景
        backgroundRenderer.value.setVisible(true)
        
        // 设置动态模式
        if (config.value.dynamic) {
          backgroundRenderer.value.setStaticMode(false)
          backgroundRenderer.value.setFlowSpeed(config.value.flowSpeed)
        } else {
          backgroundRenderer.value.setStaticMode(true)
        }
        
        // 隐藏封面背景
        if (coverBlurElement.value) {
          coverBlurElement.value.style.display = 'none'
        }
      } else {
        // 隐藏渐变背景
        backgroundRenderer.value.setVisible(false)
        
        // 显示封面背景
        if (coverBlurElement.value) {
          coverBlurElement.value.style.display = 'block'
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

  // 设置封面背景
  const setCoverBackground = (coverUrl: string) => {
    if (!coverBlurElement.value) return

    try {
      coverBlurElement.value.style.backgroundImage = `url(${coverUrl})`
      coverBlurElement.value.style.backgroundSize = 'cover'
      coverBlurElement.value.style.backgroundPosition = 'center'
      coverBlurElement.value.style.filter = 'blur(20px)'
      coverBlurElement.value.style.transform = 'scale(1.1)'
      
      // 添加遮罩层
      const overlay = coverBlurElement.value.querySelector('.cover-blur-overlay') as HTMLElement
      if (overlay) {
        overlay.style.background = 'rgba(0, 0, 0, 0.5)'
      }
    } catch (error) {
      console.error('设置封面背景失败:', error)
    }
  }

  // 设置封面模糊元素
  const setCoverBlurElement = (element: HTMLElement) => {
    coverBlurElement.value = element
  }

  // 设置渐变颜色（基于歌曲封面）
  const setGradientFromCover = async (coverUrl: string) => {
    if (!backgroundRenderer.value) return

    try {
      // 使用 setAlbum 方法设置背景图片
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