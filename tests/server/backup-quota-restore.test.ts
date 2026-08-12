import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readProjectFile = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

const quotaSnapshotFields = [
  'quotaConsumed',
  'quotaType',
  'quotaTransactionId',
  'quotaPeriodKey',
  'quotaReturned',
  'quotaReturnTransactionId'
]

test('全量备份包含额度账户、额度流水和歌曲六个额度快照字段', () => {
  const source = readProjectFile('server/api/admin/backup/export.post.ts')

  assert.match(source, /songQuotaAccounts/)
  assert.match(source, /songQuotaTransactions/)
  for (const field of quotaSnapshotFields) {
    assert.match(source, new RegExp(`\\b${field}\\b`))
  }
})

test('全量恢复按账户、歌曲初始态、流水、歌曲回填的阶段处理双向外键', () => {
  const source = readProjectFile('server/api/admin/backup/restore.post.ts')
  const restoreOrder = source.slice(
    source.indexOf('const restoreOrder'),
    source.indexOf('for (const tableName of restoreOrder)')
  )

  assert.ok(restoreOrder.indexOf("'songQuotaAccounts'") < restoreOrder.indexOf("'songs'"))
  assert.ok(restoreOrder.indexOf("'songs'") < restoreOrder.indexOf("'songQuotaTransactions'"))
  assert.match(source, /quotaAccountIdMapping/)
  assert.match(source, /quotaTransactionIdMapping/)
  assert.match(source, /pendingSongQuotaSnapshots/)
  assert.match(source, /回填歌曲额度快照/)
})

test('全量恢复先删除额度流水和账户再删除歌曲与用户', () => {
  const source = readProjectFile('server/api/admin/backup/restore.post.ts')
  const clearBranch = source.slice(
    source.indexOf('if (shouldOverwriteSuperAdmin)'),
    source.indexOf('// 建立ID映射表')
  )

  assert.ok(
    clearBranch.indexOf('delete(songQuotaTransactions)') < clearBranch.indexOf('delete(songs)')
  )
  assert.ok(clearBranch.indexOf('delete(songQuotaAccounts)') < clearBranch.indexOf('delete(users)'))
})

test('全量恢复校验歌曲快照引用的消费和返还流水语义一致', () => {
  const source = readProjectFile('server/api/admin/backup/restore.post.ts')

  assert.match(source, /SONG_REQUEST/)
  assert.match(source, /SONG_WITHDRAW_RETURN|SONG_WITHDRAW_EXPIRED/)
  assert.match(source, /额度快照一致性校验失败/)
})

