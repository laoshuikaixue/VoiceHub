<template>
  <div v-if="show" class="download-dialog-overlay" @click="closeDialog">
    <div class="download-dialog" @click.stop>
      <div class="dialog-header">
        <h3>下载歌曲</h3>
        <button class="close-btn" @click="closeDialog">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <line x1="18" x2="6" y1="6" y2="18"/>
            <line x1="6" x2="18" y1="6" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="dialog-content">
        <!-- 音质选择 -->
        <div class="quality-section">
          <h4>选择音质</h4>
          <div class="quality-options">
            <div
                v-for="option in qualityOptions"
                :key="option.value"
                :class="{ 'active': selectedQuality === option.value }"
                class="quality-option"
                @click="selectedQuality = option.value"
            >
              <div class="option-info">
                <span class="option-label">{{ option.label }}</span>
                <span class="option-description">{{ option.description }}</span>
              </div>
              <div class="option-radio">
                <div v-if="selectedQuality === option.value" class="radio-checked"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 歌曲选择 -->
        <div class="songs-section">
          <div class="section-header">
            <h4>选择要下载的歌曲</h4>
            <div class="select-actions">
              <button class="select-btn" @click="selectAll">全选</button>
              <button class="select-btn" @click="selectNone">取消全选</button>
            </div>
          </div>

          <div class="songs-list">
            <div
                v-for="song in songs"
                :key="song.id"
                :class="{ 'selected': selectedSongs.has(song.song.id) }"
                class="song-item"
                @click="toggleSongSelection(song.song.id)"
            >
              <div class="song-checkbox">
                <div v-if="selectedSongs.has(song.song.id)" class="checkbox-checked">
                  <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                </div>
              </div>
              <div class="song-info">
                <div class="song-title">{{ song.song.title }}</div>
                <div class="song-artist">{{ song.song.artist }}</div>
                <div class="song-meta">
                  <span class="song-platform">{{ getPlatformName(song.song.musicPlatform) }}</span>
                  <span class="song-requester">投稿: {{ song.song.requester }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <div class="download-info">
          <span>已选择 {{ selectedSongs.size }} 首歌曲</span>
        </div>
        <div class="dialog-actions">
          <button class="cancel-btn" @click="closeDialog">取消</button>
          <button
              :disabled="selectedSongs.size === 0 || downloading"
              class="download-btn"
              @click="startDownload"
          >
            {{ downloading ? '下载中...' : '开始下载' }}
          </button>
        </div>
      </div>

      <!-- 下载进度 -->
      <div v-if="downloading" class="download-progress">
        <div class="progress-header">
          <span>下载进度: {{ downloadedCount }}/{{ totalCount }}</span>
          <span>{{ Math.round((downloadedCount / totalCount) * 100) }}%</span>
        </div>
        <div class="progress-bar">
          <div
              :style="{ width: `${(downloadedCount / totalCount) * 100}%` }"
              class="progress-fill"
          ></div>
        </div>
        <div v-if="currentDownloadSong" class="current-download">
          正在下载: {{ currentDownloadSong }}
        </div>
        <div v-if="downloadErrors.length > 0" class="download-errors">
          <details>
            <summary>下载失败的歌曲 ({{ downloadErrors.length }})</summary>
            <ul>
              <li v-for="error in downloadErrors" :key="error.id">
                {{ error.title }} - {{ error.artist }}: {{ error.error }}
              </li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {computed, ref, watch} from 'vue'
import {useAudioQuality} from '~/composables/useAudioQuality'
import {getMusicUrl} from '~/utils/musicUrl'

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
const {getQualityOptions, getQuality} = useAudioQuality()

// 获取默认音质选项（使用网易云音乐的选项作为通用选项）
const qualityOptions = computed(() => {
  return getQualityOptions('netease')
})

const selectedQuality = ref(getQuality('netease'))

// 歌曲选择
const selectedSongs = ref(new Set())

// 下载状态
const downloading = ref(false)
const downloadedCount = ref(0)
const totalCount = ref(0)
const currentDownloadSong = ref('')
const downloadErrors = ref([])

// 获取平台名称
const getPlatformName = (platform) => {
  switch (platform) {
    case 'netease':
      return '网易云音乐'
    case 'netease-podcast':
      return '网易云音乐-播客'
    case 'tencent':
      return 'QQ音乐'
    case 'bilibili':
      return '哔哩哔哩'
    case null:
    case undefined:
    case '':
      return '自定义链接'
    default:
      return '未知平台'
  }
}

// 选择所有歌曲
const selectAll = () => {
  selectedSongs.value = new Set(props.songs.map(song => song.song.id))
}

// 取消选择所有歌曲
const selectNone = () => {
  selectedSongs.value = new Set()
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
  if (!downloading.value) {
    emit('close')
  }
}

// 获取音乐播放URL（直接使用utils中的统一方法）
const getMusicUrlForDownload = async (song, quality, retryCount = 0) => {
  try {
    // 检查是否为播客内容
    const isPodcast = song.musicPlatform === 'netease-podcast' || song.sourceInfo?.type === 'voice' || (song.sourceInfo?.source === 'netease-backup' && song.sourceInfo?.type === 'voice')
    const options = isPodcast ? {unblock: false} : {}

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

  // 针对 Bilibili 等已知必须使用代理的链接
  const forceProxy = url.includes('bilivideo.com') ||
      url.includes('hdslb.com') ||
      url.includes('bilibili.com') ||
      url.includes('googlevideo.com')

  try {
    if (forceProxy) {
      blob = await tryDownload(`/api/proxy/download?url=${encodeURIComponent(url)}`)
    } else {
      try {
        // 尝试直接下载
        blob = await tryDownload(url)
      } catch (e) {
        console.warn(`直接下载失败 (${e.message})，尝试使用代理下载: ${url}`)
        // 直接下载失败（如CORS错误），尝试代理
        blob = await tryDownload(`/api/proxy/download?url=${encodeURIComponent(url)}`)
      }
    }
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

      downloadedCount.value++
    } catch (error) {
      console.error(`下载失败: ${song.title}`, error)
      downloadErrors.value.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        error: error.message
      })
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

  // 延迟关闭对话框
  setTimeout(() => {
    downloading.value = false
    if (downloadErrors.value.length === 0) {
      closeDialog()
    }
  }, 2000)
}

// 监听显示状态变化，重置状态
watch(() => props.show, (newShow) => {
  if (newShow) {
    selectedSongs.value = new Set()
    downloading.value = false
    downloadedCount.value = 0
    totalCount.value = 0
    currentDownloadSong.value = ''
    downloadErrors.value = []
    selectedQuality.value = getQuality('netease')
  }
})
</script>

<style scoped>
.download-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.download-dialog {
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #2a2a2a;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  color: #e2e8f0;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #2a2a2a;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: #fff;
  background: #333;
}

.close-btn svg {
  width: 20px;
  height: 20px;
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.quality-section {
  margin-bottom: 24px;
}

.quality-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 500;
}

.quality-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quality-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quality-option:hover {
  background: #333;
  border-color: #4a4a4a;
}

.quality-option.active {
  background: #667eea;
  border-color: #667eea;
}

.option-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.option-label {
  font-weight: 500;
}

.option-description {
  font-size: 12px;
  color: #888;
}

.quality-option.active .option-description {
  color: rgba(255, 255, 255, 0.8);
}

.option-radio {
  width: 20px;
  height: 20px;
  border: 2px solid #4a4a4a;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quality-option.active .option-radio {
  border-color: white;
}

.radio-checked {
  width: 10px;
  height: 10px;
  background: white;
  border-radius: 50%;
}

.songs-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 500;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.select-actions {
  display: flex;
  gap: 8px;
}

.select-btn {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #e2e8f0;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.select-btn:hover {
  background: #333;
  border-color: #4a4a4a;
}

.songs-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
}

