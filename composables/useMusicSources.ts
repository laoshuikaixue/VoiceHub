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
    const searchSongs = async (params: MusicSearchParams, signal?: AbortSignal): Promise<MusicSearchResult> => {
        // 检查请求是否已被取消
        if (signal?.aborted) {
            throw new DOMException('搜索请求已被取消', 'AbortError')
        }

        isSearching.value = true

        try {
            const enabledSources = getEnabledSources()

            if (enabledSources.length === 0) {
                throw new Error('没有可用的音源')
            }

            // 按优先级尝试每个音源
            for (const source of enabledSources) {
                // 在每次尝试前检查请求是否已被取消
                if (signal?.aborted) {
                    throw new DOMException('搜索请求已被取消', 'AbortError')
                }

                try {
                    console.log(`尝试使用音源: ${source.name}`)
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

                    // 如果不是最后一个音源，继续尝试下一个
                    if (source !== enabledSources[enabledSources.length - 1]) {

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
    const searchWithSource = async (source: MusicSource, params: MusicSearchParams, signal?: AbortSignal): Promise<any[]> => {
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
            // 网易云备用API - 优先使用cloudsearch接口
            url = `${source.baseUrl}/cloudsearch?keywords=${encodeURIComponent(params.keywords)}&limit=${params.limit || 30}&offset=${params.offset || 0}&type=${params.type || 1}`
            transformResponse = async (data: any) => await transformNeteaseResponse(data)
        }

        let response: any
        let finalUrl = url

        try {
            console.log(`[${source.name}] 请求URL:`, finalUrl)
            response = await $fetch(finalUrl, {
                timeout: source.timeout || config.value.timeout,
                signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...source.headers
                }
            })
            console.log(`[${source.name}] API响应:`, response)

            const responseTime = Date.now() - startTime
            updateSourceStatus(source.id, 'online', undefined, responseTime)

        } catch (error: any) {
            // 如果是网易云备用源且使用的是cloudsearch接口，尝试切换到search接口
            if (source.id !== 'vkeys' && finalUrl.includes('/cloudsearch')) {
                console.warn(`[${source.name}] cloudsearch接口失败，尝试使用search接口:`, error.message)

                const fallbackUrl = `${source.baseUrl}/search?keywords=${encodeURIComponent(params.keywords)}&limit=${params.limit || 30}&offset=${params.offset || 0}&type=${params.type || 1}`

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
                    updateSourceStatus(source.id, 'error', `cloudsearch和search接口均失败: ${error.message}, ${fallbackError.message}`, responseTime)
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
                    data: {songs: result},
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
                params: {ids: id},
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
                return 'standard'    // 标准 (128k)
            case 4:
                return 'higher'      // HQ极高 (320k)
            case 5:
                return 'lossless'    // SQ无损
            case 6:
                return 'hires'       // Hi-Res
            case 9:
                return 'jymaster'    // 超清母带
            default:
                return 'exhigh'     // 默认极高音质
        }
    }

    /**
     * 获取歌曲播放URL（网易云备用源）
     * 先使用 NeteaseCloudMusicApi，失败后回退到 vkeys
     */
    const getSongUrl = async (id: number | string, quality?: number): Promise<{
        success: boolean;
        url?: string;
        error?: string
    }> => {
        try {
            // 获取所有启用的音源
            const enabledSources = getEnabledSources()
            const neteaseSource = enabledSources.find(source => source.id.includes('netease-backup'))

            if (!neteaseSource) {
                console.error('[getSongUrl] 未找到网易云备用源')
                return {success: false, error: '未找到网易云备用源'}
            }

            // 计算网易云API的音质 level
            let level = 'exhigh'
            try {
                const {getQuality} = await import('./useAudioQuality')
                const neteaseQuality = getQuality('netease')
                level = mapQualityToLevel(neteaseQuality)
            } catch (error) {
                console.warn('[getSongUrl] 无法获取音质设置，使用默认音质')
            }

            // 支持多个ID的批量查询（用逗号分隔）
            const idParam = Array.isArray(id) ? id.join(',') : id.toString()

            console.log(`[getSongUrl] 优先使用 NeteaseCloudMusicApi 获取播放链接: id=${idParam}, level=${level}`)

            // 调用 /song/url/v1 接口获取播放链接
            const response = await $fetch(`${neteaseSource.baseUrl}/song/url/v1`, {
                params: {
                    id: idParam,
                    level: level,
                    unblock: false
                },
                timeout: neteaseSource.timeout || 8000
            })

            if (response?.code === 200 && Array.isArray(response.data) && response.data[0]?.url) {
                let url = response.data[0].url as string
                if (url.startsWith('http://')) url = url.replace('http://', 'https://')
                console.log(`[getSongUrl] 来自 NeteaseCloudMusicApi 的播放链接: ${url}`)
                return {success: true, url}
            }

            console.warn('[getSongUrl] NeteaseCloudMusicApi 未返回有效链接，回退到 vkeys')

            // 回退到 vkeys
            const vkeysSource = enabledSources.find(source => source.id === 'vkeys')
            if (vkeysSource) {
                const vkeysQuality = typeof quality === 'number' ? quality : 0
                const vkeysUrl = `${vkeysSource.baseUrl}/netease?id=${idParam}&quality=${vkeysQuality}`
                const vkeysResp = await $fetch(vkeysUrl, {timeout: vkeysSource.timeout || 8000})

                if (vkeysResp?.code === 200 && vkeysResp?.data?.url) {
                    let url = String(vkeysResp.data.url)
                    if (url.startsWith('http://')) url = url.replace('http://', 'https://')
                    console.log(`[getSongUrl] 来自 vkeys 的播放链接: ${url}`)
                    return {success: true, url}
                }
            }

            return {success: false, error: '无法获取播放链接'}
        } catch (error: any) {
            console.error('[getSongUrl] 获取播放链接失败:', error)
            return {success: false, error: error?.message || '未知错误'}
        }
    }

    /**
     * 获取歌词（统一调度）
     * NeteaseCloudMusicApi 优先，其次 vkeys；腾讯仅 vkeys
     */
    const getLyrics = async (platform: 'netease' | 'tencent', id: number | string): Promise<{
        success: boolean;
        data?: { lrc: string; trans?: string; yrc?: string };
        error?: string
    }> => {
        try {
            const enabledSources = getEnabledSources()
            const neteaseSource = enabledSources.find(source => source.id.includes('netease-backup'))
            const vkeysSource = enabledSources.find(source => source.id === 'vkeys')

            if (platform === 'netease' && neteaseSource) {
                try {
                    const [lrcResp, yrcResp] = await Promise.allSettled([
                        $fetch(`${neteaseSource.baseUrl}/lyric`, { params: { id: id.toString() }, timeout: neteaseSource.timeout || 8000 }),
                        $fetch(`${neteaseSource.baseUrl}/lyric/new`, { params: { id: id.toString() }, timeout: neteaseSource.timeout || 8000 })
                    ])

                    const data: { lrc: string; trans?: string; yrc?: string } = { lrc: '', trans: '', yrc: '' }

                    if (lrcResp.status === 'fulfilled' && lrcResp.value?.code === 200) {
                        const lr = lrcResp.value
                        if (lr?.lrc?.lyric) data.lrc = lr.lrc.lyric
                        if (lr?.tlyric?.lyric) data.trans = lr.tlyric.lyric
                    }
                    if (yrcResp.status === 'fulfilled' && yrcResp.value?.code === 200) {
                        const yr = yrcResp.value
                        if (yr?.yrc?.lyric) data.yrc = yr.yrc.lyric
                    }

                    if (data.lrc || data.yrc) {
                        return { success: true, data }
                    }
                } catch (e: any) {
                    console.warn('[getLyrics] NeteaseCloudMusicApi 获取失败:', e?.message || e)
                }
            }

            // 回退到 vkeys
            if (vkeysSource) {
                let url: string
                if (platform === 'netease') {
                    url = `${vkeysSource.baseUrl}/netease/lyric?id=${id}`
                } else if (platform === 'tencent') {
                    url = `${vkeysSource.baseUrl}/tencent/lyric?id=${id}`
                } else {
                    throw new Error('不支持的音乐平台')
                }

                const resp = await $fetch(url, { timeout: vkeysSource.timeout || 8000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } })
                if (resp?.code === 200 && resp?.data) {
                    const d = resp.data
                    const data: { lrc: string; trans?: string; yrc?: string } = {
                        lrc: d.lrc || '',
                        trans: d.trans || '',
                        yrc: d.yrc || ''
                    }
                    if (data.lrc || data.yrc) {
                        return { success: true, data }
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
        console.log('[transformVkeysResponse] 开始转换数据:', {platform, response})

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

        // 检查是否是cloudsearch接口的响应（包含完整信息）
        const hasCompleteInfo = songs.some(song => song.al?.picUrl)
        console.log(`[transformNeteaseResponse] 检测到${hasCompleteInfo ? 'cloudsearch' : 'search'}接口响应`)

        let detailResponse: any = null
        let detailMap = new Map()

        // 如果是search接口响应（缺少完整信息），则需要获取详情
        if (!hasCompleteInfo) {
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

            if (songIds.length > 0) {
                try {
                    // 批量获取歌曲详情，包含封面信息
                    detailResponse = await $fetch(`${neteaseSource.baseUrl}/song/detail`, {
                        params: {ids: songIds.join(',')},
                        timeout: neteaseSource.timeout || 8000
                    })
                    console.log(`[transformNeteaseResponse] 批量获取详情成功:`, detailResponse)
                } catch (error) {
                    console.warn('[transformNeteaseResponse] 批量获取详情失败，将使用搜索结果的基本信息:', error)
                }
            }

            // 创建详情映射，方便查找
            if (detailResponse?.songs) {
                detailResponse.songs.forEach((song: any) => {
                    detailMap.set(song.id, song)
                })
            }
        }

        // 转换搜索结果，根据接口类型使用不同的数据提取策略
        return songs.map((song: any, index: number) => {
            try {
                let cover: string | null = null
                let artist: string
                let album: string | undefined
                let duration: number

                if (hasCompleteInfo) {
                    // cloudsearch接口响应，包含完整信息
                    cover = song.al?.picUrl || null
                    artist = song.ar?.map((artist: any) => artist.name).join('/') || '未知艺术家'
                    album = song.al?.name
                    duration = song.dt
                } else {
                    // search接口响应，需要从详情中获取信息
                    const detail = detailMap.get(song.id)
                    cover = detail?.al?.picUrl ||
                        (song.album?.picId ? `https://p1.music.126.net/${song.album.picId}/${song.album.picId}.jpg` : null)
                    artist = song.artists?.map((artist: any) => artist.name).join('/') || '未知艺术家'
                    album = song.album?.name
                    duration = song.duration
                }

                const transformedSong = {
                    id: song.id,
                    title: song.name,
                    artist,
                    cover,
                    album,
                    duration,
                    musicPlatform: 'netease',
                    musicId: song.id.toString(),
                    sourceInfo: {
                        source: 'netease-backup',
                        originalId: song.id.toString(),
                        fetchedAt: new Date(),
                        hasDetail: hasCompleteInfo || !!detailMap.get(song.id), // 标记是否有完整信息
                        interface: hasCompleteInfo ? 'cloudsearch' : 'search' // 标记使用的接口类型
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
        getSongUrl,
        getLyrics,
        updateSourceStatus
    }
}