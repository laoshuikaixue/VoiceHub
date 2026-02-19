import { onUnmounted, ref } from 'vue'
import { useProgress } from './useProgress'
import { useAuth } from './useAuth'

export const useProgressEvents = () => {
  const {
    percentage,
    message,
    subMessage,
    active,
    indeterminate,
    completed,
    error,
    start,
    startIndeterminate,
    update,
    complete,
    setError,
    reset
  } = useProgress()

  const progressId = ref('')
  let eventSource: EventSource | null = null

  // 连接到进度事件流
  const connect = async (id: string) => {
    // 确保之前的连接已关闭
    disconnect()

    progressId.value = id
    startIndeterminate('正在连接...')

    try {
      // 创建新的事件源，通过URL参数传递认证token
      const auth = useAuth()
      const token = auth.getToken()
      eventSource = new EventSource(`/api/progress/events?id=${id}&token=${token}`)

      // 连接打开
      eventSource.onopen = () => {
        startIndeterminate('已连接，等待进度更新...')
      }

      // 接收消息
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.connected) {
            startIndeterminate('已连接，等待进度更新...')
            return
          }

          if (data.error) {
            setError(data.error)
            disconnect()
            return
          }

          if (data.completed) {
            complete(data.message || '操作完成')
            disconnect()
            return
          }

          // 更新进度
          if (data.progress !== undefined) {
            // 如果之前是不确定状态，切换到确定状态
            if (indeterminate.value) {
              start(data.message || '处理中...')
            }

            update(
              data.progress,
              data.message !== undefined ? data.message : undefined,
              data.subMessage !== undefined ? data.subMessage : undefined
            )
          }
        } catch (err) {
          console.error('处理进度事件时出错:', err)
        }
      }

      // 错误处理
      eventSource.onerror = (err) => {
        console.error('进度事件流错误:', err)
        setError('连接进度更新失败')
        disconnect()
      }

      // 关闭事件
      eventSource.addEventListener('close', () => {
        disconnect()
      })
    } catch (err) {
      console.error('创建EventSource时出错:', err)
      setError('无法连接到进度更新服务')
    }
  }

  // 断开连接
  const disconnect = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  // 获取新的进度ID
  const getProgressId = async () => {
    try {
      const response = await fetch('/api/progress/id', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('获取进度ID失败')
      }

      const data = await response.json()
      progressId.value = data.id
      return data.id
    } catch (err) {
      console.error('获取进度ID时出错:', err)
      return null
    }
  }

  // 清理
  onUnmounted(() => {
    disconnect()
  })

  return {
    progressId,
    percentage,
    message,
    subMessage,
    active,
    indeterminate,
    completed,
    error,
    connect,
    disconnect,
    getProgressId
  }
}
