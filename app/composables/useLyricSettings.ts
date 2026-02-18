export const useLyricSettings = () => {
  // 根据设备类型设置默认字体大小
  const getDefaultFontSize = () => {
    if (typeof window === 'undefined') return 44
    return window.innerWidth <= 1024 ? 30 : 44
  }
  
  const getDefaultTranFontSize = () => {
    if (typeof window === 'undefined') return 22
    return window.innerWidth <= 1024 ? 18 : 22
  }
  
  const getDefaultRomaFontSize = () => {
    if (typeof window === 'undefined') return 18
    return window.innerWidth <= 1024 ? 14 : 18
  }
  
  const lyricFontSize = useState('lyric-font-size', getDefaultFontSize)
  const lyricTranFontSize = useState('lyric-tran-font-size', getDefaultTranFontSize)
  const lyricRomaFontSize = useState('lyric-roma-font-size', getDefaultRomaFontSize)
  const lyricFontSizeMode = useState('lyric-font-size-mode', () => 'auto') // auto | custom
  const useAMLyrics = useState('lyric-use-am-style', () => true)
  const useAMSpring = useState('lyric-use-spring', () => true)
  const lyricAlignRight = useState('lyric-align-right', () => false)
  const showTranslation = useState('lyric-show-translation', () => true)
  const showRoma = useState('lyric-show-roma', () => true)
  const showWordsRoma = useState('lyric-show-words-roma', () => true) // 逐字罗马音
  const swapTranRoma = useState('lyric-swap-tran-roma', () => false)
  const lyricOffset = useState('lyric-offset', () => 0)
  
  // 括号替换设置
  const replaceLyricBrackets = useState('lyric-replace-brackets', () => true)
  const bracketReplacementPreset = useState('lyric-bracket-preset', () => 'dash')
  const customBracketReplacement = useState('lyric-custom-bracket', () => '-')

  // 歌词模糊与缩放
  const lyricsBlur = useState('lyric-blur', () => true)
  const lyricsScrollOffset = useState('lyric-scroll-offset', () => 0.5)
  const hidePassedLines = useState('lyric-hide-passed', () => false)
  const wordFadeWidth = useState('lyric-word-fade-width', () => 0.5)
  const countDownShow = useState('lyric-countdown-show', () => true)
  
  // 歌词字体
  const lyricFontWeight = useState('lyric-font-weight', () => 'bold')
  const LyricFont = useState('lyric-font-family', () => 'follow') // 'follow' 跟随系统
  
  // 歌词排除规则
  const enableExcludeLyrics = useState('lyric-exclude-enable', () => false)
  const excludeLyricsUserKeywords = useState<string[]>('lyric-exclude-keywords', () => [])
  const excludeLyricsUserRegexes = useState<string[]>('lyric-exclude-regexes', () => [])
  const enableExcludeLyricsTTML = useState('lyric-exclude-ttml', () => false)
  const enableExcludeLyricsLocal = useState('lyric-exclude-local', () => false)

  // 优先级
  const lyricPriority = useState<'qm' | 'official' | 'ttml' | 'auto'>('lyric-priority', () => 'auto')
  const enableQQMusicLyric = useState('lyric-enable-qm', () => true)
  const enableOnlineTTMLLyric = useState('lyric-enable-ttml', () => true)
  // AMLL TTML DB Server 配置
  const amllDbServer = useState('lyric-amll-db-server', () => 'https://amlldb.bikonoo.com/ncm-lyrics/%s.ttml')
  const localLyricQQMusicMatch = useState('lyric-local-qm-match', () => true)
  const localLyricPath = useState<string[]>('lyric-local-path', () => [])
  
  // 繁简转换
  const preferTraditionalChinese = useState('lyric-prefer-traditional', () => false)
  const traditionalChineseVariant = useState('lyric-traditional-variant', () => 'hk')

  // 显示 YRC
  const showYrc = useState('lyric-show-yrc', () => true)
  const lyricHorizontalOffset = useState('lyric-horizontal-offset', () => 0)

  // 全屏播放器元素开关
  const fullscreenPlayerElements = useState('fullscreen-elements', () => ({
    copyLyric: true,
    lyricOffset: true,
    lyricSettings: true
  }))
  
  const lyricOffsetStep = useState('lyric-offset-step', () => 100)

  // 根据屏幕尺寸调整字体大小
  const adjustFontSizeForDevice = () => {
    if (typeof window === 'undefined') return
    
    const isMobile = window.innerWidth <= 1024
    
    // 只在 auto 模式下自动调整
    if (lyricFontSizeMode.value === 'auto') {
      lyricFontSize.value = isMobile ? 30 : 44
      lyricTranFontSize.value = isMobile ? 18 : 22
      lyricRomaFontSize.value = isMobile ? 14 : 18
    }
  }

  return {
    lyricFontSize,
    lyricTranFontSize,
    lyricRomaFontSize,
    lyricFontSizeMode,
    useAMLyrics,
    useAMSpring,
    lyricAlignRight,
    showTranslation,
    showRoma,
    showWordsRoma,
    swapTranRoma,
    lyricOffset,
    replaceLyricBrackets,
    bracketReplacementPreset,
    customBracketReplacement,
    lyricsBlur,
    lyricsScrollOffset,
    hidePassedLines,
    wordFadeWidth,
    countDownShow,
    lyricFontWeight,
    LyricFont,
    enableExcludeLyrics,
    excludeLyricsUserKeywords,
    excludeLyricsUserRegexes,
    enableExcludeLyricsTTML,
    enableExcludeLyricsLocal,
    lyricPriority,
    enableQQMusicLyric,
    enableOnlineTTMLLyric,
    amllDbServer,
    localLyricQQMusicMatch,
    localLyricPath,
    preferTraditionalChinese,
    traditionalChineseVariant,
    showYrc,
    lyricHorizontalOffset,
    fullscreenPlayerElements,
    lyricOffsetStep,
    adjustFontSizeForDevice
  }
}
