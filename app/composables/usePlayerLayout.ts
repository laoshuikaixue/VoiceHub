import { computed, ref } from 'vue'
import {
  PLAYER_LAYOUT_STORAGE_KEY,
  parsePlayerLayout,
  parsePlayerLayoutMode,
  serializePlayerLayout,
  type PlayerLayoutMode,
  type PlayerLayoutPoint
} from '~/utils/playerLayout'

// 播放器布局模式与自由拖拽坐标：仅存本浏览器，不落库
export function usePlayerLayout() {
  const mode = ref<PlayerLayoutMode>('docked')
  const position = ref<PlayerLayoutPoint | null>(null)

  const isFloating = computed(() => mode.value === 'floating')

  // 读取本地存储：SSR 阶段保持默认固定模式，避免水合差异
  const load = () => {
    if (!import.meta.client) return
    let raw: string | null
    try {
      raw = window.localStorage.getItem(PLAYER_LAYOUT_STORAGE_KEY)
    } catch {
      raw = null
    }
    const state = parsePlayerLayout(raw)
    mode.value = state.mode
    position.value = state.position
  }

  // 写入本地存储；不可用时（隐私模式/配额满）静默忽略，仅本次会话生效
  const save = () => {
    if (!import.meta.client) return
    try {
      window.localStorage.setItem(
        PLAYER_LAYOUT_STORAGE_KEY,
        serializePlayerLayout({ mode: mode.value, position: position.value })
      )
    } catch {
      /* 忽略写入失败 */
    }
  }

  const setMode = (next: PlayerLayoutMode) => {
    mode.value = parsePlayerLayoutMode(next)
    save()
  }

  const toggleMode = () => setMode(isFloating.value ? 'docked' : 'floating')

  // 拖拽过程中高频更新，仅改内存；松手时再落盘
  const setPosition = (next: PlayerLayoutPoint | null) => {
    position.value = next
  }

  const savePosition = () => save()

  return { mode, position, isFloating, load, setMode, toggleMode, setPosition, savePosition }
}
