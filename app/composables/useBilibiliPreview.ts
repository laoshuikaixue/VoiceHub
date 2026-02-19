import { ref } from 'vue'

/**
 * 用于管理哔哩哔哩视频预览弹窗的组合式函数
 * 提取了 SongManagement 和 ScheduleManager 组件中的通用逻辑
 */
export function useBilibiliPreview() {
  const showBilibiliPreview = ref(false)
  const previewBvid = ref('')
  const previewPage = ref(1)

  const openBilibiliPreview = (song: any) => {
    if (!song.musicId) return

    const parts = song.musicId.split(':')
    previewBvid.value = parts[0]
    previewPage.value = parts.length >= 3 ? parseInt(parts[2]) || 1 : 1
    showBilibiliPreview.value = true
  }

  const closeBilibiliPreview = () => {
    showBilibiliPreview.value = false
  }

  return {
    showBilibiliPreview,
    previewBvid,
    previewPage,
    openBilibiliPreview,
    closeBilibiliPreview
  }
}
