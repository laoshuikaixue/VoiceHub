<template>
  <div class="home">
    <!-- 添加顶部Ellipse 1效果 -->
    <div class="ellipse-effect"></div>
    
    <div class="main-content">
      <!-- 顶部区域：Logo和用户信息 -->
      <div class="top-bar">
        <div class="logo-section">
          <NuxtLink to="/" class="logo-link">
            <img src="/images/logo.svg" alt="VoiceHub Logo" class="logo-image" />
          </NuxtLink>
        </div>

        <!-- 用户信息区域修改 -->
        <div class="user-section">
          <ClientOnly>
            <div v-if="isClientAuthenticated" class="user-info">
              <div class="user-details">
                <h3 class="user-name">你好，{{ user?.name || '游客' }}</h3>
                <p v-if="user?.grade || user?.class" class="user-class">
                  {{ user.grade }} {{ user.class }}
                </p>
                <p v-else-if="isAdmin" class="user-class">
                  管理员
                </p>
              </div>

              <div class="user-actions">
                <!-- 删除通知铃铛按钮 -->
                <button @click="handleLogout" class="action-button logout-button">
                  <span class="logout-text">退出登录</span>
                </button>
                <NuxtLink v-if="isAdmin" to="/dashboard" class="action-button dashboard-button">
                  管理后台
                </NuxtLink>
                <NuxtLink v-else to="/change-password" class="action-button password-button">
                  修改密码
                </NuxtLink>
              </div>
            </div>

            <div v-else class="login-options">
              <NuxtLink to="/login" class="btn btn-outline no-underline">登录</NuxtLink>
            </div>
          </ClientOnly>
        </div>
      </div>

      <div class="site-title">
        <h2>{{ config.public.siteTitle || 'VoiceHub示例站' }}</h2>
      </div>

      <!-- 中间主体内容区域 -->
      <div class="content-area">
        <!-- 选项卡区域 - 添加ripple指令 -->
        <div class="tabs-row">
          <div class="section-tab" 
               :class="{ 'active': activeTab === 'schedule' }" 
               @click="handleTabClick('schedule')"
               v-ripple>
            播出排期
          </div>
          <div class="section-tab" 
               :class="{ 'active': activeTab === 'songs' }" 
               @click="handleTabClick('songs')"
               v-ripple>
            歌曲列表
          </div>
          <div class="section-tab" 
               :class="{ 'active': activeTab === 'request' }" 
               @click="handleTabClick('request')"
               v-ripple>
            投稿歌曲
          </div>
          <div class="section-tab" 
               :class="{ 'active': activeTab === 'notification', 'disabled': !isClientAuthenticated }" 
               @click="isClientAuthenticated ? handleTabClick('notification') : showLoginNotice()"
               v-ripple>
            通知
            <span v-if="isClientAuthenticated && hasUnreadNotifications" class="notification-badge-tab"></span>
          </div>
        </div>

        <!-- 内容区域 -->
        <div class="tab-content-container">
          <!-- 使用Transition组件包裹每个tab-pane -->
          <Transition name="tab-fade" mode="out-in">
            <!-- 播出排期内容 -->
            <div v-if="activeTab === 'schedule'" class="tab-pane schedule-tab-pane" key="schedule">
              <ClientOnly class="full-width">
                <ScheduleList
                  :schedules="publicSchedules"
                  :loading="loading"
                  :error="error"
                />
              </ClientOnly>
            </div>
            
            <!-- 歌曲列表内容 -->
            <div v-else-if="activeTab === 'songs'" class="tab-pane" key="songs">
              <div class="song-list-container">
                <ClientOnly>
                  <SongList
                    :songs="filteredSongs"
                    :loading="loading"
                    :error="error"
                    :isAdmin="isAdmin"
                    @vote="handleVote"
                    @withdraw="handleWithdraw"
                    @refresh="refreshSongs"
                  />
                </ClientOnly>
              </div>
            </div>
            
            <!-- 投稿歌曲内容 -->
            <div v-else-if="activeTab === 'request'" class="tab-pane request-pane" key="request">
              <RequestForm
                :loading="loading"
                @request="handleRequest"
                @vote="handleVote"
              />
            </div>
            
            <!-- 通知内容 -->
            <div v-else-if="activeTab === 'notification'" class="tab-pane notification-pane" key="notification">
              <div v-if="!isClientAuthenticated" class="login-required-container">
                <div class="login-required-content">
                  <div class="login-icon">🔒</div>
                  <h3>需要登录</h3>
                  <p>您需要登录才能查看通知</p>
                  <button @click="navigateToLogin" class="login-button">
                    立即登录
                  </button>
                </div>
              </div>
              <div v-else class="notification-container">
                <!-- 标题和设置按钮 -->
                <div class="notification-header">
                  <h2 class="notification-title">通知中心</h2>
                  <button @click="toggleNotificationSettings" class="settings-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                  </button>
                </div>

                <!-- 设置面板 -->
                <div v-if="showNotificationSettings" class="notification-settings-panel">
                  <div class="settings-panel-content">
                    <h3 class="settings-panel-title">通知设置</h3>
                    
                    <div class="settings-form">
                      <div class="form-group">
                        <label class="toggle-label">
                          <span class="label-text">歌曲被选中通知</span>
                          <div class="toggle-switch">
                            <input 
                              type="checkbox" 
                              v-model="notificationSettings.songSelectedNotify"
                              @change="saveNotificationSettings"
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
                              type="checkbox" 
                              v-model="notificationSettings.songPlayedNotify"
                              @change="saveNotificationSettings"
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
                              type="checkbox" 
                              v-model="notificationSettings.songVotedNotify"
                              @change="saveNotificationSettings"
                            />
                            <span class="toggle-slider"></span>
                          </div>
                        </label>
                        <p class="setting-description">当您投稿的歌曲获得新投票时通知您</p>
                        
                        <div v-if="notificationSettings.songVotedNotify" class="sub-setting">
                          <label class="range-label">
                            <span>投票阈值：每获得 {{ notificationSettings.songVotedThreshold }} 票通知一次</span>
                            <input 
                              type="range" 
                              v-model="notificationSettings.songVotedThreshold" 
                              min="1" 
                              max="10" 
                              step="1"
                              @change="saveNotificationSettings"
                              class="range-slider"
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
                              type="checkbox" 
                              v-model="notificationSettings.systemNotify"
                              @change="saveNotificationSettings"
                            />
                            <span class="toggle-slider"></span>
                          </div>
                        </label>
                        <p class="setting-description">接收系统公告和其他重要通知</p>
                      </div>
                      
                      <div class="form-group">
                        <label class="range-label">
                          <span class="label-text">通知刷新间隔</span>
                          <span class="range-value">{{ formatRefreshInterval(notificationSettings.refreshInterval) }}</span>
                        </label>
                        <input 
                          type="range" 
                          v-model="notificationSettings.refreshInterval" 
                          min="10" 
                          max="300" 
                          step="10"
                          @change="saveNotificationSettings"
                          class="range-slider"
                        />
                        <div class="range-values">
                          <span>10秒</span>
                          <span>5分钟</span>
                        </div>
                        <p class="setting-description">设置通知自动刷新的时间间隔</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 通知列表 -->
                <div class="notification-list">
                  <div v-if="notificationsLoading" class="loading-indicator">
                    <div class="loading-spinner"></div>
                    <span>加载中...</span>
                  </div>
                  
                  <div v-else-if="userNotifications.length === 0" class="empty-notification">
                    <div class="empty-icon">📭</div>
                    <p>暂无通知</p>
                  </div>
                  
                  <div v-else class="notification-items">
                    <div 
                      v-for="notification in userNotifications" 
                      :key="notification.id"
                      class="notification-card"
                      :class="{ 'unread': !notification.read }"
                      @click="viewNotification(notification)"
                    >
                      <div class="notification-card-header">
                        <div class="notification-icon-type">
                          <span v-if="notification.type === 'SONG_SELECTED'">🎯</span>
                          <span v-else-if="notification.type === 'SONG_PLAYED'">🎵</span>
                          <span v-else-if="notification.type === 'SONG_VOTED'">👍</span>
                          <span v-else>📢</span>
                        </div>
                        <div class="notification-title-row">
                          <div class="notification-title">
                            <span v-if="notification.type === 'SONG_SELECTED'">歌曲已选中</span>
                            <span v-else-if="notification.type === 'SONG_PLAYED'">歌曲已播放</span>
                            <span v-else-if="notification.type === 'SONG_VOTED'">收到新投票</span>
                            <span v-else>系统通知</span>
                            <span v-if="!notification.read" class="unread-indicator"></span>
                          </div>
                          <div class="notification-time">{{ formatNotificationTime(notification.createdAt) }}</div>
                        </div>
                      </div>
                      <div class="notification-card-body">
                        <div class="notification-text">{{ notification.message }}</div>
                      </div>
                      <div class="notification-card-actions">
                        <button 
                          @click.stop="deleteNotification(notification.id)" 
                          class="action-button delete"
                          title="删除"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                          <span>删除</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 底部操作按钮 -->
                <div v-if="userNotifications.length > 0" class="notification-actions-bar">
                  <button 
                    v-if="hasUnreadNotifications" 
                    @click="markAllNotificationsAsRead" 
                    class="action-button-large"
                  >
                    全部标记为已读
                  </button>
                  <button 
                    @click="clearAllNotifications" 
                    class="action-button-large danger"
                  >
                    清空所有通知
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- 规则弹窗 -->
    <Teleport to="body">
      <Transition name="modal-animation">
    <div v-if="showRules" class="modal-overlay" @click.self="showRules = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="text-xl font-bold">点歌规则</h2>
          <button @click="showRules = false" class="close-button">×</button>
        </div>

        <div class="modal-body">
          <div class="rules-content">
            <h3 class="font-bold mb-2">投稿须知</h3>
            <ul class="list-disc pl-5 mb-4">
              <li>投稿时无需加入书名号</li>
              <li>除DJ外 其他类型歌曲均接收（包含日语 韩语等小语种）</li>
              <li>禁止投递含有违规内容的歌曲</li>
              <li>点播的歌曲将由管理员进行审核</li>
              <li>审核通过后将安排在播放时段播出</li>
            </ul>

            <h3 class="font-bold mb-2">播放时间</h3>
            <p>每天夜自修静班前</p>
          </div>
        </div>
      </div>
    </div>
      </Transition>
    </Teleport>

    <!-- 关于我们弹窗 -->
    <Teleport to="body">
      <Transition name="modal-animation">
    <div v-if="showAbout" class="modal-overlay" @click.self="showAbout = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="text-xl font-bold">关于我们</h2>
          <button @click="showAbout = false" class="close-button">×</button>
        </div>

        <div class="modal-body">
          <div class="about-content">
            <h3 class="font-bold mb-2">关于{{ config.public.siteTitle || 'VoiceHub' }}</h3>
            <p class="mb-4">VoiceHub是由LaoShui开发，计划服务于舟山市六横中学的点歌系统。</p>

            <h3 class="font-bold mb-2">联系方式</h3>
            <p>邮箱：contact@lao-shui.top</p>
            <br>
            <p>Powered by LaoShui @ 2025 | All Rights Reserved.</p>
            <p>项目开源地址：<a href="https://github.com/laoshuikaixue/VoiceHub" target="_blank" class="github-link">
  <span class="github-icon">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  </span>
  GitHub
