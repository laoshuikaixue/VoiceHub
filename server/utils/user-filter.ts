import { users } from '~/drizzle/schema'
import { and, eq, ilike, inArray, isNull, notInArray, or } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { ARCHIVED_USER_STATUSES, resolveArchivedFilter } from '~~/server/utils/user-archive'

// 与用户列表接口共用的"未设置"筛选占位值
export const UNSET_FILTER_VALUE = '__UNSET__'

/**
 * 构建用户列表/导出的统一筛选条件（年级、班级、角色、状态、归档、搜索）。
 * 列表接口与导出接口共用，保证筛选口径完全一致。
 */
export function buildUserFilterConditions(query: Record<string, any>): SQL | undefined {
  const { grade, class: className, role, status, search, archived } = query
  const whereConditions = []

  // 年级筛选
  if (grade && typeof grade === 'string' && grade.trim()) {
    const gradeFilter = grade.trim()
    whereConditions.push(
      gradeFilter === UNSET_FILTER_VALUE
        ? or(isNull(users.grade), eq(users.grade, ''))
        : eq(users.grade, gradeFilter)
    )
  }

  // 班级筛选
  if (className && typeof className === 'string' && className.trim()) {
    const classFilter = className.trim()
    whereConditions.push(
      classFilter === UNSET_FILTER_VALUE
        ? or(isNull(users.class), eq(users.class, ''))
        : eq(users.class, classFilter)
    )
  }

  // 角色筛选
  if (role && typeof role === 'string' && role.trim()) {
    whereConditions.push(eq(users.role, role.trim()))
  }

  // 状态筛选
  if (status && typeof status === 'string' && status.trim()) {
    const statusFilter = status.trim()
    if (['active', 'pending', 'withdrawn', 'graduate'].includes(statusFilter)) {
      whereConditions.push(eq(users.status, statusFilter as 'active' | 'pending' | 'withdrawn' | 'graduate'))
    }
  }

  // 归档筛选：archived=1 仅查已归档（graduate/withdrawn）；archived=0 排除已归档；缺省不限制
  const archivedFilter = resolveArchivedFilter(archived)
  if (archivedFilter === 'archived') {
    whereConditions.push(inArray(users.status, [...ARCHIVED_USER_STATUSES]))
  } else if (archivedFilter === 'unarchived') {
    whereConditions.push(notInArray(users.status, [...ARCHIVED_USER_STATUSES]))
  }

  // 搜索功能（姓名、用户名或IP地址）
  if (search && typeof search === 'string' && search.trim()) {
    const searchTerm = search.trim()
    whereConditions.push(
      or(
        ilike(users.name, `%${searchTerm}%`),
        ilike(users.username, `%${searchTerm}%`),
        ilike(users.lastLoginIp, `%${searchTerm}%`)
      )
    )
  }

  return whereConditions.length > 0 ? and(...whereConditions) : undefined
}
