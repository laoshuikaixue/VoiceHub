import { computed } from 'vue'
import { useAuth } from '~/composables/useAuth'

export const useUserFilters = () => {
  const auth = useAuth()
  
  const allUsers = useState<any[]>('admin-all-users', () => [])
  const loading = useState<boolean>('admin-all-users-loading', () => false)
  const isLoaded = useState<boolean>('admin-all-users-loaded', () => false)

  const fetchAllUsers = async (force = false) => {
    if (isLoaded.value && !force) return
    if (loading.value) return

    loading.value = true
    try {
      const response = await $fetch<any>('/api/admin/users', {
        method: 'GET',
        query: {
          page: 1,
          limit: 10000
        },
        ...auth.getAuthConfig()
      })

      if (response.success && response.users) {
        allUsers.value = response.users
        isLoaded.value = true
      }
    } catch (err) {
      console.error('获取所有用户数据失败:', err)
    } finally {
      loading.value = false
    }
  }

  const getAvailableGrades = (users: any[]) => {
    if (!users || !Array.isArray(users)) return []
    return [...new Set(users.map((u) => u.grade).filter(Boolean))].sort()
  }

  const getAvailableClasses = (users: any[], gradeFilter?: string) => {
    if (!users || !Array.isArray(users)) return []
    let filtered = users
    if (gradeFilter) {
      filtered = filtered.filter((u) => u.grade === gradeFilter)
    }
    return [...new Set(filtered.map((u) => u.class).filter(Boolean))].sort()
  }

  const availableGrades = computed(() => {
    return getAvailableGrades(allUsers.value)
  })

  return {
    allUsers,
    loading,
    isLoaded,
    fetchAllUsers,
    getAvailableGrades,
    getAvailableClasses,
    availableGrades
  }
}
