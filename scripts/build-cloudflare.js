#!/usr/bin/env node

import { spawn } from 'node:child_process'

const env = {
  ...process.env,
  NODE_ENV: 'production',
  NITRO_PRESET: 'cloudflare_module',
  SKIP_INSTALL: 'true'
}

const child = spawn(process.execPath, ['scripts/build.js'], {
  stdio: 'inherit',
  env
})

child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
