import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES, THEMES, DEFAULT_THEMES } from '~~/server/config/constants'

export const parseThemeArray = (value: unknown, fallback = DEFAULT_THEMES): string[] => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(parsed)) return [...fallback]
    const themes = [...new Set(parsed.filter((theme): theme is string => typeof theme === 'string' && THEMES.includes(theme as typeof THEMES[number])))]
    return themes.length > 0 ? themes : [...fallback]
  } catch {
    return [...fallback]
  }
}

export const validateThemeConfig = (defaultTheme: unknown, enabledThemes: unknown) => {
  if (typeof defaultTheme !== 'string' || !THEMES.includes(defaultTheme as typeof THEMES[number])) {
    throw createApiError(400, SERVER_ERROR_CODES.THEME_INVALID_DEFAULT, '默认主题无效')
  }
  if (typeof enabledThemes !== 'string') {
    throw createApiError(400, SERVER_ERROR_CODES.THEME_INVALID_LIST, '启用的主题列表格式无效')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(enabledThemes)
  } catch {
    throw createApiError(400, SERVER_ERROR_CODES.THEME_INVALID_LIST, '启用的主题列表格式无效')
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((theme) => typeof theme !== 'string' || !THEMES.includes(theme as typeof THEMES[number]))) {
    throw createApiError(400, SERVER_ERROR_CODES.THEME_INVALID_LIST, '启用的主题列表无效')
  }
  const themes = [...new Set(parsed)] as string[]
  if (!themes.includes(defaultTheme)) {
    throw createApiError(400, SERVER_ERROR_CODES.THEME_INVALID_DEFAULT, '默认主题必须处于启用状态')
  }
  if (themes.includes('System') && (!themes.includes('ClassicDark') || !themes.includes('ClassicLight'))) {
    throw createApiError(400, SERVER_ERROR_CODES.THEME_SYSTEM_REQUIRES_CLASSIC, '跟随系统时必须同时启用经典深色和经典浅色')
  }
  return themes
}
