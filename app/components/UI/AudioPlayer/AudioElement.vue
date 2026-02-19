<template>
  <audio
    v-if="song?.musicUrl"
    ref="audioPlayer"
    :src="song.musicUrl"
    crossorigin="anonymous"
    autoplay
    preload="auto"
    referrerpolicy="no-referrer"
    @canplay="$emit('canplay', $event)"
    @ended="$emit('ended', $event)"
    @error="$emit('error', $event)"
    @loadedmetadata="$emit('loadedmetadata', $event)"
    @loadstart="$emit('loadstart', $event)"
    @pause="$emit('pause', $event)"
    @play="$emit('play', $event)"
    @timeupdate="$emit('timeupdate', $event)"
  />
  <!-- 如果没有 musicUrl（如哔哩哔哩视频），创建一个虚拟的 audio 元素 -->
  <audio v-else-if="song" ref="audioPlayer" style="display: none" />
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  song: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'timeupdate',
  'ended',
  'loadedmetadata',
  'error',
  'play',
  'pause',
  'loadstart',
  'canplay'
])

const audioPlayer = ref(null)

// 错误消息常量，避免使用魔法字符串
const ERROR_MESSAGES = {
  BILIBILI_NO_AUDIO: 'No audio URL available for Bilibili video'
}

// 监听 song 变化，如果没有 musicUrl 则立即触发错误
watch(
  () => props.song,
  (newSong, oldSong) => {
    if (newSong && !newSong.musicUrl) {
      // 使用 nextTick 确保 DOM 已更新
      nextTick(() => {
        // 创建一个自定义错误对象
        const error = new Error(ERROR_MESSAGES.BILIBILI_NO_AUDIO)
        error.name = 'BilibiliNoAudioError'

        // 立即触发错误事件
        emit('error', error)
      })
    }
  },
  { immediate: true }
)

defineExpose({
  audioPlayer
})
</script>
