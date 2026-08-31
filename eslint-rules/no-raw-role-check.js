/**
 * ESLint 自定义规则：禁止 server/api/** 中直接判断 user.role 字面量
 *
 * 背景：124+ 处 `if (!user || !['ADMIN','SUPER_ADMIN'].includes(user.role))`
 * 的散落写法是 RBAC 重构要消除的源头。本规则强制业务接口走
 * `requirePermission(event, key)` 统一路径。
 *
 * 检测形式：
 *   - 字符串字面量包含 "user.role"
 *   - MemberExpression：property.name === 'role' 且 object.name === 'user'
 *   - OptionalMemberExpression：同上
 *   - TS 解构：const { role } = user
 *
 * 允许：
 *   - 对象字面量属性赋值：{ role: user.role }（用于登录响应序列化）
 *   - server/utils/rbac/**、server/utils/requireSongAdmin.ts、
 *     server/utils/permissions.js（fallback 30 天）
 */

function isAllowedPath(filename) {
  return /(server[\/\\]+utils[\/\\]+(rbac|requireSongAdmin|permissions))/.test(filename)
}

function isUserRoleMember(node) {
  if (!node) return false
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    const prop = node.property
    const obj = node.object
    if (prop && (prop.name === 'role' || prop.value === 'role')) {
      if (obj && (obj.name === 'user' || obj.value === 'user')) return true
    }
  }
  return false
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        '禁止在 server/api/** 中直接判断 user.role；应使用 requirePermission(event, key)。'
    },
    schema: [],
    messages: {
      noRawRoleCheck:
        '禁止直接判断 user.role。请使用 requirePermission(event, PERMISSIONS.*)。'
    }
  },

  create(context) {
    const filename = context.getFilename()
    if (!filename.includes('server/api/') && !filename.includes('server\\api\\')) {
      return {}
    }
    if (isAllowedPath(filename)) {
      return {}
    }

    function checkLiteral(node) {
      if (typeof node.value !== 'string') return
      if (node.value.includes('user.role')) {
        context.report({ node, messageId: 'noRawRoleCheck' })
      }
    }

    function checkMember(node) {
      // 允许对象字面量属性赋值（Property.value 是 MemberExpression）
      if (node.parent && node.parent.type === 'Property' && node.parent.value === node) {
        return
      }
      // 允许函数实参位置（如 setCookie(event, ..., user.role, ...)）
      if (node.parent && node.parent.type === 'CallExpression') {
        return
      }
      // 允许 OptionalChain 包装（user?.role 在 isAdminRole(user?.role) 中）
      if (node.parent && node.parent.type === 'ChainExpression') {
        return
      }
      if (isUserRoleMember(node)) {
        context.report({ node, messageId: 'noRawRoleCheck' })
      }
    }

    return {
      Literal: checkLiteral,
      TemplateElement(node) {
        if (!node.value || typeof node.value.raw !== 'string') return
        if (node.value.raw.includes('user.role')) {
          context.report({ node, messageId: 'noRawRoleCheck' })
        }
      },
      MemberExpression: checkMember,
      OptionalMemberExpression: checkMember,
      // TS 解构：const { role } = user
      Property(node) {
        if (!node.value) return
        const value = node.value
        if (value.type === 'Identifier' && value.name === 'user' &&
            node.key && (node.key.name === 'role' || node.key.value === 'role')) {
          context.report({ node, messageId: 'noRawRoleCheck' })
        }
      }
    }
  }
}
