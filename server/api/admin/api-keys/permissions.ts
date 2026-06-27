import { z } from 'zod'

export const apiPermissionSchema = z.enum([
  'schedules:read',
  'songs:read',
  'songs:request',
  'songs:write',
  'card-codes:read',
  'card-codes:write',
  'card-codes:delete'
])
