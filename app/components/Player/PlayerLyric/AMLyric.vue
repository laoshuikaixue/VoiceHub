<template>
  <div
    class="lyric-am"
    :class="{
      'align-right': settings.lyricAlignRight.value
    }"
    :style="{
      '--amll-lp-color':
        'rgb(var(--main-cover-lyric-color, var(--main-cover-color, 239 239 239)))',
      '--amll-lp-hover-bg-color': 'var(--lyrics-modal-surface, rgba(255, 255, 255, 0.1))',
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
        <div class="message-text">{{ locale.loading }}</div>
      </div>
      <div v-else-if="lyricManager.error.value" class="lyric-message-container">
        <Icon name="alert-circle" :size="32" />
        <div class="message-text">{{ lyricManager.error.value }}</div>
      </div>
      <div v-else-if="!lyricLines || lyricLines.length === 0" class="lyric-message-container">
        <Icon name="music" :size="48" style="opacity: 0.5" />
        <div class="message-text">{{ locale.empty }}</div>
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
        :optimize-options="optimizeOptions"
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
import { useLocale } from '~/utils/locale'
import { hasWordRomanization } from '~/utils/lyric/lyricText'
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
const { ui } = useLocale()
const locale = computed(() => ui.value?.lyrics || {})

const lyricPlayerRef = ref<LyricPlayerRef | null>(null)

/**
 * 按显示设置裁剪歌词行
 * AMLL 核心会同时渲染 word.romanWord（逐字音译）与 line.romanLyric（逐行音译），
 * 两者必须在传入前互斥裁剪，否则有逐字音译的行会重复显示一遍逐行音译
 */
const lyricLines = computed(() => {
  const lines = lyricManager.lyrics.value
  if (!lines.length) return []

  const { showTranslation, showRoma, showWordsRoma, swapTranRoma } = settings

  // 使用 cloneDeep 剥离 Vue 响应式代理，防止 structuredClone 错误
  return cloneDeep(lines).map((line) => {
    // showRoma 是音译总开关，showWordsRoma 只决定用逐字还是逐行形态
    const useWordRoma = showRoma.value && showWordsRoma.value && hasWordRomanization(line)
    const translationText = showTranslation.value ? line.translatedLyric || '' : ''
    const romanText = useWordRoma || !showRoma.value ? '' : line.romanLyric || ''

    if (!useWordRoma) {
      line.words.forEach((word) => {
        word.romanWord = ''
      })
    }
    line.translatedLyric = swapTranRoma.value ? romanText : translationText
    line.romanLyric = swapTranRoma.value ? translationText : romanText
    return line
  })
})

// AMLL 歌词优化配置
const optimizeOptions = computed(() => ({
  normalizeSpaces: settings.amllNormalizeSpaces.value,
  resetLineTimestamps: settings.amllResetLineTimestamps.value,
  convertExcessiveBackgroundLines: settings.amllConvertBgLines.value,
  syncMainAndBackgroundLines: settings.amllSyncBgLines.value,
  cleanUnintentionalOverlaps: settings.amllCleanOverlaps.value,
  tryAdvanceStartTime: settings.amllTryAdvanceStart.value
}))

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
  color: var(--lyrics-modal-text, #ffffff);
  text-shadow: 0 2px 12px var(--overlay-6);
  will-change: transform, opacity, color;
}

@supports not (mix-blend-mode: plus-lighter) {
  :deep(.am-lyric .current),
  :deep(.am-lyric .is-current),
  :deep(.am-lyric .active),
  :deep(.am-lyric .is-active),
  :deep(.am-lyric .lyric-line.current),
  :deep(.am-lyric .lyric-line.is-current) {
    color: var(--lyrics-modal-text, #ffffff);
    text-shadow: 0 4px 18px var(--mask-35);
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
  color: var(--amll-lp-color, var(--text-primary-lighter, var(--lyric-msg-fallback-text, #e4e4e7)));
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
