import { ref } from 'vue'
import { useLocale } from '~/utils/locale'

interface ToastMessage {
  id: number
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration: number
}

const toasts = ref<ToastMessage[]>([])
let toastId = 0

const exactToastTranslations: Record<string, string> = {
  需要登录才能点歌: 'Please sign in to request songs',
  需要登录才能投票: 'Please sign in to vote',
  您已经为这首歌投过票了: 'You have already voted for this song',
  需要登录才能撤回歌曲: 'Please sign in to withdraw songs',
  需要登录才能删除歌曲: 'Please sign in to delete songs',
  歌曲已成功删除: 'Song deleted successfully',
  '歌曲已成功删除！': 'Song deleted successfully',
  需要登录才能标记歌曲: 'Please sign in to mark songs',
  '歌曲已成功标记为已播放！': 'Song marked as played successfully',
  需要登录才能撤回歌曲已播放状态: 'Please sign in to revert played status',
  '歌曲已成功撤回已播放状态！': 'Song played status reverted successfully',
  需要登录才能申请重播: 'Please sign in to request replay',
  申请重播成功: 'Replay request submitted',
  您已经申请过重播这首歌了: 'You have already requested replay for this song',
  需要登录才能取消重播申请: 'Please sign in to cancel replay request',
  已取消重播申请: 'Replay request canceled',
  没有上一首歌曲: 'No previous song',
  没有下一首歌曲: 'No next song',
  播放上一首歌曲失败: 'Failed to play previous song',
  播放下一首歌曲失败: 'Failed to play next song',
  浏览器限制了自动播放，请点击播放器中的播放按钮继续播放:
    'The browser blocked autoplay. Click the play button in the player to continue.',
  浏览器拦截了新标签页，请允许弹窗后重试:
    'The browser blocked the new tab. Allow pop-ups and try again.',
  已为你打开原始链接: 'Opened the original link for you',
  当前播放链接无效，已切换备用音源: 'Current playback link is invalid. Switched to a backup source.',
  连续多首歌曲播放失败，已停止自动播放:
    'Multiple songs failed to play consecutively. Autoplay has been stopped.',
  哔哩哔哩视频播放失败，自动跳过: 'Bilibili video playback failed. Skipping automatically.',
  已切换为单曲循环: 'Switched to single-track loop',
  已切换为单曲播放: 'Switched to single-track playback',
  已切换为列表循环: 'Switched to playlist loop',
  请先登录网易云账号后再点赞评论: 'Please sign in to NetEase Cloud Music before liking comments',
  评论点赞失败: 'Failed to like comment',
  导入失败: 'Import failed',
  预览已刷新: 'Preview refreshed',
  正在准备打印: 'Preparing print...',
  '正在准备打印...': 'Preparing print...',
  PDF导出成功: 'PDF exported successfully',
  正在准备PDF: 'Preparing PDF...',
  '正在准备PDF...': 'Preparing PDF...',
  预览内容未找到: 'Preview content not found',
  排期内容过长，将自动分段导出: 'Schedule content is too long. It will be exported in sections.',
  图片导出成功: 'Image exported successfully',
  当前没有排期数据，请先在排期管理中添加排期:
    'No schedule data yet. Add schedules in Schedule Management first.',
  快速合并内存不足，已切换兼容模式重试:
    'Not enough memory for quick merge. Retrying in compatibility mode.',
  导入环境配置失败: 'Failed to import environment configuration',
  用户删除成功: 'User deleted successfully',
  禁止在用户管理中修改自己的账户: 'You cannot modify your own account in User Management',
  禁止在用户管理中重置自己的密码: 'You cannot reset your own password in User Management',
  不能删除自己的账户: 'You cannot delete your own account',
  密码重置成功: 'Password reset successfully',
  Excel处理库加载失败，请刷新页面后重试:
    'Failed to load the Excel processing library. Refresh the page and try again.',
  歌曲已成功上传到网易云音乐云盘: 'Song uploaded to NetEase Cloud Music Drive successfully',
  数据库恢复完成，3秒后将返回首页重新登录:
    'Database restore completed. Returning home to sign in again in 3 seconds.',
  无法解析备份文件，请检查文件格式是否正确: 'Unable to parse backup file. Please check the file format.',
  '无法解析备份文件，请检查文件格式是否正确。':
    'Unable to parse backup file. Please check the file format.',
  文件下载失败: 'File download failed',
  未知错误: 'Unknown error'
}

