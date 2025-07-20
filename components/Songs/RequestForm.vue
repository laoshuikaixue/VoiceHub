<template>
  <div class="request-form">
    <div class="rules-section">
      <h2 class="section-title">投稿须知</h2>
      <div class="rules-content">
        <p>1. 投稿时无需加入书名号</p>
        <p>2. 除DJ外，其他类型歌曲均接收（包括小语种）</p>
        <p>3. 禁止投递含有违规内容的歌曲</p>
        <p>4. 点播的歌曲将由管理员进行审核</p>
        <p>5. 审核通过后将安排在播放时段播出</p>
        <p>6. 提交即表明我已阅读投稿须知并已知该歌曲有概率无法播出</p>
        <p>7. 本系统仅提供音乐搜索和播放管理功能，不存储任何音乐文件。所有音乐内容均来自第三方音乐平台，版权归原平台及版权方所有。用户点歌时请确保遵守相关音乐平台的服务条款，尊重音乐作品版权。我们鼓励用户支持正版音乐，在官方平台购买和收听喜爱的音乐作品。</p>
        <p>8. 最终解释权归广播站所有</p>
      </div>
    </div>

    <div class="form-container">
      <form @submit.prevent="handleSearch" class="song-request-form">
        <!-- 歌曲搜索区域 -->
        <div class="search-section">
          <div class="search-label">歌曲搜索</div>
          <div class="search-input-group">
            <input
              id="title"
              v-model="title"
              type="text"
              required
              placeholder="请输入歌曲名称"
              class="search-input"
              @input="checkSimilarSongs"
            />
            <button type="submit" :disabled="loading || searching || !title.trim()" class="search-button">
              {{ loading || searching ? '处理中...' : '搜索' }}
            </button>
          </div>
        </div>

        <!-- 搜索结果容器 -->
        <div class="search-results-container">
          <!-- 音乐平台选择按钮 -->
          <div class="platform-selection">
            <button
              type="button"
              :class="['platform-btn', { active: platform === 'netease' }]"
              @click="switchPlatform('netease')"
            >
              网易云音乐
            </button>
            <button
              type="button"
              :class="['platform-btn', { active: platform === 'tencent' }]"
              @click="switchPlatform('tencent')"
            >
              QQ音乐
            </button>
          </div>

          <div class="results-content">
            <!-- 加载状态 -->
            <div v-if="searching" class="loading-state">
              <div class="loading-spinner"></div>
              <p class="loading-text">处理中...</p>
            </div>

            <!-- 搜索结果列表 -->
            <Transition name="results-fade" mode="out-in">
              <div v-if="searchResults.length > 0 && !searching" class="results-list" key="results">
                <TransitionGroup name="result-item" tag="div" class="results-grid">
                  <div
                    v-for="(result, index) in searchResults"
                    :key="`${platform}-${result.id || index}`"
                    class="result-item"
                  >
                    <div class="result-cover">
                      <img :src="result.cover" alt="封面" class="cover-img" />
                      <div class="play-overlay" @click.stop="playSong(result)">
                        <span class="play-icon">▶</span>
                      </div>
                    </div>
                    <div class="result-info">
                      <h4 class="result-title">{{ result.song || result.title }}</h4>
                      <p class="result-artist">{{ result.singer || result.artist }}</p>
                      <p class="result-album" v-if="result.album">专辑：{{ result.album }}</p>
                    </div>
                    <div class="result-actions">
                      <button
                        class="select-btn"
                        @click.stop.prevent="submitSong(result)"
                      >
                        选择投稿
                      </button>
                    </div>
                  </div>
                </TransitionGroup>

                <!-- 手动输入按钮 -->
                <div class="manual-input-trigger">
                  <button
                    type="button"
                    class="manual-submit-btn"
                    @click="showManualModal = true"
                  >
                    以上没有我想要的歌曲，手动输入提交
                  </button>
                </div>
              </div>

              <!-- 空状态 -->
              <div v-else-if="!searching && hasSearched" class="empty-state" key="empty">
                <div class="empty-icon">🔍</div>
                <p class="empty-text">未找到相关歌曲</p>
                <p class="empty-hint">试试其他关键词或切换平台</p>
                <button
                  type="button"
                  class="manual-submit-btn"
                  @click="showManualModal = true"
                >
                  手动输入提交
                </button>
              </div>

              <!-- 初始状态 -->
              <div v-else-if="!searching" class="initial-state" key="initial">
                <div class="search-illustration">
                  <img src="/public/images/search.svg" alt="搜索歌曲" class="search-svg" />
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- 播出时段选择 -->
        <div
          v-if="playTimeSelectionEnabled && playTimes.length > 0"
          class="form-group"
        >
          <label for="playTime">期望播出时段</label>
          <div class="input-wrapper">
            <select id="playTime" v-model="preferredPlayTimeId" class="form-select">
              <option value="">选择时段</option>
              <option
                v-for="playTime in enabledPlayTimes"
                :key="playTime.id"
                :value="playTime.id"
              >
                {{ playTime.name }}
                <template v-if="playTime.startTime || playTime.endTime">
                  ({{ formatPlayTimeRange(playTime) }})
                </template>
              </option>
            </select>
          </div>
        </div>
      </form>

      <div v-if="similarSong" class="similar-song-alert">
        <div class="alert-header">
          <span class="alert-icon">⚠️</span>
          <span class="alert-title">发现可能相似的歌曲</span>
        </div>
        <div class="alert-content">
          <p>《{{ similarSong.title }} - {{ similarSong.artist }}》</p>
          <p class="alert-hint">该歌曲已在列表中，是否要投票支持？</p>
        </div>
        <div class="alert-actions">
          <button
            type="button"
            class="vote-btn"
            @click="voteForSimilar"
            :disabled="voting"
          >
            {{ voting ? '投票中...' : '投票支持' }}
          </button>
          <button type="button" class="ignore-btn" @click="ignoreSimilar">
            继续投稿
          </button>
        </div>
      </div>

    </div>

    <!-- 手动输入弹窗 -->
    <Teleport to="body">
      <Transition name="modal-animation">
        <div v-if="showManualModal" class="modal-overlay" @click.self="showManualModal = false">
          <div class="modal-content">
            <div class="modal-header">
              <h3>手动输入歌曲信息</h3>
              <button @click="showManualModal = false" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label for="modal-title">歌曲名称</label>
                <div class="input-wrapper">
                  <input
                    id="modal-title"
                    :value="title"
                    type="text"
                    readonly
                    class="form-input readonly"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="modal-artist">歌手名称</label>
                <div class="input-wrapper">
                  <input
                    id="modal-artist"
                    v-model="manualArtist"
                    type="text"
                    required
                    placeholder="请输入歌手名称"
                    class="form-input"
                  />
                </div>
              </div>

              <div class="modal-actions">
                <button
                  type="button"
                  class="btn btn-secondary"
                  @click="showManualModal = false"
                >
                  取消
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  @click="handleManualSubmit"
                  :disabled="!manualArtist.trim() || submitting"
                >
                  {{ submitting ? '提交中...' : '确认提交' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useSongs } from '~/composables/useSongs'
import { useAudioPlayer } from '~/composables/useAudioPlayer'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['request', 'vote'])

