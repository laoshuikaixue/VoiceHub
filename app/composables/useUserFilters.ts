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

  // 智能排序函数：支持处理“高一”、“高二”、“高三”等特殊中文，以及自然数字递增（24, 25, 26）
  const smartSort = (a: string, b: string) => {
    const gradeOrder: Record<string, number> = {
      '初一': 1, '初二': 2, '初三': 3,
      '高一': 4, '高二': 5, '高三': 6,
      '大一': 7, '大二': 8, '大三': 9, '大四': 10,
      '教师': 99, '教职工': 99
    }

    const weightA = gradeOrder[a]
    const weightB = gradeOrder[b]

    // 如果两者都是预定义的年级，按权重排
    if (weightA !== undefined && weightB !== undefined) {
      return weightA - weightB
    }
    // 如果只有一个是预定义的年级，预定义的排在前面
    if (weightA !== undefined) return -1
    if (weightB !== undefined) return 1

    // 其他情况使用自然排序（支持 24, 25, 26 和 1班, 2班, 10班 的自然递增）
    return a.localeCompare(b, 'zh-CN', { numeric: true })
  }

  const allUsers = useState<User[]>('admin-all-users', () => [])
  const loading = useState<boolean>('admin-all-users-loading', () => false)
  const isLoaded = useState<boolean>('admin-all-users-loaded', () => false)
  const lastError = useState<string>('admin-all-users-error', () => '')

  // 用于存放轻量级后端返回的全局可选项（年级、班级关联）
  const cachedOptions = useState<{ grades: string[], classes: { grade: string | null, class: string }[] }>('admin-users-options', () => ({ grades: [], classes: [] }))
  const optionsLoaded = useState<boolean>('admin-users-options-loaded', () => false)

  const fetchOptions = async () => {
    if (optionsLoaded.value) return

    try {
      const res = await $fetch<{ success: boolean, grades: string[], classes: { grade: string | null, class: string }[] }>('/api/admin/users/options', {
        ...auth.getAuthConfig()
      })
      if (res.success) {
        cachedOptions.value = {
          grades: res.grades || [],
          classes: res.classes || []
        }
        optionsLoaded.value = true
      }
    } catch (e) {
      console.error('获取轻量级选项失败', e)
    }
  }

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
            limit: 1000
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

  const getAvailableGrades = (users?: User[]) => {
    if (optionsLoaded.value) return cachedOptions.value.grades
    
    if (!users || !Array.isArray(users)) return []
    return [...new Set(users.map((u) => u.grade).filter((g): g is string => Boolean(g)))].sort(smartSort)
  }

  const getAvailableClasses = (users?: User[], gradeFilter?: string) => {
    if (optionsLoaded.value) {
      let c = cachedOptions.value.classes
      if (gradeFilter) {
        c = c.filter(item => item.grade === gradeFilter)
      }
      return [...new Set(c.map(item => item.class))].sort(smartSort)
    }

    if (!users || !Array.isArray(users)) return []
    let filtered = users
    if (gradeFilter) {
      filtered = filtered.filter((u) => u.grade === gradeFilter)
    }
    return [...new Set(filtered.map((u) => u.class).filter((c): c is string => Boolean(c)))].sort(smartSort)
  }

  const availableGrades = computed(() => {
    return getAvailableGrades(allUsers.value)
  })

  const resetUserFilters = () => {
    allUsers.value = []
    isLoaded.value = false
    lastError.value = ''
    optionsLoaded.value = false
    cachedOptions.value = { grades: [], classes: [] }
  }

  return {
    allUsers,
    loading,
    isLoaded,
    fetchAllUsers,
    fetchOptions,
    getAvailableGrades,
    getAvailableClasses,
    availableGrades,
    resetUserFilters
  }
}
