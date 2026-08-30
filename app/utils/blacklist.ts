/**
 * 歌曲类型黑名单前端共享模块（单一来源）
 * 存储值使用规范中文标签，与服务端匹配口径一致
 * 新增候选值需同步：本文件 + server/config/constants.ts 的 BLACKLIST_LANGUAGE_VALUES / BLACKLIST_GENRE_VALUES
 */

export const BLACKLIST_LANGUAGE_VALUES = ['华语', '粤语', '闽南语', '英语', '日语', '韩语', '其他'] as const

export const BLACKLIST_GENRE_VALUES = [
  '流行', '摇滚', '民谣', '电子', '舞曲', '说唱', '古典', '爵士',
  '乡村', '原声带', '蓝调', '轻音乐', '其他'
] as const

// 英文界面显示名（键为存储值；中文界面直接显示存储值）
export const BLACKLIST_LANGUAGE_LABEL_EN: Record<string, string> = {
  华语: 'Mandarin',
  粤语: 'Cantonese',
  闽南语: 'Hokkien',
  英语: 'English',
  日语: 'Japanese',
  韩语: 'Korean',
  其他: 'Other'
}

export const BLACKLIST_GENRE_LABEL_EN: Record<string, string> = {
  流行: 'Pop',
  摇滚: 'Rock',
  民谣: 'Folk',
  电子: 'Electronic',
  舞曲: 'Dance',
  说唱: 'Rap',
  古典: 'Classical',
  爵士: 'Jazz',
  乡村: 'Country',
  原声带: 'Soundtrack',
  蓝调: 'Blues',
  轻音乐: 'Easy Listening',
  其他: 'Other'
}
