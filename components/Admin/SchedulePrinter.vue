<template>
  <div class="schedule-printer">
    <div class="printer-header">
      <h2>打印排期</h2>
      <p class="subtitle">自定义打印设置，预览并导出排期表</p>
    </div>

    <!-- 权限检查 -->
    <div v-if="!canPrintSchedule" class="permission-denied">
      <div class="permission-icon">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/>
          <path d="m15 9-6 6"/>
          <path d="m9 9 6 6"/>
        </svg>
      </div>
      <h3>权限不足</h3>
      <p>您没有打印排期的权限，请联系管理员获取相应权限。</p>
    </div>

    <div v-else class="printer-layout">
      <!-- 左侧设置面板 -->
      <div class="settings-panel">
        <div class="setting-group">
          <h3>打印设置</h3>

          <!-- 纸张大小 -->
          <div class="setting-item">
            <label>纸张大小</label>
            <select v-model="settings.paperSize" class="setting-select">
              <option value="A4">A4 (210×297mm)</option>
              <option value="A3">A3 (297×420mm)</option>
              <option value="Letter">Letter (216×279mm)</option>
              <option value="Legal">Legal (216×356mm)</option>
            </select>
          </div>

          <!-- 页面方向 -->
          <div class="setting-item">
            <label>页面方向</label>
            <select v-model="settings.orientation" class="setting-select">
              <option value="portrait">纵向</option>
              <option value="landscape">横向</option>
            </select>
          </div>

          <!-- 日期范围 -->
          <div class="setting-item">
            <label>日期范围</label>
            <div class="date-range">
              <input
                  v-model="settings.startDate"
                  class="date-input"
                  type="date"
              />
              <span>至</span>
              <input
                  v-model="settings.endDate"
                  class="date-input"
                  type="date"
              />
            </div>
            <!-- 日期快捷选择 -->
            <div class="date-shortcuts">
              <button class="shortcut-btn" @click="setDateRange('today')">今天</button>
              <button class="shortcut-btn" @click="setDateRange('tomorrow')">明天</button>
              <button class="shortcut-btn" @click="setDateRange('thisWeek')">本周</button>
              <button class="shortcut-btn" @click="setDateRange('nextWeek')">下周</button>
            </div>
          </div>

          <!-- 内容选择 -->
          <div class="setting-item">
            <label>显示内容</label>
            <div class="content-options">
              <label class="checkbox-item">
                <input v-model="settings.showCover" type="checkbox"/>
                <span>歌曲封面</span>
              </label>
              <label class="checkbox-item">
                <input v-model="settings.showTitle" type="checkbox"/>
                <span>歌曲名</span>
              </label>
              <label class="checkbox-item">
                <input v-model="settings.showArtist" type="checkbox"/>
                <span>歌手</span>
              </label>
              <label class="checkbox-item">
                <input v-model="settings.showRequester" type="checkbox"/>
                <span>投稿人</span>
              </label>
              <label class="checkbox-item">
                <input v-model="settings.showVotes" type="checkbox"/>
                <span>热度</span>
              </label>

              <label class="checkbox-item">
                <input v-model="settings.showSequence" type="checkbox"/>
                <span>播放顺序</span>
              </label>
              <label v-if="schoolLogoPrintUrl" class="checkbox-item">
                <input v-model="settings.showSchoolLogo" type="checkbox"/>
                <span>学校Logo</span>
              </label>
            </div>
          </div>

          <!-- 备注设置 -->
          <div class="setting-group">
            <label class="setting-label">备注</label>
            <textarea
                v-model="settings.remark"
                class="remark-input"
                placeholder="请输入备注信息（可选）"
                rows="3"
            ></textarea>
          </div>

        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <button class="btn btn-secondary" @click="refreshPreview">
            <svg class="btn-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M23 4v6h-6"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            刷新预览
          </button>
          <button :disabled="isPrinting" class="btn btn-primary" @click="printSchedule">
            <svg class="btn-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="6,9 6,2 18,2 18,9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect height="8" width="12" x="6" y="14"/>
            </svg>
            {{ isPrinting ? '打印中...' : '打印' }}
          </button>
          <button :disabled="isExporting" class="btn btn-success" @click="exportPDF">
            <svg class="btn-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" x2="8" y1="13" y2="13"/>
              <line x1="16" x2="8" y1="17" y2="17"/>
            </svg>
            {{ isExporting ? '导出中...' : '导出PDF' }}
          </button>
          <button :disabled="isExportingImage" class="btn btn-warning" @click="exportImage">
            <svg class="btn-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect height="18" rx="2" ry="2" width="18" x="3" y="3"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
            {{ isExportingImage ? '导出中...' : '导出长图' }}
          </button>
        </div>
      </div>

      <!-- 右侧预览面板 -->
      <div class="preview-panel">
        <div class="preview-header">
          <h3>打印预览</h3>
          <div class="preview-info">
            <span>{{ filteredSchedules.length }} 首歌曲</span>
            <span v-if="schedules.length === 0" class="debug-info">无排期数据</span>
            <span v-else-if="filteredSchedules.length === 0" class="debug-info">过滤后无数据</span>
          </div>
        </div>

        <div
            ref="previewContent"
            :class="[
            `paper-${settings.paperSize.toLowerCase()}`,
            `orientation-${settings.orientation}`
          ]"
            class="preview-content"
        >
          <div class="print-page">
            <!-- 页面头部 -->
            <div class="page-header">
              <div class="logo-section">
                <img :src="logoUrl" alt="VoiceHub Logo" class="logo"/>
                <!-- 竖线分割 -->
                <div class="logo-divider"></div>
                <!-- 学校logo -->
                <img
                    v-if="settings.showSchoolLogo && schoolLogoPrintUrl"
                    :src="schoolLogoPrintUrl"
                    alt="学校Logo"
                    class="school-logo-print"
                />
                <div class="title-section">
                  <h1>{{ siteTitle }}</h1>
                  <h2>广播排期表</h2>
                </div>
              </div>
              <div class="date-info">
                <div class="date-range-display">{{ formatDateRange() }}</div>
              </div>
            </div>

            <!-- 排期内容 -->
            <div class="schedule-content">
              <!-- 无数据提示 -->
              <div v-if="filteredSchedules.length === 0" class="no-data-message">
                <div class="no-data-icon">
                  <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <rect height="18" rx="2" ry="2" width="18" x="3" y="4"/>
                    <line x1="16" x2="16" y1="2" y2="6"/>
                    <line x1="8" x2="8" y1="2" y2="6"/>
                    <line x1="3" x2="21" y1="10" y2="10"/>
                  </svg>
                </div>
                <h3>暂无排期数据</h3>
                <p v-if="schedules.length === 0">
                  请先在"排期管理"中添加排期，然后再来打印。
                </p>
                <p v-else>
                  当前日期范围内没有排期数据，请调整日期范围或检查排期设置。
                </p>
              </div>

              <div class="grouped-content">
                <div
                    v-for="(dateGroup, date) in groupedSchedules"
                    :key="date"
                    class="date-group"
                >
                  <h3 class="group-title">
                    {{ formatDate(date) }}
                    <span class="group-count">({{ dateGroup.allSchedules.length }}首)</span>
                  </h3>


                  <!-- 检查是否需要显示时段分组 -->
                  <div v-if="hasMultiplePlayTimes(dateGroup)" class="playtime-groups">
                    <div
                        v-for="(playTimeData, playTime) in dateGroup.playTimes"
                        :key="playTime"
                        class="playtime-group"
                    >
                      <h4 class="playtime-title">
                        {{ playTime }}
                        <span class="playtime-count">({{ playTimeData.schedules.length }}首)</span>
                      </h4>
                      <div class="schedule-list">
                        <div
                            v-for="schedule in playTimeData.schedules"
                            :key="schedule.id"
                            class="schedule-item"
                        >
                          <ScheduleItemPrint :schedule="schedule" :settings="settings"/>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 如果只有一个时段或没有时段，直接显示歌曲列表 -->
                  <div v-else class="schedule-list">
                    <div
                        v-for="schedule in dateGroup.allSchedules"
                        :key="schedule.id"
                        class="schedule-item"
                    >
                      <ScheduleItemPrint :schedule="schedule" :settings="settings"/>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 页面底部 -->
            <div class="page-footer">
              <div class="footer-left">
                <span>生成时间：{{ new Date().toLocaleString() }}</span>
                <span v-if="settings.remark" class="remark-text">备注：{{ settings.remark }}</span>
              </div>
              <span class="footer-right">Powered By LaoShui @ 2025 | VoiceHub 广播管理系统</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {computed, onMounted, ref, watch} from 'vue'
