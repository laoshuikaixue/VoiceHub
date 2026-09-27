/**
 * ESLint 自定义规则：禁止裸读 `<任意表达式>.role`（S2-3 · R-18 / R-20 / R-34）
 *
 * 背景（上一轮规则的 3 个逃逸口，导致「0 违规」是假绿，实测 `server/api/**` 仍有 29 处）：
 *   ① 对象字面量属性（`{ role: user.role }` 直接放行）
 *   ② 任何函数实参（`includes(user.role)` / `setCookie(..., user.role)` 全放行）
 *   ③ `ChainExpression`（`user?.role` 一律放行）
 * 本规则取消①②③，只保留**唯一豁免形态**：作为白名单函数的直接实参
 *   `isSuperAdmin(x.role)` / `isAdminRole(x.role)` / `isSongAdminRole(x.role)` /
 *   `getUserRole(x.role)` / `extractUserIdentity(...)`（它们把读 role 的职责下沉到内核）。
 *
 * 作用范围：`server/api/**`（S3 的收敛目标；S3 收尾要求该目录零裸读）。
 *   内核目录 `server/utils/rbac/**` 天然不在范围内（它必须读 role）。
 *
 * 不豁免的写法（都要报）：
 *   `const r = targetUser.role` / `const { role } = user` / `user?.role === 'ADMIN'` /
 *   `['ADMIN','SUPER_ADMIN'].includes(user.role)` / `user['role']`
 */

const WHITELIST_FUNCTIONS = new Set([
  'isSuperAdmin',
  'isAdminRole',
  'isSongAdminRole',
  'getUserRole',
  'extractUserIdentity'
])

const RULE_SCOPE = /(^|\/)server\/api\//
const KERNEL_SCOPE = /(^|\/)server\/utils\/rbac\//

function inScope(filename) {
  const normalized = filename.replace(/\\/g, '/')
  if (KERNEL_SCOPE.test(normalized)) return false
  return RULE_SCOPE.test(normalized)
}

function isRoleProperty(node) {
  const property = node.property
  if (!property) return false
  if (node.computed) return property.value === 'role'
  return property.name === 'role'
}

function isRoleMemberExpression(node) {
  return (
    (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') &&
    isRoleProperty(node)
  )
}

/** 白名单豁免：`x.role`（或其 ChainExpression 包装）作为白名单函数的直接实参 */
function isWhitelistedArgument(node) {
  const container = node.parent && node.parent.type === 'ChainExpression' ? node.parent : node
  const call = container.parent
  if (!call || call.type !== 'CallExpression') return false
  const args = call.arguments || []
  if (!args.includes(container)) return false
  const callee = call.callee
  return Boolean(callee) && callee.type === 'Identifier' && WHITELIST_FUNCTIONS.has(callee.name)
}

/** 解构读取 role（`const { role } = user` / 函数参数解构） */
function isDestructuringRole(node) {
  const parent = node.parent
  if (!parent || parent.type !== 'ObjectPattern') return false
  const key = node.key
  if (!key) return false
  return key.name === 'role' || key.value === 'role'
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        '禁止在 server/api/** 裸读 .role；应使用 requirePermission(event, PERMISSIONS.*) 或内核对白名单函数。'
    },
    schema: [],
    messages: {
      noRawRoleCheck:
        '禁止裸读 .role。请使用 requirePermission(event, PERMISSIONS.*)；确需按角色分支时用 server/utils/rbac 的白名单函数（isSuperAdmin/isAdminRole/isSongAdminRole/getUserRole/extractUserIdentity）。'
    }
  },

  create(context) {
    const filename = context.getFilename()
    if (!inScope(filename)) return {}

    return {
      MemberExpression(node) {
        if (!isRoleMemberExpression(node)) return
        if (isWhitelistedArgument(node)) return
        context.report({ node, messageId: 'noRawRoleCheck' })
      },
      OptionalMemberExpression(node) {
        if (!isRoleMemberExpression(node)) return
        if (isWhitelistedArgument(node)) return
        context.report({ node, messageId: 'noRawRoleCheck' })
      },
      Property(node) {
        if (!isDestructuringRole(node)) return
        context.report({ node, messageId: 'noRawRoleCheck' })
      }
    }
  }
}
