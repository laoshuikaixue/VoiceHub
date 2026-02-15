import type { LyricLine } from "@applemusic-like-lyrics/lyric";

/**
 * 格式化歌词
 * 主要处理括号替换、关键词过滤等
 * @param lines 歌词行
 * @param settings 歌词设置对象 (从 useLyricSettings 获取)
 */
export const formatLyric = (lines: LyricLine[], settings: any): LyricLine[] => {
  const {
    replaceLyricBrackets,
    bracketReplacementPreset,
    customBracketReplacement,
    enableExcludeLyrics,
    excludeLyricsUserKeywords,
    excludeLyricsUserRegexes,
  } = settings;

  if (!lines || lines.length === 0) return [];

  return lines
    .filter((line) => {
      // 0. 基础过滤：去除空行和版权声明
      const text = line.words.map((w) => w.word).join("");
      const transText = line.translatedLyric || "";

      // 如果主歌词为空
      if (!text.trim()) {
        // 如果翻译也是空的，或者翻译是版权声明，则过滤掉
        if (!transText.trim() || transText.includes("著作权") || transText.includes("QQ音乐")) {
          return false;
        }
      }

      // 如果主歌词包含版权声明
      if (text.includes("著作权") || text.includes("QQ音乐") || text.includes("作词") || text.includes("作曲")) {
         // 视情况过滤，通常歌词开头的作词作曲可以保留，但版权声明最好去掉
         if (text.includes("著作权") || text.includes("QQ音乐")) return false;
      }

      // 如果翻译包含版权声明，清空翻译
      if (transText.includes("著作权") || transText.includes("QQ音乐") || transText.trim() === "//") {
        line.translatedLyric = "";
      }

      // 1. 排除规则 (用户自定义)
      if (enableExcludeLyrics && enableExcludeLyrics.value) {
        const text = line.words.map((w) => w.word).join("");
        
        // 关键字匹配
        if (excludeLyricsUserKeywords.value.length > 0) {
           if (excludeLyricsUserKeywords.value.some((k) => text.includes(k))) return false;
        }
        
        // 正则匹配
        if (excludeLyricsUserRegexes.value.length > 0) {
           if (excludeLyricsUserRegexes.value.some((r) => new RegExp(r).test(text))) return false;
        }
      }
      return true;
    })
    .map((line) => {
      // 2. 括号替换
      if (replaceLyricBrackets.value) {
        let replacement = "-";
        if (bracketReplacementPreset.value === "space") replacement = " ";
        else if (bracketReplacementPreset.value === "custom") replacement = customBracketReplacement.value;
        
        // 对每个单词进行替换
        line.words.forEach((word) => {
          // 将括号内容替换为指定字符
          // 匹配中文括号（）和英文括号()
          word.word = word.word.replace(/[\(（].*?[\)）]/g, replacement);
        });
      }
      return line;
    });
};
