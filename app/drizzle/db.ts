// ==========================================================================
// VoiceHub · PostgreSQL + Drizzle 连接层
//
// Lazy schema 自动修复：任何查询失败 → 如 PG 返回 42P01/42703/42704
// → 解析缺失对象 → 查元数据确认 → 执行 DDL → 重试查询
// ==========================================================================

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  and, asc, count, desc, eq, exists, gt, gte,
  lt, lte, ne, or, sql,
} from 'drizzle-orm';
import * as schema from './schema.ts';
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(process.cwd(), '.env') });
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

import chalk from 'chalk';

const DEV = process.env.NODE_ENV === 'development';
const PROD = process.env.NODE_ENV === 'production';

// ── 配置常量 ────────────────────────────────────────────────────────────
const DB_MAX_CONNECTIONS = PROD ? 10 : 5;
const DB_IDLE_TIMEOUT = 20;
const DB_CONNECT_TIMEOUT = 30;

const SCHEMA_FIX_MAX_RECURSION = 32;
const SCHEMA_FIX_MAX_ATTEMPTS = 10;
const SCHEMA_FIX_MAX_RETRY = 3;

const log = (...args: unknown[]) => { 
  if (DEV) console.log(chalk.gray('[db]'), ...args); 
};

const warn = (...args: unknown[]) => { 
  console.log(chalk.gray('[db]'), chalk.yellow(...args)); 
};

const success = (...args: unknown[]) => {
  if (DEV) console.log(chalk.gray('[db]'), chalk.green(...args));
};

const error = (...args: unknown[]) => {
  console.log(chalk.gray('[db]'), chalk.red(...args));
};

const info = (...args: unknown[]) => {
  if (DEV) console.log(chalk.gray('[db]'), chalk.blue(...args));
};

const action = (...args: unknown[]) => {
  if (DEV) console.log(chalk.gray('[db]'), chalk.cyan(...args));
};

// ── 内部 client（不被 Proxy 拦截，用于 schema 检查和 DDL）────
const innerClient = postgres(process.env.DATABASE_URL, {
  max: DB_MAX_CONNECTIONS,
  idle_timeout: DB_IDLE_TIMEOUT,
  connect_timeout: DB_CONNECT_TIMEOUT,
  prepare: false,
  transform: { undefined: null },
  connection: { application_name: 'voicehub-app' },
  onnotice: DEV ? console.log : undefined,
});

