<template>
  <div class="schedule-form">
    <h3>为歌曲 "{{ song?.title }}" 创建排期</h3>

    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="playDate">播放日期</label>
        <input
            id="playDate"
            v-model="playDate"
            class="date-input"
            required
            type="date"
        />
      </div>

      <!-- 播出时段选择 -->
      <div v-if="playTimeEnabled" class="form-group">
        <label for="playTime">播出时段</label>
        <select
            id="playTime"
            v-model="playTimeId"
            class="time-input"
        >
          <option value="">未指定</option>
          <option
              v-for="playTime in playTimes"
              :key="playTime.id"
              :value="playTime.id"
          >
            {{ playTime.name }} ({{ playTime.startTime }} - {{ playTime.endTime }})
          </option>
        </select>
        <div v-if="song?.preferredPlayTime" class="preferred-time-hint">
          <div class="hint-icon">💡</div>
          <div>
            用户期望的播出时段:
            <span class="preferred-time">
              {{ song.preferredPlayTime.name }}
              <template v-if="song.preferredPlayTime.startTime || song.preferredPlayTime.endTime">
                ({{ formatPlayTimeRange(song.preferredPlayTime) }})
              </template>
            </span>
          </div>
        </div>
      </div>

      <div v-if="error" class="error">{{ error }}</div>

      <div class="form-actions">
        <button class="cancel-btn" type="button" @click="$emit('cancel')">
          取消
        </button>
        <button :disabled="loading" class="submit-btn" type="submit">
          {{ loading ? '创建中...' : '创建排期' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import {onMounted, ref} from 'vue'
import {useSongs} from '~/composables/useSongs'

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
const playTimeId = ref('')
const error = ref('')
const playTimes = ref([])
const {playTimeEnabled} = useSongs()

// 初始化
onMounted(async () => {
  await fetchPlayTimes()

  // 如果歌曲有期望的播出时段，默认选择该时段
  if (props.song?.preferredPlayTimeId) {
    playTimeId.value = props.song.preferredPlayTimeId
  }
})

// 获取播出时段
const fetchPlayTimes = async () => {
  try {
    // 使用useSongs中的方法获取播放时段
    await useSongs().fetchPlayTimes()
    const response = await fetch('/api/admin/play-times')
    if (response.ok) {
      const data = await response.json()
      // 只显示启用的播放时段
      playTimes.value = data.filter(pt => pt.enabled)
    }
  } catch (err) {
    console.error('获取播出时段失败:', err)
  }
}

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

const handleSubmit = () => {
  error.value = ''

  if (!playDate.value) {
    error.value = '请选择播放日期'
    return
  }

  const selectedDate = new Date(playDate.value)

  // 播出时段ID需要转换为数字或null
  const schedulePlayTimeId = playTimeId.value ? parseInt(playTimeId.value) : null

  emit('schedule', {
    songId: props.song.id,
    playDate: selectedDate,
    playTimeId: schedulePlayTimeId
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

.date-input, .time-input {
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

.date-input:focus, .time-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
}

.preferred-time-hint {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.hint-icon {
  font-size: 1rem;
}

.preferred-time {
  font-weight: 500;
  color: var(--primary-light);
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
  padding: 0.75rem;
  margin-top: 1rem;
  background: rgba(239, 68, 68, 0.1);
  color: rgb(252, 165, 165);
  border-radius: 0.5rem;
}
</style> 