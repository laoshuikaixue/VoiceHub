import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import type { BackupSchedule } from '~/drizzle/schema'

export interface WebDAVUploadResult {
  success: boolean
  remotePath?: string
  checksum?: string
  errorMessage?: string
}

export interface WebDAVConfig {
  url: string
  username: string
  password: string
}

/**
 * WebDAV 上传服务
 * 支持上传本地备份文件到 WebDAV 兼容服务器
 */
export class WebDAVUploadService {
  private config: WebDAVConfig | null = null

  /**
   * 初始化 WebDAV 配置
   */
  initialize(config: WebDAVConfig): void {
    this.config = config
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.config !== null
  }

  /**
   * 发送 HTTP 请求到 WebDAV 服务器
   */
  private async request(
    method: string,
    targetPath: string,
    body?: Buffer,
    headers?: Record<string, string>
  ): Promise<{ status: number; statusText: string; body?: string }> {
    if (!this.config) {
      throw new Error('WebDAV client not initialized')
    }

    const url = new URL(targetPath, this.config.url).toString()
    const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        ...headers
      },
      body
    })

    let responseBody: string | undefined
    try {
      responseBody = await response.text()
    } catch {
      responseBody = undefined
    }

    return {
      status: response.status,
      statusText: response.statusText,
      body: responseBody
    }
  }

  /**
   * 确保远程目录存在
   */
  private async ensureDirectory(remotePath: string): Promise<void> {
    const parts = remotePath.split('/').filter(Boolean)
    let currentPath = ''

    for (const part of parts.slice(0, -1)) {
      currentPath += '/' + part
      await this.request('MKCOL', currentPath).catch(() => {
        // 忽略目录已存在的错误
      })
    }
  }

  /**
   * 上传文件到 WebDAV
   */
  async uploadFile(localPath: string, remotePath?: string): Promise<WebDAVUploadResult> {
    if (!this.config) {
      return {
        success: false,
        errorMessage: 'WebDAV client not initialized'
      }
    }

    try {
      const fileContent = await fs.readFile(localPath)
      const checksum = createHash('sha256').update(fileContent).digest('hex')

      const filename = path.basename(localPath)
      const finalRemotePath = remotePath || `/backups/${filename}`

      // 确保目录存在
      await this.ensureDirectory(finalRemotePath)

      const result = await this.request('PUT', finalRemotePath, fileContent, {
        'Content-Type': 'application/json'
      })

      if (result.status >= 200 && result.status < 300) {
        console.log(`[WebDAVUploadService] File uploaded: ${finalRemotePath}`)

        return {
          success: true,
          remotePath: finalRemotePath,
          checksum
        }
      } else {
        console.error(`[WebDAVUploadService] Upload failed: ${result.status} ${result.statusText}`)

        return {
          success: false,
          errorMessage: `Upload failed: ${result.status} ${result.statusText}`
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[WebDAVUploadService] Upload failed:', error)

      return {
        success: false,
        errorMessage
      }
    }
  }

  /**
   * 从 WebDAV 下载文件
   */
  async downloadFile(remotePath: string, localPath: string): Promise<{ success: boolean; errorMessage?: string }> {
    if (!this.config) {
      return {
        success: false,
        errorMessage: 'WebDAV client not initialized'
      }
    }

    try {
      const result = await this.request('GET', remotePath)

      if (result.status >= 200 && result.status < 300 && result.body) {
        await fs.writeFile(localPath, result.body)
        console.log(`[WebDAVUploadService] File downloaded: ${remotePath} -> ${localPath}`)
        return { success: true }
      } else {
        return {
          success: false,
          errorMessage: `Download failed: ${result.status} ${result.statusText}`
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[WebDAVUploadService] Download failed:', error)

      return {
        success: false,
        errorMessage
      }
    }
  }

  /**
   * 删除 WebDAV 上的文件
   */
  async deleteFile(remotePath: string): Promise<{ success: boolean; errorMessage?: string }> {
    if (!this.config) {
      return {
        success: false,
        errorMessage: 'WebDAV client not initialized'
      }
    }

    try {
      const result = await this.request('DELETE', remotePath)

      if (result.status >= 200 && result.status < 300 || result.status === 404) {
        console.log(`[WebDAVUploadService] File deleted: ${remotePath}`)
        return { success: true }
      } else {
        return {
          success: false,
          errorMessage: `Delete failed: ${result.status} ${result.statusText}`
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[WebDAVUploadService] Delete failed:', error)

      return {
        success: false,
        errorMessage
      }
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(remotePath: string): Promise<boolean> {
    if (!this.config) {
      return false
    }

    try {
      const result = await this.request('HEAD', remotePath)
      return result.status >= 200 && result.status < 300
    } catch {
      return false
    }
  }

  /**
   * 列出目录中的文件
   */
  async listFiles(remotePath: string = '/backups'): Promise<{ success: boolean; files: string[]; errorMessage?: string }> {
    if (!this.config) {
      return {
        success: false,
        files: [],
        errorMessage: 'WebDAV client not initialized'
      }
    }

    try {
      const result = await this.request('PROPFIND', remotePath, undefined, {
        Depth: '1'
      })

      if (result.status >= 200 && result.status < 300 && result.body) {
        const filePaths = this.parsePropfindResponse(result.body)
        return {
          success: true,
          files: filePaths
        }
      } else {
        return {
          success: false,
          files: [],
          errorMessage: `List failed: ${result.status} ${result.statusText}`
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[WebDAVUploadService] List failed:', error)

      return {
        success: false,
        files: [],
        errorMessage
      }
    }
  }

  /**
   * 解析 PROPFIND 响应
   */
  private parsePropfindResponse(xml: string): string[] {
    const paths: string[] = []
    const hrefRegex = /<D:href>([^<]+)<\/D:href>/gi
    let match

    while ((match = hrefRegex.exec(xml)) !== null) {
      const href = decodeURIComponent(match[1])
      if (href !== '/' && !href.endsWith('/')) {
        paths.push(href)
      }
    }

    return paths
  }

  /**
   * 测试 WebDAV 连接
   */
  async testConnection(): Promise<{ success: boolean; errorMessage?: string }> {
    if (!this.config) {
      return {
        success: false,
        errorMessage: 'WebDAV client not initialized'
      }
    }

    try {
      const result = await this.request('OPTIONS', '/')

      if (result.status >= 200) {
        return { success: true }
      } else {
        return {
          success: false,
          errorMessage: `Connection failed: ${result.status} ${result.statusText}`
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[WebDAVUploadService] Connection test failed:', error)

      return {
        success: false,
        errorMessage
      }
    }
  }

  /**
   * 从调度配置创建 WebDAV 服务并执行上传
   */
  async uploadFromSchedule(
    schedule: Pick<BackupSchedule, 'webdavUrl' | 'webdavUsername' | 'webdavPassword'>,
    localPath: string,
    remotePath?: string
  ): Promise<WebDAVUploadResult> {
    this.initialize({
      url: schedule.webdavUrl!,
      username: schedule.webdavUsername!,
      password: schedule.webdavPassword!
    })

    return this.uploadFile(localPath, remotePath)
  }
}

let webdavUploadServiceInstance: WebDAVUploadService | null = null

export function getWebDAVUploadService(): WebDAVUploadService {
  if (!webdavUploadServiceInstance) {
    webdavUploadServiceInstance = new WebDAVUploadService()
  }
  return webdavUploadServiceInstance
}
