import {db} from '~/drizzle/db'
import {semesters} from '~/drizzle/schema'
import {eq} from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    try {
        // 获取当前活跃的学期
        const currentSemesterResult = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1)
        const currentSemester = currentSemesterResult[0]

        if (!currentSemester) {
            // 如果没有活跃学期，返回默认学期名称
            return {
                name: getCurrentSemester() // 使用原有的逻辑作为后备
            }
        }

        return currentSemester
    } catch (error: any) {
        console.error('获取当前学期失败:', error)

        // 如果出错，返回默认学期名称
        return {
            name: getCurrentSemester()
        }
    }
})

// 获取当前学期的后备函数
function getCurrentSemester() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    // 假设上学期为9-2月，下学期为3-8月
    const term = month >= 3 && month <= 8 ? '下' : '上'

    // 如果是上学期（9-12月），年份应该是当前年份
    // 如果是上学期（1-2月），年份应该是前一年
    // 如果是下学期（3-8月），年份应该是当前年份
    const academicYear = month >= 9 ? year : (month <= 2 ? year - 1 : year)

    return `${academicYear}-${academicYear + 1}学年${term}学期`
}