import {useRuntimeConfig} from '#app'
import {usePermissions} from '~/composables/usePermissions'
import {useSiteConfig} from '~/composables/useSiteConfig'
import {convertToHttps} from '~/utils/url'
import html2canvas from 'html2canvas'

// 导入子组件
import ScheduleItemPrint from './ScheduleItemPrint.vue'

// 权限检查
const {canPrintSchedule} = usePermissions()

// 站点配置
const {siteTitle, schoolLogoPrintUrl, initSiteConfig} = useSiteConfig()

// 配置
const config = useRuntimeConfig()

// Logo URL处理，避免开发模式路径问题
const logoUrl = computed(() => {
  if (process.client) {
    return new URL('/images/logo.png', window.location.origin).href
  }
  return '/images/logo.png'
})

// 响应式数据
const schedules = ref([])
const loading = ref(false)
const isExporting = ref(false)
const isExportingImage = ref(false)
const isPrinting = ref(false)
const previewContent = ref(null)

// 打印设置
const settings = ref({
  paperSize: 'A4',
  orientation: 'portrait',
  startDate: '',
  endDate: '',
  showCover: false,
  showTitle: true,
  showArtist: true,
  showRequester: true,
  showVotes: true,
  showSequence: true,
  showSchoolLogo: false,
  remark: ''
})

// 计算属性
const itemsPerPage = computed(() => {
  const baseItems = settings.value.paperSize === 'A4' ? 20 : 30
  return settings.value.orientation === 'landscape' ? Math.floor(baseItems * 1.4) : baseItems
})

const filteredSchedules = computed(() => {
  let filtered = schedules.value

  if (settings.value.startDate) {
    const startDate = new Date(settings.value.startDate)
    startDate.setHours(0, 0, 0, 0)
    filtered = filtered.filter(s => {
      const scheduleDate = new Date(s.playDate)
      scheduleDate.setHours(0, 0, 0, 0)
      return scheduleDate >= startDate
    })
  }

  if (settings.value.endDate) {
    const endDate = new Date(settings.value.endDate)
    endDate.setHours(23, 59, 59, 999)
    filtered = filtered.filter(s => {
      const scheduleDate = new Date(s.playDate)
      return scheduleDate <= endDate
    })
  }

  return filtered.sort((a, b) => {
    const dateCompare = new Date(a.playDate) - new Date(b.playDate)
    if (dateCompare !== 0) return dateCompare
    return (a.sequence || 0) - (b.sequence || 0)
  })
})

