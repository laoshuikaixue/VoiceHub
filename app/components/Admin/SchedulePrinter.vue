<template>
  <div
    class="h-full flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
  >
    <div class="flex flex-col space-y-2">
      <h2 class="text-2xl font-bold tracking-tight text-zinc-100">打印排期</h2>
      <p class="text-sm text-zinc-500">自定义打印设置，预览并导出排期表</p>
    </div>

    <!-- 权限检查 -->
    <div
      v-if="!canPrintSchedule"
      class="flex flex-col items-center justify-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800"
    >
      <div
        class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4"
      >
        <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="m15 9-6 6" />
          <path d="m9 9 6 6" />
        </svg>
      </div>
      <h3 class="text-lg font-bold text-zinc-100">权限不足</h3>
      <p class="text-zinc-500 mt-2">您没有打印排期的权限，请联系管理员获取相应权限。</p>
    </div>

    <div v-else class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
      <!-- 设置面板 -->
      <div class="lg:col-span-4 flex flex-col gap-6">
        <div
          class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 space-y-6 shadow-lg flex flex-col h-full"
        >
          <h3 class="text-lg font-bold flex items-center gap-2 text-zinc-100">
            <Layout class="w-4 h-4 text-blue-500" /> 打印设置
          </h3>

          <div class="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1">
            <!-- 纸张大小 -->
            <div class="space-y-2">
              <label class="text-[11px] font-black uppercase text-zinc-600 tracking-wider"
                >纸张大小</label
              >
              <CustomSelect
                v-model="settings.paperSize"
                :options="paperSizeOptions"
                placeholder="选择纸张大小"
                class-name="w-full"
              />
            </div>

            <!-- 页面方向 -->
            <div class="space-y-2">
              <label class="text-[11px] font-black uppercase text-zinc-600 tracking-wider"
                >页面方向</label
              >
              <div class="grid grid-cols-2 gap-2">
                <button
                  :class="[
                    'py-2.5 rounded-lg text-sm font-bold transition-all',
                    settings.orientation === 'portrait'
                      ? 'border border-blue-500/30 bg-blue-600/10 text-blue-400 shadow-sm'
                      : 'border border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                  ]"
                  @click="settings.orientation = 'portrait'"
                >
                  纵向
                </button>
                <button
                  :class="[
                    'py-2.5 rounded-lg text-sm font-bold transition-all',
                    settings.orientation === 'landscape'
                      ? 'border border-blue-500/30 bg-blue-600/10 text-blue-400 shadow-sm'
                      : 'border border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                  ]"
                  @click="settings.orientation = 'landscape'"
                >
                  横向
                </button>
              </div>
            </div>

            <!-- 日期范围 -->
            <div class="space-y-2">
              <label class="text-[11px] font-black uppercase text-zinc-600 tracking-wider"
                >日期范围</label
              >
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  v-model="settings.startDate"
                  type="date"
                  class="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-blue-500/50 transition-colors"
                  max="9999-12-31"
                >
                <input
                  v-model="settings.endDate"
                  type="date"
                  class="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-blue-500/50 transition-colors"
                  max="9999-12-31"
                >
              </div>
              <div class="flex gap-2 flex-wrap">
                <button
                  v-for="range in dateRanges"
                  :key="range.value"
                  class="px-2 py-1 bg-zinc-800/50 hover:bg-zinc-800 text-[10px] text-zinc-400 rounded-md transition-colors border border-zinc-800"
                  @click="setDateRange(range.value)"
                >
                  {{ range.label }}
                </button>
              </div>
            </div>

            <!-- 显示内容 -->
            <div class="space-y-3">
              <label class="text-[11px] font-black uppercase text-zinc-600 tracking-wider"
                >显示内容</label
              >
              <div class="grid grid-cols-1 gap-2.5">
                <label
                  v-for="option in contentOptions"
                  :key="option.key"
                  class="flex items-center gap-3 cursor-pointer group select-none"
                >
                  <div
                    :class="[
                      'w-5 h-5 rounded flex items-center justify-center border transition-all',
                      settings[option.key]
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-zinc-950 border-zinc-800 group-hover:border-zinc-700'
                    ]"
                  >
                    <CheckCircle2 v-if="settings[option.key]" class="w-3 h-3 text-white" />
                  </div>
                  <input v-model="settings[option.key]" type="checkbox" class="hidden" >
                  <span
                    :class="[
                      'text-sm font-medium transition-colors',
                      settings[option.key]
                        ? 'text-zinc-200'
                        : 'text-zinc-500 group-hover:text-zinc-400'
                    ]"
                    >{{ option.label }}</span
                  >
                </label>

                <label
                  v-if="schoolLogoPrintUrl"
                  class="flex items-center gap-3 cursor-pointer group select-none"
                >
                  <div
                    :class="[
                      'w-5 h-5 rounded flex items-center justify-center border transition-all',
                      settings.showSchoolLogo
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-zinc-950 border-zinc-800 group-hover:border-zinc-700'
                    ]"
                  >
                    <CheckCircle2 v-if="settings.showSchoolLogo" class="w-3 h-3 text-white" />
                  </div>
                  <input v-model="settings.showSchoolLogo" type="checkbox" class="hidden" >
                  <span
                    :class="[
                      'text-sm font-medium transition-colors',
                      settings.showSchoolLogo
                        ? 'text-zinc-200'
                        : 'text-zinc-500 group-hover:text-zinc-400'
                    ]"
                    >学校Logo</span
                  >
                </label>
              </div>
            </div>

            <!-- 备注 -->
            <div class="space-y-2">
              <label class="text-[11px] font-black uppercase text-zinc-600 tracking-wider"
                >备注</label
              >
              <textarea
                v-model="settings.remark"
                placeholder="请输入备注信息（可选）"
                class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none text-zinc-300 min-h-[80px] resize-none focus:border-blue-500/50 transition-colors"
              />
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="space-y-2 pt-4 border-t border-zinc-800 shrink-0">
            <button
              class="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-sm font-bold rounded-lg border border-zinc-700 transition-all"
              @click="refreshPreview"
            >
              <RefreshCw class="w-4 h-4" /> 刷新预览
            </button>
            <button
              :disabled="isPrinting"
              class="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-900/20 transition-all"
              @click="printSchedule"
            >
              <Printer class="w-4 h-4" /> {{ isPrinting ? '打印中...' : '打印' }}
            </button>
            <div class="grid grid-cols-2 gap-2">
              <button
                :disabled="isExporting"
                class="flex items-center justify-center gap-2 py-2.5 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold rounded-lg border border-emerald-500/20 transition-all"
                @click="exportPDF"
              >
                <FileText class="w-3.5 h-3.5" /> {{ isExporting ? '导出中...' : '导出PDF' }}
              </button>
              <button
                :disabled="isExportingImage"
                class="flex items-center justify-center gap-2 py-2.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold rounded-lg border border-amber-500/20 transition-all"
                @click="exportImage"
              >
                <ImageIcon class="w-3.5 h-3.5" /> {{ isExportingImage ? '导出中...' : '导出长图' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 预览区域 -->
      <div class="lg:col-span-8 flex flex-col gap-4 min-h-0">
        <div
          class="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-full shadow-lg"
        >
          <div class="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
            <h3 class="text-lg font-bold flex items-center gap-2 text-zinc-100">
              <AlignLeft class="w-4.5 h-4.5 text-zinc-500" /> 预览区域
            </h3>
            <div class="flex items-center gap-2 text-xs font-bold">
              <span class="text-zinc-400">{{ filteredSchedules.length }} 首歌曲</span>
              <span
                v-if="schedules.length === 0"
                class="px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20"
                >无数据</span
              >
              <span
                v-else-if="filteredSchedules.length === 0"
                class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20"
                >被过滤</span
              >
            </div>
          </div>

          <div
            class="flex-1 bg-zinc-950/50 p-6 md:p-12 overflow-auto custom-scrollbar flex items-start"
          >
            <!-- 纸张预览 -->
            <div
              ref="previewContent"
              :class="[
                `paper-${settings.paperSize.toLowerCase()}`,
                `orientation-${settings.orientation}`
              ]"
              class="preview-content m-auto shrink-0"
            >
              <div class="print-page">
                <!-- 页面头部 -->
                <div class="page-header">
                  <div class="logo-section">
                    <img :src="logoUrl" alt="VoiceHub Logo" class="logo" >
                    <!-- 竖线分割 -->
                    <div class="logo-divider" />
                    <!-- 学校logo -->
                    <img
                      v-if="settings.showSchoolLogo && schoolLogoPrintUrl"
                      :src="schoolLogoPrintUrl"
                      alt="学校Logo"
                      class="school-logo-print"
                    >
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
                        <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
                        <line x1="16" x2="16" y1="2" y2="6" />
                        <line x1="8" x2="8" y1="2" y2="6" />
                        <line x1="3" x2="21" y1="10" y2="10" />
                      </svg>
                    </div>
                    <h3>暂无排期数据</h3>
                    <p v-if="schedules.length === 0">请先在"排期管理"中添加排期，然后再来打印。</p>
                    <p v-else>当前日期范围内没有排期数据，请调整日期范围或检查排期设置。</p>
                  </div>

                  <div class="grouped-content">
                    <div
                      v-for="(dateGroup, date) in groupedSchedules"
                      :key="date"
                      class="date-group"
                      :data-date="date"
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
                            <span class="playtime-count"
                              >({{ playTimeData.schedules.length }}首)</span
                            >
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
                  <div class="footer-left">
                    <span>生成时间：{{ new Date().toLocaleString() }}</span>
                    <span v-if="settings.remark" class="remark-text"
                      >备注：{{ settings.remark }}</span
                    >
                  </div>
                  <span class="footer-right">Generated by VoiceHub | 广播管理系统</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRuntimeConfig } from '#app'
