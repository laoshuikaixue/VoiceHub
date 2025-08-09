<template>
  <audio
    ref="audioPlayer"
    :src="song?.musicUrl"
    @timeupdate="$emit('timeupdate', $event)"
    @ended="$emit('ended', $event)"
    @loadedmetadata="$emit('loadedmetadata', $event)"
    @error="$emit('error', $event)"
    @play="$emit('play', $event)"
    @pause="$emit('pause', $event)"
    @loadstart="$emit('loadstart', $event)"
    @canplay="$emit('canplay', $event)"
  ></audio>
</template>

<script setup>
import { ref } from 'vue'

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