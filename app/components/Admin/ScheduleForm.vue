<template>
  <div
    class="backdrop-blur-md p-6 rounded-xl border border-white/10 bg-slate-800/70 shadow-2xl max-w-[400px] mx-auto text-zinc-100 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_15px_30px_rgba(0,0,0,0.2)]"
  >
    <h3 class="mb-6 pb-2 border-b border-white/10 text-zinc-100 font-bold text-lg">
      为歌曲 "{{ song?.title }}" 创建排期
    </h3>

    <form @submit.prevent="handleSubmit">
      <div class="mb-4">
        <label class="block mb-2 font-medium text-zinc-100" for="playDate">播放日期</label>
        <input
          id="playDate"
          v-model="playDate"
          class="w-full p-3 border border-white/10 rounded-lg text-base bg-[#0f172a99] text-zinc-100 outline-none transition-colors duration-150 focus:border-indigo-500 focus:shadow-[0_0_0_2px_rgba(99,102,241,0.25)]"
          required
          type="date"
        >
      </div>

      <!-- 播出时段选择 -->
      <div v-if="playTimeEnabled" class="mb-4">
        <CustomSelect
          v-model="playTimeId"
          :options="playTimeOptions"
          label="播出时段"
          placeholder="未指定"
          class-name="w-full"
        />

        <div
          v-if="song?.preferredPlayTime"
          class="mt-3 p-3 bg-white/5 rounded-lg text-sm flex items-start gap-2"
        >
          <div class="text-base">💡</div>
          <div>
            用户期望的播出时段:
            <span class="font-medium text-indigo-300">
              {{ song.preferredPlayTime.name }}
              <template v-if="song.preferredPlayTime.startTime || song.preferredPlayTime.endTime">
                ({{ formatPlayTimeRange(song.preferredPlayTime) }})
              </template>
            </span>
          </div>
        </div>
      </div>

      <div v-if="error" class="p-3 mt-4 bg-red-500/10 text-red-300 rounded-lg">
        {{ error }}
      </div>

      <div class="flex justify-between gap-4 mt-6">
        <button
          class="flex-1 p-3 border border-white/10 rounded-lg text-base cursor-pointer transition-all duration-200 bg-white/10 text-zinc-100 hover:bg-white/15"
          type="button"
          @click="$emit('cancel')"
        >
          取消
        </button>
        <button
          :disabled="loading"
          class="flex-1 p-3 border-none rounded-lg text-base cursor-pointer transition-all duration-200 bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-px disabled:bg-indigo-500/50 disabled:cursor-not-allowed disabled:transform-none"
          type="submit"
        >
          {{ loading ? '创建中...' : '创建排期' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { useSongs } from '~/composables/useSongs'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'

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
const { playTimeEnabled } = useSongs()

// 转换播出时段为 CustomSelect 选项格式
const playTimeOptions = computed(() => {
  const options = [{ label: '未指定', value: '' }]

  if (playTimes.value && playTimes.value.length > 0) {
    playTimes.value.forEach((pt) => {
      options.push({
        label: `${pt.name} (${pt.startTime} - ${pt.endTime})`,
        value: pt.id
      })
    })
  }

  return options
})

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
      playTimes.value = data.filter((pt) => pt.enabled)
    }
  } catch (err) {
    console.error('获取播出时段失败:', err)
  }
}

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