</a></p>
          </div>
        </div>
      </div>
    </div>
      </Transition>
    </Teleport>

    <!-- 通知组件 -->
    <Transition-group
      tag="div"
      name="notification"
      class="notifications-container"
    >
      <div
        v-for="(notif, index) in notifications"
        :key="notif.id"
        class="notification"
        :class="notif.type"
      >
        <div class="notification-content">{{ notif.message }}</div>
      </div>
    </Transition-group>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import ScheduleList from '~/components/Songs/ScheduleList.vue'
import SongList from '~/components/Songs/SongList.vue'
import RequestForm from '~/components/Songs/RequestForm.vue'
import { useNotifications } from '~/composables/useNotifications'

// 获取运行时配置
const config = useRuntimeConfig()
const router = useRouter()

// 服务器端安全的认证状态管理
const isClientAuthenticated = ref(false)
const isAdmin = ref(false)
const user = ref(null)
let auth = null
let songs = null
let notificationsService = null
const unreadNotificationCount = ref(0)

// 模拟数据初始值
const songCount = ref(0)
const scheduleCount = ref(0)
const isRequestOpen = ref(true)

// 弹窗状态
const showRequestModal = ref(false)
const showRules = ref(false)
const showAbout = ref(false)

// 标签页状态
const activeTab = ref('schedule') // 默认显示播出排期

