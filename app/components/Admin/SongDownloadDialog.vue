<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click="closeDialog">
      <Transition name="scale">
        <div v-if="show" class="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" @click.stop>
          
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
            <h3 class="text-sm font-black text-zinc-100 uppercase tracking-widest">下载歌曲</h3>
            <button class="text-zinc-500 hover:text-zinc-300 transition-colors" @click="closeDialog">
              <CloseIcon class="w-5 h-5" />
            </button>
          </div>

          <!-- 内容区域 -->
          <div class="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            
            <!-- 音质选择 -->
            <section class="space-y-3">
              <label class="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em] px-1">选择音质</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="option in extendedQualityOptions"
                  :key="option.value"
                  @click="selectedQuality = option.value"
                  class="flex flex-col p-4 rounded-2xl border text-left transition-all relative overflow-hidden group"
                  :class="[
                    selectedQuality === option.value 
                      ? 'bg-blue-600/10 border-blue-500 shadow-sm' 
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  ]"
                >
                  <div class="flex items-center justify-between mb-1 relative z-10">
                    <span class="text-xs font-bold transition-colors" :class="selectedQuality === option.value ? 'text-blue-400' : 'text-zinc-200'">{{ option.label }}</span>
                    <div v-if="selectedQuality === option.value" class="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                  </div>
                  <span class="text-[10px] text-zinc-500 relative z-10">{{ option.description }}</span>
                </button>
              </div>
            </section>

            <!-- 歌曲选择 -->
            <section class="space-y-3">
              <div class="flex items-center justify-between px-1">
                <label class="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em]">歌曲列表</label>
                <button 
                  @click="toggleSelectAll"
                  class="text-[10px] font-bold text-blue-500/80 hover:text-blue-400 transition-colors"
                >
                  {{ isAllSelected ? '取消全选' : '全选' }}
                </button>
              </div>
              
              <div class="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                <button
                  v-for="song in songs"
                  :key="song.id"
                  @click="toggleSongSelection(song.song.id)"
                  class="w-full flex items-center gap-3 p-3.5 hover:bg-zinc-800/30 transition-all text-left border-b border-zinc-800/30 last:border-0 group"
                >
                  <div class="w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0"
                    :class="[
                      selectedSongs.has(song.song.id) ? 'bg-blue-600 border-blue-600 shadow-sm' : 'bg-zinc-900 border-zinc-800 group-hover:border-zinc-700'
                    ]"
                  >
                    <Check v-if="selectedSongs.has(song.song.id)" class="w-2.5 h-2.5 text-white font-bold" stroke-width="3" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-zinc-300 truncate">{{ song.song.title }}</p>
                    <p class="text-[10px] text-zinc-500 truncate">{{ song.song.artist }}</p>
                  </div>
                  <div class="text-[9px] font-mono text-zinc-600 uppercase">{{ getPlatformShortName(song.song.musicPlatform) }}</div>
                </button>
                
                <div v-if="songs.length === 0" class="p-8 text-center text-zinc-600 text-[10px]">
                  暂无歌曲
                </div>
              </div>
            </section>

            <!-- 下载进度 -->
            <section v-if="downloading || downloadedCount > 0" class="space-y-3 pt-4 border-t border-zinc-800/50">
               <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                 <span class="text-zinc-400">下载进度</span>
                 <span class="text-blue-400">{{ downloadedCount }} / {{ totalCount }}</span>
               </div>
               <div class="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50">
                 <div class="h-full bg-blue-600 transition-all duration-300 ease-out" :style="{ width: `${totalCount > 0 ? (downloadedCount / totalCount) * 100 : 0}%` }"></div>
               </div>
               <div class="text-[10px] text-zinc-500 truncate">
                 <template v-if="downloading">
                   {{ currentDownloadSong ? `正在下载: ${currentDownloadSong}` : '准备中...' }}
                 </template>
                 <template v-else>
                   {{ downloadErrors.length > 0 ? '下载完成，部分失败' : '下载完成' }}
                 </template>
               </div>
               
               <!-- 错误列表 -->
               <div v-if="downloadErrors.length > 0" class="bg-red-500/5 border border-red-500/10 rounded-xl p-3 space-y-2">
                 <div class="text-[10px] font-bold text-red-400 flex items-center gap-2">
                   <AlertTriangle class="w-3 h-3" />
                   下载失败 ({{ downloadErrors.length }})
                 </div>
                 <div class="max-h-[60px] overflow-y-auto custom-scrollbar space-y-1">
                   <div v-for="error in downloadErrors" :key="error.id" class="text-[9px] text-red-500/70 truncate">
                     {{ error.title }} - {{ error.error }}
                   </div>
                 </div>
               </div>
            </section>
          </div>

          <!-- 底部按钮 -->
          <div class="p-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between shrink-0">
             <div class="text-[11px] font-black text-zinc-500 uppercase tracking-widest">
                已选择 <span class="text-blue-400">{{ selectedSongs.size }}</span> 首歌曲
             </div>
             <div class="flex items-center gap-2">
               <button 
                 @click="closeDialog" 
                 class="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider"
                 :disabled="downloading"
               >
                 取消
               </button>
               <button 
                 v-if="!downloading && downloadedCount > 0"
                 @click="closeDialog"
                 class="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl border border-zinc-700 transition-all uppercase tracking-wider"
               >
                 关闭
               </button>
               <button 
                 v-else
                 @click="startDownload"
                 :disabled="selectedSongs.size === 0 || downloading"
                 class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all uppercase tracking-wider flex items-center gap-2"
               >
                 <Download v-if="!downloading" class="w-3.5 h-3.5" />
                 <span v-else class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                 {{ downloading ? '下载中...' : '开始下载' }}
               </button>
             </div>
          </div>

        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useAudioQuality } from '~/composables/useAudioQuality'
