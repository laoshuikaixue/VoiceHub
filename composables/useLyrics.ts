import {computed, ref} from 'vue'

// 歌词行接口
export interface LyricLine {
    time: number // 时间戳（毫秒）
    content: string // 歌词内容
    words?: Array<{ // 逐字歌词（可选）
        time: number
        duration: number
        content: string
    }>
}

// 歌词数据接口
export interface LyricData {
    lrc: string // 普通歌词
    trans?: string // 翻译歌词
    yrc?: string // 逐字歌词
}

export const useLyrics = () => {
    // 响应式状态
    const currentLyrics = ref<LyricLine[]>([])
    const translationLyrics = ref<LyricLine[]>([])
    const wordByWordLyrics = ref<LyricLine[]>([])
    const currentLyricIndex = ref(0)
    const currentTime = ref(0)
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    // 歌词显示设置
    const showTranslation = ref(false)
    const showWordByWord = ref(false)

    // 解析LRC格式歌词
    const parseLrcLyrics = (lrcText: string): LyricLine[] => {
        if (!lrcText) return []

        const lines = lrcText.split('\n')
        const lyrics: LyricLine[] = []

        for (const line of lines) {
            // 匹配时间标签 [mm:ss.xx] 或 [mm:ss:xx]
            const timeMatch = line.match(/\[(\d{2}):(\d{2})[.:](\d{2,3})\](.*)/)
            if (timeMatch) {
                const minutes = parseInt(timeMatch[1])
                const seconds = parseInt(timeMatch[2])
                const milliseconds = parseInt(timeMatch[3].padEnd(3, '0'))
                const content = timeMatch[4].trim()

                const time = minutes * 60 * 1000 + seconds * 1000 + milliseconds

                if (content) { // 只添加有内容的歌词行
                    lyrics.push({time, content})
                }
            }
        }

        return lyrics.sort((a, b) => a.time - b.time)
    }

    // 解析网易云逐字歌词
    const parseYrcLyrics = (yrcText: string): LyricLine[] => {
        if (!yrcText) return []

        const lines = yrcText.split('\n')
        const lyrics: LyricLine[] = []

        for (const line of lines) {
            try {
                // 网易云逐字歌词格式：{"t":12420,"c":[{"tx":"ya ","t":290},{"tx":"la ","t":380}]}
                if (line.startsWith('{')) {
                    const data = JSON.parse(line)
                    if (data.t !== undefined && data.c && Array.isArray(data.c)) {
                        const words = data.c.map((word: any, index: number) => ({
                            time: data.t + (index > 0 ? data.c.slice(0, index).reduce((sum: number, w: any) => sum + (w.t || 0), 0) : 0),
                            duration: word.t || 0,
                            content: word.tx || ''
                        }))

                        const content = data.c.map((word: any) => word.tx || '').join('')
                        if (content.trim()) {
                            lyrics.push({
                                time: data.t,
                                content: content.trim(),
                                words
                            })
                        }
                    }
                }
                // 也支持标准LRC格式的逐字歌词
                else if (line.includes('[')) {
                    // QQ音乐逐字歌词格式：[12420,3470](12420,290,0)ya (12710,380,0)la
                    // 或新格式：[0,4690]嘘(0,293)つ(293,293)き(586,293)は(879,293)恋(1172,293)
                    const timeMatch = line.match(/\[(\d+),(\d+)\](.*)/)
                    if (timeMatch) {
                        const startTime = parseInt(timeMatch[1])
                        const duration = parseInt(timeMatch[2])
                        const wordsText = timeMatch[3]

                        const words: Array<{ time: number; duration: number; content: string }> = []

                        // 尝试匹配新格式：歌词(时间,持续时间)
                        const newFormatMatches = wordsText.matchAll(/([^(]+)\((\d+),(\d+)\)/g)
                        if (newFormatMatches) {
                            for (const wordMatch of newFormatMatches) {
                                const content = wordMatch[1].trim()
                                const time = parseInt(wordMatch[2])
                                const wordDuration = parseInt(wordMatch[3])

                                if (content) {
                                    words.push({
                                        time: time,
                                        duration: wordDuration,
                                        content: content
                                    })
                                }
                            }
                        }

                        // 如果新格式没有匹配到，尝试旧格式：(时间,持续时间,0)歌词
                        if (words.length === 0) {
                            const oldFormatMatches = wordsText.matchAll(/\((\d+),(\d+),\d+\)([^(]*)/g)
                            for (const wordMatch of oldFormatMatches) {
                                words.push({
                                    time: parseInt(wordMatch[1]),
                                    duration: parseInt(wordMatch[2]),
                                    content: wordMatch[3].trim()
                                })
                            }
                        }

                        const content = words.map(w => w.content).join('')
                        if (content.trim()) {
                            lyrics.push({
                                time: startTime,
                                content: content.trim(),
                                words
                            })
                        }
                    }
                }
            } catch (e) {
                console.warn('解析逐字歌词行失败:', line, e)
            }
        }

        return lyrics.sort((a, b) => a.time - b.time)
    }

    // 从网易云备用源获取歌词
    const fetchLyricsFromNetease = async (musicId: string): Promise<LyricData | null> => {
        try {
            // 获取网易云备用源配置
            const {getEnabledSources} = await import('../utils/musicSources')
            const enabledSources = getEnabledSources()
            const neteaseSource = enabledSources.find(source => source.id.includes('netease-backup'))

            if (!neteaseSource) {
                console.error('[fetchLyricsFromNetease] 未找到网易云备用源')
                return null
            }

            console.log(`[fetchLyricsFromNetease] 开始获取歌词，歌曲ID: ${musicId}`)

            // 同时请求普通歌词和逐字歌词
            const [lrcResponse, yrcResponse] = await Promise.allSettled([
                // 普通歌词接口 /lyric
                fetch(`${neteaseSource.baseUrl}/lyric?id=${musicId}`, {
                    timeout: neteaseSource.timeout || 8000,
                    headers: neteaseSource.headers || {}
                }),
                // 逐字歌词接口 /lyric/new
                fetch(`${neteaseSource.baseUrl}/lyric/new?id=${musicId}`, {
                    timeout: neteaseSource.timeout || 8000,
                    headers: neteaseSource.headers || {}
                })
            ])

            let lrcData: any = null
            let yrcData: any = null

            // 处理普通歌词响应
            if (lrcResponse.status === 'fulfilled' && lrcResponse.value.ok) {
                try {
                    lrcData = await lrcResponse.value.json()
                    console.log('[fetchLyricsFromNetease] 普通歌词获取成功')
                } catch (error) {
                    console.warn('[fetchLyricsFromNetease] 普通歌词解析失败:', error)
                }
            } else {
                console.warn('[fetchLyricsFromNetease] 普通歌词请求失败')
            }

            // 处理逐字歌词响应
            if (yrcResponse.status === 'fulfilled' && yrcResponse.value.ok) {
                try {
                    yrcData = await yrcResponse.value.json()
                    console.log('[fetchLyricsFromNetease] 逐字歌词获取成功')
                } catch (error) {
                    console.warn('[fetchLyricsFromNetease] 逐字歌词解析失败:', error)
                }
            } else {
                console.warn('[fetchLyricsFromNetease] 逐字歌词请求失败')
            }

            // 构建歌词数据
            const lyricData: LyricData = {
                lrc: '',
                trans: '',
                yrc: ''
            }

            // 处理普通歌词数据
            if (lrcData && lrcData.code === 200) {
                if (lrcData.lrc && lrcData.lrc.lyric) {
                    lyricData.lrc = lrcData.lrc.lyric
                }
                if (lrcData.tlyric && lrcData.tlyric.lyric) {
                    lyricData.trans = lrcData.tlyric.lyric
                }
            }

            // 处理逐字歌词数据
            if (yrcData && yrcData.code === 200 && yrcData.yrc && yrcData.yrc.lyric) {
                lyricData.yrc = yrcData.yrc.lyric
            }

            // 检查是否获取到任何歌词
            if (!lyricData.lrc && !lyricData.yrc) {
                console.warn('[fetchLyricsFromNetease] 未获取到任何歌词数据')
                return null
            }

            console.log('[fetchLyricsFromNetease] 歌词获取完成')
            return lyricData

        } catch (error) {
            console.error('[fetchLyricsFromNetease] 获取歌词失败:', error)
            return null
        }
    }

    // 解析网易云新格式逐字歌词
    const parseNeteaseYrcLyrics = (yrcText: string): LyricLine[] => {
        if (!yrcText) return []

        const lines = yrcText.split('\n')
        const lyrics: LyricLine[] = []

        for (const line of lines) {
            try {
                // 跳过JSON元数据行
                if (line.startsWith('{"t":') && line.includes('"c":[')) {
                    // 这是JSON元数据，暂时跳过
                    continue
                }

                // 解析逐字歌词行格式：[16210,3460](16210,670,0)还(16880,410,0)没...
                const timeMatch = line.match(/^\[(\d+),(\d+)\](.*)$/)
                if (timeMatch) {
                    const startTime = parseInt(timeMatch[1]) // 歌词行显示开始时间戳 (毫秒)
                    const duration = parseInt(timeMatch[2]) // 歌词行显示总时长(毫秒)
                    const wordsText = timeMatch[3]

                    const words: Array<{ time: number; duration: number; content: string }> = []
                    let content = ''

                    // 解析逐字信息：(时间戳,时长,0)文字
                    const wordMatches = wordsText.matchAll(/\((\d+),(\d+),\d+\)([^(]*)/g)
                    for (const wordMatch of wordMatches) {
                        const wordTime = parseInt(wordMatch[1]) // 逐字显示开始时间戳 (毫秒)
                        const wordDuration = parseInt(wordMatch[2]) * 10 // 逐字显示时长 (厘秒转毫秒)
                        const wordContent = wordMatch[3]

                        if (wordContent) {
                            words.push({
                                time: wordTime,
                                duration: wordDuration,
                                content: wordContent
                            })
                            content += wordContent
                        }
                    }

                    if (content.trim()) {
                        lyrics.push({
                            time: startTime,
                            content: content.trim(),
                            words: words.length > 0 ? words : undefined
                        })
                    }
                }
            } catch (e) {
                console.warn('解析网易云逐字歌词行失败:', line, e)
            }
        }

        return lyrics.sort((a, b) => a.time - b.time)
    }

    // 获取歌词（优化策略：优先使用备用源，减少vkeys重试）
    const fetchLyrics = async (platform: string, musicId: string, maxRetries: number = 2): Promise<void> => {
        // 开始获取歌词

        if (!platform || !musicId) {
            console.error('fetchLyrics 参数错误:', {platform, musicId})
            error.value = '缺少必要参数'
            // 清空歌词，避免显示上一首歌的歌词
            currentLyrics.value = []
            translationLyrics.value = []
            wordByWordLyrics.value = []
            currentLyricIndex.value = 0
            // 通知鸿蒙侧清空歌词
            notifyHarmonyOSLyricsUpdate('')
            return
        }

        isLoading.value = true
        error.value = null

        // 先清空当前歌词，避免显示上一首歌的歌词
        currentLyrics.value = []
        translationLyrics.value = []
        wordByWordLyrics.value = []
        currentLyricIndex.value = 0
        // 立即通知鸿蒙侧清空歌词
        notifyHarmonyOSLyricsUpdate('')

        // 对于网易云平台，优先尝试备用源
        if (platform === 'netease') {
            console.log('网易云平台：优先尝试备用源获取歌词...')
            try {
                const backupLyricData = await fetchLyricsFromNetease(musicId)

                if (backupLyricData) {
                    console.log('网易云备用源获取歌词成功')

                    // 优先使用逐字歌词，其次是普通歌词
                    if (backupLyricData.yrc) {
                        // 使用新的网易云逐字歌词解析函数
                        wordByWordLyrics.value = parseNeteaseYrcLyrics(backupLyricData.yrc)
                        // 逐字歌词也作为普通歌词显示
                        currentLyrics.value = wordByWordLyrics.value
                        console.log('使用逐字歌词作为主歌词')
                    } else if (backupLyricData.lrc) {
                        currentLyrics.value = parseLrcLyrics(backupLyricData.lrc)
                        console.log('使用普通歌词')
                    } else {
                        currentLyrics.value = []
                    }

                    // 解析翻译歌词
                    if (backupLyricData.trans) {
                        translationLyrics.value = parseLrcLyrics(backupLyricData.trans)
                        showTranslation.value = true
                    } else {
                        translationLyrics.value = []
                        showTranslation.value = false
                    }

                    // 获取成功后立即通知鸿蒙侧更新歌词
                    const harmonyLyrics = getFormattedLyricsForHarmonyOS()
                    notifyHarmonyOSLyricsUpdate(harmonyLyrics)

                    // 备用源获取成功，清除错误状态
                    error.value = null
                    isLoading.value = false
                    return
                }
            } catch (backupError) {
                console.error('网易云备用源获取歌词失败:', backupError)
                // 继续尝试vkeys
            }
        }

        // 备用源失败或非网易云平台，尝试vkeys（减少重试次数）
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // 重试获取歌词

                let apiUrl: string

                if (platform === 'netease') {
                    apiUrl = `https://api.vkeys.cn/v2/music/netease/lyric?id=${musicId}`
                } else if (platform === 'tencent') {
                    apiUrl = `https://api.vkeys.cn/v2/music/tencent/lyric?id=${musicId}`
                } else {
                    throw new Error('不支持的音乐平台')
                }

                // 请求歌词API

                const response = await fetch(apiUrl, {
                    timeout: 8000, // 减少超时时间到8秒
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                })
                // 检查响应状态

                if (!response.ok) {
                    throw new Error(`获取歌词失败: ${response.status} ${response.statusText}`)
                }

                const data = await response.json()
                // 处理响应数据

                if (data.code !== 200) {
                    throw new Error(data.message || '获取歌词失败')
                }

                // 解析歌词
                const lyricData = data.data

                // 优先使用逐字歌词，其次是普通歌词
                if (lyricData.yrc) {
                    wordByWordLyrics.value = parseYrcLyrics(lyricData.yrc)
                    // 逐字歌词也作为普通歌词显示
                    currentLyrics.value = wordByWordLyrics.value
                    console.log('vkeys: 使用逐字歌词作为主歌词')
                } else if (lyricData.lrc) {
                    currentLyrics.value = parseLrcLyrics(lyricData.lrc)
                    console.log('vkeys: 使用普通歌词')
                } else {
                    currentLyrics.value = []
                }

                // 翻译歌词
                if (lyricData.trans) {
                    translationLyrics.value = parseLrcLyrics(lyricData.trans)
                    // 如果有翻译歌词，自动启用翻译显示
                    showTranslation.value = true
                } else {
                    // 没有翻译歌词，关闭翻译显示
                    translationLyrics.value = []
                    showTranslation.value = false
                }

                // 不处理罗马音歌词（roma字段），按需求忽略

                // 获取成功后立即通知鸿蒙侧更新歌词
                const harmonyLyrics = getFormattedLyricsForHarmonyOS()
                notifyHarmonyOSLyricsUpdate(harmonyLyrics)

                // 成功获取歌词，退出重试循环
                isLoading.value = false
                return

            } catch (err) {
                lastError = err instanceof Error ? err : new Error('获取歌词失败')
                console.error(`fetchLyrics vkeys第${attempt}次尝试失败:`, lastError.message)

                // 如果不是最后一次尝试，等待一段时间后重试
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * attempt, 3000) // 线性退避，最大3秒
                    console.log(`等待 ${delay}ms 后进行第${attempt + 1}次重试`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                }
            }
        }

        // 所有方法都失败了
        console.error('所有歌词获取方法都失败:', lastError?.message)
        error.value = lastError?.message || '获取歌词失败'

        // 清空歌词，确保不显示上一首歌的歌词
        currentLyrics.value = []
        translationLyrics.value = []
        wordByWordLyrics.value = []
        currentLyricIndex.value = 0

        // 通知鸿蒙侧清空歌词显示
        notifyHarmonyOSLyricsUpdate('')

        isLoading.value = false
    }

    // 通知鸿蒙侧歌词更新的辅助函数
    const notifyHarmonyOSLyricsUpdate = (lyrics: string) => {
        if (typeof window !== 'undefined' && window.HarmonyOS && window.HarmonyOS.postMessage) {
            try {
                const message = {
                    method: 'updateLyrics',
                    parameters: {
                        lyrics: lyrics
                    }
                }
                window.HarmonyOS.postMessage(JSON.stringify(message))
                // 通知鸿蒙侧更新歌词
            } catch (error) {
                console.error('通知鸿蒙侧更新歌词失败:', error)
            }
        } else {
            console.warn('鸿蒙侧消息接口不可用，无法更新歌词')
        }
    }

    // 根据当前时间更新歌词索引
    const updateCurrentLyricIndex = (time: number): void => {
        currentTime.value = time

        const lyrics = currentLyrics.value
        if (lyrics.length === 0) {
            // 没有歌词数据
            return
        }

        // 找到当前时间对应的歌词行
        for (let i = 0; i < lyrics.length; i++) {
            if (time >= lyrics[i].time &&
                (i === lyrics.length - 1 || time < lyrics[i + 1].time)) {
                if (currentLyricIndex.value !== i) {
                    // 歌词索引更新
                    currentLyricIndex.value = i
                }
                return
            }
        }

        // 未找到匹配的歌词行
    }

    // 获取当前歌词内容
    const currentLyricContent = computed(() => {
        const lyrics = currentLyrics.value
        if (lyrics.length === 0 || currentLyricIndex.value >= lyrics.length) {
            return ''
        }
        return lyrics[currentLyricIndex.value].content
    })

    // 获取当前翻译歌词
    const currentTranslationContent = computed(() => {
        if (!showTranslation.value || translationLyrics.value.length === 0) {
            return ''
        }

        const currentTime = currentLyrics.value[currentLyricIndex.value]?.time
        if (!currentTime) return ''

        // 找到对应时间的翻译歌词
        for (let i = 0; i < translationLyrics.value.length; i++) {
            if (currentTime >= translationLyrics.value[i].time &&
                (i === translationLyrics.value.length - 1 || currentTime < translationLyrics.value[i + 1].time)) {
                return translationLyrics.value[i].content
            }
        }
        return ''
    })

    // 获取格式化的LRC歌词文本
    const getFormattedLrcText = (): string => {
        if (currentLyrics.value.length === 0) {
            return '[00:00.00]暂无歌词'
        }

        return currentLyrics.value.map(line => {
            const minutes = Math.floor(line.time / 60000)
            const seconds = Math.floor((line.time % 60000) / 1000)
            const milliseconds = Math.floor((line.time % 1000) / 10)

            const timeStr = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}]`
            return `${timeStr}${line.content}`
        }).join('\r\n')
    }

    // 获取格式化的歌词用于鸿蒙侧，符合AVMetadata.lyric要求
    const getFormattedLyricsForHarmonyOS = (): string => {
        if (currentLyrics.value.length === 0) {
            return '[00:00.00]暂无歌词'
        }

        // 按照鸿蒙侧要求格式化歌词：[mm:ss.xx]歌词内容\r\n
        let formattedLyrics = currentLyrics.value.map(line => {
            const minutes = Math.floor(line.time / 60000)
            const seconds = Math.floor((line.time % 60000) / 1000)
            const milliseconds = Math.floor((line.time % 1000) / 10)

            // 格式：[mm:ss.xx]歌词内容
            const timeStr = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}]`
            return `${timeStr}${line.content}`
        }).join('\r\n')

        // 鸿蒙侧字符串长度限制：<40960字节
        const maxBytes = 40960
        const encoder = new TextEncoder()

        // 检查字符串长度是否超过限制
        if (encoder.encode(formattedLyrics).length > maxBytes) {
            console.warn('歌词长度超过鸿蒙侧限制，正在截断...')

            // 逐行添加歌词，直到接近字节限制
            let truncatedLyrics = ''
            for (const line of currentLyrics.value) {
                const minutes = Math.floor(line.time / 60000)
                const seconds = Math.floor((line.time % 60000) / 1000)
                const milliseconds = Math.floor((line.time % 1000) / 10)

                const timeStr = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}]`
                const lineText = `${timeStr}${line.content}\r\n`

                // 检查添加这一行后是否会超过限制
                const testLyrics = truncatedLyrics + lineText
                if (encoder.encode(testLyrics).length > maxBytes - 100) { // 留100字节缓冲
                    break
                }

                truncatedLyrics += lineText
            }

            formattedLyrics = truncatedLyrics.trim()
        }

        // 歌词格式化完成
        return formattedLyrics
    }

    // 清空歌词
    const clearLyrics = (): void => {
        currentLyrics.value = []
        translationLyrics.value = []
        wordByWordLyrics.value = []
        currentLyricIndex.value = 0
        currentTime.value = 0
        error.value = null
    }

    // 跳转到指定歌词行
    const seekToLyricLine = (index: number): number => {
        if (index >= 0 && index < currentLyrics.value.length) {
            return currentLyrics.value[index].time / 1000 // 返回秒数
        }
        return 0
    }

    return {
        // 状态
        currentLyrics: readonly(currentLyrics),
        translationLyrics: readonly(translationLyrics),
        wordByWordLyrics: readonly(wordByWordLyrics),
        currentLyricIndex: readonly(currentLyricIndex),
        currentTime: readonly(currentTime),
        isLoading: readonly(isLoading),
        error: readonly(error),

        // 设置
        showTranslation,
        showWordByWord,

        // 计算属性
        currentLyricContent,
        currentTranslationContent,

        // 方法
        fetchLyrics,
        updateCurrentLyricIndex,
        getFormattedLrcText,
        getFormattedLyricsForHarmonyOS, // 保持向后兼容
        notifyHarmonyOSLyricsUpdate, // 鸿蒙侧歌词更新通知
        clearLyrics,
        seekToLyricLine,
        parseLrcLyrics,
        parseYrcLyrics
    }
}