// 格式化播出时段显示文本
const formatPlayTimeDisplay = (playTime) => {
  if (!playTime) return '未指定时段'

  let displayText = playTime.name

  // 根据时间参数决定显示格式
  if (playTime.startTime && playTime.endTime) {
    displayText += ` (${playTime.startTime}-${playTime.endTime})`
  } else if (playTime.startTime) {
    displayText += ` (${playTime.startTime}开始)`
  } else if (playTime.endTime) {
    displayText += ` (${playTime.endTime}结束)`
  }

  return displayText
}

// 获取播出时段的排序权重
const getPlayTimeSortWeight = (playTime) => {
  if (!playTime || !playTime.startTime) return 9999 // 未指定时段排在最后

  // 将时间转换为分钟数进行排序
  const [hours, minutes] = playTime.startTime.split(':').map(Number)
  return hours * 60 + minutes
}

const groupedSchedules = computed(() => {
  const groups = {}

  filteredSchedules.value.forEach(schedule => {
    // 处理日期，确保正确提取日期部分
    const scheduleDate = new Date(schedule.playDate)
    const dateKey = scheduleDate.toISOString().split('T')[0]

    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: dateKey,
        playTimes: {},
        allSchedules: []
      }
    }

    groups[dateKey].allSchedules.push(schedule)

    // 按播出时段分组
    const playTimeKey = formatPlayTimeDisplay(schedule.playTime)

    if (!groups[dateKey].playTimes[playTimeKey]) {
      groups[dateKey].playTimes[playTimeKey] = {
        schedules: [],
        playTime: schedule.playTime // 保存原始playTime对象用于排序
      }
    }
    groups[dateKey].playTimes[playTimeKey].schedules.push(schedule)
  })

  // 排序处理
  const sortedGroups = {}
  Object.keys(groups).sort().forEach(dateKey => {
    const dateGroup = groups[dateKey]

    // 对每个时段内的歌曲按序号排序
    Object.keys(dateGroup.playTimes).forEach(playTimeKey => {
      dateGroup.playTimes[playTimeKey].schedules.sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
    })

    // 对时段按时间顺序排序
    const sortedPlayTimes = {}
    const playTimeKeys = Object.keys(dateGroup.playTimes).sort((a, b) => {
      const playTimeA = dateGroup.playTimes[a].playTime
      const playTimeB = dateGroup.playTimes[b].playTime

      const weightA = getPlayTimeSortWeight(playTimeA)
      const weightB = getPlayTimeSortWeight(playTimeB)

      return weightA - weightB
    })

    playTimeKeys.forEach(key => {
      sortedPlayTimes[key] = dateGroup.playTimes[key]
    })

    // 重新计算allSchedules，按时段顺序排列
    const sortedAllSchedules = []
    playTimeKeys.forEach(key => {
      sortedAllSchedules.push(...dateGroup.playTimes[key].schedules)
    })

    sortedGroups[dateKey] = {
      ...dateGroup,
      playTimes: sortedPlayTimes,
      allSchedules: sortedAllSchedules
    }
  })

  return sortedGroups
})

// 判断是否需要显示时段分组
const hasMultiplePlayTimes = (dateGroup) => {
  const playTimeKeys = Object.keys(dateGroup.playTimes)
  // 如果有多个时段，显示分组
  if (playTimeKeys.length > 1) return true
  // 如果只有一个时段且不是"未指定时段"，显示分组
  if (playTimeKeys.length === 1 && playTimeKeys[0] !== '未指定时段') return true
  // 其他情况不显示分组
  return false
}

// 方法
const loadSchedules = async () => {
  loading.value = true
  try {
    // 添加 bypass_cache=true 参数，确保获取最新的排期数据
    const data = await $fetch('/api/songs/public?bypass_cache=true')
    // API直接返回排期数组，不是包装在schedules属性中
    schedules.value = Array.isArray(data) ? data : []
    console.log('加载的排期数据:', schedules.value.length, '条')
    console.log('排期数据示例:', schedules.value[0])

    // 如果没有数据，显示提示
    if (schedules.value.length === 0) {
      if (window.$showNotification) {
        window.$showNotification('当前没有排期数据，请先在排期管理中添加排期', 'info')
      }
    }
  } catch (error) {
    console.error('加载排期失败:', error)
    if (window.$showNotification) {
      window.$showNotification('加载排期失败: ' + error.message, 'error')
    }
  } finally {
    loading.value = false
  }
}

const refreshPreview = async () => {
  await loadSchedules()
  if (window.$showNotification) {
    window.$showNotification('预览已刷新', 'success')
  }
}

const printSchedule = async () => {
  if (isPrinting.value) return // 防止重复点击

  isPrinting.value = true
  try {
    if (window.$showNotification) {
      window.$showNotification('正在准备打印...', 'info')
    }

    // 复用PDF导出逻辑，但用于打印
    await exportPDFForPrint()
  } catch (error) {
    console.error('打印失败:', error)
    if (window.$showNotification) {
      window.$showNotification('打印失败: ' + error.message, 'error')
    }
  } finally {
    // 延迟重置状态，给用户足够的时间看到"打印中"状态
    setTimeout(() => {
      isPrinting.value = false
    }, 2000)
  }
}

