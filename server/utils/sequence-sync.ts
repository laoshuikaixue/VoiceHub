import { db } from '~/drizzle/db'
import { sql } from 'drizzle-orm'

// 恢复显式 id 数据后同步所有自增序列，避免后续插入主键冲突（幂等）
export async function syncAllSequences(): Promise<void> {
  await db.execute(sql`
    DO $repair$
    DECLARE
      r record;
      seqname text;
      maxid bigint;
    BEGIN
      FOR r IN
        SELECT c.relname AS tbl, a.attname AS col
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND a.attnum > 0 AND NOT a.attisdropped
          AND pg_get_expr(ad.adbin, ad.adrelid) LIKE 'nextval(%'
      LOOP
        seqname := pg_get_serial_sequence(quote_ident(r.tbl), r.col);
        IF seqname IS NULL THEN CONTINUE; END IF;
        EXECUTE format('SELECT COALESCE(MAX(%I),0) FROM %I', r.col, r.tbl) INTO maxid;
        EXECUTE format('SELECT setval(%L, %s)', seqname, GREATEST(maxid, 1));
      END LOOP;
    END $repair$
  `)
}
