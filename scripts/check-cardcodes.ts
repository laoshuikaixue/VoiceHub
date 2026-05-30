import { client } from '../app/drizzle/db'

;(async () => {
  try {
    const rows = await client`select id, title, card_code_id from songs where card_code_id is not null limit 50`
    console.log('found', rows.length)
    console.log(JSON.stringify(rows, null, 2))
  } catch (e) {
    console.error('query error', e)
    process.exit(1)
  } finally {
    try { await client.end() } catch {}
  }
})()
