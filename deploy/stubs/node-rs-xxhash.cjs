// @node-rs/xxhash 占位模块：redis 客户端用它计算摘要（可选原生依赖，仅集群模式用），
// Workers 边缘环境无原生模块，stub 掉以通过打包
module.exports = {
  xxh32: () => 0,
  xxh64: () => 0n,
  xxh3_64: () => 0n,
  xxh128: () => 0n
}