const title = ref('')
const artist = ref('')
const platform = ref('netease') // 默认使用网易云音乐
const preferredPlayTimeId = ref('')
const error = ref('')
const success = ref('')
const submitting = ref(false)
const voting = ref(false)
const similarSong = ref(null)
const songService = useSongs()
const playTimes = ref([])
const playTimeSelectionEnabled = ref(false)
const loadingPlayTimes = ref(false)

// 搜索相关
const searching = ref(false)
const searchResults = ref([])
const selectedCover = ref('')
const selectedUrl = ref('')
const audioPlayer = useAudioPlayer() // 使用全局音频播放器

// 手动输入相关
const showManualModal = ref(false)
const manualArtist = ref('')
const hasSearched = ref(false)

// 获取播出时段
const fetchPlayTimes = async () => {
  loadingPlayTimes.value = true
  try {
    const response = await fetch('/api/play-times')
    if (response.ok) {
      const data = await response.json()
      playTimes.value = data.playTimes || []
      playTimeSelectionEnabled.value = data.enabled || false
    }
  } catch (err) {
    console.error('获取播出时段失败:', err)
  } finally {
    loadingPlayTimes.value = false
  }
}

onMounted(() => {
  fetchPlayTimes()
})

// 过滤出启用的播出时段
const enabledPlayTimes = computed(() => {
  return playTimes.value.filter((pt) => pt.enabled)
})

