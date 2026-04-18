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
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
        @click.self="close"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <div
          class="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-zinc-800/50">
            <h3 class="text-lg font-black text-zinc-100 tracking-tight">歌单重复过滤</h3>
            <button
              class="p-2 rounded-xl bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
              @click="close"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <!-- Default Playlists -->
            <div class="space-y-3">
              <label class="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                预设榜单
              </label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="playlist in defaultPlaylists"
                  :key="playlist.id"
                  :class="[
                    'relative p-3 rounded-xl border text-sm font-medium transition-all text-left flex items-center gap-3 overflow-hidden group',
                    selectedIds.includes(playlist.id)
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  ]"
                  @click="togglePlaylist(playlist.id)"
                >
                  <div class="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800/50 border border-zinc-700/50 flex-shrink-0 relative">
                    <img 
                      v-if="playlist.coverImgUrl" 
                      :src="convertToHttps(playlist.coverImgUrl)" 
                      class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      referrerpolicy="no-referrer"
                      alt="" 
                    />
                    <div v-else class="w-full h-full flex items-center justify-center text-zinc-500">
                      <Music2 class="w-4 h-4 opacity-50" />
                    </div>
                  </div>
                  <span class="flex-1 truncate z-10">{{ playlist.name }}</span>
                  <Check v-if="selectedIds.includes(playlist.id)" class="w-4 h-4 flex-shrink-0 z-10" />
                </button>
              </div>
            </div>

            <!-- Custom Playlists -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  自定义歌单 ID / 链接
                </label>
                <button
                  class="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all flex items-center gap-1.5 text-[10px] font-bold"
                  @click="refreshCustomPlaylists"
                  :disabled="isRefreshingCustom"
                  title="重新获取所有自定义歌单信息"
                >
                  <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isRefreshingCustom }" />
                  <span>刷新信息</span>
                </button>
              </div>
              
              <div class="space-y-2">
                <div 
                  v-for="(item, index) in customPlaylists" 
                  :key="item._key"
                  class="flex items-center gap-2"
                >
                  <div class="flex-1 relative">
                    <div class="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded overflow-hidden bg-zinc-800 border border-zinc-700/50 flex items-center justify-center flex-shrink-0">
                      <img 
                        v-if="item.coverImgUrl" 
                        :src="convertToHttps(item.coverImgUrl)" 
                        class="w-full h-full object-cover"
                        referrerpolicy="no-referrer"
                        alt="" 
                      />
                      <Loader2 v-else-if="item.loading" class="w-3 h-3 text-zinc-500 animate-spin" />
                      <Music2 v-else class="w-3 h-3 text-zinc-600" />
                    </div>
                    
                    <input
                      v-model="item.inputValue"
                      type="text"
                      placeholder="输入歌单 ID 或链接"
                      class="w-full pl-9 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-blue-500/30 text-zinc-200 transition-all"
                      @input="handleCustomInputChange(index)"
                    />
                    
                    <div v-if="item.name" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 truncate max-w-[100px] pointer-events-none">
                      {{ item.name }}
                    </div>
                  </div>
                  
                  <button
                    class="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-all flex-shrink-0"
                    @click="removeCustomPlaylist(index)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
                <button
                  class="w-full px-4 py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 text-sm font-medium transition-all flex items-center justify-center gap-2"
                  @click="addCustomPlaylist"
                >
                  <Plus class="w-4 h-4" />
                  <span>添加自定义歌单</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-6 border-t border-zinc-800/50 bg-zinc-900/50 flex items-center gap-3">
            <button
              class="flex-1 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold transition-all"
              @click="clearSelection"
            >
              清除过滤
            </button>
            <button
              class="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isApplying || isAnyCustomLoading"
              @click="applyFilter"
            >
              <span v-if="isApplying" class="flex items-center justify-center gap-2">
                <Loader2 class="w-4 h-4 animate-spin" />
                获取中...
              </span>
              <span v-else>应用过滤</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch, onUnmounted } from 'vue'
import { X, Check, Plus, Trash2, Loader2, Music2, RefreshCw } from 'lucide-vue-next'
import { getPlaylistDetail } from '~/utils/neteaseApi'
import { convertToHttps, getNeteaseCookie } from '~/utils/url'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'apply', playlistIds: string[], playlistTracks: Record<string, string[]>, playlistNames: Record<string, string>): void
}>()

