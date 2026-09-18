// esbuild 边缘占位模块：音源插件预置环境已由构建脚本在 Node 构建阶段写入快照，
// Workers 运行期不应再调用原生 esbuild。若空快照错误地进入热构建路径，则明确报错。
export const build = async () => {
  throw new Error('边缘运行时不能执行 esbuild，请在构建阶段生成音源插件快照')
}

export default { build }
