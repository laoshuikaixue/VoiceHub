import { computed, watch } from 'vue'
import type { User } from '~/types'
import { useAuth } from '~/composables/useAuth'

type UsersListResponse = {
  success: boolean
  users: User[]
  pagination?: {
    page: number
    totalPages: number
  }
}

export const useUserFilters = () => {
  const auth = useAuth()

  const allUsers = useState<User[]>('admin-all-users', () => [])
  const loading = useState<boolean>('admin-all-users-loading', () => false)
  const isLoaded = useState<boolean>('admin-all-users-loaded', () => false)
  const lastError = useState<string>('admin-all-users-error', () => '')

  const waitForCurrentLoad = async () => {
    if (!loading.value) return

    await new Promise<void>((resolve) => {
      const stop = watch(loading, (isLoading) => {
        if (!isLoading) {
          stop()
          resolve()
        }
      })
    })

    if (lastError.value) {
      throw new Error(lastError.value)
    }
  }

  const fetchAllUsers = async (force = false) => {
    if (isLoaded.value && !force) return allUsers.value
    if (loading.value) {
      await waitForCurrentLoad()
      return allUsers.value
    }

    loading.value = true
    lastError.value = ''
    try {
      let page = 1
      let hasMore = true
      let allFetchedUsers: User[] = []

      while (hasMore) {
        const response = await $fetch<UsersListResponse>('/api/admin/users', {
          method: 'GET',
          query: {
            page,
            limit: 500
          },
          ...auth.getAuthConfig()
        })

        if (!response.success) {
          throw new Error('获取用户列表失败')
        }

        allFetchedUsers.push(...(response.users || []))

        if (response.pagination && response.pagination.page < response.pagination.totalPages) {
          page++
        } else {
          hasMore = false
        }
      }

      allUsers.value = allFetchedUsers
      isLoaded.value = true
      return allUsers.value
    } catch (err: any) {
      lastError.value = err?.data?.message || err?.message || '获取所有用户数据失败'
      console.error('获取所有用户数据失败:', err)
      throw err
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