// 格式化播出时段时间范围
const formatPlayTimeRange = (playTime) => {
  if (!playTime) return ''

  if (playTime.startTime && playTime.endTime) {
    return `${playTime.startTime} - ${playTime.endTime}`
  } else if (playTime.startTime) {
    return `${playTime.startTime} 开始`
  } else if (playTime.endTime) {
    return `${playTime.endTime} 结束`
  }

  return '不限时间'
}

// 监听歌曲服务中的相似歌曲
watch(
  () => songService.similarSongFound.value,
  (newVal) => {
    similarSong.value = newVal
  }
)

// 检查相似歌曲
const checkSimilarSongs = () => {
  if (title.value.trim().length > 2) {
    console.log('检查相似歌曲:', title.value, artist.value)
    const similar = songService.checkSimilarSongs(
      title.value.trim(),
      artist.value.trim()
    )
    console.log('相似歌曲结果:', similar, songService.similarSongFound.value)
  } else {
    similarSong.value = null
  }
}

// 投票支持相似歌曲
const voteForSimilar = async () => {
  if (!similarSong.value) return

  voting.value = true
  try {
    await emit('vote', similarSong.value)
    success.value = `已为《${similarSong.value.title}》投票！`
    if (window.$showNotification) {
      window.$showNotification(
        `已为《${similarSong.value.title}》投票！`,
        'success'
      )
    }
    title.value = ''
    artist.value = ''
    similarSong.value = null

    // 3秒后清除成功提示
    setTimeout(() => {
      success.value = ''
    }, 3000)
  } catch (err) {
    error.value = err.message || '投票失败，请稍后重试'
    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }
  } finally {
    voting.value = false
  }
}

// 忽略相似歌曲，继续投稿
const ignoreSimilar = () => {
  similarSong.value = null
}

// 平台切换函数
const switchPlatform = (newPlatform) => {
  if (platform.value === newPlatform) return

  platform.value = newPlatform

  // 如果已经有搜索结果，自动重新搜索
  if (title.value.trim() && hasSearched.value) {
    handleSearch()
  }
}

// 搜索歌曲
const handleSearch = async () => {
  error.value = ''
  success.value = ''

  if (!title.value.trim()) {
    error.value = '歌曲名称不能为空'
    if (window.$showNotification) {
      window.$showNotification('歌曲名称不能为空', 'error')
    }
    return
  }

  searching.value = true
  try {
    // 只使用歌曲名称搜索
    const searchWord = title.value.trim()

    // 构建API URL
    const apiUrl = `https://api.vkeys.cn/v2/music/${
      platform.value
    }?word=${encodeURIComponent(searchWord)}`

    // 直接从前端调用API
    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
        Origin: window.location.origin,
      },
    })

    if (!response.ok) {
      throw new Error('搜索请求失败，请稍后重试')
    }

    const data = await response.json()

    if (data.code === 200) {
      if (data.data && Array.isArray(data.data)) {
        // 每个搜索结果初始不包含具体URL，选中后才会获取
        searchResults.value = data.data.map((item) => ({
          ...item,
          musicId: item.id,
          hasUrl: false,
        }))
      } else if (data.data) {
        // 如果返回单个结果
        searchResults.value = [
          {
            ...data.data,
            musicId: data.data.id,
            hasUrl: false,
          },
        ]
      } else {
        searchResults.value = []
        error.value = '没有找到匹配的歌曲'
      }
    } else {
      error.value = data.message || '搜索失败，请稍后重试'
      if (window.$showNotification) {
        window.$showNotification(error.value, 'error')
      }
    }
  } catch (err) {
    console.error('搜索错误:', err)
    error.value = err.message || '搜索请求失败，请稍后重试'
    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }

    if (error.value.includes('CORS') || error.value.includes('跨域')) {
      error.value +=
        '。请尝试使用能够处理跨域请求的浏览器扩展，或联系管理员配置服务器以允许跨域请求。'
    }
  } finally {
    searching.value = false
    hasSearched.value = true
  }
}

