<template>
  <div class="broadcast space-y-4">
    <audio ref="audio" preload="none" @playing="setBuffering(false); media.sync()" @waiting="setBuffering(true)" @pause="setBuffering(false); media.sync()" @timeupdate="media.sync"
      @durationchange="media.sync" @ended="advance('completed')" @error="mediaError" />

    <section class="broadcast-panel clock-row">
      <div>
        <p class="text-sm text-text-tertiary">{{ t('serverTime') }} · UTC+08:00</p>
        <p class="server-clock tabular-nums">{{ clock ? formatDateTime(new Date(clock), 'HH:mm:ss') : '—' }}</p>
        <p class="text-xs text-text-tertiary">{{ today }}</p>
      </div>
      <div class="duty-control">
        <strong role="status" :class="armed ? 'text-success' : 'text-warning'">{{ t(armed ? 'armed' : 'disarmed') }}</strong>
        <button v-if="canControl" class="broadcast-button primary" type="button" :disabled="busy || !clock"
          @click="command({ action: armed ? 'disarm' : 'arm' })">{{ t(armed ? 'disarm' : 'arm') }}</button>
        <p class="duty-hint text-xs text-text-tertiary">{{ t(armed ? 'ready' : 'keepOpen') }}</p>
      </div>
    </section>

    <section v-if="canRemoteDisarm || canEmergencyStop" class="broadcast-panel safety-controls">
      <div v-if="canRemoteDisarm" class="flex flex-wrap items-center gap-3">
        <span class="text-xs text-text-secondary">{{ remoteUnattended ? t('remoteOnline', remoteUnattended.account) : t('remoteOffline') }}</span>
        <button type="button" class="broadcast-button" :disabled="!remoteUnattended || remoteDisarming"
          @click="disarmTarget = remoteUnattended">{{ t('remoteDisarm') }}</button>
      </div>
      <button v-if="canEmergencyStop" type="button" class="emergency-stop" :disabled="emergencyPending"
        @pointerdown="startEmergencyHold" @pointerup="cancelEmergencyHold" @pointerleave="cancelEmergencyHold"
        @pointercancel="cancelEmergencyHold" @blur="cancelEmergencyHold" @contextmenu.prevent
        @keydown.space.enter.prevent="startEmergencyHold" @keyup.space.enter.prevent="cancelEmergencyHold"
        @click.prevent>
        <span class="emergency-progress" :style="{ width: emergencyProgress + '%' }" aria-hidden="true" />
        <span class="relative">{{ t(emergencyPending ? 'emergencySending' : 'emergencyStop') }}</span>
        <small class="relative">{{ t('emergencyHold') }}</small>
      </button>
    </section>

    <section class="broadcast-panel">
      <div class="section-heading"><h2>{{ t('date') }}</h2><span class="tabular-nums">{{ date }}</span></div>
      <div class="date-controls">
        <button type="button" class="broadcast-button icon-button" :aria-label="t('earlier')" @click="scrollDates(-1)"><ChevronLeft :size="17" /></button>
        <div ref="dateStrip" class="date-strip" role="group" :aria-label="t('date')">
          <button v-for="entry in dates" :key="entry" :data-date="entry" type="button" class="date-card"
            :aria-label="entry" :aria-current="entry === today ? 'date' : undefined" :aria-pressed="date === entry"
            @click="selectDate(entry)">
            <span>{{ admin?.schedule?.weekdays?.[getBeijingWeekday(entry)] || getWeekdayLabel(getBeijingWeekday(entry)) }}</span>
            <strong>{{ entry.slice(8) }}</strong><span>{{ entry.slice(5, 7) }}</span>
          </button>
        </div>
        <button type="button" class="broadcast-button icon-button" :aria-label="t('later')" @click="scrollDates(1)"><ChevronRight :size="17" /></button>
        <button type="button" class="broadcast-button icon-button" :aria-label="t('today')" :title="t('today')" @click="selectDate(today, true)"><CircleDot :size="17" /></button>
        <AppDatePicker class="calendar-picker" :label="t('date')" :model-value="date" :clearable="false" @update:model-value="selectDate($event, true)" />
      </div>
    </section>

    <section class="broadcast-panel">
      <div class="section-heading"><h2>{{ t('slots') }}</h2><AppSpinner v-if="pending" :size="16" /></div>
      <div v-if="loadError" class="flex flex-wrap items-center gap-3" role="alert">
        <span>{{ loadError }}</span><button type="button" class="broadcast-button" @click="loadPage()">{{ t('retry') }}</button>
      </div>
      <p v-else-if="!pending && !slots.length" class="text-sm text-text-tertiary">{{ t('noSlots') }}</p>
      <div v-else class="slot-grid">
        <button v-for="slot in slots" :key="slot.id" type="button" class="slot-card" :aria-pressed="slotId === slot.id"
          @click="selectSlot(slot.id)">
          <span class="flex flex-wrap items-center justify-between gap-2">
            <strong>{{ slot.name }}</strong>
            <span class="mode" :class="slot.autoStart ? 'automatic' : 'manual'">{{ t(slot.autoStart ? 'autoMode' : 'manualMode') }}</span>
          </span>
          <span class="text-xs text-text-tertiary tabular-nums">{{ timeLabel(slot.start) }}–{{ timeLabel(slot.end) }}</span>
        </button>
      </div>
    </section>

    <section class="broadcast-panel" :aria-label="t('start')">
      <div class="transport">
        <div class="min-w-0">
          <h2>{{ current?.song.title || t('waiting') }}</h2>
          <p class="text-xs text-text-tertiary">{{ active ? `${active.slotName} · ${active.cursor + 1}/${active.entries.length} · ${status}` : selected?.name }}</p>
        </div>
        <div>
          <progress :value="elapsed" :max="mediaDuration || 1" :aria-label="t('remaining')" />
          <div class="flex justify-between text-xs text-text-tertiary tabular-nums"><span>{{ formatDuration(elapsed) }}</span><span>{{ durationLabel(mediaDuration) }}</span></div>
        </div>
        <div class="transport-buttons">
          <button type="button" class="broadcast-button primary play-button" :aria-disabled="!!playBlockedReason" @click="togglePlayback">
            <Pause v-if="playing" :size="15" /><Play v-else :size="15" />{{ t(playing ? 'pause' : active ? 'resume' : 'start') }}
          </button>
          <button v-if="canControl" type="button" class="broadcast-button" :disabled="busy || !active || closing || active.cursor >= active.entries.length - 1" @click="advance('skipped')"><SkipForward :size="15" />{{ t('next') }}</button>
          <button v-if="canControl" type="button" class="broadcast-button text-error" :disabled="!active" @click="stop"><Square :size="14" />{{ t('stop') }}</button>
          <div v-if="canControl && qualityOptions.length > 1" class="quality-select">
            <CustomSelect :label="t('requestedQuality')" :options="qualityOptions" :model-value="qualityValue"
              :disabled="busy || mediaLoading || !qualitySong" @update:model-value="changeQuality" />
            <p v-if="actualQuality" class="text-xs text-text-tertiary">{{ t('actualQuality', actualQuality) }}</p>
          </div>
        </div>
      </div>
      <dl class="stats tabular-nums">
        <div><dt>{{ t('total') }}</dt><dd>{{ durationLabel(total) }}</dd></div>
        <div><dt>{{ t('remaining') }}</dt><dd>{{ durationLabel(remaining) }}</dd></div>
        <div><dt>{{ t('estimatedEnd') }}</dt><dd>{{ estimate ? formatDateTime(new Date(estimate), 'HH:mm:ss') : '—' }}</dd></div>
      </dl>
    </section>

    <div v-if="selected" class="columns">
      <section class="broadcast-panel min-w-0">
        <div class="section-heading"><h2>{{ t('playlist') }}</h2><span class="text-text-tertiary">{{ entries.length }}</span></div>
        <p v-if="!entries.length && !pending" class="text-sm text-text-tertiary">{{ t('noTracks') }}</p>
        <ol v-else class="playlist">
          <li v-for="(entry, index) in entries" :key="entry.id" :aria-current="current?.id === entry.id ? 'true' : undefined">
            <span class="text-xs text-text-tertiary tabular-nums">{{ index + 1 }}</span>
            <div class="min-w-0"><strong>{{ entry.song.title }}</strong>
              <p class="text-xs text-text-tertiary">{{ [entry.song.artist, platformLabel(entry.song.musicPlatform)].filter(Boolean).join(' · ') }}</p>
            </div>
            <span class="text-xs text-text-tertiary tabular-nums">{{ durationLabel(entry.song.durationSeconds) }}</span>
            <span class="text-xs text-right">{{ entryStatus(entry) }}</span>
          </li>
        </ol>
      </section>
      <form class="broadcast-panel preferences" @submit.prevent="save">
        <div class="section-heading"><h2>{{ t('settings') }}</h2></div>
        <div class="setting-row">
          <div><label for="broadcast-auto">{{ t('autoStart') }}</label><p id="broadcast-auto-hint">{{ t('autoHint') }}</p></div>
          <input id="broadcast-auto" v-model="draft.autoStart" class="toggle" type="checkbox" role="switch" aria-describedby="broadcast-auto-hint" :disabled="!canConfigure || saving" />
        </div>
        <div class="setting-stack">
          <CustomSelect :label="t('endPolicy')" :options="endOptions" :model-value="draft.stopAtEnd ? 'stop' : 'finish'" :disabled="!canConfigure || saving"
            @update:model-value="draft.stopAtEnd = $event === 'stop'" />
          <p>{{ t(draft.stopAtEnd ? 'stopHint' : 'finishHint') }}</p>
        </div>
        <div class="setting-row">
          <div><label for="broadcast-mark">{{ t('markPlayed') }}</label><p id="broadcast-mark-hint">{{ t(canMark ? 'markHint' : 'markDenied') }}</p></div>
          <input id="broadcast-mark" v-model="draft.markPlayed" class="toggle" type="checkbox" role="switch" aria-describedby="broadcast-mark-hint" :disabled="!canConfigure || !canMark || saving" />
        </div>
        <div v-if="canConfigure" class="flex justify-end mt-3"><button type="submit" class="broadcast-button primary" :disabled="saving || !dirty || !!loadError">{{ t('save') }}</button></div>
      </form>
    </div>
    <ConfirmDialog v-model:show="showPlayReason" :title="t('playUnavailable')" :message="playReason"
      type="info" :show-cancel="false" @confirm="showPlayReason = false" />
    <ConfirmDialog :show="!!disarmTarget" :title="t('remoteDisarm')" :loading="remoteDisarming"
      :message="disarmTarget ? t('remoteDisarmConfirm', disarmTarget.account) : ''" type="warning"
      @close="disarmTarget = null" @confirm="remoteDisarm" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ChevronLeft, ChevronRight, CircleDot, Pause, Play, SkipForward, Square } from '@lucide/vue'