import { usePermissions } from '~/composables/usePermissions'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { convertToHttps } from '~/utils/url'
import { toPng, toBlob } from 'html-to-image'
import { jsPDF } from 'jspdf'
import {
  Layout,
  ChevronDown,
  CheckCircle2,
  Printer,
  FileText,
  ImageIcon,
  AlignLeft,
  RefreshCw
} from 'lucide-vue-next'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'

// 导入子组件
import ScheduleItemPrint from './ScheduleItemPrint.vue'
import logoPng from '~/public/images/logo.png'

// 权限检查
const { canPrintSchedule } = usePermissions()

// 站点配置
const { siteTitle, schoolLogoPrintUrl, initSiteConfig } = useSiteConfig()

// 配置
const config = useRuntimeConfig()

// Logo URL处理
const logoUrl = computed(() => logoPng)

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
  showPlayTime: true,
  remark: ''
})

const paperSizeOptions = [
  { label: 'A4 (210×297mm)', value: 'A4' },
  { label: 'A3 (297×420mm)', value: 'A3' },
  { label: 'Letter (216×279mm)', value: 'Letter' },
  { label: 'Legal (216×356mm)', value: 'Legal' }
]

const dateRanges = [
  { label: '今天', value: 'today' },
  { label: '明天', value: 'tomorrow' },
  { label: '本周', value: 'thisWeek' },
  { label: '下周', value: 'nextWeek' }
]

