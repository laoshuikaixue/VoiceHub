import { db, users } from '~/drizzle/db'
import { inArray } from 'drizzle-orm'
import { createBatchSystemNotifications } from '~~/server/services/notificationService'
import { SmtpService } from '~~/server/services/smtpService'

// 注册通知：待审核时站内通知所有管理员；有邮箱时邮件通知注册结果（异步，失败不影响主流程）
export async function notifyRegistration(
  userId: number,
  username: string,
  name: string,
  email: string,
  requiresApproval: boolean
) {
  try {
    if (requiresApproval) {
      const adminResult = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.role, ['ADMIN', 'SUPER_ADMIN']))
      const adminIds = adminResult.map((u) => u.id)
      if (adminIds.length > 0) {
        await createBatchSystemNotifications(
          adminIds,
          '新用户注册待审核',
          `用户「${name}」（用户名：${username}）提交了注册申请，请前往用户管理审核。`,
          false
        )
      }
    }
    if (email) {
      const smtpService = SmtpService.getInstance()
      if (await smtpService.ensureInitialized()) {
        await smtpService.renderAndSend(email, 'register', {
          title: requiresApproval ? '注册申请已提交' : '注册成功',
          message: requiresApproval
            ? `${name}，您的注册申请已提交，请耐心等待管理员审核。`
            : `${name}，恭喜您注册成功，欢迎使用 VoiceHub！`
        })
      }
    }
  } catch (error) {
    console.error('注册通知发送失败:', error)
  }
}