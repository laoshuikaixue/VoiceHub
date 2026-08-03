/**
 * 主题图片 composable。
 * 提供与主题绑定的图片路径，方便组件根据当前主题选择正确的图片。
 *
 * 图片存放在 public/themes/{light,dark}/ 目录下，运行时通过 data-theme attribute 动态选择。
 */
import { useTheme } from '~/composables/useTheme'

export function useThemeImage() {
  const { currentTheme } = useTheme()

  /** 获取指定键名的主题图片路径 */
  function getThemeImage(key: string) {
    return `/themes/${currentTheme.value}/${key}`
  }

  /** 获取 logo SVG 路径 */
  function getLogo() {
    return getThemeImage('logo.svg')
  }

  /** 获取 logo PNG 路径 */
  function getLogoPng() {
    return getThemeImage('logo.png')
  }

  /** 获取搜索图标路径 */
  function getSearchIcon() {
    return getThemeImage('search.svg')
  }

  /** 获取点赞图标路径 */
  function getThumbsUpIcon() {
    return getThemeImage('thumbs-up.svg')
  }

  return {
    getLogo,
    getLogoPng,
    getSearchIcon,
    getThumbsUpIcon
  }
}