import AppDatePicker from '~/components/UI/Common/AppDatePicker.vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useBroadcastMedia } from '~/composables/useBroadcastMedia'
import { usePermissions } from '~/composables/usePermissions'
import { applyServerTimeSample, getSyncedTimestamp } from '~/composables/useSyncedTime'
import { useLocaleText, useServerErrors } from '~/composables/useLocaleText'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import { getPlatformDisplayName } from '~/utils/platforms'
import { estimateBroadcastDuration } from '~/utils/schedule-duration'
import { addDaysToString, formatDateTime, formatDuration, getBeijingDateString, getBeijingWeekday, getWeekdayLabel } from '~/utils/timeUtils'

const { admin, currentLocale } = useLocale()
const { msg: t } = useLocaleText(computed(() => admin.value.broadcastPlayback))
const { localize } = useServerErrors()
const { showToast } = useToast()
const { can } = usePermissions()
const canControl = computed(() => can('playback:control'))
const canConfigure = computed(() => can('playback:configure'))
const canMark = computed(() => can('playback:mark-played'))
const canRemoteDisarm = computed(() => can('playback:remote-disarm'))
const canEmergencyStop = computed(() => can('playback:emergency-stop'))
const media = useBroadcastMedia()
const { element: audio, currentTime: elapsed, duration: mediaDuration, playing, loading: mediaLoading, actualQuality } = media
const publicPlayer = useAudioPlayer()

