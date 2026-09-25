// 播放器布局（固定底部 / 自由拖拽）的几何计算与持久化解析，纯函数便于单测

export type PlayerLayoutMode = 'docked' | 'floating'

export interface PlayerLayoutPoint {
  x: number
  y: number
}

export interface PlayerLayoutSize {
  width: number
  height: number
}

export interface PlayerLayoutState {
  mode: PlayerLayoutMode
  position: PlayerLayoutPoint | null
}

// 视口限位回调：由持有播放器元素的组件注入，元素未渲染无法测量时返回 null
export type PlayerLayoutClamp = (point: PlayerLayoutPoint) => PlayerLayoutPoint | null

// 浏览器本地存储键：布局模式与自由拖拽坐标（仅存本机，不落库）
export const PLAYER_LAYOUT_STORAGE_KEY = 'voicehub-player-layout'

// 自由拖拽时元素与视口边缘的间距，桌面端取值与固定模式的 bottom: 1rem 一致，
// 移动端与 .mobile-player-bar 的 left/right 一致
export const PLAYER_LAYOUT_MARGIN = 16
export const PLAYER_LAYOUT_MARGIN_MOBILE = 10

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

// 未知/非法值一律回退固定模式
export function parsePlayerLayoutMode(value: unknown): PlayerLayoutMode {
  return value === 'floating' ? 'floating' : 'docked'
}

// 默认布局：固定底部且未记录坐标（每次返回新对象，避免调用方互相影响）
export function createDefaultLayout(): PlayerLayoutState {
  return { mode: 'docked', position: null }
}

// 单轴限位：元素完整落在视口内；视口比元素还窄时退化为贴边，避免坐标被压成负数
function clampAxis(value: unknown, size: number, viewportSize: number, margin: number): number {
  const max = Math.max(viewportSize - size - margin, 0)
  const min = Math.min(margin, max)
  if (!isFiniteNumber(value)) return min
  return Math.min(Math.max(value, min), max)
}

// 把自由拖拽坐标限制在视口内
export function clampPlayerPosition(
  position: PlayerLayoutPoint | null | undefined,
  size: PlayerLayoutSize,
  viewport: PlayerLayoutSize,
  margin: number = PLAYER_LAYOUT_MARGIN
): PlayerLayoutPoint {
  return {
    x: clampAxis(position?.x, size.width, viewport.width, margin),
    y: clampAxis(position?.y, size.height, viewport.height, margin)
  }
}

// 容错解析本地存储：非法 JSON、非对象、未知模式、非有限坐标均回退默认值
export function parsePlayerLayout(raw: unknown): PlayerLayoutState {
  if (typeof raw !== 'string' || !raw.trim()) return createDefaultLayout()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return createDefaultLayout()
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return createDefaultLayout()

  const { mode, position } = parsed as { mode?: unknown; position?: unknown }
  const point =
    position && typeof position === 'object' && !Array.isArray(position)
      ? (position as { x?: unknown; y?: unknown })
      : null

  return {
    mode: parsePlayerLayoutMode(mode),
    position:
      point && isFiniteNumber(point.x) && isFiniteNumber(point.y)
        ? { x: point.x, y: point.y }
        : null
  }
}

export function serializePlayerLayout(state: PlayerLayoutState): string {
  return JSON.stringify({
    mode: parsePlayerLayoutMode(state.mode),
    position:
      state.position && isFiniteNumber(state.position.x) && isFiniteNumber(state.position.y)
        ? { x: Math.round(state.position.x), y: Math.round(state.position.y) }
        : null
  })
}
