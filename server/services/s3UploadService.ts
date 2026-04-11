import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, ListObjectsV2CommandInput } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import type { BackupSchedule } from '~/drizzle/schema'

export interface S3UploadResult {
  success: boolean
  remotePath?: string
  checksum?: string
  errorMessage?: string
}

export interface S3Config {
  endpoint: string
  bucket: string
  accessKey: string
  secretKey: string
  region: string
}

/**
 * S3 上传服务
 * 支持上传本地备份文件到 S3 兼容存储桶
 */
export class S3UploadService {
  private s3Client: S3Client | null = null
  private config: S3Config | null = null

  /**
   * 初始化 S3 客户端
   */
  initialize(config: S3Config): void {
    this.config = config
    this.s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey
      },
      forcePathStyle: true
    })
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.s3Client !== null && this.config !== null
  }

  /**
   * 上传文件到 S3
   */
  async uploadFile(localPath: string, remotePath?: string): Promise<S3UploadResult> {
    if (!this.s3Client || !this.config) {
      return {
        success: false,
        errorMessage: 'S3 client not initialized'
      }
    }

    try {
      const fileContent = await fs.readFile(localPath)
      const checksum = createHash('sha256').update(fileContent).digest('hex')

      const filename = path.basename(localPath)
      const finalRemotePath = remotePath || `backups/${filename}`

      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: finalRemotePath,
        Body: fileContent,
        ContentType: 'application/json',
        Metadata: {
          checksum,
          uploadedAt: new Date().toISOString()
        }
      })

      await this.s3Client.send(command)

      console.log(`[S3UploadService] File uploaded: ${finalRemotePath}`)

      return {
        success: true,
        remotePath: finalRemotePath,
        checksum
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[S3UploadService] Upload failed:', error)

      return {
        success: false,
        errorMessage
      }
    }
  }

  /**
   * 从 S3 下载文件
   */
  async downloadFile(remotePath: string, localPath: string): Promise<{ success: boolean; errorMessage?: string }> {
    if (!this.s3Client || !this.config) {
      return {
        success: false,
        errorMessage: 'S3 client not initialized'
      }
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: remotePath
      })

      const response = await this.s3Client.send(command)

      if (!response.Body) {
        return {
          success: false,
          errorMessage: 'Empty response from S3'
        }
      }

      const chunks: Buffer[] = []
      for await (const chunk of response.Body as AsyncIterable<Buffer>) {
        chunks.push(chunk)
      }

      await fs.writeFile(localPath, Buffer.concat(chunks))

      console.log(`[S3UploadService] File downloaded: ${remotePath} -> ${localPath}`)

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[S3UploadService] Download failed:', error)

      return {
        success: false,
        errorMessage
      }
    }
  }

  /**
   * 删除 S3 上的文件
   */
  async deleteFile(remotePath: string): Promise<{ success: boolean; errorMessage?: string }> {
    if (!this.s3Client || !this.config) {
      return {
        success: false,
        errorMessage: 'S3 client not initialized'
      }
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: remotePath
      })

      await this.s3Client.send(command)

      console.log(`[S3UploadService] File deleted: ${remotePath}`)

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[S3UploadService] Delete failed:', error)

      return {
        success: false,
        errorMessage
      }
    }
  }

  /**
   * 列出 S3 存储桶中的文件
   */
  async listFiles(prefix?: string): Promise<{ success: boolean; files: string[]; errorMessage?: string }> {
    if (!this.s3Client || !this.config) {
      return {
        success: false,
        files: [],
        errorMessage: 'S3 client not initialized'
      }
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix || 'backups/'
      })

      const response = await this.s3Client.send(command)

      const files = (response.Contents || []).map((obj) => obj.Key || '').filter(Boolean)

      return {
        success: true,
        files
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[S3UploadService] List failed:', error)

      return {
        success: false,
        files: [],
        errorMessage
      }
    }
  }

  /**
   * 测试 S3 连接
   */
  async testConnection(): Promise<{ success: boolean; errorMessage?: string }> {
    if (!this.s3Client || !this.config) {
      return {
        success: false,
        errorMessage: 'S3 client not initialized'
      }
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        MaxKeys: 1
      })

      await this.s3Client.send(command)

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[S3UploadService] Connection test failed:', error)

      return {
        success: false,
        errorMessage
      }
    }
  }

  /**
   * 从调度配置创建 S3 服务并执行上传
   */
  async uploadFromSchedule(
    schedule: Pick<BackupSchedule, 's3Endpoint' | 's3Bucket' | 's3AccessKey' | 's3SecretKey' | 's3Region' | 's3Path'>,
    localPath: string,
    remotePath?: string
  ): Promise<S3UploadResult> {
    this.initialize({
      endpoint: schedule.s3Endpoint!,
      bucket: schedule.s3Bucket!,
      accessKey: schedule.s3AccessKey!,
      secretKey: schedule.s3SecretKey!,
      region: schedule.s3Region || 'us-east-1'
    })

    const s3Path = schedule.s3Path || '/backups'
    const uploadPath = remotePath || `${s3Path.replace(/^\//, '')}/${path.basename(localPath)}`

    return this.uploadFile(localPath, uploadPath)
  }

  /**
   * 列出 S3 桶中的备份文件
   */
  async listFiles(prefix?: string): Promise<{ success: boolean; files: string[]; directories: string[]; errorMessage?: string }> {
    if (!this.s3Client || !this.config) {
      return {
        success: false,
        files: [],
        directories: [],
        errorMessage: 'S3 client not initialized'
      }
    }

    const cleanPrefix = prefix ? prefix.replace(/^\/+|\/+$/g, '') : ''
    const s3Prefix = cleanPrefix ? cleanPrefix + '/' : ''

    try {
      const listParams: ListObjectsV2CommandInput = {
        Bucket: this.config.bucket,
        Delimiter: '/'
      }
      if (s3Prefix) {
        listParams.Prefix = s3Prefix
      }

      console.log('[S3UploadService] Listing files with params:', JSON.stringify(listParams))

      const command = new ListObjectsV2Command(listParams)
      const response = await this.s3Client.send(command)

      const directories = (response.CommonPrefixes || []).map((obj) => {
        const p = obj.Prefix || ''
        return p.replace(s3Prefix, '').replace(/\/$/, '')
      }).filter(Boolean)
      const files = (response.Contents || []).map((obj) => {
        const k = obj.Key || ''
        return k.replace(s3Prefix, '')
      }).filter(Boolean)

      return {
        success: true,
        files,
        directories
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[S3UploadService] List files failed:', error)
      return {
        success: false,
        files: [],
        directories: [],
        errorMessage
      }
    }
  }

  /**
   * 从 S3 删除文件
   */
  async deleteFile(remotePath: string): Promise<{ success: boolean; errorMessage?: string }> {
    if (!this.s3Client || !this.config) {
      return {
        success: false,
        errorMessage: 'S3 client not initialized'
      }
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: remotePath
      })

      await this.s3Client.send(command)

      console.log(`[S3UploadService] File deleted: ${remotePath}`)

      return {
        success: true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[S3UploadService] Delete failed:', error)
      return {
        success: false,
        errorMessage
      }
    }
  }
}

let s3UploadServiceInstance: S3UploadService | null = null

export function getS3UploadService(): S3UploadService {
  if (!s3UploadServiceInstance) {
    s3UploadServiceInstance = new S3UploadService()
  }
  return s3UploadServiceInstance
}