// 通知系统
const notifications = ref([])
let notificationId = 0
let refreshInterval = null

// 添加通知相关变量
const userNotifications = computed(() => notificationsService.notifications.value || [])
const notificationsLoading = computed(() => notificationsService.loading.value)
const hasUnreadNotifications = computed(() => notificationsService.unreadCount.value > 0)
const showNotificationSettings = ref(false)
// 修改通知设置变量
const notificationSettings = ref({
  songSelectedNotify: true,
  songPlayedNotify: true,
  songVotedNotify: true,
  songVotedThreshold: 1,
  systemNotify: true,
  refreshInterval: 60
})

// 切换通知设置面板
const toggleNotificationSettings = () => {
  showNotificationSettings.value = !showNotificationSettings.value
  if (showNotificationSettings.value) {
    fetchNotificationSettings()
  }
}

// 获取通知设置
const fetchNotificationSettings = async () => {
  await notificationsService.fetchNotificationSettings()
  if (notificationsService.settings.value) {
    notificationSettings.value = {
      songSelectedNotify: notificationsService.settings.value.songSelectedNotify,
      songPlayedNotify: notificationsService.settings.value.songPlayedNotify,
      songVotedNotify: notificationsService.settings.value.songVotedNotify,
      songVotedThreshold: notificationsService.settings.value.songVotedThreshold || 1,
      systemNotify: notificationsService.settings.value.systemNotify,
      refreshInterval: notificationsService.settings.value.refreshInterval || 60
    }
  }
}

