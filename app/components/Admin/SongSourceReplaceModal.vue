<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-bg-primary-80 backdrop-blur-sm"
        @click.self="closeModal"
      >
        <div
          class="w-full max-w-4xl bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          <!-- 头部 -->
          <div
            class="p-6 pb-4 flex items-start justify-between gap-4 border-b border-border-secondary-50 shrink-0"
          >
            <div class="min-w-0">
              <h3
                class="text-xl font-black text-text-primary tracking-tight flex items-center gap-3"
              >
                <span
                  class="w-10 h-10 rounded-xl bg-primary-hover-10 flex items-center justify-center text-primary shrink-0"
                >
                  <ArrowLeftRight :size="20" />
                </span>
                {{ t('sourceReplace.title') }}
              </h3>
              <p class="text-xs text-text-tertiary mt-2 ml-13">
                {{ t('sourceReplace.subtitle') }}
              </p>
            </div>
            <button
              class="flex items-center justify-center p-3 bg-bg-tertiary-50 hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary rounded-xl transition-all shrink-0"
              @click="closeModal"
            >
              <X :size="20" />
            </button>
          </div>

          <!-- 主体 -->
          <div class="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
            <!-- 当前音源 -->
            <div
              class="rounded-xl border border-border-secondary-60 bg-bg-primary-30 p-4 flex items-center gap-3"
            >
              <div
                class="w-10 h-10 rounded-lg bg-bg-tertiary-40 border border-border-tertiary-30 flex items-center justify-center overflow-hidden shrink-0"
              >
                <img
                  v-if="song.cover"
                  :src="getCoverThumbUrl(song.cover)"
                  class="w-full h-full object-cover"
                  referrerpolicy="no-referrer"
                />
                <Music v-else :size="16" class="text-text-disabled" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-black text-text-disabled uppercase tracking-widest">
                  {{ t('sourceReplace.currentSource') }}
                </p>
                <p class="text-sm font-bold text-text-primary truncate mt-0.5">
                  {{ song.title }}
                  <span class="text-text-tertiary font-medium">· {{ song.artist }}</span>
                </p>
              </div>
              <div class="shrink-0 text-right">
                <span
                  v-if="song.musicPlatform"
                  class="inline-block px-2 py-1 text-[10px] font-black rounded-md bg-bg-tertiary text-text-secondary"
                >
                  {{ platformLabel(song.musicPlatform) }}
                </span>
                <p
                  v-if="song.musicId"
                  class="text-[10px] text-text-tertiary font-mono mt-1 truncate max-w-[180px]"
                >
                  {{ song.musicId }}
                </p>
              </div>
            </div>

            <!-- 搜索 -->
            <div class="space-y-2">
              <div class="flex gap-2">
                <div class="relative flex-1">
                  <Search
                    :size="16"
                    class="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
                  />
                  <input
                    v-model="keywords"
                    type="text"
                    maxlength="120"
                    :placeholder="t('sourceReplace.searchPlaceholder')"
                    class="w-full bg-bg-primary border rounded-lg pl-11 pr-4 py-3 text-sm text-text-primary focus:outline-none transition-all"
                    :class="
                      keywordError
                        ? 'border-error-60 focus:border-error'
                        : 'border-border-secondary focus:border-primary-30'
                    "
                    @keyup.enter="runSearch"
                  />
                </div>
                <button
                  type="button"
                  class="px-5 py-3 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-lg transition-all shrink-0 flex items-center gap-2"
                  @click="runSearch"
                >
                  <Loader2 v-if="activeIsLoading" :size="14" class="animate-spin" />
                  <Search v-else :size="14" />
                  {{ activeIsLoading ? t('sourceReplace.searching') : t('sourceReplace.search') }}
                </button>
              </div>
              <p class="text-[10px] text-text-disabled font-medium px-1">
                {{
                  keywordError
                    ? t('sourceReplace.keywordsRequired')
                    : t('sourceReplace.autoSearchHint')
                }}
              </p>
            </div>

            <!-- 平台选项卡 -->
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all"
                :class="
                  activeTab === 'all'
                    ? 'border-primary-30 bg-primary-10 text-primary'
                    : 'border-border-secondary-60 bg-bg-primary-30 text-text-tertiary hover:border-border-tertiary hover:text-text-secondary'
                "
                @click="switchTab('all')"
              >
                {{ t('sourceReplace.all') }}
                <span v-if="allResults.length" class="opacity-70">({{ allResults.length }})</span>
              </button>
              <button
                v-for="platform in availablePlatforms"
                :key="platform"
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all"
                :class="
                  activeTab === platform
                    ? 'border-primary-30 bg-primary-10 text-primary'
                    : 'border-border-secondary-60 bg-bg-primary-30 text-text-tertiary hover:border-border-tertiary hover:text-text-secondary'
                "
                @click="switchTab(platform)"
              >
                {{ platformLabel(platform) }}
                <span v-if="platformCount(platform)" class="opacity-70"
                  >({{ platformCount(platform) }})</span
                >
                <Loader2
                  v-if="platformStates[platform] === 'loading'"
                  :size="12"
                  class="animate-spin"
                />
                <span
                  v-if="platform === song.musicPlatform"
                  class="px-1 py-0.5 rounded bg-bg-tertiary text-text-disabled text-[9px]"
                  >{{ t('sourceReplace.current') }}</span
                >
              </button>
            </div>

            <!-- 搜索失败提示 -->
            <div v-if="failedPlatforms.length" class="flex flex-wrap gap-2">
              <span
                v-for="platform in failedPlatforms"
                :key="platform"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-warning-10 text-warning text-[10px] font-bold"
                :title="platformErrors[platform]"
              >
                <AlertCircle :size="12" />
                {{ t('sourceReplace.platformFailed', '', platformLabel(platform)) }}
              </span>
            </div>

            <!-- 加载状态 -->
            <div
              v-if="activeIsLoading && visibleResults.length === 0"
              class="flex flex-col items-center justify-center py-16 text-text-disabled"
            >
              <AppSpinner :size="36" />
              <p class="text-sm font-bold mt-4">{{ t('sourceReplace.searching') }}</p>
            </div>

            <!-- 搜索结果 -->
            <div v-else-if="visibleResults.length" class="space-y-2">
              <button
                v-for="item in visibleResults"
                :key="item.key"
                type="button"
                class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all"
                :class="
                  selectedKey === item.key
                    ? 'border-primary-30 bg-primary-10'
                    : 'border-border-secondary-60 bg-bg-primary-30 hover:border-border-tertiary hover:bg-bg-secondary-40'
                "
                @click="selectResult(item)"
              >
                <div
                  class="w-12 h-12 rounded-lg bg-bg-tertiary-40 border border-border-tertiary-30 flex items-center justify-center overflow-hidden shrink-0 relative group/preview"
                >
                  <img
                    v-if="item.cover"
                    :src="getCoverThumbUrl(item.cover)"
                    class="w-full h-full object-cover"
                    referrerpolicy="no-referrer"
                  />
                  <Music v-else :size="18" class="text-text-disabled" />
                  <button
                    type="button"
                    class="absolute inset-0 flex items-center justify-center bg-bg-primary-50 text-text-primary transition-opacity"
                    :class="
                      isPreviewing(item)
                        ? 'opacity-100'
                        : 'opacity-0 group-hover/preview:opacity-100'
                    "
                    :title="
                      isPreviewing(item)
                        ? t('sourceReplace.stopPreview')
                        : t('sourceReplace.preview')
                    "
                    @click.stop="togglePreview(item)"
                  >
                    <Pause v-if="isPreviewing(item)" :size="18" class="fill-current" />
                    <Play v-else :size="18" class="fill-current" />
                  </button>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-sm font-bold text-text-primary truncate">{{
                      item.title
                    }}</span>
                    <span
                      :class="[
                        'shrink-0 px-1.5 py-0.5 text-[9px] font-black rounded uppercase tracking-wider',
                        matchClass(item)
                      ]"
                    >
                      {{ matchLabel(item) }}
                    </span>
                  </div>
                  <p class="text-[11px] text-text-tertiary truncate mt-1">
                    {{ item.artist }}
                    <template v-if="item.album"> · {{ item.album }}</template>
                  </p>
                </div>
                <div class="shrink-0 flex flex-col items-end gap-1">
                  <span
                    class="px-1.5 py-0.5 text-[9px] font-black rounded bg-bg-tertiary text-text-secondary uppercase tracking-wider"
                  >
                    {{ platformLabel(item.musicPlatform) }}
                  </span>
                  <span class="text-[10px] text-text-tertiary">{{ durationText(item) }}</span>
                </div>
                <span
                  class="w-5 h-5 rounded-full border flex items-center justify-center shrink-0"
                  :class="
                    selectedKey === item.key
                      ? 'bg-primary border-primary text-text-primary'
                      : 'border-border-tertiary text-transparent'
                  "
                >
                  <Check :size="12" />
                </span>
              </button>
            </div>

            <!-- 空状态 -->
            <div
              v-else-if="!activeIsLoading"
              class="flex flex-col items-center justify-center py-16 text-text-disabled"
            >
              <Music :size="48" class="mb-4 opacity-20" />
              <p class="text-sm font-bold">
                {{ hasSearched ? t('sourceReplace.empty') : t('sourceReplace.selectHint') }}
              </p>
              <p v-if="hasSearched" class="text-[11px] mt-2 max-w-sm text-center leading-relaxed">
                {{ t('sourceReplace.emptyHint') }}
              </p>
            </div>
          </div>

          <!-- 底部 -->
          <div
            class="p-5 border-t border-border-secondary-50 bg-bg-secondary-50 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0"
          >
            <div class="min-w-0 flex-1">
              <template v-if="selected">
                <div class="flex flex-wrap items-center gap-3 min-w-0">
                  <div
                    class="w-9 h-9 rounded-lg bg-bg-tertiary-40 border border-border-tertiary-30 flex items-center justify-center overflow-hidden shrink-0"
                  >
                    <img
                      v-if="selected.cover"
                      :src="getCoverThumbUrl(selected.cover)"
                      class="w-full h-full object-cover"
                      referrerpolicy="no-referrer"
                    />
                    <Music v-else :size="14" class="text-text-disabled" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-text-primary truncate">{{ selected.title }}</p>
                    <p class="text-[10px] text-text-tertiary truncate">
                      {{ selected.artist }} · {{ platformLabel(selected.musicPlatform) }}
                    </p>
                  </div>
                  <div v-if="pageOptions.length > 1" class="w-44 shrink-0">
                    <CustomSelect
                      v-model="selectedPageIndex"
                      :options="pageOptions"
                      :placeholder="t('sourceReplace.selectPage')"
                    />
                  </div>
                </div>
                <p class="text-[10px] text-text-disabled mt-1 truncate">
                  {{ t('sourceReplace.selectedHint') }}
                </p>
              </template>
              <p v-else class="text-[11px] text-text-tertiary">
                {{ t('sourceReplace.selectHint') }}
              </p>
            </div>
            <div class="flex items-center justify-end gap-3 shrink-0">
              <button
                class="px-5 py-2.5 text-xs font-bold text-text-tertiary hover:text-text-secondary"
                @click="closeModal"
              >
                {{ t('sourceReplace.cancel') }}
              </button>
              <button
                :disabled="!selected || applying"
                class="px-6 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                @click="applySelection"
              >
                <Loader2 v-if="applying" :size="14" class="animate-spin" />
                <ArrowLeftRight v-else :size="14" />
                {{ applying ? t('sourceReplace.applying') : t('sourceReplace.apply') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  Loader2,
  Music,
  Pause,
  Play,
  Search,
  X
} from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useMusicSources } from '~/composables/useMusicSources'
import { usePlatformConfig } from '~/composables/usePlatformConfig'
import { useLocaleText, useServerErrors } from '~/composables/useLocaleText'
import { useSongPlayer } from '~/composables/useSongPlayer'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useLocale } from '~/utils/locale'
import { getPlatformDisplayName } from '~/utils/platforms'
import { isPluginPlatform } from '~/utils/pluginPlatform'
import { normalizeForMatch } from '~/utils/song-name-normalize'
import { getCoverThumbUrl } from '~/utils/url'
import { formatDuration } from '~/utils/timeUtils'

