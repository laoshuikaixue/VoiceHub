<template>
  <div class="request-form">
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="title">歌曲名称</label>
        <input 
          id="title" 
          v-model="title" 
          type="text" 
          required 
          placeholder="请输入歌曲名称"
          class="input"
          @input="checkSimilarSongs"
        />
      </div>
      
      <div class="form-group">
        <label for="artist">艺术家</label>
        <input 
          id="artist" 
          v-model="artist" 
          type="text" 
          required 
          placeholder="请输入艺术家名称"
          class="input"
          @input="checkSimilarSongs"
        />
      </div>
      
      <!-- 播出时段选择 -->
      <div v-if="playTimeSelectionEnabled && playTimes.length > 0" class="form-group">
        <label for="playTime">期望播出时段</label>
        <select 
          id="playTime" 
          v-model="preferredPlayTimeId" 
          class="input"
        >
          <option value="">不指定</option>
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
        <div class="help-text">
          选择您希望歌曲播放的时段，管理员将尽量安排在您选择的时段播放
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
      
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="success" class="success">{{ success }}</div>
      
      <button type="submit" :disabled="loading || submitting" class="btn btn-primary btn-block">
        {{ loading || submitting ? '处理中...' : '提交点歌' }}
      </button>
    </form>
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
    error.value = '歌曲名称和艺术家名称不能为空'
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
    error.value = err.message || '点歌失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.request-form {
  width: 100%;
}

.form-group {
  margin-bottom: 1.25rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--light);
}

.input {
  width: 100%;
  padding: 0.75rem;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  font-size: 1rem;
  color: var(--light);
}

.input:focus {
  border-color: var(--primary);
  outline: none;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
}

.help-text {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--gray);
}

.btn-block {
  display: block;
  width: 100%;
}

.error, .success {
  padding: 0.75rem;
  border-radius: 0.375rem;
  margin: 1rem 0;
}

.error {
  background: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.2);
}

.success {
  background: rgba(46, 204, 113, 0.1);
  color: #2ecc71;
  border: 1px solid rgba(46, 204, 113, 0.2);
}

.similar-song-alert {
  background: rgba(241, 196, 15, 0.1);
  border: 1px solid rgba(241, 196, 15, 0.2);
  border-radius: 0.375rem;
  padding: 1rem;
  margin-bottom: 1.25rem;
}

.alert-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.alert-icon {
  margin-right: 0.5rem;
}

.alert-title {
  font-weight: 500;
  color: #f39c12;
}

.alert-content {
  margin-bottom: 0.75rem;
}

.alert-hint {
  font-size: 0.875rem;
  color: var(--gray);
  margin-top: 0.25rem;
}

.alert-actions {
  display: flex;
  gap: 0.5rem;
}

.vote-btn, .ignore-btn {
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.vote-btn {
  background: #f39c12;
  color: white;
}

.vote-btn:hover {
  background: #e67e22;
}

.vote-btn:disabled {
  background: rgba(243, 156, 18, 0.5);
  cursor: not-allowed;
}

.ignore-btn {
  background: rgba(255, 255, 255, 0.1);
  color: var(--light);
}

.ignore-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-primary {
  background-color: var(--primary);
  color: white;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background-color: var(--primary-dark);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  background-color: rgba(99, 102, 241, 0.5);
  cursor: not-allowed;
  transform: none;
}
</style> 