const clock = ref(null)
const today = computed(() => clock.value ? getBeijingDateString(new Date(clock.value)) : '')
const date = ref('')
const calendarAnchor = ref('')
const dateStrip = ref(null)
const dates = computed(() => calendarAnchor.value ? Array.from({ length: 61 }, (_, i) => addDaysToString(calendarAnchor.value, i - 30)) : [])
const slotId = ref(null)
const response = shallowRef(null)
const remoteUnattended = computed(() => response.value?.remoteUnattended || null)
const disarmTarget = ref(null)
const remoteDisarming = ref(false)
const emergencyPending = ref(false)
const emergencyProgress = ref(0)
const slots = computed(() => response.value?.slots || [])
const selected = computed(() => slots.value.find(slot => slot.id === slotId.value))
const entries = computed(() => response.value?.slotId === slotId.value ? response.value.entries : [])
const loadError = ref('')
const pending = ref(false)
const busy = ref(false)
const saving = ref(false)
const buffering = ref(false)
const BUFFERING_TIMEOUT_MS = 15_000
let bufferingSince = null
const armed = ref(false)
const active = shallowRef(null)
const finished = ref(new Set())
const current = computed(() => active.value?.entries[active.value.cursor])
const closing = computed(() => active.value != null && clock.value >= active.value.end)
const draft = ref({})
const outcomes = ref(new Map())
const qualitySong = computed(() => current.value?.song || entries.value[0]?.song)
const qualityPlatform = computed(() => qualitySong.value?.musicId ? qualitySong.value.musicPlatform || '' : '')
const qualityOptions = computed(() => media.getQualityOptions(qualityPlatform.value))
const qualityValue = computed(() => media.getQuality(qualityPlatform.value))
const status = computed(() => t(mediaLoading.value || buffering.value ? 'loadingTrack' : closing.value ? 'closing' : playing.value ? 'playing' : 'paused'))
const endOptions = computed(() => [{ value: 'finish', label: t('finishAtEnd') }, { value: 'stop', label: t('stopAtEnd') }])
const showPlayReason = ref(false)
const playReason = ref('')
const playBlockedReason = computed(() => {
  if (!canControl.value) return t('playNeedsPermission')
  if (busy.value || mediaLoading.value) return t('playBusy')
  if (active.value) return closing.value ? t('playEnded') : ''
  if (!clock.value) return t('playClockUnavailable')
  if (pending.value || !date.value) return t('playLoadingSchedule')
  if (loadError.value) return loadError.value
  if (date.value > today.value) return t('playFutureDate')
  if (date.value < today.value) return t('playPastDate')
  if (!selected.value) return t('noSlots')
  if (clock.value >= selected.value.end) return t('playEnded')
  if (!entries.value.length) return t('noTracks')
  return ''
})

