/**
 * 浮层动态层级
 * Teleport 到 body 的下拉/气泡若使用固定层级，遇到层级更高的弹窗会被遮挡；
 * 这里让浮层在打开时取一个单调递增的层级，后打开者始终在上。
 */

import { getCurrentInstance, onBeforeUnmount, ref, type Ref } from 'vue'

// 基准值需高于弹窗层与主题令牌（最高 --z-app-loader: 9000）
const DEFAULT_Z_INDEX = 10000

let currentZIndex = DEFAULT_Z_INDEX
// 打开中的浮层数量，全部关闭后回收层级计数
let activeCount = 0

/** 取下一个层级：后开启的浮层始终压在前一个之上 */
export const nextZIndex = (): number => {
  activeCount += 1
  currentZIndex += 1
  return currentZIndex
}

const releaseZIndex = () => {
  activeCount = Math.max(0, activeCount - 1)
  if (activeCount === 0) currentZIndex = DEFAULT_Z_INDEX
}

/**
 * 浮层层级控制
 * @param customZIndex 指定固定层级时不做动态分配
 * @returns zIndex 供绑定；onOpenChange 在浮层开合时调用
 */
export const usePopupZIndex = (customZIndex?: Ref<number | undefined> | number) => {
  const resolveFixed = () =>
    typeof customZIndex === 'number' ? customZIndex : customZIndex?.value

  const zIndex = ref(resolveFixed() ?? DEFAULT_Z_INDEX)
  let acquired = false

  const onOpenChange = (open: boolean) => {
    const fixed = resolveFixed()
    if (fixed !== undefined) {
      zIndex.value = fixed
      return
    }

    if (open) {
      if (!acquired) {
        acquired = true
        zIndex.value = nextZIndex()
      }
      return
    }

    if (acquired) {
      acquired = false
      releaseZIndex()
    }
  }

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      if (acquired) {
        acquired = false
        releaseZIndex()
      }
    })
  }

  return { zIndex, onOpenChange }
}
