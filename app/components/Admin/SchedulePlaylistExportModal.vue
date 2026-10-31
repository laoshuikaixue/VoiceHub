<template>
  <AppModal
    :description="locale.scope(scopeText)"
    :show="show"
    :title="locale.title"
    size="lg"
    @close="emit('close')"
  >
    <template #icon>
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-10 text-primary">
        <FileSpreadsheet :size="18" />
      </span>
    </template>


            <div v-for="group in fieldGroups" :key="group.key" class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-text-tertiary uppercase tracking-wider">
                  {{ group.title }}
                </label>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  v-for="fieldKey in group.fields"
                  :key="fieldKey"
                  type="button"
                  :class="[
                    'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all text-left',
                    selectedFields.includes(fieldKey)
                      ? 'bg-primary-10 border-primary-30 text-primary'
                      : 'bg-bg-primary border-border-secondary text-text-tertiary hover:border-border-tertiary hover:text-text-secondary'
                  ]"
                  @click="toggleField(fieldKey)"
                >
                  <span class="flex-1 truncate">{{ locale.fields[fieldKey] }}</span>
                  <Check v-if="selectedFields.includes(fieldKey)" class="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>

            <div v-if="selectedFields.includes('submissionNote')" class="space-y-2">
              <label class="text-xs font-bold text-text-tertiary uppercase tracking-wider">
                {{ locale.noteOptionsTitle }}
              </label>
              <button
                type="button"
                :class="[
                  'flex items-center gap-2 w-full px-3 py-2 rounded-xl border text-xs font-bold transition-all text-left',
                  includeUnapprovedNotes
                    ? 'bg-primary-10 border-primary-30 text-primary'
                    : 'bg-bg-primary border-border-secondary text-text-tertiary hover:border-border-tertiary hover:text-text-secondary'
                ]"
                @click="includeUnapprovedNotes = !includeUnapprovedNotes"
              >
                <span class="flex-1">{{ locale.includeUnapprovedNotes }}</span>
                <Check v-if="includeUnapprovedNotes" class="w-3.5 h-3.5 shrink-0" />
              </button>
              <p class="text-xs leading-relaxed text-text-disabled">
                {{ locale.includeUnapprovedNotesHint }}
              </p>
            </div>

    <template #footer>
      <div class="flex items-center gap-3">

            <div class="flex items-center gap-1.5 text-xs font-bold text-text-tertiary uppercase tracking-wider">
              <span>{{ locale.columnCount(selectedFields.length) }}</span>
              <button
                v-if="!isDefaultSelection"
                class="px-2 py-1 rounded-lg bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-secondary transition-colors"
                @click="resetFields"
              >
                {{ locale.resetDefault }}
              </button>
            </div>
            <div class="flex-1" />
            <button
              class="px-4 py-2.5 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-colors uppercase tracking-wider"
              @click="emit('close')"
            >
              {{ locale.cancel }}
            </button>
            <button
              :disabled="selectedFields.length === 0 || songs.length === 0"
              class="flex items-center gap-2 px-5 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-bold rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all uppercase tracking-wider active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              @click="exportCsv"
            >
              <FileSpreadsheet class="w-3.5 h-3.5" />
              {{ locale.exportButton }}
            </button>
      </div>
    </template>
  </AppModal>
</template>

<script setup>
import { computed, ref } from 'vue'
import { X, Check, FileSpreadsheet } from '@lucide/vue'
import AppModal from '~/components/UI/Common/AppModal.vue'
import { useLocale } from '~/utils/locale'
import { useSafeLocale } from '~/composables/useSafeLocale'
import { formatDuration } from '~/utils/timeUtils'
import { getPlatformDisplayName } from '~/utils/platforms'

const props = defineProps({
  show: { type: Boolean, default: false },
  songs: { type: Array, default: () => [] },
  playTimes: { type: Array, default: () => [] },
  scheduleDate: { type: String, default: '' },
  playTimeLabel: { type: String, default: '' }
})

const emit = defineEmits(['close'])

const { admin, siteConfig, currentLocale } = useLocale()
const scheduleLocale = computed(() => admin.value?.scheduleManager || {})
const locale = computed(() => useSafeLocale(scheduleLocale.value?.playlistExportModal || {}))

const FIELD_GROUPS = [
  { key: 'schedule', fields: ['sequence', 'playDate', 'playTime', 'status'] },
  { key: 'song', fields: ['title', 'artist', 'duration', 'platform'] },
  { key: 'request', fields: ['requester', 'requesterClass', 'collaborators', 'voteCount', 'preferredPlayTime', 'submissionNote', 'replayNote'] }
]

const DEFAULT_FIELDS = [
  'sequence',
  'playDate',
  'playTime',
  'title',
  'artist',
  'duration',
  'requester',
  'submissionNote'
]

const selectedFields = ref([...DEFAULT_FIELDS])
const includeUnapprovedNotes = ref(true)

const fieldGroups = computed(() =>
  FIELD_GROUPS.map((group) => ({
    key: group.key,
    title: locale.value[`group${group.key.charAt(0).toUpperCase()}${group.key.slice(1)}`],
    fields: group.fields
  }))
)

