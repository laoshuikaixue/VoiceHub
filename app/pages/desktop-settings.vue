<template>
  <div class="desktop-settings-page">
    <div class="settings-container">
      <h1 class="settings-title">桌面客户端设置</h1>

      <!-- API服务器配置 -->
      <section class="settings-section">
        <h2 class="section-title">服务器配置</h2>
        <div class="setting-item">
          <label for="api-url">VoiceHub 服务器地址</label>
          <div class="input-group">
            <input
              id="api-url"
              v-model="apiUrl"
              type="text"
              placeholder="http://localhost:3000"
              class="input-field"
            />
            <button @click="saveApiUrl" class="btn-primary">保存</button>
            <button @click="testConnection" class="btn-secondary">测试连接</button>
          </div>
          <p class="hint">输入您的 VoiceHub 服务器地址，例如：http://192.168.1.100:3000</p>
          <p v-if="connectionStatus" :class="['status-message', connectionStatus.type]">
            {{ connectionStatus.message }}
          </p>
        </div>
      </section>

      <!-- 应用偏好设置 -->
      <section class="settings-section">
        <h2 class="section-title">应用偏好</h2>
        
        <div class="setting-item">
          <label class="checkbox-label">
            <input v-model="preferences.autoStart" type="checkbox" />
            <span>开机自动启动</span>
          </label>
          <p class="hint-small">系统启动时自动运行 VoiceHub 桌面客户端</p>
        </div>

        <div class="setting-item">
          <label class="checkbox-label">
            <input v-model="preferences.minimizeToTray" type="checkbox" />
            <span>最小化到系统托盘</span>
          </label>
          <p class="hint-small">最小化时隐藏到托盘而非任务栏</p>
        </div>

        <div class="setting-item">
          <label class="checkbox-label">
            <input v-model="preferences.closeToTray" type="checkbox" />
            <span>关闭时最小化到托盘（而非退出）</span>
          </label>
          <p class="hint-small">点击关闭按钮时最小化而非退出应用</p>
        </div>

        <button @click="savePreferences" class="btn-primary">保存偏好设置</button>
      </section>

      <!-- 桌面歌词设置 -->
      <section class="settings-section">
        <h2 class="section-title">桌面歌词</h2>
        
        <div class="setting-item">
          <label class="checkbox-label">
            <input v-model="preferences.showDesktopLyric" type="checkbox" @change="toggleDesktopLyric" />
            <span>显示桌面歌词</span>
          </label>
          <p class="hint-small">在桌面上显示当前播放歌曲的歌词</p>
        </div>

        <div class="setting-item">
          <label for="lyric-size">桌面歌词字体大小</label>
          <input
            id="lyric-size"
            v-model.number="preferences.lyricFontSize"
            type="range"
            min="24"
            max="72"
            class="slider"
          />
          <span class="value-display">{{ preferences.lyricFontSize }}px</span>
        </div>

        <div class="setting-item">
          <label for="lyric-opacity">桌面歌词透明度</label>
          <input
            id="lyric-opacity"
            v-model.number="preferences.lyricOpacity"
            type="range"
            min="0.3"
            max="1"
            step="0.1"
            class="slider"
          />
          <span class="value-display">{{ Math.round(preferences.lyricOpacity * 100) }}%</span>
        </div>

        <button @click="savePreferences" class="btn-primary">保存歌词设置</button>
      </section>

      <!-- 定时播放设置 -->
      <section class="settings-section">
        <h2 class="section-title">定时播放</h2>
        
        <div class="setting-item">
          <label class="checkbox-label">
            <input v-model="preferences.enableScheduledPlay" type="checkbox" />
            <span>启用定时播放</span>
          </label>
          <p class="hint-small">根据排期表自动播放歌曲（适用于广播站无人值守场景）</p>
        </div>

        <div class="setting-item">
          <label class="checkbox-label">
            <input v-model="preferences.autoSyncSchedule" type="checkbox" />
            <span>自动同步排期表</span>
          </label>
          <p class="hint-small">每小时自动从服务器同步最新排期表</p>
        </div>

        <div class="setting-item">
          <button @click="syncScheduleNow" class="btn-secondary">立即同步排期表</button>
          <p v-if="lastSyncTime" class="hint-small">上次同步: {{ lastSyncTime }}</p>
        </div>

        <button @click="savePreferences" class="btn-primary">保存定时设置</button>
      </section>

      <!-- 系统信息 -->
      <section class="settings-section">
        <h2 class="section-title">系统信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">平台：</span>
            <span class="info-value">{{ platform }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">版本：</span>
            <span class="info-value">1.0.0</span>
          </div>
          <div class="info-item">
            <span class="info-label">配置文件：</span>
            <span class="info-value config-path">{{ configPath }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const { apiBaseUrl, setApiUrl, getPreferences, setPreferences: savePrefs } = useDesktopAPI()

const apiUrl = ref('')
const platform = ref('Unknown')
const configPath = ref('')
const connectionStatus = ref<{ type: string; message: string } | null>(null)
const lastSyncTime = ref('')

const preferences = ref({
  autoStart: false,
  minimizeToTray: true,
  closeToTray: true,
  showDesktopLyric: false,
  lyricFontSize: 48,
  lyricOpacity: 0.9,
  enableScheduledPlay: false,
  autoSyncSchedule: true
})

onMounted(async () => {
  // 加载当前API地址
  apiUrl.value = apiBaseUrl.value

  // 加载平台信息
  if (window.electron) {
    platform.value = window.electron.platform
    
    // 获取配置文件路径
    const path = await window.electron.getConfigPath?.()
    if (path) {
      configPath.value = path
    }
  }

  // 加载用户偏好
  const prefs = await getPreferences()
  if (prefs) {
    preferences.value = { ...preferences.value, ...prefs }
  }

  // 加载上次同步时间
  loadLastSyncTime()
})

const saveApiUrl = async () => {
  const result = await setApiUrl(apiUrl.value)
  if (result?.success) {
    connectionStatus.value = {
      type: 'success',
      message: '✓ API地址保存成功！'
    }
    setTimeout(() => {
      connectionStatus.value = null
    }, 3000)
  } else {
    connectionStatus.value = {
      type: 'error',
      message: '✗ 保存失败，请重试'
    }
  }
}

const testConnection = async () => {
  connectionStatus.value = {
    type: 'info',
    message: '正在测试连接...'
  }
  
  try {
    const response = await fetch(`${apiUrl.value}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      connectionStatus.value = {
        type: 'success',
        message: '✓ 连接成功！服务器响应正常'
      }
    } else {
      connectionStatus.value = {
        type: 'error',
        message: `✗ 连接失败：HTTP ${response.status}`
      }
    }
  } catch (error) {
    connectionStatus.value = {
      type: 'error',
      message: '✗ 连接失败：无法访问服务器'
    }
  }
}

const savePreferences = async () => {
  const result = await savePrefs(preferences.value)
  if (result?.success) {
    alert('设置保存成功！')
  } else {
    alert('保存失败，请重试')
  }
}

const toggleDesktopLyric = async () => {
  if (window.electron?.toggleDesktopLyric) {
    await window.electron.toggleDesktopLyric(preferences.value.showDesktopLyric)
  }
}

const syncScheduleNow = async () => {
  if (window.electron?.syncSchedule) {
    const result = await window.electron.syncSchedule()
    if (result?.success) {
      lastSyncTime.value = new Date().toLocaleString('zh-CN')
      
      // 重新加载任务
      await window.electron.reloadSchedules?.()
      
      alert('排期表同步成功！')
    } else {
      alert('同步失败：' + (result?.error || '未知错误'))
    }
  }
}

const loadLastSyncTime = async () => {
  if (window.electron?.getLastSyncTime) {
    const time = await window.electron.getLastSyncTime()
    if (time) {
      lastSyncTime.value = new Date(time).toLocaleString('zh-CN')
    }
  }
}
</script>

<style scoped>
.desktop-settings-page {
  min-height: 100vh;
  background: var(--bg-primary);
  padding: 2rem;
}

.settings-container {
  max-width: 900px;
  margin: 0 auto;
}

.settings-title {
  font-size: 2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2rem;
}

.settings-section {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border-color);
}

.setting-item {
  margin-bottom: 1.5rem;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-item label {
  display: block;
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.input-group {
  display: flex;
  gap: 0.5rem;
}

.input-field {
  flex: 1;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.input-field:focus {
  outline: none;
  border-color: var(--primary-color);
}

.btn-primary, .btn-secondary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
  font-size: 0.95rem;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-primary:hover, .btn-secondary:hover {
  opacity: 0.9;
}

.hint {
  font-size: 0.85rem;
  color: var(--text-tertiary);
  margin-top: 0.5rem;
}

.hint-small {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin-top: 0.25rem;
  margin-left: 1.75rem;
}

.status-message {
  font-size: 0.9rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
}

.status-message.success {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.status-message.error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.status-message.info {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.checkbox-label input[type='checkbox'] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-label span {
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 500;
}

.slider {
  width: 100%;
  margin: 0.5rem 0;
}

.value-display {
  display: inline-block;
  margin-left: 1rem;
  color: var(--text-secondary);
  font-weight: 500;
  min-width: 60px;
}

.info-grid {
  display: grid;
  gap: 1rem;
}

.info-item {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}

.info-label {
  color: var(--text-secondary);
  font-weight: 500;
  min-width: 80px;
}

.info-value {
  color: var(--text-primary);
  word-break: break-all;
}

.config-path {
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
}
</style>