function explainPlayback(message) {
  playReason.value = message
  showPlayReason.value = true
}

let device, tickTimer, pollTimer, pageTimer, requestId = 0, leaseDeadline = 0, disposed = false
let chain = Promise.resolve()
let heartbeatPending = false
let ending = false
let stoppingRun = null
let emergencyStoppedRun = null
let emergencyFrame = 0
const EMERGENCY_HOLD_MS = 1500
let cutoffRun = null
let controlEpoch = 0

function platformLabel(platform) { return platform ? getPlatformDisplayName(platform, null, currentLocale.value) : '' }
function timeLabel(timestamp) { return formatDateTime(new Date(timestamp), 'HH:mm') }
function durationLabel(seconds) { return seconds == null ? '—' : formatDuration(seconds) }
function entryStatus(entry) {
  if (current.value?.id === entry.id) return status.value
  const outcome = outcomes.value.get(entry.id)
  if (outcome) return t(outcome)
  return entry.song.played ? t('marked') : ''
}

const total = computed(() => {
  const summary = active.value?.duration || response.value?.duration
  return summary && !summary.unknown ? summary.seconds : null
})
const viewedRun = computed(() => `${date.value}/${slotId.value}`)
const planned = computed(() => !active.value && !finished.value.has(viewedRun.value) && armed.value && selected.value?.autoStart && date.value === today.value && clock.value < selected.value.start)
const estimateFrom = computed(() => active.value ? clock.value : planned.value ? selected.value.start : null)
const remaining = computed(() => {
  if (!active.value) {
    if (finished.value.has(viewedRun.value) || date.value === today.value && clock.value >= selected.value?.end) return entries.value.length ? 0 : null
    if (!planned.value) return total.value
  }
  const source = active.value || selected.value
  const trackDurations = active.value
    ? active.value.entries.slice(active.value.cursor).map((entry, index) => index === 0 ? mediaDuration.value ?? entry.song.durationSeconds : entry.song.durationSeconds)
    : entries.value.map(entry => entry.song.durationSeconds)
  return estimateBroadcastDuration(trackDurations, active.value ? elapsed.value : 0, (source.end - estimateFrom.value) / 1000,
    closing.value, source.stopAtEnd)
})
const estimate = computed(() => (active.value && playing.value && !buffering.value || planned.value) && remaining.value != null && !!estimateFrom.value
  ? estimateFrom.value + remaining.value * 1000 : null)

function policyPatch() {
  if (!selected.value) return {}
  return Object.fromEntries(['autoStart', 'stopAtEnd', ...(canMark.value ? ['markPlayed'] : [])]
    .filter(key => selected.value[key] !== draft.value[key]).map(key => [key, draft.value[key]]))
}
const dirty = computed(() => Object.keys(policyPatch()).length > 0)
function setDraft(slot, patch = {}) {
  draft.value = { autoStart: slot?.autoStart, stopAtEnd: slot?.stopAtEnd, markPlayed: slot?.markPlayed, ...patch }
}

