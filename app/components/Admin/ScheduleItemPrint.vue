<template>
  <div class="schedule-item-print">
    <div class="item-content">
      <!-- 序号 -->
      <div v-if="settings.showSequence" class="sequence-number">
        {{ schedule.sequence || 1 }}
      </div>

      <!-- 歌曲封面 -->
      <div v-if="settings.showCover" class="cover-section">
        <img
          v-if="schedule.song.cover"
          :alt="schedule.song.title"
          :src="convertToHttps(schedule.song.cover)"
          class="song-cover"
          referrerpolicy="no-referrer"
          @error="handleImageError"
        >
        <div v-else class="cover-placeholder">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v6" />
            <path d="m21 12-6-3-6 3-6-3" />
          </svg>
        </div>
      </div>

      <!-- 歌曲信息 -->
      <div class="song-info">
        <div v-if="settings.showTitle" class="song-title">
          {{ schedule.song.title }}
          <!-- 重播标识 -->
          <span v-if="schedule.song.replayRequestCount > 0" class="replay-badge-print"> 重播 </span>
        </div>
        <div v-if="settings.showArtist" class="song-artist">
          {{ schedule.song.artist }}
        </div>
      </div>

      <!-- 投稿人信息（重播歌曲不显示申请人，只显示原投稿人） -->
      <div v-if="settings.showRequester" class="requester-info">
        <span class="label">投稿人：</span>
        <span class="value">
          {{ schedule.song.requester }}
          <span v-if="schedule.song.collaborators && schedule.song.collaborators.length > 0">
            & {{ schedule.song.collaborators.map((c) => c.displayName || c.name).join(' & ') }}
          </span>
        </span>
      </div>

      <!-- 人数信息 -->
      <div v-if="settings.showVotes" class="votes-info">
        <span v-if="schedule.song.replayRequestCount > 0" class="label">申请重播：</span>
        <span v-else class="label">热度：</span>
        <span class="value">{{
          schedule.song.replayRequestCount > 0
            ? schedule.song.replayRequestCount + '人'
            : schedule.song.voteCount || 0
        }}</span>
      </div>

      <!-- 播出时段 -->
      <div v-if="settings.showPlayTime && schedule.playTime" class="playtime-info">
        <span class="label">时段：</span>
        <span class="value">
          {{ schedule.playTime.name }}
          <span v-if="schedule.playTime.startTime && schedule.playTime.endTime" class="time-range">
            ({{ schedule.playTime.startTime }}-{{ schedule.playTime.endTime }})
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue'
import { convertToHttps } from '~/utils/url'

// 定义props
const props = defineProps({
  schedule: {
    type: Object,
    required: true
  },
  settings: {
    type: Object,
    required: true
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
  border-bottom: 1px solid #e5e5e5;
  page-break-inside: avoid;
}

.item-content {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 12px;
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
  color: #333;
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
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
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
  color: #333;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 打印用重播标识 */
.replay-badge-print {
  display: inline-block;
  padding: 1px 4px;
  background: #e3f2fd;
  border: 1px solid #2196f3;
  border-radius: 3px;
  color: #1976d2;
  font-size: 10px;
  font-weight: bold;
  flex-shrink: 0;
}

.song-artist {
  font-size: 14px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.requester-info,
.votes-info,
.playtime-info {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.label {
  font-weight: 500;
  margin-right: 4px;
}

.value {
  color: #333;
}

.time-range {
  color: #999;
  font-size: 11px;
}

/* 打印样式 */
@media print {
  .schedule-item-print {
    color: #000 !important;
    background: #fff !important;
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
    color: #000 !important;
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
    color: #000 !important;
    font-size: 16px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .song-artist,
  .label,
  .value {
    color: #333 !important;
  }

  .time-range {
    color: #666 !important;
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
