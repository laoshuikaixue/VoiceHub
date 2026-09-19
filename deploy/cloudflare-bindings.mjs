import { env } from 'cloudflare:workers'

export const getHyperdriveConnectionString = () =>
  env.HYPERDRIVE && typeof env.HYPERDRIVE.connectionString === 'string'
    ? env.HYPERDRIVE.connectionString
    : undefined