test('分块恢复覆盖全量导出的全部表', () => {
  const exporter = readProjectFile('server/api/admin/backup/export.post.ts')
  const endpoint = readProjectFile('server/api/admin/backup/restore-chunk.post.ts')
  const client = readProjectFile('app/components/Admin/DatabaseManager.vue')
  const exportTableSource = exporter.slice(
    exporter.indexOf('const tablesToBackup = {'),
    exporter.indexOf('// 如果包含系统数据')
  )
  const exportTables = [...exportTableSource.matchAll(/^      (\w+): \{$/gm)].map(
    (match) => match[1]
  )
  exportTables.push('systemSettings')
  const tableOrder = client.slice(
    client.indexOf('const tableOrder = ['),
    client.indexOf('const mappings = {')
  )

  for (const tableName of exportTables) {
    assert.match(tableOrder, new RegExp(`['"]${tableName}['"]`), `分块恢复顺序缺少 ${tableName}`)
    assert.match(endpoint, new RegExp(`case ['"]${tableName}['"]`), `分块恢复端点缺少 ${tableName}`)
  }
})

test('分块恢复传递并应用 API 密钥与协作者 ID 映射', () => {
  const endpoint = readProjectFile('server/api/admin/backup/restore-chunk.post.ts')
  const client = readProjectFile('app/components/Admin/DatabaseManager.vue')

  assert.match(endpoint, /apiKeyIdMapping/)
  assert.match(endpoint, /collaboratorIdMapping/)
  assert.match(endpoint, /newMappings\.apiKeys/)
  assert.match(endpoint, /newMappings\.collaborators/)
  assert.match(endpoint, /apiKeyId:\s*apiKeyIdMapping\.get\(record\.apiKeyId\)/)
  assert.match(endpoint, /collaboratorId:\s*collaboratorIdMapping\.get\(record\.collaboratorId\)/)
  assert.match(client, /apiKeys:\s*\{\}/)
  assert.match(client, /collaborators:\s*\{\}/)
  assert.match(client, /newMappings\.apiKeys/)
  assert.match(client, /newMappings\.collaborators/)
})

test('分块恢复传递额度账户和流水映射并执行歌曲快照回填阶段', () => {
  const endpoint = readProjectFile('server/api/admin/backup/restore-chunk.post.ts')
  const client = readProjectFile('app/components/Admin/DatabaseManager.vue')

  assert.match(endpoint, /quotaAccountIdMapping/)
  assert.match(endpoint, /quotaTransactionIdMapping/)
  assert.match(endpoint, /case ["']songQuotaAccounts["']/)
  assert.match(endpoint, /case ["']songQuotaTransactions["']/)
  assert.match(endpoint, /case ["']songQuotaSnapshots["']/)
  assert.match(
    client,
    /["']songQuotaAccounts["'][\s\S]*["']songs["'][\s\S]*["']songQuotaTransactions["'][\s\S]*["']songQuotaSnapshots["']/
  )
  assert.match(client, /newMappings\.quotaAccounts/)
  assert.match(client, /newMappings\.quotaTransactions/)
})

test('分块覆盖清理使用单一事务并在失败时立即中止', () => {
  const source = readProjectFile('server/api/admin/backup/clear.post.ts')
  const client = readProjectFile('app/components/Admin/DatabaseManager.vue')
  const clearStart = source.search(/console\.log\(["']清空现有数据\.\.\.["']\)/)
  const clearEnd = source.search(/console\.log\(["']✅ 现有数据已清空["']\)/)
  const clearBranch = source.slice(clearStart, clearEnd)
  const clientClearBranch = client.slice(
    client.search(/if \(restoreForm\.value\.mode === ["']replace["']\)/),
    client.indexOf('const tableOrder = [')
  )

  assert.match(clearBranch, /await db\.transaction\(async \(db\) => \{/)
  assert.ok(
    clearBranch.lastIndexOf('await db.delete') > clearBranch.indexOf('await db.transaction')
  )
  assert.match(clientClearBranch, /if \(!clearResult\.success\)\s+throw new Error/)
})

test('分块覆盖恢复清理先删除额度流水和账户', () => {
  const source = readProjectFile('server/api/admin/backup/clear.post.ts')
  const clearBranch = source.slice(source.search(/console\.log\(["']清空现有数据\.\.\.["']\)/))

  assert.ok(
    clearBranch.indexOf('delete(songQuotaTransactions)') < clearBranch.indexOf('delete(songs)')
  )
  assert.ok(clearBranch.indexOf('delete(songQuotaAccounts)') < clearBranch.indexOf('delete(users)'))
})

test('分块额度快照在任何写入前完成全局预检', () => {
  const endpoint = readProjectFile('server/api/admin/backup/restore-chunk.post.ts')
  const client = readProjectFile('app/components/Admin/DatabaseManager.vue')
  const snapshotLoop = client.slice(
    client.indexOf('for (const tableName of tableOrder) {'),
    client.search(/restoreProgress\.value = getProgressMessage\(["']fixingSequence["']\)/)
  )

  assert.match(endpoint, /tableName === ["']songQuotaSnapshotsPreflight["']/)
  assert.match(endpoint, /validateQuotaSnapshots/)
  assert.match(
    client,
    /tableName === ["']songQuotaSnapshots["'][\s\S]*tableName: ["']songQuotaSnapshotsPreflight["']/
  )
  assert.ok(
    snapshotLoop.indexOf('songQuotaSnapshotsPreflight') < snapshotLoop.indexOf('records.slice')
  )
})

test('分块歌曲快照回填执行消费和返还流水一致性校验', () => {
  const source = readProjectFile('server/api/admin/backup/restore-chunk.post.ts')

  assert.match(source, /SONG_REQUEST/)
  assert.match(source, /SONG_WITHDRAW_RETURN|SONG_WITHDRAW_EXPIRED/)
  assert.match(source, /额度快照一致性校验失败/)
})