function applyClock(timestamp, began) {
  applyServerTimeSample(timestamp, began)
  clock.value = getSyncedTimestamp()
}

async function loadPage(background = false) {
  if (!date.value || (background && (pending.value || saving.value))) return
  const serial = ++requestId
  const began = Date.now()
  if (!background) pending.value = true
  try {
    const data = await $fetch('/api/admin/playback', { query: { date: date.value, slotId: slotId.value ?? undefined }, timeout: 5000 })
    if (serial !== requestId || disposed) return
    const patch = !saving.value && data.slotId === selected.value?.id ? policyPatch() : {}
    applyClock(data.timestamp, began)
    response.value = data
    slotId.value = data.slotId
    setDraft(selected.value, patch)
    loadError.value = ''
  } catch (err) {
    if (serial !== requestId || disposed) return
    response.value = null
    loadError.value = localize(err)
  } finally {
    if (serial === requestId) pending.value = false
  }
}

async function selectDate(value, center = false) {
  if (!value) return
  if (!dates.value.includes(value)) calendarAnchor.value = value
  if (date.value !== value) {
    date.value = value
    response.value = null
    loadPage()
  }
  if (center) {
    await nextTick()
    const strip = dateStrip.value
    const card = strip?.querySelector(`[data-date="${value}"]`)
    if (card) strip.scrollLeft += card.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - card.offsetWidth) / 2
  }
}

function scrollDates(direction) {
  const strip = dateStrip.value
  strip?.scrollBy({ left: direction * strip.clientWidth, behavior: 'smooth' })
}

function selectSlot(id) {
  if (id === slotId.value) return
  slotId.value = id
  setDraft(selected.value)
  loadPage()
}

function clearActive() {
  if (active.value) finished.value.add(`${active.value.date}/${active.value.slotId}`)
  media.reset()
  setBuffering(false)
  active.value = null
}

function loseControl() {
  if (active.value || armed.value) showToast(t('connectionLost'), 'warning')
  controlEpoch++
  clearActive()
  armed.value = false
  leaseDeadline = 0
}

async function loadTrack(entry) {
  const run = active.value?.id
  setBuffering(false)
  media.reset()
  const result = await media.load(entry.song)
  if (active.value?.id !== run || current.value?.id !== entry.id) return
  if (result === 'blocked') {
    setBuffering(false)
    showToast(t('autoplayBlocked'), 'warning')
  }
  if (result === 'failed') await advance('failed')
}

function applyControl(data, action, began) {
  applyClock(data.timestamp, began)
  leaseDeadline = data.expiresAt ? performance.now() + Math.max(0, data.expiresAt - data.timestamp - (Date.now() - began)) : 0
  armed.value = data.armed
  if (action === 'arm' && data.armed) showToast(t('leavePageWarning'), 'warning')
  if (!data.active) {
    if (active.value && action === 'heartbeat') showToast(t('leaseEnded'), 'info')
    if (active.value) clearActive()
    return
  }
  if (data.active.id === stoppingRun || data.active.id === emergencyStoppedRun) return
  const previous = active.value
  const changed = previous?.id !== data.active.id || previous.cursor !== data.active.cursor
  active.value = data.active
  if (previous?.id !== data.active.id) {
    outcomes.value.clear()
    publicPlayer.pauseSong()
    if (action === 'heartbeat') {
      slotId.value = data.active.slotId
      selectDate(data.active.date, true)
      loadPage()
    }
  }
  if (changed && action !== 'advance') void loadTrack(current.value)
}

function command(input, quiet = false) {
  if (!canControl.value || !device || disposed) return Promise.resolve(null)
  if (!quiet) busy.value = true
  const task = chain.then(async () => {
    if (disposed) return null
    const epoch = controlEpoch
    const began = Date.now()
    try {
      const body = input.action === 'heartbeat' ? { device, ...input, endIfIdle: !playing.value } : { device, ...input }
      const data = await $fetch('/api/admin/playback/control', { method: 'POST', body, timeout: 3000 })
      if (disposed || epoch !== controlEpoch) return null
      applyControl(data, input.action, began)
      return data
    } catch (err) {
      if (!disposed) {
        if (quiet || active.value || armed.value) loseControl()
        if (input.action === 'start') explainPlayback(localize(err))
        else if (!quiet) showToast(localize(err), 'error')
      }
      return null
    }
  })
  chain = task
  return task.finally(() => { if (!quiet) busy.value = false })
}