// 保存通知设置
const saveNotificationSettings = async () => {
  await notificationsService.updateNotificationSettings(notificationSettings.value)
}

// 加载通知
const loadNotifications = async () => {
  if (isClientAuthenticated.value) {
    await notificationsService.fetchNotifications()
  }
}

// 标记通知为已读
const markNotificationAsRead = async (id) => {
  await notificationsService.markAsRead(id)
}

// 标记所有通知为已读
const markAllNotificationsAsRead = async () => {
  await notificationsService.markAllAsRead()
}

// 删除通知
const deleteNotification = async (id) => {
  if (confirm('确定要删除此通知吗？')) {
    await notificationsService.deleteNotification(id)
  }
}

// 清空所有通知
const clearAllNotifications = async () => {
  if (confirm('确定要清空所有通知吗？此操作不可撤销。')) {
    await notificationsService.clearAllNotifications()
  }
}

// 格式化通知时间
const formatNotificationTime = (timeString) => {
  const date = new Date(timeString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  // 小于1分钟
  if (diff < 60000) {
    return '刚刚'
  }
  
  // 小于1小时
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`
  }
  
  // 小于24小时
  if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`
  }
  
  // 小于30天
  if (diff < 2592000000) {
    return `${Math.floor(diff / 86400000)}天前`
  }
  
  // 大于30天，显示具体日期
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

// 监听标签页切换，如果切换到通知标签页，加载通知
watch(activeTab, (newTab) => {
  if (newTab === 'notification') {
    loadNotifications()
  }
})

// 初始化时如果已经在通知页面，则加载通知
onMounted(() => {
  if (activeTab.value === 'notification') {
    loadNotifications()
  }
})

// 获取当前日期和星期
const getCurrentDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekDay = weekDays[now.getDay()];
  
  return `${year}年${month}月${date}日 周${weekDay}`;
}

// 显示通知
const showNotification = (message, type = 'info') => {
  const id = notificationId++
  notifications.value.push({ id, message, type })

  // 3秒后自动关闭
  setTimeout(() => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
  }, 3000)
}

// 更新歌曲数量统计
const updateSongCounts = async () => {
  try {
    // 更新排期歌曲数量
    const schedules = songs?.publicSchedules?.value || []
    scheduleCount.value = schedules.length

    // 更新总歌曲数量
    if (isClientAuthenticated.value && songs?.songs?.value) {
      // 已登录用户：使用完整歌曲列表
      songCount.value = songs.songs.value.length
    } else {
      // 未登录用户：从公共API获取歌曲总数
      try {
        const response = await fetch('/api/songs/count')
        const data = await response.json()
        songCount.value = data.count
      } catch (err) {
        console.error('获取歌曲总数失败', err)
        songCount.value = 0
      }
    }
  } catch (e) {
    console.error('更新歌曲统计失败', e)
  }
}

// 初始加载歌曲总数（无论是否登录）
const loadSongCount = async () => {
  try {
    const response = await fetch('/api/songs/count')
    const data = await response.json()
    songCount.value = data.count
  } catch (err) {
    console.error('获取歌曲总数失败', err)
  }
}

// 在组件挂载后初始化认证和歌曲（只会在客户端执行）
onMounted(async () => {
  auth = useAuth()
  isClientAuthenticated.value = auth.isAuthenticated.value
  isAdmin.value = auth.isAdmin.value
  user.value = auth.user.value

  // 初始化歌曲服务
  songs = useSongs()
  notificationsService = useNotifications()

  // 无论是否登录都获取歌曲总数
  await loadSongCount()

  // 无论是否登录都获取公共数据
  await songs.fetchPublicSchedules()

  // 如果用户已登录，获取完整歌曲列表
  if (isClientAuthenticated.value) {
    await songs.fetchSongs()
  }

  // 更新真实数据
  await updateSongCounts()

  // 设置定时刷新（每60秒静默刷新一次数据）
  refreshInterval = setInterval(async () => {
    if (isClientAuthenticated.value) {
      // 使用静默刷新，不显示加载状态
      await songs.refreshSongsSilent()
    } else {
      // 使用静默刷新，不显示加载状态
      await songs.refreshSchedulesSilent()
    }
    await updateSongCounts()
    // 移除通知数量更新
  }, 60000)

  // 监听通知
  if (songs.notification && songs.notification.value) {
    watch(songs.notification, (newVal) => {
      if (newVal.show) {
        showNotification(newVal.message, newVal.type)
      }
    })
  }
})