interface CustomPlaylist {
  _key: number
  inputValue: string
  id: string
  name: string
  coverImgUrl: string
  loading: boolean
  trackIds?: string[]
}

const defaultPlaylists = ref([
  { id: '19723756', name: '飙升榜', coverImgUrl: '', trackIds: [] as string[] },
  { id: '3779629', name: '新歌榜', coverImgUrl: '', trackIds: [] as string[] },
  { id: '2884035', name: '原创榜', coverImgUrl: '', trackIds: [] as string[] },
  { id: '3778678', name: '热歌榜', coverImgUrl: '', trackIds: [] as string[] }
])

const selectedIds = ref<string[]>([])
const customPlaylists = ref<CustomPlaylist[]>([])
const isApplying = ref(false)
const isRefreshingCustom = ref(false)
let nextCustomKey = 0

const isAnyCustomLoading = computed(() => {
  return customPlaylists.value.some(p => p.loading)
})

// 防抖定时器
const debounceTimers = ref<Record<number, ReturnType<typeof setTimeout>>>({})

const STORAGE_KEY = 'voicehub_schedule_playlist_filter'

// 解析网易云链接中的 ID
const extractPlaylistId = (input: string): string => {
  const urlPattern = /[?&]id=(\d+)/
  const match = input.match(urlPattern)
  if (match && match[1]) {
    return match[1]
  }
  
  const digitPattern = /^\d+$/
  if (digitPattern.test(input.trim())) {
    return input.trim()
  }
  
  return ''
}

// 获取特定歌单的详细信息
const fetchPlaylistInfo = async (id: string) => {
  const cookie = getNeteaseCookie()
  try {
    const res = await getPlaylistDetail(id, cookie)
    if (res && res.code === 200 && res.body?.playlist) {
      const playlistData = res.body.playlist
      const trackIds = playlistData.trackIds ? playlistData.trackIds.map((t: any) => t.id.toString()) : []
      
      return {
        name: playlistData.name,
        coverImgUrl: playlistData.coverImgUrl,
        trackIds
      }
    }
  } catch (err) {
    console.error(`获取歌单 ${id} 详情失败:`, err)
  }
  return null
}

const handleCustomInputChange = (index: number) => {
  const item = customPlaylists.value[index]
  if (!item) return
  
  const extractedId = extractPlaylistId(item.inputValue)
  
  // 如果提取到了ID且输入值包含 URL 结构，将输入框内容替换为提取出的 ID
  if (extractedId && item.inputValue !== extractedId && /[?&]id=/.test(item.inputValue)) {
    item.inputValue = extractedId
  }
  
  // 清除旧状态
  item.name = ''
  item.coverImgUrl = ''
  item.id = extractedId
  item.trackIds = []
  
  const currentKey = item._key
  
  if (debounceTimers.value[currentKey]) {
    clearTimeout(debounceTimers.value[currentKey])
  }
  
  if (!extractedId) {
    item.loading = false
    return
  }
  
  item.loading = true
  
  // 500ms 防抖
  debounceTimers.value[currentKey] = setTimeout(async () => {
    // 使用提取时的 ID 进行校验，防止竞态条件 (stale fetch)
    const result = await fetchPlaylistInfo(extractedId)
    
    // 找到当前 key 对应的 item（可能位置已经改变）
    const currentIndex = customPlaylists.value.findIndex(p => p._key === currentKey)
    if (currentIndex !== -1) {
      const currentItem = customPlaylists.value[currentIndex]
      
      // 只有当当前的输入 ID 仍然匹配时才更新
      if (currentItem.id === extractedId) {
        currentItem.loading = false
        if (result) {
          currentItem.name = result.name
          currentItem.coverImgUrl = result.coverImgUrl
          currentItem.trackIds = result.trackIds
        }
      }
    }
  }, 500)
}

const refreshCustomPlaylists = async () => {
  if (isRefreshingCustom.value) return
  isRefreshingCustom.value = true
  
  try {
    const promises = customPlaylists.value.map(async (item) => {
      if (item.id) {
        item.loading = true
        const result = await fetchPlaylistInfo(item.id)
        
        // 由于是异步的，确保元素还在并且 ID 没变
        const currentItem = customPlaylists.value.find(p => p._key === item._key)
        if (currentItem && currentItem.id === item.id) {
          currentItem.loading = false
          if (result) {
            currentItem.name = result.name
            currentItem.coverImgUrl = result.coverImgUrl
            currentItem.trackIds = result.trackIds
          }
        }
      }
    })
    await Promise.all(promises)
  } finally {
    isRefreshingCustom.value = false
  }
}

