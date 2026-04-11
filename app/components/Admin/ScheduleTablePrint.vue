<template>
  <table class="schedule-timetable">
    <thead>
      <tr>
        <th v-if="settings.showSequence" class="col-sequence">序号</th>
        <th v-for="date in dates" :key="date" class="col-date">
          {{ formatDate(date) }}
        </th>
      </tr>
    </thead>
    <template v-if="hasPlayTimes">
      <tbody v-for="pt in sortedPlayTimes" :key="pt.key">
        <tr class="playtime-header-row">
          <td :colspan="dates.length + (settings.showSequence ? 1 : 0)" class="playtime-header">
            {{ pt.key }}
          </td>
        </tr>
        <tr v-for="rowIndex in getMaxRowsForPlayTime(pt.key)" :key="`${pt.key}-${rowIndex}`">
          <td v-if="settings.showSequence" class="col-sequence">{{ rowIndex }}</td>
          <td v-for="date in dates" :key="date" class="song-cell">
            <div v-if="getSchedule(date, pt.key, rowIndex - 1)" class="song-item">
              <img
v-if="settings.showCover && getSchedule(date, pt.key, rowIndex - 1).song.cover" 
                   :src="convertToHttps(getSchedule(date, pt.key, rowIndex - 1).song.cover)"
                   class="song-cover" @error="handleImageError" >
              <div class="song-details">
                <div v-if="settings.showTitle" class="song-title">
                  <span class="title-text">{{ getSchedule(date, pt.key, rowIndex - 1).song.title }}</span>
                  <!-- 重播标识 -->
                  <span v-if="getSchedule(date, pt.key, rowIndex - 1).song.replayRequestCount > 0" class="replay-badge-print"> 重播 </span>
                  <!-- 跨学期标识 -->
                  <span v-if="settings.currentSemester && getSchedule(date, pt.key, rowIndex - 1).song.semester && getSchedule(date, pt.key, rowIndex - 1).song.semester !== settings.currentSemester" class="cross-semester-badge-print"> 跨学期 </span>
                </div>
                <div v-if="settings.showArtist" class="song-artist">
                  {{ getSchedule(date, pt.key, rowIndex - 1).song.artist }}
                </div>
                <div v-if="settings.showRequester || settings.showVotes" class="song-meta">
                  <span v-if="settings.showRequester" class="song-requester">
                    {{ getSchedule(date, pt.key, rowIndex - 1).song.requester }}
                  </span>
                  <span v-if="settings.showRequester && settings.showVotes" class="meta-divider">|</span>
                  <span v-if="settings.showVotes" class="song-votes">
                    {{ getSchedule(date, pt.key, rowIndex - 1).song.replayRequestCount > 0 ? '重播:' + getSchedule(date, pt.key, rowIndex - 1).song.replayRequestCount : '热度:' + (getSchedule(date, pt.key, rowIndex - 1).song.voteCount || 0) }}
                  </span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </template>
    <template v-else>
      <tbody>
        <tr v-for="rowIndex in maxRowsAll" :key="rowIndex">
          <td v-if="settings.showSequence" class="col-sequence">{{ rowIndex }}</td>
          <td v-for="date in dates" :key="date" class="song-cell">
            <div v-if="getScheduleAll(date, rowIndex - 1)" class="song-item">
              <img
v-if="settings.showCover && getScheduleAll(date, rowIndex - 1).song.cover" 
                   :src="convertToHttps(getScheduleAll(date, rowIndex - 1).song.cover)"
                   class="song-cover" @error="handleImageError" >
              <div class="song-details">
                <div v-if="settings.showTitle" class="song-title">
                  <span class="title-text">{{ getScheduleAll(date, rowIndex - 1).song.title }}</span>
                  <!-- 重播标识 -->
                  <span v-if="getScheduleAll(date, rowIndex - 1).song.replayRequestCount > 0" class="replay-badge-print"> 重播 </span>
                  <!-- 跨学期标识 -->
                  <span v-if="settings.currentSemester && getScheduleAll(date, rowIndex - 1).song.semester && getScheduleAll(date, rowIndex - 1).song.semester !== settings.currentSemester" class="cross-semester-badge-print"> 跨学期 </span>
                </div>
                <div v-if="settings.showArtist" class="song-artist">
                  {{ getScheduleAll(date, rowIndex - 1).song.artist }}
                </div>
                <div v-if="settings.showRequester || settings.showVotes" class="song-meta">
                  <span v-if="settings.showRequester" class="song-requester">
                    {{ getScheduleAll(date, rowIndex - 1).song.requester }}
                  </span>
                  <span v-if="settings.showRequester && settings.showVotes" class="meta-divider">|</span>
                  <span v-if="settings.showVotes" class="song-votes">
                    {{ getScheduleAll(date, rowIndex - 1).song.replayRequestCount > 0 ? '重播:' + getScheduleAll(date, rowIndex - 1).song.replayRequestCount : '热度:' + (getScheduleAll(date, rowIndex - 1).song.voteCount || 0) }}
                  </span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </template>
  </table>
