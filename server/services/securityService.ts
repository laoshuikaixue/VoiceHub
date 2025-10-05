import {createSystemNotification} from './notificationService'
import {sendMeowNotificationToUser} from './meowNotificationService'
import {db} from '~/drizzle/db'
import {users} from '~/drizzle/schema'
import {eq} from 'drizzle-orm'

// 账户锁定信息接口
interface AccountLockInfo {
    failedAttempts: number
    lockedUntil: Date | null
    lastAttemptTime: Date
}

// IP监控信息接口
interface IPMonitorInfo {
    attemptedAccounts: Set<string>
    firstAttemptTime: Date
    lastAttemptTime: Date
}

// IP黑名单信息接口
interface IPBlockInfo {
    blockedUntil: Date
    reason: string
    blockedTime: Date
}

// 内存存储
const accountLocks = new Map<string, AccountLockInfo>()
const ipMonitor = new Map<string, IPMonitorInfo>()
const ipBlacklist = new Map<string, IPBlockInfo>()

// 配置常量
const SECURITY_CONFIG = {
    MAX_FAILED_ATTEMPTS: 5,
    LOCK_DURATION_MINUTES: 10,
    IP_MONITOR_WINDOW_MINUTES: 10,
    IP_MAX_DIFFERENT_ACCOUNTS: 3,
    IP_BLOCK_DURATION_MINUTES: 10 // IP被限制的时长（分钟）
}

/**
 * 清理过期的锁定记录
 */
function cleanupExpiredLocks() {
    const now = new Date()

    // 清理过期的账户锁定
    for (const [username, lockInfo] of accountLocks.entries()) {
        if (lockInfo.lockedUntil && lockInfo.lockedUntil <= now) {
            accountLocks.delete(username)
        }
    }

    // 清理过期的IP监控记录
    for (const [ip, monitorInfo] of ipMonitor.entries()) {
        const windowStart = new Date(now.getTime() - SECURITY_CONFIG.IP_MONITOR_WINDOW_MINUTES * 60 * 1000)
        if (monitorInfo.firstAttemptTime < windowStart) {
            ipMonitor.delete(ip)
        }
    }

    // 清理过期的IP黑名单记录
    for (const [ip, blockInfo] of ipBlacklist.entries()) {
        if (blockInfo.blockedUntil <= now) {
            ipBlacklist.delete(ip)
            console.log(`IP ${ip} 已从黑名单中移除`)
        }
    }
}

/**
 * 检查账户是否被锁定
 */
export function isAccountLocked(username: string): boolean {
    cleanupExpiredLocks()

    const lockInfo = accountLocks.get(username)
    if (!lockInfo || !lockInfo.lockedUntil) {
        return false
    }

    return lockInfo.lockedUntil > new Date()
}

/**
 * 获取账户锁定剩余时间（分钟）
 */
export function getAccountLockRemainingTime(username: string): number {
    const lockInfo = accountLocks.get(username)
    if (!lockInfo || !lockInfo.lockedUntil) {
        return 0
    }

    const now = new Date()
    if (lockInfo.lockedUntil <= now) {
        return 0
    }

    return Math.ceil((lockInfo.lockedUntil.getTime() - now.getTime()) / (1000 * 60))
}

/**
 * 检查IP是否被限制
 */
export function isIPBlocked(ip: string): boolean {
    cleanupExpiredLocks()

    const blockInfo = ipBlacklist.get(ip)
    if (!blockInfo) {
        return false
    }

    return blockInfo.blockedUntil > new Date()
}

/**
 * 获取IP限制剩余时间（分钟）
 */
export function getIPBlockRemainingTime(ip: string): number {
    const blockInfo = ipBlacklist.get(ip)
    if (!blockInfo) {
        return 0
    }

    const now = new Date()
    if (blockInfo.blockedUntil <= now) {
        return 0
    }

    return Math.ceil((blockInfo.blockedUntil.getTime() - now.getTime()) / (1000 * 60))
}

/**
 * 将IP加入黑名单
 */
function blockIP(ip: string, reason: string): void {
    const now = new Date()
    const blockedUntil = new Date(now.getTime() + SECURITY_CONFIG.IP_BLOCK_DURATION_MINUTES * 60 * 1000)

    ipBlacklist.set(ip, {
        blockedUntil,
        reason,
        blockedTime: now
    })

    console.log(`IP ${ip} 已被加入黑名单，限制时长 ${SECURITY_CONFIG.IP_BLOCK_DURATION_MINUTES} 分钟，原因：${reason}`)
}

/**
 * 记录登录失败
 */
export function recordLoginFailure(username: string, ip: string): void {
    const now = new Date()

    // 记录账户失败尝试
    let lockInfo = accountLocks.get(username)
    if (!lockInfo) {
        lockInfo = {
            failedAttempts: 0,
            lockedUntil: null,
            lastAttemptTime: now
        }
        accountLocks.set(username, lockInfo)
    }

    lockInfo.failedAttempts++
    lockInfo.lastAttemptTime = now

    // 检查是否需要锁定账户
    if (lockInfo.failedAttempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
        lockInfo.lockedUntil = new Date(now.getTime() + SECURITY_CONFIG.LOCK_DURATION_MINUTES * 60 * 1000)
        console.log(`账户 ${username} 因连续 ${SECURITY_CONFIG.MAX_FAILED_ATTEMPTS} 次登录失败被锁定 ${SECURITY_CONFIG.LOCK_DURATION_MINUTES} 分钟`)
    }

    // 记录IP监控信息
    recordIPAttempt(ip, username)
}