import { getMusicUrl } from '~/utils/musicUrl'
import { X as CloseIcon, Check, Download, AlertTriangle } from 'lucide-vue-next'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  songs: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close'])

// 音质相关
const { getQualityOptions, getQuality } = useAudioQuality()

// 音质描述映射
const qualityDescriptions = {
  standard: '节省流量',
  higher: '高品质体验',
  exhigh: '极高音质',
  lossless: '母带级音质',
  hires: '极点解析'
}

// 扩展音质选项，添加描述
const extendedQualityOptions = computed(() => {
  const options = getQualityOptions('netease')
  return options.map(opt => ({
    ...opt,
    description: qualityDescriptions[opt.value] || '标准音质'
  }))
})

const selectedQuality = ref(getQuality('netease'))

// 歌曲选择
const selectedSongs = ref(new Set())

// 是否全选
const isAllSelected = computed(() => {
  return props.songs.length > 0 && selectedSongs.value.size === props.songs.length
})

// 下载状态
const downloading = ref(false)
const downloadedCount = ref(0)
const totalCount = ref(0)
const currentDownloadSong = ref('')
const downloadErrors = ref([])

// 获取平台简写
const getPlatformShortName = (platform) => {
  switch (platform) {
    case 'netease': return 'WY'
    case 'netease-podcast': return 'DJ'
    case 'tencent': return 'QQ'
    case 'bilibili': return 'BL'
    default: return 'OT'
  }
}

// 切换全选/取消全选
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedSongs.value = new Set()
  } else {
    selectedSongs.value = new Set(props.songs.map(song => song.song.id))
  }
}

// 切换歌曲选择状态
const toggleSongSelection = (songId) => {
  if (selectedSongs.value.has(songId)) {
    selectedSongs.value.delete(songId)
  } else {
    selectedSongs.value.add(songId)
  }
}

// 关闭对话框
const closeDialog = () => {
  // 即使在下载中也可以关闭（后台运行），但如果下载中，不触发close事件，而是隐藏
  emit('close')
}