const toggleField = (fieldKey) => {
  const index = selectedFields.value.indexOf(fieldKey)
  if (index >= 0) {
    selectedFields.value.splice(index, 1)
  } else {
    selectedFields.value.push(fieldKey)
  }
}

const resetFields = () => {
  selectedFields.value = [...DEFAULT_FIELDS]
}

const isDefaultSelection = computed(
  () =>
    selectedFields.value.length === DEFAULT_FIELDS.length &&
    DEFAULT_FIELDS.every((fieldKey) => selectedFields.value.includes(fieldKey))
)

const scopeText = computed(() => {
  const parts = []
  if (props.scheduleDate) parts.push(props.scheduleDate)
  parts.push(props.playTimeLabel || locale.value.allPlayTimes)
  parts.push(locale.value.songCount(props.songs.length))
  return parts.join(' · ')
})

const playTimeNameById = (playTimeId) => {
  if (!playTimeId) return ''
  const playTime = (props.playTimes || []).find((pt) => pt.id === playTimeId)
  if (!playTime) return ''
  if (playTime.startTime && playTime.endTime) {
    return `${playTime.name} (${playTime.startTime}-${playTime.endTime})`
  }
  return playTime.name
}

const playTimeLabelOf = (playTime) => {
  if (playTime) {
    if (playTime.startTime && playTime.endTime) {
      return `${playTime.name} (${playTime.startTime}-${playTime.endTime})`
    }
    return playTime.name || ''
  }
  // 未落库的本地行没有 playTime，发布时会归入当前筛选时段
  if (props.playTimeLabel) return props.playTimeLabel
  return scheduleLocale.value.allDay || ''
}

const statusLabelOf = (schedule) => {
  const status = locale.value.statusValues || {}
  if (schedule.isNew || schedule.isLocalOnly) return status.unsaved
  if (schedule.played) return status.played
  if (schedule.isDraft) return status.draft || scheduleLocale.value.draft || ''
  return status.published || ''
}

const fieldValue = (fieldKey, schedule) => {
  const song = schedule.song || {}
  switch (fieldKey) {
    case 'sequence':
      return schedule.sequence ?? ''
    case 'playDate':
      return schedule.playDate || ''
    case 'playTime':
      return playTimeLabelOf(schedule.playTime)
    case 'status':
      return statusLabelOf(schedule)
    case 'title':
      return song.title || ''
    case 'artist':
      return song.artist || ''
    case 'duration':
      return formatDuration(song.durationSeconds)
    case 'platform':
      return song.musicPlatform
        ? getPlatformDisplayName(song.musicPlatform, siteConfig.value, currentLocale.value)
        : ''
    case 'requester':
      return song.requester || ''
    case 'requesterClass':
      return [song.requesterGrade, song.requesterClass].filter(Boolean).join(' ')
    case 'collaborators':
      return (song.collaborators || [])
        .map((c) => c.displayName || c.name)
        .filter(Boolean)
        .join('、')
    case 'voteCount':
      return song.voteCount ?? 0
    case 'preferredPlayTime':
      return playTimeNameById(song.preferredPlayTimeId)
    case 'submissionNote': {
      const note = song.originalSubmissionNote || ''
      if (!note) return ''
      if (includeUnapprovedNotes.value) return note
      return song.originalSubmissionNotePublic === true ? note : ''
    }
    // submissionNote 在重播行上是被申请人留言覆盖后的值，非重播行与投稿留言重复
    case 'replayNote':
      return schedule.replayRequestId != null ? song.submissionNote || '' : ''
    default:
      return ''
  }
}

// 与 server/api/admin/card-codes/export.get.ts 的转义口径一致
const escapeCell = (value) => {
  if (value === null || typeof value === 'undefined') return ''
  let text = String(value)
  if (/^[=+\-@]/.test(text)) {
    text = `\t${text}`
  }
  return text.includes(',') || text.includes('\n') || text.includes('"')
    ? '"' + text.replace(/"/g, '""') + '"'
    : text
}

const buildFileName = () => {
  const suffix = [props.scheduleDate, props.playTimeLabel]
    .filter(Boolean)
    .join('-')
    .replaceAll(/[\\/:*?"<>|\s]+/g, '_')
  return `${locale.value.fileNamePrefix}${suffix ? `-${suffix}` : ''}.csv`
}

const exportCsv = () => {
  if (selectedFields.value.length === 0 || props.songs.length === 0) return

  const ordered = FIELD_GROUPS.flatMap((group) => group.fields)
  // 列顺序固定按字段定义顺序，与勾选先后无关
  const fields = selectedFields.value.slice().sort((a, b) => ordered.indexOf(a) - ordered.indexOf(b))

  const lines = [
    fields.map((fieldKey) => escapeCell(locale.value.fields[fieldKey])).join(','),
    ...props.songs.map((schedule) => fields.map((fieldKey) => escapeCell(fieldValue(fieldKey, schedule))).join(','))
  ]

  try {
    // BOM 保证 Excel 以 UTF-8 打开中文不乱码
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = buildFileName()
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    window.$showNotification?.(locale.value.exportSuccess(props.songs.length), 'success')
    emit('close')
  } catch (err) {
    console.error('导出歌单失败', err)
    window.$showNotification?.(locale.value.exportFailed, 'error')
  }
}
</script>
