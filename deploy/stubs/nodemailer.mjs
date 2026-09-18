// nodemailer 占位模块：nodemailer 的 SMTP 连接层基于 node:net/node:tls 原生 socket 与
// require('events') 的互操作，在 workerd（Cloudflare Workers 等）模块 init 阶段即崩溃
// （Class extends value [object Module] is not a constructor）。
// 边缘环境 stub 掉：SMTP 邮件功能不可用（边缘部署建议改用 Resend/SendGrid 等 HTTP 邮件 API）。
const createTransport = () => {
  const fail = async () => {
    throw new Error('边缘运行时不支持 SMTP（nodemailer），请改用 HTTP 邮件 API 或 Node 侧服务')
  }
  return {
    sendMail: fail,
    verify: fail,
    close() {},
    on() {},
    once() {}
  }
}

export default { createTransport }
export { createTransport }
