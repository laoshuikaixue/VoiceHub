import assert from 'node:assert/strict'
import test from 'node:test'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 系统看板工具纯函数测试。
 * Node 24 类型剥离无法解析 ~~/* 别名，统一通过子进程 npx tsx 执行 TS 脚本；
 * 脚本以临时文件形式放在仓库根目录执行，保证 './server/…' 相对导入可解析，
 * 命令行不传递多行代码（Windows cmd 下引号内换行会截断命令）。
 */

function runTsx(code: string): string {
  const file = join(process.cwd(), `.system-board-test-${randomUUID()}.ts`)
  writeFileSync(file, code, 'utf-8')
  try {
    const raw = execSync(`npx tsx "${file}"`, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    // 剔除工具日志行，只保留最后一行结果
    return raw.split('\n').filter(l => l.trim() && !l.startsWith('◇') && !l.startsWith('🔄') && !l.startsWith('✅')).pop()?.trim() || ''
  } finally {
    rmSync(file, { force: true })
  }
}

test('resolveBoardEventsQuery returns defaults for empty input', () => {
  const out = runTsx(`
    import { resolveBoardEventsQuery } from './server/services/systemBoardService';
    const q = resolveBoardEventsQuery({});
    console.log(JSON.stringify({ limit: q.limit, level: q.level, source: q.source }));
  `)
  const parsed = JSON.parse(out.trim())
  assert.strictEqual(parsed.limit, undefined)
  assert.strictEqual(parsed.level, undefined)
  assert.strictEqual(parsed.source, undefined)
})

test('resolveBoardEventsQuery clamps valid limit', () => {
  const out = runTsx(`
    import { resolveBoardEventsQuery } from './server/services/systemBoardService';
    const q = resolveBoardEventsQuery({ limit: '123.7' });
    console.log(q.limit);
  `)
  assert.strictEqual(Number(out.trim()), 123)
})

test('buffer hasMore when exceeding limit', () => {
  const out = runTsx(`
    import { listRuntimeEvents, recordRuntimeEvent, clearRuntimeEvents } from './server/utils/system-event-buffer';
    clearRuntimeEvents();
    for (let i = 0; i < 200; i++) recordRuntimeEvent('info', 'test', 'msg-' + i);
    const { hasMore } = listRuntimeEvents({ limit: 100 });
    console.log(hasMore);
  `)
  assert.strictEqual(out.trim(), 'true')
})

test('buffer truncates to BUFFER_SIZE', () => {
  const out = runTsx(`
    import { listRuntimeEvents, recordRuntimeEvent, clearRuntimeEvents } from './server/utils/system-event-buffer';
    import { SYSTEM_BOARD_CONSTANTS } from './server/config/constants';
    clearRuntimeEvents();
    const size = SYSTEM_BOARD_CONSTANTS.BUFFER_SIZE;
    for (let i = 0; i < size + 50; i++) recordRuntimeEvent('info', 'test', 'msg-' + i);
    const meta = listRuntimeEvents({ limit: size + 100 });
    console.log(meta.items.length + ',' + meta.items[meta.items.length - 1].message);
  `)
  const [len, oldest] = out.trim().split(',')
  assert.strictEqual(Number(len), 300)
  assert.strictEqual(oldest, 'msg-50')
})

test('sanitize truncates at 300 chars', () => {
  const out = runTsx(`
    import { listRuntimeEvents, recordRuntimeEvent, clearRuntimeEvents } from './server/utils/system-event-buffer';
    clearRuntimeEvents();
    recordRuntimeEvent('info', 'test', 'x'.repeat(2000));
    const { items } = listRuntimeEvents({ limit: 1 });
    console.log(items[0].message.length);
  `)
  assert.strictEqual(Number(out.trim()), 300)
})
