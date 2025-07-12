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
        />
      </div>
      
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="success" class="success">{{ success }}</div>
      
      <button type="submit" :disabled="loading" class="btn btn-primary btn-block">
        {{ loading ? '处理中...' : '提交点歌' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['request'])

const title = ref('')
const artist = ref('')
const error = ref('')
const success = ref('')

const handleSubmit = async () => {
  error.value = ''
  success.value = ''
  
  if (!title.value.trim() || !artist.value.trim()) {
    error.value = '歌曲名称和艺术家名称不能为空'
    return
  }
  
  try {
    const result = await emit('request', {
      title: title.value.trim(),
      artist: artist.value.trim()
    })
    
    if (result) {
      success.value = '点歌成功！'
      // 清空表单
      title.value = ''
      artist.value = ''
      
      // 3秒后清除成功提示
      setTimeout(() => {
        success.value = ''
      }, 3000)
    }
  } catch (err) {
    error.value = err.message || '点歌失败，请稍后重试'
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
</style> 