import { cache } from './cache-helpers'
import crypto from 'crypto'
import { CACHE_CONSTANTS } from '../config/constants'

/**
 * 开放API缓存管理器
 * 复用现有的缓存管理机制，提供统一的缓存策略
 */
export class OpenApiCacheManager {
  private static readonly CACHE_PREFIX = 'open:'

  /**
   * 生成缓存键
   * @param endpoint API端点名称
   * @param params 查询参数
   * @returns 缓存键
   */
  static generateCacheKey(endpoint: string, params: Record<string, any>): string {
    // 过滤掉空值和undefined
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(
        ([_, value]) => value !== '' && value !== null && value !== undefined
      )
    )

    // 对参数进行排序以确保一致性
    const sortedParams = Object.keys(filteredParams)
      .sort()
      .reduce(
        (result, key) => {
          result[key] = filteredParams[key]
          return result
        },
        {} as Record<string, any>
      )

    const queryHash = crypto.createHash('md5').update(JSON.stringify(sortedParams)).digest('hex')

    return `${this.CACHE_PREFIX}${endpoint}:${queryHash}`
  }

  /**
   * 获取缓存数据
   * @param cacheKey 缓存键
   * @returns 缓存的数据或null
   */
  static async get<T>(cacheKey: string): Promise<T | null> {
    try {
      const cachedData = await cache.get<T>(cacheKey)
      if (cachedData !== null) {
        console.log(`[Open API Cache] 缓存命中: ${cacheKey}`)
        return cachedData
      }
      console.log(`[Open API Cache] 缓存未命中: ${cacheKey}`)
      return null
    } catch (error) {
      console.error(`[Open API Cache] 获取缓存失败 ${cacheKey}:`, error)
      return null
    }
  }

  /**
   * 设置缓存数据
   * @param cacheKey 缓存键
   * @param data 要缓存的数据
   * @param ttl 缓存时间（秒），默认使用配置的默认值
   * @returns 是否设置成功
   */
  static async set<T>(cacheKey: string, data: T, ttl?: number): Promise<boolean> {
    try {
      const cacheTtl = ttl || CACHE_CONSTANTS.DEFAULT_TTL
      const success = await cache.set(cacheKey, data, cacheTtl)
      if (success) {
        console.log(`[Open API Cache] 设置缓存成功: ${cacheKey}, TTL: ${cacheTtl}s`)
      } else {
        console.warn(`[Open API Cache] 设置缓存失败: ${cacheKey}`)
      }
      return success
    } catch (error) {
      console.error(`[Open API Cache] 设置缓存异常 ${cacheKey}:`, error)
      return false
    }
  }

  /**
   * 删除特定缓存
   * @param cacheKey 缓存键
   * @returns 是否删除成功
   */
  static async delete(cacheKey: string): Promise<boolean> {
    try {
      const success = await cache.delete(cacheKey)
      if (success) {
        console.log(`[Open API Cache] 删除缓存成功: ${cacheKey}`)
      }
      return success
    } catch (error) {
      console.error(`[Open API Cache] 删除缓存失败 ${cacheKey}:`, error)
      return false
    }
  }

  /**
   * 清除所有开放API缓存
   * @returns 是否清除成功
   */
  static async clearAll(): Promise<boolean> {
    try {
      const pattern = `${this.CACHE_PREFIX}*`
      const success = await cache.deletePattern(pattern)
      if (success) {
        console.log(`[Open API Cache] 清除所有缓存成功: ${pattern}`)
      }
      return success
    } catch (error) {
      console.error(`[Open API Cache] 清除所有缓存失败:`, error)
      return false
    }
  }

  /**
   * 清除特定端点的所有缓存
   * @param endpoint 端点名称
   * @returns 是否清除成功
   */
  static async clearEndpoint(endpoint: string): Promise<boolean> {
    try {
      const pattern = `${this.CACHE_PREFIX}${endpoint}:*`
      const success = await cache.deletePattern(pattern)
      if (success) {
        console.log(`[Open API Cache] 清除端点缓存成功: ${pattern}`)
      }
      return success
    } catch (error) {
      console.error(`[Open API Cache] 清除端点缓存失败 ${endpoint}:`, error)
      return false
    }
  }

  /**
   * 获取或设置缓存（缓存穿透保护）
   * @param cacheKey 缓存键
   * @param loader 数据加载函数
   * @param ttl 缓存时间（秒）
   * @returns 数据
   */
  static async getOrSet<T>(
    cacheKey: string,
    loader: () => Promise<T>,
    ttl?: number
  ): Promise<T | null> {
    try {
      // 先尝试获取缓存
      const cached = await this.get<T>(cacheKey)
      if (cached !== null) {
        return cached
      }

      // 缓存未命中，执行loader函数
      console.log(`[Open API Cache] 执行数据加载: ${cacheKey}`)
      const data = await loader()

      if (data !== null && data !== undefined) {
        // 异步设置缓存，不等待结果
        this.set(cacheKey, data, ttl).catch((error) => {
          console.error(`[Open API Cache] 异步设置缓存失败 ${cacheKey}:`, error)
        })
      }

      return data
    } catch (error) {
      console.error(`[Open API Cache] getOrSet操作失败 ${cacheKey}:`, error)
      return null
    }
  }

  /**
   * 智能响应体截断
   * 对大响应体进行智能截断，保留重要信息
   * @param responseBody 响应体
   * @param maxLength 最大长度
   * @returns 截断后的响应体
   */
  static truncateResponseBody(
    responseBody: any,
    maxLength: number = CACHE_CONSTANTS.MAX_RESPONSE_BODY_LENGTH
  ): string | null {
    if (!responseBody) return null

    try {
      const jsonString = JSON.stringify(responseBody)

      if (jsonString.length <= maxLength) {
        return jsonString
      }

      // 智能截断：保留开头和结尾的重要信息
      const halfLength = Math.floor(maxLength / 2) - 50 // 预留空间给省略标记
      const start = jsonString.substring(0, halfLength)
      const end = jsonString.substring(jsonString.length - halfLength)

      return `${start}... [截断 ${jsonString.length - maxLength} 字符] ...${end}`
    } catch (error) {
      console.error('[Open API Cache] 响应体截断失败:', error)
      return String(responseBody).substring(0, maxLength)
    }
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计
   */
  static async getStats(): Promise<{
    totalKeys: number
    endpoints: string[]
  }> {
    try {
      // 这里可以扩展实现更详细的统计信息
      // 目前返回基本信息
      return {
        totalKeys: 0, // 需要Redis支持来获取准确数量
        endpoints: ['songs', 'schedules'] // 当前支持的端点
      }
    } catch (error) {
      console.error('[Open API Cache] 获取统计信息失败:', error)
      return {
        totalKeys: 0,
        endpoints: []
      }
    }
  }
}

// 导出便捷方法
export const openApiCache = {
  generateKey: OpenApiCacheManager.generateCacheKey,
  get: OpenApiCacheManager.get,
  set: OpenApiCacheManager.set,
  delete: OpenApiCacheManager.delete,
  clearAll: OpenApiCacheManager.clearAll,
  clearEndpoint: OpenApiCacheManager.clearEndpoint,
  getOrSet: OpenApiCacheManager.getOrSet,
  truncateResponseBody: OpenApiCacheManager.truncateResponseBody,
  getStats: OpenApiCacheManager.getStats
}
