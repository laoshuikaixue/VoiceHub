<template>
  <Transition name="fade">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click="closeDialog"
    >
      <Transition name="scale">
        <div
          v-if="show"
          class="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          @click.stop
        >
          <!-- 头部 -->
          <div class="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
            <h3 class="text-sm font-black text-zinc-100 uppercase tracking-widest">
              上传到网易云音乐
            </h3>
            <button
              class="text-zinc-500 hover:text-zinc-300 transition-colors"
              @click="closeDialog"
            >
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
                  class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                  @click="showLoginModal"
                >
                  立即登录
                </button>
              </div>
            </section>

            <template v-else>
              <!-- 音质选择 -->
              <section class="space-y-3">
                <label class="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em] px-1"
                  >选择音质</label
                >
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="option in qualityOptions"
                    :key="option.value"
                    class="flex flex-col p-4 rounded-2xl border text-left transition-all relative overflow-hidden group"
                    :class="[
                      selectedQuality === option.value
                        ? 'bg-blue-600/10 border-blue-500 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                    ]"
                    @click="selectedQuality = option.value"
                  >
                    <div class="flex items-center justify-between mb-1 relative z-10">
                      <span
                        class="text-xs font-bold transition-colors"
                        :class="
                          selectedQuality === option.value ? 'text-blue-400' : 'text-zinc-200'
                        "
                        >{{ option.label }}</span
                      >
                      <div
                        v-if="selectedQuality === option.value"
                        class="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                      />
                    </div>
                    <span class="text-[10px] text-zinc-500 relative z-10">{{
                      option.description
                    }}</span>
                  </button>
                </div>
              </section>

              <!-- 歌曲信息 -->
              <section class="space-y-3">
                <label class="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em] px-1"
                  >歌曲信息</label
                >
                <div class="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-2">
                  <div class="flex items-center gap-3">
                    <img
                      v-if="song?.img || song?.cover"
                      :src="song.img || song.cover"
                      alt="封面"
                      class="w-12 h-12 rounded-lg object-cover"
                    >
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-bold text-zinc-200 truncate">{{ songName }}</p>
                      <p class="text-xs text-zinc-500 truncate">{{ artistName }}</p>
                    </div>
                  </div>
                </div>
              </section>

              <!-- 上传进度 -->
              <section
                v-if="uploading || uploadProgress > 0"
                class="space-y-3 pt-4 border-t border-zinc-800/50"
              >
                <div
                  class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider"
                >
                  <span class="text-zinc-400">{{ uploadStatus }}</span>
                  <span class="text-blue-400">{{ uploadProgress }}%</span>
                </div>
                <div
                  class="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50 relative"
                >
                  <div
                    class="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-300 ease-out relative overflow-hidden"
                    :style="{ width: `${uploadProgress}%` }"
                  >
                    <div
                      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                    />
                  </div>
                </div>
                <p v-if="uploadMessage" class="text-[10px] text-zinc-500 text-center">
                  {{ uploadMessage }}
                </p>
              </section>
            </template>
          </div>

          <!-- Footer -->
          <div v-if="isLoggedIn" class="p-4 border-t border-zinc-800 shrink-0 flex gap-3">
            <button
              class="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-colors uppercase tracking-wider"
              :disabled="uploading"
              @click="closeDialog"
            >
              取消
            </button>
            <button
              class="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="uploading"
              @click="startUpload"
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
import { ref, watch, onMounted, computed } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import { useAudioQuality, QUALITY_OPTIONS } from '~/composables/useAudioQuality'
import { useToast } from '~/composables/useToast'
import CryptoJS from 'crypto-js'

interface Props {
  show: boolean
  song: any // QQ音乐歌曲对象
}

const props = defineProps<Props>()

const songName = computed(
  () => props.song?.name || props.song?.song || props.song?.title || '未知歌曲'
)
const artistName = computed(() => props.song?.singer || props.song?.artist || '未知歌手')
const albumName = computed(() => props.song?.album || '未知专辑')

const emit = defineEmits<{
  (e: 'close' | 'upload-success' | 'show-login'): void
}>()

const { success: showSuccess, error: showError } = useToast()

// 音质选项 (QQ音乐)
const qualityOptions = QUALITY_OPTIONS.tencent

const selectedQuality = ref(8) // 默认HQ高音质
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')
const uploadMessage = ref('')
const isLoggedIn = ref(false)

// 检查登录状态
const checkLoginStatus = () => {
  if (import.meta.client) {
    const cookie = localStorage.getItem('netease_cookie')
    isLoggedIn.value = !!cookie
  }
}

