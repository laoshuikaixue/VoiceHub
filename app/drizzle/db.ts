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
  max: process.env.NODE_ENV === 'production' ? 10 : 5,
  idle_timeout: 20,
  connect_timeout: 30,
  prepare: false,
  transform: { undefined: null },
  connection: { application_name: 'voicehub-app' },
  onnotice: DEV ? console.log : undefined,
});

// ── SQL 转义辅助 ────────────────────────────────────────────────────────────
const escS = (s: string): string => {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "''");
};
const escI = (s: string): string => {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '""')}"`;
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
    const obj = d as { toSQL?: () => { sql: string; params?: unknown[] } };
    if (typeof obj.toSQL === 'function') {
      const result = obj.toSQL();
      if (result && typeof result.sql === 'string' && result.sql.length > 0) {
        return result.sql;
      }
    }
    
    // 兼容旧版本的备用方案（不推荐依赖内部属性）
    const oldApi = d as { queryChunks?: unknown; sql?: unknown };
    if (Array.isArray(oldApi.queryChunks)) {
      const parts: string[] = [];
      for (const chunk of oldApi.queryChunks) {
        if (!chunk || typeof chunk !== 'object') continue;
        const c = chunk as { value?: unknown; chunk?: unknown };
        if (Array.isArray(c.value)) parts.push(...c.value.map((v) => String(v)));
        else if (typeof c.chunk === 'string') parts.push(c.chunk);
      }
      const joined = parts.join(' ').trim();
      if (joined.length > 0) return joined;
    }
    if (typeof oldApi.sql === 'string' && oldApi.sql.length > 0) return oldApi.sql;
  }
  return null;
}

// ── Schema 内省：构建 表 + 枚举 映射 ─────────────────────────────────
interface ColDef { name: string; sqlType: string; notNull: boolean; isPrimary: boolean; defaultSql: string | null; isSerial: boolean; referencesTable?: string; }
interface TableDef { name: string; columns: ColDef[]; }
interface EnumDef { name: string; values: string[]; }