// 获取音乐播放URL
const getAudioUrl = async (result) => {
  if (result.hasUrl || result.url) return result

  try {
    const { getQuality } = useAudioQuality()
    const quality = getQuality(platform.value)

    let apiUrl
    if (platform.value === 'netease') {
      apiUrl = `https://api.vkeys.cn/v2/music/netease?id=${result.musicId}&quality=${quality}`
    } else if (platform.value === 'tencent') {
      apiUrl = `https://api.vkeys.cn/v2/music/tencent?id=${result.musicId}&quality=${quality}`
    }

    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error('获取音乐URL失败')
    }

    const data = await response.json()
    if (data.code === 200 && data.data) {
      // 更新结果中的URL和其他信息
      result.url = data.data.url
      result.hasUrl = true
      // 检查URL是否可用

      // 更新搜索结果中的对应项
      const index = searchResults.value.findIndex(
        (item) => item.musicId === result.musicId
      )
      if (index !== -1) {
        searchResults.value[index] = { ...result }
      }
    }

    return result
  } catch (err) {
    console.error('获取音乐URL错误:', err)
    error.value = '获取音乐URL失败，请稍后重试'
    if (window.$showNotification) {
      window.$showNotification('获取音乐URL失败，请稍后重试', 'error')
    }
    return result
  }
}

// 播放歌曲
const playSong = async (result) => {
  // 如果还没有获取URL，先获取
  if (!result.hasUrl && !result.url) {
    result = await getAudioUrl(result)
  }

  // 如果没有URL，提示错误
  if (!result.url) {
    error.value = '该歌曲无法播放，可能是付费内容'
    if (window.$showNotification) {
      window.$showNotification('该歌曲无法播放，可能是付费内容', 'error')
    }
    return
  }

  // 准备播放所需的数据
  const song = {
    id: result.musicId || Date.now(),
    title: result.song || result.title,
    artist: result.singer || result.artist,
    cover: result.cover || null,
    musicUrl: result.url,
  }

  // 使用全局播放器播放歌曲
  audioPlayer.playSong(song)
}

// 选择搜索结果
const selectResult = async (result) => {
  // 防止重复点击和事件冒泡
  event?.stopPropagation()

  // 先获取完整信息
  if (!result.hasUrl) {
    result = await getAudioUrl(result)
  }

  // 标准化属性名称（处理不同API返回格式的差异）
  const songTitle = result.song || result.title
  const singerName = result.singer || result.artist

  title.value = songTitle
  artist.value = singerName
  selectedCover.value = result.cover || ''
  selectedUrl.value = result.url || ''

  // 如果没有URL，给出提示
  if (!result.url) {
    success.value = '已选择歌曲，但可能无法播放完整版本'
    if (window.$showNotification) {
      window.$showNotification('已选择歌曲，但可能无法播放完整版本', 'info')
    }
  }

  console.log('已选择歌曲:', songTitle, '- 填充表单但不自动提交')
}

// 提交选中的歌曲
const submitSong = async (result) => {
  // 防止重复点击和重复提交
  if (submitting.value) return
  console.log('执行submitSong，提交歌曲:', result.title || result.song)

  submitting.value = true
  error.value = ''

  // 使用搜索结果中的数据
  title.value = result.song || result.title
  artist.value = result.singer || result.artist
  selectedCover.value = result.cover || ''
  selectedUrl.value = result.url || result.file || ''

  try {
    // 检查黑名单
    const blacklistCheck = await $fetch('/api/blacklist/check', {
      method: 'POST',
      body: {
        title: title.value,
        artist: artist.value
      }
    })

    if (blacklistCheck.isBlocked) {
      const reasons = blacklistCheck.reasons.map(r => r.reason).join('; ')
      error.value = `该歌曲无法点歌: ${reasons}`
      if (window.$showNotification) {
        window.$showNotification(error.value, 'error')
      }
      submitting.value = false
      return
    }
  } catch (err) {
    console.error('黑名单检查失败:', err)
    // 黑名单检查失败不阻止提交，只记录错误
  }

  // 确保获取完整的URL
  if (!selectedUrl.value && result.musicId) {
    const fullResult = await getAudioUrl(result)
    selectedUrl.value = fullResult.url || ''
  }

  try {
    // 构建歌曲数据对象
    const songData = {
      title: title.value,
      artist: artist.value,
      preferredPlayTimeId: preferredPlayTimeId.value
        ? parseInt(preferredPlayTimeId.value)
        : null,
      cover: selectedCover.value,
      musicPlatform: platform.value,
      musicId: result.musicId ? String(result.musicId) : null,
    }

    // 只emit事件，让父组件处理实际的API调用
    emit('request', songData)

    // 成功提示由父组件处理，这里只重置表单
    resetForm()
  } catch (err) {
    error.value = err.message || '投稿失败，请稍后重试'
    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }
  } finally {
    submitting.value = false
  }
}

