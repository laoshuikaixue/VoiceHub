/**
 * 主题图片 composable。
 * 提供与主题绑定的 SVG 图片路径，方便组件根据当前主题选择正确的图片。
 *
 * 图片存放在 public/themes/{ClassicDark,ClassicLight}/ 目录下，运行时通过 data-theme attribute 动态选择。
 */
import { useTheme } from '~/composables/useTheme'

export function useThemeImage() {
  const { currentTheme } = useTheme()

  /** 获取指定键名的主题 SVG 路径 */
  function getThemeSvg(key: string) {
    return `/themes/${currentTheme.value}/${key}`
  }

  /** 获取 Logo SVG 路径 */
  function getLogo() {
    return getThemeSvg('logo.svg')
  }

  /** 获取搜索图标 SVG 路径 */
  function getSearchIcon() {
    return getThemeSvg('search.svg')
  }

  /** 获取点赞图标 SVG 路径 */
  function getThumbsUpIcon() {
    return getThemeSvg('thumbs-up.svg')
  }

  return {
    getLogo,
    getSearchIcon,
    getThumbsUpIcon
  }
}