// ── SQL 转义辅助 ────────────────────────────────────────────────────────────
// PostgreSQL 字符串字面量转义：单引号 ''、反斜杠 \\（兼容两种 standard_conforming_strings 模式）
const escS = (s: string): string => {
  return s
    .replace(/'/g, "''")        // 单引号转义
    .replace(/\\/g, '\\\\');    // 反斜杠转义
};
const escI = (s: string): string => {
  return `"${s.replace(/"/g, '""')}"`;
};

// ── PG 内置类型判断（避免把枚举类型加引号导致报错）───────────────
const BUILTIN_TYPES: string[] = [
  'serial', 'integer', 'bigint', 'smallint', 'boolean', 'text', 'uuid',
  'timestamp', 'timestamptz', 'date', 'time', 'json', 'jsonb',
  'numeric', 'decimal', 'real', 'double precision', 'inet', 'bytea',
  'character varying', 'varchar', 'character', 'char',
];

const BUILTIN_PREFIX_TYPES: string[] = [
  'serial', 'integer', 'bigint', 'smallint', 'timestamp', 'timestamptz',
  'numeric', 'decimal', 'character varying', 'varchar', 'character', 'char',
];

function isBuiltinType(typeStr: string): boolean {
  if (BUILTIN_TYPES.includes(typeStr)) return true;
  
  const lower = typeStr.toLowerCase();
  
  if (lower.startsWith('character varying')) {
    const rest = lower.slice('character varying'.length);
    return rest.length === 0 || rest.startsWith('(');
  }
  
  for (const prefix of BUILTIN_PREFIX_TYPES) {
    if (lower.startsWith(prefix)) {
      const rest = lower.slice(prefix.length);
      if (rest.length === 0 || rest.startsWith('(')) return true;
    }
  }
  
  return false;
}

// ── default → SQL 字面量/表达式 ───────────────────────────────────────────
function defaultToSql(d: unknown): string | null {
  if (d === undefined || d === null) return null;
  if (typeof d === 'boolean') return d ? 'true' : 'false';
  if (typeof d === 'number') return String(d);
  if (typeof d === 'string') return `'${escS(d)}'`;
  if (typeof d === 'object') {
    // 使用 Drizzle 官方的 toSQL() 方法（推荐，不依赖内部实现细节）
    const obj = d as DrizzleSql;
    if (typeof obj.toSQL === 'function') {
      const result = obj.toSQL();
      if (result && typeof result.sql === 'string' && result.sql.length > 0) {
        return result.sql;
      }
    }
    
    // 兼容旧版本的备用方案（不推荐依赖内部属性）
    if (Array.isArray(obj.queryChunks)) {
      const parts: string[] = [];
      for (const chunk of obj.queryChunks) {
        if (!chunk || typeof chunk !== 'object') continue;
        if (Array.isArray(chunk.value)) parts.push(...chunk.value.map((v) => String(v)));
        else if (typeof chunk.chunk === 'string') parts.push(chunk.chunk);
      }
      const joined = parts.join(' ').trim();
      if (joined.length > 0) return joined;
    }
    if (typeof obj.sql === 'string' && obj.sql.length > 0) return obj.sql;
  }
  return null;
}

// ── Schema 内省：构建 表 + 枚举 映射 ─────────────────────────────────
interface ColDef { name: string; sqlType: string; notNull: boolean; isPrimary: boolean; defaultSql: string | null; isSerial: boolean; referencesTable?: string; referencesColumn?: string; }
interface TableDef { name: string; columns: ColDef[]; }
interface EnumDef { name: string; values: string[]; }

// ── Drizzle 内部类型定义 ─────────────────────────────────────────────
interface DrizzleSqlResult {
  sql: string;
  params?: unknown[];
}

interface DrizzleSqlFragment {
  value?: unknown[];
  chunk?: string;
}

interface DrizzleSql {
  toSQL?: () => DrizzleSqlResult;
  queryChunks?: DrizzleSqlFragment[];
  sql?: string;
}

interface DrizzleColumnConfig {
  default?: unknown;
  references?: () => { _table?: DrizzleTableRef; _column?: DrizzleColumn };
}

interface DrizzleColumn {
  name?: unknown;
  primary?: unknown;
  notNull?: unknown;
  default?: unknown;
  getSQLType?: () => unknown;
  config?: DrizzleColumnConfig;
}

interface DrizzleTableRef {
  _name?: string;
  tableName?: string;
  config?: { tableName?: string; name?: string };
  [key: string]: unknown;
  [key: symbol]: unknown;
}

interface DrizzleEnumFunction {
  enumName?: string;
  enumValues?: string[];
}

// ── postgres.js 客户端类型定义 ───────────────────────────────────────────
interface PostgresQuery {
  then?: (onFulfilled?: any, onRejected?: any) => Promise<any>;
  values?: () => Promise<any[]>;
  execute?: () => Promise<any>;
  [key: string]: unknown;
}

interface PostgresClientInternal extends ReturnType<typeof postgres> {
  ended?: boolean;
  end?: (options?: { timeout?: number }) => Promise<void>;
}

type PostgresClient = ReturnType<typeof postgres>;

const drizzleSymbolCache = new Map<string, symbol | null>();

const { tables: schemaTables, enums: schemaEnums } = buildSchemaMaps();

function buildSchemaMaps(): { tables: Map<string, TableDef>; enums: Map<string, EnumDef> } {
  const tables = new Map<string, TableDef>();
  const enums = new Map<string, EnumDef>();

  // 1. 枚举收集（pgEnum 返回的 function 同时挂有 .enumName/.enumValues）
  for (const val of Object.values(schema)) {
    if (val && typeof val === 'function') {
      const f = val as DrizzleEnumFunction;
      if (typeof f.enumName === 'string' && Array.isArray(f.enumValues)) {
        enums.set(f.enumName, { name: f.enumName, values: f.enumValues.map((x) => String(x)) });
      }
    }
  }

  // 2. 表 + 列收集（pgTable 返回的对象挂有 Symbol(drizzle:Name)）
  for (const val of Object.values(schema)) {
    if (!val || typeof val !== 'object') continue;

    const tableName = getTableNameFromSchema(val);
    if (!tableName) continue;

    const columns: ColDef[] = [];
    for (const col of Object.values(val as object)) {
      if (!col || typeof col !== 'object') continue;
      const c = col as DrizzleColumn;
      if (typeof c.getSQLType !== 'function') continue;

      const rawType = c.getSQLType();
      const sqlType = typeof rawType === 'string' ? rawType : 'text';
      const isSerial = sqlType === 'serial';
      const isPrimary = !!c.primary;
      const colConfig = c.config;
      const defaultValue = colConfig?.default ?? c.default;

      let referencesTable: string | undefined;
      let referencesColumn: string | undefined;
      if (colConfig?.references && typeof colConfig.references === 'function') {
        try {
          const refResult = colConfig.references();
          if (refResult && typeof refResult === 'object') {
            const refTable = refResult._table;
            if (refTable) {
              referencesTable = refTable._name ?? refTable.tableName;
            }
            const refColumn = refResult._column;
            if (refColumn && typeof refColumn.name === 'string') {
              referencesColumn = refColumn.name;
            }
          }
        } catch {
          // ignore
        }
      }

      columns.push({
        name: typeof c.name === 'string' ? c.name : String(c),
        sqlType,
        notNull: !!c.notNull || isPrimary,
        isPrimary,
        defaultSql: isPrimary && isSerial ? null : defaultToSql(defaultValue),
        isSerial,
        referencesTable,
        referencesColumn,
      });
    }

    if (columns.length > 0) tables.set(tableName, { name: tableName, columns });
  }

  success(`schema 映射完成：${tables.size} 张表，${enums.size} 个枚举`);
  return { tables, enums };
}

function findDrizzleSymbol(description: string): symbol | null {
  const cached = drizzleSymbolCache.get(description);
  if (cached !== undefined) return cached;

  for (const val of Object.values(schema)) {
    if (!val || typeof val !== 'object') continue;
    for (const sym of Object.getOwnPropertySymbols(val)) {
      if (sym.toString().includes(description)) {
        drizzleSymbolCache.set(description, sym);
        return sym;
      }
    }
  }

  drizzleSymbolCache.set(description, null);
  return null;
}

function getTableNameFromSchema(val: unknown): string | undefined {
  if (!val || typeof val !== 'object') return undefined;
  
  const obj = val as DrizzleTableRef;
  
  const tableSymbol = findDrizzleSymbol('drizzle:Name');
  if (tableSymbol) {
    const name = obj[tableSymbol];
    if (name) return String(name);
  }
  
  const keys = Object.keys(obj);
  
  if (keys.includes('_name')) {
    const name = obj._name;
    if (name && typeof name === 'string') return name;
  }
  
  if (keys.includes('tableName')) {
    const name = obj.tableName;
    if (name && typeof name === 'string') return name;
  }
  
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.length > 0 && !value.includes('(')) {
      return value;
    }
  }
  
  const symbols = Object.getOwnPropertySymbols(obj);
  for (const sym of symbols) {
    const name = obj[sym];
    if (typeof name === 'string' && name.length > 0 && !name.includes('(')) {
      return name;
    }
  }
  
  const config = obj.config;
  if (config && typeof config === 'object') {
    if (typeof config.tableName === 'string') return config.tableName;
    if (typeof config.name === 'string') return config.name;
  }
  
  return undefined;
}