// 获取音乐播放URL（直接使用utils中的统一方法）
const getMusicUrlForDownload = async (song, quality, retryCount = 0) => {
  try {
    // 检查是否为播客内容
    const isPodcast = song.musicPlatform === 'netease-podcast' || song.sourceInfo?.type === 'voice' || (song.sourceInfo?.source === 'netease-backup' && song.sourceInfo?.type === 'voice')
    const options = isPodcast ? { unblock: false } : {}

    // 直接调用统一的getMusicUrl方法，它会自动处理playUrl优先级
    const url = await getMusicUrl(song.musicPlatform, song.musicId, song.playUrl, options)
    if (!url) {
      throw new Error('无法获取音乐播放链接')
    }
    return url
  } catch (error) {
    console.error('获取音乐播放链接失败:', error)

    // 如果是第一次失败且有音乐平台信息，则自动重试一次
    if (retryCount === 0 && song.musicPlatform && song.musicId) {
      console.log(`正在重试获取音乐链接: ${song.musicPlatform}, ${song.musicId}`)
      await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒后重试
      return getMusicUrlForDownload(song, quality, 1)
    }

    throw new Error('获取音乐播放链接失败: ' + error.message)
  }
}

// 下载单个文件
const downloadFile = async (url, filename) => {
  const tryDownload = async (targetUrl) => {
    const response = await fetch(targetUrl)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.blob()
  }

  let blob

  try {
    // 尝试直接下载
    blob = await tryDownload(url)
  } catch (error) {
    throw new Error('下载失败: ' + error.message)
  }

  const objectUrl = window.URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  window.URL.revokeObjectURL(objectUrl)
}

// 开始下载
const startDownload = async () => {
  if (selectedSongs.value.size === 0) return

  downloading.value = true
  downloadedCount.value = 0
  downloadErrors.value = []

  const selectedSongsList = props.songs.filter(song => selectedSongs.value.has(song.song.id))
  totalCount.value = selectedSongsList.length

  for (const songItem of selectedSongsList) {
    const song = songItem.song
    currentDownloadSong.value = `${song.artist} - ${song.title}`

    try {
      // 获取音频URL
      const audioUrl = await getMusicUrlForDownload(song, selectedQuality.value)

      // 生成文件名：歌手名 - 歌曲名.ext
      let extension = 'mp3'
      if (audioUrl.includes('.m4a')) extension = 'm4a'
      else if (audioUrl.includes('.flac')) extension = 'flac'
      else if (audioUrl.includes('.wav')) extension = 'wav'
      else if (audioUrl.includes('.ogg')) extension = 'ogg'

      const filename = `${song.artist} - ${song.title}.${extension}`
          .replace(/[<>:"/\\|?*]/g, '_') // 替换不合法的文件名字符

      // 下载文件
      await downloadFile(audioUrl, filename)

    } catch (error) {
      console.error(`下载失败: ${song.title}`, error)
      downloadErrors.value.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        error: error.message
      })
    } finally {
      // 无论成功失败，都更新进度
      downloadedCount.value++
    }

    // 添加延迟避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 500))
  }


  currentDownloadSong.value = ''

  // 显示完成通知
  if (window.$showNotification) {
    const successCount = downloadedCount.value - downloadErrors.value.length
    if (downloadErrors.value.length === 0) {
      window.$showNotification(`成功下载 ${successCount} 首歌曲`, 'success')
    } else {
      window.$showNotification(`下载完成，成功 ${successCount} 首，失败 ${downloadErrors.value.length} 首`, 'warning')
    }
  }

  // 延迟关闭对话框（仅在没有错误时）
  if (downloadErrors.value.length === 0) {
    setTimeout(() => {
      downloading.value = false
      closeDialog()
    }, 2000)
  } else {
    downloading.value = false
  }
}

// 监听显示状态变化，重置状态
watch(() => props.show, (newShow) => {
  if (newShow) {
    selectedSongs.value = new Set(props.songs.map(song => song.song.id))
    // 如果没有正在下载，重置状态
    if (!downloading.value) {
      downloadedCount.value = 0
      totalCount.value = 0
      currentDownloadSong.value = ''
      downloadErrors.value = []
    }
    selectedQuality.value = getQuality('netease')
  }
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  transform: scale(0.95);
  opacity: 0;
}
</style>