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
import { ref, watch } from 'vue'
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
const error = ref('')
const success = ref('')
const submitting = ref(false)
const voting = ref(false)
const similarSong = ref(null)
const songService = useSongs()

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
    const result = await emit('request', {
      title: title.value.trim(),
      artist: artist.value.trim()
    })
    
    if (result) {
      success.value = '点歌成功！'
      // 清空表单
      title.value = ''
      artist.value = ''
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
  background: rgba(39, 174, 96, 0.1);
  color: #2ecc71;
  border: 1px solid rgba(39, 174, 96, 0.2);
}

/* 相似歌曲提示样式 */
.similar-song-alert {
  margin: 1rem 0;
  padding: 1rem;
  border-radius: 0.5rem;
  background: rgba(241, 196, 15, 0.1);
  border: 1px solid rgba(241, 196, 15, 0.3);
}

.alert-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.alert-icon {
  margin-right: 0.5rem;
  font-size: 1.25rem;
}

.alert-title {
  font-weight: 600;
  color: #f39c12;
}

.alert-content {
  margin-bottom: 1rem;
}

.alert-hint {
  font-size: 0.875rem;
  color: var(--gray);
  margin-top: 0.25rem;
}

.alert-actions {
  display: flex;
  gap: 0.75rem;
}

.vote-btn, .ignore-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.vote-btn {
  background: rgba(52, 152, 219, 0.2);
  color: #3498db;
  border: 1px solid rgba(52, 152, 219, 0.3);
}

.vote-btn:hover:not(:disabled) {
  background: rgba(52, 152, 219, 0.3);
  transform: translateY(-1px);
}

.vote-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ignore-btn {
  background: rgba(149, 165, 166, 0.2);
  color: #95a5a6;
  border: 1px solid rgba(149, 165, 166, 0.3);
}

.ignore-btn:hover {
  background: rgba(149, 165, 166, 0.3);
  transform: translateY(-1px);
}
</style> 