// ── 大小写不敏感查找 ───────────────────────────────────────────────────────
function findTableCI(name: string): TableDef | undefined {
  const exact = schemaTables.get(name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  for (const [key, info] of schemaTables) if (key.toLowerCase() === lower) return info;
  return undefined;
}

function findEnumCI(name: string): EnumDef | undefined {
  const exact = schemaEnums.get(name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  for (const [key, info] of schemaEnums) if (key.toLowerCase() === lower) return info;
  return undefined;
}

function findColumnCI(tbl: TableDef, colName: string): ColDef | undefined {
  const exact = tbl.columns.find((c) => c.name === colName);
  if (exact) return exact;
  const lower = colName.toLowerCase();
  return tbl.columns.find((c) => c.name.toLowerCase() === lower);
}

// ── DDL 生成 ───────────────────────────────────────────────────────────────
function colTypeForDdl(col: ColDef): string {
  return isBuiltinType(col.sqlType) ? col.sqlType : escI(col.sqlType);
}

function buildCreateTableSql(tbl: TableDef): string {
  const colParts = tbl.columns.map((col) => {
    const parts = [escI(col.name), colTypeForDdl(col)];
    if (col.defaultSql) parts.push(`DEFAULT ${col.defaultSql}`);
    if (col.notNull && !col.isSerial) parts.push('NOT NULL');
    return parts.join(' ');
  });
  const pkCol = tbl.columns.find((c) => c.isPrimary);
  if (pkCol) colParts.push(`PRIMARY KEY (${escI(pkCol.name)})`);
  return `CREATE TABLE IF NOT EXISTS ${escI(tbl.name)} (${colParts.join(', ')})`;
}

function buildCreateTableSqlWithoutFK(tbl: TableDef): string {
  const colParts = tbl.columns
    .filter((col) => !col.referencesTable)
    .map((col) => {
      const parts = [escI(col.name), colTypeForDdl(col)];
      if (col.defaultSql) parts.push(`DEFAULT ${col.defaultSql}`);
      if (col.notNull && !col.isSerial) parts.push('NOT NULL');
      return parts.join(' ');
    });
  const pkCol = tbl.columns.find((c) => c.isPrimary);
  if (pkCol) colParts.push(`PRIMARY KEY (${escI(pkCol.name)})`);
  return `CREATE TABLE IF NOT EXISTS ${escI(tbl.name)} (${colParts.join(', ')})`;
}

function buildAddForeignKeySql(tbl: TableDef, col: ColDef): string {
  if (!col.referencesTable || !col.referencesColumn) return '';
  return `ALTER TABLE ${escI(tbl.name)} ADD CONSTRAINT ${escI(`fk_${tbl.name}_${col.name}`)} FOREIGN KEY (${escI(col.name)}) REFERENCES ${escI(col.referencesTable)}(${escI(col.referencesColumn)})`;
}

function buildAlterTableSql(tbl: TableDef, col: ColDef): string {
  const parts = [
    `ALTER TABLE ${escI(tbl.name)} ADD COLUMN IF NOT EXISTS ${escI(col.name)} ${colTypeForDdl(col)}`,
  ];
  if (col.defaultSql) {
    parts.push(`DEFAULT ${col.defaultSql}`);
  }
  return parts.join(' ');
}

function buildAlterTableAddNotNull(tbl: TableDef, col: ColDef): string {
  return `ALTER TABLE ${escI(tbl.name)} ALTER COLUMN ${escI(col.name)} SET NOT NULL`;
}

function buildAlterColumnDefaultSql(tbl: TableDef, col: ColDef): string {
  if (!col.defaultSql) return '';
  return `ALTER TABLE ${escI(tbl.name)} ALTER COLUMN ${escI(col.name)} SET DEFAULT ${col.defaultSql}`;
}

function buildCreateTypeSql(en: EnumDef): string {
  // objectMissing 已确认类型不存在，不需要 IF NOT EXISTS
  const vals = en.values.map((v) => `'${escS(v)}'`).join(', ');
  return `CREATE TYPE ${escI(en.name)} AS ENUM (${vals})`;
}

// ── 对象存在性检查（参数化查询，避免 SQL 注入）──────────────
async function objectMissingTable(name: string): Promise<boolean> {
  const rows = await innerClient.unsafe(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND LOWER(table_name) = LOWER($1)',
    [name],
  ) as unknown[];
  return rows.length === 0;
}

async function objectMissingColumn(table: string, col: string): Promise<boolean> {
  const rows = await innerClient.unsafe(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND LOWER(table_name) = LOWER($1) AND LOWER(column_name) = LOWER($2)',
    [table, col],
  ) as unknown[];
  return rows.length === 0;
}

async function objectMissingType(name: string): Promise<boolean> {
  const rows = await innerClient.unsafe(
    'SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE LOWER(t.typname) = LOWER($1) AND n.nspname = current_schema()',
    [name],
  ) as unknown[];
  return rows.length === 0;
}

async function getMissingTypes(names: string[]): Promise<Set<string>> {
  if (names.length === 0) return new Set();
  const placeholders = names.map((_, i) => `LOWER($${i + 1})`).join(', ');
  const rows = await innerClient.unsafe(
    `SELECT LOWER(t.typname) as name FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = current_schema() AND LOWER(t.typname) IN (${placeholders})`,
    names.map((n) => n.toLowerCase()),
  ) as { name: string }[];
  const existing = new Set(rows.map((r) => r.name));
  return new Set(names.filter((n) => !existing.has(n.toLowerCase())));
}

async function getMissingTables(names: string[]): Promise<Set<string>> {
  if (names.length === 0) return new Set();
  const placeholders = names.map((_, i) => `LOWER($${i + 1})`).join(', ');
  const rows = await innerClient.unsafe(
    `SELECT LOWER(table_name) as name FROM information_schema.tables WHERE table_schema = current_schema() AND LOWER(table_name) IN (${placeholders})`,
    names.map((n) => n.toLowerCase()),
  ) as { name: string }[];
  const existing = new Set(rows.map((r) => r.name));
  return new Set(names.filter((n) => !existing.has(n.toLowerCase())));
}

async function columnMissingDefault(table: string, col: string): Promise<boolean> {
  const rows = await innerClient.unsafe(
    'SELECT column_default FROM information_schema.columns WHERE table_schema = current_schema() AND LOWER(table_name) = LOWER($1) AND LOWER(column_name) = LOWER($2)',
    [table, col],
  ) as { column_default: string | null }[];
  if (rows.length === 0) {
    throw new Error(`columnMissingDefault: 列不存在 (table=${table}, column=${col})`);
  }
  return rows[0].column_default === null;
}

// ── Schema 修复引擎 ──────────────────────────────────────────────────────
// runningFixes: 同一目标（表/列/枚举）并发请求只执行一次 DDL
const runningFixes = new Map<string, Promise<boolean>>();

type FixTarget =
  | { kind: 'table'; name: string; ddl: string }
  | { kind: 'column'; table: string; col: string; ddl: string; notNull?: boolean; colDef?: ColDef }
  | { kind: 'columnNotNull'; table: string; col: string; ddl: string }
  | { kind: 'columnDefault'; table: string; col: string; ddl: string }
  | { kind: 'type'; name: string; ddl: string };

function targetKey(t: FixTarget): string {
  if (t.kind === 'type') return `e:${t.name}`;
  if (t.kind === 'table') return `t:${t.name}`;
  if (t.kind === 'columnDefault') return `d:${t.table}:${t.col}`;
  if (t.kind === 'columnNotNull') return `nn:${t.table}:${t.col}`;
  return `c:${t.table}:${t.col}`;
}

async function columnHasNotNull(table: string, col: string): Promise<boolean> {
  const rows = await innerClient.unsafe(
    'SELECT is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND LOWER(table_name) = LOWER($1) AND LOWER(column_name) = LOWER($2)',
    [table, col],
  ) as { is_nullable: string }[];
  if (rows.length === 0) {
    warn(`columnHasNotNull: 列不存在 (table=${table}, column=${col})，视为非 NOT NULL`);
    return false;
  }
  return rows[0].is_nullable === 'NO';
}

async function objectMissing(t: FixTarget): Promise<boolean> {
  if (t.kind === 'table') return objectMissingTable(t.name);
  if (t.kind === 'column') return objectMissingColumn(t.table, t.col);
  if (t.kind === 'columnNotNull') return !(await columnHasNotNull(t.table, t.col));
  if (t.kind === 'columnDefault') return columnMissingDefault(t.table, t.col);
  return objectMissingType(t.name);
}

async function fixTarget(target: FixTarget, depth: number): Promise<boolean> {
  if (depth >= SCHEMA_FIX_MAX_RECURSION) {
    warn(`递归修复达到上限（${SCHEMA_FIX_MAX_RECURSION}），放弃: ${targetKey(target)}`);
    return false;
  }

  const key = targetKey(target);

  // 并发去重：直接使用 Promise 作为锁
  const pending = runningFixes.get(key);
  if (pending) {
    const result = await pending;
    if (!result) {
      info(`等待的修复失败，当前请求尝试重新修复: ${key}`);
      return fixTarget(target, depth);
    }
    return true;
  }

  const fixPromise = (async (): Promise<boolean> => {
    try {
      const missing = await objectMissing(target);
      if (!missing) {
        success(`对象已存在: ${key}`);
        return true;
      }

      action(`执行 DDL (depth=${depth}): ${target.ddl}`);

      try {
        await innerClient.unsafe(target.ddl);
      } catch (ddlErr) {
        if (!isSchemaError(ddlErr)) throw ddlErr;
        const dep = targetFromError(ddlErr);
        if (!dep) throw ddlErr;
        info(`DDL 依赖其他 schema 对象，先递归修复: ${targetKey(dep)}`);
        const depFixed = await fixTarget(dep, depth + 1);
        if (!depFixed) throw ddlErr;

        // 依赖修复后重试 DDL，若仍失败则检查错误类型
        try {
          await innerClient.unsafe(target.ddl);
        } catch (retryErr) {
          if (!isSchemaError(retryErr)) {
            // 非 schema 错误（如权限问题），无法通过重试修复，直接抛出
            throw retryErr;
          }
          const failedTarget = targetFromError(retryErr);
          if (!failedTarget || targetKey(failedTarget) !== key) {
            // 错误与当前 target 无关，说明是其他问题，直接抛出
            throw retryErr;
          }
          // 错误仍与当前 target 相关，可能是还有其他依赖未修复
          // 抛出原始错误让外层循环继续尝试修复
          throw ddlErr;
        }
      }

      success(`schema 已修复: ${key}`);

      if (target.kind === 'column') {
        if (target.notNull && target.colDef) {
          const tbl = findTableCI(target.table);
          if (tbl) {
            const notNullDdl = buildAlterTableAddNotNull(tbl, target.colDef);
            action(`添加 NOT NULL 约束: ${notNullDdl}`);
            try {
              await innerClient.unsafe(notNullDdl);
              success(`NOT NULL 约束已添加: ${targetKey(target)}`);
            } catch (e) {
              warn(`添加 NOT NULL 约束失败（${targetKey(target)}）: ${(e as Error).message}`);
            }
          }
        }
      }

      return true;
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e);
      warn(`schema 修复失败（${key}）: ${msg}`);
      return false;
    } finally {
      runningFixes.delete(key);
    }
  })();

  runningFixes.set(key, fixPromise);
  return fixPromise;
}

async function fixAllMissingDefaults(tableName: string): Promise<void> {
  const tbl = findTableCI(tableName);
  if (!tbl) return;

  for (const col of tbl.columns) {
    if (!col.defaultSql) continue;

    const key = `defs:${tbl.name}:${col.name}`;

    let pending = runningFixes.get(key);
    if (!pending) {
      const fixPromise = (async (): Promise<boolean> => {
        try {
          const missing = await columnMissingDefault(tbl.name, col.name);
          if (missing) {
            const ddl = buildAlterColumnDefaultSql(tbl, col);
            if (ddl) {
              action(`批量修复默认值: ${ddl}`);
              try {
                await innerClient.unsafe(ddl);
                success(`默认值已修复: ${key}`);
              } catch (e) {
                const msg = (e as { message?: string })?.message ?? String(e);
                warn(`默认值修复失败（${key}）: ${msg}`);
              }
            }
          }
          return true;
        } catch (e) {
          const msg = (e as { message?: string })?.message ?? String(e);
          warn(`检查默认值失败（${key}）: ${msg}`);
          return false;
        } finally {
          runningFixes.delete(key);
        }
      })();

      runningFixes.set(key, fixPromise);
      await fixPromise;
    }
  }
}

// ── 错误解析：从 PG 错误消息判断缺哪个 schema 对象 ─────────
const SCHEMA_ERROR_CODES = new Set(['42P01', '42703', '42704', '23502']);
function isSchemaError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return !!code && SCHEMA_ERROR_CODES.has(code);
}

