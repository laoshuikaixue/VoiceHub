<template>
  <div
    class="admin-song-card"
    :class="{
      'admin-song-card--selected': selected,
      'admin-song-card--warning': warning,
      'admin-song-card--with-leading': $slots.leading
    }"
  >
    <div v-if="$slots.leading" class="admin-song-card__leading">
      <slot name="leading" />
    </div>

    <button
      :aria-label="song.title"
      class="admin-song-card__cover"
      type="button"
      @click.stop="$emit('play')"
    >
      <img
        v-if="coverUrl"
        :src="coverUrl"
        :alt="song.title"
        loading="lazy"
        referrerpolicy="no-referrer"
      >
      <span v-else class="admin-song-card__cover-text">{{ initial }}</span>
      <span class="admin-song-card__play">
        <Play :size="14" fill="currentColor" />
      </span>
    </button>

    <div class="admin-song-card__body">
      <div class="admin-song-card__title-row">
        <h4 :title="fullTitle" class="admin-song-card__title">{{ song.title || '-' }}</h4>
        <slot name="badges" />
      </div>

      <div class="admin-song-card__subline">
        <span :title="song.artist" class="admin-song-card__artist">{{ song.artist || '-' }}</span>
        <span v-if="durationText" class="admin-song-card__duration">{{ durationText }}</span>
        <span
          v-if="platformName"
          :class="['platform-tag', 'admin-song-card__platform', `platform-${platformClass}`]"
        >
          {{ platformName }}
        </span>
        <slot name="subline" />
      </div>

      <div v-if="requester" class="admin-song-card__requester">
        <span class="truncate">{{ requester }}</span>
        <span v-if="gradeClass" class="shrink-0 text-text-disabled">· {{ gradeClass }}</span>
        <slot name="requester-extra" />
      </div>

      <slot name="meta" />
    </div>

    <div v-if="$slots.actions" class="admin-song-card__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Play } from '@lucide/vue'
import { formatDuration } from '~/utils/timeUtils'
import { getCoverThumbUrl } from '~/utils/url'
import { BUILTIN_PLATFORMS, getPlatformDisplayName } from '~/utils/platforms'
import { useLocale } from '~/utils/locale'
import { usePlatformConfig } from '~/composables/usePlatformConfig'

const props = defineProps({
  song: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  warning: { type: Boolean, default: false },
  showRequester: { type: Boolean, default: true }
})

defineEmits(['play'])

const { currentLocale } = useLocale()
const { pluginPlatforms } = usePlatformConfig()

const fullTitle = computed(() => `${props.song.title || ''} - ${props.song.artist || ''}`)
const initial = computed(() => (props.song.title || '?').trim().charAt(0))
const coverUrl = computed(() => (props.song.cover ? getCoverThumbUrl(props.song.cover) : ''))
const durationText = computed(() =>
  props.song.durationSeconds ? formatDuration(Number(props.song.durationSeconds)) : ''
)
const platformName = computed(() => {
  const platform = props.song.musicPlatform
  if (!platform) return ''
  const plugin = pluginPlatforms.value?.find((item) => item.platform === platform)
  return plugin?.displayName || getPlatformDisplayName(platform, null, currentLocale.value)
})
const platformClass = computed(() =>
  BUILTIN_PLATFORMS.includes(props.song.musicPlatform) ? props.song.musicPlatform : 'plugin'
)
const requester = computed(() => (props.showRequester ? props.song.requester || '' : ''))
const gradeClass = computed(() => {
  const grade = props.song.requesterGrade || props.song.grade || ''
  const klass = props.song.requesterClass || props.song.class || ''
  return [grade, klass].filter(Boolean).join(' ')
})
</script>

<style scoped>
.admin-song-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-secondary);
  border-radius: 12px;
  background: var(--panel-bg);
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast);
}

.admin-song-card--with-leading {
  grid-template-columns: auto auto minmax(0, 1fr);
}

.admin-song-card:hover {
  border-color: var(--border-tertiary);
}

.admin-song-card--selected {
  border-color: var(--primary-30);
  background: var(--primary-5);
}

.admin-song-card--warning {
  border-color: var(--warning-30);
  background: var(--warning-5);
}

.admin-song-card__leading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.admin-song-card__cover {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--border-tertiary);
  border-radius: 10px;
  background: var(--bg-tertiary);
  padding: 0;
}

.admin-song-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.admin-song-card__cover-text {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}

.admin-song-card__play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mask-40);
  color: #fff;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.admin-song-card__cover:hover .admin-song-card__play {
  opacity: 1;
}

.admin-song-card__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.admin-song-card__title-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.admin-song-card__title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.admin-song-card__subline {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--text-tertiary);
}

.admin-song-card__artist {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.admin-song-card__duration {
  flex-shrink: 0;
  color: var(--text-disabled);
  font-variant-numeric: tabular-nums;
}

.admin-song-card__requester {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 12px;
  color: var(--text-tertiary);
}

.admin-song-card__actions {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 2px;
}

@media (max-width: 640px) {
  .admin-song-card,
  .admin-song-card--with-leading {
    grid-template-columns: auto auto minmax(0, 1fr);
    gap: 10px;
    padding: 12px;
  }

  .admin-song-card__cover {
    width: 44px;
    height: 44px;
  }

  .admin-song-card__title {
    display: block;
    overflow: visible;
    -webkit-line-clamp: unset;
    overflow-wrap: anywhere;
  }

  .admin-song-card__artist {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .admin-song-card__actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
    margin-top: 2px;
  }
}
</style>
