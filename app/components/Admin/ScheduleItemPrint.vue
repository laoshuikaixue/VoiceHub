<template>
  <div class="schedule-item-print" :class="{ 'is-narrow': narrow }">
    <div class="item-content">
      <div v-if="settings.showSequence || settings.showCover" class="item-leading">
        <!-- 序号 -->
        <div v-if="settings.showSequence" class="sequence-number">
          {{ schedule.sequence || 1 }}
        </div>

        <!-- 歌曲封面 -->
        <div v-if="settings.showCover" class="cover-section">
          <img
            v-if="schedule.song.cover"
            :alt="schedule.song.title"
            :data-original-src="convertToHttps(schedule.song.cover)"
            :src="convertToHttps(schedule.song.cover)"
            class="song-cover"
            referrerpolicy="no-referrer"
            @error="handleImageError"
          >
          <div class="cover-placeholder" :class="{ show: !schedule.song.cover }">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6" />
              <path d="m21 12-6-3-6 3-6-3" />
            </svg>
          </div>
        </div>
      </div>

      <!-- 歌曲信息 -->
      <div class="song-info">
        <div v-if="settings.showTitle" class="song-title">
          <span class="title-text">{{ schedule.song.title }}</span>
          <!-- 重播标识 -->
          <span v-if="schedule.replayRequestId != null" class="replay-badge-print"> {{ locale.replay }} </span>
          <!-- 跨学期标识 -->
          <span
            v-if="
              settings.currentSemester &&
              schedule.song.semester &&
              schedule.song.semester !== settings.currentSemester
            "
            class="cross-semester-badge-print"
          >
            {{ locale.crossSemester }}
          </span>
        </div>
        <div v-if="settings.showArtist" class="song-artist">
          {{ schedule.song.artist }}
        </div>
      </div>

      <div v-if="settings.showRequester || settings.showVotes" class="item-trailing">
        <!-- 投稿人信息（重播歌曲不显示申请人，只显示原投稿人） -->
        <div v-if="settings.showRequester" class="requester-info">
          <span class="label">{{ locale.requesterPrefix }}</span>
          <span class="value">
            {{ schedule.song.requester }}
            <span v-if="schedule.song.collaborators && schedule.song.collaborators.length > 0">
              & {{ schedule.song.collaborators.map((c) => c.displayName || c.name).join(' & ') }}
            </span>
          </span>
        </div>

        <!-- 人数信息 -->
        <div v-if="settings.showVotes" class="votes-info">
          <span v-if="schedule.replayRequestId != null" class="label">{{ locale.replayRequestsPrefix }}</span>
          <span v-else class="label">{{ locale.popularityPrefix }}</span>
          <span class="value">{{
            schedule.replayRequestId != null
              ? locale.replayCount(schedule.song.replayRequestCount)
              : schedule.song.voteCount || 0
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue'
import { convertToHttps } from '~/utils/url'
import { useLocale } from '~/utils/locale'
const { admin } = useLocale()
const locale = computed(() => admin.value.schedulePrinter)

// 定义props
defineProps({
  schedule: {
    type: Object,
    required: true
  },
  settings: {
    type: Object,
    required: true
  },
  narrow: {
    type: Boolean,
    default: false
  }
})

// 处理图片加载错误
const handleImageError = (event) => {
  event.target.style.display = 'none'
  event.target.nextElementSibling?.classList.add('show')
}
</script>

<style scoped>
.schedule-item-print {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #d1d5db;
  page-break-inside: avoid;
  break-inside: avoid;
}

.item-content {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 12px;
  min-width: 0;
}

.item-leading {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.item-trailing {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.sequence-number {
  width: 30px;
  height: 30px;
  background: #f0f0f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
  color: #1a1a1a;
  flex-shrink: 0;
}

.cover-section {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.song-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: #f5f5f5;
  border-radius: 4px;
  display: none;
  align-items: center;
  justify-content: center;
  color: #6c757d;
}

.cover-placeholder.show {
  display: flex;
}

.cover-placeholder svg {
  width: 20px;
  height: 20px;
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-title {
  font-weight: bold;
  font-size: 16px;
  color: #1a1a1a;
  margin-bottom: 2px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

/* 歌名文本块：text-overflow 只能作用在块容器上，故单独承载裁剪 */
.title-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 打印用重播标识 */
.replay-badge-print {
  display: inline-block;
  padding: 1px 4px;
  background: #f8f9fa;
  border: 1px solid #0b5afe;
  border-radius: 3px;
  color: #2563eb;
  font-size: 10px;
  font-weight: bold;
  flex-shrink: 0;
}

/* 跨学期标识 */
.cross-semester-badge-print {
  display: inline-block;
  padding: 1px 4px;
  background: #f5f5f5;
  border: 1px solid #d1d5db;
  color: #636366;
  font-size: 10px;
  border-radius: 2px;
  font-weight: normal;
  margin-left: 4px;
  vertical-align: middle;
  flex-shrink: 0;
}

.song-artist {
  font-size: 14px;
  color: #636366;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.requester-info,
.votes-info {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #636366;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.label {
  font-weight: 500;
  margin-right: 4px;
  flex-shrink: 0;
}

.value {
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 两列窄版排布 */
.schedule-item-print.is-narrow {
  padding: 6px 0;
}

.is-narrow .item-content,
.is-narrow .item-leading {
  gap: 8px;
}

.is-narrow .sequence-number {
  width: 22px;
  height: 22px;
  font-size: 12px;
}

.is-narrow .cover-section {
  width: 32px;
  height: 32px;
}

.is-narrow .cover-placeholder svg {
  width: 16px;
  height: 16px;
}

.is-narrow .song-title {
  font-size: 13px;
  gap: 3px;
}

.is-narrow .song-artist {
  font-size: 11px;
}

.is-narrow .replay-badge-print,
.is-narrow .cross-semester-badge-print {
  font-size: 9px;
  padding: 0 3px;
}

/* 人数与歌名同行、投稿人与歌手同行 */
.is-narrow .item-trailing {
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
  min-width: 0;
  max-width: 45%;
}

.is-narrow .votes-info {
  order: -1;
}

.is-narrow .requester-info,
.is-narrow .votes-info {
  font-size: 11px;
  justify-content: flex-end;
  max-width: 100%;
}

/* 打印样式 */
@media print {
  .schedule-item-print {
    color: #1a1a1a !important;
    background: #ffffff !important;
    width: 100% !important;
    max-width: none !important;
    box-sizing: border-box !important;
  }

  .item-content {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    width: 100% !important;
    gap: 12px !important;
  }

  .sequence-number {
    background: #f0f0f0 !important;
    color: #1a1a1a !important;
    width: 30px !important;
    height: 30px !important;
    flex-shrink: 0 !important;
  }

  .cover-section {
    width: 40px !important;
    height: 40px !important;
    flex-shrink: 0 !important;
  }

  .song-info {
    flex: 1 !important;
    min-width: 0 !important;
  }

  .song-title {
    color: #1a1a1a !important;
    font-size: 16px !important;
    white-space: nowrap !important;
  }

  .title-text {
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .song-artist,
  .label,
  .value {
    color: #3a3a3c !important;
  }

  .time-range {
    color: #636366 !important;
  }

  .requester-info,
  .votes-info,
  .playtime-info {
    display: flex !important;
    align-items: center !important;
    font-size: 12px !important;
    white-space: nowrap !important;
    flex-shrink: 0 !important;
  }
}

/* 紧凑模式 */
.compact .schedule-item-print {
  padding: 4px 0;
}

.compact .item-content {
  gap: 8px;
}

.compact .sequence-number {
  width: 24px;
  height: 24px;
  font-size: 12px;
}

.compact .cover-section {
  width: 32px;
  height: 32px;
}

.compact .song-title {
  font-size: 14px;
}

.compact .song-artist {
  font-size: 12px;
}

.compact .requester-info,
.compact .votes-info,
.compact .playtime-info {
  font-size: 11px;
}
</style>
