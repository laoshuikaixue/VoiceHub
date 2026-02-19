<template>
  <div
    class="lyric-am"
    :class="{
      'align-right': settings.lyricAlignRight.value
    }"
    :style="{
      '--amll-lp-color': 'rgb(var(--main-cover-color, 239 239 239))',
      '--amll-lp-hover-bg-color': 'rgba(255,255,255,0.08)',
      '--amll-lyric-left-padding': settings.lyricAlignRight.value
        ? ''
        : `${settings.lyricHorizontalOffset.value}px`,
      '--amll-lyric-right-padding': settings.lyricAlignRight.value
        ? `${settings.lyricHorizontalOffset.value}px`
        : ''
    }"
  >
    <Transition name="fade" mode="out-in">
      <div v-if="lyricManager.loading.value" class="lyric-message-container">
        <Icon name="loader" :size="32" class="spin-animation" />
        <div class="message-text">歌词加载中...</div>
      </div>
      <div v-else-if="lyricManager.error.value" class="lyric-message-container">
        <Icon name="alert-circle" :size="32" />
        <div class="message-text">{{ lyricManager.error.value }}</div>
      </div>
      <div v-else-if="!lyricLines || lyricLines.length === 0" class="lyric-message-container">
        <Icon name="music" :size="48" style="opacity: 0.5" />
        <div class="message-text">暂无歌词</div>
      </div>
      <LyricPlayer
        v-else
        ref="lyricPlayerRef"
        :lyric-lines="lyricLines"
        :current-time="currentTime * 1000"
        :playing="audioPlayer.getPlayingStatus().value"
        :enable-spring="settings.useAMSpring.value"
        :enable-scale="settings.useAMSpring.value"
        :align-position="settings.lyricsScrollOffset.value"
        :align-anchor="settings.lyricsScrollOffset.value > 0.4 ? 'center' : 'top'"
        :enable-blur="settings.lyricsBlur.value"
        :hide-passed-lines="settings.hidePassedLines.value"
        :word-fade-width="settings.wordFadeWidth.value"
        :style="{
          '--display-count-down-show': settings.countDownShow.value ? 'flex' : 'none',
          '--amll-lp-font-size': `${settings.lyricFontSize.value}px`,
          'font-weight': settings.lyricFontWeight.value,
          'font-family': settings.LyricFont.value !== 'follow' ? settings.LyricFont.value : ''
        }"
        class="am-lyric"
        @line-click="jumpSeek"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import LyricPlayer, { type LyricPlayerRef } from '~/components/AMLL/LyricPlayer.vue'
import Icon from '~/components/UI/Icon.vue'
import { useLyricManager } from '~/composables/useLyricManager'
import { useLyricSettings } from '~/composables/useLyricSettings'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useAudioPlayerControl } from '~/composables/useAudioPlayerControl'
import type { LyricLineMouseEvent } from '@applemusic-like-lyrics/core'
import { cloneDeep } from 'lodash-es'

const props = defineProps({
  currentTime: {
    type: Number,
    default: 0
  }
})

const lyricManager = useLyricManager()
const settings = useLyricSettings()
const audioPlayer = useAudioPlayer()
const audioPlayerControl = useAudioPlayerControl()

const lyricPlayerRef = ref<LyricPlayerRef | null>(null)

const lyricLines = computed(() => {
  // 使用 cloneDeep 剥离 Vue 响应式代理，防止 structuredClone 错误
  return cloneDeep(lyricManager.lyrics.value)
})

// 进度跳转
const jumpSeek = (line: LyricLineMouseEvent) => {
  // 移除焦点，防止组件内部焦点导致键盘事件异常
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }

  const lineContent = line.line.getLine()
  if (!lineContent?.startTime) return
  const time = lineContent.startTime
  const offsetMs = settings.lyricOffset.value
  const targetTime = (time - offsetMs) / 1000

  audioPlayerControl.seekAndPlay(targetTime)
}
</script>

<style scoped>
.lyric-am {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
}

.am-lyric {
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  padding-left: var(--amll-lyric-left-padding, 10px);
  padding-right: 80px;
}

/* 移动端适配 */
@media (max-width: 990px) {
  .am-lyric {
    padding: 0;
    margin-left: 0;
  }
}

.lyric-am.align-right .am-lyric {
  padding-left: 80px;
  padding-right: var(--amll-lyric-right-padding, 10px);
}

@media (max-width: 990px) {
  .lyric-am.align-right .am-lyric {
    padding: 0;
    margin-right: -20px;
  }
}

/* 高亮效果 */
:deep(.am-lyric .current),
:deep(.am-lyric .is-current),
:deep(.am-lyric .active),
:deep(.am-lyric .is-active),
:deep(.am-lyric .lyric-line.current),
:deep(.am-lyric .lyric-line.is-current) {
  mix-blend-mode: plus-lighter;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 12px rgba(255, 255, 255, 0.06);
  will-change: transform, opacity, color;
}

@supports not (mix-blend-mode: plus-lighter) {
  :deep(.am-lyric .current),
  :deep(.am-lyric .is-current),
  :deep(.am-lyric .active),
  :deep(.am-lyric .is-active),
  :deep(.am-lyric .lyric-line.current),
  :deep(.am-lyric .lyric-line.is-current) {
    color: #ffffff;
    text-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
  }
}

:deep(.am-lyric div[class*='lyricMainLine'] span) {
  text-align: start;
}

.lyric-message-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--amll-lp-color, #efefef);
  gap: 16px;
  opacity: 0.8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.message-text {
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.5px;
  opacity: 0.8;
}

.spin-animation {
  animation: spin 1s linear infinite;
  opacity: 0.9;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
