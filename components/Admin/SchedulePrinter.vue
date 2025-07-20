<template>
  <div class="schedule-printer">
    <div class="printer-header">
      <h2>打印排期</h2>
      <p class="subtitle">自定义打印设置，预览并导出排期表</p>
    </div>

    <div class="printer-layout">
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
                type="date"
                v-model="settings.startDate"
                class="date-input"
              />
              <span>至</span>
              <input
                type="date"
                v-model="settings.endDate"
                class="date-input"
              />
            </div>
            <!-- 日期快捷选择 -->
            <div class="date-shortcuts">
              <button @click="setDateRange('today')" class="shortcut-btn">今天</button>
              <button @click="setDateRange('tomorrow')" class="shortcut-btn">明天</button>
              <button @click="setDateRange('thisWeek')" class="shortcut-btn">本周</button>
              <button @click="setDateRange('nextWeek')" class="shortcut-btn">下周</button>
            </div>
          </div>

          <!-- 内容选择 -->
          <div class="setting-item">
            <label>显示内容</label>
            <div class="content-options">
              <label class="checkbox-item">
                <input type="checkbox" v-model="settings.showCover" />
                <span>歌曲封面</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" v-model="settings.showTitle" />
                <span>歌曲名</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" v-model="settings.showArtist" />
                <span>歌手</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" v-model="settings.showRequester" />
                <span>投稿人</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" v-model="settings.showVotes" />
                <span>热度</span>
              </label>

              <label class="checkbox-item">
                <input type="checkbox" v-model="settings.showSequence" />
                <span>播放顺序</span>
              </label>
            </div>
          </div>


        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <button @click="refreshPreview" class="btn btn-secondary">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            刷新预览
          </button>
          <button @click="printSchedule" class="btn btn-primary">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 6,2 18,2 18,9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            打印
          </button>
          <button @click="exportPDF" class="btn btn-success" :disabled="isExporting">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            {{ isExporting ? '导出中...' : '导出PDF' }}
          </button>
        </div>
      </div>

      <!-- 右侧预览面板 -->
      <div class="preview-panel">
        <div class="preview-header">
          <h3>打印预览</h3>
          <div class="preview-info">
            <span>{{ filteredSchedules.length }} 首歌曲</span>
            <span>{{ Math.ceil(filteredSchedules.length / itemsPerPage) }} 页</span>
            <span v-if="schedules.length === 0" class="debug-info">无排期数据</span>
            <span v-else-if="filteredSchedules.length === 0" class="debug-info">过滤后无数据</span>
          </div>
        </div>
        
        <div 
          class="preview-content" 
          :class="[
            `paper-${settings.paperSize.toLowerCase()}`,
            `orientation-${settings.orientation}`
          ]"
          ref="previewContent"
        >
          <div class="print-page">
            <!-- 页面头部 -->
            <div class="page-header">
              <div class="logo-section">
                <img src="/images/logo.jpg" alt="VoiceHub Logo" class="logo" />
                <div class="title-section">
                  <h1>{{ siteTitle }}</h1>
                  <h2>广播排期表</h2>
                </div>
              </div>
              <div class="date-info">
                <span>{{ formatDateRange() }}</span>
              </div>
            </div>

            <!-- 排期内容 -->
            <div class="schedule-content">
              <!-- 无数据提示 -->
              <div v-if="filteredSchedules.length === 0" class="no-data-message">
                <div class="no-data-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
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
                          <ScheduleItemPrint :schedule="schedule" :settings="settings" />
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
                      <ScheduleItemPrint :schedule="schedule" :settings="settings" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 页面底部 -->
            <div class="page-footer">
              <span>生成时间：{{ new Date().toLocaleString() }}</span>
              <span>VoiceHub 广播管理系统</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRuntimeConfig } from '#app'

// 导入子组件
import ScheduleItemPrint from './ScheduleItemPrint.vue'

// 配置
const config = useRuntimeConfig()
const siteTitle = config.public.siteTitle || 'VoiceHub'