// 专门用于打印的PDF生成函数
const exportPDFForPrint = async () => {
  // 动态导入PDF库
  const html2pdf = (await import('html2pdf.js')).default

  if (!previewContent.value) {
    throw new Error('预览内容未找到')
  }

  // 获取预览页面元素
  const printPage = previewContent.value.querySelector('.print-page')
  if (!printPage) {
    throw new Error('打印页面元素未找到')
  }

  // 克隆预览内容，保持原有样式
  const clonedPage = printPage.cloneNode(true)

  // 创建PDF渲染容器
  const pdfContainer = document.createElement('div')
  pdfContainer.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    z-index: -1;
    background: white;
    color: black;
    box-sizing: border-box;
  `

  // 调整克隆页面的样式
  clonedPage.style.cssText = `
    background: white !important;
    color: black !important;
    box-sizing: border-box !important;
  `

  // 确保所有子元素的颜色和样式正确
  const allElements = clonedPage.querySelectorAll('*')
  allElements.forEach(el => {
    if (el.style) {
      // 强制设置文字颜色为黑色
      el.style.color = 'black !important'

      // 保持背景为白色
      el.style.background = 'white !important'
      el.style.backgroundColor = 'white !important'
    }

    // 特别处理页面元素的背景
    if (el.classList && (
        el.classList.contains('print-page') ||
        el.classList.contains('page-header') ||
        el.classList.contains('page-footer') ||
        el.classList.contains('schedule-content'))) {
      el.style.background = 'white !important'
      el.style.backgroundColor = 'white !important'
    }
  })

  pdfContainer.appendChild(clonedPage)
  document.body.appendChild(pdfContainer)

  // 预处理图片
  await preprocessImages(clonedPage)

  try {
    // 等待渲染完成
    await new Promise(resolve => setTimeout(resolve, 500))

    // 使用html2pdf.js生成PDF
    const worker = html2pdf()
    const options = {
      margin: 10,
      filename: `广播排期表_${formatDateRange()}_${new Date().toISOString().split('T')[0]}.pdf`,
      image: {type: 'jpeg', quality: 0.9},
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      },
      jsPDF: {
        unit: 'mm',
        format: settings.value.paperSize.toLowerCase(),
        orientation: settings.value.orientation === 'landscape' ? 'l' : 'p'
      },
      pagebreak: {mode: ['css', 'legacy']}
    }

    // 生成PDF并打印
    await worker.from(clonedPage).set(options).toPdf().get('pdf').then(pdf => {
      // 生成PDF的Blob用于打印
      const pdfBlob = pdf.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)

      // 移除临时容器
      document.body.removeChild(pdfContainer)

      // 创建新窗口显示PDF并打印
      const printWindow = window.open(pdfUrl, '_blank')
      if (!printWindow) {
        throw new Error('无法打开打印窗口')
      }

      // 等待PDF加载完成后自动打印
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print()
        }, 1000)
      }
    })
  } catch (error) {
    // 移除临时容器
    if (document.body.contains(pdfContainer)) {
      document.body.removeChild(pdfContainer)
    }
    throw error
  }
}

// 预下载图片并转换为base64
const downloadImageAsBase64 = async (url) => {
  try {
    // 使用我们的代理API来获取图片，并指定较低的图片质量
    const proxyUrl = `/api/proxy/image?url=${encodeURIComponent(url)}&quality=60`
    const response = await fetch(proxyUrl)

    if (!response.ok) throw new Error('图片代理下载失败')

    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.warn('图片下载失败:', url, error)
    return null
  }
}

// 预处理所有图片
const preprocessImages = async (element) => {
  const images = element.querySelectorAll('img')
  const imagePromises = Array.from(images).map(async (img) => {
    if (img.src && !img.src.startsWith('data:')) {
      try {
        const base64 = await downloadImageAsBase64(img.src)
        if (base64) {
          img.src = base64
        }
      } catch (error) {
        console.warn('处理图片失败:', img.src, error)
      }
    }

    // 确保图片元素在打印时保持正确的样式
    if (img.classList.contains('school-logo-print')) {
      // 学校Logo保持原始比例，设置最大尺寸
      img.style.maxWidth = '70px !important'
      img.style.maxHeight = '60px !important'
      img.style.width = 'auto !important'
      img.style.height = 'auto !important'
      img.style.objectFit = 'contain !important'
      img.style.borderRadius = '4px !important'
      img.style.flexShrink = '0 !important'
    } else if (img.classList.contains('logo')) {
      // 系统Logo按原尺寸显示
      img.style.width = '70px !important'
      img.style.height = 'auto !important'
      img.style.objectFit = 'contain !important'
      img.style.borderRadius = '4px !important'
    } else if (img.classList.contains('song-cover')) {
      // 歌曲封面保持固定尺寸
      img.style.width = '40px !important'
      img.style.height = '40px !important'
      img.style.objectFit = 'cover !important'
      img.style.borderRadius = '4px !important'
    }
  })

  await Promise.all(imagePromises)
  // 等待一下让图片加载完成
  await new Promise(resolve => setTimeout(resolve, 500))
}

const exportPDF = async () => {
  isExporting.value = true
  try {
    // 动态导入PDF库
    const html2pdf = (await import('html2pdf.js')).default

    if (!previewContent.value) {
      throw new Error('预览内容未找到')
    }

    // 获取预览页面元素
    const printPage = previewContent.value.querySelector('.print-page')
    if (!printPage) {
      throw new Error('打印页面元素未找到')
    }

    // 克隆预览内容，保持原有样式
    const clonedPage = printPage.cloneNode(true)

    // 创建PDF渲染容器
    const pdfContainer = document.createElement('div')
    pdfContainer.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    z-index: -1;
    background: white;
    color: black;
    box-sizing: border-box;
  `

    // 调整克隆页面的样式
    clonedPage.style.cssText = `
    background: white !important;
    color: black !important;
    box-sizing: border-box !important;
  `

    // 确保所有子元素的颜色和样式正确
    const allElements = clonedPage.querySelectorAll('*')
    allElements.forEach(el => {
      if (el.style) {
        // 强制设置文字颜色为黑色
        el.style.color = 'black !important'

        // 保持背景为白色
        el.style.background = 'white !important'
        el.style.backgroundColor = 'white !important'
      }

      // 特别处理页面元素的背景
      if (el.classList && (
          el.classList.contains('print-page') ||
          el.classList.contains('page-header') ||
          el.classList.contains('page-footer') ||
          el.classList.contains('schedule-content'))) {
        el.style.background = 'white !important'
        el.style.backgroundColor = 'white !important'
      }
    })

    pdfContainer.appendChild(clonedPage)
    document.body.appendChild(pdfContainer)

    // 预处理图片
    await preprocessImages(clonedPage)

    try {
      // 等待渲染完成
      await new Promise(resolve => setTimeout(resolve, 500))

      // 使用html2pdf.js生成PDF
      const worker = html2pdf()
      const options = {
        margin: 10,
        filename: `广播排期表_${formatDateRange()}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: {type: 'jpeg', quality: 0.9},
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        },
        jsPDF: {
          unit: 'mm',
          format: settings.value.paperSize.toLowerCase(),
          orientation: settings.value.orientation === 'landscape' ? 'l' : 'p'
        },
        pagebreak: {mode: ['css', 'legacy']}
      }

      // 生成并保存PDF
      await worker.from(clonedPage).set(options).save()

      // 移除临时容器
      document.body.removeChild(pdfContainer)

      if (window.$showNotification) {
        window.$showNotification('PDF导出成功', 'success')
      }
    } catch (error) {
      // 移除临时容器
      if (document.body.contains(pdfContainer)) {
        document.body.removeChild(pdfContainer)
      }
      throw error
    }
  } catch (error) {
    console.error('导出PDF失败:', error)
    if (window.$showNotification) {
      window.$showNotification('导出PDF失败: ' + error.message, 'error')
    }
  } finally {
    isExporting.value = false
  }
}

const exportImage = async () => {
  isExportingImage.value = true
  try {

    if (!previewContent.value) {
      throw new Error('预览内容未找到')
    }

    // 获取预览页面元素
    const printPage = previewContent.value.querySelector('.print-page')
    if (!printPage) {
      throw new Error('打印页面元素未找到')
    }

    // 克隆预览内容，保持原有样式
    const clonedPage = printPage.cloneNode(true)

    // 获取原始页面尺寸
    const originalWidth = printPage.offsetWidth
    const originalHeight = printPage.offsetHeight

    // 创建长图渲染容器，保持原始比例
    const imageContainer = document.createElement('div')
    imageContainer.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      z-index: -1;
      background: white;
      color: black;
      width: ${originalWidth}px;
      padding: 40px;
      box-sizing: border-box;
    `

    // 调整克隆页面的样式，保持原始尺寸
    clonedPage.style.cssText = `
      background: white !important;
      color: black !important;
      box-sizing: border-box !important;
      width: ${originalWidth - 80}px !important;
      margin: 0 auto !important;
      padding: 0 !important;
    `

    // 确保所有子元素的颜色和样式正确
    const allElements = clonedPage.querySelectorAll('*')
    allElements.forEach(el => {
      if (el.style) {
        // 强制设置文字颜色为黑色
        el.style.color = 'black !important'

        // 保持背景为白色
        el.style.background = 'white !important'
        el.style.backgroundColor = 'white !important'
      }

      // 特别处理页面元素的背景
      if (el.classList && (
          el.classList.contains('print-page') ||
          el.classList.contains('page-header') ||
          el.classList.contains('page-footer') ||
          el.classList.contains('schedule-content'))) {
        el.style.background = 'white !important'
        el.style.backgroundColor = 'white !important'
      }
    })

    imageContainer.appendChild(clonedPage)
    document.body.appendChild(imageContainer)

    // 预处理图片
    await preprocessImages(clonedPage)

    try {
      // 等待渲染完成
      await new Promise(resolve => setTimeout(resolve, 500))

      // 使用html2canvas生成图片
      const canvas = await html2canvas(imageContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: imageContainer.offsetWidth,
        height: imageContainer.offsetHeight,
        scrollX: 0,
        scrollY: 0
      })

      // 创建下载链接
      const link = document.createElement('a')
      link.download = `广播排期表_${formatDateRange()}_${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL('image/png', 1.0)

      // 触发下载
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // 移除临时容器
      document.body.removeChild(imageContainer)

      if (window.$showNotification) {
        window.$showNotification('长图导出成功', 'success')
      }
    } catch (error) {
      // 移除临时容器
      if (document.body.contains(imageContainer)) {
        document.body.removeChild(imageContainer)
      }
      throw error
    }
  } catch (error) {
    console.error('导出长图失败:', error)
    if (window.$showNotification) {
      window.$showNotification('导出长图失败: ' + error.message, 'error')
    }
  } finally {
    isExportingImage.value = false
  }
}

// 生成PDF专用的排期内容
const generatePDFScheduleContent = () => {
  let html = ''

  const scheduleGroups = groupedSchedules.value
  const dateKeys = Object.keys(scheduleGroups)

  if (dateKeys.length === 0) {
    return '<p style="text-align: center; color: #666; font-size: 16px; margin: 40px 0;">暂无排期数据</p>'
  }

  dateKeys.forEach(dateKey => {
    const dateGroup = scheduleGroups[dateKey]

    // 日期标题
    html += `
      <div style="
        font-size: 18px;
        font-weight: bold;
        color: #000;
        margin: 20px 0 15px 0;
        padding-bottom: 8px;
        border-bottom: 1px solid #ddd;
      ">
        ${formatDate(dateGroup.date)}
      </div>
    `

    const playTimeKeys = Object.keys(dateGroup.playTimes || {})
    if (playTimeKeys.length > 0) {
      // 按时段分组显示
      playTimeKeys.forEach(playTimeKey => {
        const playTimeData = dateGroup.playTimes[playTimeKey]
        if (playTimeData.schedules.length > 0) {
          html += `
            <div style="margin-bottom: 20px;">
              <h4 style="
                font-size: 16px;
                font-weight: 600;
                color: #333;
                margin: 10px 0 8px 0;
              ">
                ${playTimeData.playTime?.name || '未指定时段'}
                ${playTimeData.playTime?.startTime && playTimeData.playTime?.endTime ?
              `(${playTimeData.playTime.startTime}-${playTimeData.playTime.endTime})` : ''}
              </h4>
              ${generateScheduleItems(playTimeData.schedules)}
            </div>
          `
        }
      })
    } else {
      // 不分时段显示
      html += generateScheduleItems(dateGroup.allSchedules || [])
    }
  })

  return html
}

// 生成排期项目HTML
const generateScheduleItems = (schedules) => {
  return schedules.map(schedule => `
    <div style="
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
      margin-bottom: 8px;
    ">
      ${settings.value.showSequence ? `
        <div style="
          width: 30px;
          height: 30px;
          background: #f0f0f0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          flex-shrink: 0;
        ">
          ${schedule.sequence || 1}
        </div>
      ` : ''}

      ${settings.value.showCover ? `
        <div style="
          width: 40px;
          height: 40px;
          flex-shrink: 0;
        ">
          ${schedule.song?.cover ?
      `<img src="${convertToHttps(schedule.song.cover)}" alt="${schedule.song?.title || '歌曲'}" style="
              width: 100%;
              height: 100%;
              object-fit: cover;
              border-radius: 4px;
            " />` :
      `<div style="
              width: 100%;
              height: 100%;
              background: #f0f0f0;
              border-radius: 4px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #999;
              font-size: 12px;
            ">♪</div>`
  }
        </div>
      ` : ''}

      <div style="flex: 1; min-width: 0;">
        ${settings.value.showTitle ? `
          <div style="
            font-size: 16px;
            font-weight: 600;
            color: #000;
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          ">
            ${schedule.song?.title || '未知歌曲'}
          </div>
        ` : ''}

        ${settings.value.showArtist ? `
          <div style="
            font-size: 14px;
            color: #333;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          ">
            ${schedule.song?.artist || '未知艺术家'}
          </div>
        ` : ''}
      </div>

      <div style="display: flex; gap: 12px; flex-shrink: 0; font-size: 12px; color: #666;">
        ${settings.value.showRequester ? `
          <span>投稿人: ${schedule.song?.requester || '未知'}</span>
        ` : ''}

        ${settings.value.showVotes ? `
          <span>热度: ${schedule.song?.voteCount || 0}</span>
        ` : ''}

        ${settings.value.showPlayTime && schedule.playTime ? `
          <span>时段: ${schedule.playTime?.name || '未指定'}</span>
        ` : ''}
      </div>
    </div>
  `).join('')
}

const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
}