// 直接提交表单
const handleSubmit = async () => {
  if (submitting.value) return

  submitting.value = true
  error.value = ''

  try {
    // 构建歌曲数据对象
    const songData = {
      title: title.value,
      artist: artist.value,
      preferredPlayTimeId: preferredPlayTimeId.value
        ? parseInt(preferredPlayTimeId.value)
        : null,
      cover: selectedCover.value,
      musicPlatform: platform.value,
      musicId: null, // 手动输入时没有musicId
    }

    // 只emit事件，让父组件处理实际的API调用
    emit('request', songData)

    // 成功提示由父组件处理，这里只重置表单
    resetForm()
  } catch (err) {
    error.value = err.message || '投稿失败，请稍后重试'
    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }
  } finally {
    submitting.value = false
  }
}

// 手动输入相关方法
const handleManualSubmit = async () => {
  if (!title.value.trim() || !manualArtist.value.trim()) {
    error.value = '请输入完整的歌曲信息'
    if (window.$showNotification) {
      window.$showNotification('请输入完整的歌曲信息', 'error')
    }
    return
  }

  submitting.value = true
  error.value = ''

  try {
    // 检查黑名单
    const blacklistCheck = await $fetch('/api/blacklist/check', {
      method: 'POST',
      body: {
        title: title.value,
        artist: manualArtist.value
      }
    })

    if (blacklistCheck.isBlocked) {
      const reasons = blacklistCheck.reasons.map(r => r.reason).join('; ')
      error.value = `该歌曲无法点歌: ${reasons}`
      if (window.$showNotification) {
        window.$showNotification(error.value, 'error')
      }
      submitting.value = false
      return
    }
    // 构建歌曲数据对象
    const songData = {
      title: title.value,
      artist: manualArtist.value,
      preferredPlayTimeId: preferredPlayTimeId.value
        ? parseInt(preferredPlayTimeId.value)
        : null,
      cover: '',
      musicPlatform: platform.value,
      musicId: null, // 手动输入时没有musicId
    }

    // 只emit事件，让父组件处理实际的API调用
    emit('request', songData)

    // 成功提示由父组件处理，这里只重置表单和关闭弹窗
    resetForm()
    showManualModal.value = false
  } catch (err) {
    error.value = err.message || '投稿失败，请稍后重试'
    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }
  } finally {
    submitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  title.value = ''
  artist.value = ''
  preferredPlayTimeId.value = ''
  similarSong.value = null
  searchResults.value = []
  selectedCover.value = ''
  selectedUrl.value = ''
  showManualModal.value = false
  manualArtist.value = ''
  hasSearched.value = false
}

// 停止播放
const stopPlaying = () => {
  audioPlayer.stopSong()
}
</script>

<style scoped>
.request-form {
  width: 100%;
  color: #ffffff;
  display: flex;
  gap: 2rem;
  height: calc(100vh - 160px);
  max-height: calc(100vh - 160px);
  overflow: hidden;
}

.rules-section {
  background: rgba(0, 0, 0, 0.4);
  border-radius: 13px;
  padding: 1.5rem;
  width: 40%;
  height: 100%;
  overflow-y: auto;
}

.form-container {
  width: 60%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.song-request-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 1rem;
}

/* 搜索区域样式 */
.search-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.search-label {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #FFFFFF;
  white-space: nowrap;
}

.search-input-group {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}

.search-input {
  background: #040E15;
  border: 1px solid #242F38;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  flex: 1;
}

.search-input:focus {
  outline: none;
  border-color: #0B5AFE;
}

.search-button {
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  color: #FFFFFF;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.3s ease;
}

.search-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 67, 248, 0.3);
}

