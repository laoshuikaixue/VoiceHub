import { defineEventHandler, getQuery, createError } from 'h3'

interface VideoPage {
  cid: number;
  page: number;
  part: string;
  duration: number;
}

interface VideoInfoRes {
  code: number;
  message: string;
  data: {
    pages: VideoPage[];
  };
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const bvid = query.bvid as string

  if (!bvid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'bvid is required'
    })
  }

  try {
    const videoInfoResp = await $fetch<VideoInfoRes>(`https://api.bilibili.com/x/web-interface/view`, {
      method: "GET",
      params: {
        bvid,
      },
      headers: {
        Cookie: "buvid3=0",
        Referer: "https://www.bilibili.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
    });

    return videoInfoResp.data?.pages || [];
  } catch (error: any) {
    console.error(`Failed to fetch video info for ${bvid}:`, error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Bilibili video info fetch failed'
    })
  }
})