function targetFromError(err: unknown): FixTarget | null {
  const e = err as { code?: string; message?: string };
  const code = e.code ?? '';
  const msg = e.message ?? '';

  if (code === '42P01') {
    const m = msg.match(/relation\s+"([^"]+)"/i);
    if (m) {
      const info = findTableCI(m[1]);
      if (info) return { kind: 'table', name: info.name, ddl: buildCreateTableSql(info) };
    }
  }
  if (code === '42703') {
    const m = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"([^"]+)"/i);
    if (m) {
      const tbl = findTableCI(m[2]);
      if (tbl) {
        const col = findColumnCI(tbl, m[1]);
        if (col) return { kind: 'column', table: tbl.name, col: col.name, ddl: buildAlterTableSql(tbl, col), notNull: col.notNull, colDef: col };
      }
    }
  }
  if (code === '42704') {
    const m = msg.match(/type\s+"([^"]+)"/i);
    if (m) {
      const info = findEnumCI(m[1]);
      if (info) return { kind: 'type', name: info.name, ddl: buildCreateTypeSql(info) };
    }
  }
  if (code === '23502') {
    const m = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"([^"]+)"/i);
    if (m) {
      const tbl = findTableCI(m[2]);
      if (tbl) {
        const col = findColumnCI(tbl, m[1]);
        if (col && col.defaultSql) {
          const ddl = buildAlterColumnDefaultSql(tbl, col);
          if (ddl) return { kind: 'columnDefault', table: tbl.name, col: col.name, ddl };
        }
      }
    }
  }
  return null;
}