// 组件卸载时清除定时器
onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})

// 实时计算歌曲总数
const realSongCount = computed(() => {
  return songs?.visibleSongs?.value?.length || 0
})

// 使用计算属性安全地访问数据
const publicSchedules = computed(() => songs?.publicSchedules?.value || [])
const allSongs = computed(() => songs?.visibleSongs?.value || [])
const filteredSongs = computed(() => {
  // 返回未播放的歌曲，这里可以根据需要添加过滤条件
  if (allSongs.value && allSongs.value.length > 0) {
    return allSongs.value.filter(song => !song.played);
  }
  return [];
})
const loading = computed(() => songs?.loading?.value || false)
const error = computed(() => songs?.error?.value || '')

// 处理投稿请求
const handleRequest = async (songData) => {
  if (!auth || !isClientAuthenticated.value) {
    showNotification('请先登录', 'error')
    showRequestModal.value = false
    return false
  }

  try {
    console.log("处理歌曲请求:", songData.title)
    // 直接传递整个songData对象，确保JSON格式正确
    const result = await songs.requestSong(songData)
    if (result) {
      // 显示投稿成功通知
      showNotification(`《${songData.title} - ${songData.artist}》投稿成功！`, 'success')
      
      // 强制刷新歌曲列表
      console.log("投稿成功，刷新歌曲列表")
      await songs.fetchSongs()
      
      // 更新歌曲统计
      updateSongCounts()
      
      // 如果当前在歌曲列表页，自动切换到该页面
      if (activeTab.value !== 'songs') {
        setTimeout(() => {
          handleTabClick('songs')
        }, 500)
      } else {
        // 否则只刷新当前列表
      refreshSongs()
      }
      
      return true
    }
    return false
  } catch (err) {
    showNotification(err.message || '点歌失败', 'error')
    return false
  }
}

// 处理投票
const handleVote = async (song) => {
  if (!isClientAuthenticated.value) {
    showNotification('请先登录后再投票', 'error')
    return
  }

  try {
    if (!songs) return

    // 调用投票API - 通知已在composable中处理
    // 检查是否是取消投票请求
    if (song.unvote) {
      // 传递完整对象以支持撤销投票功能
      await songs.voteSong(song)
    } else {
      // 保持向后兼容，传递ID
      await songs.voteSong(song.id)
    }
    
    // 静默刷新歌曲列表以获取最新状态，但不影响当前视图
    setTimeout(() => {
      songs.refreshSongsSilent().catch(err => {
        console.error('刷新歌曲列表失败', err)
      })
    }, 500)
  } catch (err) {
      // 不做任何处理，因为useSongs中已经处理了错误提示
      console.log('API错误已在useSongs中处理')
  }
}

// 处理撤回投稿
const handleWithdraw = async (song) => {
  if (!isClientAuthenticated.value) {
    showNotification('请先登录才能撤回投稿', 'error')
    return
  }

  try {
    if (!songs) return

    // 调用撤回API - 通知已在composable中处理
    await songs.withdrawSong(song.id)
    // 更新计数
      updateSongCounts()
  } catch (err) {
    // 不做任何处理，因为useSongs中已经处理了错误提示
    console.log('API错误已在useSongs中处理')
  }
}

// 刷新歌曲列表
const refreshSongs = async () => {
  try {
    if (isClientAuthenticated.value) {
      await songs.fetchSongs()
    } else {
      await songs.fetchPublicSchedules()
    }

    updateSongCounts()
  } catch (err) {
    console.error('刷新歌曲列表失败', err)
  }
}

// 更新通知数量 - 可以保留这个函数但不再调用
const updateNotificationCount = async () => {
  // 函数保留但不再使用
}

// 导航到通知页面
const navigateToNotifications = () => {
  if (isClientAuthenticated.value) {
    router.push('/notifications')
  } else {
    showNotification('请先登录以查看通知', 'info')
  }
}

// 处理登出
const handleLogout = () => {
  if (auth) {
    auth.logout()
  }
}

// 添加查看通知并标记为已读
const viewNotification = async (notification) => {
  if (!notification.read) {
    await notificationsService.markAsRead(notification.id)
  }
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

// 波纹效果指令
const vRipple = {
  mounted(el) {
    el.addEventListener('click', e => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      
      el.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600); // 与CSS动画时间一致
    });
  }
};

// 处理标签点击事件，添加动画效果
const handleTabClick = (tab) => {
  activeTab.value = tab;
};

// 添加导航到登录页面的方法
const navigateToLogin = () => {
  router.push('/login');
}

