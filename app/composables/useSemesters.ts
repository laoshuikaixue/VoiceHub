import { readonly, ref } from 'vue'
import type { Semester } from '~/types'

// 全局事件总线用于学期更新通知
const semesterUpdateEvent = ref(0)

// SessionStorage 键名常量
const SELECTED_SEMESTER_KEY = 'voicehub_selected_semester'
const AVAILABLE_SEMESTERS_KEY = 'voicehub_available_semesters'

// 持久化工具函数
const persistenceUtils = {
  // 保存选中的学期
  saveSelectedSemester: (semester: string | null) => {
    try {
      if (semester) {
        sessionStorage.setItem(SELECTED_SEMESTER_KEY, semester)
      } else {
        sessionStorage.removeItem(SELECTED_SEMESTER_KEY)
      }
    } catch (error) {
      console.warn('保存选中学期失败:', error)
    }
  },

  // 获取选中的学期
  getSelectedSemester: (): string | null => {
    try {
      return sessionStorage.getItem(SELECTED_SEMESTER_KEY)
    } catch (error) {
      console.warn('获取选中学期失败:', error)
      return null
    }
  },

  // 保存可用学期列表
  saveAvailableSemesters: (semesters: string[]) => {
    try {
      sessionStorage.setItem(AVAILABLE_SEMESTERS_KEY, JSON.stringify(semesters))
    } catch (error) {
      console.warn('保存可用学期列表失败:', error)
    }
  },

  // 获取可用学期列表
  getAvailableSemesters: (): string[] => {
    try {
      const stored = sessionStorage.getItem(AVAILABLE_SEMESTERS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.warn('获取可用学期列表失败:', error)
      return []
    }
  },

  // 清除所有持久化数据
  clearAll: () => {
    try {
      sessionStorage.removeItem(SELECTED_SEMESTER_KEY)
      sessionStorage.removeItem(AVAILABLE_SEMESTERS_KEY)
    } catch (error) {
      console.warn('清除持久化数据失败:', error)
    }
  }
}

export function useSemesters() {
  const semesters = ref<Semester[]>([])
  const currentSemester = ref<Semester | null>(null)
  const loading = ref(false)
  const error = ref('')

  // 触发学期更新事件
  const triggerSemesterUpdate = () => {
    semesterUpdateEvent.value++
  }

  // 获取学期列表（管理员专用）
  const fetchSemesters = async () => {
    const { isAuthenticated, getAuthConfig } = useAuth()

    if (!isAuthenticated.value) {
      error.value = '需要登录才能获取学期列表'
      return
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()

      const response = await fetch('/api/admin/semesters', {
        headers: {
          'Content-Type': 'application/json'
        },
        ...authConfig
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `获取学期列表失败: ${response.status}`)
      }

      const data = await response.json()
      semesters.value = data as Semester[]
    } catch (err: any) {
      error.value = err.message || '获取学期列表失败'
    } finally {
      loading.value = false
    }
  }

  // 获取当前活跃学期
  const fetchCurrentSemester = async () => {
    try {
      const response = await fetch('/api/semesters/current')

      if (!response.ok) {
        throw new Error('获取当前学期失败')
      }

      const data = await response.json()
      currentSemester.value = data
    } catch (err: any) {
      console.error('获取当前学期失败:', err)
    }
  }

  // 创建学期
  const createSemester = async (semesterData: { name: string; isActive?: boolean }) => {
    const { isAuthenticated, getAuthConfig } = useAuth()

    if (!isAuthenticated.value) {
      error.value = '需要登录才能创建学期'
      return null
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()

      const response = await fetch('/api/admin/semesters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(semesterData),
        ...authConfig
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || '创建学期失败')
      }

      const data = await response.json()

      // 更新学期列表
      await fetchSemesters()

      // 如果设置为活跃学期，也更新当前学期
      if (semesterData.isActive) {
        await fetchCurrentSemester()
      }

      // 触发全局学期更新事件
      triggerSemesterUpdate()

      return data
    } catch (err: any) {
      error.value = err.message || '创建学期失败'
      return null
    } finally {
      loading.value = false
    }
  }

  // 设置活跃学期
  const setActiveSemester = async (semesterId: number) => {
    const { isAuthenticated, getAuthConfig } = useAuth()

    if (!isAuthenticated.value) {
      error.value = '需要登录才能设置活跃学期'
      return false
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()

      const response = await fetch('/api/admin/semesters/set-active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ semesterId }),
        ...authConfig
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || '设置活跃学期失败')
      }

      // 更新学期列表
      await fetchSemesters()
      await fetchCurrentSemester()

      // 触发全局学期更新事件
      triggerSemesterUpdate()

      return true
    } catch (err: any) {
      error.value = err.message || '设置活跃学期失败'
      return false
    } finally {
      loading.value = false
    }
  }

  // 删除学期
  const deleteSemester = async (semesterId: number) => {
    const { isAuthenticated, getAuthConfig } = useAuth()

    if (!isAuthenticated.value) {
      error.value = '需要登录才能删除学期'
      return false
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()

      const response = await fetch(`/api/admin/semesters/${semesterId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        ...authConfig
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || '删除学期失败')
      }

      // 更新学期列表
      await fetchSemesters()

      // 触发全局学期更新事件
      triggerSemesterUpdate()

      return true
    } catch (err: any) {
      error.value = err.message || '删除学期失败'
      return false
    } finally {
      loading.value = false
    }
  }

  // 获取所有学期选项
  const fetchSemesterOptions = async () => {
    loading.value = true
    error.value = ''
    try {
      const response = await fetch('/api/semesters/options')
      if (!response.ok) {
        throw new Error('获取学期选项失败')
      }
      const data = await response.json()
      if (data.success) {
        semesters.value = data.data
      }
    } catch (err: any) {
      console.error('获取学期选项失败:', err)
      error.value = err.message || '获取学期选项失败'
    } finally {
      loading.value = false
    }
  }

  return {
    semesters: readonly(semesters),
    currentSemester: readonly(currentSemester),
    loading: readonly(loading),
    error: readonly(error),
    semesterUpdateEvent: readonly(semesterUpdateEvent),
    fetchSemesters,
    fetchCurrentSemester,
    fetchSemesterOptions,
    createSemester,
    setActiveSemester,
    deleteSemester,
    triggerSemesterUpdate,
    // 导出持久化工具函数
    persistenceUtils
  }
}
