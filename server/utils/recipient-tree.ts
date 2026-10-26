/**
 * 组织树里「未设置年级 / 未设置班级」的占位值。
 *
 * 数据库里这两个字段允许为 null，如果树和过滤接口各自用不同写法表示「未设置」，
 * 前端点开分组后就会查不到人。统一在这里定义，供树接口与接收人查询接口共用。
 * 真实年级/班级名称不会以双下划线开头，不存在冲突风险。
 */
export const UNSET_KEY = '__unset__'

/** 判断某个值是否是「未设置」占位值 */
export function isUnsetKey(value: unknown): boolean {
  return value === UNSET_KEY
}
