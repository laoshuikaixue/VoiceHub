import { computed } from 'vue'
import type { User } from '~/types'
import { useAuth } from '~/composables/useAuth'

export const useUserFilters = () => {
  const auth = useAuth()
  
  const allUsers = useState<User[]>('admin-all-users', () => [])
  const loading = useState<boolean>('admin-all-users-loading', () => false)
  const isLoaded = useState<boolean>('admin-all-users-loaded', () => false)

  const fetchAllUsers = async (force = false) => {
    if (isLoaded.value && !force) return
    if (loading.value) return

    loading.value = true
    try {
      let page = 1
      let hasMore = true
      let allFetchedUsers: User[] = []

      while (hasMore) {
        const response = await $fetch<{ success: boolean; users: User[]; pagination: any }>('/api/admin/users', {
          method: 'GET',
          query: {
            page,
            limit: 500
          },
          ...auth.getAuthConfig()
        })

        if (response.success && response.users) {
          allFetchedUsers = [...allFetchedUsers, ...response.users]
          if (response.pagination && response.pagination.page < response.pagination.totalPages) {
            page++
          } else {
            hasMore = false
          }
        } else {
          hasMore = false
        }
      }
      allUsers.value = allFetchedUsers
      isLoaded.value = true
    } catch (err) {
      console.error('获取所有用户数据失败:', err)
    } finally {
      loading.value = false
    }
  }

  const getAvailableGrades = (users: User[]) => {
    if (!users || !Array.isArray(users)) return []
    return [...new Set(users.map((u) => u.grade).filter((g): g is string => Boolean(g)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }

  const getAvailableClasses = (users: User[], gradeFilter?: string) => {
    if (!users || !Array.isArray(users)) return []
    let filtered = users
    if (gradeFilter) {
      filtered = filtered.filter((u) => u.grade === gradeFilter)
    }
    return [...new Set(filtered.map((u) => u.class).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
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
