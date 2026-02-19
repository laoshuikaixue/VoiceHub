import { computed, readonly, ref, watch } from 'vue'

// 音质配置
export const QUALITY_OPTIONS = {
  netease: [
    { value: 2, label: '标准', description: '适合流量有限的情况' },
    { value: 4, label: 'HQ极高', description: '高品质音乐体验' },
    { value: 5, label: 'SQ无损', description: '无损音质，文件较大' },
    { value: 6, label: 'Hi-Res', description: '高解析度无损' },
    { value: 9, label: '超清母带', description: '最高音质' }
  ],
  tencent: [
    { value: 4, label: '标准', description: '适合流量有限的情况' },
    { value: 8, label: 'HQ高音质', description: '高品质音乐体验' },
    { value: 10, label: 'SQ无损', description: '无损音质，文件较大' },
    { value: 11, label: 'Hi-Res', description: '高解析度音质' },
    { value: 14, label: '臻品母带2.0', description: '最高音质' }
  ],
  bilibili: [{ value: 1, label: '普通', description: '默认音质' }]
}

// 默认音质设置
const DEFAULT_QUALITY = {
  netease: 4, // HQ极高 (320k)
  tencent: 8, // HQ高音质
  bilibili: 1
}

// 全局音质状态，确保所有组件共享同一个状态
let globalAudioQuality: any = null

export function useAudioQuality() {
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
          console.error('保存音质设置失败:', error)
        }
      },
      { deep: true }
    )
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
    return QUALITY_OPTIONS[platform] || []
  }

  // 获取音质标签
  const getQualityLabel = (platform: string, quality: number) => {
    // 处理 netease-podcast 别名
    if (platform === 'netease-podcast') {
      platform = 'netease'
    }
    const options = getQualityOptions(platform)
    const option = options.find((opt) => opt.value === quality)
    return option ? option.label : '未知音质'
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
    const netease = getQualityLabel('netease', audioQuality.value.netease)
    const tencent = getQualityLabel('tencent', audioQuality.value.tencent)
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
    DEFAULT_QUALITY
  }
}