// 显示登录提示
const showLoginNotice = () => {
  showToast('需要登录才能查看通知', 'info');
}

// 显示Toast通知
const showToast = (message, type = 'info') => {
  const toast = {
    id: Date.now(),
    message,
    type
  };
  notifications.value.push(toast);
  setTimeout(() => {
    const index = notifications.value.findIndex(n => n.id === toast.id);
    if (index !== -1) {
      notifications.value.splice(index, 1);
    }
  }, 3000);
}

// 添加未读通知计数
// 之前已声明了unreadNotificationCount，这里对其进行增强
if (notificationsService && notificationsService.unreadCount && notificationsService.unreadCount.value) {
  const count = notificationsService.unreadCount.value;
  unreadNotificationCount.value = count;
}
</script>

<style scoped>
.home {
  width: 100%;
  min-height: 100vh;
  background-color: #121318;
  padding: 1.5rem;
  color: #FFFFFF;
}

.main-content {
  max-width: 1440px;
  margin: 0 auto;
  position: relative;
}

/* 添加顶部Ellipse 1效果 */
.ellipse-effect {
  position: absolute;
  top: -165px;
  left: 165px;
  width: 1110px;
  height: 309px;
  background: radial-gradient(ellipse at center, rgba(11, 90, 254, 0.3) 0%, rgba(11, 90, 254, 0.15) 30%, rgba(11, 90, 254, 0) 70%);
  z-index: 0; /* 确保在内容下方但在背景上方 */
  pointer-events: none; /* 允许点击穿透 */
  transform: perspective(500px) rotateX(10deg);
}

/* 顶部区域样式 */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.logo-section {
  display: flex;
  align-items: center;
}

.logo-link {
  display: block;
  text-decoration: none;
}

.logo-image {
  width: 150px;
  height: auto;
  object-fit: contain;
}

/* 移除不需要的title-group样式 */

.user-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.user-info {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.user-details {
  text-align: right;
}

.user-name {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  letter-spacing: 4%;
}

.user-class {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 4%;
  color: rgba(255, 255, 255, 0.6);
}

.user-actions {
  display: flex;
  gap: 0.75rem;
}

.action-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 4%;
  border: 1px solid rgba(255, 255, 255, 0.16);
  cursor: pointer;
  transition: all 0.3s;
}

.logout-button {
  background: linear-gradient(180deg, #FF2F2F 0%, #FF654D 100%);
  color: #FFFFFF;
}

.password-button {
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
  text-decoration: none;
}

.dashboard-button {
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
  text-decoration: none;
}

.notification-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background-color: #f44336;
  color: white;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

/* 站点标题 */
.site-title {
  text-align: center;
  margin: 2rem 0;
}

.site-title h2 {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 36px;
  letter-spacing: 2%;
}

/* 内容区域结构 */
.content-area {
  display: flex;
  flex-direction: column;
  gap: 0; /* 移除间隙 */
}

/* 选项卡样式 */
.tabs-row {
  display: flex;
  gap: 5px;
  margin-bottom: 0;
  overflow-x: auto; /* 允许在小屏幕上水平滚动 */
  white-space: nowrap;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
  padding-bottom: 2px; /* 为滚动条留出空间 */
}

.tabs-row::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.section-tab {
  background: #1A1B24;
  border-radius: 15px 15px 0 0;
  padding: 15px 24px;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
  border: 2px solid #282830;
  border-bottom: none;
  cursor: pointer;
  flex: 0 0 auto; /* 防止标签被压缩 */
}

.section-tab.active {
  background: #21242D;
  color: #FFFFFF;
  position: relative;
  z-index: 1; /* 确保活动标签在前面 */
}

/* Tab切换动画 */
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* 选项卡切换动画 */
.section-tab {
  position: relative;
  transition: all 0.3s ease;
  overflow: hidden;
  padding: 0.75rem 1.5rem;
  z-index: 10; /* 确保在内容之上 */
}

.section-tab::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background: #0B5AFE;
  transition: all 0.3s ease;
  transform: translateX(-50%);
}

.section-tab:hover::after {
  width: 50%;
}

.section-tab.active::after {
  width: 100%;
}

/* 移除上浮效果，改用其他视觉反馈 */
.section-tab:hover {
  transform: none; /* 移除上浮效果 */
  background-color: transparent; /* 移除背景色 */
  box-shadow: none; /* 移除内阴影 */
  color: rgba(255, 255, 255, 0.9);
}

.section-tab.active:hover {
  background-color: transparent;
  box-shadow: none;
  color: #FFFFFF;
}

