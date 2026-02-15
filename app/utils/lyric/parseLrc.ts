import type { LyricLine } from "@applemusic-like-lyrics/lyric";

const TIME_TAG_REGEX = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
const META_TAG_REGEX = /^\[[a-z]+:/i;

export const parseLrc = (lrcContent: string): LyricLine[] => {
  if (!lrcContent) return [];

  const lines = lrcContent.split(/\r?\n/);
  const result: LyricLine[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // 跳过元数据
    if (META_TAG_REGEX.test(trimmedLine)) continue;

    const matches = [...trimmedLine.matchAll(TIME_TAG_REGEX)];
    if (matches.length === 0) continue;

    // 提取歌词文本（移除所有时间标签）
    const text = trimmedLine.replace(TIME_TAG_REGEX, "").trim();
    // 允许空行（作为间奏），但通常我们忽略完全空的行，除非为了显示间隔
    if (!text) continue;

    // 处理一行多个时间标签的情况（重复歌词）
    for (const match of matches) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      // 补齐毫秒
      const msStr = match[3].padEnd(3, "0").slice(0, 3);
      const ms = parseInt(msStr, 10);
      const startTime = min * 60 * 1000 + sec * 1000 + ms;

      result.push({
        startTime,
        endTime: 0, // 稍后计算
        words: [{ word: text, startTime, endTime: 0, romanWord: "" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      });
    }
  }

  // 按时间排序
  result.sort((a, b) => a.startTime - b.startTime);

  // 计算结束时间
  for (let i = 0; i < result.length; i++) {
    const line = result[i];
    const nextLine = result[i + 1];

    if (nextLine) {
      line.endTime = nextLine.startTime;
    } else {
      line.endTime = line.startTime + 5000; // 最后一行默认 5秒
    }

    // 更新单词结束时间
    if (line.words.length > 0) {
      line.words[0].endTime = line.endTime;
    }
  }

  return result;
};
