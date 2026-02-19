// 全局类型声明文件

interface Window {
  $showNotification: (message: string, type?: 'success' | 'error' | 'info') => void
}