.song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid #2a2a2a;
  cursor: pointer;
  transition: all 0.2s ease;
}

.song-item:last-child {
  border-bottom: none;
}

.song-item:hover {
  background: #2a2a2a;
}

.song-item.selected {
  background: rgba(102, 126, 234, 0.1);
  border-color: rgba(102, 126, 234, 0.3);
}

.song-checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid #4a4a4a;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.song-item.selected .song-checkbox {
  background: #667eea;
  border-color: #667eea;
}

.checkbox-checked svg {
  width: 12px;
  height: 12px;
  color: white;
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-title {
  font-weight: 500;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  color: #888;
  font-size: 14px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-top: 1px solid #2a2a2a;
}

.download-info {
  color: #888;
  font-size: 14px;
}

.dialog-actions {
  display: flex;
  gap: 12px;
}

.cancel-btn {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #e2e8f0;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: #333;
  border-color: #4a4a4a;
}

.download-btn {
  background: #667eea;
  border: 1px solid #667eea;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.download-btn:hover:not(:disabled) {
  background: #5a6fd8;
  border-color: #5a6fd8;
}

.download-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.download-progress {
  padding: 20px;
  border-top: 1px solid #2a2a2a;
  background: #1a1a1a;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #2a2a2a;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: #667eea;
  transition: width 0.3s ease;
}

.current-download {
  font-size: 14px;
  color: #888;
  margin-bottom: 12px;
}

.download-errors {
  margin-top: 12px;
}

.download-errors details {
  background: #2a1a1a;
  border: 1px solid #4a2a2a;
  border-radius: 6px;
  padding: 8px;
}

.download-errors summary {
  cursor: pointer;
  font-weight: 500;
  color: #ff6b6b;
}

.download-errors ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.download-errors li {
  margin-bottom: 4px;
  font-size: 12px;
  color: #ccc;
}
</style>