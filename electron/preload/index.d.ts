import type { ElectronAPI } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