onMounted(() => {
  checkLoginStatus()
})

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      checkLoginStatus()
    }
  }
)

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
  if (import.meta.client) {
    return localStorage.getItem('netease_cookie') || ''
  }
  return ''
}

// 获取QQ音乐下载链接
const getQQMusicUrl = async (strMediaMid: string, quality: number): Promise<string> => {
  uploadStatus.value = '获取下载链接'

  // console.log('获取QQ音乐链接，参数:', { strMediaMid, quality })

  if (!strMediaMid) {
    throw new Error('缺少歌曲ID (strMediaMid)')
  }

  // 使用vkeys API获取QQ音乐链接
  const apiUrl = `https://api.vkeys.cn/v2/music/tencent?id=${strMediaMid}&quality=${quality}`

  // console.log('请求URL:', apiUrl)

  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })

  if (!response.ok) {
    throw new Error(`获取链接失败: ${response.status}`)
  }

  const data = await response.json()
  // console.log('API响应:', data)

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

// 检测音频文件类型 (通过文件头Magic Number)
const detectAudioType = async (blob: Blob): Promise<string | null> => {
  const arr = new Uint8Array(await blob.slice(0, 12).arrayBuffer())

  // FLAC: 66 4C 61 43
  if (arr[0] === 0x66 && arr[1] === 0x4c && arr[2] === 0x61 && arr[3] === 0x43) {
    return 'flac'
  }

  // ID3v2 (MP3): 49 44 33
  if (arr[0] === 0x49 && arr[1] === 0x44 && arr[2] === 0x33) {
    return 'mp3'
  }

  // MP3 (No ID3, Frame Sync): FF Fx
  if (arr[0] === 0xff && (arr[1] & 0xe0) === 0xe0) {
    return 'mp3'
  }

  // Ogg: 4F 67 67 53
  if (arr[0] === 0x4f && arr[1] === 0x67 && arr[2] === 0x67 && arr[3] === 0x53) {
    return 'ogg'
  }

  // WAV: RIFF ... WAVE
  if (
    arr[0] === 0x52 &&
    arr[1] === 0x49 &&
    arr[2] === 0x46 &&
    arr[3] === 0x46 &&
    arr[8] === 0x57 &&
    arr[9] === 0x41 &&
    arr[10] === 0x56 &&
    arr[11] === 0x45
  ) {
    return 'wav'
  }

  // M4A (ftyp M4A): ... ftypM4A
  // Usually starts at offset 4: 66 74 79 70 4D 34 41 20
  // We check for ftyp at index 4 and M4A at index 8
  if (
    arr[4] === 0x66 &&
    arr[5] === 0x74 &&
    arr[6] === 0x79 &&
    arr[7] === 0x70 &&
    arr[8] === 0x4d &&
    arr[9] === 0x34 &&
    arr[10] === 0x41 &&
    arr[11] === 0x20
  ) {
    return 'm4a'
  }

  return null
}

