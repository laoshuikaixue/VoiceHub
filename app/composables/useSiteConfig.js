import { computed, ref, readonly } from 'vue'

const defaultSubmissionGuidelines = `1. 投稿时无需加入书名号
2. 除DJ外，其他类型歌曲均接收（包括小语种）
3. 禁止投递含有违规内容的歌曲
4. 点播的歌曲将由管理员进行审核
5. 审核通过后将安排在播放时段播出
6. 提交即表明我已阅读投稿须知并已知该歌曲有概率无法播出
7. 本系统仅提供音乐搜索和播放管理功能，不存储任何音乐文件。所有音乐内容均来自第三方音乐平台，版权归原平台及版权方所有。用户点歌时请确保遵守相关音乐平台的服务条款，尊重音乐作品版权。我们鼓励用户支持正版音乐，在官方平台购买和收听喜爱的音乐作品。
8. 最终解释权归广播站所有`

// 站点配置状态
const siteConfig = ref({
  siteTitle: '',
  siteLogoUrl: '',
  schoolLogoHomeUrl: '',
  schoolLogoPrintUrl: '',
  siteDescription: '',
  submissionGuidelines: '',
  icpNumber: ''
})

const isLoaded = ref(false)
const isLoading = ref(false)

export const useSiteConfig = () => {
  // 获取站点配置
  const fetchSiteConfig = async () => {
    if (isLoading.value) return

    try {
      isLoading.value = true

      const response = await fetch('/api/site-config')
      if (!response.ok) {
        throw new Error('获取站点配置失败')
      }

      const data = await response.json()
      siteConfig.value = data
      isLoaded.value = true
    } catch (error) {
      console.error('获取站点配置失败:', error)

      // 使用默认配置
      siteConfig.value = {
        siteTitle: '校园广播站点歌系统',
        siteLogoUrl: '/favicon.ico',
        schoolLogoHomeUrl: '',
        schoolLogoPrintUrl: '',
        siteDescription: '校园广播站点歌系统 - 让你的声音被听见',
        submissionGuidelines: defaultSubmissionGuidelines,
        icpNumber: '',
        enableReplayRequests: false
      }
      isLoaded.value = true
    } finally {
      isLoading.value = false
    }
  }

  // 计算属性
  const siteTitle = computed(() => siteConfig.value.siteTitle || '校园广播站点歌系统')
  const logoUrl = computed(() => siteConfig.value.siteLogoUrl || '/favicon.ico')
  const schoolLogoHomeUrl = computed(() => siteConfig.value.schoolLogoHomeUrl || '')
  const schoolLogoPrintUrl = computed(() => siteConfig.value.schoolLogoPrintUrl || '')
  const description = computed(
    () => siteConfig.value.siteDescription || '校园广播站点歌系统 - 让你的声音被听见'
  )
  const guidelines = computed(
    () => siteConfig.value.submissionGuidelines || defaultSubmissionGuidelines
  )
  const icp = computed(() => siteConfig.value.icpNumber || '')
  const enableReplayRequests = computed(() => siteConfig.value.enableReplayRequests || false)
  const smtpEnabled = computed(() => !!siteConfig.value.smtpEnabled)

  // 初始化配置（仅在客户端执行）
  const initSiteConfig = async () => {
    if (typeof window !== 'undefined' && !isLoaded.value) {
      await fetchSiteConfig()
    }
  }

  // 刷新配置
  const refreshSiteConfig = async () => {
    isLoaded.value = false
    await fetchSiteConfig()
  }

  return {
    siteConfig: readonly(siteConfig),
    isLoaded: readonly(isLoaded),
    isLoading: readonly(isLoading),
    siteTitle,
    logoUrl,
    schoolLogoHomeUrl,
    schoolLogoPrintUrl,
    description,
    guidelines,
    icp,
    enableReplayRequests,
    smtpEnabled,
    fetchSiteConfig,
    initSiteConfig,
    refreshSiteConfig
  }
}