// 每个平台抓取的候选数量，避免一次换源产生过多外部请求
const RESULT_LIMIT = 10

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  song: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['close', 'apply'])

const { admin, siteConfig, currentLocale } = useLocale()
const { t } = useLocaleText(computed(() => admin.value?.songManagement || {}))
const { localize: localizeServerError } = useServerErrors()
const { getAvailablePlatforms, loadPlatformConfig, pluginPlatforms } = usePlatformConfig()
const musicSources = useMusicSources()
const { playSong } = useSongPlayer()
const audioPlayer = useAudioPlayer()

const platformLabel = (platform) => {
  if (!platform) return ''
  const plugin = pluginPlatforms.value.find((item) => item.platform === platform)
  return (
    plugin?.displayName || getPlatformDisplayName(platform, siteConfig.value, currentLocale.value)
  )
}

const keywords = ref('')
const keywordError = ref(false)
const activeTab = ref('all')
const hasSearched = ref(false)
const autoSearchPending = ref(false)
const selectedKey = ref('')
const selectedPageIndex = ref(0)
const applying = ref(false)

const platformResults = ref({})
const platformStates = ref({})
const platformErrors = ref({})

let searchRunId = 0
let searchController = null

const availablePlatforms = computed(() => {
  const list = [...getAvailablePlatforms()]
  const current = String(props.song?.musicPlatform || '')
  if (current && !list.includes(current)) list.push(current)
  return list
})

