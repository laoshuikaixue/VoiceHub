import postgres from 'postgres'
import { config } from 'dotenv'
import path from 'path'

config({ path: path.resolve(process.cwd(), '.env') })

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL not set')
  process.exit(2)
}

console.log('Testing DATABASE_URL:', url)

const sql = postgres(url, { max: 2, connect_timeout: 10 })

async function main() {
  try {
    const res = await sql`SELECT 1 as v`
    console.log('Query result:', res)
    await sql.end()
    process.exit(0)
  } catch (err) {
    console.error('Connection failed:', err)
    try { await sql.end() } catch (e) {}
    process.exit(1)
  }
}

main()
