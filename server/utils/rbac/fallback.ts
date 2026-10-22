/**
 * RBAC 运行时开关（S2-2 · D6 / R-25）
 *
 *   RBAC_ENABLED=false → 走 legacy 角色判断（catalog 的 minRole 派生，见 legacyRoleCheck.ts）
 *   未设置 / 其它值    → 走新 RBAC 路径（opt-out 语义，默认开启）
 *
 * R-25：`requirePermission` / `requireAnyPermission` / `requireSuperAdmin` 及其它 guard
 * 必须共享**同一个** `isRbacEnabled()` 语义——上一轮 `requireAnyPermission` 漏了这个分叉，
 * 导致回滚开关对它完全无效（总纲已登记）。
 *
 * 本模块必须能被 plain node 直接 import（无 Nuxt 别名依赖），且不使用 `Date.now()`。
 */

/**
 * 是否启用新 RBAC 路径。
 * @param env 便于单测注入，默认 `process.env`
 */
export function isRbacEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.RBAC_ENABLED !== 'false'
}
