import assert from 'node:assert/strict'
import test from 'node:test'
import { execSync } from 'node:child_process'

/**
 * Pure-function tests for system-board utils.
 * Run via npx tsx in a subprocess to avoid Node 24 type-stripping issues with ~~/* aliases.
 */

function runTsx(code: string): string {
  const raw = execSync(`npx tsx -e "${code.replace(/"/g, '\\"')}"`, {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })
  // Strip emoji/log lines, keep only the last numeric/string result line
  return raw.split('\n').filter(l => l.trim() && !l.startsWith('◇') && !l.startsWith('🔄') && !l.startsWith('✅')).pop()?.trim() || ''
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
