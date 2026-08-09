<template>
  <div
    class="backdrop-blur-md p-6 rounded-xl border border-primary-10 bg-bg-tertiary-70 shadow-2xl max-w-[400px] mx-auto text-text-primary transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_15px_30px_var(--modal-hover-shadow)]"
  >
    <h3 class="mb-6 pb-2 border-b border-primary-10 text-text-primary font-bold text-lg">
      {{ scheduleTitle }}
    </h3>

    <form @submit.prevent="handleSubmit">
      <div class="mb-4">
        <label class="block mb-2 font-medium text-text-primary" for="playDate">{{ locale.playDate }}</label>
        <input
          id="playDate"
          v-model="playDate"
          class="w-full p-3 border border-primary-10 rounded-lg text-base bg-bg-tertiary-50 text-text-primary outline-none transition-colors duration-150 focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-light)]"
          required
          type="date"
        >
      </div>

      <!-- 播出时段选择 -->
      <div v-if="playTimeEnabled" class="mb-4">
        <CustomSelect
          v-model="playTimeId"
          :options="playTimeOptions"
          :label="locale.playTime"
          :placeholder="locale.unspecified"
          class-name="w-full"
        />

        <div
          v-if="song?.preferredPlayTime"
          class="mt-3 p-3 bg-bg-secondary-5 rounded-lg text-sm flex items-start gap-2"
        >
          <div class="text-base">💡</div>
          <div>
            {{ locale.preferredPlayTime }}
            <span class="font-medium text-info">
              {{ song.preferredPlayTime.name }}
              <template v-if="song.preferredPlayTime.startTime || song.preferredPlayTime.endTime">
                ({{ formatPlayTimeRange(song.preferredPlayTime) }})
              </template>
            </span>
          </div>
        </div>
      </div>

      <div v-if="error" class="p-3 mt-4 bg-error-10 text-error rounded-lg">
        {{ error }}
      </div>

      <div class="flex justify-between gap-4 mt-6">
        <button
          class="flex-1 p-3 border border-primary-10 rounded-lg text-base cursor-pointer transition-all duration-200 bg-bg-secondary-10 text-text-primary hover:bg-bg-secondary-15"
          type="button"
          @click="$emit('cancel')"
        >
          {{ commonLocale.cancel }}
        </button>
        <button
          :disabled="loading"
          class="flex-1 p-3 border-none rounded-lg text-base cursor-pointer transition-all duration-200 bg-info text-text-primary hover:bg-info hover:-translate-y-px disabled:bg-info-50 disabled:cursor-not-allowed disabled:transform-none"
          type="submit"
        >
          {{ loading ? locale.creating : locale.create }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { useSongs } from '~/composables/useSongs'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useLocale } from '~/utils/locale'

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
const { common } = useLocale()
const commonLocale = computed(() => common.value || {})
const locale = computed(() => useSafeLocale(common.value?.scheduleForm || {}))
const scheduleTitle = computed(() => {
  const title = locale.value?.title
  if (typeof title === 'string') return title.replace(/{0}/g, props.song?.title || '')
  if (typeof title === 'function') return title(props.song?.title || '')
  return ''
})

// 转换播出时段为 CustomSelect 选项格式
const playTimeOptions = computed(() => {
  const options = [{ label: locale.value.unspecified, value: '' }]

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
    return formatLocale(locale.value.startAt, playTime.startTime) || playTime.startTime
  } else if (playTime.endTime) {
    return formatLocale(locale.value.endAt, playTime.endTime) || playTime.endTime
  }

  return locale.value.unlimited
}

const handleSubmit = () => {
  error.value = ''

  if (!playDate.value) {
    error.value = locale.value.dateRequired
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
