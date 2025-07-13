<template>
  <div class="home">
    <div class="main-content grid md:grid-cols-2 gap-6">
      <!-- 左侧功能区 -->
      <div class="left-panel">
        <div class="left-content">
          <!-- 标题区域 -->
          <div class="logo-section text-center mb-6">
            <h1 class="text-4xl font-bold animated-title">VoiceHub</h1>
          </div>
          
          <!-- 上部信息和投稿区域 -->
          <div class="top-features grid grid-cols-2 gap-4">
            <!-- 左侧信息栏 -->
            <div class="info-column">
              <div class="action-card">
                <div class="icon">🎵</div>
                <div class="content">
                  <h3 class="text-lg font-bold">已收集歌曲</h3>
                  <p class="text-xl font-bold text-primary">{{ songCount }}</p>
                </div>
              </div>
              
              <div class="action-card mt-4">
                <div class="icon">{{ isRequestOpen ? '✅' : '❌' }}</div>
                <div class="content">
                  <h3 class="text-lg font-bold">投稿状态</h3>
                  <p class="text-sm" :class="isRequestOpen ? 'text-success' : 'text-danger'">
                    {{ isRequestOpen ? '开启中' : '已关闭' }}
                  </p>
                </div>
              </div>
            </div>
            
            <!-- 右侧点歌按钮 -->
            <div class="request-column">
              <button @click="openRequestModal" class="big-button">
                <div class="button-content">
                  <div class="button-icon">🎵</div>
                  <span class="text-lg font-bold">投稿点歌</span>
                </div>
              </button>
            </div>
          </div>
          
          <!-- 底部胶囊按钮组，占满宽度 -->
          <div class="capsule-buttons-row mt-4">
            <button @click="showRules = true" class="capsule-button">
              <span class="icon">📜</span>
              <span>规则介绍</span>
            </button>
            <button @click="showAbout = true" class="capsule-button">
              <span class="icon">ℹ️</span>
              <span>关于我们</span>
            </button>
          </div>
          
          <!-- 用户信息区域 -->
          <div class="user-panel card mt-6">
            <ClientOnly>
              <div v-if="isClientAuthenticated" class="user-info">
                <div class="user-details">
                  <div class="avatar">{{ user?.name?.charAt(0) || '游' }}</div>
                  <div class="user-name">
                    <h3 class="font-bold">{{ user?.name || '游客' }}</h3>
                  </div>
                </div>
                
                <div class="user-actions">
                  <button @click="toggleTheme" class="icon-button">
                    <span>🌓</span>
                  </button>
                  
                  <NuxtLink v-if="isAdmin" to="/dashboard" class="icon-button">
                    <span>⚙️</span>
                  </NuxtLink>
                  
                  <NuxtLink to="/change-password" class="icon-button" title="修改密码">
                    <span>🔑</span>
                  </NuxtLink>
                  
                  <button @click="handleLogout" class="icon-button">
                    <span>🚪</span>
                  </button>
                </div>
              </div>
              
              <div v-else class="login-options">
                <NuxtLink to="/login" class="btn btn-outline">登录</NuxtLink>
                
                <button @click="toggleTheme" class="icon-button ml-4">
                  <span>🌓</span>
                </button>
              </div>
            </ClientOnly>
          </div>
        </div>
      </div>
      
      <!-- 右侧内容区域 -->
      <div class="right-panel">
        <!-- 选项卡切换 -->
        <div class="tabs-container">
          <div class="tabs">
            <button 
              :class="{ 'active': activeTab === 'schedule' }" 
              @click="activeTab = 'schedule'"
              class="tab"
            >
              播出排期
            </button>
            <button 
              :class="{ 'active': activeTab === 'songs' }" 
              @click="activeTab = 'songs'"
              class="tab"
            >
              歌曲列表
            </button>
          </div>
          
          <div class="tab-content">
            <ClientOnly>
              <!-- 播出排期列表 -->
              <div v-if="activeTab === 'schedule'" class="schedule-tab">
                <ScheduleList 
                  :schedules="publicSchedules" 
                  :loading="loading" 
                  :error="error"
                />
              </div>
              
              <!-- 歌曲列表 -->
              <div v-else-if="activeTab === 'songs'" class="songs-tab">
                <SongList 
                  :songs="filteredSongs" 
                  :loading="loading" 
                  :error="error"
                  :isAdmin="isAdmin"
                  @vote="handleVote"
                  @withdraw="handleWithdraw"
                  @delete="handleDelete"
                  @markPlayed="handleMarkPlayed"
                  @unmarkPlayed="handleUnmarkPlayed"
                  @refresh="refreshSongs"
                />
              </div>
            </ClientOnly>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 投稿弹窗 -->
    <div v-if="showRequestModal" class="modal-overlay" @click.self="closeRequestModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="text-xl font-bold">投稿点歌</h2>
          <button @click="closeRequestModal" class="close-button">×</button>
        </div>
        
        <div class="modal-body">
          <RequestForm 
            :loading="loading" 
            @request="handleRequest"
            @vote="handleVote"
          />
        </div>
      </div>
    </div>
    
    <!-- 规则弹窗 -->
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
    
    <!-- 关于我们弹窗 -->
    <div v-if="showAbout" class="modal-overlay" @click.self="showAbout = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="text-xl font-bold">关于我们</h2>
          <button @click="showAbout = false" class="close-button">×</button>
        </div>
        
        <div class="modal-body">
          <div class="about-content">
            <h3 class="font-bold mb-2">关于VoiceHub</h3>
            <p class="mb-4">VoiceHub是由LaoShui开发，计划服务于舟山市六横中学的点歌系统。</p>
            
            <h3 class="font-bold mb-2">联系方式</h3>
            <p>邮箱：contact@lao-shui.top</p>
            <br>
            <p>Powered by LaoShui @ 2025 | All Rights Reserved.</p>
            <p>项目开源地址：<a href="https://github.com/laoshuikaixue/VoiceHub" target="_blank" class="github-link">https://github.com/laoshuikaixue/VoiceHub</a></p>
          </div>
        </div>
      </div>
    </div>
    
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
import ScheduleList from '~/components/Songs/ScheduleList.vue'
import SongList from '~/components/Songs/SongList.vue'
import RequestForm from '~/components/Songs/RequestForm.vue'