async function ensureSchemaFixedFor(err: unknown): Promise<boolean> {
  const target = targetFromError(err);
  if (!target) return false;
  return fixTarget(target, 0);
}

// ── Proxy 包装：拦截业务查询 + schema 错误自动修复 ────────────
// wrapPromise: 对任意 Promise 捕获 schema 错误 → 修复 → 重新 execute（支持循环重试）
// 循环重试的原因：一条 SQL 可能同时涉及多个缺失对象（如 JOIN 多张不存在的表）
// 每次重试只能修复当前报错的对象，需要循环直到所有缺失对象都被修复
function wrapPromise<T>(promise: Promise<T>, execute: () => Promise<T>): Promise<T> {
  return promise.catch(async (err) => {
    if (!isSchemaError(err)) throw err;
    
    // 循环重试，直到不再是 schema 错误或修复失败
    let attempts = 0;
    
    while (attempts < SCHEMA_FIX_MAX_ATTEMPTS) {
      const fixed = await ensureSchemaFixedFor(err);
      if (!fixed) throw err;
      
      attempts++;
      action(`重试查询（schema 已修复，第 ${attempts} 次）`);
      
      try {
        return await execute();
      } catch (retryErr) {
        if (!isSchemaError(retryErr)) throw retryErr;
        err = retryErr; // 更新错误，继续修复下一个缺失对象
      }
    }
    
    throw new Error(`Schema 修复重试次数达到上限（${SCHEMA_FIX_MAX_ATTEMPTS}），放弃`);
  });
}