async function heartbeat() {
  if (heartbeatPending || (!armed.value && !active.value) || !canControl.value) return
  heartbeatPending = true
  try { await command({ action: 'heartbeat' }, true) } finally { heartbeatPending = false }
}

async function remoteDisarm() {
  const target = disarmTarget.value
  if (!target || !canRemoteDisarm.value || remoteDisarming.value) return
  remoteDisarming.value = true
  try {
    await $fetch('/api/admin/playback/remote', { method: 'POST', body: { action: 'disarm', target: target.target }, timeout: 5000 })
    showToast(t('remoteDisarmed'), 'success')
  } catch (error) {
    showToast(localize(error), 'error')
  } finally {
    remoteDisarming.value = false
    disarmTarget.value = null
    void loadPage(true)
  }
}

function cancelEmergencyHold() {
  cancelAnimationFrame(emergencyFrame)
  emergencyFrame = 0
  emergencyProgress.value = 0
}

function startEmergencyHold(event) {
  if (!canEmergencyStop.value || emergencyPending.value || emergencyFrame || event.repeat ||
      (event.type === 'pointerdown' && (!event.isPrimary || event.button !== 0))) return
  const startedAt = performance.now()
  const update = () => {
    const elapsedMs = performance.now() - startedAt
    emergencyProgress.value = Math.min(100, 100 * elapsedMs / EMERGENCY_HOLD_MS)
    if (elapsedMs < EMERGENCY_HOLD_MS) emergencyFrame = requestAnimationFrame(update)
    else {
      cancelEmergencyHold()
      void emergencyStop()
    }
  }
  emergencyFrame = requestAnimationFrame(update)
}

async function emergencyStop() {
  if (!canEmergencyStop.value || emergencyPending.value) return
  emergencyPending.value = true
  try {
    const { runId } = await $fetch('/api/admin/playback/remote', { method: 'POST', body: { action: 'emergency-stop' }, timeout: 5000 })
    if (runId) {
      emergencyStoppedRun = runId
      if (active.value?.id === runId) clearActive()
    }
    showToast(t(runId ? 'emergencyIssued' : 'emergencyNothingPlaying'), 'warning')
  } catch (error) {
    showToast(localize(error), 'error')
  } finally {
    emergencyPending.value = false
    void loadPage(true)
  }
}

function cancelEmergencyIfHidden() {
  if (document.hidden) cancelEmergencyHold()
}

async function save() {
  if (!canConfigure.value || saving.value || !dirty.value) return
  saving.value = true
  const target = slotId.value
  try {
    await $fetch(`/api/admin/playback/${target}`, { method: 'PUT', body: policyPatch(), timeout: 5000 })
    if (disposed) return
    if (active.value || armed.value) await command({ action: 'heartbeat' }, true)
    await loadPage()
    showToast(t('saved'), 'success')
  } catch (err) { showToast(localize(err), 'error') }
  finally { saving.value = false }
}

async function togglePlayback() {
  if (playBlockedReason.value) return explainPlayback(playBlockedReason.value)
  if (!active.value) {
    await command({ action: 'start', slotId: slotId.value })
  } else if (!closing.value && !audio.value.paused) audio.value.pause()
  else if (!closing.value) {
    const run = active.value.id
    const entryId = current.value?.id
    try { await audio.value.play() } catch (error) {
      if (active.value?.id !== run || current.value?.id !== entryId || error?.name === 'AbortError') return
      if (error?.name === 'NotAllowedError') showToast(t('autoplayBlocked'), 'warning')
      else await advance('failed')
    }
  }
}

function stop() {
  const run = active.value?.id
  if (!run || !canControl.value) return
  stoppingRun = run
  clearActive()
  void command({ action: 'stop', run }).finally(() => { if (stoppingRun === run) stoppingRun = null })
}