// 服务器端安全的认证状态管理
const isClientAuthenticated = ref(false)
const isAdmin = ref(false)
const user = ref(null)
let auth = null
let songs = null

// 模拟数据初始值
const songCount = ref(0)
const scheduleCount = ref(0)
const isRequestOpen = ref(true)

// 弹窗状态
const showRequestModal = ref(false)
const showRules = ref(false)
const showAbout = ref(false)

// 标签页状态
const activeTab = ref('schedule')

// 通知系统
const notifications = ref([])
let notificationId = 0
let refreshInterval = null

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

// 在组件挂载后初始化认证和歌曲（只会在客户端执行）
onMounted(async () => {
  auth = useAuth()
  isClientAuthenticated.value = auth.isAuthenticated.value
  isAdmin.value = auth.isAdmin.value
  user.value = auth.user.value
  
  // 初始化歌曲服务
  songs = useSongs()
  
  // 无论是否登录都获取公共数据
  await songs.fetchPublicSchedules()
  
  // 如果用户已登录，获取完整歌曲列表
  if (isClientAuthenticated.value) {
    await songs.fetchSongs()
  }
  
  // 更新真实数据
  updateSongCounts()
  
  // 设置定时刷新（每60秒刷新一次数据）
  refreshInterval = setInterval(async () => {
    if (isClientAuthenticated.value) {
      await songs.fetchSongs()
    } else {
      await songs.fetchPublicSchedules()
    }
    updateSongCounts()
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

// 更新歌曲数量统计
const updateSongCounts = () => {
  try {
    // 更新排期歌曲数量
    const schedules = songs?.publicSchedules?.value || []
    scheduleCount.value = schedules.length
    
    // 更新总歌曲数量
    songCount.value = songs?.songs?.value?.length || publicSongs.value?.length || 0
  } catch (e) {
    console.error('更新歌曲统计失败', e)
  }
}

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
    const result = await songs.requestSong(songData.title, songData.artist)
    if (result) {
      closeRequestModal()
      // 更新歌曲统计
      await songs.fetchSongs()
      updateSongCounts()
      // 自动刷新歌曲列表
      refreshSongs()
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
    
    // 检查是否已经投过票
    if (song.voted) {
      showNotification(`您已经为歌曲《${song.title}》投过票了`, 'info')
      return
    }
    
    const result = await songs.voteSong(song.id)
    if (result) {
      showNotification(`为歌曲《${song.title}》投票成功！`, 'success')
      // 手动刷新歌曲列表以获取最新状态，但不影响当前视图
      setTimeout(() => {
        songs.fetchSongs().catch(err => {
          console.error('刷新歌曲列表失败', err)
        })
      }, 500)
    }
  } catch (err) {
    if (err.message && err.message.includes('已经为这首歌投过票')) {
      showNotification(`您已经为歌曲《${song.title}》投过票了`, 'info')
    } else {
      showNotification(err.message || '投票失败', 'error')
    }
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
    
    const result = await songs.withdrawSong(song.id)
    if (result) {
      showNotification(`已成功撤回《${song.title}》的投稿`, 'success')
      await songs.fetchSongs()
      updateSongCounts()
    }
  } catch (err) {
    showNotification(err.message || '撤回投稿失败', 'error')
  }
}

// 处理删除歌曲（管理员）
const handleDelete = async (song) => {
  if (!isClientAuthenticated.value || !isAdmin.value) {
    showNotification('只有管理员可以删除歌曲', 'error')
    return
  }
  
  try {
    if (!songs) return
    
    const result = await songs.deleteSong(song.id)
    if (result) {
      showNotification(`已成功删除《${song.title}》`, 'success')
      await songs.fetchSongs()
      updateSongCounts()
    }
  } catch (err) {
    showNotification(err.message || '删除歌曲失败', 'error')
  }
}

// 处理标记为已播放（管理员）
const handleMarkPlayed = async (song) => {
  if (!isClientAuthenticated.value || !isAdmin.value) {
    showNotification('只有管理员可以标记歌曲为已播放', 'error')
    return
  }
  
  try {
    if (!songs || !songs.markPlayed) {
      showNotification('功能未实现', 'error')
      return
    }
    
    const result = await songs.markPlayed(song.id)
    if (result) {
      showNotification(`已成功将《${song.title}》标记为已播放`, 'success')
      await songs.fetchSongs()
      updateSongCounts()
    }
  } catch (err) {
    showNotification(err.message || '标记歌曲失败', 'error')
  }
}

// 处理撤回已播放状态（管理员）
const handleUnmarkPlayed = async (song) => {
  if (!isClientAuthenticated.value || !isAdmin.value) {
    showNotification('只有管理员可以撤回歌曲已播放状态', 'error')
    return
  }
  
  try {
    if (!songs || !songs.unmarkPlayed) {
      showNotification('功能未实现', 'error')
      return
    }
    
    const result = await songs.unmarkPlayed(song.id)
    if (result) {
      showNotification(`已成功撤回《${song.title}》的已播放状态`, 'success')
      await songs.fetchSongs()
      updateSongCounts()
    }
  } catch (err) {
    showNotification(err.message || '操作失败', 'error')
  }
}

// 打开投稿弹窗
const openRequestModal = () => {
  if (!isClientAuthenticated.value) {
    alert('请先登录')
    return
  }
  
  if (!isRequestOpen.value) {
    alert('当前投稿已关闭')
    return
  }
  
  showRequestModal.value = true
}

// 关闭投稿弹窗
const closeRequestModal = () => {
  showRequestModal.value = false
}

// 切换主题（浅色/深色模式）
const toggleTheme = () => {
  // 主题切换逻辑，此处为占位
  alert('主题切换功能开发中')
}

// 处理登出
const handleLogout = () => {
  if (auth) {
    auth.logout()
  }
}

// 刷新歌曲列表
const refreshSongs = async () => {
  try {
    showNotification('正在刷新歌曲列表...', 'info')
    
    if (isClientAuthenticated.value) {
      await songs.fetchSongs()
    } else {
      await songs.fetchPublicSchedules()
    }
    
    updateSongCounts()
    showNotification('歌曲列表已刷新', 'success')
  } catch (err) {
    showNotification('刷新歌曲列表失败', 'error')
  }
}
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.gradient-text {
  background: linear-gradient(90deg, var(--primary), var(--secondary));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.main-content {
  min-height: calc(100vh - 100px);
}

.left-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.left-content {
  width: 100%;
}

.logo-section {
  margin-bottom: 2rem;
}

.top-features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.info-column {
  display: flex;
  flex-direction: column;
}

.request-column {
  display: flex;
  height: 100%;
}

.capsule-buttons-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.action-card {
  display: flex;
  align-items: center;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0.75rem;
  padding: 1rem;
  transition: all 0.3s ease;
  cursor: pointer;
  text-decoration: none;
  color: var(--light);
}

.action-card:hover {
  transform: translateY(-2px);
  background: rgba(30, 41, 59, 0.8);
  border-color: var(--primary);
}

.action-card .icon {
  font-size: 1.5rem;
  margin-right: 0.75rem;
  min-width: 32px;
  text-align: center;
}

.action-card .content {
  flex: 1;
}

.big-button {
  background: linear-gradient(90deg, var(--primary), var(--secondary));
  border: none;
  border-radius: 0.75rem;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.big-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(99, 102, 241, 0.4);
}

.button-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.button-icon {
  font-size: 2rem;
}

.capsule-button {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 2rem;
  padding: 0.75rem 1.25rem;
  color: var(--light);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
  width: 100%;
  height: 3rem;
}

.capsule-button:hover {
  background: rgba(30, 41, 59, 0.8);
  border-color: var(--primary);
  transform: translateY(-2px);
}

.capsule-button .icon {
  font-size: 1.25rem;
}

.user-panel {
  margin-top: 1.5rem;
  padding: 1rem;
}

.user-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-details {
  display: flex;
  align-items: center;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(45deg, var(--primary), var(--secondary));
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  font-weight: bold;
  margin-right: 0.75rem;
}

.user-actions {
  display: flex;
  gap: 0.75rem;
}

.icon-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-button:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.login-options {
  display: flex;
  align-items: center;
}

/* 选项卡样式 */
.tabs-container {
  margin-bottom: 1rem;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0.75rem;
  overflow: hidden;
}

.tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.tab {
  flex: 1;
  padding: 1rem;
  text-align: center;
  background: transparent;
  border: none;
  color: var(--gray);
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.tab.active {
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary);
  border-bottom: 2px solid var(--primary);
}

.tab-content {
  padding: 1rem;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.modal-content {
  background: var(--dark);
  border-radius: 0.75rem;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--gray);
  line-height: 1;
}

.close-button:hover {
  color: var(--light);
}

.modal-body {
  padding: 1.5rem;
  max-height: 70vh;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .main-content {
    grid-template-columns: 1fr;
  }
  
  .left-panel {
    margin-bottom: 1rem;
  }
  
  .top-features {
    grid-template-columns: 1fr;
  }
  
  .request-column {
    height: 120px;
  }
  
  .capsule-buttons-row {
    grid-template-columns: 1fr;
  }
}

.animated-title {
  font-size: 3.5rem;
  background: linear-gradient(90deg, var(--primary), var(--secondary), var(--primary));
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: gradient 3s ease infinite;
  text-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
  letter-spacing: 1px;
  position: relative;
}

.animated-title::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--primary), transparent);
}

@keyframes gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* 通知样式 */
.notifications-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 300px;
}

.notification {
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.95);
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: space-between;
  animation: slide-in 0.3s ease;
}

.notification.success {
  background: rgba(16, 185, 129, 0.95);
  border-left: 4px solid rgb(16, 185, 129);
}

.notification.error {
  background: rgba(239, 68, 68, 0.95);
  border-left: 4px solid rgb(239, 68, 68);
}

.notification.info {
  background: rgba(59, 130, 246, 0.95);
  border-left: 4px solid rgb(59, 130, 246);
}

.notification-content {
  margin-right: 8px;
}

/* 通知动画 */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* GitHub链接样式 */
.github-link {
  display: inline-block;
  padding: 0.5rem 1rem;
  border: 1px solid var(--primary);
  border-radius: 0.5rem;
  color: var(--primary);
  text-decoration: none;
  transition: all 0.3s ease;
  margin-top: 0.5rem;
  position: relative;
  overflow: hidden;
}

.github-link:before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
  z-index: 0;
}

.github-link:hover:before {
  width: 300%;
  height: 300%;
}

.github-link:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}
</style> 