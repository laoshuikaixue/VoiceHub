import { readFile, writeFile } from 'node:fs/promises'

export function applyCloudflareDeployConfig(config, hyperdriveId) {
  const updated = {
    ...config,
    keep_vars: true
  }

  if (hyperdriveId) {
    updated.hyperdrive = [
      {
        binding: 'HYPERDRIVE',
        id: hyperdriveId
      }
    ]
  }

  return updated
}

export async function injectCloudflareDeployConfig(path, hyperdriveId) {
  const source = JSON.parse(await readFile(path, 'utf8'))
  const updated = applyCloudflareDeployConfig(source, hyperdriveId)
  await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`)
}