/* 内容容器 */
.tab-content-container {
  background: #1A1B24;
  border: 2px solid #282830;
  border-radius: 0 15px 15px 15px;
  padding: 1.5rem;
  margin-top: -2px; /* 使内容容器与标签连接 */
  box-sizing: border-box;
  width: 100%;
}

@media (max-width: 768px) {
  .tab-content-container {
    padding: 1rem;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }
}

.tab-pane {
  width: 100%;
  box-sizing: border-box;
}

/* 针对排期标签页的特殊样式 */
.schedule-tab-pane {
  width: 100%;
  box-sizing: border-box;
  padding: 0;
}

@media (max-width: 768px) {
  .tab-pane {
    padding: 0.5rem;
  }
  
  .schedule-tab-pane {
    padding: 0;
  }
}

.song-list-container {
  width: 100%;
  padding: 1rem 0;
}

/* 移除不再需要的样式 */
.date-info {
  background: #21242D;
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
}

.date-info p {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 16px;
  letter-spacing: 4%;
}

/* 歌曲时段 */
.time-label {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 16px;
  letter-spacing: 4%;
  color: rgba(255, 255, 255, 0.6);
  margin: 1.5rem 0 1rem;
}

.song-cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 请求表单布局 */
.request-pane {
  display: flex;
  gap: 2rem;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.6);
}

/* 通知面板 */
.notification-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.notification-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
}

/* 通知头部 */
.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  margin-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.notification-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--light);
  margin: 0;
}

.settings-icon {
  background: transparent;
  border: none;
  color: var(--light);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: rotate(30deg);
}

/* 设置面板 */
.notification-settings-panel {
  position: absolute;
  top: 60px;
  right: 0;
  width: 320px;
  background-color: rgba(26, 27, 36, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
  z-index: 10;
  animation: slideIn 0.2s ease;
}

.settings-panel-content {
  padding: 16px;
}

.settings-panel-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: var(--light);
  text-align: center;
}

.settings-form .form-group {
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 6px;
  background-color: rgba(30, 41, 59, 0.5);
  transition: all 0.2s ease;
}

.settings-form .form-group:hover {
  background-color: rgba(30, 41, 59, 0.7);
}

.toggle-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.label-text {
  font-weight: 500;
  color: var(--light);
}

.setting-description {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 5px;
  margin-bottom: 0;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
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
  background-color: #474747;
  transition: 0.4s;
  border-radius: 22px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: var(--light);
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: var(--primary);
}

input:checked + .toggle-slider:before {
  transform: translateX(18px);
}

/* 通知列表 */
.notification-list {
  flex: 1;
  overflow-y: auto;
  padding: 5px;
  margin-bottom: 10px;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: rgba(255, 255, 255, 0.6);
}

