/**
 * 清洗歌词中的元数据标签
 */
export const stripLyricMetadata = (lrc: string): string => {
  if (!lrc) return "";
  // 移除 [ti:xx], [ar:xx], [al:xx], [by:xx], [offset:xx]
  return lrc.replace(/^\[(ti|ar|al|by|offset|length):.*\]$/gmi, "").trim();
};
