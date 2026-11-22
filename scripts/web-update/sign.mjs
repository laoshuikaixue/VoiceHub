import { createPackage } from './package.mjs'

const [keyFile, output] = process.argv.slice(2)
if (!keyFile || !output) throw new Error('用法：node scripts/web-update/sign.mjs <Ed25519 私钥> <输出.vhu>')
await createPackage(process.cwd(), output, keyFile)