const formatDateRange = () => {
  if (!settings.value.startDate && !settings.value.endDate) {
    return '全部排期'
  }

  const start = settings.value.startDate ? formatDate(settings.value.startDate) : '开始'
  const end = settings.value.endDate ? formatDate(settings.value.endDate) : '结束'

  // 如果日期范围较长，使用双行显示
  const fullRange = `${start} - ${end}`
  if (fullRange.length > 20) {
    return `${start}\n至 ${end}`
  }

  return fullRange
}

const setDateRange = (type) => {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  switch (type) {
    case 'today':
      settings.value.startDate = today.toISOString().split('T')[0]
      settings.value.endDate = today.toISOString().split('T')[0]
      break
    case 'tomorrow':
      settings.value.startDate = tomorrow.toISOString().split('T')[0]
      settings.value.endDate = tomorrow.toISOString().split('T')[0]
      break
    case 'thisWeek':
      const thisWeekStart = new Date(today)
      const thisWeekEnd = new Date(today)
      const dayOfWeek = today.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

      thisWeekStart.setDate(today.getDate() - daysToMonday)
      thisWeekEnd.setDate(thisWeekStart.getDate() + 6)

      settings.value.startDate = thisWeekStart.toISOString().split('T')[0]
      settings.value.endDate = thisWeekEnd.toISOString().split('T')[0]
      break
    case 'nextWeek':
      const nextWeekStart = new Date(today)
      const nextWeekEnd = new Date(today)
      const nextDayOfWeek = today.getDay()
      const daysToNextMonday = nextDayOfWeek === 0 ? 1 : 8 - nextDayOfWeek

      nextWeekStart.setDate(today.getDate() + daysToNextMonday)
      nextWeekEnd.setDate(nextWeekStart.getDate() + 6)

      settings.value.startDate = nextWeekStart.toISOString().split('T')[0]
      settings.value.endDate = nextWeekEnd.toISOString().split('T')[0]
      break
  }
}