function wrapWithSchemaFix<T>(result: PostgresQuery | Promise<T>, execute: () => Promise<T>): PostgresQuery | Promise<T> {
  if (result && typeof result.values === 'function') {
    const query = result as PostgresQuery;

    // 使用 Object.create 继承原型，保留所有原始属性
    const wrapped = Object.create(Object.getPrototypeOf(query));

    // 复制所有自有属性
    for (const key of Object.keys(query)) {
      (wrapped as Record<string, unknown>)[key] = (query as Record<string, unknown>)[key];
    }

    // 覆盖需要拦截的方法
    const origThen = query.then?.bind(query);
    const origValues = query.values?.bind(query);
    const origExecute = query.execute?.bind(query);

    if (origThen) {
      wrapped.then = function (onFulfilled: unknown, onRejected: unknown) {
        return origThen(
          onFulfilled,
          async (err: unknown) => {
            if (!isSchemaError(err)) throw err;
            const fixed = await ensureSchemaFixedFor(err);
            if (!fixed) throw err;
            action(`重试查询（schema 已修复）`);
            return await execute();
          },
        );
      };
    }

    if (origValues) {
      wrapped.values = function () {
        return wrapPromise(origValues(), execute);
      };
    }

    if (origExecute) {
      wrapped.execute = function () {
        return wrapPromise(origExecute(), execute);
      };
    }

    return wrapped;
  }

  return wrapPromise(result as Promise<T>, execute);
}

