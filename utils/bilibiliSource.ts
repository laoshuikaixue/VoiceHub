
export async function getBilibiliTrackUrl(id: string) {
  try {
    const data = await $fetch('/api/bilibili/playurl', {
      params: { id }
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
