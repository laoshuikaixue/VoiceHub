import withNuxt from './.nuxt/eslint.config.mjs'
import noRawRoleCheck from './eslint-rules/no-raw-role-check.js'

export default withNuxt(
  // 全局忽略配置
  {
    ignores: [
      '**/vendor/**',
      '**/dist/**',
      '**/.output/**',
      '**/node_modules/**',
      '**/oh_modules/**',
      '**/*.min.js',
      '**/*.d.ts',
      '**/coverage/**',
      'app/drizzle/**',
      '**/build/**',
      '**/.preview/**',
      'VoiceHub-hmos/**'
    ]
  },
  // 自定义规则
  {
    plugins: {
      voicehub: {
        rules: {
          'no-raw-role-check': noRawRoleCheck
        }
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      // 允许使用any类型，避免大量重构
      '@typescript-eslint/no-explicit-any': 'warn',
      // 允许未使用的变量（开发过程中常见）
      '@typescript-eslint/no-unused-vars': 'warn',
      // 允许空的类，常用于工具类
      '@typescript-eslint/no-extraneous-class': 'off',
      // 允许不一致的类型导入，方便开发
      '@typescript-eslint/consistent-type-imports': 'off',
      // 允许无用的转义字符，避免误报
      'no-useless-escape': 'off',
      // 允许不规则的空格
      'no-irregular-whitespace': 'off',
      // 允许空的代码块
      'no-empty': 'warn',
      // 允许不安全的函数类型
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      // 允许require导入
      '@typescript-eslint/no-require-imports': 'off',
      // 允许未处理Promise
      '@typescript-eslint/no-floating-promises': 'off',
      // 禁止在 server/api/** 中直接判断 user.role 字面量；统一走 requirePermission
      'voicehub/no-raw-role-check': 'error'
    }
  }
)