.search-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}



.section-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 16px;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 1rem;
}

.rules-content {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 16px;
  line-height: 1.6;
  letter-spacing: 0.04em;
}

.rules-content p {
  margin-bottom: 0.5rem;
}



.form-row {
  display: flex;
  gap: 1rem;
  width: 100%;
}

.form-row .form-group {
  flex: 1;
  min-width: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0; /* 防止被压缩 */
}

.form-group label {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 20px;
  letter-spacing: 0.04em;
  color: #ffffff;
}

.input-wrapper {
  width: 100%;
}

.form-input,
.form-select {
  background: #040e15;
  border: 1px solid #242f38;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  width: 100%;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #0b5afe;
}

/* 平台选择按钮样式 */
.platform-selection {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: flex-start;
  flex-shrink: 0;
}

.platform-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.platform-btn.active {
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
  border-color: rgba(255, 255, 255, 0.16);
  color: #FFFFFF;
}

.platform-btn:hover:not(.active) {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

/* 搜索结果容器样式 */
.search-results-container {
  flex: 1;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 13px;
  display: flex;
  flex-direction: column;
  min-height: 400px;
  padding: 1rem 1.5rem 1.5rem 1.5rem; /* 上边距小一点 */
}

.results-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 1rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(11, 90, 254, 0.2);
  border-top-color: #0B5AFE;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  color: rgba(255, 255, 255, 0.6);
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  margin: 0;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 搜索结果列表 */
.results-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 200px;
}

.results-grid {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-right: 0.5rem;
  min-height: 200px;
}

/* 滚动条样式 */
.results-grid::-webkit-scrollbar {
  width: 6px;
}

.results-grid::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.results-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.results-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* 空状态和初始状态 */
.empty-state,
.initial-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  gap: 1rem;
  padding: 2rem;
  min-height: 300px;
}

.empty-icon,
.initial-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.empty-text,
.initial-text {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #FFFFFF;
  margin: 0;
}

.empty-hint,
.initial-hint {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  margin: 0;
}

/* 搜索插图样式 */
.search-illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 200px;
}

.search-svg {
  width: 30%;
  max-width: 400px;
  min-width: 200px;
  height: auto;
  object-fit: contain;
}

/* 手动输入触发按钮 */
.manual-input-trigger {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.manual-submit-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1.5rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #FFFFFF;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manual-submit-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.form-notice {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 0.5rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.submit-button {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1.5rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.3s ease;
}

.submit-button:hover {
  transform: translateY(-2px);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 错误和成功提示现在使用全局通知 */

.similar-song-alert {
  background: #21242d;
  border-radius: 10px;
  padding: 1rem;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
  margin-top: 1rem;
}

.alert-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.alert-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #ffffff;
}

.alert-content {
  margin-bottom: 1rem;
}

.alert-hint {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  margin-top: 0.5rem;
}

.alert-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.vote-btn {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

.ignore-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

/* 动画样式 */
.results-fade-enter-active,
.results-fade-leave-active {
  transition: all 0.3s ease;
}

.results-fade-enter-from,
.results-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.result-item-enter-active {
  transition: all 0.4s ease;
}

.result-item-leave-active {
  transition: all 0.3s ease;
}

.result-item-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.result-item-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.result-item-move {
  transition: transform 0.3s ease;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: rgba(30, 41, 59, 0.95);
  border-radius: 0.75rem;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  margin: 0;
  color: #FFFFFF;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #FFFFFF;
}

.modal-body {
  padding: 1.5rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.16);
  color: #FFFFFF;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-primary {
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
  border-color: rgba(255, 255, 255, 0.16);
  color: #FFFFFF;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 67, 248, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.readonly {
  background: rgba(255, 255, 255, 0.05) !important;
  color: rgba(255, 255, 255, 0.6) !important;
  cursor: not-allowed;
}

/* 弹窗动画 */
.modal-animation-enter-active,
.modal-animation-leave-active {
  transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
}

.modal-animation-enter-from,
.modal-animation-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.result-item {
  display: flex;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  padding: 1rem;
  gap: 1rem;
  transition: all 0.2s ease;
  cursor: pointer;
}

.result-item:hover {
  background: rgba(0, 0, 0, 0.5);
}

