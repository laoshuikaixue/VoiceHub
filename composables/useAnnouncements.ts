import { ref, computed } from 'vue'

interface Announcement {
  id: number
  title: string
  content: string
  type: string
  priority: number
  createdAt: Date
  backgroundColor: string | null
  textColor: string | null
  buttonColor: string | null
  createdBy: {
    id: number
    username: string
    email: string
    nickname?: string
  } | null
}

const announcements = ref<Announcement[]>([])
const currentAnnouncement = ref<Announcement | null>(null)
const showAnnouncementDialog = ref(false)
const isLoading = ref(false)

export const useAnnouncements = () => {
  // 检查今日是否已记住不显示某个公告
  const isRememberedToday = (announcementId: number): boolean => {
    const today = new Date().toDateString()
    const rememberKey = `announcement_remember_${announcementId}_${today}`
    return localStorage.getItem(rememberKey) === 'true'
  }
  
  // 获取公告列表
  const fetchAnnouncements = async (type = 'ALL'): Promise<Announcement[]> => {
    if (isLoading.value) return []
    
    isLoading.value = true
    try {
      const response = await $fetch<Announcement[]>(`/api/announcements?type=${type}`)
      announcements.value = response || []
      return response || []
    } catch (error) {
      console.error('获取公告失败:', error)
      announcements.value = []
      return []
    } finally {
      isLoading.value = false
    }
  }
  
  // 显示公告弹窗
  const showAnnouncement = (announcement: Announcement): boolean => {
    // 检查是否今日已记住不显示
    if (isRememberedToday(announcement.id)) {
      return false
    }
    
    currentAnnouncement.value = announcement
    showAnnouncementDialog.value = true
    return true
  }
  
  // 自动显示第一个有效公告
  const showFirstValidAnnouncement = async (userType = 'ALL') => {
    await fetchAnnouncements(userType)
    
    if (announcements.value.length === 0) {
      return false
    }
    
    // 找到第一个未被记住的公告
    const validAnnouncement = announcements.value.find(announcement => 
      !isRememberedToday(announcement.id)
    )
    
    if (validAnnouncement) {
      return showAnnouncement(validAnnouncement)
    }
    
    return false
  }
  
  // 关闭公告弹窗
  const closeAnnouncementDialog = () => {
    showAnnouncementDialog.value = false
    currentAnnouncement.value = null
  }
  
  // 记住今日不再显示
  const rememberAnnouncement = (announcementId: number): void => {
    const today = new Date().toDateString()
    const rememberKey = `announcement_remember_${announcementId}_${today}`
    localStorage.setItem(rememberKey, 'true')
  }
  
  // 标记公告为已查看
  const markAsViewed = async (announcementId: number): Promise<void> => {
    try {
      await $fetch(`/api/announcements/${announcementId}/view`, {
        method: 'POST'
      })
    } catch (error) {
      console.warn('记录浏览量失败:', error)
    }
  }
  
  // 清理过期的记住记录（可选）
  const cleanupExpiredRememberRecords = () => {
    const today = new Date().toDateString()
    const keysToRemove = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('announcement_remember_')) {
        const datePart = key.split('_').pop()
        if (datePart !== today) {
          keysToRemove.push(key)
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key))
  }
  
  return {
    // 状态
    announcements: computed(() => announcements.value),
    currentAnnouncement: computed(() => currentAnnouncement.value),
    showAnnouncementDialog: computed(() => showAnnouncementDialog.value),
    isLoading: computed(() => isLoading.value),
    
    // 方法
    fetchAnnouncements,
    showAnnouncement,
    showFirstValidAnnouncement,
    closeAnnouncementDialog,
    rememberAnnouncement,
    markAsViewed,
    isRememberedToday,
    cleanupExpiredRememberRecords
  }
}