.loading-spinner {
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top: 3px solid var(--primary);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-notification {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: rgba(255, 255, 255, 0.6);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.notification-items {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 5px;
}

.notification-card {
  background-color: rgba(30, 41, 59, 0.5);
  border-radius: 12px;
  padding: 0;
  transition: all 0.2s ease;
  position: relative;
  border-left: 3px solid transparent;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.notification-card:hover {
  background-color: rgba(30, 41, 59, 0.8);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.notification-card.unread {
  border-left-color: var(--primary);
  background-color: rgba(33, 44, 63, 0.7);
}

.notification-card-header {
  display: flex;
  padding: 15px 15px 10px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.notification-icon-type {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  margin-right: 15px;
  flex-shrink: 0;
  font-size: 1.2rem;
}

.notification-title-row {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.notification-title {
  display: flex;
  align-items: center;
  font-weight: 600;
  margin-bottom: 5px;
  font-size: 1rem;
  color: var(--light);
}

.unread-indicator {
  width: 8px;
  height: 8px;
  background-color: var(--primary);
  border-radius: 50%;
  margin-left: 8px;
  display: inline-block;
}

.notification-card-body {
  padding: 15px;
}

.notification-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.95rem;
  line-height: 1.5;
  word-break: break-word;
}

.notification-time {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.8rem;
  margin-top: 2px;
}

.notification-card-actions {
  display: flex;
  justify-content: flex-end;
  padding: 10px 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background-color: rgba(0, 0, 0, 0.1);
}

.action-button.delete {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  padding: 6px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
}

.action-button.delete svg {
  margin-right: 5px;
}

.action-button.delete:hover {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

/* 范围滑块样式 */
.range-label {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-top: 10px;
}

.range-value {
  margin-top: 5px;
  text-align: center;
  font-size: 0.85rem;
  color: var(--light);
}

.range-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
  margin: 10px 0;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
}

.range-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  border: none;
}

.range-values {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.sub-setting {
  margin-top: 10px;
  padding: 10px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

/* 底部操作栏 */
.notification-actions-bar {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 15px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.action-button-large {
  background-color: rgba(255, 255, 255, 0.1);
  border: none;
  color: var(--light);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.action-button-large:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.action-button-large.danger {
  color: #ef4444;
}

.action-button-large.danger:hover {
  background-color: rgba(239, 68, 68, 0.2);
}

/* 修改移动端通知样式 */
@media (max-width: 768px) {
  .notification-settings-panel {
    width: 100%;
    top: 50px;
  }
  
  .notification-items {
    padding-bottom: 20px;
  }
}

@media (max-width: 480px) {
  .notification-title {
    font-size: 1.2rem;
  }
  
  .settings-form .form-group {
    padding: 8px;
  }
  
  .notification-actions-bar {
    flex-direction: column;
    gap: 8px;
  }
  
  .action-button-large {
    width: 100%;
  }
}

/* 响应式样式 */
@media (max-width: 768px) {
  .top-bar {
    flex-direction: column;
    gap: 1.5rem;
    align-items: center;
  }
  
  .logo-section {
    justify-content: center;
  }
  
  .logo-image {
    width: 120px;
  }
  
  .user-section {
    align-items: center;
    width: 100%;
  }
  
  .user-info {
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  
  .user-details {
    text-align: center;
  }
  
  .user-actions {
    width: 100%;
    justify-content: center;
  }
  
  .tabs-row {
    flex-wrap: nowrap; /* 保持水平排列 */
    justify-content: flex-start; /* 左对齐 */
    overflow-x: auto; /* 允许水平滚动 */
    padding-bottom: 5px;
  }
  
  .section-tab {
    flex: 0 0 auto; /* 不要拉伸或压缩 */
    padding: 12px 20px;
    font-size: 14px;
    white-space: nowrap;
  }
  
  .tab-content-container {
    padding: 0.5rem;
    border-radius: 0 0 15px 15px; /* 修改圆角，只保留底部圆角 */
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .request-pane {
    flex-direction: column;
  }
  
  .site-title h2 {
    font-size: 28px;
  }
  
  .ellipse-effect {
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    height: 200px;
  }
}

@media (max-width: 480px) {
  .section-tab {
    padding: 10px 15px;
    font-size: 13px;
  }
  
  .logo-image {
    width: 100px;
  }
  
  .action-button {
    padding: 0.4rem 0.8rem;
    font-size: 12px;
  }
  
  .site-title h2 {
    font-size: 24px;
  }
  
  .tab-content-container {
    padding: 0.5rem;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }
  
  .schedule-tab-pane {
    padding: 0;
  }
}

/* 动画 */
.modal-animation-enter-active,
.modal-animation-leave-active {
  transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
}

.modal-animation-enter-from,
.modal-animation-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* 通知组件样式 */
.notifications-container {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 300px;
}

.notifications-container .notification {
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  background: rgba(30, 41, 59, 0.8);
  backdrop-filter: blur(5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  border-left: 3px solid var(--primary);
  animation: slideInNotification 0.3s ease-out forwards;
}

@keyframes slideInNotification {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.notifications-container .notification.success {
  border-color: #10b981;
}

.notifications-container .notification.error {
  border-color: #ef4444;
}

.notifications-container .notification.info {
  border-color: #3b82f6;
}

.notifications-container .notification-content {
  color: var(--light);
  font-size: 0.875rem;
}

/* 波纹效果 */
.section-tab {
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}

.ripple-effect {
  position: absolute;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.3);
  transform: scale(0);
  animation: ripple 0.6s linear;
  pointer-events: none;
  width: 100px;
  height: 100px;
  margin-left: -50px; /* 居中定位 */
  margin-top: -50px; /* 居中定位 */
}

@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

/* 确保全宽显示 */
.full-width,
.full-width > div {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  padding: 0 !important;
  margin: 0 !important;
  display: block !important;
}

/* 通知标签上的未读徽章 */
.notification-badge-tab {
  position: relative;
  top: -8px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--danger);
  display: inline-block;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0, 122, 255, 0.4);
  }
  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 5px rgba(0, 122, 255, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0, 122, 255, 0);
  }
}

/* 禁用的标签页样式 */
.section-tab.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 未登录提示样式 */
.login-required-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 0;
}

.login-required-content {
  text-align: center;
  max-width: 400px;
  padding: 30px;
  background-color: rgba(30, 41, 59, 0.5);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
}

.login-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.login-required-content h3 {
  font-size: 1.5rem;
  margin-bottom: 10px;
  color: var(--light);
}

.login-required-content p {
  margin-bottom: 20px;
  color: rgba(255, 255, 255, 0.7);
}

.login-button {
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
  border: none;
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.login-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 67, 248, 0.3);
}
</style>