// ── 对外 client：Proxy 包装 innerClient ───────────────────────
const client = new Proxy(innerClient as PostgresClient, {
  apply(_t, _this, args: unknown[]) {
    const result = innerClient(...(args as Parameters<typeof innerClient>));
    return wrapWithSchemaFix(result, () => innerClient(...(args as Parameters<typeof innerClient>)));
  },
  get(target, prop, _receiver) {
    const value = Reflect.get(target, prop);
    if (typeof value !== 'function') return value;
    const boundFn = (value as Function).bind(target);
    const s = String(prop);
    if (s === 'end' || s === 'destroy' || s === 'close' || s === 'cancel') return boundFn;
    return function (this: unknown, ...args: unknown[]): PostgresQuery | Promise<unknown> {
      const result = boundFn(...args);
      return wrapWithSchemaFix(result as Promise<unknown>, () => boundFn(...args) as Promise<unknown>);
    };
  },
}) as PostgresClient;

// ── 对外导出 ───────────────────────────────────────────────────────────────
export const db = drizzle(client, { schema });
export { client };
export * from './schema.ts';
export { eq, ne, and, gt, gte, lt, lte, count, exists, desc, asc, or, sql };

export async function testConnection(): Promise<boolean> {
  try { await client`SELECT 1`; success('连接正常'); return true; }
  catch (error) { error(`连接失败: ${error}`); return false; }
}

export async function ensureAllTablesExist(): Promise<void> {
  info('开始检查并创建缺失的表...');

  let retryCount = 0;
  let hasFailures = true;

  while (hasFailures && retryCount < SCHEMA_FIX_MAX_RETRY) {
    hasFailures = false;
    retryCount++;

    if (retryCount > 1) {
      log(`🔄 第 ${retryCount} 次重试创建缺失的对象...`);
    }

    // 批量查询所有缺失的枚举
    const enumNames = Array.from(schemaEnums.keys());
    const missingEnums = await getMissingTypes(enumNames);
    for (const enumName of missingEnums) {
      const enumDef = schemaEnums.get(enumName);
      if (!enumDef) continue;
      action(`创建枚举类型: ${enumName}`);
      const ddl = buildCreateTypeSql(enumDef);
      try {
        await innerClient.unsafe(ddl);
        success(`枚举 ${enumName} 创建成功`);
      } catch (error) {
        error(`创建枚举 ${enumName} 失败: ${error}`);
        hasFailures = true;
      }
    }

    // 批量查询所有缺失的表
    const { tables: sortedTables, hasCycle } = sortTablesByDependency();
    const tableNames = sortedTables.map((t) => t.name);
    const missingTables = await getMissingTables(tableNames);

    // 有循环依赖时分两阶段创建：先建表（不带外键），再添加外键
    if (hasCycle) {
      // 阶段1：创建所有缺失的表（不带外键约束）
      for (const tableDef of sortedTables) {
        if (!missingTables.has(tableDef.name)) continue;
        action(`创建表（不含外键）: ${tableDef.name}`);
        const ddl = buildCreateTableSqlWithoutFK(tableDef);
        try {
          await innerClient.unsafe(ddl);
          success(`表 ${tableDef.name} 创建成功`);
        } catch (error) {
          error(`创建表 ${tableDef.name} 失败: ${error}`);
          hasFailures = true;
        }
      }

      // 阶段2：添加外键约束
      for (const tableDef of sortedTables) {
        for (const col of tableDef.columns) {
          if (!col.referencesTable) continue;
          const fkSql = buildAddForeignKeySql(tableDef, col);
          if (!fkSql) continue;
          action(`添加外键约束: ${tableDef.name}.${col.name}`);
          try {
            await innerClient.unsafe(fkSql);
            success(`外键 ${tableDef.name}.${col.name} 添加成功`);
          } catch (error) {
            error(`添加外键约束 ${tableDef.name}.${col.name} 失败: ${error}`);
            hasFailures = true;
          }
        }
      }
    } else {
      // 无循环依赖，正常创建
      for (const tableDef of sortedTables) {
        if (!missingTables.has(tableDef.name)) continue;
        action(`创建表: ${tableDef.name}`);
        const ddl = buildCreateTableSql(tableDef);
        try {
          await innerClient.unsafe(ddl);
          success(`表 ${tableDef.name} 创建成功`);
        } catch (error) {
          error(`创建表 ${tableDef.name} 失败: ${error}`);
          hasFailures = true;
        }
      }
    }

    // 表创建完成后，修复所有缺失的默认值
    for (const tableDef of sortedTables) {
      if (missingTables.has(tableDef.name)) {
        await fixAllMissingDefaults(tableDef.name);
      }
    }
  }

  if (hasFailures) {
    warn(`经过 ${SCHEMA_FIX_MAX_RETRY} 次重试后仍有表创建失败，请检查数据库配置`);
  }

  success('表检查完成');
}

