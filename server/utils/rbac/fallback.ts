/**
 * RBAC_ENABLED 运行时开关
 *
 * 背景：PR#559 引入基于点分权限 key 的新 RBAC 体系（permission catalog + 个人加授）。
 * 为避免在线上出问题时无法回滚，本模块提供单一权威开关：
 *
 *   RBAC_ENABLED=false → 走旧 user.role 字面量判断（与 RBAC 重构前等价）
 *   RBAC_ENABLED=true  → 走新 RBAC 解析（默认）
 *   未设置             → 走新 RBAC 解析（默认；opt-out 语义）
 *
 * 维护者原话：声称 PR 描述里有"代码层一键回退"，但全库无 RBAC_ENABLED 引用。
 * 本模块把描述落到真实代码。
 *
 * 兼容期：旧 server/utils/permissions.js 保留 30 天观察期，期间本开关可让线上
 * 实例瞬间切回旧路径，业务接口无感。
 */

export function isRbacEnabled(): boolean {
  // opt-out：默认启用新 RBAC；显式设为 'false' 才走 legacy 路径
  return process.env.RBAC_ENABLED !== 'false'
}