async function advance(result) {
  const run = active.value?.id
  const entry = current.value
  if (!run || !entry || ending || !canControl.value || (result === 'skipped' && closing.value)) return
  if (result === 'completed' && !audio.value?.ended) return
  ending = true
  setBuffering(false)
  media.reset()
  try {
    const response = await command({ action: 'advance', run, entryId: entry.id, result })
    if (!response) return
    outcomes.value.set(entry.id, result === 'completed' ? (response.marked ? 'marked' : 'completed') : 'skipped')
    if (result === 'skipped') showToast(t('skipToast', entry.song.title), 'info')
    if (result === 'failed') showToast(t(response.active ? 'sourceSkipped' : 'sourceEnded', entry.song.title), 'warning')
    void loadPage(true)
  } finally {
    ending = false
    // 下一首可能立即取链失败，须等上一首的切换请求结束后再开始加载。
    const next = current.value
    if (active.value?.id === run && next && next.id !== entry.id && !closing.value) void loadTrack(next)
  }
}

async function changeQuality(value) {
  if (!canControl.value || !qualitySong.value || mediaLoading.value || !qualityOptions.value.some(option => option.value === value)) return
  if (!current.value) { media.saveQuality(qualityPlatform.value, value); return }
  const { id: run } = active.value
  const entry = current.value
  const result = await media.load(entry.song, value)
  if (active.value?.id !== run || current.value?.id !== entry.id) return
  if (result === 'quality-failed') showToast(t('qualityFailed'), 'error')
  if (result === 'failed') await advance('failed')
}

function mediaError() {
  if (!current.value || mediaLoading.value || !audio.value?.getAttribute('src')) return
  void advance('failed')
}

function setBuffering(waiting) {
  buffering.value = waiting
  bufferingSince = waiting ? (bufferingSince ?? performance.now()) : null
}

function tick() {
  if (clock.value != null) clock.value = getSyncedTimestamp()
  if (leaseDeadline && performance.now() >= leaseDeadline) loseControl()
  if (active.value && active.value.id !== cutoffRun && closing.value && !ending && (active.value.stopAtEnd || !playing.value)) {
    cutoffRun = active.value.id
    media.reset()
    setBuffering(false)
    void heartbeat()
  } else if (active.value && audio.value?.getAttribute('src') && bufferingSince !== null && performance.now() - bufferingSince >= BUFFERING_TIMEOUT_MS) {
    void advance('failed')
  }
}

function release() {
  cancelEmergencyHold()
  controlEpoch++
  if (device && (armed.value || active.value)) {
    void $fetch('/api/admin/playback/control', { method: 'POST', body: { device, action: 'release' }, keepalive: true }).catch(() => {})
  }
  clearActive()
  armed.value = false
}

watch(canControl, allowed => { if (!allowed) release() })
watch(canEmergencyStop, allowed => { if (!allowed) cancelEmergencyHold() })

onMounted(async () => {
  // getRandomValues 也支持通过内网 HTTP 打开的播出设备。
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
  device = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  tickTimer = setInterval(tick, 200)
  pollTimer = setInterval(heartbeat, 1500)
  pageTimer = setInterval(() => loadPage(true), 8000)
  window.addEventListener('pagehide', release)
  window.addEventListener('blur', cancelEmergencyHold)
  document.addEventListener('visibilitychange', cancelEmergencyIfHidden)
  try {
    const began = Date.now()
    const { timestamp } = await $fetch('/api/sys/time', { timeout: 5000 })
    if (disposed) return
    applyClock(timestamp, began)
  } catch (err) { if (!disposed) loadError.value = localize(err) }
  if (!disposed) await selectDate(today.value || getBeijingDateString(), true)
})

onBeforeUnmount(() => {
  disposed = true
  clearInterval(tickTimer); clearInterval(pollTimer); clearInterval(pageTimer)
  window.removeEventListener('pagehide', release)
  window.removeEventListener('blur', cancelEmergencyHold)
  document.removeEventListener('visibilitychange', cancelEmergencyIfHidden)
  release()
})
</script>