const translateToastMessage = (message: string) => {
  const { currentLocale } = useLocale()
  if (currentLocale.value === 'zh-CN') return message

  const normalized = message.trim()
  const withoutPunctuation = normalized.replace(/[。！]$/, '')

  if (exactToastTranslations[normalized]) return exactToastTranslations[normalized]
  if (exactToastTranslations[withoutPunctuation]) return exactToastTranslations[withoutPunctuation]

  const dynamicRules: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^已取消对歌曲《(.+)》的投票$/, (match) => `Vote for "${match[1]}" canceled`],
    [/^为歌曲《(.+)》投票成功！?$/, (match) => `Voted for "${match[1]}" successfully`],
    [/^播放失败:\s*(.+)$/, (match) => `Playback failed: ${match[1]}`],
    [/^上传失败:\s*(.+)$/, (match) => `Upload failed: ${match[1]}`],
    [/^预下载失败:\s*(.+)$/, (match) => `Pre-download failed: ${match[1]}`],
    [/^合并失败:\s*(.+)$/, (match) => `Merge failed: ${match[1]}`],
    [/^加载排期失败:\s*(.+)$/, (match) => `Failed to load schedule: ${match[1]}`],
    [/^打印失败:\s*(.+)$/, (match) => `Print failed: ${match[1]}`],
    [/^导出PDF失败:\s*(.+)$/, (match) => `Failed to export PDF: ${match[1]}`],
    [/^导出长图失败:\s*(.+)$/, (match) => `Failed to export long image: ${match[1]}`],
    [/^删除用户失败:\s*(.+)$/, (match) => `Failed to delete user: ${match[1]}`],
    [/^加载用户失败:\s*(.+)$/, (match) => `Failed to load users: ${match[1]}`],
    [/^导入备份失败:\s*(.+)$/, (match) => `Failed to import backup: ${match[1]}`],
    [/^备份导入失败:\s*(.+)$/, (match) => `Backup import failed: ${match[1]}`],
    [/^创建备份失败:\s*(.+)$/, (match) => `Failed to create backup: ${match[1]}`],
    [/^备份文件已下载:\s*(.+)$/, (match) => `Backup file downloaded: ${match[1]}`],
    [/^成功下载\s*(\d+)\s*首歌曲$/, (match) => `Downloaded ${match[1]} songs successfully`],
    [/^已完成分段导出，共\s*(\d+)\s*张图片$/, (match) => `Sectioned export completed with ${match[1]} images`],
    [/^部分更新成功，(.+)$/, (match) => `Partially updated successfully, ${match[1]}`],
    [/^成功更新\s*(\d+)\s*个用户的年级$/, (match) => `Updated grades for ${match[1]} users successfully`],
    [/^(.+)失败:\s*(.+)$/, (match) => `${match[1]} failed: ${match[2]}`]
  ]

  for (const [pattern, translate] of dynamicRules) {
    const match = normalized.match(pattern)
    if (match) return translate(match)
  }

  return message
}

export const useToast = () => {
  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    duration = 3000
  ) => {
    const id = ++toastId
    const toast: ToastMessage = {
      id,
      message: translateToastMessage(message),
      type,
      duration
    }

    toasts.value.push(toast)

    // 自动移除toast
    setTimeout(() => {
      removeToast(id)
    }, duration)

    return id
  }

  const removeToast = (id: number) => {
    const index = toasts.value.findIndex((toast) => toast.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  const success = (message: string, duration?: number) => showToast(message, 'success', duration)
  const error = (message: string, duration?: number) => showToast(message, 'error', duration)
  const info = (message: string, duration?: number) => showToast(message, 'info', duration)
  const warning = (message: string, duration?: number) => showToast(message, 'warning', duration)

  return {
    toasts,
    showToast,
    removeToast,
    success,
    error,
    info,
    warning
  }
}
