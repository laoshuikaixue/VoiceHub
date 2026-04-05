export default defineEventHandler((event) => {
  // 检查用户认证和权限
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能查看环境变量'
    })
  }

  return {
    hasBaseConfig: !!(process.env.OAUTH_REDIRECT_URI || process.env.OAUTH_STATE_SECRET),
    hasGithubConfig: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    hasCasdoorConfig: !!(process.env.CASDOOR_ENDPOINT && process.env.CASDOOR_CLIENT_ID && process.env.CASDOOR_CLIENT_SECRET),
    hasGoogleConfig: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  }
})
