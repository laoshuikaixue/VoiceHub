// Desktop client entry point
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)

// 检测桌面环境
if (window.electron) {
  console.log('[Desktop] Running in Electron environment')
  console.log('[Desktop] Platform:', window.electron.platform)
}

app.mount('#app')