<style scoped>
.broadcast-panel { border: 1px solid var(--border-secondary); background: var(--bg-secondary); border-radius: 15px; padding: 15px 16px; }
.broadcast h2 { font-size: 1rem; font-weight: 700; }
.clock-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem); align-items: center; gap: 16px; }
.safety-controls { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 12px 20px; }
.emergency-stop { position: relative; overflow: hidden; isolation: isolate; display: inline-flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; padding: 8px 14px; min-height: 38px; border-radius: 8px; background: #b91c1c; color: white; font-weight: 750; touch-action: none; user-select: none; }
.emergency-stop:disabled { opacity: .65; cursor: wait; }
.emergency-stop small { font-size: .7rem; font-weight: 550; }
.emergency-progress { position: absolute; inset: 0 auto 0 0; background: #7f1d1d; }
.server-clock { color: var(--text-primary); font-size: clamp(2rem, 5vw, 3rem); font-weight: 750; line-height: 1.15; }
.duty-control { display: grid; grid-template-columns: minmax(0, 1fr) 9rem; grid-template-rows: 24px 36px 24px; grid-template-areas: '. .' 'state button' 'hint .'; align-items: center; column-gap: 8px; }
.duty-control strong { grid-area: state; }
.duty-control button { grid-area: button; }
.duty-hint { grid-area: hint; align-self: start; }
.section-heading, .date-controls, .transport-buttons { display: flex; align-items: center; gap: 8px; }
.section-heading { justify-content: space-between; margin-bottom: 10px; }
.broadcast-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--border-secondary); background: var(--bg-tertiary); font-size: .8rem; font-weight: 650; }
.broadcast-button:hover:enabled { background: var(--bg-quaternary); }
.broadcast-button.primary, .date-card[aria-pressed='true'] { background: var(--primary-hover); color: white; }
.broadcast-button.primary:hover:enabled { background: var(--primary); }
.broadcast-button:disabled, .broadcast-button[aria-disabled='true'], .toggle:disabled { opacity: .5; cursor: default; }
.icon-button { width: 32px; padding: 0; flex: none; }
.date-strip { flex: 1; min-width: 0; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.date-card { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 0 0 58px; height: 60px; padding: 3px; border: 1px solid var(--border-secondary); border-radius: 8px; background: var(--bg-tertiary); font-size: .7rem; }
.date-card strong { font-size: 1.05rem; }
.calendar-picker { flex: 0 0 8.2rem; }
.slot-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(10rem, 100%), 1fr)); gap: 8px; }
.slot-card { background: var(--bg-tertiary); border: 1px solid var(--border-secondary); border-radius: 10px; padding: 10px; text-align: left; }
.slot-card[aria-pressed='true'], .playlist li[aria-current='true'] { background: var(--primary-light); border-color: var(--primary-border); }
.mode { font-size: .95rem; font-weight: 800; color: var(--mode); border: 1px solid color-mix(in srgb, var(--mode) 55%, var(--border-secondary)); border-radius: 6px; background: color-mix(in srgb, var(--mode) 13%, var(--bg-secondary)); padding: 1px 6px; white-space: nowrap; }
.automatic { --mode: #ad1832; }
.manual { --mode: #1d4ed8; }
:global([data-theme='ClassicDark']) .automatic { --mode: #fda4af; }
:global([data-theme='ClassicDark']) .manual { --mode: #85b2ff; }
.transport { display: grid; grid-template-columns: minmax(0, 1fr) minmax(100px, .7fr) auto; align-items: center; gap: 12px; }
.transport-buttons { flex-wrap: wrap; }
.play-button { width: 135px; white-space: nowrap; }
.quality-select { width: 9rem; }
progress { display: block; width: 100%; height: 7px; accent-color: var(--primary); }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding-top: 10px; margin-top: 12px; border-top: 1px solid var(--border-secondary); }
.stats div + div { border-left: 1px solid var(--border-secondary); padding-left: 10px; }
.stats dt, .preferences p { color: var(--text-tertiary); font-size: .75rem; }
.stats dd { font-weight: 700; }
.columns { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(235px, 1fr); align-items: start; gap: 14px; }
.playlist { list-style: none; margin: 0; padding: 0; }
.playlist li { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto minmax(38px, auto); align-items: center; gap: 8px; padding: 9px 4px; border-bottom: 1px solid var(--border-secondary); }
.playlist li:last-child { border-bottom: 0; }
.setting-row, .setting-stack { padding: 11px 0; border-bottom: 1px solid var(--border-secondary); }
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.setting-row label { font-weight: 650; }
.preferences p { margin-top: 4px; }
.toggle { appearance: none; flex: none; position: relative; width: 36px; height: 20px; border-radius: 999px; border: 1px solid var(--border-tertiary); background: var(--bg-quaternary); }
.toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--text-secondary); }
.toggle:checked { background: var(--primary-hover); }
.toggle:checked::after { left: 18px; background: white; }
@media (max-width: 1150px) { .transport { grid-template-columns: 1fr; } }
@media (max-width: 850px) { .columns { grid-template-columns: 1fr; } .clock-row { grid-template-columns: 1fr; } .duty-control { grid-template-rows: 36px 34px; grid-template-areas: 'state button' 'hint .'; } }
@media (max-width: 500px) { .calendar-picker { flex-basis: 6.5rem; } .date-controls { gap: 4px; } .date-card { flex-basis: 44px; } }
</style>
