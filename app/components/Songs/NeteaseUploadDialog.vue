<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click="closeDialog">
      <Transition name="scale">
        <div v-if="show" class="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" @click.stop>
          
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
            <h3 class="text-sm font-black text-zinc-100 uppercase tracking-widest">上传到网易云音乐</h3>
            <button class="text-zinc-500 hover:text-zinc-300 transition-colors" @click="closeDialog">
              <Icon name="x" :size="20" />
            </button>
          </div>

          <!-- 内容区域 -->
          <div class="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            
            <!-- 登录状态检查 -->
            <section v-if="!isLoggedIn" class="space-y-3">
              <div class="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
                <p class="text-xs text-yellow-400 mb-3">请先登录网易云音乐账号</p>
                <button
                  @click="showLoginModal"
                  class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  立即登录
                </button>
              </div>
            </section>

            <template v-else>
              <!-- 音质选择 -->
              <section class="space-y-3">
                <label class="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em] px-1">选择音质</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="option in qualityOptions"
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

              <!-- 歌曲信息 -->
              <section class="space-y-3">
                <label class="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em] px-1">歌曲信息</label>
                <div class="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-2">
                  <div class="flex items-center gap-3">
                    <img v-if="song?.img || song?.cover" :src="song.img || song.cover" alt="封面" class="w-12 h-12 rounded-lg object-cover" />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-bold text-zinc-200 truncate">{{ song?.name || song?.song || song?.title || '未知歌曲' }}</p>
                      <p class="text-xs text-zinc-500 truncate">{{ song?.singer || song?.artist || '未知歌手' }}</p>
                    </div>
                  </div>
                </div>
              </section>

              <!-- 上传进度 -->
              <section v-if="uploading || uploadProgress > 0" class="space-y-3 pt-4 border-t border-zinc-800/50">
                <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span class="text-zinc-400">{{ uploadStatus }}</span>
                  <span class="text-blue-400">{{ uploadProgress }}%</span>
                </div>
                <div class="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50 relative">
                  <div 
                    class="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-300 ease-out relative overflow-hidden" 
                    :style="{ width: `${uploadProgress}%` }"
                  >
                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                  </div>
                </div>
                <p v-if="uploadMessage" class="text-[10px] text-zinc-500 text-center">{{ uploadMessage }}</p>
              </section>
            </template>
          </div>

          <!-- Footer -->
          <div v-if="isLoggedIn" class="p-4 border-t border-zinc-800 shrink-0 flex gap-3">
            <button
              @click="closeDialog"
              class="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-colors uppercase tracking-wider"
              :disabled="uploading"
            >
              取消
            </button>
            <button
              @click="startUpload"
              class="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="uploading"
            >
              {{ uploading ? '上传中...' : '开始上传' }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import { useAudioQuality, QUALITY_OPTIONS } from '~/composables/useAudioQuality'

interface Props {
  show: boolean
  song: any // QQ音乐歌曲对象
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'upload-success'): void
  (e: 'show-login'): void
}>()

// 音质选项 (QQ音乐)
const qualityOptions = QUALITY_OPTIONS.tencent

const selectedQuality = ref(8) // 默认HQ高音质
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')
const uploadMessage = ref('')

// 检查登录状态
const isLoggedIn = computed(() => {
  if (process.client) {
    const cookie = localStorage.getItem('netease_cookie')
    return !!cookie
  }
  return false
})

const closeDialog = () => {
  if (!uploading.value) {
    emit('close')
  }
}

const showLoginModal = () => {
  emit('show-login')
}

// 获取网易云音乐Cookie
const getNeteaseCookie = () => {
  if (process.client) {
    return localStorage.getItem('netease_cookie') || ''
  }
  return ''
}

// 获取QQ音乐下载链接
const getQQMusicUrl = async (strMediaMid: string, quality: number): Promise<string> => {
  uploadStatus.value = '获取下载链接'
  
  console.log('获取QQ音乐链接，参数:', { strMediaMid, quality })
  
  if (!strMediaMid) {
    throw new Error('缺少歌曲ID (strMediaMid)')
  }
  
  // 使用vkeys API获取QQ音乐链接
  const apiUrl = `https://api.vkeys.cn/v2/music/tencent?id=${strMediaMid}&quality=${quality}`
  
  console.log('请求URL:', apiUrl)
  
  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })

  if (!response.ok) {
    throw new Error(`获取链接失败: ${response.status}`)
  }

  const data = await response.json()
  console.log('API响应:', data)
  
  if (data.code === 200 && data.data && data.data.url) {
    let url = data.data.url
    // 将HTTP URL改为HTTPS
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://')
    }
    return url
  }

  throw new Error('无法获取有效的播放链接')
}

