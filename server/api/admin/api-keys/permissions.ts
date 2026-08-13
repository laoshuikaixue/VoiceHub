import { z } from 'zod'

export const apiPermissionSchema = z.enum([
  'schedules:read',
  'songs:read',
  'songs:request',
  'songs:write',
  'song-quotas:read',
  'song-quotas:adjust',
  'song-quota-transactions:read',
  'backup:execute'
])
