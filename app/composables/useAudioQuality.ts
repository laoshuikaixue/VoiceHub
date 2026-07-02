import { computed, readonly, ref, watch } from 'vue'
import { useLocale } from '~/utils/locale'

// 音质配置
export const QUALITY_OPTIONS = {
  netease: [
    { value: 2, key: 'standard' },
    { value: 4, key: 'neteaseHq' },
    { value: 5, key: 'neteaseSq' },
    { value: 6, key: 'neteaseHiRes' },
    { value: 9, key: 'neteaseMaster' }
  ],
  tencent: [
    { value: 4, key: 'standard' },
    { value: 8, key: 'tencentHq' },
    { value: 10, key: 'tencentSq' },
    { value: 11, key: 'tencentHiRes' },
    { value: 14, key: 'tencentMaster' }
  ],
  bilibili: [{ value: 1, key: 'bilibiliDefault' }]
}

// 默认音质设置
const DEFAULT_QUALITY = {
  netease: 4, // HQ极高 (320k)
  tencent: 8, // HQ高音质
  bilibili: 1
}

// 全局音质状态，确保所有组件共享同一个状态
let globalAudioQuality: any = null
// 网易云登录状态，全局共享
const isNeteaseLoggedIn = ref(false)
let isLoginStatusInitialized = false

export function useAudioQuality() {
  const { ui } = useLocale()
  const locale = computed(() => ui.value?.audioQuality || {})

  // 检查网易云登录状态
  const checkNeteaseLoginStatus = () => {
    if (typeof window === 'undefined') return
    const cookie = localStorage.getItem('netease_cookie')
    isNeteaseLoggedIn.value = !!cookie
  }

  // 从localStorage读取音质设置
  const getStoredQuality = () => {
    try {
      const stored = localStorage.getItem('audioQuality')
      return stored ? JSON.parse(stored) : DEFAULT_QUALITY
    } catch {
      return DEFAULT_QUALITY
    }
  }

  // 使用全局状态，确保所有组件共享
  if (!globalAudioQuality) {
    globalAudioQuality = ref(getStoredQuality())

    // 监听状态变化，自动保存到localStorage
    watch(
      globalAudioQuality,
      (newValue) => {
        try {
          localStorage.setItem('audioQuality', JSON.stringify(newValue))
        } catch (error) {
          console.error('[audioQuality] Failed to save quality settings:', error)
        }
      },
      { deep: true }
    )
  }

  // 初始化登录状态监听
  if (!isLoginStatusInitialized && typeof window !== 'undefined') {
    checkNeteaseLoginStatus()
    window.addEventListener('storage', (e) => {
      if (e.key === 'netease_cookie') {
        checkNeteaseLoginStatus()
      }
    })
    isLoginStatusInitialized = true
  }

  const audioQuality = globalAudioQuality

  // 保存音质设置到localStorage
  const saveQuality = (platform: string, quality: number) => {
    audioQuality.value[platform] = quality
    // localStorage保存已经通过watch自动处理
  }

  // 获取指定平台的音质设置
  const getQuality = (platform: string) => {
    // 处理 netease-podcast 别名
    if (platform === 'netease-podcast') {
      platform = 'netease'
    }

    return audioQuality.value[platform] || DEFAULT_QUALITY[platform]
  }

  // 获取指定平台的音质选项
  const getQualityOptions = (platform: string) => {
    // 处理 netease-podcast 别名
    if (platform === 'netease-podcast') {
      platform = 'netease'
    }

    return (QUALITY_OPTIONS[platform] || []).map((option) => ({
      ...option,
      label: locale.value?.options?.[option.key]?.label || option.key,
      description: locale.value?.options?.[option.key]?.description || ''
    }))
  }

  // 获取音质标签
  const getQualityLabel = (platform: string, quality: number) => {
    // 处理 netease-podcast 别名
    if (platform === 'netease-podcast') {
      platform = 'netease'
    }
    const options = getQualityOptions(platform)
    const option = options.find((opt) => opt.value === quality)
    return option ? option.label : locale.value.unknown
  }

  // 获取音质描述
  const getQualityDescription = (platform: string, quality: number) => {
    // 处理 netease-podcast 别名
    if (platform === 'netease-podcast') {
      platform = 'netease'
    }
    const options = getQualityOptions(platform)
    const option = options.find((opt) => opt.value === quality)
    return option ? option.description : ''
  }

  // 计算属性：当前音质设置的可读文本
  const currentQualityText = computed(() => {
    const netease = getQualityLabel('netease', getQuality('netease'))
    const tencent = getQualityLabel('tencent', getQuality('tencent'))
    return {
      netease,
      tencent
    }
  })

  return {
    audioQuality: readonly(audioQuality),
    saveQuality,
    getQuality,
    getQualityOptions,
    getQualityLabel,
    getQualityDescription,
    currentQualityText,
    QUALITY_OPTIONS,
    DEFAULT_QUALITY,
    checkNeteaseLoginStatus,
    isNeteaseLoggedIn: readonly(isNeteaseLoggedIn)
  }
}