// 下载音频文件
const downloadAudio = async (url: string): Promise<Blob> => {
  uploadStatus.value = '正在下载音频'
  
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status}`)
  }

  const contentLength = response.headers.get('content-length')
  const total = contentLength ? parseInt(contentLength, 10) : 0

  if (!response.body) {
    throw new Error('响应体为空')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let receivedLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    chunks.push(value)
    receivedLength += value.length

    if (total > 0) {
      // 下载进度占总进度的50%
      uploadProgress.value = Math.floor((receivedLength / total) * 50)
    }
  }

  const blob = new Blob(chunks as BlobPart[])
  uploadProgress.value = 50
  return blob
}

// 上传到网易云音乐
const uploadToNetease = async (audioBlob: Blob, filename: string) => {
  uploadStatus.value = '正在上传到网易云音乐'
  uploadProgress.value = 50

  const formData = new FormData()
  formData.append('songFile', audioBlob, filename)

  const cookie = getNeteaseCookie()
  
  // 使用网易云音乐备用源 API
  const uploadUrl = `https://api.voicehub.lao-shui.top/cloud?time=${Date.now()}&cookie=${encodeURIComponent(cookie)}`
  
  console.log('上传URL:', uploadUrl)
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // 监听上传进度
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        // 上传进度占总进度的50%，从50%到100%
        const uploadPercent = (e.loaded / e.total) * 50
        uploadProgress.value = 50 + Math.floor(uploadPercent)
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          console.log('上传响应:', response)
          resolve(response)
        } catch (e) {
          resolve(xhr.responseText)
        }
      } else {
        reject(new Error(`上传失败: ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('网络错误'))
    })

    xhr.addEventListener('abort', () => {
      reject(new Error('上传已取消'))
    })

    xhr.open('POST', uploadUrl)
    xhr.send(formData)
  })
}

// 开始上传流程
const startUpload = async () => {
  if (uploading.value) return

  uploading.value = true
  uploadProgress.value = 0
  uploadStatus.value = '准备中'
  uploadMessage.value = ''

  try {
    console.log('开始上传，歌曲信息:', props.song)
    console.log('歌曲对象的所有键:', Object.keys(props.song))
    
    // 获取歌曲ID，尝试所有可能的字段
    const musicId = props.song.strMediaMid 
      || props.song.songmid 
      || props.song.songId 
      || props.song.musicId
      || props.song.id
      || props.song.mid
    
    console.log('尝试的字段值:', {
      strMediaMid: props.song.strMediaMid,
      songmid: props.song.songmid,
      songId: props.song.songId,
      musicId: props.song.musicId,
      id: props.song.id,
      mid: props.song.mid
    })
    
    if (!musicId) {
      console.error('所有可能的ID字段都为空')
      throw new Error('无法获取歌曲ID，请重试')
    }
    
    console.log('使用的音乐ID:', musicId)
    
    // 1. 获取QQ音乐下载链接
    uploadMessage.value = '正在从QQ音乐获取音频链接...'
    
    const musicUrl = await getQQMusicUrl(musicId, selectedQuality.value)
    
    if (!musicUrl) {
      throw new Error('无法获取音乐播放链接')
    }

    console.log('获取到的播放链接:', musicUrl)

    // 2. 下载音频文件
    uploadMessage.value = '正在下载音频文件...'
    const audioBlob = await downloadAudio(musicUrl)

    // 3. 上传到网易云音乐
    uploadMessage.value = '正在上传到网易云音乐云盘...'
    const songName = props.song.name || props.song.song || props.song.title || '未知歌曲'
    const artistName = props.song.singer || props.song.artist || '未知歌手'
    const filename = `${artistName} - ${songName}.mp3`
    await uploadToNetease(audioBlob, filename)

    // 4. 完成
    uploadProgress.value = 100
    uploadStatus.value = '上传完成'
    uploadMessage.value = '歌曲已成功上传到您的网易云音乐云盘'

    if ((window as any).$showNotification) {
      (window as any).$showNotification('上传成功', 'success')
    }

    emit('upload-success')

    // 延迟关闭对话框
    setTimeout(() => {
      closeDialog()
    }, 1500)

  } catch (error: any) {
    console.error('上传失败:', error)
    uploadStatus.value = '上传失败'
    uploadMessage.value = error.message || '未知错误'
    
    if ((window as any).$showNotification) {
      (window as any).$showNotification(`上传失败: ${error.message}`, 'error')
    }
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.3s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}
</style>