.result-cover {
  width: 80px;
  height: 80px;
  position: relative;
  flex-shrink: 0;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  border-radius: 6px;
  transition: opacity 0.2s ease;
}

.result-cover:hover .play-overlay {
  opacity: 1;
}

.play-icon {
  color: white;
  font-size: 24px;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #ffffff;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-artist {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin: 0.5rem 0;
}

.result-album,
.result-quality,
.result-pay {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  margin: 0.25rem 0;
}

.result-actions {
  display: flex;
  align-items: center;
}

.select-btn {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

/* 音频播放器现在使用全局组件 */

/* 手动提交按钮样式 */
.no-results-action {
  margin-top: 1rem;
  text-align: center;
  padding: 1rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.manual-submit-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1.5rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manual-submit-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

/* 手动输入区域样式 */
.manual-input-section {
  margin-top: 2rem;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 13px;
  padding: 1.5rem;
}

.manual-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 18px;
  margin-bottom: 1rem;
  color: #ffffff;
}

.manual-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.manual-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.manual-cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manual-cancel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.manual-confirm-btn {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manual-confirm-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 67, 248, 0.3);
}

.manual-confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .request-form {
    flex-direction: column;
    min-height: 100vh;
    height: auto;
  }

  .rules-section {
    width: 100%;
    height: auto;
    margin-bottom: 1rem;
    padding: 1rem;
  }

  .form-container {
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 60vh;
  }

  .song-request-form {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 60vh;
  }

  .search-results-container {
    flex: 1;
    min-height: 50vh;
    height: auto;
    padding: 1rem;
    overflow: visible;
  }

  .results-content {
    height: auto;
    min-height: 40vh;
    overflow: visible;
  }

  /* 移动端搜索区域 */
  .search-section {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .search-label {
    font-size: 14px;
  }

  .search-input-group {
    flex-direction: column;
    gap: 0.75rem;
  }

  .search-button {
    padding: 0.75rem;
  }

  /* 移动端平台选择按钮 */
  .platform-selection {
    flex-direction: row;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
  }

  .platform-selection::-webkit-scrollbar {
    display: none; /* Chrome, Safari and Opera */
  }

  .platform-btn {
    padding: 0.6rem 0.8rem;
    font-size: 13px;
    flex-shrink: 0;
    min-width: fit-content;
  }

  .form-row {
    flex-direction: column;
    gap: 1rem;
  }

  .form-group label {
    font-size: 18px;
  }

  .form-actions {
    justify-content: center;
  }

  .submit-button {
    width: 100%;
    padding: 0.75rem;
  }

  .alert-actions {
    flex-direction: column;
    gap: 0.5rem;
  }

  .vote-btn,
  .ignore-btn {
    width: 100%;
  }

  .audio-player {
    flex-direction: column;
    padding: 0.75rem;
  }

  .player-info {
    width: 100%;
  }

  .audio-player audio {
    width: 100%;
  }

  .close-player {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
  }

  /* 移动端平台选择Tab */
  .tab-header {
    gap: 2px;
  }

  .tab-btn {
    padding: 0.6rem 0.8rem;
    font-size: 13px;
  }

  /* 移动端搜索结果优化 */
  .result-item {
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .result-cover {
    width: 60px;
    height: 60px;
    align-self: center;
  }

  .result-info {
    text-align: center;
  }

  .result-title {
    font-size: 15px;
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    line-height: 1.3;
    margin-bottom: 0.5rem;
  }

  .result-artist {
    font-size: 13px;
    margin: 0.3rem 0;
  }

  .result-album {
    font-size: 11px;
    margin: 0.2rem 0;
  }

  .result-actions {
    justify-content: center;
  }

  .select-btn {
    width: 100%;
    padding: 0.6rem 1rem;
  }

  /* 移动端弹窗优化 */
  .modal-content {
    width: 95%;
    max-width: none;
  }

  .modal-actions {
    flex-direction: column;
    gap: 0.75rem;
  }

  .btn {
    width: 100%;
    padding: 0.75rem;
  }

  /* 移动端搜索插图 */
  .search-svg {
    width: 50%;
    max-width: 250px;
    min-width: 120px;
  }

  .search-illustration {
    padding: 0.5rem;
    min-height: 120px;
  }
}
</style>