</template>

<script setup>
import { computed } from 'vue'
import { convertToHttps } from '~/utils/url'

const props = defineProps({
  groupedSchedules: {
    type: Object,
    required: true
  },
  settings: {
    type: Object,
    required: true
  }
})

const dates = computed(() => Object.keys(props.groupedSchedules).sort())

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = dateStr.includes('-') && !dateStr.includes('T')
    ? new Date(dateStr.replace(/-/g, '/'))
    : new Date(dateStr)
  
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const weekday = weekdays[date.getDay()]
  return `${month}月${day}日 ${weekday}`
}

// playTimes logic
const playTimesMap = computed(() => {
  const map = {}
  Object.values(props.groupedSchedules).forEach(dateGroup => {
    Object.entries(dateGroup.playTimes).forEach(([key, value]) => {
      if (!map[key]) {
        map[key] = { key, playTime: value.playTime }
      }
    })
  })
  return map
})

const getPlayTimeSortWeight = (playTime) => {
  if (!playTime || !playTime.startTime) return 9999
  const [hours, minutes] = playTime.startTime.split(':').map(Number)
  return hours * 60 + minutes
}

const sortedPlayTimes = computed(() => {
  return Object.values(playTimesMap.value).sort((a, b) => {
    return getPlayTimeSortWeight(a.playTime) - getPlayTimeSortWeight(b.playTime)
  })
})

const hasPlayTimes = computed(() => {
  if (!props.settings.showPlayTime) return false
  const keys = Object.keys(playTimesMap.value)
  if (keys.length > 1) return true
  if (keys.length === 1 && keys[0] !== '未指定时段') return true
  return false
})

const getMaxRowsForPlayTime = (playTimeKey) => {
  let max = 0
  dates.value.forEach(date => {
    const pt = props.groupedSchedules[date].playTimes[playTimeKey]
    if (pt && pt.schedules.length > max) {
      max = pt.schedules.length
    }
  })
  return max
}

const getSchedule = (date, playTimeKey, index) => {
  const pt = props.groupedSchedules[date]?.playTimes[playTimeKey]
  if (pt && pt.schedules[index]) return pt.schedules[index]
  return null
}

const maxRowsAll = computed(() => {
  let max = 0
  dates.value.forEach(date => {
    const len = props.groupedSchedules[date].allSchedules.length
    if (len > max) max = len
  })
  return max
})

const getScheduleAll = (date, index) => {
  const group = props.groupedSchedules[date]
  if (group && group.allSchedules[index]) return group.allSchedules[index]
  return null
}

const handleImageError = (event) => {
  event.target.style.display = 'none'
}
</script>

<style scoped>
.schedule-timetable {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  page-break-inside: auto;
  table-layout: fixed;
}

.schedule-timetable tr {
  page-break-inside: avoid;
  page-break-after: auto;
}

.schedule-timetable th,
.schedule-timetable td {
  border: 1px solid #e5e5e5;
  padding: 8px;
  vertical-align: top;
  overflow: hidden;
}

.schedule-timetable th {
  background: #f8f9fa;
  font-weight: bold;
  text-align: center;
  color: #333;
}

.col-sequence {
  width: 30px;
  text-align: center !important;
  vertical-align: middle !important;
}

.col-date {
  min-width: 120px;
  font-size: 15px;
  padding: 12px 8px !important;
  text-align: center !important;
  vertical-align: middle !important;
}

.playtime-header-row {
  background: #e3f2fd;
}

.playtime-header {
  font-weight: bold;
  color: #1565c0;
  text-align: center !important;
  padding: 6px !important;
}

.song-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.song-cover {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.song-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.song-title {
  font-weight: bold;
  color: #333;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
}

.title-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  margin-left: 4px;
}

/* 跨学期标识 */
.cross-semester-badge-print {
  display: inline-block;
  padding: 1px 4px;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  color: #666;
  font-size: 10px;
  border-radius: 2px;
  font-weight: normal;
  margin-left: 4px;
  flex-shrink: 0;
}

.song-artist {
  color: #666;
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #888;
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-requester,
.song-votes {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-divider {
  color: #ccc;
  font-size: 8px;
}

@media print {
  .schedule-timetable {
    color: #000 !important;
  }
  .schedule-timetable th,
  .schedule-timetable td {
    border-color: #ddd !important;
  }
  .schedule-timetable th {
    background: #f0f0f0 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .playtime-header-row {
    background: #e3f2fd !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
