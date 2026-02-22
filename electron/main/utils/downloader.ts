import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { logger } from './logger.js'

export class Downloader {
  private static instance: Downloader
  private downloadQueue: Map<string, Promise<string>> = new Map()

  private constructor() {}

  static getInstance(): Downloader {
    if (!Downloader.instance) {
      Downloader.instance = new Downloader()
    }
    return Downloader.instance
  }

  /**
   * 下载文件
   * @param url 文件URL
   * @param filename 保存的文件名（包含扩展名）
   * @param subDir 子目录（相对于userData/cache）
   * @returns 本地文件绝对路径
   */
  async downloadFile(url: string, filename: string, subDir: string = 'songs'): Promise<string> {
    const cacheDir = path.join(app.getPath('userData'), 'cache', subDir)
    const filePath = path.join(cacheDir, filename)

    // 确保目录存在
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
    }

    // 如果已经在下载中，返回该Promise
    if (this.downloadQueue.has(filePath)) {
      logger.info('Downloader', `File already downloading: ${filename}`)
      return this.downloadQueue.get(filePath)!
    }

    // 如果文件已存在且大小不为0，直接返回路径
    // TODO: 可以增加校验和比对
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath)
      if (stats.size > 0) {
        logger.info('Downloader', `File exists locally: ${filename}`)
        return filePath
      }
    }

    const downloadPromise = this.performDownload(url, filePath)
    this.downloadQueue.set(filePath, downloadPromise)

    try {
      const result = await downloadPromise
      this.downloadQueue.delete(filePath)
      return result
    } catch (error) {
      this.downloadQueue.delete(filePath)
      // 下载失败，删除可能存在的残缺文件
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      throw error
    }
  }

  private async performDownload(url: string, filePath: string): Promise<string> {
    logger.info('Downloader', `Starting download: ${url} -> ${filePath}`)
    
    const writer = fs.createWriteStream(filePath)
    
    try {
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        timeout: 30000 // 30s超时
      })

      response.data.pipe(writer)

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          logger.info('Downloader', `Download complete: ${filePath}`)
          resolve(filePath)
        })
        writer.on('error', (err) => {
          logger.error('Downloader', `Write error: ${err.message}`)
          reject(err)
        })
      })
    } catch (error: any) {
      logger.error('Downloader', `Download error: ${error.message}`)
      writer.close()
      throw error
    }
  }
}
