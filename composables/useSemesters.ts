import { ref, readonly } from 'vue'
import type { Semester } from '~/types'

export function useSemesters() {
  const semesters = ref<Semester[]>([])
  const currentSemester = ref<Semester | null>(null)
  const loading = ref(false)
  const error = ref('')

  // 获取学期列表（管理员专用）
  const fetchSemesters = async () => {
    const { isAuthenticated, getAuthHeader } = useAuth()
    
    if (!isAuthenticated.value) {
      error.value = '需要登录才能获取学期列表'
      return
    }
    
    loading.value = true
    error.value = ''
    
    try {
      const authHeaders = getAuthHeader()
      
      const response = await fetch('/api/admin/semesters', {
        headers: {
          ...authHeaders.headers,
          'Content-Type': 'application/json'
        }
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
  const createSemester = async (semesterData: {
    name: string,
    isActive?: boolean
  }) => {
    const { isAuthenticated, getAuthHeader } = useAuth()
    
    if (!isAuthenticated.value) {
      error.value = '需要登录才能创建学期'
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      const authHeaders = getAuthHeader()
      
      const response = await fetch('/api/admin/semesters', {
        method: 'POST',
        headers: {
          ...authHeaders.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(semesterData)
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || '创建学期失败')
      }
      
      const data = await response.json()
      
      // 更新学期列表
      await fetchSemesters()
      
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
    const { isAuthenticated, getAuthHeader } = useAuth()
    
    if (!isAuthenticated.value) {
      error.value = '需要登录才能设置活跃学期'
      return false
    }
    
    loading.value = true
    error.value = ''
    
    try {
      const authHeaders = getAuthHeader()
      
      const response = await fetch('/api/admin/semesters/set-active', {
        method: 'POST',
        headers: {
          ...authHeaders.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ semesterId })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || '设置活跃学期失败')
      }
      
      // 更新学期列表
      await fetchSemesters()
      await fetchCurrentSemester()
      
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
    const { isAuthenticated, getAuthHeader } = useAuth()
    
    if (!isAuthenticated.value) {
      error.value = '需要登录才能删除学期'
      return false
    }
    
    loading.value = true
    error.value = ''
    
    try {
      const authHeaders = getAuthHeader()
      
      const response = await fetch(`/api/admin/semesters/${semesterId}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders.headers,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || '删除学期失败')
      }
      
      // 更新学期列表
      await fetchSemesters()
      
      return true
    } catch (err: any) {
      error.value = err.message || '删除学期失败'
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    semesters: readonly(semesters),
    currentSemester: readonly(currentSemester),
    loading: readonly(loading),
    error: readonly(error),
    fetchSemesters,
    fetchCurrentSemester,
    createSemester,
    setActiveSemester,
    deleteSemester
  }
}