onMounted(async () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed.selectedIds)) selectedIds.value = parsed.selectedIds
      if (Array.isArray(parsed.customPlaylists)) {
        // 只恢复值，状态重置
        customPlaylists.value = parsed.customPlaylists.map((p: any) => ({
          _key: nextCustomKey++,
          inputValue: p.inputValue || '',
          id: p.id || extractPlaylistId(p.inputValue || ''),
          name: p.name || '',
          coverImgUrl: p.coverImgUrl || '',
          loading: false,
          trackIds: p.trackIds || []
        }))
      }
    }
  } catch (e) {
    console.error('无法解析本地保存的过滤设置', e)
  }

  const cookie = getNeteaseCookie()

  await Promise.all(defaultPlaylists.value.map(async (playlist) => {
    try {
      const res = await getPlaylistDetail(playlist.id, cookie)
      if (res && res.code === 200 && res.body?.playlist) {
        if (res.body.playlist.coverImgUrl) {
          playlist.coverImgUrl = res.body.playlist.coverImgUrl
        }
        if (res.body.playlist.trackIds) {
          playlist.trackIds = res.body.playlist.trackIds.map((t: any) => t.id.toString())
        }
      }
    } catch (err) {
      console.error(`获取榜单 ${playlist.name} 详情失败:`, err)
    }
  }))
})

onUnmounted(() => {
  // 组件卸载时清除所有防抖定时器
  Object.values(debounceTimers.value).forEach(timer => clearTimeout(timer))
  debounceTimers.value = {}
})

watch([selectedIds, customPlaylists], ([newSelected, newCustom]) => {
  // 保存时剔除 loading 状态和体积过大的 trackIds 数据
  const customToSave = newCustom.map(c => ({
    inputValue: c.inputValue,
    id: c.id,
    name: c.name,
    coverImgUrl: c.coverImgUrl
  }))
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    selectedIds: newSelected,
    customPlaylists: customToSave
  }))
}, { deep: true })

const togglePlaylist = (id: string) => {
  const index = selectedIds.value.indexOf(id)
  if (index === -1) {
    selectedIds.value.push(id)
  } else {
    selectedIds.value.splice(index, 1)
  }
}

const addCustomPlaylist = () => {
  customPlaylists.value.push({
    _key: nextCustomKey++,
    inputValue: '',
    id: '',
    name: '',
    coverImgUrl: '',
    loading: false
  })
}

const removeCustomPlaylist = (index: number) => {
  const item = customPlaylists.value[index]
  if (!item) return
  
  const key = item._key
  if (debounceTimers.value[key]) {
    clearTimeout(debounceTimers.value[key])
    delete debounceTimers.value[key]
  }
  customPlaylists.value.splice(index, 1)
}

const close = () => {
  emit('update:show', false)
}

const clearSelection = () => {
  selectedIds.value = []
  customPlaylists.value = []
  emit('apply', [], {}, {})
  close()
}

const applyFilter = async () => {
  isApplying.value = true
  try {
    const allIds: string[] = [...selectedIds.value]
    const trackIdsMap: Record<string, string[]> = {}
    const playlistNamesMap: Record<string, string> = {}
    
    // 收集预设榜单的 trackIds 和名称
    for (const id of selectedIds.value) {
      const defaultPl = defaultPlaylists.value.find(p => p.id === id)
      if (defaultPl) {
        playlistNamesMap[id] = defaultPl.name
        if (defaultPl.trackIds && defaultPl.trackIds.length > 0) {
          trackIdsMap[id] = defaultPl.trackIds
        }
      }
    }
    
    // 收集有效的自定义歌单的 trackIds 和名称
    for (const item of customPlaylists.value) {
      if (item.id) {
        allIds.push(item.id)
        if (item.name) {
          playlistNamesMap[item.id] = item.name
        } else {
          playlistNamesMap[item.id] = `歌单 ${item.id}`
        }
        
        if (item.trackIds && item.trackIds.length > 0) {
          trackIdsMap[item.id] = item.trackIds
        }
      }
    }
    
    // 去重
    const uniqueIds = [...new Set(allIds)]
    
    emit('apply', uniqueIds, trackIdsMap, playlistNamesMap)
    close()
  } finally {
    isApplying.value = false
  }
}
</script>
