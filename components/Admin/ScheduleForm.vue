<template>
  <div class="schedule-form">
    <h3>为歌曲 "{{ song?.title }}" 创建排期</h3>
    
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="playDate">播放日期</label>
        <input 
          id="playDate" 
          v-model="playDate" 
          type="date" 
          required 
          :min="minDate"
          class="date-input"
        />
      </div>
      
      <div v-if="error" class="error">{{ error }}</div>
      
      <div class="form-actions">
        <button type="button" class="cancel-btn" @click="$emit('cancel')">
          取消
        </button>
        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? '创建中...' : '创建排期' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  song: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['schedule', 'cancel'])

const playDate = ref('')
const error = ref('')

// 最小日期为今天
const minDate = computed(() => {
  const today = new Date()
  return today.toISOString().split('T')[0]
})

const handleSubmit = () => {
  error.value = ''
  
  if (!playDate.value) {
    error.value = '请选择播放日期'
    return
  }
  
  const selectedDate = new Date(playDate.value)
  const today = new Date()
  
  if (selectedDate < today) {
    error.value = '不能选择过去的日期'
    return
  }
  
  emit('schedule', {
    songId: props.song.id,
    playDate: selectedDate
  })
}
</script>

<style scoped>
.schedule-form {
  backdrop-filter: blur(10px);
  padding: 1.5rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(30, 41, 59, 0.7);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  max-width: 400px;
  margin: 0 auto;
  color: var(--light);
  transition: transform 0.2s, box-shadow 0.2s;
}

.schedule-form:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
}

h3 {
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--light);
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--light);
}

.date-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  font-size: 1rem;
  background: rgba(15, 23, 42, 0.6);
  color: var(--light);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.date-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
}

.form-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.5rem;
}

button {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--light);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.cancel-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.submit-btn {
  background-color: var(--primary);
  color: white;
}

.submit-btn:hover {
  background-color: var(--primary-dark);
  transform: translateY(-1px);
}

.submit-btn:disabled {
  background-color: rgba(99, 102, 241, 0.5);
  cursor: not-allowed;
  transform: none;
}

.error {
  background-color: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  padding: 0.75rem;
  border-radius: 0.5rem;
  margin: 1rem 0;
  border: 1px solid rgba(239, 68, 68, 0.2);
}
</style> 