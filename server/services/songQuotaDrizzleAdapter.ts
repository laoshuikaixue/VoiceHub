import { and, asc, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../app/drizzle/schema.ts'
import {
  songQuotaAccounts,
  songQuotaTransactions,
  songs,
  users
} from '../../app/drizzle/schema.ts'

type SongQuotaDatabase = Pick<PostgresJsDatabase<typeof schema>, 'execute' | 'insert' | 'select' | 'update'>
type TransactionDatabase = Pick<PostgresJsDatabase<typeof schema>, 'transaction'>

export function createSongQuotaDrizzleAdapter(dbOrTx: SongQuotaDatabase) {
  return {
    async ensureAccount(userId: number) {
      await dbOrTx
        .insert(songQuotaAccounts)
        .values({ userId })
        .onConflictDoNothing({ target: songQuotaAccounts.userId })
    },
    async lockIdempotencyKey(idempotencyKey: string) {
      await dbOrTx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))`)
    },
    async lockAccount(userId: number) {
      const rows = await dbOrTx
        .select()
        .from(songQuotaAccounts)
        .where(eq(songQuotaAccounts.userId, userId))
        .limit(1)
        .for('update')
      return rows[0] ?? null
    },
    async updateAccount(
      accountId: number,
      changes: Partial<typeof songQuotaAccounts.$inferInsert>,
      expected: Partial<
        Pick<
          typeof songQuotaAccounts.$inferSelect,
          'periodicBalance' | 'permanentBalance' | 'periodKey'
        >
      > = {}
    ) {
      const filters = [eq(songQuotaAccounts.id, accountId)]
      if (typeof expected.periodicBalance === 'number') {
        filters.push(eq(songQuotaAccounts.periodicBalance, expected.periodicBalance))
      }
      if (typeof expected.permanentBalance === 'number') {
        filters.push(eq(songQuotaAccounts.permanentBalance, expected.permanentBalance))
      }
      if (expected.periodKey === null) {
        filters.push(isNull(songQuotaAccounts.periodKey))
      } else if (typeof expected.periodKey === 'string') {
        filters.push(eq(songQuotaAccounts.periodKey, expected.periodKey))
      }
      const rows = await dbOrTx
        .update(songQuotaAccounts)
        .set(changes)
        .where(and(...filters))
        .returning()
      return rows[0] ?? null
    },
    async findTransactionByIdempotencyKey(idempotencyKey: string) {
      const rows = await dbOrTx
        .select()
        .from(songQuotaTransactions)
        .where(eq(songQuotaTransactions.idempotencyKey, idempotencyKey))
        .limit(1)
      return rows[0] ?? null
    },
    async insertTransaction(values: typeof songQuotaTransactions.$inferInsert) {
      const rows = await dbOrTx
        .insert(songQuotaTransactions)
        .values(values)
        .onConflictDoNothing({ target: songQuotaTransactions.idempotencyKey })
        .returning()
      if (rows[0]) return rows[0]
      if (typeof values.idempotencyKey !== 'string') {
        throw new Error('点歌额度流水创建失败')
      }
      const existing = await dbOrTx
        .select()
        .from(songQuotaTransactions)
        .where(eq(songQuotaTransactions.idempotencyKey, values.idempotencyKey))
        .limit(1)
      if (!existing[0]) throw new Error('点歌额度流水创建失败')
      return existing[0]
    },
    async attachTransactionToSong(transactionId: number, songId: number) {
      const rows = await dbOrTx
        .update(songQuotaTransactions)
        .set({ songId })
        .where(and(eq(songQuotaTransactions.id, transactionId), isNull(songQuotaTransactions.songId)))
        .returning()
      return rows[0] ?? null
    },
    async lockSong(songId: number) {
      const rows = await dbOrTx
        .select()
        .from(songs)
        .where(eq(songs.id, songId))
        .limit(1)
        .for('update')
      return rows[0] ?? null
    },
    async markSongReturned(songId: number, transactionId: number) {
      const rows = await dbOrTx
        .update(songs)
        .set({ quotaReturned: true, quotaReturnTransactionId: transactionId })
        .where(and(eq(songs.id, songId), eq(songs.quotaReturned, false)))
        .returning()
      return rows[0] ?? null
    },
    async listTransactions(input: Record<string, unknown>) {
      const filters = []
      if (typeof input.userId === 'number') {
        filters.push(eq(songQuotaAccounts.userId, input.userId))
      }
      if (typeof input.quotaType === 'string') {
        filters.push(eq(songQuotaTransactions.quotaType, input.quotaType as 'PERIODIC' | 'PERMANENT'))
      }
      if (typeof input.source === 'string') {
        filters.push(eq(songQuotaTransactions.source, input.source as typeof songQuotaTransactions.$inferSelect.source))
      }
      if (typeof input.administratorId === 'number') {
        filters.push(eq(songQuotaTransactions.administratorId, input.administratorId))
      }
      if (input.from instanceof Date) {
        filters.push(gte(songQuotaTransactions.createdAt, input.from))
      }
      if (input.to instanceof Date) {
        filters.push(lte(songQuotaTransactions.createdAt, input.to))
      }
      const where = filters.length > 0 ? and(...filters) : sql`true`
      const page = typeof input.page === 'number' ? input.page : 1
      const limit = typeof input.limit === 'number' ? input.limit : 20
      const offset = (page - 1) * limit
      const [items, totals] = await Promise.all([
        dbOrTx
          .select({
            transaction: songQuotaTransactions,
            userId: users.id,
            userName: users.name,
            username: users.username
          })
          .from(songQuotaTransactions)
          .innerJoin(songQuotaAccounts, eq(songQuotaAccounts.id, songQuotaTransactions.accountId))
          .innerJoin(users, eq(users.id, songQuotaAccounts.userId))
          .where(where)
          .orderBy(desc(songQuotaTransactions.createdAt), desc(songQuotaTransactions.id))
          .limit(limit)
          .offset(offset)
          .then((rows) => rows.map((row) => ({
            ...row.transaction,
            userId: row.userId,
            userName: row.userName,
            username: row.username
          }))),
        dbOrTx
          .select({ value: sql<number>`count(*)::int` })
          .from(songQuotaTransactions)
          .innerJoin(songQuotaAccounts, eq(songQuotaAccounts.id, songQuotaTransactions.accountId))
          .innerJoin(users, eq(users.id, songQuotaAccounts.userId))
          .where(where)
      ])
      return { items, total: totals[0]?.value ?? 0, page, limit }
    },
    async listAccounts(input: Record<string, unknown>) {
      const filters = []
      if (typeof input.search === 'string' && input.search) {
        const term = `%${input.search}%`
        filters.push(or(ilike(users.name, term), ilike(users.username, term)))
      }
      const where = filters.length > 0 ? and(...filters) : sql`true`
      const page = typeof input.page === 'number' ? input.page : 1
      const limit = typeof input.limit === 'number' ? input.limit : 20
      const offset = (page - 1) * limit
      const selection = {
        userId: users.id,
        name: users.name,
        username: users.username,
        role: users.role,
        status: users.status,
        grade: users.grade,
        class: users.class,
        periodicBalance: sql<number>`coalesce(${songQuotaAccounts.periodicBalance}, 0)::int`,
        permanentBalance: sql<number>`coalesce(${songQuotaAccounts.permanentBalance}, 0)::int`,
        periodKey: songQuotaAccounts.periodKey,
        updatedAt: songQuotaAccounts.updatedAt
      }
      const [items, totals] = await Promise.all([
        dbOrTx.select(selection).from(users)
          .leftJoin(songQuotaAccounts, eq(songQuotaAccounts.userId, users.id))
          .where(where).orderBy(asc(users.id)).limit(limit).offset(offset),
        dbOrTx.select({ value: sql<number>`count(*)::int` }).from(users).where(where)
      ])
      return { items, total: totals[0]?.value ?? 0, page, limit }
    },
    async getAccountDetails(userId: number) {
      const rows = await dbOrTx.select({
        userId: users.id,
        name: users.name,
        username: users.username,
        role: users.role,
        status: users.status,
        grade: users.grade,
        class: users.class,
        periodicBalance: sql<number>`coalesce(${songQuotaAccounts.periodicBalance}, 0)::int`,
        permanentBalance: sql<number>`coalesce(${songQuotaAccounts.permanentBalance}, 0)::int`,
        periodKey: songQuotaAccounts.periodKey,
        createdAt: songQuotaAccounts.createdAt,
        updatedAt: songQuotaAccounts.updatedAt
      }).from(users).leftJoin(songQuotaAccounts, eq(songQuotaAccounts.userId, users.id))
        .where(eq(users.id, userId)).limit(1)
      return rows[0] ?? null
    }
  }
}

function getPostgresErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null
  const directCode = Reflect.get(error, 'code')
  if (typeof directCode === 'string') return directCode
  const cause = Reflect.get(error, 'cause')
  if (typeof cause !== 'object' || cause === null) return null
  const causeCode = Reflect.get(cause, 'code')
  return typeof causeCode === 'string' ? causeCode : null
}

export async function runSongQuotaDrizzleTransaction<T>(
  db: TransactionDatabase,
  operation: (adapter: ReturnType<typeof createSongQuotaDrizzleAdapter>) => Promise<T>
) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.transaction(
        (tx) => operation(createSongQuotaDrizzleAdapter(tx)),
        { isolationLevel: 'serializable' }
      )
    } catch (error) {
      const code = getPostgresErrorCode(error)
      if (attempt === 3 || (code !== '40001' && code !== '40P01')) throw error
    }
  }
  throw new Error('点歌额度事务重试失败')
}
