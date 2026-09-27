/**
 * ESLint 自定义规则：禁止 Vue SFC 使用 `lang="ts"`（S2-3 · D2 / AGENTS.md §2.2）
 *
 * 项目口径：Vue 组件统一 `<script setup>` 纯 JS，**禁止类型注解**。
 * 上一轮曾对 89 个 `.vue` 批量加 `lang="ts"` 作为「修 build」手段，直接违反规范 ——
 * 本规则把该口径变成可执行门禁（存量 19 个由 eslint 基线吸收入存量债，不允许新增）。
 */

const LANG_TS_PATTERN = /<script\b[^>]*\blang\s*=\s*["']ts["'][^>]*>/i

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Vue 组件禁止 lang="ts"（统一纯 JS <script setup>，见 AGENTS.md §2.2）'
    },
    schema: [],
    messages: {
      noLangTs: '禁止 lang="ts"：本项目 Vue 组件统一 `<script setup>` 纯 JS，不得写类型注解。'
    }
  },

  create(context) {
    const filename = context.getFilename()
    if (!filename.replace(/\\/g, '/').endsWith('.vue')) return {}

    return {
      Program(node) {
        const sourceCode = context.sourceCode ?? context.getSourceCode?.()
        const text = sourceCode?.text ?? ''
        if (LANG_TS_PATTERN.test(text)) {
          context.report({ node, messageId: 'noLangTs' })
        }
      }
    }
  }
}
