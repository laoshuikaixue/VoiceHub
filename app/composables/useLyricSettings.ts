export const useLyricSettings = () => {
  const lyricFontSize = useState('lyric-font-size', () => 44)
  const lyricTranFontSize = useState('lyric-tran-font-size', () => 22)
  const lyricRomaFontSize = useState('lyric-roma-font-size', () => 18)
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
    localLyricQQMusicMatch,
    localLyricPath,
    preferTraditionalChinese,
    traditionalChineseVariant,
    showYrc,
    lyricHorizontalOffset,
    fullscreenPlayerElements,
    lyricOffsetStep
  }
}