// 初始化默认日期
const initializeDates = () => {
  const today = new Date()
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)

  settings.value.startDate = today.toISOString().split('T')[0]
  settings.value.endDate = nextWeek.toISOString().split('T')[0]
}

// 生命周期
onMounted(async () => {
  initializeDates()
  loadSchedules()

  // 初始化站点配置
  await initSiteConfig()

  // 如果有学校logo，自动勾选显示学校logo选项
  if (schoolLogoPrintUrl.value) {
    settings.value.showSchoolLogo = true
  }
})

// 调试用的计算属性
const debugInfo = computed(() => {
  return {
    totalSchedules: schedules.value.length,
    filteredCount: filteredSchedules.value.length,
    dateRange: `${settings.value.startDate} - ${settings.value.endDate}`,
    groupBy: settings.value.groupBy,
    sampleSchedule: schedules.value[0] || null
  }
})

// 监听设置变化
watch(() => settings.value, () => {
  // 可以在这里添加实时预览更新逻辑
}, {deep: true})
</script>

<style scoped>
.schedule-printer {
  padding: 24px;
  background: #0a0a0a;
  color: #ffffff;
  min-height: 100vh;
}

.printer-header {
  margin-bottom: 32px;
}

.printer-header h2 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #ffffff;
}

.subtitle {
  color: #888;
  font-size: 16px;
}

