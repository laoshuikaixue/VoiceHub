<template>
  <div class="request-form">
    <!-- 投稿须知区域 -->
    <div class="rules-section">
      <h2 class="section-title">投稿须知</h2>
      <div class="rules-content">
        <p>1. 投稿时无需加入书名号</p>
        <p>2. 除DJ外，其他类型歌曲均接收（包括小语种）</p>
        <p>3. 禁止投递含有违规内容的歌曲</p>
        <p>4. 点播的歌曲将由管理员进行审核</p>
        <p>5. 审核通过后将安排在播放时段播出</p>
      </div>
    </div>

    <!-- 表单区域 -->
    <div class="form-container">
      <form @submit.prevent="handleSearch" class="song-request-form">
        <!-- 将歌曲名称和歌手放在同一行 -->
        <div class="form-row">
          <div class="form-group">
            <label for="title">歌曲名称</label>
            <div class="input-wrapper">
              <input 
                id="title" 
                v-model="title" 
                type="text" 
                required 
                placeholder="请输入歌曲名称"
                class="form-input"
                @input="checkSimilarSongs"
              />
            </div>
          </div>
          
          <div class="form-group">
            <label for="artist">歌手</label>
            <div class="input-wrapper">
              <input 
                id="artist" 
                v-model="artist" 
                type="text" 
                required 
                placeholder="请输入歌手名称"
                class="form-input"
                @input="checkSimilarSongs"
              />
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="platform">音乐平台</label>
            <div class="input-wrapper">
              <select 
                id="platform" 
                v-model="platform" 
                class="form-select"
              >
                <option value="netease">网易云音乐</option>
                <option value="tencent">QQ音乐</option>
              </select>
          </div>
        </div>
        
        <!-- 播出时段选择 -->
        <div v-if="playTimeSelectionEnabled && playTimes.length > 0" class="form-group">
          <label for="playTime">期望播出日期</label>
          <div class="input-wrapper">
            <select 
              id="playTime" 
              v-model="preferredPlayTimeId" 
              class="form-select"
            >
              <option value="">选择日期</option>
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
        </div>
        
        <!-- 相似歌曲提示 -->
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
            <button 
              type="button" 
              class="ignore-btn" 
              @click="ignoreSimilar"
            >
              继续投稿
            </button>
          </div>
        </div>

        <div class="form-notice">
          提交即表明我已阅读投稿须知并已知该歌曲有概率无法播出
        </div>
        
        <div v-if="error" class="error-message">{{ error }}</div>
        <div v-if="success" class="success-message">{{ success }}</div>
        
        <div class="form-actions">
          <button type="submit" :disabled="loading || searching" class="submit-button">
            {{ loading || searching ? '处理中...' : '搜索' }}
          </button>
        </div>
      </form>
      
      <!-- 搜索结果区域 -->
      <div v-if="searchResults.length > 0" class="search-results">
        <h3 class="results-title">搜索结果</h3>
        <div class="results-list">
                      <div 
            v-for="(result, index) in searchResults" 
            :key="index" 
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
              <p class="result-time">发布时间：{{ result.time }}</p>
            </div>
            <div class="result-actions">
              <button 
                class="select-btn" 
                @click.stop="submitSong(result)"
              >
                选择投稿
              </button>
            </div>
          </div>
        </div>
        
        <!-- 添加未找到想要歌曲的按钮 -->
        <div class="no-results-action">
          <button 
            class="manual-submit-btn" 
            @click="handleSubmit"
          >
            以上没有我想要的歌曲，直接提交
          </button>
        </div>
      </div>
      
      <!-- 播放器 -->
      <div v-if="currentPlaying" class="audio-player">
        <div class="player-info">
          <img :src="currentPlaying.cover" alt="封面" class="player-cover" />
          <div class="player-text">
            <h4>{{ currentPlaying.song || currentPlaying.title }}</h4>
            <p>{{ currentPlaying.singer || currentPlaying.artist }}</p>
          </div>
        </div>
        <audio 
          ref="audioPlayer" 
          controls 
          :src="currentPlaying.url"
          @ended="stopPlaying"
        ></audio>
        <button class="close-player" @click="stopPlaying">×</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useSongs } from '~/composables/useSongs'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  }
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
const currentPlaying = ref(null)
const audioPlayer = ref(null)
const selectedCover = ref('')
const selectedUrl = ref('')

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
  return playTimes.value.filter(pt => pt.enabled)
})

