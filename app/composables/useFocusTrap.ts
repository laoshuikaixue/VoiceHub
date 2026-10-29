import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

interface FocusTrapOptions {
  onEscape?: () => void
  lockScroll?: boolean
}

/** 将焦点限制在容器内，关闭时恢复到触发元素 */
export function useFocusTrap(
  containerRef: Ref<HTMLElement | null>,
  active: Ref<boolean>,
  options: FocusTrapOptions = {}
) {
  let previousFocus: HTMLElement | null = null
  let previousOverflow = ''
  let started = false
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null

  const stop = () => {
    if (!started || typeof document === 'undefined') return
    started = false
    if (keydownHandler) document.removeEventListener('keydown', keydownHandler)
    keydownHandler = null
    if (options.lockScroll !== false) document.body.style.overflow = previousOverflow
    if (previousFocus && previousFocus.isConnected) previousFocus.focus()
    previousFocus = null
  }

  const start = async () => {
    if (started || import.meta.server) return
    started = true
    previousFocus = document.activeElement as HTMLElement | null
    if (options.lockScroll !== false) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    await nextTick()
    const container = containerRef.value
    if (!container) return
    const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) || container
    first.focus()

    keydownHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        options.onEscape?.()
        return
      }
      if (event.key !== 'Tab') return
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (focusables.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const firstEl = focusables[0]!
      const lastEl = focusables[focusables.length - 1]!
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault()
        lastEl.focus()
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', keydownHandler)
  }

  watch(active, (isActive) => (isActive ? start() : stop()), { immediate: true })
  onBeforeUnmount(stop)
}
