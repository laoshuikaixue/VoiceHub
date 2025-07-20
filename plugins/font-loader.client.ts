export default defineNuxtPlugin(() => {
  // 检查字体是否加载完成
  const checkFontLoaded = () => {
    return new Promise((resolve) => {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          resolve(true)
        })
      } else {
        // 降级方案：等待一段时间
        setTimeout(() => {
          resolve(true)
        }, 1000)
      }
    })
  }

  // 在应用启动时检查字体加载状态
  checkFontLoaded().then(() => {
    // 字体加载完成，可以添加一个全局标识
    document.documentElement.classList.add('fonts-loaded')
  })
})