// 格式化播出时段时间范围
const formatPlayTimeRange = (playTime) => {
  if (!playTime) return '';
  
  if (playTime.startTime && playTime.endTime) {
    return `${playTime.startTime} - ${playTime.endTime}`;
  } else if (playTime.startTime) {
    return `${playTime.startTime} 开始`;
  } else if (playTime.endTime) {
    return `${playTime.endTime} 结束`;
  }
  
  return '不限时间';
};

// 监听歌曲服务中的相似歌曲
watch(() => songService.similarSongFound.value, (newVal) => {
  similarSong.value = newVal
})

// 检查相似歌曲
const checkSimilarSongs = () => {
  if (title.value.trim().length > 2) {
    console.log('检查相似歌曲:', title.value, artist.value)
    const similar = songService.checkSimilarSongs(title.value.trim(), artist.value.trim())
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
    title.value = ''
    artist.value = ''
    similarSong.value = null
    
    // 3秒后清除成功提示
    setTimeout(() => {
      success.value = ''
    }, 3000)
  } catch (err) {
    error.value = err.message || '投票失败，请稍后重试'
  } finally {
    voting.value = false
  }
}

// 忽略相似歌曲，继续投稿
const ignoreSimilar = () => {
  similarSong.value = null
}

// 搜索歌曲
const handleSearch = async () => {
  error.value = ''
  success.value = ''
  
  if (!title.value.trim()) {
    error.value = '歌曲名称不能为空'
    return
  }
  
  if (!artist.value.trim()) {
    error.value = '歌手名称不能为空'
    return
  }
  
  searching.value = true
  try {
    // 构建搜索词，将歌曲名称和歌手名称用空格连接
    const searchWord = `${title.value.trim()} ${artist.value.trim()}`
    
    // 构建API URL
    const apiUrl = `https://api.vkeys.cn/v2/music/${platform.value}?word=${encodeURIComponent(searchWord)}`
    
    // 直接从前端调用API
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Origin': window.location.origin
      }
    })
    
    if (!response.ok) {
      throw new Error('搜索请求失败，请稍后重试')
    }
    
    const data = await response.json()
    
    if (data.code === 200) {
      if (data.data && Array.isArray(data.data)) {
        // 每个搜索结果初始不包含具体URL，选中后才会获取
        searchResults.value = data.data.map(item => ({
          ...item,
          musicId: item.id,
          hasUrl: false
        }))
      } else if (data.data) {
        // 如果返回单个结果
        searchResults.value = [{
          ...data.data,
          musicId: data.data.id,
          hasUrl: false
        }]
      } else {
        searchResults.value = []
        error.value = '没有找到匹配的歌曲'
      }
    } else {
      error.value = data.message || '搜索失败，请稍后重试'
    }
  } catch (err) {
    console.error('搜索错误:', err)
    error.value = err.message || '搜索请求失败，请稍后重试'
    
    if (error.value.includes('CORS') || error.value.includes('跨域')) {
      error.value += '。请尝试使用能够处理跨域请求的浏览器扩展，或联系管理员配置服务器以允许跨域请求。'
    }
  } finally {
    searching.value = false
  }
}

// 获取音乐播放URL
const getAudioUrl = async (result) => {
  if (result.hasUrl || result.url) return result

  try {
    let apiUrl
    if (platform.value === 'netease') {
      apiUrl = `https://api.vkeys.cn/v2/music/netease?id=${result.musicId}`
    } else if (platform.value === 'tencent') {
      apiUrl = `https://api.vkeys.cn/v2/music/tencent/geturl?id=${result.musicId}`
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
      const index = searchResults.value.findIndex(item => item.musicId === result.musicId)
      if (index !== -1) {
        searchResults.value[index] = { ...result }
      }
    }
    
    return result
  } catch (err) {
    console.error('获取音乐URL错误:', err)
    error.value = '获取音乐URL失败，请稍后重试'
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
    return
  }
  
  // 如果正在播放同一首歌，则停止
  if (currentPlaying.value && currentPlaying.value.musicId === result.musicId) {
    stopPlaying()
    return
  }
  
  currentPlaying.value = result
  
  // 等待DOM更新后播放
      setTimeout(() => {
    if (audioPlayer.value) {
      audioPlayer.value.play().catch(err => {
        console.error('播放失败:', err)
        error.value = '播放失败，可能是浏览器限制或音乐资源不可用'
      })
    }
  }, 100)
}