/**
 * 记录成功登录（清除失败记录）
 */
export function recordLoginSuccess(username: string, ip: string): void {
    accountLocks.delete(username)

    // 记录IP监控信息（成功登录也需要监控）
    recordIPAttempt(ip, username)
}

/**
 * 记录IP登录尝试
 */
function recordIPAttempt(ip: string, username: string): void {
    const now = new Date()
    const windowStart = new Date(now.getTime() - SECURITY_CONFIG.IP_MONITOR_WINDOW_MINUTES * 60 * 1000)

    let monitorInfo = ipMonitor.get(ip)
    if (!monitorInfo) {
        monitorInfo = {
            attemptedAccounts: new Set<string>(),
            firstAttemptTime: now,
            lastAttemptTime: now
        }
        ipMonitor.set(ip, monitorInfo)
    }

    // 如果监控窗口已过期，重置记录
    if (monitorInfo.firstAttemptTime < windowStart) {
        monitorInfo.attemptedAccounts.clear()
        monitorInfo.firstAttemptTime = now
    }

    monitorInfo.attemptedAccounts.add(username)
    monitorInfo.lastAttemptTime = now

    // 检查是否触发异常行为警报
    if (monitorInfo.attemptedAccounts.size > SECURITY_CONFIG.IP_MAX_DIFFERENT_ACCOUNTS) {
        triggerSecurityAlert(ip, Array.from(monitorInfo.attemptedAccounts))
    }
}

/**
 * 触发安全警报
 */
async function triggerSecurityAlert(ip: string, attemptedAccounts: string[]): Promise<void> {
    try {
        const now = new Date()
        const alertTitle = '安全警报：检测到异常登录行为'
        const alertContent = `
检测时间：${now.toLocaleString('zh-CN')}
异常IP：${ip}
时间窗口：${SECURITY_CONFIG.IP_MONITOR_WINDOW_MINUTES}分钟内
尝试登录账户数：${attemptedAccounts.length}
涉及账户：${attemptedAccounts.join(', ')}

建议立即检查该IP的登录活动并采取必要的安全措施。
    `.trim()

        // Meow通知内容，包含完整的涉及账户信息
        const meowAlertContent = `
检测时间：${now.toLocaleString('zh-CN')}
异常IP：${ip}
时间窗口：${SECURITY_CONFIG.IP_MONITOR_WINDOW_MINUTES}分钟内
尝试登录账户数：${attemptedAccounts.length}
涉及账户：${attemptedAccounts.join(', ')}

建议立即检查该IP的登录活动并采取必要的安全措施。
    `.trim()

        console.log(`安全警报：IP ${ip} 在 ${SECURITY_CONFIG.IP_MONITOR_WINDOW_MINUTES} 分钟内尝试登录 ${attemptedAccounts.length} 个不同账户`)

        // 将触发警报的IP加入黑名单
        blockIP(ip, `异常登录行为：${SECURITY_CONFIG.IP_MONITOR_WINDOW_MINUTES}分钟内尝试登录${attemptedAccounts.length}个不同账户`)

        // 获取所有超级管理员
        const superAdmins = await db.select({
            id: users.id,
            name: users.name,
            meowNickname: users.meowNickname
        }).from(users).where(eq(users.role, 'SUPER_ADMIN'))

        // 向所有超级管理员发送站内信
        for (const admin of superAdmins) {
            try {
                await createSystemNotification(admin.id, alertTitle, alertContent)
                console.log(`已向超级管理员 ${admin.name} 发送安全警报站内信`)

                // 如果管理员绑定了Meow推送，同时发送推送通知
                if (admin.meowNickname) {
                    const success = await sendMeowNotificationToUser(
                        admin.id,
                        alertTitle,
                        meowAlertContent
                    )

                    if (success) {
                        console.log(`已向超级管理员 ${admin.name} 发送Meow推送警报`)
                    } else {
                        console.log(`向超级管理员 ${admin.name} 发送Meow推送警报失败`)
                    }
                }
            } catch (error) {
                console.error(`向超级管理员 ${admin.name} 发送安全警报失败:`, error)
            }
        }

        // 重置该IP的监控记录，避免重复警报
        ipMonitor.delete(ip)

    } catch (error) {
        console.error('触发安全警报时发生错误:', error)
    }
}

/**
 * 获取安全统计信息
 */
export function getSecurityStats() {
    cleanupExpiredLocks()

    return {
        lockedAccounts: accountLocks.size,
        monitoredIPs: ipMonitor.size,
        blockedIPs: ipBlacklist.size,
        config: SECURITY_CONFIG
    }
}

// 定期清理过期记录（每5分钟执行一次）
setInterval(cleanupExpiredLocks, 5 * 60 * 1000)