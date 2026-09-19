export interface DatabaseRuntimeOptions {
  isCloudflare: boolean
  databaseUrl: string
  hyperdriveUrl?: string
  isNeon: boolean
}

export function resolveDatabaseConnectionString(options: DatabaseRuntimeOptions): string {
  if (!options.isCloudflare) return options.databaseUrl
  if (options.hyperdriveUrl) return options.hyperdriveUrl
  throw new Error(
    'Cloudflare Workers requires a HYPERDRIVE binding. Configure it in Settings > Bindings > Hyperdrive.'
  )
}

export function resolveDatabasePoolConfig(options: DatabaseRuntimeOptions) {
  if (options.isCloudflare) {
    return {
      max: 1,
      idle_timeout: 0,
      connect_timeout: 5,
      max_lifetime: 60,
      fetch_types: false
    }
  }

  if (options.isNeon) {
    return {
      max: 1,
      idle_timeout: 0,
      connect_timeout: 10,
      max_lifetime: 3600
    }
  }

  return {
    max: process.env.VERCEL || process.env.NETLIFY ? 2 : process.env.NODE_ENV === 'production' ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: process.env.VERCEL || process.env.NETLIFY ? 10 : 30,
    max_lifetime: 3600
  }
}