// 自动搜索排除当前音源，仅当没有其他平台时才回退到当前平台
const searchPlatforms = computed(() => {
  const current = String(props.song?.musicPlatform || '')
  const others = availablePlatforms.value.filter((platform) => platform !== current)
  return others.length ? others : availablePlatforms.value
})

const allResults = computed(() => {
  const list = []
  const seen = new Set()
  for (const platform of Object.keys(platformResults.value)) {
    const items = platformResults.value[platform]
    if (!Array.isArray(items)) continue
    for (const item of items) {
      // QQ 搜索降级到网易云时会与其他平台的同名结果重复，按实际平台+音乐 ID 去重
      const dedupeKey = `${item.musicPlatform}:${item.musicId}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      list.push(item)
    }
  }
  return list
})

const visibleResults = computed(() => {
  const list =
    activeTab.value === 'all' ? allResults.value : platformResults.value[activeTab.value] || []
  return [...list].sort((a, b) => b.score - a.score || a.index - b.index)
})

const isSearching = computed(() =>
  Object.values(platformStates.value).some((state) => state === 'loading')
)

// 当前选项卡是否仍在等待结果：全部页看整体，单平台页只看该平台
const activeIsLoading = computed(() =>
  activeTab.value === 'all'
    ? isSearching.value || autoSearchPending.value
    : platformStates.value[activeTab.value] === 'loading'
)

const failedPlatforms = computed(() =>
  availablePlatforms.value.filter((platform) => platformStates.value[platform] === 'error')
)

const selected = computed(
  () => allResults.value.find((item) => item.key === selectedKey.value) || null
)

const pageOptions = computed(() => {
  const pages = selected.value?.pages || []
  if (pages.length <= 1) return []
  return pages.map((page, index) => ({
    label: [t('sourceReplace.pageLabel', '', page.page ?? index + 1), page.part]
      .filter(Boolean)
      .join(' · '),
    value: index
  }))
})

const platformCount = (platform) => (platformResults.value[platform] || []).length

const closeModal = () => {
  stopPreview()
  emit('close')
}

const cancelSearch = (settleLoading = true) => {
  searchRunId += 1
  if (searchController) {
    searchController.abort()
    searchController = null
  }
  if (settleLoading) {
    for (const platform of Object.keys(platformStates.value)) {
      if (platformStates.value[platform] === 'loading') platformStates.value[platform] = 'done'
    }
  }
}

const splitArtists = (value) =>
  String(value || '')
    .split(/[/、,&＆]/)
    .map((part) => normalizeForMatch(part))
    .filter(Boolean)

// 搜索结果的时长单位不统一：网易云返回毫秒，其余内置平台返回秒；插件单位未知，按数值量级判断
const normalizeDurationValue = (duration, platform) => {
  const value = Number(duration)
  if (!Number.isFinite(value) || value <= 0) return null
  if (platform === 'netease' || platform === 'netease-podcast') return Math.round(value / 1000)
  if (platform === 'tencent' || platform === 'migu' || platform === 'bilibili') {
    return Math.round(value)
  }
  return Math.round(value > 3600 ? value / 1000 : value)
}

const computeMatchScore = (title, artist, durationSeconds) => {
  const normalizedTitle = normalizeForMatch(title)
  const targetTitle = normalizeForMatch(props.song?.title || '')
  let score = 0

  if (normalizedTitle && targetTitle) {
    if (normalizedTitle === targetTitle) score += 100
    else if (normalizedTitle.includes(targetTitle) || targetTitle.includes(normalizedTitle)) {
      score += 40
    }
  }

  const resultArtists = splitArtists(artist)
  const targetArtists = splitArtists(props.song?.artist)
  let artistExact = false
  let artistContains = false
  for (const targetArtist of targetArtists) {
    for (const resultArtist of resultArtists) {
      if (targetArtist === resultArtist) artistExact = true
      else if (targetArtist.includes(resultArtist) || resultArtist.includes(targetArtist)) {
        artistContains = true
      }
    }
  }
  if (artistExact) score += 50
  else if (artistContains) score += 20

  const targetDuration = Number(props.song?.durationSeconds)
  if (durationSeconds && Number.isFinite(targetDuration) && targetDuration > 0) {
    const diff = Math.abs(targetDuration - durationSeconds)
    if (diff <= 5) score += 20
    else if (diff <= Math.max(10, targetDuration * 0.04)) score += 10
  }

  return score
}

const resolveResultPlatform = (item, requestedPlatform, sourceId) => {
  const raw = String(item.actualMusicPlatform || item.musicPlatform || '').trim()
  if (raw === 'netease-backup') return 'netease'
  if (raw === 'qq-resolver') return 'tencent'
  if (raw && raw !== 'native-music') return raw
  const source = String(sourceId || '')
  if (source.includes('netease')) return 'netease'
  if (source.includes('tencent') || source.includes('vkeys')) return 'tencent'
  if (source.includes('bilibili')) return 'bilibili'
  if (source.includes('migu')) return 'migu'
  return requestedPlatform
}

const normalizeResult = (item, requestedPlatform, sourceId, index) => {
  const title = String(item.title || item.song || '').trim()
  const artist = String(item.artist || item.singer || '').trim()
  const musicId = String(item.musicId || item.id || '').trim()
  if (!title || !musicId) return null

  const musicPlatform = resolveResultPlatform(item, requestedPlatform, sourceId)
  const durationSeconds = normalizeDurationValue(item.duration, musicPlatform)
  const pages = Array.isArray(item.pages)
    ? item.pages.map((page) => ({
        cid: page.cid,
        page: page.page,
        part: page.part || '',
        duration: Number(page.duration) || null
      }))
    : []

  return {
    key: `${requestedPlatform}:${musicPlatform}:${musicId}:${index}`,
    index,
    title,
    artist,
    album: String(item.album || '').trim(),
    cover: String(item.cover || '').trim(),
    musicPlatform,
    musicId,
    durationSeconds,
    pages,
    selectionToken: item.selectionToken || '',
    score: computeMatchScore(title, artist, durationSeconds)
  }
}

const searchPlatform = async (platform, keyword, signal, runId) => {
  try {
    const response = await musicSources.searchSongs(
      { keywords: keyword, platform, limit: RESULT_LIMIT, type: 1 },
      signal
    )
    if (signal.aborted || runId !== searchRunId) return

    const items = Array.isArray(response?.data) ? response.data : []
    platformResults.value[platform] = items
      .map((item, index) => normalizeResult(item, platform, response?.source, index))
      .filter(Boolean)
      .slice(0, RESULT_LIMIT)
    platformErrors.value[platform] = ''
    platformStates.value[platform] = 'done'
  } catch (error) {
    if (signal.aborted || runId !== searchRunId || error?.name === 'AbortError') return
    platformStates.value[platform] = 'error'
    platformErrors.value[platform] = localizeServerError(error, t('sourceReplace.searchFailed'))
  }
}

const runSearch = async () => {
  const keyword = keywords.value.trim()
  if (!keyword) {
    keywordError.value = true
    autoSearchPending.value = false
    return
  }
  keywordError.value = false
  autoSearchPending.value = false

  const targets = activeTab.value === 'all' ? searchPlatforms.value : [activeTab.value]
  if (!targets.length) return

  cancelSearch()
  const runId = searchRunId
  searchController = new AbortController()
  const signal = searchController.signal

  selectedKey.value = ''
  selectedPageIndex.value = 0
  for (const platform of targets) {
    platformResults.value[platform] = []
    platformErrors.value[platform] = ''
    platformStates.value[platform] = 'loading'
  }
  hasSearched.value = true

  await Promise.allSettled(
    targets.map((platform) => searchPlatform(platform, keyword, signal, runId))
  )
}

const switchTab = (platform) => {
  activeTab.value = platform
  if (platform !== 'all' && !platformStates.value[platform] && keywords.value.trim()) {
    runSearch()
  }
}

const selectResult = (item) => {
  selectedKey.value = item.key === selectedKey.value ? '' : item.key
  selectedPageIndex.value = 0
}

// 构建试听用歌曲对象，bilibili 需拼接 cid 与分P
const buildPreviewSong = (item) => {
  let musicId = item.musicId
  if (item.musicPlatform === 'bilibili') {
    const page = item.pages?.[0]
    if (page?.cid) {
      const bvid = String(item.musicId).split(':')[0]
      const parts = [bvid, String(page.cid)]
      if (Number(page.page) > 1) parts.push(String(page.page))
      musicId = parts.join(':')
    }
  }
  return {
    id: `preview:${item.key}`,
    title: item.title,
    artist: item.artist,
    album: item.album || null,
    cover: item.cover || null,
    duration: item.durationSeconds || null,
    musicPlatform: item.musicPlatform,
    musicId,
    selectionToken: item.selectionToken
  }
}

// 当前是否正在试听该条目
const isPreviewing = (item) => {
  const current = audioPlayer.getCurrentSong().value
  if (!current) return false
  return current.id === `preview:${item.key}` && audioPlayer.getPlayingStatus().value
}

// 点击封面切换试听播放/暂停
const togglePreview = async (item) => {
  if (isPreviewing(item)) {
    audioPlayer.pauseSong()
    return
  }
  await playSong(buildPreviewSong(item))
}

// 关闭弹窗时停止试听
const stopPreview = () => {
  const current = audioPlayer.getCurrentSong().value
  if (current && String(current.id).startsWith('preview:')) {
    audioPlayer.pauseSong()
  }
}

const matchLevel = (item) => {
  if (item.score >= 140) return 'high'
  if (item.score >= 70) return 'medium'
  return 'low'
}

const matchLabel = (item) => {
  const level = matchLevel(item)
  if (level === 'high') return t('sourceReplace.matchHigh')
  if (level === 'medium') return t('sourceReplace.matchMedium')
  return t('sourceReplace.matchLow')
}

const matchClass = (item) => {
  const level = matchLevel(item)
  if (level === 'high') return 'bg-success-10 text-success'
  if (level === 'medium') return 'bg-warning-10 text-warning'
  return 'bg-bg-tertiary text-text-tertiary'
}

const durationText = (item) => {
  const seconds = Number(item.durationSeconds)
  if (!Number.isFinite(seconds) || seconds <= 0) return t('sourceReplace.durationUnknown')
  return formatDuration(seconds)
}

const applySelection = async () => {
  const item = selected.value
  if (!item || applying.value) return

  applying.value = true
  try {
    const page = item.pages?.[selectedPageIndex.value]
    let musicId = item.musicId

    if (item.musicPlatform === 'bilibili' && page?.cid) {
      const bvid = musicId.split(':')[0]
      const parts = [bvid, String(page.cid)]
      if (Number(page.page) > 1) parts.push(String(page.page))
      musicId = parts.join(':')
    }

    let durationSeconds = Number(page?.duration) || item.durationSeconds
    try {
      const result = await $fetch('/api/admin/songs/duration', {
        method: 'POST',
        body: { platform: item.musicPlatform, musicId },
        timeout: 15000
      })
      if (result?.success && result.durationSeconds) durationSeconds = result.durationSeconds
    } catch {
      // 时长接口失败时继续使用搜索结果中的时长
    }

    let cover = item.cover
    if (!cover) {
      try {
        const result = await $fetch('/api/admin/songs/cover', {
          method: 'POST',
          body: { platform: item.musicPlatform, musicId },
          timeout: 15000
        })
        if (result?.success && result.cover) cover = result.cover
      } catch {
        // 封面获取失败时保留搜索结果中的封面
      }
    }

    emit('apply', {
      musicPlatform: item.musicPlatform,
      musicId,
      cover: cover || '',
      durationSeconds: durationSeconds || null,
      selectionToken: isPluginPlatform(item.musicPlatform) ? item.selectionToken || '' : ''
    })
  } finally {
    applying.value = false
  }
}

const resetState = () => {
  cancelSearch(false)
  keywords.value = String(props.song?.title || '').trim()
  keywordError.value = false
  activeTab.value = 'all'
  hasSearched.value = false
  autoSearchPending.value = Boolean(keywords.value)
  selectedKey.value = ''
  selectedPageIndex.value = 0
  applying.value = false
  platformResults.value = {}
  platformStates.value = {}
  platformErrors.value = {}
}

watch(
  () => props.show,
  async (visible) => {
    if (!visible) {
      stopPreview()
      cancelSearch()
      return
    }
    resetState()
    await loadPlatformConfig()
    if (!props.show || !keywords.value) {
      autoSearchPending.value = false
      return
    }
    runSearch()
  }
)

onBeforeUnmount(() => {
  stopPreview()
  cancelSearch()
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--panel-bg-alt);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--panel-bg-hover);
}
</style>