// 选择搜索结果
const selectResult = async (result) => {
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
  }
}

// 提交选中的歌曲
const submitSong = async (result) => {
  if (submitting.value) return

  submitting.value = true
  error.value = ''

  // 使用搜索结果中的数据
  title.value = result.song || result.title
  artist.value = result.singer || result.artist
  selectedCover.value = result.cover || ''
  selectedUrl.value = result.url || result.file || ''

  try {
    const response = await songService.requestSong({
      title: title.value,
      artist: artist.value,
      preferredPlayTimeId: preferredPlayTimeId.value ? parseInt(preferredPlayTimeId.value) : null,
      cover: selectedCover.value,
      musicUrl: selectedUrl.value
    })

    if (response) {
      success.value = '歌曲投稿成功！'
      resetForm()
      emit('request', response)
    }
  } catch (err) {
    error.value = err.message || '投稿失败，请稍后重试'
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
    const response = await songService.requestSong({
      title: title.value,
      artist: artist.value,
      preferredPlayTimeId: preferredPlayTimeId.value ? parseInt(preferredPlayTimeId.value) : null,
      cover: selectedCover.value,
      musicUrl: selectedUrl.value
    })
    
    if (response) {
      success.value = '歌曲投稿成功！'
      resetForm()
      emit('request', response)
    }
  } catch (err) {
    error.value = err.message || '投稿失败，请稍后重试'
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
}

// 停止播放
const stopPlaying = () => {
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value.currentTime = 0
  }
  currentPlaying.value = null
}
</script>

<style scoped>
.request-form {
  width: 100%;
  color: #FFFFFF;
  display: flex;
  gap: 2rem;
}

.rules-section {
  background: rgba(0, 0, 0, 0.4);
  border-radius: 13px;
  padding: 1.5rem;
  width: 40%;
  height: fit-content;
}

.form-container {
  width: 60%;
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

.song-request-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
}

.form-group label {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 20px;
  letter-spacing: 0.04em;
  color: #FFFFFF;
}

.input-wrapper {
  width: 100%;
}

.form-input, .form-select {
  background: #040E15;
  border: 1px solid #242F38;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  width: 100%;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: #0B5AFE;
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
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
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

.submit-button:hover {
  transform: translateY(-2px);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.error-message {
  background: rgba(255, 47, 47, 0.2);
  border: 1px solid rgba(255, 47, 47, 0.4);
  border-radius: 8px;
  padding: 1rem;
  color: #FF654D;
  margin-top: 1rem;
}

.success-message {
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.4);
  border-radius: 8px;
  padding: 1rem;
  color: #10b981;
  margin-top: 1rem;
}

.similar-song-alert {
  background: #21242D;
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
  color: #FFFFFF;
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
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #FFFFFF;
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
  color: #FFFFFF;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

/* 搜索结果样式 */
.search-results {
  margin-top: 2rem;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 13px;
  padding: 1.5rem;
}

.results-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 18px;
  margin-bottom: 1rem;
  color: #FFFFFF;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 500px;
  overflow-y: auto;
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
  color: #FFFFFF;
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
.result-time,
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
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #FFFFFF;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

/* 音频播放器样式 */
.audio-player {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 800px;
  background: rgba(0, 10, 20, 0.9);
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.player-cover {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  object-fit: cover;
}

.player-text h4 {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #FFFFFF;
  margin: 0 0 0.25rem 0;
}

.player-text p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin: 0;
}

.audio-player audio {
  flex: 2;
  height: 36px;
}

.close-player {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  font-size: 24px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

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
  color: #FFFFFF;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manual-submit-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .request-form {
    flex-direction: column;
  }

  .rules-section {
    width: 100%;
    margin-bottom: 1rem;
    padding: 1rem;
  }

  .form-container {
    width: 100%;
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
  
  .vote-btn, .ignore-btn {
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
}
</style> 