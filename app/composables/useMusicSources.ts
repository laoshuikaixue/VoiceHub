/**
 * 音源管理器 Composable
 * 提供多音源搜索、故障转移和状态监控功能
 */

import {
  getEnabledSources,
  getSourceById,
  MUSIC_SOURCE_CONFIG,
  type MusicSearchParams,
  type MusicSearchResult,
  type MusicSource,
  type MusicSourceConfig,
  type SongDetailParams,
  type SongDetailResult,
  type SourceStatus
} from '~/utils/musicSources'
import { getBilibiliTrackUrl, searchBilibili, parseBilibiliId } from '~/utils/bilibiliSource'

/**
 * 音源管理器 Composable
 */
export const useMusicSources = () => {
  // 配置
  const config = ref<MusicSourceConfig>(MUSIC_SOURCE_CONFIG)

  // 当前使用的音源
  const currentSource = ref<string>(config.value.primarySource)

  // 音源状态
  const sourceStatus = ref<Record<string, SourceStatus>>({})

  /**
   * 使用 Meting API 获取歌曲信息
   * @param id 歌曲ID
   * @param source Meting API 音源
   * @returns Promise<{success: boolean, data?: any, error?: string}>
   */
  const getMetingSongInfo = async (
    id: string | number,
    source: MusicSource
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> => {
    try {
      const metingUrl = `${source.baseUrl}/?server=netease&type=song&id=${id}`

      const response = await $fetch(metingUrl, {
        timeout: source.timeout || 8000,
        headers: source.headers
      })

      // Meting API 返回歌曲信息数组
      if (Array.isArray(response) && response.length > 0) {
        const songInfo = response[0]
        /**
         * 获取电台/播客节目列表
         */
        const getDjPrograms = async (
          radioId: string | number,
          limit: number = 20,
          offset: number = 0,
          cookie?: string
        ): Promise<{
          success: boolean
          programs: any[]
          count: number
          more: boolean
          error?: string
        }> => {
          const enabledSources = getEnabledSources()
          // 优先使用网易云备用源
          const neteaseSources = enabledSources.filter((source) =>
            source.id.includes('netease-backup')
          )

          // 如果没有找到网易云备用源，尝试其他可能支持的源（虽然目前只有备用源支持此接口）
          if (neteaseSources.length === 0) {
            return {
              success: false,
              programs: [],
              count: 0,
              more: false,
              error: '未找到可用的网易云音源'
            }
          }

          // 尝试所有网易云源
          for (const source of neteaseSources) {
            try {
              let cookieParam = ''
              if (cookie) {
                cookieParam = `&cookie=${encodeURIComponent(cookie)}`
              }

              const url = `${source.baseUrl}/dj/program?rid=${radioId}&limit=${limit}&offset=${offset}&unblock=false${cookieParam}`
              console.log(`[getDjPrograms] Requesting: ${url}`)

              const response: any = await $fetch(url, {
                timeout: source.timeout || 8000
              })

              if (response.code === 200) {
                return {
                  success: true,
                  programs: response.programs || [],
                  count: response.count || 0,
                  more: response.more || false
                }
              }
            } catch (e: any) {
              console.warn(`[getDjPrograms] Source ${source.id} failed:`, e.message)
            }
          }

          return { success: false, programs: [], count: 0, more: false, error: '获取节目列表失败' }
        }

        return {
          success: true,
          data: {
            name: songInfo.name,
            artist: songInfo.artist,
            url: songInfo.url,
            pic: songInfo.pic,
            lrc: songInfo.lrc
          }
        }
      }

      return { success: false, error: 'Meting API 未返回有效数据' }
    } catch (error: any) {
      return { success: false, error: error?.message || '未知错误' }
    }
  }

  /**
   * 验证播放链接的有效性
   * @param url 播放链接
   * @returns Promise<{valid: boolean, duration?: number, error?: string}>
   */
  const validatePlayUrl = async (
    url: string
  ): Promise<{
    valid: boolean
    duration?: number
    error?: string
  }> => {
    try {
      // 修复HTTP/HTTPS协议问题
      let validatedUrl = url
      if (url.startsWith('http://')) {
        validatedUrl = url.replace('http://', 'https://')
      }

      // 使用HEAD请求检查链接可用性，避免下载整个文件
      const response = await fetch(validatedUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5秒超时
      })

      if (!response.ok) {
        return {
          valid: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      // 检查Content-Type是否为音频文件
      const contentType = response.headers.get('content-type')
      if (contentType && !contentType.includes('audio') && !contentType.includes('video')) {
        return {
          valid: false,
          error: `不是音频文件: ${contentType}`
        }
      }

      // 尝试获取文件大小来估算时长
      const contentLength = response.headers.get('content-length')
      let estimatedDuration = 0

      if (contentLength) {
        const fileSizeBytes = parseInt(contentLength)
        // 粗略估算：假设128kbps的音质，1MB约为64秒
        estimatedDuration = (fileSizeBytes / 1024 / 1024) * 64

        if (estimatedDuration < 5) {
          return {
            valid: false,
            duration: estimatedDuration,
            error: `歌曲时长过短: ${estimatedDuration.toFixed(1)}秒`
          }
        }
      }

      return {
        valid: true,
        duration: estimatedDuration
      }
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || '链接验证失败'
      }
    }
  }

  // 是否正在搜索
  const isSearching = ref(false)

  // 最后一次搜索的音源
  const lastUsedSource = ref<string>('')

  /**
   * 使用 Native Music API 搜索
   */
  const searchNativeMusic = async (params: MusicSearchParams): Promise<any[]> => {
    const platform = params.platform || 'netease'
    if (platform !== 'netease' && platform !== 'tencent') {
      return []
    }

    const endpoint = platform === 'netease' ? 'wy' : 'tx'
    const url = `/api/native-api/search/${endpoint}`

    try {
      console.log(`[searchNativeMusic] Requesting ${platform} search: ${params.keywords}`)
      const response: any = await $fetch(url, {
        params: {
          str: params.keywords,
          page: Math.floor((params.offset || 0) / (params.limit || 30)) + 1,
          limit: params.limit || 30
        }
      })

      if (!response || !response.list) {
        return []
      }

      return response.list.map((item: any) => {
        const isNetease = platform === 'netease'
        // 统一使用 songmid 作为 ID
        // 网易云: songmid 为数字 ID (e.g. 123456)
        // QQ音乐: songmid 为字符串 MID (e.g. 004MmF3024567)，这对 vkeys 接口更友好
        const mid = item.songmid
        // VoiceHub 内部 ID: 网易云使用数字ID，QQ音乐优先使用数字ID(songId)以便vkeys使用
        const id = isNetease ? item.songmid : item.songId || item.songmid

        return {
          id: id?.toString(),
          title: item.name,
          artist: item.singer?.replace(/、/g, '/') || '未知艺术家',
          cover: item.img,
          album: item.albumName,
          duration: isNetease ? item.duration * 1000 : item.duration, // Netease uses ms, Tencent uses s
          musicPlatform: platform,
          musicId: id?.toString(),
          url: undefined,
          hasUrl: false,
          sourceInfo: {
            // 伪装源名称，以便兼容后续的播放逻辑
            // 网易云使用 netease-backup，QQ音乐使用 vkeys
            source: isNetease ? 'netease-backup' : 'vkeys',
            originalId: id?.toString(),
            fetchedAt: new Date(),
            mid: mid,
            strMediaMid: item.strMediaMid, // Add strMediaMid
            quality: item._types, // Store quality info from LX
            types: item.types
          }
        }
      })
    } catch (error: any) {
      console.warn(`[searchNativeMusic] Failed:`, error)
      throw error
    }
  }

  // 服务器是否在中国
  const isServerInChina = ref<boolean | null>(null)

  // 检测服务器位置
  const checkServerLocation = async () => {
    if (isServerInChina.value !== null) return

    try {
      const { data } = await useFetch('/api/system/location')
      if (data.value && data.value.success) {
        isServerInChina.value = data.value.data.isInChina
        console.log(`[useMusicSources] 服务器位置检测: ${isServerInChina.value ? '中国' : '海外'}`)
      }
    } catch (e) {
      console.warn('[useMusicSources] 服务器位置检测失败，默认为海外:', e)
      isServerInChina.value = false
    }
  }

  /**
   * 搜索歌曲（带故障转移）
   */
  const searchSongs = async (
    params: MusicSearchParams,
    signal?: AbortSignal
  ): Promise<MusicSearchResult> => {
    // 检查请求是否已被取消
    if (signal?.aborted) {
      throw new DOMException('搜索请求已被取消', 'AbortError')
    }

    isSearching.value = true

    // 确保已检测服务器位置
    if (isServerInChina.value === null) {
      await checkServerLocation()
    }

    try {
      // 优先尝试 Native Music 本地集成搜索 (仅支持网易云和QQ音乐)
      // 只有当不是播客搜索时才使用
      // 策略调整：如果服务器在中国，优先使用 Native Music；如果在海外，跳过 Native Music 直接使用第三方 API (除非第三方都失败)
      const platform = params.platform || 'netease'
      const shouldUseNativeFirst = isServerInChina.value === true

      if (
        shouldUseNativeFirst &&
        (platform === 'netease' || platform === 'tencent') &&
        params.type !== 1009
      ) {
        try {
          console.log(`[searchSongs] 服务器位于国内，优先尝试 Native Music 搜索...`)
          const result = await searchNativeMusic(params)
          if (result && result.length > 0) {
            currentSource.value = 'native-music'
            // 这里不再将 lastUsedSource 设置为 'native-music'，
            // 而是根据平台回退到能提供播放链接的音源ID（如 netease-backup 或 vkeys）。
            // 这样 getSongUrl 等后续方法就会使用该音源进行播放链接获取。
            lastUsedSource.value = platform === 'netease' ? 'netease-backup' : 'vkeys'
            return {
              success: true,
              source: 'native-music',
              data: result,
              error: undefined
            }
          }
        } catch (e) {
          console.warn('[searchSongs] Native Music 搜索失败，回退到其他音源:', e)
        }
      } else if (!shouldUseNativeFirst) {
        console.log(`[searchSongs] 服务器位于海外，跳过 Native Music 优先使用第三方音源`)
      }

      const enabledSources = getEnabledSources()
      const errors: any[] = []

      if (enabledSources.length === 0) {
        throw new Error('没有可用的音源')
      }

      // 根据平台选择合适的音源顺序
      let sourcesToTry: MusicSource[]

      if (params.type === 1009) {
        // 播客/电台搜索：只允许使用 netease-backup 源
        sourcesToTry = enabledSources.filter((s) => s.id.includes('netease-backup'))
        if (sourcesToTry.length === 0) {
          throw new Error('未找到支持播客搜索的音源(需网易云备用源)')
        }
      } else if (params.platform === 'bilibili') {
        const bilibiliSource = enabledSources.find((s) => s.id === 'bilibili')
        if (bilibiliSource) {
          sourcesToTry = [bilibiliSource]
        } else {
          throw new Error('未启用哔哩哔哩音源')
        }
      } else if (params.platform === 'tencent') {
        // QQ音乐平台：优先使用 vkeys v3，其次 vkeys v2；若全部失败，再尝试其他平台
        const v3 = enabledSources.find((s) => s.id === 'vkeys-v3')
        const v2 = enabledSources.find((s) => s.id === 'vkeys')
        const tencentSources: MusicSource[] = []
        if (v3) tencentSources.push(v3)
        if (v2) tencentSources.push(v2)
        console.log('QQ音乐平台搜索，优先使用 vkeys v3，失败回退到 v2')

        // 第一阶段：仅尝试腾讯专用源
        sourcesToTry = tencentSources
      } else {
        // 网易云音乐平台（默认）：优先使用netease-backup系列，vkeys作为备用
        const neteaseSources = enabledSources.filter((s) => s.id.includes('netease-backup'))
        const vkeysSource = enabledSources.find((s) => s.id === 'vkeys')
        const otherSources = enabledSources.filter(
          (s) => !s.id.includes('netease-backup') && s.id !== 'vkeys'
        )

        sourcesToTry = [...neteaseSources, ...(vkeysSource ? [vkeysSource] : []), ...otherSources]
        console.log('网易云音乐平台搜索，优先使用netease-backup系列音源')
      }

      // 按选定的顺序尝试每个音源
      for (const source of sourcesToTry) {
        // 在每次尝试前检查请求是否已被取消
        if (signal?.aborted) {
          throw new DOMException('搜索请求已被取消', 'AbortError')
        }

        try {
          console.log(`尝试使用音源: ${source.name} (${source.id})`)
          const result = await searchWithSource(source, params, signal)

          // 更新状态
          currentSource.value = source.id
          lastUsedSource.value = source.id
          updateSourceStatus(source.id, 'online')

          return {
            success: true,
            source: source.id,
            data: result,
            error: undefined
          }
        } catch (error: any) {
          console.warn(`音源 ${source.name} 搜索失败:`, error.message)
          updateSourceStatus(source.id, 'error', error.message)
          errors.push(error) // 收集错误

          // 如果不是最后一个音源，继续尝试下一个
          if (source !== sourcesToTry[sourcesToTry.length - 1]) {
            console.log(`继续尝试下一个音源...`)
          }
        }
      }

      // 若为QQ音乐平台，尝试完腾讯源后允许作为最后手段切换到其他平台
      if (params.platform === 'tencent') {
        const otherSources = enabledSources.filter((s) => s.id !== 'vkeys-v3' && s.id !== 'vkeys')
        if (otherSources.length) {
          console.log('QQ音乐平台所有专用源失败，作为最后手段尝试其他平台音源')
          for (const source of otherSources) {
            if (signal?.aborted) {
              throw new DOMException('搜索请求已被取消', 'AbortError')
            }
            try {
              console.log(`尝试使用音源: ${source.name} (${source.id})`)
              const result = await searchWithSource(source, params, signal)
              currentSource.value = source.id
              lastUsedSource.value = source.id
              updateSourceStatus(source.id, 'online')
              return { success: true, source: source.id, data: result, error: undefined }
            } catch (error: any) {
              console.warn(`音源 ${source.name} 搜索失败:`, error.message)
              updateSourceStatus(source.id, 'error', error.message)
              errors.push(error) // 收集错误
            }
          }
        }
      }

      // 所有音源都失败了
      if (errors.length > 0) {
        const errorDetails = errors.map((e) => e.message || '未知错误').join('; ')
        throw new Error(`所有音源均不可用: ${errorDetails}`)
      }
      throw new Error('所有音源均不可用，请稍后重试')
    } finally {
      isSearching.value = false
    }
  }

  /**
   * 使用指定音源搜索
   */
  const searchWithSource = async (
    source: MusicSource,
    params: MusicSearchParams,
    signal?: AbortSignal
  ): Promise<any[]> => {
    const startTime = Date.now()

    let url: string
    let transformResponse: (data: any) => any[]

    if (source.id === 'bilibili') {
      try {
        const result = await searchBilibili(params.keywords)
        updateSourceStatus(source.id, 'online', undefined, Date.now() - startTime)
        return result
      } catch (error: any) {
        updateSourceStatus(source.id, 'error', error.message, Date.now() - startTime)
        throw error
      }
    } else if (source.id === 'vkeys-v3') {
      // Vkeys v3 API（仅支持QQ音乐搜索）
      const platform = params.platform || 'tencent'
      if (platform !== 'tencent') {
        throw new Error('vkeys v3 仅支持QQ音乐搜索')
      }

      const page = Math.floor((params.offset || 0) / (params.limit || 10)) + 1
      const limit = params.limit || 10
      url = `${source.baseUrl}/tencent/search/song?keyword=${encodeURIComponent(params.keywords)}&page=${page}&limit=${limit}`
      transformResponse = (data: any) => transformVkeysV3TencentSearch(data)
    } else if (source.id === 'vkeys') {
      // Vkeys API - 根据用户选择的平台使用对应的API
      const platform = params.platform || 'netease' // 使用用户选择的平台，默认网易云

      // 根据平台使用不同的端点，都使用word参数
      if (platform === 'tencent') {
        // QQ音乐使用word参数和tencent端点
        url = `${source.baseUrl}/tencent?word=${encodeURIComponent(params.keywords)}&num=${params.limit || 30}`
      } else {
        // 网易云使用word参数和netease端点
        url = `${source.baseUrl}/netease?word=${encodeURIComponent(params.keywords)}&num=${params.limit || 30}&page=${Math.floor((params.offset || 0) / (params.limit || 30)) + 1}`
      }

      transformResponse = (data: any) => transformVkeysResponse(data, platform)
    } else {
      // 网易云备用API
      // 如果提供了cookie，添加到查询参数中
      let cookieParam = ''
      if (params.cookie) {
        // 将cookie编码后作为参数传递
        cookieParam = `&cookie=${encodeURIComponent(params.cookie)}`
      }

      // 如果是播客/电台搜索 (type === 1009)，使用 /cloudsearch 接口
      if (params.type === 1009) {
        // 播客/电台搜索接口参数：keywords=关键词, limit=数量, offset=偏移量, type=1009
        url = `${source.baseUrl}/cloudsearch?keywords=${encodeURIComponent(params.keywords)}&limit=${params.limit || 20}&offset=${params.offset || 0}&type=1009${cookieParam}`
        transformResponse = async (data: any) => await transformNeteaseResponse(data)
      } else {
        // 默认使用 cloudsearch 接口
        url = `${source.baseUrl}/cloudsearch?keywords=${encodeURIComponent(params.keywords)}&limit=${params.limit || 30}&offset=${params.offset || 0}&type=${params.type || 1}${cookieParam}`
        transformResponse = async (data: any) => await transformNeteaseResponse(data)
      }
    }

    let response: any
    let finalUrl = url

    try {
      console.log(`[${source.name}] 请求URL:`, finalUrl)
      // v3 请求使用简单请求，不携带任何会触发预检的自定义头
      const requestHeaders =
        source.id === 'vkeys-v3'
          ? undefined
          : ({
              'Content-Type': 'application/json',
              ...source.headers
            } as Record<string, string>)

      response = await $fetch(finalUrl, {
        timeout: source.timeout || config.value.timeout,
        signal,
        headers: requestHeaders
      })
      console.log(`[${source.name}] API响应:`, response)

      const responseTime = Date.now() - startTime
      updateSourceStatus(source.id, 'online', undefined, responseTime)
    } catch (error: any) {
      // 如果是网易云备用源且使用的是cloudsearch接口，尝试切换到search接口
      if (source.id !== 'vkeys' && finalUrl.includes('/cloudsearch')) {
        console.warn(`[${source.name}] cloudsearch接口失败，尝试使用search接口:`, error.message)

        // 如果提供了cookie，添加到查询参数中
        let cookieParam = ''
        if (params.cookie) {
          cookieParam = `&cookie=${encodeURIComponent(params.cookie)}`
        }

        const fallbackUrl = `${source.baseUrl}/search?keywords=${encodeURIComponent(params.keywords)}&limit=${params.limit || 30}&offset=${params.offset || 0}&type=${params.type || 1}${cookieParam}`

        try {
          console.log(`[${source.name}] 备用请求URL:`, fallbackUrl)
          response = await $fetch(fallbackUrl, {
            timeout: source.timeout || config.value.timeout,
            signal,
            headers: {
              'Content-Type': 'application/json',
              ...source.headers
            }
          })
          console.log(`[${source.name}] 备用API响应:`, response)

          const responseTime = Date.now() - startTime
          updateSourceStatus(source.id, 'online', undefined, responseTime)
          finalUrl = fallbackUrl // 更新最终使用的URL
        } catch (fallbackError: any) {
          const responseTime = Date.now() - startTime
          console.error(`[${source.name}] 备用接口也失败:`, fallbackError.message)
          updateSourceStatus(
            source.id,
            'error',
            `cloudsearch和search接口均失败: ${error.message}, ${fallbackError.message}`,
            responseTime
          )
          throw fallbackError
        }
      } else {
        const responseTime = Date.now() - startTime
        console.error(`[${source.name}] 网络请求失败:`, error.message)
        updateSourceStatus(source.id, 'error', error.message, responseTime)
        throw error
      }
    }

    // 单独处理数据转换，避免网络成功但转换失败的情况
    try {
      const result = await transformResponse(response)
      console.log(`[${source.name}] 转换后的数据:`, result)
      return result
    } catch (error: any) {
      console.error(`[${source.name}] 数据转换失败:`, error.message)
      console.error(`[${source.name}] 原始响应数据:`, response)
      throw new Error(`数据转换失败: ${error.message}`)
    }
  }

  /**
   * 获取歌曲详情
   */
  const getSongDetail = async (params: SongDetailParams): Promise<SongDetailResult> => {
    const enabledSources = getEnabledSources()

    for (const source of enabledSources) {
      try {
        const result = await getSongDetailWithSource(source, params)

        updateSourceStatus(source.id, 'online')

        return {
          success: true,
          source: source.id,
          data: { songs: result },
          error: undefined
        }
      } catch (error: any) {
        console.warn(`音源 ${source.name} 获取歌曲详情失败:`, error.message)
        updateSourceStatus(source.id, 'error', error.message)
      }
    }

    throw new Error('所有音源均不可用')
  }

  /**
   * 使用指定音源获取歌曲详情
   */
  const getSongDetailWithSource = async (
    source: MusicSource,
    params: SongDetailParams
  ): Promise<any[]> => {
    const startTime = Date.now()

    // 验证参数
    if (!params.ids || (Array.isArray(params.ids) && params.ids.length === 0)) {
      throw new Error('歌曲ID参数不能为空')
    }

    const ids = Array.isArray(params.ids) ? params.ids.join(',') : params.ids

    // 再次验证处理后的ids
    if (!ids || ids === 'undefined' || ids === 'null') {
      throw new Error(`无效的歌曲ID: ${ids}`)
    }

    let url: string
    let transformResponse: (data: any) => any[]

    if (source.id === 'vkeys') {
      // Vkeys API - 使用搜索接口，包含了歌曲详情
      // 默认使用网易云端点进行详情搜索
      url = `${source.baseUrl}/netease?word=${encodeURIComponent(ids)}&num=50`
      transformResponse = (data: any) => transformVkeysResponse(data, 'netease')
    } else {
      // 网易云备用API
      url = `${source.baseUrl}/song/detail?ids=${ids}`
      transformResponse = (response: any) => {
        if (response.code !== 200 || !response.songs) {
          throw new Error(`API响应错误: ${response.message || '未知错误'}`)
        }
        return transformNeteaseDetailResponse(response)
      }
    }

    try {
      const response = await $fetch(url, {
        timeout: source.timeout || config.value.timeout,
        headers: {
          'Content-Type': 'application/json',
          ...source.headers
        }
      })

      const responseTime = Date.now() - startTime
      updateSourceStatus(source.id, 'online', undefined, responseTime)

      return transformResponse(response)
    } catch (error: any) {
      const responseTime = Date.now() - startTime
      updateSourceStatus(source.id, 'error', error.message, responseTime)
      throw error
    }
  }

  /**
   * 更新音源状态
   */
  const updateSourceStatus = (
    sourceId: string,
    status: SourceStatus['status'],
    errorMessage?: string,
    responseTime?: number
  ) => {
    sourceStatus.value[sourceId] = {
      status,
      responseTime,
      lastCheck: new Date(),
      errorMessage
    }
  }

  /**
   * 获取歌曲封面URL（网易云备用源）
   * 实现两步搜索：先通过歌曲ID获取详情，然后提取封面URL
   */
  const getSongPicUrl = async (id: number): Promise<string> => {
    try {
      // 获取网易云备用源
      const enabledSources = getEnabledSources()
      const neteaseSource = enabledSources.find((source) => source.id.includes('netease-backup'))

      if (!neteaseSource) {
        console.error('[getSongPicUrl] 未找到网易云备用源')
        return ''
      }

      // 直接调用/song/detail接口获取歌曲详情
      const response = await $fetch(`${neteaseSource.baseUrl}/song/detail`, {
        params: { ids: id },
        timeout: neteaseSource.timeout || 8000
      })

      // 从响应中提取封面URL
      return response.songs?.[0]?.al?.picUrl || ''
    } catch (error) {
      console.error('[getSongPicUrl] 获取封面失败:', error)
      return ''
    }
  }

  /**
   * 将VoiceHub音质数值映射到网易云API的level参数
   */
  const mapQualityToLevel = (quality: number): string => {
    // 根据网易云API文档映射音质等级
    switch (quality) {
      case 2:
        return 'standard' // 标准 (128k)
      case 3:
        return 'higher' // 较高 (192k)
      case 4:
        return 'exhigh' // HQ极高 (320k)
      case 5:
        return 'lossless' // SQ无损
      case 6:
        return 'hires' // Hi-Res
      case 9:
        return 'jymaster' // 超清母带
      default:
        return 'exhigh' // 默认极高音质
    }
  }

  /**
   * 获取歌曲播放URL
   * 根据平台选择合适的音源：网易云优先使用netease-backup；QQ音乐仅使用vkeys系（不跨平台）
   */
  const getSongUrl = async (
    id: number | string,
    quality?: number,
    platform?: string,
    cookie?: string,
    options?: {
      unblock?: boolean
      bilibiliCid?: string
    }
  ): Promise<{
    success: boolean
    url?: string
    error?: string
  }> => {
    // 特殊处理 netease-podcast 平台：使用网易云逻辑但禁用 unblock
    if (platform === 'netease-podcast') {
      platform = 'netease'
      if (!options) {
        options = {}
      }
      // 只有在未明确指定 unblock 时才强制设为 false
      if (options.unblock === undefined) {
        options.unblock = false
      }
    }

    // 如果没有提供cookie且在客户端环境，尝试从localStorage获取
    if (!cookie && import.meta.client) {
      try {
        const storedCookie = localStorage.getItem('netease_cookie')
        if (storedCookie) {
          cookie = storedCookie
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    try {
      // 获取所有启用的音源
      const enabledSources = getEnabledSources()

      // 支持多个ID的批量查询（用逗号分隔）
      let idParam = Array.isArray(id) ? id.join(',') : id.toString()

      // 如果是 bilibili 平台且 id 包含 cid，解析出来
      if (platform === 'bilibili' && !Array.isArray(id)) {
        const parsed = parseBilibiliId(id)
        idParam = parsed.bvid
        if (parsed.cid) {
          if (!options) {
            options = {}
          }
          if (!options.bilibiliCid) {
            options.bilibiliCid = parsed.cid
          }
        }
      }

      // 定义音源尝试顺序
      const sourcesToTry: Array<{ source: MusicSource; type: 'netease' | 'tencent' | 'bilibili' }> =
        []

      if (platform === 'bilibili') {
        const bilibiliSource = enabledSources.find((source) => source.id === 'bilibili')
        if (bilibiliSource) {
          sourcesToTry.push({ source: bilibiliSource, type: 'bilibili' })
        }
      } else if (platform === 'tencent') {
        // QQ音乐平台：优先 vkeys v3（获取音质列表并选择可用项），然后回退到 vkeys v2

        const v3 = enabledSources.find((source) => source.id === 'vkeys-v3')
        const v2 = enabledSources.find((source) => source.id === 'vkeys')
        if (v3) {
          sourcesToTry.push({ source: v3, type: 'tencent' })
        }
        if (v2) {
          sourcesToTry.push({ source: v2, type: 'tencent' })
        }
      } else {
        // 网易云音乐平台（默认）：优先使用netease-backup系列，然后vkeys，最后其他

        const neteaseSource = enabledSources.find((source) => source.id.includes('netease-backup'))
        if (neteaseSource) {
          sourcesToTry.push({ source: neteaseSource, type: 'netease' })
        }

        const vkeysSource = enabledSources.find((source) => source.id === 'vkeys')
        if (vkeysSource) {
          sourcesToTry.push({ source: vkeysSource, type: 'netease' })
        }

        // 添加 Meting API 备用源
        const metingSources = enabledSources.filter((source) => source.id.startsWith('meting-'))
        metingSources.forEach((source) => {
          sourcesToTry.push({ source, type: 'netease' })
        })

        // 添加其他备用音源
        const otherSources = enabledSources.filter(
          (source) =>
            source.id !== 'vkeys' &&
            !source.id.includes('netease-backup') &&
            !source.id.startsWith('meting-')
        )
        otherSources.forEach((source) => {
          sourcesToTry.push({ source, type: 'netease' })
        })
      }

      // 逐个尝试音源
      for (const { source, type } of sourcesToTry) {
        try {
          let url: string | null = null

          if (source.id === 'bilibili') {
            const result = await getBilibiliTrackUrl(idParam, options?.bilibiliCid)
            url = result.url
          } else if (source.id === 'vkeys') {
            // Vkeys API
            const numQuality =
              quality !== undefined && quality !== null && quality !== '' ? Number(quality) : NaN
            const vkeysQuality =
              type === 'tencent'
                ? !isNaN(numQuality)
                  ? numQuality
                  : 8
                : !isNaN(numQuality)
                  ? numQuality
                  : 0
            const endpoint = type === 'tencent' ? 'tencent' : 'netease'
            const vkeysUrl = `${source.baseUrl}/${endpoint}?id=${idParam}&quality=${vkeysQuality}`

            const vkeysResp = await $fetch(vkeysUrl, { timeout: source.timeout || 8000 })

            if (vkeysResp?.code === 200 && vkeysResp?.data?.url) {
              url = String(vkeysResp.data.url)
            }
          } else if (source.id === 'vkeys-v3') {
            // Vkeys v3：先获取歌曲信息与音质列表，再按可用音质选择并调用 v2 获取可播放URL
            try {
              const infoUrl = `${source.baseUrl}/tencent/song/info?id=${encodeURIComponent(idParam)}`
              const infoResp = await $fetch(infoUrl, { timeout: source.timeout || 8000 })

              // v3 成功码为 0
              if (typeof infoResp?.code !== 'number' || infoResp.code !== 0 || !infoResp?.data) {
                throw new Error(
                  `v3 歌曲信息接口错误: ${infoResp?.message || '未知错误'} (code: ${infoResp?.code})`
                )
              }

              const qualityInfo: Array<{
                type: number
                size: number
                file: string
                quality: string
              }> = infoResp.data.qualityInfo || []
              if (!Array.isArray(qualityInfo) || qualityInfo.length === 0) {
                throw new Error('v3 歌曲信息缺少音质列表')
              }

              // 目标音质：优先使用传入quality，否则读取设置
              let targetQuality: number
              const numQuality =
                quality !== undefined && quality !== null && quality !== '' ? Number(quality) : NaN

              if (!isNaN(numQuality)) {
                targetQuality = numQuality
              } else {
                try {
                  const { getQuality } = await import('./useAudioQuality')
                  const setting = getQuality('tencent')
                  targetQuality = Number(setting)
                  if (isNaN(targetQuality)) targetQuality = 8
                } catch {
                  targetQuality = 8 // 默认 HQ 高音质
                }
              }

              // 构造腾讯音质优先序列：以目标为首，其次按 QUALITY_OPTIONS.tencent 顺序降级，最后兜底常见音质
              let fallbackList: number[] = []
              try {
                const { QUALITY_OPTIONS } = await import('./useAudioQuality')
                const optionValues =
                  (QUALITY_OPTIONS as any)?.tencent?.map((o: any) => o.value) || []
                fallbackList = optionValues.filter((v: number) => v !== targetQuality)
              } catch {
                // 兜底序列
                fallbackList = [8, 4, 10, 11, 14]
              }
              const tryQualities = [targetQuality, ...fallbackList]

              // 在 v3 音质列表中选择第一个 size>0 的可用音质
              const available = tryQualities.find((q) =>
                qualityInfo.some((qi) => qi.type === q && Number(qi.size) > 0)
              )
              const selectedQuality = available ?? targetQuality

              // 使用 vkeys v2 点歌接口获取可播放URL（v3 不直接返回 URL）
              const v2Source = getEnabledSources().find((s) => s.id === 'vkeys')
              if (!v2Source) {
                throw new Error('未配置 vkeys v2 音源以获取播放链接')
              }

              const v2Url = `${v2Source.baseUrl}/tencent?id=${idParam}&quality=${selectedQuality}`
              const v2Resp = await $fetch(v2Url, { timeout: v2Source.timeout || 8000 })
              if (v2Resp?.code === 200 && v2Resp?.data?.url) {
                url = String(v2Resp.data.url)
              } else {
                // 如果首选失败，尝试在可用音质上继续降级（排除已尝试项）
                for (const q of tryQualities.filter((q) => q !== selectedQuality)) {
                  const hasQuality = qualityInfo.some((qi) => qi.type === q && Number(qi.size) > 0)
                  if (!hasQuality) continue

                  const altUrl = `${v2Source.baseUrl}/tencent?id=${idParam}&quality=${q}`
                  const altResp = await $fetch(altUrl, { timeout: v2Source.timeout || 8000 })
                  if (altResp?.code === 200 && altResp?.data?.url) {
                    url = String(altResp.data.url)
                    break
                  }
                }
              }

              // 若仍未拿到URL，抛出错误以便外层继续按源回退
              if (!url) {
                throw new Error('v3 信息+v2 点歌未获取到有效播放链接')
              }
            } catch (error: any) {
              // vkeys v3 路径失败，继续回退其它音源
            }
          } else if (source.id.startsWith('meting-')) {
            // Meting API - 获取播放链接
            try {
              // 首先尝试获取歌曲信息，包含播放链接
              const songInfo = await getMetingSongInfo(idParam, source)

              if (songInfo.success && songInfo.data?.url) {
                // 从歌曲信息中提取播放链接
                url = songInfo.data.url
              } else {
                // 如果获取歌曲信息失败，直接使用 URL 类型的 API
                const metingUrl = `${source.baseUrl}/?server=netease&type=url&id=${idParam}`

                // 对于 Meting API，我们需要处理重定向
                const response = await fetch(metingUrl, {
                  method: 'GET',
                  headers: source.headers || {},
                  redirect: 'follow'
                })

                if (response.ok && response.url) {
                  url = response.url
                }
              }
            } catch (error: any) {
              // Meting API 获取失败，继续回退其它音源
            }
          } else {
            // 网易云备用API
            let level = 'exhigh'
            try {
              const { getQuality } = await import('./useAudioQuality')
              const neteaseQuality = getQuality('netease')
              level = mapQualityToLevel(neteaseQuality)
            } catch (error) {
              // 无法获取音质设置，使用默认音质
            }

            // 如果提供了cookie，添加到请求参数中
            const params: any = {
              id: idParam,
              level: level,
              unblock: options?.unblock ?? true
            }
            if (cookie) {
              params.cookie = cookie
            }

            const response = await $fetch(`${source.baseUrl}/song/url/v1`, {
              params,
              timeout: source.timeout || 8000
            })

            if (response?.code === 200 && Array.isArray(response.data) && response.data[0]?.url) {
              url = response.data[0].url as string
            }
          }

          if (url) {
            // 修复HTTP/HTTPS协议问题
            if (url.startsWith('http://')) {
              url = url.replace('http://', 'https://')
            }

            // 验证播放链接
            const validation = await validatePlayUrl(url)

            if (validation.valid) {
              return { success: true, url }
            } else {
              // 继续尝试下一个音源
            }
          } else {
            // 未返回有效链接，继续尝试下一个音源
          }
        } catch (error: any) {
          // 当前音源获取失败，继续尝试下一个音源
          // 继续尝试下一个音源
        }
      }

      return { success: false, error: '所有音源均无法获取有效的播放链接' }
    } catch (error: any) {
      return { success: false, error: error?.message || '未知错误' }
    }
  }

  /**
   * 获取歌词（统一调度，支持优先级策略）
   * NeteaseCloudMusicApi 优先，其次 vkeys；腾讯仅 vkeys
   */
  const getLyrics = async (
    platform: 'netease' | 'tencent',
    id: number | string
  ): Promise<{
    success: boolean
    data?: { lrc: string; trans?: string; yrc?: string; ttml?: string }
    error?: string
  }> => {
    try {
      const settings = useLyricSettings()
      const enabledSources = getEnabledSources()
      const neteaseSource = enabledSources.find((source) => source.id.includes('netease-backup'))
      const vkeysSource = enabledSources.find((source) => source.id === 'vkeys')

      // 结果容器
      const resultData = { lrc: '', trans: '', yrc: '', ttml: '' }
      let hasResult = false

      // 辅助函数：获取官方歌词 (网易云)
      const fetchOfficial = async () => {
        if (platform !== 'netease' || !neteaseSource) return
        try {
          const [lrcResp, yrcResp, ttmlResp] = await Promise.allSettled([
            $fetch(`${neteaseSource.baseUrl}/lyric`, {
              params: { id: id.toString() },
              timeout: neteaseSource.timeout || 8000
            }),
            $fetch(`${neteaseSource.baseUrl}/lyric/new`, {
              params: { id: id.toString() },
              timeout: neteaseSource.timeout || 8000
            }),
            // 尝试获取 TTML 歌词
            $fetch(`${neteaseSource.baseUrl}/lyric/ttml`, {
              params: { id: id.toString() },
              timeout: neteaseSource.timeout || 8000
            }).catch(() => null)
          ])

          if (lrcResp.status === 'fulfilled' && lrcResp.value?.code === 200) {
            const lr = lrcResp.value
            if (lr?.lrc?.lyric) resultData.lrc = lr.lrc.lyric
            if (lr?.tlyric?.lyric) resultData.trans = lr.tlyric.lyric
          }
          if (yrcResp.status === 'fulfilled' && yrcResp.value?.code === 200) {
            const yr = yrcResp.value
            if (yr?.yrc?.lyric) resultData.yrc = yr.yrc.lyric
          }
          if (ttmlResp.status === 'fulfilled' && ttmlResp.value?.code === 200) {
            const tr = ttmlResp.value
            if (tr?.ttml && !resultData.ttml) resultData.ttml = tr.ttml
          }

          if (resultData.lrc || resultData.yrc || resultData.ttml) hasResult = true
        } catch (e: any) {
          console.warn('[getLyrics] NeteaseCloudMusicApi 获取失败:', e?.message || e)
        }
      }

      // 辅助函数：获取 AMLL DB Server TTML
      const fetchAMLL = async () => {
        if (platform !== 'netease' || !settings.enableOnlineTTMLLyric.value) return
        const serverUrl = settings.amllDbServer.value
        if (!serverUrl) return

        try {
          const url = serverUrl.replace('%s', id.toString())
          const ttml = await $fetch(url, { responseType: 'text' })
          if (ttml && typeof ttml === 'string' && ttml.includes('<tt')) {
            resultData.ttml = ttml
            hasResult = true
          }
        } catch (e) {
          // console.warn('[getLyrics] AMLL DB Server 获取失败')
        }
      }

      // 辅助函数：获取 QQ 音乐 (vkeys)
      const fetchQM = async () => {
        if (!vkeysSource) return
        // 如果禁用了 QM 歌词且不是强制 QM 模式，则跳过
        if (!settings.enableQQMusicLyric.value && settings.lyricPriority.value !== 'qm') return

        try {
          let url: string
          if (platform === 'netease') {
            url = `${vkeysSource.baseUrl}/netease/lyric?id=${id}`
          } else if (platform === 'tencent') {
            url = `${vkeysSource.baseUrl}/tencent/lyric?id=${id}`
          } else {
            return
          }

          const resp = await $fetch(url, {
            timeout: vkeysSource.timeout || 8000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          })
          if (resp?.code === 200 && resp?.data) {
            const d = resp.data
            if (d.lrc) resultData.lrc = d.lrc
            if (d.trans) resultData.trans = d.trans
            if (d.yrc) resultData.yrc = d.yrc // QRC
            if (d.lrc || d.yrc) hasResult = true
          }
        } catch (e) {
          console.warn('[getLyrics] vkeys 获取失败:', e)
        }
      }

      // 优先级策略执行
      const priority = settings.lyricPriority.value
      console.log(`[getLyrics] 使用策略: ${priority}, 平台: ${platform}, ID: ${id}`)

      if (priority === 'qm') {
        await fetchQM()
        if (!hasResult) {
          await Promise.all([fetchAMLL(), fetchOfficial()])
        }
      } else if (priority === 'ttml') {
        await fetchAMLL()
        // 如果 AMLL 没拿到 TTML，尝试官方
        if (!resultData.ttml) {
          await fetchOfficial()
        } else {
          // 即使拿到了 TTML，也可能需要官方的 LRC/翻译 作为补充（如果 AMLL 只有 TTML）
          // 但通常 TTML 足够了。为了保险起见，如果缺 LRC，可以去官方拿一下？
          // SPlayer 逻辑是：fetchTTMLLyric -> fetchOfficialLyric -> fetchQQMusicLyric
          // 这里简化：如果 fetchAMLL 成功，我们认为主要任务完成，但为了完整性（如翻译），可以尝试官方
          if (!resultData.lrc || !resultData.trans) {
            await fetchOfficial()
          }
        }

        if (!hasResult) {
          await fetchQM()
        }
      } else if (priority === 'official') {
        await fetchOfficial()
      } else {
        // auto / default
        if (settings.enableQQMusicLyric.value) {
          await fetchQM()
        }
        await Promise.all([fetchAMLL(), fetchOfficial()])
      }

      // 检查是否有结果
      if (hasResult) {
        return { success: true, data: resultData }
      }

      // 最后尝试 Meting API（仅支持网易云，作为最后的 Fallback）
      if (platform === 'netease') {
        const metingSources = enabledSources.filter((source) => source.id.startsWith('meting-'))

        for (const metingSource of metingSources) {
          try {
            const metingUrl = `${metingSource.baseUrl}/?server=netease&type=lrc&id=${id}`
            const resp = await $fetch(metingUrl, {
              timeout: metingSource.timeout || 8000,
              headers: metingSource.headers
            })

            // Meting API 直接返回歌词文本
            if (resp && typeof resp === 'string' && resp.trim()) {
              return {
                success: true,
                data: {
                  lrc: resp,
                  trans: '',
                  yrc: '',
                  ttml: ''
                }
              }
            }
          } catch (error: any) {
            console.warn(
              `[getLyrics] Meting API ${metingSource.name} 获取失败:`,
              error?.message || error
            )
          }
        }
      }

      return { success: false, error: '未获取到歌词' }
    } catch (error: any) {
      console.error('[getLyrics] 获取歌词失败:', error)
      return { success: false, error: error?.message || '未知错误' }
    }
  }

  /**
   * 转换 Vkeys API 响应
   */
  const transformVkeysResponse = (response: any, platform: string = 'netease'): any[] => {
    console.log('[transformVkeysResponse] 开始转换数据:', { platform, response })

    if (!response) {
      console.log('[transformVkeysResponse] 响应为空')
      throw new Error('API响应为空')
    }

    // 检查错误码，非200状态码抛出错误以触发备用源重试
    if (response.code !== 200) {
      const errorMessage = `vkeys API错误: ${response.message || '未知错误'} (code: ${response.code})`
      console.log('[transformVkeysResponse] API错误:', errorMessage)
      throw new Error(errorMessage)
    }

    if (!response.data) {
      console.log('[transformVkeysResponse] 响应数据为空')
      throw new Error('API响应数据为空')
    }

    if (platform === 'tencent') {
      // QQ音乐返回数组格式
      const songs = Array.isArray(response.data) ? response.data : [response.data]
      console.log(`[transformVkeysResponse] QQ音乐处理 ${songs.length} 首歌曲`)

      return songs.map((song: any, index: number) => {
        const transformedSong = {
          id: song.id || song.musicId,
          title: song.song || song.name || song.title,
          artist: song.singer || song.artist || '未知艺术家',
          cover: song.cover,
          album: song.album,
          duration: song.duration || song.dt,
          musicPlatform: 'tencent',
          musicId: (song.id || song.musicId)?.toString(),
          url: song.url, // 添加vkeys API返回的播放链接
          hasUrl: !!song.url, // 标记是否有播放链接
          sourceInfo: {
            source: 'vkeys',
            originalId: (song.id || song.musicId)?.toString(),
            fetchedAt: new Date(),
            mid: song.mid, // QQ音乐特有的mid字段
            vid: song.vid, // QQ音乐特有的vid字段
            quality: song.quality,
            pay: song.pay,
            subtitle: song.subtitle,
            time: song.time,
            type: song.type,
            bpm: song.bpm,
            grp: song.grp
          }
        }
        console.log(`[transformVkeysResponse] QQ音乐转换歌曲 ${index + 1}:`, transformedSong)
        return transformedSong
      })
    } else {
      // 网易云返回数组格式
      const songs = Array.isArray(response.data) ? response.data : [response.data]
      console.log(`[transformVkeysResponse] 网易云处理 ${songs.length} 首歌曲`)

      return songs.map((song: any, index: number) => {
        const transformedSong = {
          id: song.id,
          title: song.song,
          artist: song.singer || '未知艺术家',
          cover: song.cover?.trim(), // 去除可能的空格
          album: song.album,
          duration: song.interval || song.time, // 网易云使用interval字段表示时长，备用time字段
          musicPlatform: 'netease',
          musicId: song.id?.toString(),
          url: song.url, // 添加vkeys API返回的播放链接
          hasUrl: !!song.url, // 标记是否有播放链接
          sourceInfo: {
            source: 'vkeys',
            originalId: song.id?.toString(),
            fetchedAt: new Date(),
            quality: song.quality,
            size: song.size,
            kbps: song.kbps,
            url: song.url,
            link: song.link,
            time: song.time
          }
        }
        console.log(`[transformVkeysResponse] 网易云转换歌曲 ${index + 1}:`, transformedSong)
        return transformedSong
      })
    }
  }

  /**
   * 转换 Vkeys v3 QQ音乐搜索响应
   * 文档: https://doc.vkeys.cn/v3/音乐模块/QQ音乐/搜索相关接口/2-song.html
   */
  const transformVkeysV3TencentSearch = (response: any): any[] => {
    if (!response) throw new Error('API响应为空')
    if (typeof response.code !== 'number') throw new Error('响应缺少状态码')

    // v3 成功码为 0
    if (response.code !== 0) {
      const msg = `vkeys v3 API错误: ${response.message || '未知错误'} (code: ${response.code})`
      throw new Error(msg)
    }

    const data = response.data
    if (!data || !Array.isArray(data.list)) {
      throw new Error('v3 响应数据格式不正确')
    }

    return data.list.map((item: any) => {
      const id = item.songID ?? item.songId ?? item.id
      const duration = item.interval ?? item.duration
      return {
        id,
        title: item.title,
        artist: Array.isArray(item.singerList)
          ? item.singerList.map((s: any) => s.name).join('/')
          : item.singer || '',
        cover: item.albumImage || item.cover || '',
        album: item.album || '',
        duration,
        musicPlatform: 'tencent',
        musicId: id?.toString(),
        url: undefined,
        hasUrl: false,
        sourceInfo: {
          source: 'vkeys-v3',
          originalId: id?.toString(),
          fetchedAt: new Date(),
          mid: item.songMID || item.mid,
          vid: item.vid,
          quality: item.quality,
          pay: item.pay,
          subtitle: item.subtitle,
          time: item.time,
          type: item.type,
          bpm: item.bpm,
          grp: item.grp
        }
      }
    })
  }

  /**
   * 转换网易云 API 搜索响应
   * 实现两步搜索：处理搜索结果，然后批量获取歌曲详情和封面
   */
  const transformNeteaseResponse = async (response: any): Promise<any[]> => {
    console.log('[transformNeteaseResponse] 开始转换数据:', response)

    // 检查响应是否存在
    if (!response) {
      throw new Error('API响应为空')
    }

    // 检查API响应状态码
    if (response.code !== undefined && response.code !== 200) {
      throw new Error(`API响应错误: ${response.message || '未知错误'} (code: ${response.code})`)
    }

    // 尝试获取结果列表，支持多种类型（单曲、电台、声音等）
    const result = response.result || response.data
    if (!result) {
      throw new Error('API响应格式错误: 缺少result/data字段')
    }

    let items =
      result.songs || result.djRadios || result.resources || result.voices || result.list || []

    // 如果是声音搜索(type=2000)，结果可能在 data.resources 或 data.list 中
    if (!items || items.length === 0) {
      if (result.data?.resources) {
        items = result.data.resources
      } else if (result.list) {
        items = result.list
      } else if (Array.isArray(result)) {
        items = result
      }
    }

    if (!Array.isArray(items)) {
      console.error('[transformNeteaseResponse] 无效的响应结构:', {
        keys: Object.keys(result),
        itemsType: typeof items
      })
      // 如果找不到列表但也不是错误，可能就是没结果
      return []
    }

    console.log(`[transformNeteaseResponse] 找到 ${items.length} 个结果`)

    if (items.length === 0) {
      return []
    }

    // 检查是否是歌曲类型的完整信息
    // 只有当 items 是 songs 且包含 al.picUrl 时才认为是完整信息的歌曲
    const isSongType = !!result.songs
    const hasCompleteInfo = isSongType && items.some((item: any) => item.al?.picUrl)
    console.log(
      `[transformNeteaseResponse] 结果类型: ${isSongType ? '歌曲' : '其他'}, 完整信息: ${hasCompleteInfo}`
    )

    let detailResponse: any = null
    const detailMap = new Map()

    // 如果是search接口响应的歌曲（缺少完整信息），则需要获取详情
    if (isSongType && !hasCompleteInfo) {
      // 获取网易云备用源
      const enabledSources = getEnabledSources()
      const neteaseSource = enabledSources.find((source) => source.id.includes('netease-backup'))

      if (neteaseSource) {
        // 提取所有歌曲ID，准备批量获取详情
        const songIds = items.map((song: any) => song.id).filter((id: any) => id)
        console.log(`[transformNeteaseResponse] 准备批量获取 ${songIds.length} 首歌曲的详情`)

        if (songIds.length > 0) {
          try {
            // 批量获取歌曲详情，包含封面信息
            detailResponse = await $fetch(`${neteaseSource.baseUrl}/song/detail`, {
              params: { ids: songIds.join(',') },
              timeout: neteaseSource.timeout || 8000
            })
            console.log(`[transformNeteaseResponse] 批量获取详情成功`)
          } catch (error) {
            console.warn(
              '[transformNeteaseResponse] 批量获取详情失败，将使用搜索结果的基本信息:',
              error
            )
          }
        }

        // 创建详情映射，方便查找
        if (detailResponse?.songs) {
          detailResponse.songs.forEach((song: any) => {
            detailMap.set(song.id, song)
          })
        }
      }
    }

    // 转换搜索结果，根据接口类型使用不同的数据提取策略
    return items
      .map((item: any, index: number) => {
        try {
          let id = item.id
          let title = item.name
          let cover: string | null = null
          let artist: string = '未知艺术家'
          let album: string | undefined
          let duration: number = 0
          let musicId = item.id?.toString()

          // 处理不同类型的数据结构
          if (isSongType) {
            // 歌曲类型处理
            if (hasCompleteInfo) {
              // cloudsearch接口响应，包含完整信息
              cover = item.al?.picUrl || null
              artist = item.ar?.map((a: any) => a.name).join('/') || '未知艺术家'
              album = item.al?.name
              duration = item.dt || 0
            } else {
              // search接口响应，需要从详情中获取信息
              const detail = detailMap.get(item.id)
              cover =
                detail?.al?.picUrl ||
                (item.album?.picId
                  ? `https://p1.music.126.net/${item.album.picId}/${item.album.picId}.jpg`
                  : null)
              artist = item.artists?.map((a: any) => a.name).join('/') || '未知艺术家'
              album = item.album?.name
              duration = item.duration || 0
            }
          } else {
            // 其他类型（如声音、电台等）
            // 尝试适配声音/播客结构
            const baseInfo = item.baseInfo || item

            // 优先使用 mainSong.id (声音) 或 mainTrackId (电台节目) 作为歌曲ID，以便能通过 song/url 接口播放
            // 如果都没有，才使用 baseInfo.id (节目ID)
            const songId = baseInfo.mainSong?.id || baseInfo.mainTrackId || baseInfo.id
            id = songId || id

            title = baseInfo.name || title
            cover = baseInfo.coverUrl || baseInfo.picUrl || item.picUrl || null

            // 尝试获取艺术家/主播信息
            if (baseInfo.dj) {
              artist = baseInfo.dj.nickname
            } else if (item.dj) {
              artist = item.dj.nickname
            } else if (baseInfo.artist) {
              artist = baseInfo.artist.name
            }

            // 尝试获取专辑/电台信息
            if (baseInfo.radio) {
              album = baseInfo.radio.name
            } else if (item.radio) {
              album = item.radio.name
            }

            duration = baseInfo.duration || item.duration || 0

            // 声音ID
            musicId = id?.toString()
          }

          const transformedSong = {
            id: id,
            title: title,
            artist,
            cover,
            album,
            duration,
            musicPlatform: isSongType ? 'netease' : 'netease-podcast',
            musicId: musicId,
            sourceInfo: {
              source: 'netease-backup',
              originalId: musicId,
              fetchedAt: new Date(),
              hasDetail: hasCompleteInfo || !!detailMap.get(item.id),
              interface: hasCompleteInfo ? 'cloudsearch' : 'search',
              type: isSongType ? 'song' : 'voice'
            }
          }
          // 只打印前几个结果，避免日志过多
          if (index < 3) {
            console.log(`[transformNeteaseResponse] 转换结果 ${index + 1}:`, transformedSong)
          }
          return transformedSong
        } catch (error: any) {
          console.error(
            `[transformNeteaseResponse] 转换第 ${index + 1} 个结果失败:`,
            error.message,
            item
          )
          // 不抛出错误，而是跳过该项
          return null
        }
      })
      .filter((item: any) => item !== null)
  }

  /**
   * 转换网易云 API 详情响应
   */
  const transformNeteaseDetailResponse = (response: any): any[] => {
    return response.songs.map((song: any) => ({
      id: song.id,
      title: song.name,
      artist: song.ar?.map((artist: any) => artist.name).join('/') || '未知艺术家',
      cover: song.al?.picUrl,
      album: song.al?.name,
      duration: song.dt,
      fee: song.fee,
      privilege: song.privilege,
      musicPlatform: 'netease',
      musicId: song.id.toString(),
      sourceInfo: {
        source: 'netease-backup',
        originalId: song.id.toString(),
        fetchedAt: new Date()
      }
    }))
  }

  /**
   * 获取音源状态摘要
   */
  const getSourceStatusSummary = computed(() => {
    const summary = {
      total: config.value.sources.length,
      online: 0,
      offline: 0,
      error: 0,
      unknown: 0
    }

    config.value.sources.forEach((source) => {
      const status = sourceStatus.value[source.id]
      if (!status) {
        summary.unknown++
      } else {
        summary[status.status]++
      }
    })

    return summary
  })

  /**
   * 获取当前音源信息
   */
  const getCurrentSourceInfo = computed(() => {
    const source = getSourceById(currentSource.value)
    const status = sourceStatus.value[currentSource.value]

    return {
      source,
      status,
      isHealthy: status?.status === 'online'
    }
  })

  /**
   * 获取电台/播客节目列表
   */
  const getDjPrograms = async (
    radioId: string | number,
    limit: number = 20,
    offset: number = 0,
    cookie?: string
  ): Promise<{
    success: boolean
    programs: any[]
    count: number
    more: boolean
    error?: string
  }> => {
    const enabledSources = getEnabledSources()
    // 优先使用网易云备用源
    const neteaseSources = enabledSources.filter((source) => source.id.includes('netease-backup'))

    // 如果没有找到网易云备用源，尝试其他可能支持的源（虽然目前只有备用源支持此接口）
    if (neteaseSources.length === 0) {
      return {
        success: false,
        programs: [],
        count: 0,
        more: false,
        error: '未找到可用的网易云音源'
      }
    }

    // 尝试所有网易云源
    for (const source of neteaseSources) {
      try {
        let cookieParam = ''
        if (cookie) {
          cookieParam = `&cookie=${encodeURIComponent(cookie)}`
        }

        const url = `${source.baseUrl}/dj/program?rid=${radioId}&limit=${limit}&offset=${offset}${cookieParam}`
        console.log(`[getDjPrograms] Requesting: ${url}`)

        const response: any = await $fetch(url, {
          timeout: source.timeout || 8000
        })

        if (response.code === 200) {
          return {
            success: true,
            programs: response.programs || [],
            count: response.count || 0,
            more: response.more || false
          }
        }
      } catch (e: any) {
        console.warn(`[getDjPrograms] Source ${source.id} failed:`, e.message)
      }
    }

    return { success: false, programs: [], count: 0, more: false, error: '获取节目列表失败' }
  }

  return {
    // 状态
    config: readonly(config),
    currentSource: readonly(currentSource),
    sourceStatus: readonly(sourceStatus),
    isSearching: readonly(isSearching),
    lastUsedSource: readonly(lastUsedSource),

    // 计算属性
    sourceStatusSummary: getSourceStatusSummary,
    currentSourceInfo: getCurrentSourceInfo,

    // 方法
    searchSongs,
    getSongDetail,
    getSongUrl,
    getLyrics,
    getMetingSongInfo,
    updateSourceStatus,
    validatePlayUrl,
    getDjPrograms
  }
}
