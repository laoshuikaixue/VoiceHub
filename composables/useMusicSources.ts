/**
 * 音源管理器 Composable
 * 提供多音源搜索、故障转移和状态监控功能
 */

import {
  MUSIC_SOURCE_CONFIG,
  getEnabledSources,
  getSourceById,
  type MusicSource,
  type MusicSourceConfig,
  type SourceStatus,
  type MusicSearchParams,
  type MusicSearchResult,
  type SongDetailParams,
  type SongDetailResult
} from '~/utils/musicSources'

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
  
  // 是否正在搜索
  const isSearching = ref(false)
  
  // 最后一次搜索的音源
  const lastUsedSource = ref<string>('')

  /**
   * 搜索歌曲（带故障转移）
   */
  const searchSongs = async (params: MusicSearchParams): Promise<MusicSearchResult> => {
    if (isSearching.value) {
      throw new Error('搜索正在进行中，请稍候')
    }

    isSearching.value = true
    
    try {
      const enabledSources = getEnabledSources()
      
      if (enabledSources.length === 0) {
        throw new Error('没有可用的音源')
      }

      // 按优先级尝试每个音源
      for (const source of enabledSources) {
        try {
          console.log(`尝试使用音源: ${source.name}`)
          const result = await searchWithSource(source, params)
          
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
          
          // 如果不是最后一个音源，继续尝试下一个
          if (source !== enabledSources[enabledSources.length - 1]) {
            continue
          }
        }
      }
      
      // 所有音源都失败了
      throw new Error('所有音源均不可用，请稍后重试')
      
    } finally {
      isSearching.value = false
    }
  }

  /**
   * 使用指定音源搜索
   */
  const searchWithSource = async (source: MusicSource, params: MusicSearchParams): Promise<any[]> => {
    const startTime = Date.now()
    
    let url: string
    let transformResponse: (data: any) => any[]

    if (source.id === 'vkeys') {
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
      url = `${source.baseUrl}/search?keywords=${encodeURIComponent(params.keywords)}&limit=${params.limit || 30}&offset=${params.offset || 0}&type=${params.type || 1}`
      transformResponse = async (data: any) => await transformNeteaseResponse(data)
    }

    let response: any
    try {
      console.log(`[${source.name}] 请求URL:`, url)
      response = await $fetch(url, {
        timeout: source.timeout || config.value.timeout,
        headers: {
          'Content-Type': 'application/json',
          ...source.headers
        }
      })
      console.log(`[${source.name}] API响应:`, response)

      const responseTime = Date.now() - startTime
      updateSourceStatus(source.id, 'online', undefined, responseTime)

    } catch (error: any) {
      const responseTime = Date.now() - startTime
      console.error(`[${source.name}] 网络请求失败:`, error.message)
      updateSourceStatus(source.id, 'error', error.message, responseTime)
      throw error
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
        continue
      }
    }
    
    throw new Error('所有音源均不可用')
  }

  /**
   * 使用指定音源获取歌曲详情
   */
  const getSongDetailWithSource = async (source: MusicSource, params: SongDetailParams): Promise<any[]> => {
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
      const neteaseSource = enabledSources.find(source => source.id.includes('netease-backup'))
      
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

    // 检查是否有result.songs数据
    if (!response.result?.songs || !Array.isArray(response.result.songs)) {
      console.error('[transformNeteaseResponse] 无效的响应结构:', {
        hasResult: !!response.result,
        hasSongs: !!response.result?.songs,
        songsType: typeof response.result?.songs,
        songsLength: response.result?.songs?.length
      })
      throw new Error(`API响应数据格式错误: 缺少songs数组`)
    }

    const songs = response.result.songs
    console.log(`[transformNeteaseResponse] 找到 ${songs.length} 首歌曲`)

    if (songs.length === 0) {
      return []
    }

    // 获取网易云备用源
    const enabledSources = getEnabledSources()
    const neteaseSource = enabledSources.find(source => source.id.includes('netease-backup'))
    
    if (!neteaseSource) {
      console.error('[transformNeteaseResponse] 未找到网易云备用源')
      throw new Error('未找到网易云备用源')
    }

    // 提取所有歌曲ID，准备批量获取详情
    const songIds = songs.map(song => song.id).filter(id => id)
    console.log(`[transformNeteaseResponse] 准备批量获取 ${songIds.length} 首歌曲的详情`)
    
    let detailResponse: any = null
    if (songIds.length > 0) {
      try {
        // 批量获取歌曲详情，包含封面信息
        detailResponse = await $fetch(`${neteaseSource.baseUrl}/song/detail`, {
          params: { ids: songIds.join(',') },
          timeout: neteaseSource.timeout || 8000
        })
        console.log(`[transformNeteaseResponse] 批量获取详情成功:`, detailResponse)
      } catch (error) {
        console.warn('[transformNeteaseResponse] 批量获取详情失败，将使用搜索结果的基本信息:', error)
      }
    }

    // 创建详情映射，方便查找
    const detailMap = new Map()
    if (detailResponse?.songs) {
      detailResponse.songs.forEach((song: any) => {
        detailMap.set(song.id, song)
      })
    }

    // 转换搜索结果，优先使用详情数据
    return songs.map((song: any, index: number) => {
      try {
        const detail = detailMap.get(song.id)
        
        // 优先使用详情中的封面，其次使用搜索结果中的封面
        let cover = detail?.al?.picUrl || 
                   (song.album?.picId ? `https://p1.music.126.net/${song.album.picId}/${song.album.picId}.jpg` : null)
        
        const transformedSong = {
          id: song.id,
          title: song.name,
          artist: song.artists?.map((artist: any) => artist.name).join(', ') || '未知艺术家',
          cover,
          album: song.album?.name,
          duration: song.duration,
          musicPlatform: 'netease',
          musicId: song.id.toString(),
          sourceInfo: {
            source: 'netease-backup',
            originalId: song.id.toString(),
            fetchedAt: new Date(),
            hasDetail: !!detail // 标记是否获取到了详情
          }
        }
        console.log(`[transformNeteaseResponse] 转换歌曲 ${index + 1}:`, transformedSong)
        return transformedSong
      } catch (error: any) {
        console.error(`[transformNeteaseResponse] 转换第 ${index + 1} 首歌曲失败:`, error.message, song)
        throw new Error(`转换第 ${index + 1} 首歌曲失败: ${error.message}`)
      }
    })
  }

  /**
   * 转换网易云 API 详情响应
   */
  const transformNeteaseDetailResponse = (response: any): any[] => {
    return response.songs.map((song: any) => ({
      id: song.id,
      title: song.name,
      artist: song.ar?.map((artist: any) => artist.name).join(', ') || '未知艺术家',
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

    config.value.sources.forEach(source => {
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
    updateSourceStatus
  }
}