// ── Drizzle 内部类型定义 ─────────────────────────────────────────────
interface DrizzleColumnConfig {
  default?: unknown;
  references?: () => { _table?: { _name?: string; tableName?: string } };
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

const { tables: schemaTables, enums: schemaEnums } = buildSchemaMaps();

function buildSchemaMaps(): { tables: Map<string, TableDef>; enums: Map<string, EnumDef> } {
  const tables = new Map<string, TableDef>();
  const enums = new Map<string, EnumDef>();

  // 1. 枚举收集（pgEnum 返回的 function 同时挂有 .enumName/.enumValues）
  for (const val of Object.values(schema)) {
    if (val && typeof val === 'function') {
      const f = val as { enumName?: unknown; enumValues?: unknown };
      if (typeof f.enumName === 'string' && Array.isArray(f.enumValues)) {
        enums.set(f.enumName, { name: f.enumName, values: (f.enumValues as unknown[]).map((x) => String(x)) });
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
      const c = col as { name?: unknown; primary?: unknown; notNull?: unknown; default?: unknown; getSQLType?: () => unknown };
      if (typeof c.getSQLType !== 'function') continue;

      const rawType = c.getSQLType();
      const sqlType = typeof rawType === 'string' ? rawType : 'text';
      const isSerial = sqlType === 'serial';
      const isPrimary = !!c.primary;
      const colConfig = (c as DrizzleColumn).config;
      const defaultValue = colConfig?.default ?? c.default;

      let referencesTable: string | undefined;
      if (colConfig?.references && typeof colConfig.references === 'function') {
        try {
          const refResult = colConfig.references();
          if (refResult && typeof refResult === 'object') {
            const refSchema = refResult as { _table?: { _name?: string; tableName?: string } };
            if (refSchema._table) {
              referencesTable = refSchema._table._name ?? refSchema._table.tableName;
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
      });
    }

    if (columns.length > 0) tables.set(tableName, { name: tableName, columns });
  }

  success(`schema 映射完成：${tables.size} 张表，${enums.size} 个枚举`);
  return { tables, enums };
}

function findDrizzleSymbol(description: string): symbol | null {
  for (const val of Object.values(schema)) {
    if (!val || typeof val !== 'object') continue;
    for (const sym of Object.getOwnPropertySymbols(val)) {
      if (sym.toString().includes(description)) return sym;
    }
  }
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

async function columnMissingDefault(table: string, col: string): Promise<boolean> {
  const rows = await innerClient.unsafe(
    'SELECT column_default FROM information_schema.columns WHERE table_schema = current_schema() AND LOWER(table_name) = LOWER($1) AND LOWER(column_name) = LOWER($2)',
    [table, col],
  ) as { column_default: string | null }[];
  return rows.length === 0 || rows[0].column_default === null;
}

// ── Schema 修复引擎 ──────────────────────────────────────────────────────
// runningFixes: 同一目标（表/列/枚举）并发请求只执行一次 DDL
const runningFixes = new Map<string, Promise<boolean>>();
const MAX_RECURSION = 32;

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
  return rows.length > 0 && rows[0].is_nullable === 'NO';
}

async function objectMissing(t: FixTarget): Promise<boolean> {
  if (t.kind === 'table') return objectMissingTable(t.name);
  if (t.kind === 'column') return objectMissingColumn(t.table, t.col);
  if (t.kind === 'columnNotNull') return !(await columnHasNotNull(t.table, t.col));
  if (t.kind === 'columnDefault') return columnMissingDefault(t.table, t.col);
  return objectMissingType(t.name);
}

async function fixTarget(target: FixTarget, depth: number): Promise<boolean> {
  if (depth >= MAX_RECURSION) {
    warn(`递归修复达到上限（${MAX_RECURSION}），放弃: ${targetKey(target)}`);
    return false;
  }

  const key = targetKey(target);
  
  // 并发去重：如果已有同目标的修复 Promise，等待它完成
  const pending = runningFixes.get(key);
  if (pending) {
    const result = await pending;
    // 如果之前的修复失败，当前请求尝试自己重新修复
    if (!result) {
      info(`等待的修复失败，当前请求尝试重新修复: ${key}`);
    } else {
      return true;
    }
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
        // DDL 自身缺 schema 对象？递归修复依赖后重试
        if (!isSchemaError(ddlErr)) throw ddlErr;
        const dep = targetFromError(ddlErr);
        if (!dep) throw ddlErr;
        info(`DDL 依赖其他 schema 对象，先递归修复: ${targetKey(dep)}`);
        const depFixed = await fixTarget(dep, depth + 1);
        if (!depFixed) throw ddlErr;
        await innerClient.unsafe(target.ddl);
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

      if (target.kind === 'columnDefault') {
        await fixAllMissingDefaults(target.table);
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
  return await fixPromise;
}

async function fixAllMissingDefaults(tableName: string): Promise<void> {
  const tbl = findTableCI(tableName);
  if (!tbl) return;

  for (const col of tbl.columns) {
    if (!col.defaultSql) continue;
    
    const key = `d:${tbl.name}:${col.name}`;
    if (runningFixes.has(key)) continue;

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
// wrapPromise: 对任意 Promise 捕获 schema 错误 → 修复 → 重新 execute
function wrapPromise<T>(promise: Promise<T>, execute: () => Promise<T>): Promise<T> {
  return promise.catch(async (err) => {
    if (!isSchemaError(err)) throw err;
    const fixed = await ensureSchemaFixedFor(err);
    if (!fixed) throw err;
    action(`重试查询（schema 已修复）`);
    return await execute();
  });
}

function wrapWithSchemaFix<T>(result: PostgresQuery | Promise<T>, execute: () => Promise<T>): PostgresQuery | Promise<T> {
  if (result && typeof result.values === 'function') {
    const query = result as PostgresQuery;
    const origThen = query.then?.bind(query);
    const origValues = query.values?.bind(query);
    const origExecute = query.execute?.bind(query);

    query.then = function (onFulfilled, onRejected) {
      if (!origThen) return Promise.resolve();
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

    if (origValues) {
      query.values = function () {
        return wrapPromise(origValues(), execute);
      };
    }

    if (origExecute) {
      query.execute = function () {
        return wrapPromise(origExecute(), execute);
      };
    }

    return query;
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
  
  const MAX_RETRY = 3;
  let retryCount = 0;
  let hasFailures = true;
  
  while (hasFailures && retryCount < MAX_RETRY) {
    hasFailures = false;
    retryCount++;
    
    if (retryCount > 1) {
      log(`🔄 第 ${retryCount} 次重试创建缺失的对象...`);
    }
    
    for (const [enumName, enumDef] of schemaEnums) {
      const exists = !(await objectMissingType(enumName));
      if (!exists) {
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
    }
    
    const sortedTables = sortTablesByDependency();
    for (const tableDef of sortedTables) {
      const exists = !(await objectMissingTable(tableDef.name));
      if (!exists) {
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
  }
  
  if (hasFailures) {
    warn(`经过 ${MAX_RETRY} 次重试后仍有表创建失败，请检查数据库配置`);
  }
  
  success('表检查完成');
}

function sortTablesByDependency(): TableDef[] {
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
          : [...schemaTables.keys()].find(k => k.toLowerCase() === col.referencesTable.toLowerCase());
        
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
  
  for (const table of tables) {
    if (!sorted.find(t => t.name === table.name)) {
      sorted.push(table);
    }
  }
  
  return sorted;
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

if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await closeConnection();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await closeConnection();
    process.exit(0);
  });
}

let initPromise: Promise<void> | null = null;

export async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      await ensureAllTablesExist();
    } catch (error) {
      error(`数据库初始化失败: ${error}`);
    }
  })();
  
  return initPromise;
}

// 自动初始化但不阻塞 - 仅在需要时初始化
// 移除自动初始化，避免与脚本中的 client.end() 冲突
// 如果需要启动时初始化，应在服务器启动时显式调用

