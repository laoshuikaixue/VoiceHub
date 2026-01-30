<template>
  <div class="notification-settings">
    <h2 class="settings-title">通知设置</h2>

    <div v-if="loading" class="settings-loading">
      加载中...
    </div>

    <div v-else-if="error" class="settings-error">
      {{ error }}
      <button class="retry-button" @click="fetchSettings">重试</button>
    </div>

    <div v-else class="settings-form">
      <div class="form-group">
        <label class="toggle-label">
          <span class="label-text">歌曲被选中通知</span>
          <div class="toggle-switch">
            <input
                v-model="localSettings.songSelectedNotify"
                type="checkbox"
                @change="saveSettings"
            />
            <span class="toggle-slider"></span>
          </div>
        </label>
        <p class="setting-description">当您投稿的歌曲被选中安排播放时通知您</p>
      </div>

      <div class="form-group">
        <label class="toggle-label">
          <span class="label-text">歌曲已播放通知</span>
          <div class="toggle-switch">
            <input
                v-model="localSettings.songPlayedNotify"
                type="checkbox"
                @change="saveSettings"
            />
            <span class="toggle-slider"></span>
          </div>
        </label>
        <p class="setting-description">当您投稿的歌曲被播放时通知您</p>
      </div>

      <div class="form-group">
        <label class="toggle-label">
          <span class="label-text">歌曲获得投票通知</span>
          <div class="toggle-switch">
            <input
                v-model="localSettings.songVotedNotify"
                type="checkbox"
                @change="saveSettings"
            />
            <span class="toggle-slider"></span>
          </div>
        </label>
        <p class="setting-description">当您投稿的歌曲获得新投票时通知您</p>

        <div v-if="localSettings.songVotedNotify" class="sub-setting">
          <label class="range-label">
            <span>投票阈值：每获得 {{ localSettings.songVotedThreshold }} 票通知一次</span>
            <input
                v-model="localSettings.songVotedThreshold"
                class="range-slider"
                max="10"
                min="1"
                step="1"
                type="range"
                @change="saveSettings"
            />
            <div class="range-values">
              <span>1</span>
              <span>10</span>
            </div>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="toggle-label">
          <span class="label-text">系统通知</span>
          <div class="toggle-switch">
            <input
                v-model="localSettings.systemNotify"
                type="checkbox"
                @change="saveSettings"
            />
            <span class="toggle-slider"></span>
          </div>
        </label>
        <p class="setting-description">接收系统公告和其他重要通知</p>
      </div>

      <div class="form-group">
        <label class="range-label">
          <span class="label-text">通知刷新间隔</span>
          <span class="range-value">{{ formatRefreshInterval(localSettings.refreshInterval) }}</span>
        </label>
        <input
            v-model="localSettings.refreshInterval"
            class="range-slider"
            max="300"
            min="10"
            step="10"
            type="range"
            @change="saveSettings"
        />
        <div class="range-values">
          <span>10秒</span>
          <span>5分钟</span>
        </div>
        <p class="setting-description">设置通知自动刷新的时间间隔</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import {computed, onMounted, ref, watch} from 'vue'
import {useNotifications} from '~/composables/useNotifications'

const notificationsService = useNotifications()
const loading = computed(() => notificationsService.loading.value)
const error = computed(() => notificationsService.error.value)
const settings = computed(() => notificationsService.settings.value)

// 本地设置，用于双向绑定
const localSettings = ref({
  songSelectedNotify: true,
  songPlayedNotify: true,
  songVotedNotify: true,
  songVotedThreshold: 1,
  systemNotify: true,
  refreshInterval: 60
})

// 监听设置变化
watch(settings, (newSettings) => {
  if (newSettings) {
    localSettings.value = {
      songSelectedNotify: newSettings.songSelectedNotify,
      songPlayedNotify: newSettings.songPlayedNotify,
      songVotedNotify: newSettings.songVotedNotify,
      songVotedThreshold: newSettings.songVotedThreshold || 1,
      systemNotify: newSettings.systemNotify,
      refreshInterval: newSettings.refreshInterval || 60
    }
  }
}, {immediate: true})

// 初始化
onMounted(async () => {
  await fetchSettings()
})

// 获取设置
const fetchSettings = async () => {
  await notificationsService.fetchNotificationSettings()
}

// 保存设置
const saveSettings = async () => {
  await notificationsService.updateNotificationSettings(localSettings.value)
}

// 格式化刷新间隔
const formatRefreshInterval = (seconds) => {
  if (seconds < 60) {
    return `${seconds}秒`
  } else {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0
        ? `${minutes}分${remainingSeconds}秒`
        : `${minutes}分钟`
  }
}
</script>

<style scoped>
.notification-settings {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.settings-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 20px;
  text-align: center;
  color: var(--light);
}

.settings-loading,
.settings-error {
  padding: 20px;
  text-align: center;
  color: var(--gray);
}

.settings-error {
  color: var(--danger);
}

.retry-button {
  background: transparent;
  border: 1px solid var(--danger);
  color: var(--danger);
  padding: 5px 10px;
  border-radius: 4px;
  margin-left: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-button:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

.form-group {
  margin-bottom: 20px;
  padding: 15px;
  border-radius: 8px;
  background-color: rgba(30, 41, 59, 0.6);
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.form-group:hover {
  background-color: rgba(30, 41, 59, 0.8);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.toggle-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.label-text {
  font-weight: 500;
  font-size: 16px;
  color: var(--light);
}

.setting-description {
  margin-top: 8px;
  font-size: 14px;
  color: var(--gray);
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.2);
  transition: .4s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: var(--primary);
}

input:focus + .toggle-slider {
  box-shadow: 0 0 1px var(--primary);
}

input:checked + .toggle-slider:before {
  transform: translateX(26px);
}

.sub-setting {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.range-label {
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
}

.range-value {
  margin-left: auto;
  font-size: 14px;
  color: var(--primary);
  font-weight: 500;
}

.range-slider {
  width: 100%;
  margin-top: 10px;
  -webkit-appearance: none;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.range-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.range-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.range-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
}

.range-values {
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
  font-size: 12px;
  color: var(--gray);
}

/* 暗色模式 */
@media (prefers-color-scheme: dark) {
  .form-group {
    background-color: #2a2a2a;
  }

  .form-group:hover {
    background-color: #333;
  }

  .setting-description {
    color: #aaa;
  }

  .toggle-slider {
    background-color: #555;
  }

  .toggle-slider:before {
    background-color: #ddd;
  }

  input:checked + .toggle-slider {
    background-color: #64b5f6;
  }

  input:focus + .toggle-slider {
    box-shadow: 0 0 1px #64b5f6;
  }

  .range-slider {
    background: #555;
  }

  .range-slider::-webkit-slider-thumb {
    background: #64b5f6;
  }

  .range-slider::-moz-range-thumb {
    background: #64b5f6;
  }
}
</style> 