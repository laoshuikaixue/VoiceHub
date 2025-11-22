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
const accountIpSwitchMonitor = new Map<string, { ipMap: Map<string, number>; windowStart: number }>()
const userBlockUntil = new Map<number, Date>()
const songVoteWindow = new Map<number, number[]>()
const songProtectUntil = new Map<number, Date>()
const songVoteIpBuckets = new Map<number, Map<string, number>>()
const userVoteStats = new Map<number, { emaPerMin: number; lastUpdate: number; windowTimestamps: number[] }>()

// 配置常量
const SECURITY_CONFIG = {
    MAX_FAILED_ATTEMPTS: 5,
    LOCK_DURATION_MINUTES: 10,
    IP_MONITOR_WINDOW_MINUTES: 10,
    IP_MAX_DIFFERENT_ACCOUNTS: 3,
    IP_BLOCK_DURATION_MINUTES: 10
}

const RISK_CONTROL = {
    IP_SWITCH_WINDOW_MS: 5 * 60 * 1000,
    IP_SWITCH_THRESHOLD: 3,
    IP_SWITCH_BLOCK_MINUTES: 10,
    USER_BLOCK_MINUTES: 10,
    SONG_VOTE_PROTECT_WINDOW_MS: 60 * 60 * 1000,
    SONG_VOTE_PROTECT_THRESHOLD: 10,
    SONG_VOTE_PROTECT_DURATION_MS: 10 * 60 * 1000,
    USER_BASELINE_MIN_PER_MIN: 0.5,
    USER_BASELINE_MULTIPLIER: 3,
    EMA_ALPHA: 0.2,
    SONG_IP_DOMINANCE_PERCENT: 0.6,
    SONG_IP_MIN_SAMPLE: 8
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

    for (const [username, monitor] of accountIpSwitchMonitor.entries()) {
        const cutoff = Date.now() - RISK_CONTROL.IP_SWITCH_WINDOW_MS
        for (const [ip, ts] of monitor.ipMap.entries()) {
            if (ts < cutoff) {
                monitor.ipMap.delete(ip)
            }
        }
        if (monitor.ipMap.size === 0) {
            accountIpSwitchMonitor.delete(username)
        }
    }

    for (const [songId, timestamps] of songVoteWindow.entries()) {
        const cutoff = Date.now() - RISK_CONTROL.SONG_VOTE_PROTECT_WINDOW_MS
        const filtered = timestamps.filter(t => t >= cutoff)
        if (filtered.length) {
            songVoteWindow.set(songId, filtered)
        } else {
            songVoteWindow.delete(songId)
        }
    }

    for (const [userId, stats] of userVoteStats.entries()) {
        const cutoff = Date.now() - 10 * 60 * 1000
        stats.windowTimestamps = stats.windowTimestamps.filter(t => t >= cutoff)
        if (stats.windowTimestamps.length === 0 && Date.now() - stats.lastUpdate > 60 * 60 * 1000) {
            userVoteStats.delete(userId)
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

export function blockUser(userId: number, minutes: number = RISK_CONTROL.USER_BLOCK_MINUTES): void {
    const until = new Date(Date.now() + minutes * 60 * 1000)
    userBlockUntil.set(userId, until)
}

export function isUserBlocked(userId: number): boolean {
    const until = userBlockUntil.get(userId)
    if (!until) return false
    return until > new Date()
}

export function getUserBlockRemainingTime(userId: number): number {
    const until = userBlockUntil.get(userId)
    if (!until) return 0
    const now = Date.now()
    if (until.getTime() <= now) return 0
    return Math.ceil((until.getTime() - now) / (1000 * 60))
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

export function recordAccountIpLogin(username: string, ip: string): boolean {
    const now = Date.now()
    let monitor = accountIpSwitchMonitor.get(username)
    if (!monitor) {
        monitor = { ipMap: new Map<string, number>(), windowStart: now }
        accountIpSwitchMonitor.set(username, monitor)
    }
    const cutoff = now - RISK_CONTROL.IP_SWITCH_WINDOW_MS
    for (const [k, ts] of monitor.ipMap.entries()) {
        if (ts < cutoff) monitor.ipMap.delete(k)
    }
    monitor.ipMap.set(ip, now)
    const exceeded = monitor.ipMap.size > RISK_CONTROL.IP_SWITCH_THRESHOLD
    if (exceeded) {
        blockIP(ip, '账号短期内多IP登录超限')
        triggerAccountIpSwitchAlert(username, Array.from(monitor.ipMap.keys()))
    }
    return exceeded
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

async function triggerAccountIpSwitchAlert(username: string, ips: string[]): Promise<void> {
    try {
        const now = new Date()
        const alertTitle = '安全警报：账号短期内多IP登录'
        const alertContent = `检测时间：${now.toLocaleString('zh-CN')}
账号：${username}
时间窗口：${Math.floor(RISK_CONTROL.IP_SWITCH_WINDOW_MS/60000)}分钟内
涉及IP数：${ips.length}

建议立即检查该账号的登录活动并采取必要的安全措施。`
        const meowAlertContent = alertContent
        const superAdmins = await db.select({
            id: users.id,
            name: users.name,
            meowNickname: users.meowNickname
        }).from(users).where(eq(users.role, 'SUPER_ADMIN'))
        for (const admin of superAdmins) {
            try {
                await createSystemNotification(admin.id, alertTitle, alertContent)
                if (admin.meowNickname) {
                    await sendMeowNotificationToUser(admin.id, alertTitle, meowAlertContent)
                }
            } catch {}
        }
    } catch (error) {
        console.error('触发账号IP切换警报时发生错误:', error)
    }
}

function ipBucketOf(ip: string): string {
    const parts = ip.split('.')
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}`
    return ip
}

export function isSongProtected(songId: number): boolean {
    const until = songProtectUntil.get(songId)
    if (!until) return false
    return until > new Date()
}

export function getSongProtectRemainingSeconds(songId: number): number {
    const until = songProtectUntil.get(songId)
    if (!until) return 0
    const now = Date.now()
    if (until.getTime() <= now) return 0
    return Math.ceil((until.getTime() - now) / 1000)
}

export function recordSongVote(songId: number, ip: string, userId: number): boolean {
    const now = Date.now()
    const arr = songVoteWindow.get(songId) || []
    const cutoff = now - RISK_CONTROL.SONG_VOTE_PROTECT_WINDOW_MS
    const filtered = arr.filter(t => t >= cutoff)
    filtered.push(now)
    songVoteWindow.set(songId, filtered)
    const buckets = songVoteIpBuckets.get(songId) || new Map<string, number>()
    const b = ipBucketOf(ip)
    buckets.set(b, (buckets.get(b) || 0) + 1)
    songVoteIpBuckets.set(songId, buckets)
    if (filtered.length > RISK_CONTROL.SONG_VOTE_PROTECT_THRESHOLD) {
        songProtectUntil.set(songId, new Date(now + RISK_CONTROL.SONG_VOTE_PROTECT_DURATION_MS))
        triggerSongVoteBurstAlert(songId, filtered.length, buckets)
        return true
    }
    return false
}

export function recordUserVoteActivity(userId: number): { anomaly: boolean } {
    const now = Date.now()
    let stats = userVoteStats.get(userId)
    if (!stats) {
        stats = { emaPerMin: 0, lastUpdate: now, windowTimestamps: [] }
        userVoteStats.set(userId, stats)
    }
    const dtMin = Math.max(1e-6, (now - stats.lastUpdate) / 60000)
    const currentRate = 1 / dtMin
    stats.emaPerMin = RISK_CONTROL.EMA_ALPHA * currentRate + (1 - RISK_CONTROL.EMA_ALPHA) * stats.emaPerMin
    stats.lastUpdate = now
    const cutoff = now - 10 * 60 * 1000
    stats.windowTimestamps = stats.windowTimestamps.filter(t => t >= cutoff)
    stats.windowTimestamps.push(now)
    const threshold = Math.max(RISK_CONTROL.USER_BASELINE_MIN_PER_MIN, stats.emaPerMin * RISK_CONTROL.USER_BASELINE_MULTIPLIER)
    const anomaly = currentRate > threshold
    if (anomaly) triggerVoteAnomalyAlert(userId, stats.emaPerMin, currentRate)
    return { anomaly }
}

async function triggerSongVoteBurstAlert(songId: number, count: number, buckets: Map<string, number>): Promise<void> {
    try {
        const now = new Date()
        const top = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1])[0]
        const alertTitle = '风险告警：歌曲投票短时激增'
        const alertContent = `检测时间：${now.toLocaleString('zh-CN')}
歌曲ID：${songId}
窗口内票数：${count}
主导IP段：${top ? `${top[0]}.* (${top[1]})` : '无'}

已启动临时保护，暂停投票10分钟。`
        const meowAlertContent = alertContent
        const superAdmins = await db.select({
            id: users.id,
            name: users.name,
            meowNickname: users.meowNickname
        }).from(users).where(eq(users.role, 'SUPER_ADMIN'))
        for (const admin of superAdmins) {
            try {
                await createSystemNotification(admin.id, alertTitle, alertContent)
                if (admin.meowNickname) {
                    await sendMeowNotificationToUser(admin.id, alertTitle, meowAlertContent)
                }
            } catch {}
        }
    } catch (error) {
        console.error('触发歌曲投票激增警报时发生错误:', error)
    }
}

async function triggerVoteAnomalyAlert(userId: number, ema: number, rate: number): Promise<void> {
    try {
        const now = new Date()
        const alertTitle = '风险告警：检测到异常投票速率'
        const alertContent = `检测时间：${now.toLocaleString('zh-CN')}
用户ID：${userId}
EMA基线：${ema.toFixed(2)} 次/分钟
当前速率：${rate.toFixed(2)} 次/分钟`
        const meowAlertContent = alertContent
        const superAdmins = await db.select({
            id: users.id,
            name: users.name,
            meowNickname: users.meowNickname
        }).from(users).where(eq(users.role, 'SUPER_ADMIN'))
        for (const admin of superAdmins) {
            try {
                await createSystemNotification(admin.id, alertTitle, alertContent)
                if (admin.meowNickname) {
                    await sendMeowNotificationToUser(admin.id, alertTitle, meowAlertContent)
                }
            } catch {}
        }
    } catch (error) {
        console.error('触发投票异常警报时发生错误:', error)
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