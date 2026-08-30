import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getSyncedTimestamp } from '~/composables/useSyncedTime'

const STORAGE_KEY = 'voicehub_scroll_positions'
/** 恢复等待上限：列表数据异步渲染后高度才达标，轮询至到位或超时放弃 */
const RESTORE_MAX_WAIT_MS = 3000
/** 认为已恢复到目标位置的容差 */
const RESTORE_TOLERANCE_PX = 8
/** 低于该值的保存位置不占用存储 */
const MIN_SAVE_PX = 8
/** 相邻保存最小间隔 */
const SAVE_INTERVAL_MS = 300

type ScrollMap = Record<string, number>

const readMap = (): ScrollMap => {
  if (!import.meta.client) return {}
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

/** 以重建方式写入，过滤掉当前键与低于阈值的历史记录 */
const writeTop = (key: string, top: number): void => {
  if (!import.meta.client || !key) return
  try {
    const next: ScrollMap = {}
    for (const [k, v] of Object.entries(readMap())) {
      if (k !== key && v >= MIN_SAVE_PX) next[k] = v
    }
    if (top >= MIN_SAVE_PX) next[key] = Math.floor(top)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 存储不可用（隐私模式等）时静默降级
  }
}

/**
 * 页面滚动位置记忆：window 滚动距离按「路由 fullPath + 子键」存取。
 * 子键用于区分同一页面内部 Tab（如首页排期/歌曲/投稿/通知、控制台各面板），
 * 各 Tab 独立记忆并在切回时自动恢复；页面返回时等内容渲染到足够高度再定位，
 * 避免被异步加载打断
 */
export const useScrollMemory = (getSubKey?: () => string): void => {
  const route = useRoute()

  let lastSavedAt = 0
  // 恢复期间程序化滚动会触发 scroll 事件，此标记避免把中间值当成用户位置写回
  let restoring = false
  /** 代次令牌：新恢复任务或卸载后使仍在进行的轮询失效 */
  let restoreToken = 0

  const keyOf = (sub?: string): string => (sub ? `${route.fullPath}#${sub}` : route.fullPath)

  const saveNow = (): void => {
    lastSavedAt = getSyncedTimestamp()
    writeTop(keyOf(getSubKey?.()), window.scrollY)
  }

  const onScroll = (): void => {
    if (restoring) return
    if (getSyncedTimestamp() - lastSavedAt < SAVE_INTERVAL_MS) return
    saveNow()
  }

  // 恢复等待期间尚未到达目标，保留原记录避免被中间值覆盖
  const safeSaveNow = (): void => {
    if (restoring) return
    saveNow()
  }

  const startRestore = (key: string): void => {
    const target = readMap()[key]
    if (!target || target <= RESTORE_TOLERANCE_PX) return
    restoring = true
    const token = ++restoreToken
    const startedAt = getSyncedTimestamp()
    requestAnimationFrame(function tryRestore() {
      if (token !== restoreToken) return
      if (getSyncedTimestamp() - startedAt > RESTORE_MAX_WAIT_MS) {
        restoring = false
        return
      }
      const maxY = document.documentElement.scrollHeight - window.innerHeight
      if (maxY >= target - RESTORE_TOLERANCE_PX) {
        window.scrollTo(0, target)
        restoring = false
        return
      }
      requestAnimationFrame(tryRestore)
    })
  }

  onMounted(() => {
    startRestore(keyOf(getSubKey?.()))
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('beforeunload', safeSaveNow)
  })

  if (getSubKey) {
    watch(getSubKey, (next, prev) => {
      // 切换瞬间视口位置仍属于旧 Tab，先归档；新 Tab 内容渲染后再找回归属位置
      writeTop(keyOf(prev), window.scrollY)
      startRestore(keyOf(next))
    })
  }

  onBeforeUnmount(() => {
    restoreToken++
    restoring = false
    safeSaveNow()
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('beforeunload', safeSaveNow)
  })
}