// 下载音频文件
const downloadAudio = async (url: string): Promise<{ blob: Blob; ext: string }> => {
  uploadStatus.value = '正在下载音频'

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status}`)
  }

  const contentType = response.headers.get('content-type')
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

  const blob = new Blob(chunks as BlobPart[], { type: contentType || 'audio/mpeg' })

  // 尝试通过文件头检测真实格式
  let ext = await detectAudioType(blob)

  if (!ext) {
    // 降级：通过Content-Type判断
    if (contentType) {
      switch (true) {
        case contentType.includes('audio/flac') || contentType.includes('application/x-flac'):
          ext = 'flac'
          break
        case contentType.includes('audio/wav') || contentType.includes('audio/x-wav'):
          ext = 'wav'
          break
        case contentType.includes('audio/ogg'):
          ext = 'ogg'
          break
        case contentType.includes('audio/aac') || contentType.includes('audio/mp4'):
          ext = 'm4a'
          break
      }
    }
  }

  // 再次降级：通过URL判断
  if (!ext) {
    if (url.includes('.flac')) {
      ext = 'flac'
    } else {
      ext = 'mp3' // 最终默认为mp3
    }
  }

  uploadProgress.value = 50
  return { blob, ext }
}

// 上传到网易云音乐
const uploadToNetease = async (audioBlob: Blob, filename: string) => {
  uploadStatus.value = '正在计算文件指纹'
  // uploadProgress.value = 0 // 移除重置，保持进度连续

  const arrayBuffer = await audioBlob.arrayBuffer()
  const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer)
  const md5 = CryptoJS.MD5(wordArray).toString()
  const fileSize = audioBlob.size
  const cookie = getNeteaseCookie()

  const baseApiUrl = 'https://api.voicehub.lao-shui.top'

  // 获取文件扩展名
  const ext = filename.split('.').pop()?.toLowerCase() || 'mp3'

  const contentTypeMap: Record<string, string> = {
    flac: 'audio/flac',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg'
  }

  const contentType = contentTypeMap[ext] || 'audio/mpeg'

  // 1. 获取上传凭证
  uploadStatus.value = '正在获取上传凭证'
  const tokenUrl = `${baseApiUrl}/cloud/upload/token?time=${Date.now()}`

  // 使用POST请求，适配 api-enhanced-2 接口
  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      cookie,
      md5,
      fileSize,
      filename
    })
  })

  const tokenData = await tokenRes.json()

  if (tokenData.code !== 200) {
    throw new Error(`获取凭证失败: ${tokenData.msg || tokenData.code}`)
  }

  const { needUpload, uploadUrl, uploadToken, objectKey, resourceId, songId } = tokenData.data

  if (needUpload) {
    // 2. 上传文件到NOS
    uploadStatus.value = '正在上传到网易云音乐'

    // 使用 XMLHttpRequest 上传以获取进度
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.floor((e.loaded / e.total) * 100)
          // 这里的进度是上传文件的进度，占总进度的 45% (50% -> 95%)
          uploadProgress.value = 50 + Math.floor(percent * 0.45)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText)
        } else {
          reject(new Error(`NOS上传失败: ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('NOS网络错误'))
      })

      xhr.open('POST', uploadUrl)
      xhr.setRequestHeader('x-nos-token', uploadToken)
      xhr.setRequestHeader('Content-MD5', md5)
      xhr.setRequestHeader('Content-Type', contentType)
      xhr.send(audioBlob)
    })
  } else {
    uploadProgress.value = 95
    uploadStatus.value = '文件已存在，秒传成功'
  }

  // 3. 完成上传（导入/发布）
  uploadStatus.value = '正在保存云盘信息'

  const completeUrl = `${baseApiUrl}/cloud/upload/complete?time=${Date.now()}`
  const completeRes = await fetch(completeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      cookie,
      md5,
      songId,
      resourceId,
      filename,
      song: songName.value,
      artist: artistName.value,
      album: albumName.value,
      bitrate: 999000
    })
  })

  const completeData = await completeRes.json()

  if (completeData.code !== 200) {
    if (completeData.code === 502 || completeData.code === 526) {
      console.warn(`完成接口返回 ${completeData.code}，可能为暂时性错误`, completeData)
      throw new Error(
        `云盘信息保存可能失败 (错误码: ${completeData.code})，请检查云盘内是否成功上传歌曲。`
      )
    } else {
      throw new Error(`发布失败: ${completeData.msg || completeData.code}`)
    }
  }

  uploadProgress.value = 100
  return completeData
}

// 开始上传流程
const startUpload = async () => {
  if (uploading.value) return

  uploading.value = true
  uploadProgress.value = 0
  uploadStatus.value = '准备中'
  uploadMessage.value = ''

  try {
    // console.log('开始上传，歌曲信息:', props.song)

    // 获取歌曲ID，尝试所有可能的字段
    const musicId =
      props.song.strMediaMid ||
      props.song.songmid ||
      props.song.songId ||
      props.song.musicId ||
      props.song.id ||
      props.song.mid

    if (!musicId) {
      console.error('所有可能的ID字段都为空')
      throw new Error('无法获取歌曲ID，请重试')
    }

    // console.log('使用的音乐ID:', musicId)

    // 1. 获取QQ音乐下载链接
    uploadMessage.value = '正在从QQ音乐获取音频链接...'

    const musicUrl = await getQQMusicUrl(musicId, selectedQuality.value)

    if (!musicUrl) {
      throw new Error('无法获取音乐播放链接')
    }

    // console.log('获取到的播放链接:', musicUrl)

    // 2. 下载音频文件
    uploadMessage.value = '正在下载音频文件...'
    const { blob: audioBlob, ext } = await downloadAudio(musicUrl)

    // 3. 上传到网易云音乐
    uploadMessage.value = '正在上传到网易云音乐云盘...'
    const filename = `${artistName.value} - ${songName.value}.${ext}`
    await uploadToNetease(audioBlob, filename)

    // 4. 完成
    uploadProgress.value = 100
    uploadStatus.value = '上传完成'
    uploadMessage.value = '歌曲已成功上传到您的网易云音乐云盘'

    showSuccess('歌曲已成功上传到网易云音乐云盘')

    emit('upload-success')

    // 延迟关闭对话框
    setTimeout(() => {
      closeDialog()
    }, 1500)
  } catch (error: any) {
    console.error('上传失败:', error)
    uploadStatus.value = '上传失败'
    uploadMessage.value = error.message || '未知错误'

    showError(`上传失败: ${error.message}`)
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
