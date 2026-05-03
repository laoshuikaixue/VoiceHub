// 生成图形验证码，返回 SVG 与 captchaId
export default defineEventHandler(async (event) => {
  const svgCaptcha = await import('svg-captcha');
  const captcha = svgCaptcha.create({
    size: 4,
    ignoreChars: '0o1il',
    noise: 2,
    color: true,
    background: '#f0f0f0'
  });

  const captchaId = randomUUID();
  // 存入 Redis，Key: captcha:{id}，过期 300s
  const redis = useRedis();
  await redis.set(`captcha:${captchaId}`, captcha.text.toLowerCase(), 'EX', 300);

  return {
    id: captchaId,
    svg: captcha.data // 已经是完整 SVG 标签
  };
});