/* 权限拒绝样式 */
.permission-denied {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  color: #888;
}

.permission-icon {
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
  color: #ff6b6b;
}

.permission-icon svg {
  width: 100%;
  height: 100%;
}

.permission-denied h3 {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #ffffff;
}

.permission-denied p {
  font-size: 16px;
  line-height: 1.5;
  margin: 0;
  max-width: 400px;
}

.printer-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 32px;
  height: calc(100vh - 120px);
}

/* 设置面板 */
.settings-panel {
  background: #111111;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #1f1f1f;
  overflow-y: auto;
}

.setting-group h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #ffffff;
}

.setting-item {
  margin-bottom: 20px;
}

.setting-item label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #cccccc;
}

.setting-select,
.date-input {
  width: 100%;
  padding: 10px 12px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  color: #ffffff;
  font-size: 14px;
}

.setting-select:focus,
.date-input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

/* 修复日期输入框的日历图标颜色 */
.date-input::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor: pointer;
}

.date-input::-webkit-inner-spin-button,
.date-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-range span {
  color: #888;
  font-size: 14px;
}

.content-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 0;
}

.checkbox-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #4f46e5;
}

.checkbox-item span {
  font-size: 14px;
  color: #cccccc;
}

.date-shortcuts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
}

.shortcut-btn {
  padding: 8px 12px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 4px;
  color: #cccccc;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.shortcut-btn:hover {
  background: #2a2a2a;
  border-color: #4f46e5;
  color: #ffffff;
}