function sortTablesByDependency(): { tables: TableDef[]; hasCycle: boolean } {
  const tables = Array.from(schemaTables.values());
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, Set<string>>();

  for (const table of tables) {
    inDegree.set(table.name, 0);
    adjacency.set(table.name, new Set());
  }

  for (const table of tables) {
    for (const col of table.columns) {
      if (col.referencesTable) {
        const refTableName = schemaTables.has(col.referencesTable)
          ? col.referencesTable
          : [...schemaTables.keys()].find((k) => k.toLowerCase() === col.referencesTable?.toLowerCase());

        if (refTableName && refTableName !== table.name) {
          adjacency.get(refTableName)?.add(table.name);
          inDegree.set(table.name, (inDegree.get(table.name) || 0) + 1);
        }
      }
    }
  }

  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  const sorted: TableDef[] = [];
  while (queue.length > 0) {
    const name = queue.shift()!;
    const table = schemaTables.get(name);
    if (table) sorted.push(table);

    for (const neighbor of adjacency.get(name) || []) {
      const deg = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  const remaining = tables.filter((table) => !sorted.find((t) => t.name === table.name));
  const hasCycle = remaining.length > 0;
  if (remaining.length > 0) {
    const cycleTables = remaining.map((t) => t.name).join(', ');
    warn(`检测到表之间存在循环依赖: [${cycleTables}]，这些表将按原始顺序追加`);
    sorted.push(...remaining);
  }

  return { tables: sorted, hasCycle };
}

export function getConnectionStatus(): { connected: boolean; status: string } {
  const client = innerClient as PostgresClientInternal;
  return { connected: !client.ended, status: client.ended ? 'disconnected' : 'connected' };
}

export async function closeConnection(): Promise<void> {
  const client = innerClient as PostgresClientInternal;
  try { if (!client.ended && client.end) { await client.end({ timeout: 10 }); success('连接已优雅关闭'); } }
  catch (error) { error(`关闭连接失败: ${error}`); }
}

async function shutdown(signal: string): Promise<void> {
  info(`收到 ${signal} 信号，开始优雅关闭...`);
  
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      warn('关闭超时，强制退出');
      process.exit(1);
    }, 15000);
  });
  
  await Promise.race([
    closeConnection(),
    timeoutPromise,
  ]);
  
  process.exit(0);
}

if (typeof process !== 'undefined') {
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

let initPromise: Promise<void> | null = null;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;
const INIT_COOLDOWN_MS = 5000;

export async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;
  
  if (initAttempts >= MAX_INIT_ATTEMPTS) {
    throw new Error(`数据库初始化已达到最大重试次数（${MAX_INIT_ATTEMPTS}次），请检查数据库配置`);
  }
  
  initPromise = (async () => {
    try {
      await ensureAllTablesExist();
      initAttempts = 0;
    } catch (error) {
      initAttempts++;
      initPromise = null;
      error(`数据库初始化失败（第 ${initAttempts}/${MAX_INIT_ATTEMPTS} 次尝试）: ${error}`);
      
      if (initAttempts < MAX_INIT_ATTEMPTS) {
        warn(`等待 ${INIT_COOLDOWN_MS / 1000} 秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, INIT_COOLDOWN_MS));
      }
      
      throw error;
    }
  })();
  
  return initPromise;
}

// 自动初始化但不阻塞 - 仅在需要时初始化
// 移除自动初始化，避免与脚本中的 client.end() 冲突
// 如果需要启动时初始化，应在服务器启动时显式调用

