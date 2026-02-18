export interface ParsedBilibiliId {
  bvid: string
  cid?: string
}

export function parseBilibiliId(id: string | number): ParsedBilibiliId {
  const idStr = String(id)
  
  if (idStr.includes(':')) {
    const parts = idStr.split(':')
    return {
      bvid: parts[0],
      cid: parts[1]
    }
  }
  
  return {
    bvid: idStr
  }
}

export async function getBilibiliTrackUrl(id: string, cid?: string) {
  try {
    const params: any = { id }
    if (cid) {
      params.cid = cid
    }
    const data = await $fetch('/api/bilibili/playurl', {
      params
    });
    return data;
  } catch (error) {
    console.error("Bilibili track url error:", error);
    throw error;
  }
}

export async function searchBilibili(keyword: string) {
  try {
    const data = await $fetch<any[]>('/api/bilibili/search', {
      params: { keyword }
    });
    return data || [];
  } catch (error) {
    console.error("Bilibili search error:", error);
    return [];
  }
}
