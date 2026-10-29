export const MODAL_MOBILE_MODES = ['fullscreen', 'bottomsheet', 'dialog'] as const
export type ModalMobileMode = (typeof MODAL_MOBILE_MODES)[number]

export const MODAL_MOBILE_MODE_KEY = 'voicehub-modal-mobile-mode'

export const isModalMobileMode = (value: unknown): value is ModalMobileMode =>
  typeof value === 'string' && (MODAL_MOBILE_MODES as readonly string[]).includes(value)

export const readStoredModalMobileMode = (): ModalMobileMode | null => {
  try {
    const value = window.localStorage.getItem(MODAL_MOBILE_MODE_KEY)
    return isModalMobileMode(value) ? value : null
  } catch {
    return null
  }
}

export const saveModalMobileMode = (mode: ModalMobileMode) => {
  try {
    window.localStorage.setItem(MODAL_MOBILE_MODE_KEY, mode)
  } catch {
    // localStorage 不可用时忽略
  }
}

/** 允许用 ?modalMode=bottomsheet 临时切换并持久化，方便手动对比 */
export const syncModalMobileModeFromQuery = () => {
  try {
    const value = new URLSearchParams(window.location.search).get('modalMode')
    if (isModalMobileMode(value)) saveModalMobileMode(value)
  } catch {
    // 忽略异常
  }
}
