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
                    <p class="text-sm text-gray">{{ user?.email || '' }}</p>
                  </div>
                </div>
                
                <div class="user-actions">
                  <button @click="toggleTheme" class="icon-button">
                    <span>🌓</span>
                  </button>
                  
                  <NuxtLink v-if="isAdmin" to="/dashboard" class="icon-button">
                    <span>⚙️</span>
                  </NuxtLink>
                  
                  <button @click="handleLogout" class="icon-button">
                    <span>🚪</span>
                  </button>
                </div>
              </div>
              
              <div v-else class="login-options">
                <NuxtLink to="/login" class="btn btn-outline">登录</NuxtLink>
                <NuxtLink to="/register" class="btn btn-primary">注册</NuxtLink>
                
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
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
    alert('请先登录')
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
      return true
    }
    return false
  } catch (err) {
    console.error('点歌失败', err)
    return false
  }
}

// 处理投票
const handleVote = (song) => {
  // 这里实现投票功能，目前是占位
  if (!isClientAuthenticated.value) {
    alert('请先登录后再投票')
    return
  }
  
  // 这里应该调用API进行投票
  alert(`为歌曲《${song.title}》投票成功！`)
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
</style> 