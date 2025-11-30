import { defineEventHandler, getQuery, createError } from 'h3'

interface SongInfo {
  id: number;
  bvid: string;
  title: string;
  author: string;
  pic: string;
  duration: string;
}

interface SearchRes {
  code: number;
  message: string;
  data: {
    result: [{
      id: number;
      bvid: string;
      title: string;
      author: string;
      pic: string;
      duration: string;
    }];
  };
}

function htmlDecode(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

function bi_convert_song(song_info: SongInfo) {
  let imgUrl = song_info.pic;
  const durationStr = song_info.duration.split(":").map(x => Number.parseInt(x)).reverse();
  let duration = durationStr[0] + durationStr[1] * 60;
  if (durationStr.length === 3) {
    duration += durationStr[2] * 60 * 60;
  }
  if (imgUrl.startsWith("//")) {
    imgUrl = `https:${imgUrl}`;
  }
  const track = {
    id: song_info.bvid,
    title: htmlDecode(song_info.title),
    artist: htmlDecode(song_info.author),
    source: "bilibili",
    cover: imgUrl,
    duration,
    album: "Bilibili Video",
  };
  return track;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const keyword = query.keyword as string
  
  if (!keyword) {
    return []
  }

  const target_url = `https://api.bilibili.com/x/web-interface/search/type`;
  
  try {
    const resp = await $fetch<SearchRes>(target_url, {
      method: "GET",
      params: {
        __refresh__: true,
        page: 1,
        page_size: 15,
        platform: "pc",
        highlight: 1,
        single_column: 0,
        keyword,
        search_type: "video",
        dynamic_offset: 0,
        preload: true,
        com2co: true,
      },
      headers: {
        Cookie: "buvid3=0",
        Referer: "https://www.bilibili.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
    });

    if (!resp.data?.result) {
      return [];
    }

    return resp.data.result.map((song) => {
      return bi_convert_song(song);
    });
  } catch (error: any) {
    console.error('Bilibili search error:', error)
    throw createError({
        statusCode: 500,
        statusMessage: error.message || 'Bilibili search failed'
    })
  }
})
