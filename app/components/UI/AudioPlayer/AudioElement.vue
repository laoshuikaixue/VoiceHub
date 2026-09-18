<template>
  <audio
    ref="audioPlayer"
    :key="audioKey"
    :src="audioSrc"
    v-bind="crossOriginVal ? { crossorigin: crossOriginVal } : {}"
    :referrerpolicy="referrerPolicyVal"
    playsinline
    preload="auto"
    webkit-playsinline
    @canplay="$emit('canplay', $event)"
    @ended="$emit('ended', $event)"
    @error="$emit('error', $event)"
    @loadedmetadata="$emit('loadedmetadata', $event)"
    @loadstart="$emit('loadstart', $event)"
    @pause="$emit('pause', $event)"
    @play="$emit('play', $event)"
    @timeupdate="$emit('timeupdate', $event)"
  ></audio>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { isPluginPlatform } from '~/utils/pluginPlatform'
import { getCachedMusicUrlSource } from '~/utils/musicUrl'

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

// 咪咕与插件音源不保证 CORS 响应头，强制 crossorigin="anonymous"
// 会直接导致 MEDIA_ELEMENT_ERROR_SRC_NOT_SUPPORTED，需退回 no-cors 模式加载
const isNoCorsSource = computed(() => {
  const platform = props.song?.musicPlatform
  return platform === 'migu' || isPluginPlatform(platform) || (getCachedMusicUrlSource(props.song?.musicUrl)?.startsWith('plugin:') ?? false)
})
const crossOriginVal = computed(() => (isNoCorsSource.value ? null : 'anonymous'))
const referrerPolicyVal = computed(() => (isNoCorsSource.value ? null : 'no-referrer'))
const audioSrc = computed(() => {
  return props.song?.musicUrl || undefined
})
const audioKey = computed(() => {
  // 当平台改变时，使用不同的 key 强制重新创建元素
  return props.song?.musicPlatform || 'default'
})

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
