<template>
  <audio
      ref="audioPlayer"
      :src="song?.musicUrl"
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
  ></audio>
</template>

<script setup>
import {ref} from 'vue'

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

defineExpose({
  audioPlayer
})
</script>