const contentOptions = [
  { key: 'showCover', label: '歌曲封面' },
  { key: 'showTitle', label: '歌曲名' },
  { key: 'showArtist', label: '歌手' },
  { key: 'showRequester', label: '投稿人' },
  { key: 'showVotes', label: '热度' },
  { key: 'showSequence', label: '播放顺序' }
]

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
    filtered = filtered.filter((s) => {
      const scheduleDate = new Date(s.playDate)
      scheduleDate.setHours(0, 0, 0, 0)
      return scheduleDate >= startDate
    })
  }

  if (settings.value.endDate) {
    const endDate = new Date(settings.value.endDate)
    endDate.setHours(23, 59, 59, 999)
    filtered = filtered.filter((s) => {
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

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  // 处理 YYYY-MM-DD 格式，确保在不同浏览器和时区下表现一致
  const date =
    dateStr.includes('-') && !dateStr.includes('T')
      ? new Date(dateStr.replace(/-/g, '/'))
      : new Date(dateStr)

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

  // 如果开始和结束日期相同，只显示一个日期
  if (
    settings.value.startDate &&
    settings.value.endDate &&
    settings.value.startDate === settings.value.endDate
  ) {
    return formatDate(settings.value.startDate)
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

// 设置日期范围
const setDateRange = (type) => {
  const today = new Date()
  const start = new Date()
  const end = new Date()

  if (type === 'today') {
    // start and end are already today
  } else if (type === 'tomorrow') {
    start.setDate(today.getDate() + 1)
    end.setDate(today.getDate() + 1)
  } else if (type === 'thisWeek') {
    const day = today.getDay() || 7 // Sunday is 0, make it 7 for easier math if we want Mon-Sun
    // Assuming Monday start
    const diffToMon = day === 0 ? 6 : day - 1
    start.setDate(today.getDate() - diffToMon)
    end.setDate(start.getDate() + 6)
  } else if (type === 'nextWeek') {
    const day = today.getDay() || 7
    const diffToMon = day === 0 ? 6 : day - 1
    start.setDate(today.getDate() - diffToMon + 7)
    end.setDate(start.getDate() + 6)
  }

  settings.value.startDate = start.toISOString().split('T')[0]
  settings.value.endDate = end.toISOString().split('T')[0]
}

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

  filteredSchedules.value.forEach((schedule) => {
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
  Object.keys(groups)
    .sort()
    .forEach((dateKey) => {
      const dateGroup = groups[dateKey]

      // 对每个时段内的歌曲按序号排序
      Object.keys(dateGroup.playTimes).forEach((playTimeKey) => {
        dateGroup.playTimes[playTimeKey].schedules.sort(
          (a, b) => (a.sequence || 0) - (b.sequence || 0)
        )
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

      playTimeKeys.forEach((key) => {
        sortedPlayTimes[key] = dateGroup.playTimes[key]
      })

      // 重新计算allSchedules，按时段顺序排列
      const sortedAllSchedules = []
      playTimeKeys.forEach((key) => {
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
    const errorMsg = error?.message || (typeof error === 'string' ? error : '未知错误')
    if (window.$showNotification) {
      window.$showNotification('打印失败: ' + errorMsg, 'error')
    }
  } finally {
    // 延迟重置状态，给用户足够的时间看到"打印中"状态
    setTimeout(() => {
      isPrinting.value = false
    }, 2000)
  }
}

// 统一的PDF生成函数（支持打印和下载）
// 采用DOM分页策略，避免长图渲染导致的内存溢出和卡死
const exportPDFForPrint = async (action = 'print') => {
  if (!previewContent.value) throw new Error('预览内容未找到')

  const originalPrintPage = previewContent.value.querySelector('.print-page')
  if (!originalPrintPage) throw new Error('打印页面元素未找到')

  // 1. 准备PDF
  const pdf = new jsPDF({
    unit: 'mm',
    format: settings.value.paperSize.toLowerCase(),
    orientation: settings.value.orientation === 'landscape' ? 'l' : 'p'
  })

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()

  // 计算容器尺寸 (使用 A4 纸比例的像素值，确保清晰度)
  // A4 @ 96dpi approx 794x1123. Use 2x for better quality?
  // No, let's match standard pixel width for A4 usually used in web (794px).
  // The scale factor will be handled by toPng pixelRatio.
  const containerWidth = settings.value.paperSize === 'A4' ? 794 : 1123
  // 保持宽高比
  const ratio = pdfHeight / pdfWidth
  const containerHeight = Math.floor(containerWidth * ratio)

  // 创建分页容器（模拟单页纸张）
  const pageContainer = document.createElement('div')
  pageContainer.className = 'print-page' // 复用样式类
  pageContainer.style.cssText = `
    position: fixed;
    left: 0;
    top: 0;
    width: ${containerWidth}px;
    height: ${containerHeight}px;
    background: white;
    color: black;
    padding: 40px; 
    box-sizing: border-box;
    z-index: -9999;
    overflow: hidden;
  `

  // 辅助：强制样式
  const applyForceStyles = (el) => {
    el.style.setProperty('background', 'white', 'important')
    el.style.setProperty('color', 'black', 'important')
    el.style.setProperty('box-shadow', 'none', 'important')
  }

  document.body.appendChild(pageContainer)

  try {
    const sourceHeader = originalPrintPage.querySelector('.page-header')
    const sourceFooter = originalPrintPage.querySelector('.page-footer')
    const sourceContent = originalPrintPage.querySelector('.schedule-content')

    // 如果找不到标准结构，尝试直接克隆（兼容旧版）
    if (!sourceContent) {
      throw new Error('排期内容结构不符合分页要求')
    }

    // 辅助：渲染当前页并添加到PDF
    const renderPage = async (isFirst) => {
      applyForceStyles(pageContainer)

      // 预处理当前页面的图片
      await preprocessImages(pageContainer)

      // 稍微等待渲染
      await new Promise((r) => setTimeout(r, 100))

      const blob = await toBlob(pageContainer, {
        quality: 0.9,
        pixelRatio: 2, // 保持清晰度
        width: containerWidth,
        height: containerHeight,
        style: { visibility: 'visible', opacity: '1', background: 'white' }
      })

      if (!blob) throw new Error('页面渲染失败')
      const imgUrl = URL.createObjectURL(blob)

      if (!isFirst) pdf.addPage()
      pdf.addImage(imgUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST')

      // 清理
      URL.revokeObjectURL(imgUrl)
    }

    // 辅助：重置页面容器（添加页眉页脚）
    let currentContentWrapper = null

    const resetPageContainer = () => {
      pageContainer.innerHTML = ''

      // 添加 Header
      if (sourceHeader) {
        const h = sourceHeader.cloneNode(true)
        applyForceStyles(h)
        pageContainer.appendChild(h)
      }

      // 创建内容区域
      const cw = document.createElement('div')
      cw.className = 'schedule-content'
      cw.style.margin = '0'
      cw.style.padding = '0'
      pageContainer.appendChild(cw)
      currentContentWrapper = cw

      // 添加 Footer (绝对定位到底部)
      if (sourceFooter) {
        const f = sourceFooter.cloneNode(true)
        applyForceStyles(f)
        f.style.position = 'absolute'
        f.style.bottom = '30px'
        f.style.left = '40px'
        f.style.right = '40px'
        f.style.width = 'auto'
        pageContainer.appendChild(f)
      }
    }

    // 分页处理状态
    let isFirstPage = true
    resetPageContainer()

    // 检查是否溢出
    // 我们预留 footer 高度 (约50px)
    const MAX_CONTENT_HEIGHT = containerHeight - 60 // 简单的缓冲
    const checkOverflow = () => {
      return pageContainer.scrollHeight > containerHeight
    }

    // 递归处理节点
    // 策略：我们手动遍历主要结构，因为结构是已知的
    const dateGroups = sourceContent.querySelectorAll('.date-group')

    for (const group of dateGroups) {
      // 1. 克隆 Date Group 容器和标题
      const groupClone = group.cloneNode(false) // shallow
      const groupTitle = group.querySelector('.group-title').cloneNode(true)
      groupClone.appendChild(groupTitle)

      currentContentWrapper.appendChild(groupClone)

      // 检查标题是否溢出（极少见）
      if (checkOverflow()) {
        currentContentWrapper.removeChild(groupClone)
        await renderPage(isFirstPage)
        isFirstPage = false
        resetPageContainer()
        currentContentWrapper.appendChild(groupClone)
      }

      // 2. 遍历 Date Group 的子元素 (Playtime Groups 或 Schedule List)
      const children = Array.from(group.children).filter(
        (el) => !el.classList.contains('group-title')
      )

      for (const child of children) {
        if (child.classList.contains('playtime-groups')) {
          // 处理时段组
          const ptWrapper = document.createElement('div')
          ptWrapper.className = 'playtime-groups'
          groupClone.appendChild(ptWrapper)

          const ptGroups = child.querySelectorAll('.playtime-group')
          for (const ptGroup of ptGroups) {
            const ptGroupClone = ptGroup.cloneNode(false)
            const ptTitle = ptGroup.querySelector('.playtime-title').cloneNode(true)
            ptGroupClone.appendChild(ptTitle)
            ptWrapper.appendChild(ptGroupClone)

            const listWrapper = document.createElement('div')
            listWrapper.className = 'schedule-list'
            ptGroupClone.appendChild(listWrapper)

            let currentPtListWrapper = listWrapper

            // 遍历排期项
            const items = ptGroup.querySelectorAll('.schedule-item')
            for (const item of items) {
              const itemClone = item.cloneNode(true)
              currentPtListWrapper.appendChild(itemClone)

              if (checkOverflow()) {
                currentPtListWrapper.removeChild(itemClone)
                await renderPage(isFirstPage)
                isFirstPage = false
                resetPageContainer()

                // 在新页面重建路径
                const newGroup = group.cloneNode(false)
                newGroup.appendChild(group.querySelector('.group-title').cloneNode(true))
                currentContentWrapper.appendChild(newGroup)

                const newPtWrapper = document.createElement('div')
                newPtWrapper.className = 'playtime-groups'
                newGroup.appendChild(newPtWrapper)

                const newPtGroup = ptGroup.cloneNode(false)
                newPtGroup.appendChild(ptGroup.querySelector('.playtime-title').cloneNode(true))
                newPtWrapper.appendChild(newPtGroup)

                const newListWrapper = document.createElement('div')
                newListWrapper.className = 'schedule-list'
                newPtGroup.appendChild(newListWrapper)

                // 添加项
                newListWrapper.appendChild(itemClone)
                currentPtListWrapper = newListWrapper
              }
            }
          }
        } else if (child.classList.contains('schedule-list')) {
          // 处理直接列表
          const listWrapper = document.createElement('div')
          listWrapper.className = 'schedule-list'
          groupClone.appendChild(listWrapper)

          // 我们需要一个可变的引用
          let currentListWrapper = listWrapper

          const items = child.querySelectorAll('.schedule-item')
          for (const item of items) {
            const itemClone = item.cloneNode(true)
            currentListWrapper.appendChild(itemClone)

            if (checkOverflow()) {
              currentListWrapper.removeChild(itemClone)
              await renderPage(isFirstPage)
              isFirstPage = false
              resetPageContainer()

              // 重建路径
              const newGroup = group.cloneNode(false)
              newGroup.appendChild(group.querySelector('.group-title').cloneNode(true))
              currentContentWrapper.appendChild(newGroup)

              const newListWrapper = document.createElement('div')
              newListWrapper.className = 'schedule-list'
              newGroup.appendChild(newListWrapper)

              newListWrapper.appendChild(itemClone)
              currentListWrapper = newListWrapper
            }
          }
        }
      }
    }

    // 渲染最后一页
    await renderPage(isFirstPage)

    if (action === 'print') {
      pdf.autoPrint()
      window.open(pdf.output('bloburl'), '_blank')
    } else {
      const filename = `广播排期表_${formatDateRange().replace(/\n/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(filename)
      if (window.$showNotification) {
        window.$showNotification('PDF导出成功', 'success')
      }
    }
  } finally {
    if (document.body.contains(pageContainer)) {
      document.body.removeChild(pageContainer)
    }
  }
}

// 预下载图片并转换为base64
const downloadImageAsBase64 = async (url) => {
  try {
    // 使用代理API获取图片
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

    // 确保图片元素在打印时保持正确的样式
    if (img.classList.contains('school-logo-print')) {
      // 学校Logo保持原始比例，设置最大尺寸
      img.style.setProperty('max-width', '70px', 'important')
      img.style.setProperty('max-height', '60px', 'important')
      img.style.setProperty('width', 'auto', 'important')
      img.style.setProperty('height', 'auto', 'important')
      img.style.setProperty('object-fit', 'contain', 'important')
      img.style.setProperty('border-radius', '4px', 'important')
      img.style.setProperty('flex-shrink', '0', 'important')
    } else if (img.classList.contains('logo')) {
      // 系统Logo按原尺寸显示
      img.style.setProperty('width', '70px', 'important')
      img.style.setProperty('height', 'auto', 'important')
      img.style.setProperty('object-fit', 'contain', 'important')
      img.style.setProperty('border-radius', '4px', 'important')
    } else if (img.classList.contains('song-cover')) {
      // 歌曲封面保持固定尺寸
      img.style.setProperty('width', '40px', 'important')
      img.style.setProperty('height', '40px', 'important')
      img.style.setProperty('object-fit', 'cover', 'important')
      img.style.setProperty('border-radius', '4px', 'important')
    }
  })

  await Promise.all(imagePromises)
  // 等待一下让图片加载完成
  await new Promise((resolve) => setTimeout(resolve, 500))
}

const generateAndDownloadImage = async (sourceElement, filename, preProcessCallback = null) => {
  // 根据设置计算固定宽度，而不是依赖 offsetWidth (在移动端可能受屏幕宽度限制而不准确)
  let targetWidth = 800 // 默认为 A4 Portrait 宽度
  const s = settings.value

  if (s.paperSize === 'A4') {
    targetWidth = s.orientation === 'landscape' ? 1132 : 800
  } else if (s.paperSize === 'A3') {
    targetWidth = s.orientation === 'landscape' ? 1600 : 1132
  } else if (s.paperSize === 'Letter') {
    targetWidth = s.orientation === 'landscape' ? 1034 : 800
  } else if (s.paperSize === 'Legal') {
    targetWidth = s.orientation === 'landscape' ? 1318 : 800
  }

  const imageContainer = document.createElement('div')
  imageContainer.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      z-index: -9999;
      opacity: 0;
      background: white;
      color: black;
      width: ${targetWidth}px;
      padding: 40px;
      box-sizing: border-box;
      height: auto; 
      pointer-events: none;
    `

  const clonedPage = sourceElement.cloneNode(true)

  // 使用 setProperty 避免覆盖其他重要样式
  clonedPage.style.setProperty('background', 'white', 'important')
  clonedPage.style.setProperty('color', 'black', 'important')
  clonedPage.style.setProperty('box-sizing', 'border-box', 'important')
  clonedPage.style.setProperty('width', `${targetWidth - 80}px`, 'important') // 减去 padding (40px * 2)
  clonedPage.style.setProperty('margin', '0 auto', 'important')
  clonedPage.style.setProperty('padding', '0', 'important')
  clonedPage.style.setProperty('height', 'auto', 'important')
  clonedPage.style.setProperty('min-height', 'auto', 'important')
  clonedPage.style.setProperty('box-shadow', 'none', 'important')

  if (preProcessCallback) {
    const shouldProceed = preProcessCallback(clonedPage)
    if (shouldProceed === false) {
      return
    }
  }

  const allElements = clonedPage.querySelectorAll('*')
  allElements.forEach((el) => {
    if (el.style) {
      el.style.color = 'black !important'
      el.style.background = 'white !important'
      el.style.backgroundColor = 'white !important'
    }

    if (
      el.classList &&
      (el.classList.contains('print-page') ||
        el.classList.contains('page-header') ||
        el.classList.contains('page-footer') ||
        el.classList.contains('schedule-content'))
    ) {
      el.style.setProperty('background', 'white', 'important')
      el.style.setProperty('background-color', 'white', 'important')
    }
  })

  imageContainer.appendChild(clonedPage)
  document.body.appendChild(imageContainer)

  await preprocessImages(clonedPage)

  try {
    // 增加等待时间，确保渲染完成
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const contentHeight = imageContainer.offsetHeight || imageContainer.scrollHeight

    // 动态调整像素比
    let pixelRatio = 2
    if (contentHeight > 10000) {
      pixelRatio = 1
    } else if (contentHeight > 5000) {
      pixelRatio = 1.5
    }

    const blob = await toBlob(imageContainer, {
      quality: 0.9,
      backgroundColor: '#ffffff',
      width: targetWidth,
      height: contentHeight,
      pixelRatio: pixelRatio,
      skipAutoScale: true,
      style: {
        visibility: 'visible',
        opacity: '1'
      }
    })

    if (!blob) throw new Error('生成图片失败')

    const dataUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => URL.revokeObjectURL(dataUrl), 60000)
  } catch (error) {
    console.error(`生成图片失败 (${filename}):`, error)
    throw error
  } finally {
    if (document.body.contains(imageContainer)) {
      document.body.removeChild(imageContainer)
    }
  }
}

const exportSingleImage = async (printPage) => {
  await generateAndDownloadImage(
    printPage,
    `广播排期表_${formatDateRange().replace(/\n/g, '_')}_${new Date().toISOString().split('T')[0]}.png`
  )
}

const exportSplitImages = async (printPage) => {
  const dateGroups = printPage.querySelectorAll('.date-group')
  const months = new Set()

  dateGroups.forEach((group) => {
    const date = group.getAttribute('data-date')
    if (date) {
      months.add(date.substring(0, 7))
    }
  })

  const sortedMonths = Array.from(months).sort()

  if (sortedMonths.length === 0) {
    await exportSingleImage(printPage)
    return
  }

  for (const month of sortedMonths) {
    await generateAndDownloadImage(printPage, `广播排期表_${month}.png`, (clonedPage) => {
      const groups = clonedPage.querySelectorAll('.date-group')
      let hasContent = false

      groups.forEach((group) => {
        const date = group.getAttribute('data-date')
        if (!date || !date.startsWith(month)) {
          group.remove()
        } else {
          hasContent = true
        }
      })

      return hasContent
    })

    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  if (window.$showNotification) {
    window.$showNotification(`已完成分段导出，共 ${sortedMonths.length} 张图片`, 'success')
  }
}

const exportPDF = async () => {
  if (isExporting.value) return

  isExporting.value = true
  try {
    if (window.$showNotification) {
      window.$showNotification('正在准备PDF...', 'info')
    }

    // 复用 DOM 分页逻辑导出 PDF，避免长图导致内存溢出
    await exportPDFForPrint('download')
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
  if (isExportingImage.value) return

  if (!previewContent.value) {
    if (window.$showNotification) {
      window.$showNotification('预览内容未找到', 'error')
    }
    return
  }

  isExportingImage.value = true

  try {
    const printPage = previewContent.value.querySelector('.print-page') || previewContent.value

    // 获取实际内容高度
    const fullHeight = printPage.scrollHeight
    const MAX_HEIGHT = 15000

    // 检查设备是否为移动端
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )

    // 如果是移动端且内容过长，建议使用PDF导出
    if (isMobile && fullHeight > 5000) {
      if (
        confirm(
          '当前排期内容较长，在移动设备上生成长图可能会导致卡顿或失败。建议使用"导出PDF"功能，是否继续尝试生成长图？'
        )
      ) {
        // 用户坚持要生成，继续
      } else {
        isExportingImage.value = false
        return
      }
    }

    if (fullHeight > MAX_HEIGHT) {
      if (window.$showNotification) {
        window.$showNotification('排期内容过长，将自动分段导出', 'info')
      }
      await exportSplitImages(printPage)
    } else {
      await generateAndDownloadImage(
        printPage,
        `广播排期表_${formatDateRange().replace(/\n/g, '_')}_${new Date().toISOString().split('T')[0]}.png`
      )
    }

    if (window.$showNotification) {
      window.$showNotification('图片导出成功', 'success')
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

// 生命周期
onMounted(() => {
  loadSchedules()
})

// 监听设置变化，自动保存或刷新（如果需要）
watch(
  settings,
  () => {
    // 可以保存设置到 localStorage
  },
  { deep: true }
)
</script>

<style scoped>
/* 预览区域和打印样式的核心CSS - 保持原生CSS以确保精确控制 */

.preview-content {
  overflow-y: hidden;
  overflow-x: hidden;
  background: #ffffff;
  padding: 0;
  position: relative;
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
  margin-top: 2px;
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
  font-weight: bold;
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

/* 纸张大小 - 固定尺寸预览 */
.paper-a4 {
  width: 800px;
  height: 1132px;
  flex-shrink: 0;
}

.paper-a4.orientation-landscape {
  width: 1132px;
  height: 800px;
}

.paper-a3 {
  width: 1132px;
  height: 1600px;
  flex-shrink: 0;
}

.paper-a3.orientation-landscape {
  width: 1600px;
  height: 1132px;
}

.paper-letter {
  width: 800px;
  height: 1034px;
  flex-shrink: 0;
}

.paper-letter.orientation-landscape {
  width: 1034px;
  height: 800px;
}

.paper-legal {
  width: 800px;
  height: 1318px;
  flex-shrink: 0;
}

.paper-legal.orientation-landscape {
  width: 1318px;
  height: 800px;
}

/* 横向布局调整 */
.orientation-landscape .page-header {
  flex-direction: row;
  justify-content: space-between;
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
  .settings-panel {
    display: none !important;
  }

  .print-page {
    box-shadow: none !important;
    padding: 20mm !important;
    margin: 0 !important;
    width: 100% !important;
    max-width: none !important;
    box-sizing: border-box !important;
  }
}
</style>