// 响应式数据
const schedules = ref([])
const loading = ref(false)
const isExporting = ref(false)
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
  showSequence: true
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
    const data = await $fetch('/api/songs/public')
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
  try {
    // 动态导入PDF库
    const { default: jsPDF } = await import('jspdf')
    const { default: html2canvas } = await import('html2canvas')

    if (!previewContent.value) {
      throw new Error('预览内容未找到')
    }

    // 获取打印页面元素
    const printPage = previewContent.value.querySelector('.print-page')
    if (!printPage) {
      throw new Error('打印页面元素未找到')
    }

    // 克隆元素以避免修改原始DOM
    const clonedPage = printPage.cloneNode(true)

    // 预处理所有图片
    await preprocessImages(clonedPage)

    // 临时添加到DOM中进行渲染
    clonedPage.style.position = 'absolute'
    clonedPage.style.left = '-9999px'
    clonedPage.style.top = '-9999px'
    document.body.appendChild(clonedPage)

    try {
      // 生成canvas
      const canvas = await html2canvas(clonedPage, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      })

      // 移除临时元素
      document.body.removeChild(clonedPage)

    // 创建PDF - 使用选择的纸张大小和方向
    const orientation = settings.value.orientation === 'landscape' ? 'l' : 'p'
    const format = settings.value.paperSize.toLowerCase()

    const pdf = new jsPDF(orientation, 'mm', format)
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    // 计算图片在PDF中的尺寸
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * pageWidth) / canvas.width
    let heightLeft = imgHeight

    // 添加第一页
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight)
    heightLeft -= pageHeight

    // 如果内容超过一页，添加更多页面
    while (heightLeft > 0) {
      const position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    // 生成PDF的Blob
    const pdfBlob = pdf.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)

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

      if (window.$showNotification) {
        window.$showNotification('正在准备打印...', 'info')
      }
    } catch (canvasError) {
      // 移除临时元素
      if (document.body.contains(clonedPage)) {
        document.body.removeChild(clonedPage)
      }
      throw canvasError
    }
  } catch (error) {
    console.error('打印失败:', error)
    if (window.$showNotification) {
      window.$showNotification('打印失败: ' + error.message, 'error')
    }
  }
}

// 预下载图片并转换为base64
const downloadImageAsBase64 = async (url) => {
  try {
    // 使用我们的代理API来获取图片
    const proxyUrl = `/api/proxy/image?url=${encodeURIComponent(url)}`
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
  })

  await Promise.all(imagePromises)
  // 等待一下让图片加载完成
  await new Promise(resolve => setTimeout(resolve, 500))
}

const exportPDF = async () => {
  isExporting.value = true
  try {
    // 动态导入PDF库
    const { default: jsPDF } = await import('jspdf')
    const { default: html2canvas } = await import('html2canvas')

    if (!previewContent.value) {
      throw new Error('预览内容未找到')
    }

    // 获取打印页面元素
    const printPage = previewContent.value.querySelector('.print-page')
    if (!printPage) {
      throw new Error('打印页面元素未找到')
    }

    // 克隆元素以避免修改原始DOM
    const clonedPage = printPage.cloneNode(true)

    // 预处理所有图片
    await preprocessImages(clonedPage)

    // 临时添加到DOM中进行渲染
    clonedPage.style.position = 'absolute'
    clonedPage.style.left = '-9999px'
    clonedPage.style.top = '-9999px'
    document.body.appendChild(clonedPage)

    try {
      // 生成canvas
      const canvas = await html2canvas(clonedPage, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      })

      // 移除临时元素
      document.body.removeChild(clonedPage)

    // 创建PDF - 使用选择的纸张大小和方向
    const orientation = settings.value.orientation === 'landscape' ? 'l' : 'p'
    const format = settings.value.paperSize.toLowerCase()

    const pdf = new jsPDF(orientation, 'mm', format)
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    // 计算图片在PDF中的尺寸
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * pageWidth) / canvas.width
    let heightLeft = imgHeight

    // 添加第一页
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight)
    heightLeft -= pageHeight

    // 如果内容超过一页，添加更多页面
    while (heightLeft > 0) {
      const position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    // 生成文件名
    const dateRange = formatDateRange()
    const fileName = `广播排期表_${dateRange}_${new Date().toISOString().split('T')[0]}.pdf`

    // 保存PDF
    pdf.save(fileName)

      if (window.$showNotification) {
        window.$showNotification('PDF导出成功', 'success')
      }
    } catch (canvasError) {
      // 移除临时元素
      if (document.body.contains(clonedPage)) {
        document.body.removeChild(clonedPage)
      }
      throw canvasError
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

  return `${start} - ${end}`
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
onMounted(() => {
  initializeDates()
  loadSchedules()
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
}, { deep: true })
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
  gap: 16px;
}

.logo {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 4px;
}

.title-section h1 {
  font-size: 24px;
  font-weight: bold;
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
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid #e5e5e5;
  font-size: 12px;
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
  }

  .page-header,
  .schedule-content,
  .page-footer {
    color: #000000 !important;
  }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .printer-layout {
    grid-template-columns: 280px 1fr;
    gap: 24px;
  }
}

@media (max-width: 768px) {
  .printer-layout {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .settings-panel {
    order: 2;
  }

  .preview-panel {
    order: 1;
  }
}
</style>
