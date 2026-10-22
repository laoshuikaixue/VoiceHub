import { canReadSystemSettings } from '~~/server/utils/rbac'

const hasEnvValue = (value?: string) => typeof value === 'string' && value.trim().length > 0

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  await canReadSystemSettings(event)

  return {
    hasBaseConfig: !!(process.env.OAUTH_REDIRECT_URI || process.env.OAUTH_STATE_SECRET),
    hasGithubConfig: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    hasCasdoorConfig: !!(
      process.env.CASDOOR_ENDPOINT &&
      process.env.CASDOOR_CLIENT_ID &&
      process.env.CASDOOR_CLIENT_SECRET
    ),
    hasGoogleConfig: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    hasAggregateConfig:
      hasEnvValue(process.env.AGGREGATE_OAUTH_APP_ID) &&
      hasEnvValue(process.env.AGGREGATE_OAUTH_APP_KEY)
  }
})
