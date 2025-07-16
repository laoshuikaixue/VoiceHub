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
      <form @submit.prevent="handleSubmit" class="song-request-form">
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
          <button type="submit" :disabled="loading || submitting" class="submit-button">
            {{ loading || submitting ? '处理中...' : '提交' }}
          </button>
        </div>
      </form>
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
  if (title.value.trim().length > 2 && artist.value.trim().length > 0) {
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

const handleSubmit = async () => {
  error.value = ''
  success.value = ''
  
  if (!title.value.trim() || !artist.value.trim()) {
    error.value = '歌曲名称和歌手名称不能为空'
    return
  }
  
  // 再次检查相似歌曲
  const similar = songService.checkSimilarSongs(title.value.trim(), artist.value.trim())
  if (similar && similar.title.toLowerCase() === title.value.trim().toLowerCase() && 
      similar.artist.toLowerCase() === artist.value.trim().toLowerCase()) {
    error.value = `《${title.value}》已经在列表中，不能重复投稿`
    return
  }
  
  try {
    submitting.value = true
    
    // 创建请求数据对象，确保总是包含title和artist
    const requestData = {
      title: title.value.trim(),
      artist: artist.value.trim()
    }
    
    // 只有在启用了播放时段选择且用户选择了时段时，才添加preferredPlayTimeId
    if (playTimeSelectionEnabled.value && preferredPlayTimeId.value) {
      requestData.preferredPlayTimeId = parseInt(preferredPlayTimeId.value)
    }
    
    const result = await emit('request', requestData)
    
    if (result) {
      success.value = '点歌成功！'
      // 清空表单
      title.value = ''
      artist.value = ''
      preferredPlayTimeId.value = ''
      similarSong.value = null
      
      // 3秒后清除成功提示
      setTimeout(() => {
        success.value = ''
      }, 3000)
    }
  } catch (err) {
    console.error('投稿失败:', err)
    error.value = err.message || '投稿失败，请稍后重试'
  } finally {
    submitting.value = false
  }
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
}
</style> 