.action-buttons {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.btn-primary {
  background: #4f46e5;
  color: #ffffff;
}

.btn-primary:hover {
  background: #4338ca;
}

.btn-secondary {
  background: #374151;
  color: #ffffff;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn-success {
  background: #059669;
  color: #ffffff;
}

.btn-success:hover {
  background: #047857;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 预览面板 */
.preview-panel {
  background: #111111;
  border-radius: 12px;
  border: 1px solid #1f1f1f;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

.preview-header {
  padding: 20px 24px;
  border-bottom: 1px solid #1f1f1f;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.preview-info {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #888;
}

.debug-info {
  color: #ff6b6b !important;
  font-weight: 500;
}

.preview-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  background: #ffffff;
  padding: 20px;
  position: relative;
  height: 0; /* 强制flex子元素使用flex-grow */
}

/* 打印页面样式 */
.print-page {
  background: #ffffff;
  color: #000000;
  width: 100%;
  margin: 0 auto;
  padding: 30px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  overflow: visible;
  position: relative;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e5e5e5;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo {
  width: 70px;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
}

.logo-divider {
  width: 2px;
  height: 60px;
  background: linear-gradient(to bottom, #ddd, #999, #ddd);
  border-radius: 1px;
  margin: 0 4px;
}

.school-logo-print {
  max-width: 70px;
  max-height: 60px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
  flex-shrink: 0;
}

.title-section h1 {
  font-size: 24px;
  font-weight: normal;
  margin: 0 0 4px 0;
  color: #000;
}

.title-section h2 {
  font-size: 18px;
  font-weight: 500;
  margin: 0;
  color: #666;
}

.date-info {
  font-size: 14px;
  color: #666;
  text-align: right;
  display: flex;
  align-items: flex-start;
}

.date-range-display {
  white-space: pre-line;
  line-height: 1.4;
  font-weight: 500;
  margin-top: 2px; /* 微调对齐，考虑到h1的line-height */
}

.schedule-content {
  margin-bottom: 32px;
}

.no-data-message {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.no-data-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  color: #ccc;
}

.no-data-icon svg {
  width: 100%;
  height: 100%;
}

.no-data-message h3 {
  font-size: 18px;
  font-weight: 500;
  margin: 0 0 12px 0;
  color: #333;
}

.no-data-message p {
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
  max-width: 400px;
  margin: 0 auto;
}

.group-title {
  font-size: 16px;
  font-weight: bold;
  margin: 24px 0 12px 0;
  padding: 8px 12px;
  border-bottom: 2px solid #ddd;
  background: #f8f9fa;
  color: #333;
  border-radius: 4px 4px 0 0;
}

.playtime-group .group-title {
  background: #e3f2fd;
  border-bottom-color: #2196f3;
  color: #1565c0;
}

.date-group .group-title {
  background: #f3e5f5;
  border-bottom-color: #9c27b0;
  color: #7b1fa2;
}

.group-count {
  font-size: 14px;
  font-weight: normal;
  color: #666;
  margin-left: 8px;
}

.playtime-groups {
  margin-left: 20px;
}

.playtime-title {
  font-size: 14px;
  font-weight: 600;
  margin: 16px 0 8px 0;
  padding: 6px 10px;
  background: #f0f8ff;
  border-left: 3px solid #2196f3;
  color: #1565c0;
  border-radius: 0 4px 4px 0;
}

.playtime-count {
  font-size: 12px;
  font-weight: normal;
  color: #666;
  margin-left: 6px;
}

.schedule-list {
  margin-bottom: 24px;
}

.page-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-top: 16px;
  border-top: 1px solid #e5e5e5;
  font-size: 12px;
  color: #666;
}

.footer-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.footer-right {
  align-self: flex-end;
}

.remark-text {
  font-size: 11px;
  color: #555;
  max-width: 400px;
  word-wrap: break-word;
  line-height: 1.3;
  white-space: pre-wrap;
}

.remark-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #1a1a1a;
  color: #ffffff;
  font-size: 14px;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.remark-input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
}

.remark-input::placeholder {
  color: #666;
}

/* 纸张大小 - 固定尺寸预览 */
.paper-a4 {
  width: 800px; /* 固定宽度，不响应屏幕大小 */
  height: 1132px; /* A4比例 210:297 = 800:1132 */
  margin: 0 auto;
  flex-shrink: 0;
}

.paper-a4.orientation-landscape {
  width: 1132px; /* A4横向 297:210 */
  height: 800px;
  margin: 0 auto;
  flex-shrink: 0;
}

.paper-a3 {
  width: 1132px; /* A3比例 297:420 = 1132:1600 */
  height: 1600px;
  margin: 0 auto;
  flex-shrink: 0;
}

.paper-a3.orientation-landscape {
  width: 1600px; /* A3横向 420:297 */
  height: 1132px;
  margin: 0 auto;
  flex-shrink: 0;
}

.paper-letter {
  width: 800px; /* 固定宽度 */
  height: 1034px; /* Letter比例 216:279 = 800:1034 */
  margin: 0 auto;
  flex-shrink: 0;
}

.paper-letter.orientation-landscape {
  width: 1034px; /* Letter横向 279:216 */
  height: 800px;
  margin: 0 auto;
  flex-shrink: 0;
}

.paper-legal {
  width: 800px; /* 固定宽度 */
  height: 1318px; /* Legal比例 216:356 = 800:1318 */
  margin: 0 auto;
  flex-shrink: 0;
}

.paper-legal.orientation-landscape {
  width: 1318px; /* Legal横向 356:216 */
  height: 800px;
  margin: 0 auto;
  flex-shrink: 0;
}

/* 横向布局调整 */
.orientation-landscape .page-header {
  flex-direction: row;
  justify-content: space-between;
}

.orientation-landscape .logo-section {
  flex-direction: row;
}

.orientation-landscape .school-logo-print {
  max-width: 70px;
  max-height: 60px;
  width: auto;
  height: auto;
  object-fit: contain;
  flex-shrink: 0;
}

.orientation-landscape .schedule-content {
  columns: 2;
  column-gap: 32px;
}

.orientation-landscape .date-group,
.orientation-landscape .playtime-group {
  break-inside: avoid;
  margin-bottom: 20px;
}

/* 打印样式 */
@media print {
  .schedule-printer {
    background: #ffffff !important;
    color: #000000 !important;
  }

  .printer-layout {
    display: block !important;
  }

  .settings-panel {
    display: none !important;
  }

  .preview-panel {
    background: transparent !important;
    border: none !important;
  }

  .preview-header {
    display: none !important;
  }

  .preview-content {
    padding: 0 !important;
    background: transparent !important;
  }

  .print-page {
    box-shadow: none !important;
    padding: 20mm !important;
    margin: 0 !important;
    width: 100% !important;
    max-width: none !important;
    box-sizing: border-box !important;
  }

  .page-header,
  .schedule-content,
  .page-footer {
    color: #000000 !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  .schedule-content {
    width: 100% !important;
  }

  .schedule-item-print {
    width: 100% !important;
    max-width: none !important;
  }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .printer-layout {
    grid-template-columns: 280px 1fr;
    gap: 24px;
  }
}

@media screen and (max-width: 768px) {
  .printer-layout {
    grid-template-columns: 1fr;
    gap: 20px;
    height: 100vh;
    overflow: hidden;
  }

  .settings-panel {
    order: 1;
    height: 50vh;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .preview-panel {
    order: 2;
    height: 50vh;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .preview-content {
    height: 100%;
    overflow-y: auto;
  }

  .setting-item {
    margin-bottom: 16px;
  }

  .setting-select,
  .setting-input {
    padding: 12px;
    font-size: 16px;
    min-height: 44px;
  }

  .date-range {
    flex-direction: column;
    gap: 12px;
  }

  .checkbox-group {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .checkbox-item {
    padding: 12px;
    border-radius: 8px;
  }

  .action-buttons {
    flex-direction: column;
    gap: 12px;
    margin-top: 20px;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
    padding: 14px 20px;
    font-size: 16px;
    min-height: 48px;
  }
}

/* 小屏幕设备进一步优化 */
@media screen and (max-width: 480px) {
  .schedule-printer {
    padding: 12px;
  }

  .printer-layout {
    gap: 16px;
    height: 100vh;
  }

  .settings-panel {
    padding: 16px;
    height: 45vh;
    overflow-y: auto;
  }

  .preview-panel {
    height: 55vh;
    overflow-y: auto;
  }

  .panel-title {
    font-size: 16px;
    margin-bottom: 16px;
  }

  .setting-item {
    margin-bottom: 12px;
  }

  .setting-label {
    font-size: 14px;
    margin-bottom: 6px;
  }

  .setting-select,
  .setting-input {
    padding: 10px;
    font-size: 16px;
    min-height: 40px;
  }

  .checkbox-group {
    gap: 8px;
  }

  .checkbox-item {
    padding: 10px;
  }

  .checkbox-item label {
    font-size: 13px;
  }

  .action-buttons {
    gap: 10px;
    margin-top: 16px;
  }

  .btn-primary,
  .btn-secondary {
    padding: 12px 16px;
    font-size: 15px;
    min-height: 44px;
  }
}
</style>
